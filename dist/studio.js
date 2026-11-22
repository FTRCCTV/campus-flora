const studio={mode:'view',selected:null,angle:.57,pitch:.53,panX:0,panY:0,pan:false,zoom:1,scope:'',extent:4,drag:null,picker:null,items:[],frame:0,busy:false};
function studioScope(){return [gardenAccount.user?.id||'local',visitingGarden?.id||'own',zone].join('/')}
function startStudioLayout(uid){
  studio.scope=studioScope();studio.pitch=Math.max(.25,studio.pitch);studio.mode='edit';studio.selected=uid;studio.drag=null;$('layoutStatus').textContent='有未保存的布置。';
}
function studioList(design){
  let specimens=activeStudioDraft()?.records.map(localPlantTraits)||collection;
  if(illustrated&&!specimens.length&&!design.decorations.length&&studio.mode!=='edit'){
    specimens=[...sillExamples,...plants].map((p,i)=>({...p,uid:'sample-'+i,zone:i<3?'sill':'path',size:i<3?'medium':'large',x:[-1.6,.2,1.7,-2.7,.3,2.7][i],z:[.4,-.6,.5,.9,-1.4,1][i],studioSample:true}));
  }
  return [...specimens,...design.decorations].filter(p=>p.zone===zone).map((p,i)=>{
    const entry=GardenLayout.located(p);return {...entry,uid:entry.uid||'visit-'+i};
  });
}
function drawStudioFrame(){
  const canvas=$('world');if(!canvas.clientWidth||!canvas.clientHeight)return;
  const design=studio.design,drag=studio.drag;
  if(!design)return;
  const items=drag?.point?studio.items.map(p=>p.uid===drag.id?{...p,...drag.point}:p):studio.items;
  studio.picker=paintStudioScene(canvas,{zone,items,orbiting:drag?.moved&&!(studio.mode==='edit'&&drag.item)&&!drag.panning,scene:design.scene,weather:design.weather,angle:studio.angle,pitch:studio.pitch,panX:studio.panX,panY:studio.panY,zoom:studio.zoom,extent:studio.extent,selected:studio.mode==='edit'?studio.selected:null});
  studioClimate.last=-1;updateStudioWeather();
}
function scheduleStudio(){if(!studio.frame)studio.frame=requestAnimationFrame(()=>{studio.frame=0;drawStudioFrame()})}
function renderStudio(){
  const scope=studioScope();
  if(studio.scope!==scope){
    studio.scope=scope;studio.mode=activeStudioDraft()?'edit':'view';studio.selected=null;studio.drag=null;
    resetStudioCamera();
  }
  const edit=studio.mode==='edit',photo=studio.mode==='photo',design=readDesign();
  studio.design=design;studio.items=studioList(design);
  studio.extent=Math.max(edit?studio.extent:3.25,3.25,...studio.items.map(p=>Math.max(Math.abs(p.x),Math.abs(p.z))+GardenLayout.radius(p)+.45));
  if(!studio.items.some(p=>p.uid===studio.selected))studio.selected=null;
  for(const b of $('zones').children)b.setAttribute('aria-pressed',b.dataset.zone===zone);
  $('sceneLabel').textContent=(illustrated&&!edit?'示例 · ':'')+places[zone].name;
  $('returnRoom').textContent=places[zone].room?'推窗去室外':'返回室内';
  $('layoutMode').hidden=!!visitingGarden;$('layoutMode').disabled=!['guest','member'].includes(gardenAccount.mode);
  $('layoutMode').textContent=edit?(studio.busy?'正在保存…':'保存布置'):'布置花园';$('layoutMode').setAttribute('aria-pressed',edit);
  $('gardenModelLoad').hidden=!studio.items.some(p=>p.latin&&inFlight.has(profileKey(p.latin)));
  $('layoutMode').disabled||=studio.busy;$('cancelLayout').hidden=!edit;$('cancelLayout').disabled=studio.busy;
  $('layoutTools').hidden=!edit;$('cameraControls').hidden=!photo;
  $('stage').classList.toggle('photoStudio',photo);
  $('sceneChoice').value=design.scene;$('weatherChoice').value=design.weather;
  $('sceneChoice').disabled=$('weatherChoice').disabled=!!visitingGarden||studio.busy;
  $('cameraPan').setAttribute('aria-pressed',String(studio.pan));
  if(edit){
    const picker=$('pickObject');picker.replaceChildren(new Option('点选或拖动场景中的物品',''));
    for(const p of studio.items)picker.add(new Option(p.kind?GardenLayout.props[p.kind]:p.name,p.uid));
    picker.value=studio.selected||'';studioSelectionTools();
  }
  scheduleStudio();
}
function studioSelectionTools(){
  const item=studio.items.find(p=>p.uid===studio.selected);
  $('propSizeControl').hidden=$('rotateProp').hidden=$('removeProp').hidden=!item?.kind;
  $('potControl').hidden=!item||!!item.kind||!studioIndoor(zone);
  $('propScale').value=String(item?.scale??1);$('potStyle').value=item?.potStyle||'clay';
}
function editStudioLayout(change){
  if(studio.busy||visitingGarden)return;
  try{
    changeStudioDraft(change);
    if(studio.mode!=='edit')setStudioMode('edit');
    $('layoutStatus').textContent='有未保存的布置。';
  }catch(e){$('layoutStatus').textContent=e.message;toast(e.message)}
  renderStudio();
}
function moveStudio(id,point){
  if(!point||!id||studio.busy||visitingGarden)return;
  const pos={x:Math.round(point.x*1000)/1000,z:Math.round(point.z*1000)/1000};
  const all=studio.items,p=all.find(item=>item.uid===id);
  if(!p)return;
  const bound=studio.extent-GardenLayout.radius(p);
  const message=Math.max(Math.abs(pos.x),Math.abs(pos.z))>bound?'请放在台面或地面范围内。':
    !GardenLayout.clear({...p,...pos},all)?'这里会与其他物品重叠，请换个位置。':'';
  if(message){$('layoutStatus').textContent=message;toast(message);scheduleStudio();return}
  const d=beginStudioDraft();
  const list=p.kind?d.design.decorations:d.records;
  const next=list.map(item=>item.uid===id?{...item,...pos}:item);
  if(p.kind)d.design={...d.design,decorations:next};else d.records=next;
  Object.assign(p,pos);d.dirty=true;
  $('layoutStatus').textContent='有未保存的布置。';
  scheduleStudio();
}
function setStudioMode(mode){
  if(visitingGarden&&mode==='edit')return;
  if(mode==='edit'){if(!activeStudioDraft())beginStudioDraft();studio.pitch=Math.max(.25,studio.pitch)}
  studio.pan=false;studio.mode=mode;studio.drag=null;studio.selected=null;$('layoutStatus').textContent='';
  renderStudio();$('world').focus({preventScroll:true});
}
function resetStudioCamera(){
  Object.assign(studio,{angle:.57,pitch:.53,panX:0,panY:0,zoom:1,pan:false});
}
function clampStudioPitch(value){return Math.max(studio.mode==='edit'?.25:0,Math.min(1.42,value))}
function studioZoom(scale){studio.zoom=Math.max(.55,Math.min(2.65,studio.zoom*scale));scheduleStudio()}
function initStudio(){
  for(const [id,values] of [['sceneChoice',GardenLayout.scenes],['weatherChoice',GardenLayout.weather],['propChoice',GardenLayout.props]]){
    for(const [key,label] of Object.entries(values))$(id).add(new Option(label,key));
  }
  for(const [id,key] of [['sceneChoice','scene'],['weatherChoice','weather']])$(id).onchange=e=>{
    const value=e.target.value;void editStudioLayout((_,design)=>{design[key]=value});
  };
  $('layoutMode').onclick=()=>studio.mode==='edit'?commitStudioDraft():setStudioMode('edit');
  $('cancelLayout').onclick=discardStudioDraft;
  $('photoMode').onclick=()=>setStudioMode('photo');$('exitPhoto').onclick=()=>setStudioMode(activeStudioDraft()?'edit':'view');
  $('returnRoom').onclick=()=>{
    selectZone(places[zone].room?outdoorZone:indoorZone);
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches)$('world').animate([{opacity:.25,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:380});
  };
  $('larger').onclick=()=>studioZoom(1.18);$('smaller').onclick=()=>studioZoom(1/1.18);
  $('cameraNear').onclick=$('larger').onclick;$('cameraWide').onclick=$('smaller').onclick;
  $('resetView').onclick=()=>{resetStudioCamera();scheduleStudio()};
  $('cameraLevel').onclick=()=>{studio.pitch=0;scheduleStudio()};
  $('cameraAbove').onclick=()=>{studio.pitch=1.12;scheduleStudio()};
  $('cameraPan').onclick=()=>{studio.pan=!studio.pan;$('cameraPan').setAttribute('aria-pressed',String(studio.pan))};
  $('potStyle').onchange=e=>{
    const value=e.target.value,id=studio.selected;
    void editStudioLayout(records=>{const p=records.find(p=>p.uid===id&&p.zone===zone);if(p)p.potStyle=value});
  };
  $('propScale').onchange=e=>{
    const value=Number(e.target.value),id=studio.selected;
    void editStudioLayout((records,design)=>{
      const p=design.decorations.find(p=>p.uid===id&&p.zone===zone);
      if(!p)throw Error('请重新选择摆件。');
      if(!GardenLayout.clear({...p,scale:value},records.concat(design.decorations)))throw Error('放大后会重叠，请先挪出空间。');
      p.scale=value;
    });
  };
  $('rotateProp').onclick=()=>editStudioLayout((_,design)=>{
    const p=design.decorations.find(item=>item.uid===studio.selected&&item.zone===zone);
    if(p)p.rotation=((p.rotation||0)+Math.PI/4)%(Math.PI*2);
  });
  $('pickObject').onchange=e=>{studio.selected=e.target.value||null;renderStudio()};
  $('addProp').onclick=()=>editStudioLayout((records,design)=>{
    const p={uid:crypto.randomUUID(),kind:$('propChoice').value,zone};
    Object.assign(p,GardenLayout.place(p,records.concat(design.decorations)));
    design.decorations.push(p);studio.selected=p.uid;
  });
  $('removeProp').onclick=()=>editStudioLayout((_,design)=>{
    const i=design.decorations.findIndex(p=>p.uid===studio.selected&&p.zone===zone);
    if(i>=0)design.decorations.splice(i,1);studio.selected=null;
  });
  const canvas=$('world');
  function local(e){const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top]}
  canvas.onpointerdown=e=>{
    if(!studio.picker||studio.drag||e.button!==0||studio.busy)return;
    const [x,y]=local(e),id=studio.picker.hit(x,y),pt=studio.picker.ground(x,y);
    const stored=studio.items.find(p=>p.uid===id),item=stored;
    studio.drag={pid:e.pointerId,x,y,id,angle:studio.angle,pitch:studio.pitch,panX:studio.panX,panY:studio.panY,panning:studio.mode==='photo'&&(studio.pan||e.shiftKey),moved:false,origin:pt,ground:studio.picker.ground,item,scope:studioScope()};
    canvas.setPointerCapture(e.pointerId);
    if(studio.mode==='edit'&&id){studio.selected=id;$('pickObject').value=id;studioSelectionTools();scheduleStudio()}
  };
  canvas.onpointermove=e=>{
    const d=studio.drag;if(!d||d.pid!==e.pointerId)return;
    const [x,y]=local(e);d.moved||=Math.hypot(x-d.x,y-d.y)>4;if(!d.moved)return;
    if(studio.mode==='edit'&&d.item){
      const pt=d.ground(x,y),limit=studio.extent-GardenLayout.radius(d.item);
      const bounded=v=>Math.max(-limit,Math.min(limit,v));
      d.point={x:bounded(d.item.x+pt.x-d.origin.x),z:bounded(d.item.z+pt.z-d.origin.z)};
    }else if(d.panning){
      studio.panX=Math.max(-1,Math.min(1,d.panX+(x-d.x)/canvas.clientWidth));
      studio.panY=Math.max(-1,Math.min(1,d.panY+(y-d.y)/canvas.clientHeight));
    }else{
      studio.angle=d.angle-(x-d.x)*.009;
      studio.pitch=clampStudioPitch(d.pitch+(y-d.y)*.006);
    }
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
    if(e.key==='Escape'){if(studio.mode==='edit')discardStudioDraft();else if(studio.mode==='photo')setStudioMode(activeStudioDraft()?'edit':'view');return}
    if(['+','=','-'].includes(e.key)){e.preventDefault();studioZoom(e.key==='-'?.9:1.1);return}
    const step=e.shiftKey?.5:.12,deltas={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
    if(!Object.hasOwn(deltas,e.key))return;e.preventDefault();
    const target=studio.items.find(p=>p.uid===studio.selected),p=target;
    if(studio.mode==='edit'&&p){const [dx,dz]=deltas[e.key];void moveStudio(p.uid,{x:p.x+dx,z:p.z+dz})}
    else{
      const [dx,dy]=deltas[e.key];
      if(studio.mode==='photo'&&studio.pan){studio.panX=Math.max(-1,Math.min(1,studio.panX+dx/4));studio.panY=Math.max(-1,Math.min(1,studio.panY+dy/4))}
      else{studio.angle-=dx;studio.pitch=clampStudioPitch(studio.pitch+dy)}
      scheduleStudio();
    }
  };
  $('shutter').onclick=()=>{
    const photo=document.createElement('canvas'),ratio=canvas.clientHeight/Math.max(1,canvas.clientWidth);
    photo.width=1920;photo.height=Math.max(1,Math.round(1920*ratio));
    const design=readDesign();
    const frame=paintStudioScene(photo,{zone,items:studio.items,scene:design.scene,weather:design.weather,angle:studio.angle,pitch:studio.pitch,panX:studio.panX,panY:studio.panY,zoom:studio.zoom,extent:studio.extent,selected:null});
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
