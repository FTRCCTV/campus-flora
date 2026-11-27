// Keep edits in memory. Only an explicit save crosses the account/storage boundary.
let studioDraft=null;
function studioOwner(){return gardenAccount.mode==='member'?gardenAccount.user.id:gardenAccount.mode==='guest'?'local':null}
function activeStudioDraft(){return !visitingGarden&&studioDraft?.owner===studioOwner()?studioDraft:null}
function beginStudioDraft(){
  const owner=studioOwner();
  if(!owner||visitingGarden)throw Error('请先进入自己的花园。');
  if(activeStudioDraft())return studioDraft;
  const records=readGarden().map(GardenLayout.located),design=structuredClone(readDesign());
  studioDraft={owner,baseRecords:records,baseDesign:design,records,design,dirty:false};
  return studioDraft;
}
function changeStudioDraft(update){
  if(studio.busy)throw Error('正在保存布置，请稍候。');
  const d=beginStudioDraft();
  // Edits replace scalar fields or whole model/palette values, never mutate nested photos or models.
  const records=d.records.map(p=>({...p})),design={...d.design,decorations:d.design.decorations.map(p=>({...p}))};
  update(records,design);
  if(!GardenLayout.valid(records,design))throw Error('布置与其他物品相交，请调整位置或比例。');
  Object.assign(d,{records,design,dirty:true});
  return d;
}
function mergeStudioDraft(d,records,design){
  const equal=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);
  const conflict=()=>{throw Error('其他设备修改了同一物品。草稿已保留，可取消布置后载入最新位置。')};
  function fields(before,after,current,keys){
    for(const key of keys){
      if(equal(before[key],after[key])||equal(current[key],after[key]))continue;
      if(!equal(current[key],before[key]))conflict();
      if(key in after)current[key]=after[key];else delete current[key];
    }
  }
  function mergeList(base,next,live){
    const baseById=new Map(base.map(p=>[p.uid,p])),nextById=new Map(next.map(p=>[p.uid,p]));
    const current=new Map(live.map(p=>[p.uid,p])),added=[];
    for(const p of base){
      if(nextById.has(p.uid)||!current.has(p.uid))continue;
      if(!equal(current.get(p.uid),p))conflict();
      live.splice(live.indexOf(current.get(p.uid)),1);
    }
    for(const p of next){
      const before=baseById.get(p.uid),existing=current.get(p.uid);
      if(!before){if(!existing)added.push({...p});else if(!equal(existing,p))conflict();continue}
      if(equal(p,before))continue;
      if(!existing)conflict();
      fields(before,p,existing,new Set([...Object.keys(before),...Object.keys(p)]));
    }
    live.unshift(...added);
  }
  mergeList(d.baseRecords,d.records,records);
  mergeList(d.baseDesign.decorations,d.design.decorations,design.decorations);
  fields(d.baseDesign,d.design,design,['scene','weather','effect']);
}
async function commitStudioDraft(){
  if(studio.busy||visitingGarden)return;
  const d=activeStudioDraft();
  if(!d?.dirty){studioDraft=null;setStudioMode('view');return}
  studio.busy=true;renderStudio();
  try{
    await writeGarden((records,design)=>{
      if(activeStudioDraft()!==d)throw Error('当前账号已切换。');
      mergeStudioDraft(d,records,design);
      for(const p of records){const traits=localPlantTraits(p);if(traits.model){p.model=traits.model;p.form=traits.form}if(traits.palette)p.palette=traits.palette}
    });
    if(studioDraft===d){
      studioDraft=null;studio.mode='view';studio.selected=null;
      const before=d.baseDesign.discovered?.length||0,after=readDesign().discovered?.length||0;
      const fresh=(readDesign().discovered||[]).filter(key=>!(d.baseDesign.discovered||[]).includes(key));
      void classifyDiscoveries(fresh);
      const earned=GardenLayout.rewards.filter(r=>r.at>before&&r.at<=after);
      toast(earned.length?'收集达到 '+after+' 种，已解锁「'+earned.map(r=>r.label).join('」「')+'」！':after>before?'新物种已记入手记，累计 '+after+' 种。':d.owner==='local'?'布置已保存在本机。':'布置已同步到账号。');
    }
  }catch(e){toast(e.message);$('layoutStatus').textContent=e.message}
  finally{studio.busy=false;route()}
}
function discardStudioDraft(){
  if(studio.busy)return;
  if(activeStudioDraft()?.dirty&&!confirm('放弃本次尚未保存的布置？'))return;
  studioDraft=null;setStudioMode('view');route();
}
window.addEventListener('beforeunload',e=>{if(activeStudioDraft()?.dirty){e.preventDefault();e.returnValue=''}});
