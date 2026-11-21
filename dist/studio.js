const studio={mode:'view',selected:null,angle:.57,zoom:1,scope:'',extent:4,drag:null,picker:null,items:[],frame:0,busy:false};
function studioScope(){return [gardenAccount.user?.id||'local',visitingGarden?.id||'own',zone].join('/')}
function startStudioLayout(uid){
  studio.scope=studioScope();studio.mode='edit';studio.selected=uid;studio.drag=null;
}
function studioList(design){
  let specimens=collection;
  if(illustrated&&studio.mode!=='edit'){
    specimens=[...sillExamples,...plants].map((p,i)=>({...p,uid:'sample-'+i,zone:GardenLayout.zones[i],size:i<3?'medium':'large',x:0,z:0,studioSample:true}));
  }
  return [...specimens,...design.decorations].filter(p=>p.zone===zone).map((p,i)=>{
    const entry=GardenLayout.located(p);return {...entry,uid:entry.uid||'visit-'+i};
  });
}
function drawStudioFrame(){
  const canvas=$('world');if(!canvas.clientWidth||!canvas.clientHeight)return;
  const design=studio.design,drag=studio.drag;
  if(!design)return;
  const items=studio.items.map(p=>drag?.point&&p.uid===drag.id?{...p,...drag.point}:visibleStudioItem(p));
  studio.picker=paintStudioScene(canvas,{zone,items,scene:design.scene,weather:design.weather,angle:studio.angle,zoom:studio.zoom,extent:studio.extent,selected:studio.mode==='edit'?studio.selected:null});
  updateStudioWeather();
}
function scheduleStudio(){if(!studio.frame)studio.frame=requestAnimationFrame(()=>{studio.frame=0;drawStudioFrame()})}
function renderStudio(){
  const scope=studioScope();
  if(studio.scope!==scope){
    studio.scope=scope;studio.mode='view';studio.selected=null;studio.drag=null;
    studio.angle=.57;studio.zoom=1;
  }
  const edit=studio.mode==='edit',photo=studio.mode==='photo',design=readDesign();
  studio.design=design;studio.items=studioList(design);
  studio.extent=Math.max(3.25,...studio.items.map(p=>Math.max(Math.abs(p.x),Math.abs(p.z))+GardenLayout.radius(p)+.45));
  if(!studio.items.some(p=>p.uid===studio.selected))studio.selected=null;
  for(const b of $('zones').children)b.setAttribute('aria-pressed',b.dataset.zone===zone);
  $('sceneLabel').textContent=(illustrated&&!edit?'示例 · ':'')+places[zone].name;
  $('returnRoom').textContent=places[zone].room?'推窗去室外':'返回室内';
  $('layoutMode').hidden=!!visitingGarden;$('layoutMode').disabled=!['guest','member'].includes(gardenAccount.mode);
  $('layoutMode').textContent=edit?'完成布置':'布置花园';$('layoutMode').setAttribute('aria-pressed',edit);
  $('layoutTools').hidden=!edit;$('cameraControls').hidden=!photo;
  $('stage').classList.toggle('photoStudio',photo);
  $('sceneChoice').value=design.scene;$('weatherChoice').value=design.weather;
  $('sceneChoice').disabled=$('weatherChoice').disabled=!!visitingGarden||studio.busy;
  if(edit){
    const picker=$('pickObject');picker.replaceChildren(new Option('点选或拖动场景中的物品',''));
    for(const p of studio.items)picker.add(new Option(p.kind?GardenLayout.props[p.kind]:p.name,p.uid));
    picker.value=studio.selected||'';$('removeProp').hidden=!studio.items.some(p=>p.uid===studio.selected&&p.kind);
  }
  scheduleStudio();
}
async function saveStudio(change,message){
  if(studio.busy||visitingGarden)return;
  const scope=studioScope();studio.busy=true;
  try{
    if(studioMoveSave)await studioMoveSave;
    await writeGarden((records,design)=>{if(scope!==studioScope()||visitingGarden)throw Error('场景已切换，请重新操作。');change(records,design)});
    if(scope===studioScope()){$('layoutStatus').textContent=message||''}
  }catch(e){$('layoutStatus').textContent=e.message;toast(e.message)}
  finally{studio.busy=false;route()}
}
// Keep released objects at their visible positions while the account save is in flight.
const studioMoves=new Map();
let studioMoveSave=null;
function visibleStudioItem(p){
  const move=studioMoves.get(p.uid);
  return move&&move.scope===studioScope()?{...p,...move.point}:p;
}
async function flushStudioMoves(){
  try{
    while(studioMoves.size){
      const batch=[...studioMoves.values()];
      if(batch.some(move=>move.owner!==(gardenAccount.user?.id||null)))throw Error('账号已切换，请重新布置。');
      await writeGarden((records,design)=>{
        const all=records.concat(design.decorations);
        for(const {id,area,point} of batch){
          const item=all.find(p=>p.uid===id&&p.zone===area);
          if(!item)throw Error('物品位置已变更，请重新选择。');
          Object.assign(item,point);
        }
      });
      for(const move of batch){
        const displayed=move.scope===studioScope()&&studio.items.find(p=>p.uid===move.id);
        if(displayed)Object.assign(displayed,move.point);
        if(studioMoves.get(move.id)===move)studioMoves.delete(move.id);
      }
    }
    $('layoutStatus').textContent='位置已保存。';
  }catch(e){
    studioMoves.clear();$('layoutStatus').textContent=e.message;toast(e.message);
  }finally{studioMoveSave=null;route()}
}
function moveStudio(id,point){
  if(!point||!id||studio.busy||visitingGarden)return;
  const pos={x:Math.round(point.x*1000)/1000,z:Math.round(point.z*1000)/1000};
  const all=studio.items.map(visibleStudioItem),p=all.find(item=>item.uid===id);
  if(!p)return;
  const bound=studio.extent-GardenLayout.radius(p);
  const message=Math.max(Math.abs(pos.x),Math.abs(pos.z))>bound?'请放在台面或地面范围内。':
    !GardenLayout.clear({...p,...pos},all)?'这里会与其他物品重叠，请换个位置。':'';
  if(message){$('layoutStatus').textContent=message;toast(message);scheduleStudio();return}
  studioMoves.set(id,{id,point:pos,scope:studioScope(),area:zone,owner:gardenAccount.user?.id||null});
  $('layoutStatus').textContent='正在保存位置…';scheduleStudio();
  if(!studioMoveSave)studioMoveSave=flushStudioMoves();
  return studioMoveSave;
}
function setStudioMode(mode){
  if(visitingGarden&&mode==='edit')return;
  studio.mode=mode;studio.drag=null;studio.selected=null;$('layoutStatus').textContent='';
  renderStudio();$('world').focus({preventScroll:true});
}
function studioZoom(scale){studio.zoom=Math.max(.55,Math.min(2.65,studio.zoom*scale));scheduleStudio()}
function initStudio(){
  for(const [id,values] of [['sceneChoice',GardenLayout.scenes],['weatherChoice',GardenLayout.weather],['propChoice',GardenLayout.props]]){
    for(const [key,label] of Object.entries(values))$(id).add(new Option(label,key));
  }
  for(const [id,key] of [['sceneChoice','scene'],['weatherChoice','weather']])$(id).onchange=e=>{
    const value=e.target.value;void saveStudio((_,design)=>{design[key]=value});
  };
  $('layoutMode').onclick=()=>setStudioMode(studio.mode==='edit'?'view':'edit');
  $('photoMode').onclick=()=>setStudioMode('photo');$('exitPhoto').onclick=()=>setStudioMode('view');
  $('returnRoom').onclick=()=>{
    selectZone(places[zone].room?outdoorZone:indoorZone);
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches)$('world').animate([{opacity:.25,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:380});
  };
  $('larger').onclick=()=>studioZoom(1.18);$('smaller').onclick=()=>studioZoom(1/1.18);
  $('cameraNear').onclick=$('larger').onclick;$('cameraWide').onclick=$('smaller').onclick;
  $('resetView').onclick=()=>{studio.angle=.57;studio.zoom=1;scheduleStudio()};
  $('pickObject').onchange=e=>{studio.selected=e.target.value||null;renderStudio()};
  $('addProp').onclick=()=>saveStudio((records,design)=>{
    const p={uid:crypto.randomUUID(),kind:$('propChoice').value,zone};
    Object.assign(p,GardenLayout.place(p,records.concat(design.decorations)));
    design.decorations.push(p);studio.selected=p.uid;
  },'装饰已摆入，可拖动调整。');
  $('removeProp').onclick=()=>saveStudio((_,design)=>{
    const i=design.decorations.findIndex(p=>p.uid===studio.selected&&p.zone===zone);
    if(i>=0)design.decorations.splice(i,1);studio.selected=null;
  },'装饰已移除。');
  const canvas=$('world');
  function local(e){const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top]}
  canvas.onpointerdown=e=>{
    if(!studio.picker||studio.drag||e.button!==0||studio.busy)return;
    const [x,y]=local(e),id=studio.picker.hit(x,y),pt=studio.picker.ground(x,y);
    const stored=studio.items.find(p=>p.uid===id),item=stored&&visibleStudioItem(stored);
    studio.drag={pid:e.pointerId,x,y,id,angle:studio.angle,moved:false,origin:pt,item,scope:studioScope()};
    canvas.setPointerCapture(e.pointerId);
    if(studio.mode==='edit'&&id){studio.selected=id;$('pickObject').value=id;$('removeProp').hidden=!item?.kind;scheduleStudio()}
  };
  canvas.onpointermove=e=>{
    const d=studio.drag;if(!d||d.pid!==e.pointerId)return;
    const [x,y]=local(e);d.moved||=Math.hypot(x-d.x,y-d.y)>4;if(!d.moved)return;
    if(studio.mode==='edit'&&d.item){
      const pt=studio.picker.ground(x,y);
      d.point={x:d.item.x+pt.x-d.origin.x,z:d.item.z+pt.z-d.origin.z};
    }else studio.angle=d.angle+(x-d.x)*.009;
    scheduleStudio();
  };
  canvas.onpointercancel=()=>{studio.drag=null;scheduleStudio()};
  canvas.onpointerup=e=>{
    const d=studio.drag;if(!d||e.pointerId!==d.pid)return;
    studio.drag=null;const [x,y]=local(e);
    if(d.scope!==studioScope())return;
    if(studio.mode==='edit'){
      if(d.point)void moveStudio(d.id,d.point);
      else if(!d.moved&&!d.id&&studio.selected)void moveStudio(studio.selected,studio.picker.ground(x,y));
      else renderStudio();
    }else if(!d.moved&&studio.mode==='view'){
      if(d.item?.kind)toast(GardenLayout.props[d.item.kind]);
      else if(d.item){if(visitingGarden)sharedDetail(d.item);else if(d.item.studioSample)sample(d.item,{zone});else detail(d.item)}
      else if(studio.picker.windowHit(x,y))$('returnRoom').click();
    }
    scheduleStudio();
  };
  canvas.onwheel=e=>{e.preventDefault();studioZoom(Math.exp(-Math.sign(e.deltaY)*.12))};
  canvas.onkeydown=e=>{
    if(e.key==='Escape'){if(studio.mode!=='view')setStudioMode('view');return}
    if(['+','=','-'].includes(e.key)){e.preventDefault();studioZoom(e.key==='-'?.9:1.1);return}
    const step=e.shiftKey?.5:.12,deltas={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
    if(!Object.hasOwn(deltas,e.key))return;e.preventDefault();
    const target=studio.items.find(p=>p.uid===studio.selected),p=target&&visibleStudioItem(target);
    if(studio.mode==='edit'&&p){const [dx,dz]=deltas[e.key];void moveStudio(p.uid,{x:p.x+dx,z:p.z+dz})}
    else{studio.angle+=e.key==='ArrowLeft'||e.key==='ArrowUp'?-.12:.12;scheduleStudio()}
  };
  $('shutter').onclick=()=>{
    const photo=document.createElement('canvas'),ratio=canvas.clientHeight/Math.max(1,canvas.clientWidth);
    photo.width=1920;photo.height=Math.max(1,Math.round(1920*ratio));
    const design=readDesign();
    const frame=paintStudioScene(photo,{zone,items:studio.items.map(visibleStudioItem),scene:design.scene,weather:design.weather,angle:studio.angle,zoom:studio.zoom,extent:studio.extent,selected:null});
    const layer=document.createElement('canvas');
    paintStudioWeather(layer,frame,zone,design.weather,matchMedia('(prefers-reduced-motion:reduce)').matches?0:performance.now()/1000);
    const ctx=photo.getContext('2d');ctx.resetTransform();ctx.drawImage(layer,0,0);
    photo.toBlob(blob=>{
      if(!blob){toast('照片生成失败，请重试。');return}
      const a=document.createElement('a'),url=URL.createObjectURL(blob);
      a.href=url;a.download='植迹-'+places[zone].name+'-'+Date.now()+'.png';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);toast('花园照片已生成。');
    },'image/png');
  };
  initStudioWeather();
  new ResizeObserver(scheduleStudio).observe(canvas);
}
