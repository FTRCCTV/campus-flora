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
function readGarden(){
  const raw=JSON.parse(localStorage.getItem(gardenKey)||'[]');
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
    if(!Object.hasOwn(habits,r.form))r.form=legacy.form;
    if(!Number.isInteger(r.slot)||r.slot<0||list.some(p=>p.zone===r.zone&&p.slot===r.slot))r.slot=nextSlot(list,r.zone);
    list.push(r);
  }
  return list;
}
async function writeGarden(update){
  const write=()=>{
    const list=readGarden();update(list);localStorage.setItem(gardenKey,JSON.stringify(list));
  };
  if(navigator.locks)await navigator.locks.request(gardenKey,write);else write();
}
function placementName(r){return places[r.zone].name+' · '+(r.slot+1)+' 号位'}
