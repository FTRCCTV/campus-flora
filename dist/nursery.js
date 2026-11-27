// Care is recorded per plant and only changes when its owner acts.
const nurseryStages=[
  ['幼苗','轻轻浇水','让幼苗展开第一批新叶。'],
  ['展叶','转盆向光','让植株展开枝叶，长成自己的株形。'],
  ['成株','观察种穗','完成这株植物的游戏养成，留下可采集的种子。'],
  ['种子成熟','收进种子袋','保存这个品种，以后可以反复播种，也能分享给花友。'],
  ['已留种','打开种子袋','种子已收好，母株会继续留在花园里。']
];
const careNames={water:'水分',light:'光照',nutrient:'养分'};
const careVerbs={water:'浇水',light:'转盆向光',nutrient:'施肥'};
function growthSummary(plant){
  const stage=plant.growth??2,goals=GardenLayout.carePlan(plant),care={water:0,light:0,nutrient:0,...plant.care};
  const keys=Object.keys(goals),progress=keys.reduce((n,k)=>n+Math.min(goals[k],care[k]),0)/keys.reduce((n,k)=>n+goals[k],0);
  return {stage,goals,care,percent:stage>=3?100:Math.round((stage+progress)/3*100)};
}
async function careForPlant(plant,kind,owner){
  const snapshot=growthSummary(plant);
  await writeGarden((records,design)=>{
    if(!owner||owner!==studioOwner()||visitingGarden||activeStudioDraft())throw Error('花园已切换或正在布置，请重新选择。');
    const current=records.find(p=>p.uid===plant.uid);
    if(!current||current.latin!==plant.latin||(current.growth??2)!==snapshot.stage||
       Object.keys(careNames).some(k=>(current.care?.[k]||0)!==snapshot.care[k]))throw Error('植株已有更新，请重新选择。');
    GardenLayout.tend(current,kind);
    if((current.growth??2)>snapshot.stage){
      const other=GardenLayout.blocker(GardenLayout.located(current),records.concat(design.decorations));
      if(other)throw Error('长大后会碰到「'+(other.name||GardenLayout.props[other.kind])+'」，请先留出空间。');
    }
  });
}
function renderPlantCare(plant,panel=$('carePanel'),compact=false){
  const {stage,goals,care,percent}=growthSummary(plant),owner=studioOwner(),blocked=!!activeStudioDraft()||!owner||!!visitingGarden;
  panel.className='nurseryPanel'+(compact?' compactCare':'');
  panel.innerHTML='<div class="nurseryHeading"><h3></h3><small></small></div><div class="growthTrack"></div><div class="careMeters"></div><div class="careActions"></div><p role="status" class="careStatus"></p>';
  panel.querySelector('h3').textContent=compact?plant.name+' · '+nurseryStages[stage][0]:'生长手记';
  panel.querySelector('small').textContent='第 '+(plant.generation??1)+' 代 · 已记录照料 '+(plant.careCount||0)+' 次'+(plant.seedFrom?' · 来自 '+plant.seedFrom:'');
  if(!compact){const art=document.createElement('canvas');art.className='carePortrait';art.setAttribute('aria-label','当前生长阶段');panel.querySelector('.growthTrack').before(art);paintPot(art,plant)}
  const track=panel.querySelector('.growthTrack');
  for(const [i,[name]] of nurseryStages.entries()){
    const tag=document.createElement('span');tag.textContent=name;if(i<=stage)tag.className='reached';
    if(i===stage)tag.setAttribute('aria-current','step');track.append(tag);
  }
  function meter(name,value,max,unit){
    const line=document.createElement('label'),bar=document.createElement('progress');
    line.textContent=name+' '+value+unit;bar.max=max;bar.value=value;line.append(bar);panel.querySelector('.careMeters').append(line);
  }
  meter('总成长',percent,100,'%');
  if(stage<3)for(const k of Object.keys(goals))meter(careNames[k],care[k],goals[k],' / '+goals[k]);
  const status=panel.querySelector('.careStatus'),buttons=panel.querySelector('.careActions');
  if(blocked)status.textContent='保存或取消布置后可以照料。';
  else if(stage>=3)status.textContent='植株已成熟，浇水和施肥会记入照料次数。';
  for(const k of (stage<3?Object.keys(goals):['water','nutrient',stage===3?'harvest':'pocket'])){
    const b=document.createElement('button'),done=stage<3&&care[k]>=goals[k];b.type='button';b.className='light careAction';b.dataset.care=k;
    b.textContent=(careVerbs[k]||nurseryStages[stage][1])+(done?' ✓':'');b.disabled=blocked||done;
    b.onclick=async()=>{
      if(k==='pocket'){openSeedPocket();return}
      const usable=[...buttons.children].filter(el=>!el.disabled);usable.forEach(el=>el.disabled=true);
      try{
        await careForPlant(plant,k,owner);
        if(owner!==studioOwner())return;
        route();const updated=readGarden().find(p=>p.uid===plant.uid);
        if(!compact&&panel.isConnected&&modal.open&&updated)detail(localPlantTraits(updated));
        const message=k==='harvest'?'种子已收入种子袋。':(updated?.growth??2)>stage?plant.name+'进入「'+nurseryStages[stage+1][0]+'」阶段。':plant.name+'已完成'+careVerbs[k]+'。';
        toast(message);
      }catch(e){if(panel.isConnected){status.textContent=e.message;usable.forEach(el=>el.disabled=false)}}
    };buttons.append(b);
  }
}
function renderGardenCare(){
  const sheet=$('gardenCare'),select=$('carePick'),list=visitingGarden?[]:readGarden();
  sheet.hidden=!studioOwner()||!list.length||!!visitingGarden;if(sheet.hidden||!sheet.open)return;
  const selected=select.value;
  select.replaceChildren(...list.map(p=>new Option(p.name+' · '+placementName(p),p.uid)));
  select.value=list.some(p=>p.uid===selected)?selected:(list.find(p=>p.zone===zone)||list[0]).uid;
  const plant=list.find(p=>p.uid===select.value);if(plant)renderPlantCare(localPlantTraits(plant),$('gardenCareBody'),true);
}
function openSeedPocket(){
  const owner=studioOwner();if(!owner||visitingGarden)return;
  const packets=readDesign().seeds||[];
  show('<div class="body"><div class="eyebrow">SEED LIBRARY</div><h2>我的种子袋</h2><p>每个品种收种一次，就能反复播种。分享给花友后，你也保留这个品种。</p><div id="seedRows"></div><p id="seedStatus" role="status"></p></div>');
  const rows=$('seedRows');
  const living=readGarden();
  if(living.length){
    const label=document.createElement('label'),select=document.createElement('select'),care=document.createElement('button');
    label.textContent='选择要照料的植株';select.setAttribute('aria-label','选择要照料的植株');
    for(const p of living)select.add(new Option(p.name+' · '+nurseryStages[p.growth??2][0],p.uid));
    label.append(select);care.textContent='查看生长手记';care.className='light';
    care.onclick=()=>{const p=readGarden().find(r=>r.uid===select.value);if(p)detail(localPlantTraits(p))};
    rows.before(label,care);
  }
  if(!packets.length){
    $('seedStatus').textContent=living.length?'种子袋还是空的。照料上方的植株，成熟后即可收种。':'先种下一株植物并保存，再点开它的「生长手记」，照料到种子成熟后收种。';return;
  }
  for(const packet of packets){
    const row=document.createElement('div');row.className='seedRow';
    const art=document.createElement('canvas'),info=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small');
    paintPot(art,packet);art.setAttribute('aria-hidden','true');title.textContent=packet.name;sub.textContent='来自第 '+packet.generation+' 代 · '+packet.latin;
    info.append(title,sub);
    const area=document.createElement('select');area.setAttribute('aria-label',packet.name+'的种植区域');
    for(const [key,place] of Object.entries(places))area.add(new Option(place.name,key));area.value=packet.zone;
    const sow=document.createElement('button');sow.className='smallBtn';sow.textContent='播种';
    sow.onclick=()=>{
      try{
        if(owner!==studioOwner()||visitingGarden)throw Error('花园已切换，请重新打开种子袋。');
        const child={...packet,uid:crypto.randomUUID(),growth:0,generation:Math.min(1000000,packet.generation+1),zone:area.value,
          date:new Date().toLocaleDateString('zh-CN'),photo:art.toDataURL('image/jpeg',.82)};
        changeStudioDraft((records,design)=>{
          Object.assign(child,GardenLayout.place(child,records.concat(design.decorations)));records.unshift(child);
        });
        modal.close();zone=child.zone;location.hash='garden';startStudioLayout(child.uid);route();toast('幼苗已摆好，点「保存布置」完成播种。');
      }catch(e){$('seedStatus').textContent=e.message}
    };
    row.append(art,info,area,sow);rows.append(row);
  }
  if(gardenAccount.user){
    const share=document.createElement('button');share.className='light';share.textContent='去花友列表赠送种子';share.onclick=()=>friendsPanel();rows.after(share);
  }
}
document.getElementById('seedPocket').onclick=openSeedPocket;
