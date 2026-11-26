// Each care action advances one stage. Time away never changes a record.
const nurseryStages=[
  ['幼苗','轻轻浇水','让幼苗展开第一批新叶。'],
  ['展叶','转盆向光','让植株展开枝叶，长成自己的株形。'],
  ['成株','观察种穗','完成这株植物的游戏养成，留下可采集的种子。'],
  ['种子成熟','收进种子袋','保存这个品种，以后可以反复播种，也能分享给花友。'],
  ['已留种','打开种子袋','种子已收好，母株会继续留在花园里。']
];
function renderPlantCare(plant){
  const panel=$('carePanel'),stage=plant.growth??2,[label,action,hint]=nurseryStages[stage];
  const owner=studioOwner(),blocked=!!activeStudioDraft();
  panel.className='nurseryPanel';
  panel.innerHTML='<div class="nurseryHeading"><h3>生长手记</h3><span id="careGeneration"></span></div><canvas class="carePortrait" aria-label="当前生长阶段的植物模型"></canvas><div class="growthTrack"></div><p class="careHint"></p><button class="primary careAction"></button><p role="status" class="careStatus"></p>';
  panel.querySelector('#careGeneration').textContent='第 '+(plant.generation??1)+' 代'+(plant.seedFrom?' · 来自 '+plant.seedFrom:'');
  paintPot(panel.querySelector('canvas'),plant);
  const track=panel.querySelector('.growthTrack');
  nurseryStages.forEach(([name],index)=>{
    const tag=document.createElement('span');tag.textContent=name;
    if(index===stage)tag.setAttribute('aria-current','step');
    if(index<=stage)tag.className='reached';track.append(tag);
  });
  panel.querySelector('.careHint').textContent=blocked?'完成或取消当前布置后，即可照料植株。':hint;
  const btn=panel.querySelector('button'),status=panel.querySelector('.careStatus');
  btn.textContent=action;btn.disabled=blocked||!owner;
  btn.onclick=async()=>{
    if(stage===4){openSeedPocket();return}
    btn.disabled=true;
    try{
      await writeGarden(records=>{
        if(owner!==studioOwner()||activeStudioDraft())throw Error('花园已切换，请重新打开植株。');
        const current=records.find(p=>p.uid===plant.uid);
        if(!current||(current.growth??2)!==stage)throw Error('植物状态有更新，请重新打开。');
        current.growth=stage+1;
      });
      if(!panel.isConnected||!modal.open||owner!==studioOwner())return;
      route();const updated=readGarden().find(p=>p.uid===plant.uid);
      if(updated)detail(localPlantTraits(updated));
      toast(stage===3?'已收入种子袋，可以自己播种或赠予花友。':plant.name+'进入「'+nurseryStages[stage+1][0]+'」阶段。');
    }catch(e){if(panel.isConnected){status.textContent=e.message;btn.disabled=false}}
  };
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
