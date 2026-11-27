const bench={key:'',id:'',plant:null,list:[],owned:false,yaw:.34,pitch:.28,zoom:1,pointers:new Map(),frame:0,meshKey:'',ready:false,saving:false};
const benchFields={potStyle:['benchPot','clay'],potSticker:['benchSticker','none'],plantCharm:['benchCharm','none']};
function benchIdentity(p){return p.uid||p.latin}
function benchStyle(p){return Object.fromEntries(Object.entries(benchFields).map(([k,[,v]])=>[k,p[k]||v]))}
function benchPreview(){return Object.fromEntries(Object.entries(benchFields).map(([k,[id]])=>[k,$(id).value]))}
function benchReset(){bench.yaw=.34;bench.pitch=.28;bench.zoom=1;bench.pointers.clear();benchDraw()}
function benchDraw(){
  if(bench.frame)return;
  bench.frame=requestAnimationFrame(()=>{
    bench.frame=0;
    const host=$('heroPlant'),p=bench.plant;if(!p||$('explore').hidden||!host.clientWidth)return;
    const plant={...p,...benchPreview()},key=JSON.stringify([bench.key,plant.form,plant.model,plant.palette,plant.size,plant.growth,plant.potStyle,plant.potSticker,plant.plantCharm]);
    if(key!==bench.meshKey){bench.faces=specimenMesh(plant,true);bench.meshKey=key}
    const dpr=Math.min(devicePixelRatio||1,1.75);
    paintSpecimen($('heroCanvas'),plant,{potted:true,portrait:true,width:Math.round(host.clientWidth*dpr),height:Math.round(host.clientHeight*dpr),angle:bench.yaw,pitch:bench.pitch,zoom:bench.zoom,faces:bench.faces});
  });
}
function setBenchZoom(v){bench.zoom=Math.max(.55,Math.min(3.4,v));benchDraw()}
function selectBench(plant){
  bench.id=benchIdentity(plant);home();
}
function home(){
  if(!bench.ready)initBench();
  const list=collection.length?collection:[sillExamples[0],plants[0],sillExamples[2],plants[1],plants[2],sillExamples[1]];
  const own=!!collection.length,owner=studioOwner(),p=list.find(p=>benchIdentity(p)===bench.id)||list[0],id=benchIdentity(p),key=[owner,own,id,p.latin].join('/');
  const changed=key!==bench.key;bench.list=list;bench.plant=p;bench.owned=own;bench.id=id;bench.key=key;
  const saved=JSON.stringify(benchStyle(p));
  if(changed||saved!==bench.saved){
    for(const [k,[field,def]] of Object.entries(benchFields))$(field).value=p[k]||def;
    bench.saved=saved;$('benchStatus').textContent='';if(changed){benchReset();$('benchStyle').open=false}
  }
  const pick=$('heroPick');pick.replaceChildren(...list.map(r=>new Option(r.name+(own?' · '+placementName(r):''),benchIdentity(r))));pick.value=id;
  $('heroName').textContent=p.name;$('heroLatin').textContent=p.latin;
  const {stage,care,goals,percent}=growthSummary(p);
  $('heroStage').textContent=own?nurseryStages[stage][0]+' · 第 '+(p.generation||1)+' 代':'图鉴示例';
  $('heroNote').textContent=own?'总成长 '+percent+'% · '+(stage<3?Object.keys(goals).map(k=>careNames[k]+' '+care[k]+'/'+goals[k]).join(' · '):'已记录照料 '+(p.careCount||0)+' 次'):p.note;
  $('heroGrowth').hidden=!own;$('heroGrowth').value=percent;
  $('heroDetail').textContent=own?'打开生长手记':'试种这株';$('heroDetail').onclick=()=>own?detail(p):sample(p);
  for(const [field] of Object.values(benchFields))$(field).disabled=bench.saving;
  $('benchStyle').hidden=!own;$('benchSave').disabled=bench.saving||!!activeStudioDraft()||!owner;
  if(own&&activeStudioDraft())$('benchStatus').textContent='先保存或取消花园布置，再保存装扮。';
  $('homeTitle').textContent=own?'我的观察记录':'挑一株上观察台';
  $('homeKicker').textContent=own?'MY SPECIMENS':'PLANTING LIBRARY';
  const atlas=$('atlas'),catalogKey=JSON.stringify([owner,...list.map(r=>[benchIdentity(r),r.latin,r.name,r.growth])]);
  if(bench.catalogKey!==catalogKey||list.some((r,i)=>r.photo!==bench.photos?.[i])){
    bench.catalogKey=catalogKey;bench.photos=list.map(r=>r.photo);
    atlas.replaceChildren(...list.map(r=>thumbButton(r,()=>selectBench(r),own?nurseryStages[r.growth??2][0]:r.family)));
  }
  for(const [i,b] of Array.from(atlas.children).entries())b.setAttribute('aria-pressed',String(benchIdentity(list[i])===id));
  benchDraw();
}
function initBench(){
  bench.ready=true;const host=$('heroPlant');
  $('heroPick').onchange=e=>{const p=bench.list.find(p=>benchIdentity(p)===e.target.value);if(p)selectBench(p)};
  $('heroPlus').onclick=()=>setBenchZoom(bench.zoom*1.2);$('heroMinus').onclick=()=>setBenchZoom(bench.zoom/1.2);$('heroReset').onclick=benchReset;
  host.addEventListener('wheel',e=>{e.preventDefault();setBenchZoom(bench.zoom*Math.exp(-Math.max(-300,Math.min(300,e.deltaY*(e.deltaMode===1?16:1)))*.002))},{passive:false});
  const points=bench.pointers,span=()=>{const [a,b]=[...points.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
  host.onpointerdown=e=>{
    if(e.button!==0||points.size>=2)return;host.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});host.classList.add('moving');
  };
  host.onpointermove=e=>{
    const old=points.get(e.pointerId);if(!old)return;
    const prev=points.size===2?span():0;points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===2){if(prev>2)setBenchZoom(bench.zoom*span()/prev)}
    else{bench.yaw+=(e.clientX-old.x)*.014;bench.pitch=Math.max(-.2,Math.min(1.2,bench.pitch-(e.clientY-old.y)*.009));benchDraw()}
  };
  host.onpointerup=host.onpointercancel=host.onlostpointercapture=e=>{points.delete(e.pointerId);if(!points.size)host.classList.remove('moving')};
  host.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;
    e.preventDefault();if(e.key==='Home')benchReset();
    else if(['+','=','-'].includes(e.key))setBenchZoom(bench.zoom*(e.key==='-'?.83:1.2));
    else{bench.yaw+=e.key==='ArrowRight'?.17:e.key==='ArrowLeft'?-.17:0;bench.pitch=Math.max(-.2,Math.min(1.2,bench.pitch+(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0)));benchDraw()}
  };
  new ResizeObserver(benchDraw).observe(host);
  for(const [id] of Object.values(benchFields))$(id).onchange=()=>{$('benchStatus').textContent='装扮预览中';benchDraw()};
  $('benchSave').onclick=async()=>{
    const p=bench.plant,key=bench.key,owner=studioOwner(),style=benchPreview(),before=bench.saved;
    if(!owner||!bench.owned||bench.saving||activeStudioDraft())return;
    bench.saving=true;$('benchSave').disabled=true;
    for(const [field] of Object.values(benchFields))$(field).disabled=true;
    try{
      await writeGarden(records=>{
        const current=records.find(item=>item.uid===p.uid);
        if(owner!==studioOwner()||activeStudioDraft()||!current||current.latin!==p.latin)throw Error('植株已变动，请重新打开观察台。');
        if(JSON.stringify(benchStyle(current))!==before)throw Error('装扮已被更新，请刷新后重试。');
        Object.assign(current,style);
      });
      if(owner===studioOwner()){route();if(bench.key===key)$('benchStatus').textContent='已保存到这株植物'}
    }catch(e){if(bench.key===key)$('benchStatus').textContent=e.message}
    finally{bench.saving=false;for(const [field] of Object.values(benchFields))$(field).disabled=false;$('benchSave').disabled=!studioOwner()||!!activeStudioDraft()}
  };
}
