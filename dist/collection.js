const gardenKey='cau.flora.records.v1';
const sizes={small:'小型',medium:'中型',large:'大型'};
const habits={tree:'乔木',shrub:'灌木',flower:'草花',grass:'禾草',rosette:'莲座',herb:'草本'};
const places={
  sill:{name:'向阳窗台',room:true},bench:{name:'园艺工作台',room:true},shelf:{name:'木质花架',room:true},
  pond:{name:'池畔花境',room:false},path:{name:'林荫步道',room:false},meadow:{name:'开放草甸',room:false}
};
const samples=[...plants,...sillExamples];
function nextSlot(list,zone,except){
  const occupied=new Set(list.filter(r=>r.zone===zone&&r.uid!==except).map(r=>r.slot));
  let slot=0;while(occupied.has(slot))slot++;return slot;
}
// Legacy records had no identities or explicit size. Preserve their previous room once,
// so a later model refinement can never move an existing planting.
function localGarden(){
  const raw=localDocument().records;
  const list=[];
  for(const [index,old] of raw.entries()){
    const r={...plants[old.id],...old};
    if(!r.name||!r.latin||!r.photo?.startsWith('data:image/'))continue;
    const legacy=plantProfile({...r,model:cachedModel(r.latin)});
    r.uid ||= 'legacy-'+index+'-'+r.latin;
    if(!Object.hasOwn(places,r.zone)){
      const outside=r.bed?r.bed==='outside':['tree','shrub'].includes(legacy.form);
      r.zone=outside?'path':'sill';
    }
    if(!Object.hasOwn(sizes,r.size))r.size='medium';
    r.form=legacy.form;
    if(!Number.isFinite(r.x)&&(!Number.isInteger(r.slot)||r.slot<0||list.some(p=>p.zone===r.zone&&p.slot===r.slot)))r.slot=nextSlot(list,r.zone);
    list.push(GardenLayout.located(r));
  }
  return list;
}
function localDocument(){return GardenLayout.unpack(JSON.parse(localStorage.getItem(gardenKey)||'[]'))}
function readDesign(){return visitingGarden?.design|| (gardenAccount.user?gardenAccount.design:localDocument().design)}
function readGarden(){
  if(gardenAccount.user)return structuredClone(gardenAccount.records);
  return gardenAccount.mode==='guest'?localGarden():[];
}
async function writeGarden(update){
  const owner=gardenAccount.user?.id||null;
  const write=async()=>{
    if(owner!==(gardenAccount.user?.id||null))throw Error('账号已切换，请重新操作。');
    if(gardenAccount.mode==='member')return saveMemberGarden(update);
    if(gardenAccount.mode!=='guest')throw Error('请等账号连接完成，或在账号面板中重试。');
    const list=localGarden(),design=localDocument().design;update(list,design);
    if(!GardenLayout.valid(list,design))throw Error('物品重叠或位置无效。');
    localStorage.setItem(gardenKey,JSON.stringify({records:list,design}));
  };
  if(navigator.locks)await navigator.locks.request(gardenKey,write);else write();
}
function placementName(r){return places[r.zone].name}
