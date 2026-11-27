const $=id=>document.getElementById(id),modal=$('modal'),body=$('content'),key=gardenKey;
const symbols={camera:'<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1"/><path d="m4 17 5-5 4 3 3-4 5 6"/>',leaf:'<path d="M19 4C8 3 3 8 6 15c4 7 15 1 13-11Z M4 21 15 9"/>'};
const icon=k=>'<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+symbols[k]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

let apiKey='', requestController, collection=[], illustrated=false;
const hosted='https://cau-campus-flora-notebook.bubblybox131.chatgpt.site/';
const inFlight=new Map(),modelCache=new Map(),modelErrors=new Map();
const profileKey=latin=>'cau.flora.profile.ds.v3.'+latin.trim().toLowerCase();
function cachedModel(latin){
  const k=profileKey(latin);
  if(modelCache.has(k))return modelCache.get(k);
  const saved=gardenAccount.records.find(r=>r.model?.profileVersion===3&&profileKey(r.latin)===k);
  if(saved)return saved.model;
  try{return JSON.parse(localStorage.getItem(k))}catch{return null}
}
// Curated campus species carry hand-checked traits and need no generated model.
const curatedSpecies=latin=>FloraCatalog.lookup(latin)?.level==='species';
function traitChips(plant){
  const profile=plantProfile({...plant,model:cachedModel(plant.latin)||plant.model});
  return '<span class="traitSource">'+esc(FloraCatalog.sources[profile.source])+'</span>'+FloraCatalog.labels(profile).map(t=>'<span>'+esc(t)+'</span>').join('');
}
async function refinePlant(r){
  const k=profileKey(r.latin);
  if(cachedModel(r.latin)||curatedSpecies(r.latin))return true;
  if(location.protocol==='file:')return false;
  if(inFlight.has(k))return inFlight.get(k);
  const job=(async()=>{
    try{
      const response=await fetch('/api/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latin:r.latin}),signal:AbortSignal.timeout(90000)});
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        const messages={billing:'DeepSeek 账户余额不足。',credentials:'DeepSeek 密钥验证失败。',rate_limit:'DeepSeek 请求频繁，请稍后再试。'};
        modelErrors.set(k,(messages[data.reason]||'DeepSeek 服务暂不可用。')+'当前显示基础株形。');
        return false;
      }
      const {model}=await response.json();if(!model||!Object.hasOwn(plantProfiles,model.form))return false;
      modelErrors.delete(k);modelCache.set(k,model);try{localStorage.setItem(k,JSON.stringify(model))}catch{}
      return true;
    }catch{modelErrors.set(k,'精细模型暂未完成，可在手记中重试。');return false}
  })();
  inFlight.set(k,job);if(location.hash==='#garden')renderStudio();try{return await job}finally{inFlight.delete(k);route()}
}
let zone='sill', outdoorZone='path', indoorZone='sill';
function esc(value){const el=document.createElement('span');el.textContent=String(value??'');return el.innerHTML}
function show(html){body.innerHTML=html;if(!modal.open)modal.showModal();modal.scrollTop=0}
$('close').onclick=()=>modal.close();
modal.addEventListener('close',()=>{if(!modal.open)requestController?.abort()});
function portrait(canvas,r){paintSpecimen(canvas,r,{potted:true,portrait:true,width:480,height:420})}
function toast(text){$('toast').textContent=text;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('toast').textContent='',2600)}
function thumbButton(r,action,subtitle){
  const b=document.createElement('button');b.className='starter';
  const image=document.createElement(r.photo?'img':'canvas');
  if(r.photo){image.loading='lazy';image.src=r.photo;image.alt=''}else portrait(image,r);
  const label=document.createElement('div');label.innerHTML='<strong>'+esc(r.name)+'</strong><i>'+esc(r.latin)+'</i><small>'+esc(subtitle||r.family)+'</small>';
  b.append(image,label);b.onclick=action;return b;
}
function library(context={}){
  const replace=!!context.replaceUid;
  show('<div class="body"><div class="eyebrow">PLANT LIBRARY</div><h2>'+(replace?'选择替换植物':'挑选一株植物')+'</h2><div class="pickList" id="choices"></div><button class="light" id="usePhoto">拍照或选择照片</button></div>');
  samples.forEach(p=>$('choices').append(thumbButton(p,()=>sample(p,context))));
  $('usePhoto').onclick=()=>guide(context);
}
function sample(p,context={}){
  const canvas=document.createElement('canvas');portrait(canvas,p);
  plantEditor([p],canvas.toDataURL('image/png'),true,context);
}
function selectZone(id){
  zone=id;if(places[id].room)indoorZone=id;else outdoorZone=id;
  renderStudio();
}
for(const [id,place] of Object.entries(places)){
  const b=document.createElement('button');b.dataset.zone=id;b.textContent=place.name;b.onclick=()=>selectZone(id);$('zones').append(b);
}
function route(){
  const garden=location.hash==='#garden',dueling=location.hash==='#duel';
  $('duel').hidden=!dueling;$('nd').classList.toggle('active',dueling);
  $('explore').hidden=garden||dueling;$('garden').hidden=!garden;
  $('ne').classList.toggle('active',!garden&&!dueling);$('ng').classList.toggle('active',garden);
  if(!garden||visitingGarden?.owner!==gardenAccount.user?.id)visitingGarden=null;
  const visiting=!!visitingGarden;
  $('gardenTitle').textContent=visiting?visitingGarden.name+'的植物园':'我的植物园';
  $('notesTitle').textContent=visiting?'花园里的植物':'观察手记';
  $('backGarden').hidden=!visiting;$('add').hidden=visiting;$('trial').hidden=visiting;$('friends').hidden=visiting;
  try{collection=visiting?visitingGarden.plants:readGarden().map(localPlantTraits)}catch{collection=[];toast('浏览器暂时无法读取观察记录。')}
  illustrated=!visiting&&!collection.length&&!readDesign().decorations.length;if(!visiting)$('qty').textContent=collection.length;
  document.body.dataset.atmosphere=readDesign().effect||'none';
  $('seedPocket').hidden=visiting;
  if(dueling){openDuel();return}leaveDuel();
  if(!garden){home();return}renderStudio();schedulePaletteUpgrade();
  $('records').replaceChildren(...collection.map(r=>thumbButton(r,()=>visiting?sharedDetail(r):detail(r),placementName(r)+' · '+sizes[r.size])));
  if(visiting&&!collection.length)$('records').textContent='这位花友还没有种下植物。';
  if(illustrated)$('records').innerHTML='<div class="empty"><h2>这里会留下你的观察记录</h2><p>拍下植物，或从图鉴中挑一株试种。</p></div>';
}
window.addEventListener('storage',e=>{if(e.key===gardenKey||e.key===null)route()});
function detail(r){
  show('<img class="detailArt" alt="观察记录"><div class="body"><div class="eyebrow">'+(r.seedFrom?'花友种子':r.gift?'花友分株':r.generation>1?'自留种子':r.demo?'图鉴示例':'校园观察')+'</div><h2>'+esc(r.name)+'</h2><i>'+esc(r.latin)+'</i><p>'+esc(r.family||'')+'</p><h3>植物小科普</h3><p id="detailFact">'+esc(plantFact(r))+'</p><div class="traitChips" id="detailTraits">'+traitChips(r)+'</div><div class="recinfo">'+esc(r.date)+' · '+esc(r.location||'未填写发现地点')+'</div><p>'+esc(placementName(r))+' · '+sizes[r.size]+' · '+habits[r.form]+'</p><div id="carePanel"></div><div class="management"><button id="move">调整体型与位置</button><button id="replace">替换植物</button><button class="danger" id="remove">移除</button></div><p class="modelnote" id="modelStatus"></p></div>');
  body.querySelector('img').src=r.photo;renderPlantCare(r);showDuelTrait(r);
  $('move').onclick=()=>plantEditor([r],r.photo,r.demo,{editUid:r.uid,previous:r});
  $('replace').onclick=()=>library({replaceUid:r.uid,previous:r,zone:r.zone});
  $('remove').onclick=()=>{
    show('<div class="body"><h2>移除'+esc(r.name)+'？</h2><p>将删除这条观察记录和照片，并腾出'+esc(placementName(r))+'。</p><div class="management"><button id="cancel">保留植物</button><button class="danger" id="confirmRemove">确认移除</button></div><p role="status" id="feedback"></p></div>');
    $('cancel').onclick=()=>detail(r);$('confirmRemove').onclick=async()=>{
      try{changeStudioDraft(list=>{const i=list.findIndex(x=>x.uid===r.uid);if(i<0)throw Error('这条记录已移除。');list.splice(i,1)});modal.close();location.hash='garden';setStudioMode('edit');route();toast('已从本地布置移除，保存后生效。')}catch(e){$('feedback').textContent=e.message}
    };
  };
  const status=$('modelStatus'),k=profileKey(r.latin);status.textContent=curatedSpecies(r.latin)?'已应用校园图鉴株形':cachedModel(r.latin)?'已应用物种模型':modelErrors.get(k)||'当前显示基础模型';
  if(!cachedModel(r.latin)&&!curatedSpecies(r.latin)&&location.protocol!=='file:'){
    const b=document.createElement('button');b.className='light';b.textContent='细化物种特征';status.after(b);
    b.onclick=async()=>{b.disabled=true;status.classList.add('modelPending');status.textContent='正在细化叶序和花序…';const ok=await refinePlant(r);status.classList.remove('modelPending');if(ok&&status.isConnected){$('detailFact').textContent=plantFact(r);$('detailTraits').innerHTML=traitChips(r)}status.textContent=ok?'已应用物种模型':modelErrors.get(k)||'暂时无法生成，请稍后重试。';b.hidden=!!ok;b.disabled=false};
  }
}
function fillSelect(id,values,selected,placeholder){
  const el=$(id);if(placeholder)el.add(new Option(placeholder,''));
  for(const [value,label] of Object.entries(values))el.add(new Option(label,value));
  el.value=selected||'';
}
// Upgrade original observations with their own photo colours, once per photo.
// Sample idle observations locally; attach pending traits only on explicit save.
const observedColors=new Map();
function localPlantTraits(p){
  const sampled=observedColors.get(p.uid),model=cachedModel(p.latin)||p.model;
  return {...p,model,form:plantProfile({...p,model}).form,palette:p.palette||(sampled?.photo===p.photo?sampled?.palette:undefined)};
}
let paletteUpgradeRunning=false,paletteUpgradeTimer=0;
function schedulePaletteUpgrade(){
  if(visitingGarden||location.hash!=='#garden'||paletteUpgradeRunning||paletteUpgradeTimer||
     !collection.some(p=>!p.demo&&!p.gift&&!p.palette&&p.photo))return;
  paletteUpgradeTimer=setTimeout(async()=>{
    paletteUpgradeTimer=0;
    if(visitingGarden||location.hash!=='#garden'||document.hidden)return;
    if(studio.drag||studio.mode!=='view'||activeStudioDraft()||saveBusy||modal.open)return;
    const owner=gardenAccount.user?.id||null;
    const sameOwner=()=>!visitingGarden&&(gardenAccount.user?.id||null)===owner;
    const samples=collection.filter(p=>!p.demo&&!p.gift&&!p.palette&&p.photo);
    if(!samples.length)return;
    paletteUpgradeRunning=true;
    try{
      const colors=new Map();
      for(const p of samples){
        if(!sameOwner()||studio.drag||document.hidden||location.hash!=='#garden')break;
        const palette=await paletteFromPhoto(p.photo,p.form).catch(()=>({}));
        colors.set(p.uid,{photo:p.photo,palette});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(colors.size&&sameOwner()){
        for(const [uid,color] of colors)observedColors.set(uid,color);
        route();
      }
    }catch{/* A later garden visit can retry interrupted backfills. */}
    finally{paletteUpgradeRunning=false}
  },800);
}
function plantFact(plant){
  const model=cachedModel(plant.latin)||plant.model;
  const entry=samples.find(s=>s.latin===plant.latin||s.latin.startsWith(plant.latin+' ')),curated=FloraCatalog.lookup(plant.latin);
  if(curated?.level==='species')return curated.fact;
  if(model?.fact)return model.fact;
  if(entry?.note)return entry.note;
  return (plant.family?'这个候选物种属于 '+plant.family+'。':'候选学名为 '+plant.latin+'。')+'可以对照照片观察叶片在茎上是成对生长，还是左右交错。';
}
function plantEditor(options,photo,demo,context={}){
  const prev=context.previous,editing=!!context.editUid,replacing=!!context.replaceUid;
  show('<div class="body"><div class="eyebrow">PLANTING DESK</div><h2>'+(editing?'调整植株':replacing?'确认替换':'种植工作台')+'</h2><div class="pot-choice"><canvas id="previewPlant"></canvas><div><label>植物名称<select id="species"></select></label><i id="taxonomy"></i></div></div><section class="plantFact"><strong>植物小科普</strong><p id="speciesFact"></p><div class="traitChips" id="speciesTraits"></div><p id="profileProgress" role="status" hidden></p></section><label>展示大小<select id="size"></select></label><label>种植区域<select id="bed"></select></label><label>发现地点（选填）<input id="place" maxlength="60"></label><p id="discoveryHint" class="discoveryHint" role="status"></p><p id="actionNote"></p><button class="primary" id="save">确定</button><p id="feedback" class="error" role="status"></p></div>');
  options.forEach((r,i)=>$('species').add(new Option(r.name+(Number.isFinite(r.score)?' · '+(100*r.score).toFixed(1)+'%':''),i)));
  fillSelect('size',sizes,prev?.size,'请选择体型');
  fillSelect('bed',Object.fromEntries(Object.entries(places).map(([k,v])=>[k,v.name])),context.zone||prev?.zone||zone,'请选择区域');
  $('place').value=editing?prev.location||'':'';
  if(!demo){const img=document.createElement('img');img.src=photo;img.alt=editing&&prev.gift?'分株模型肖像':'本次观察的原始照片';img.className='observation-photo';body.querySelector('.pot-choice').before(img)}
  const originalUid=context.editUid||context.replaceUid;
  let palette=editing?prev.palette:undefined;
  const swatches=new Map();
  function colorsFor(form){
    if(demo||editing&&(prev.palette||prev.gift))return Promise.resolve(editing?prev.palette:undefined);
    if(!swatches.has(form))swatches.set(form,paletteFromPhoto(photo,form).catch(()=>({})));
    return swatches.get(form);
  }
  function updatePreview(){
    const p=options[Number($('species').value)];$('taxonomy').textContent=p.latin;$('speciesTraits').innerHTML=traitChips(p);
    const c=$('previewPlant');
    if($('size').value){paintPot(c,{...p,palette,model:cachedModel(p.latin)||p.model,size:$('size').value})}
    else{c.width=180;c.height=200;const g=c.getContext('2d');g.fillStyle='#52674e';g.font='16px sans-serif';g.textAlign='center';g.fillText('选好体型后预览',90,105)}
  }
  const speciesPicker=$('species');
  let previewTimer;
  function selectSpecies(){
    clearTimeout(previewTimer);updatePreview();
    const selected=options[Number(speciesPicker.value)];
    colorsFor(plantProfile({...selected,model:cachedModel(selected.latin)||selected.model}).form).then(colors=>{
      if(speciesPicker.isConnected&&selected===options[Number(speciesPicker.value)]){palette=colors;updatePreview()}
    });
    const progress=$('profileProgress'),fact=$('speciesFact');
    fact.textContent=plantFact(selected);
    const history=GardenLayout.discoveries(readGarden().filter(r=>r.uid!==originalUid),readDesign().discovered);
    const key=FloraCatalog.speciesKey(selected.latin),hint=$('discoveryHint');
    hint.hidden=editing||!key;
    const total=history.length+1,reward=GardenLayout.rewards.find(r=>r.at===total);
    hint.textContent=history.includes(key)?'手记已收录这个物种。':'新物种 · 保存后累计 '+total+' 种'+(reward?'，解锁「'+reward.label+'」':'')+'。';
    progress.hidden=true;progress.classList.remove('modelPending');
    if(demo||fileDemo||cachedModel(selected.latin)||curatedSpecies(selected.latin))return;
    progress.hidden=false;progress.classList.add('modelPending');progress.textContent='正在细化叶形、叶序和花序…';
    previewTimer=setTimeout(async()=>{
      if(!speciesPicker.isConnected||!modal.open)return;
      const ready=await refinePlant(selected);
      if(speciesPicker.isConnected&&modal.open&&selected===options[Number(speciesPicker.value)]){
        progress.classList.remove('modelPending');progress.hidden=false;
        progress.textContent=ready?'物种模型已就绪':modelErrors.get(profileKey(selected.latin))||'暂用基础株形，可在手记中重试。';
        fact.textContent=plantFact(selected);
    const history=GardenLayout.discoveries(readGarden().filter(r=>r.uid!==originalUid),readDesign().discovered);
    const key=FloraCatalog.speciesKey(selected.latin),hint=$('discoveryHint');
    hint.hidden=editing||!key;
    const total=history.length+1,reward=GardenLayout.rewards.find(r=>r.at===total);
    hint.textContent=history.includes(key)?'手记已收录这个物种。':'新物种 · 保存后累计 '+total+' 种'+(reward?'，解锁「'+reward.label+'」':'')+'。';updatePreview();
      }
    },450);
  }
  selectSpecies();
  speciesPicker.onchange=selectSpecies;$('size').onchange=updatePreview;
  $('actionNote').textContent=replacing?'保存后，新植株会替换「'+prev.name+'」及其观察记录。':'';
  $('save').textContent=editing?'应用到布置':replacing?'确认替换原植物':'种下并布置';
  $('save').onclick=async()=>{
    const p=options[Number($('species').value)],form=plantProfile({...p,model:cachedModel(p.latin)||p.model}).form,size=$('size').value,selected=$('bed').value;
    if(!size||!selected){$('feedback').textContent='请选择展示大小和区域。';return}
    const plantedId=editing?originalUid:crypto.randomUUID(),locationText=$('place').value.trim(),button=$('save');button.disabled=true;
    try{
      const photoPalette=await colorsFor(form);
      changeStudioDraft((list,design)=>{
        const index=originalUid?list.findIndex(x=>x.uid===originalUid):-1;
        if(originalUid&&index<0)throw Error('原记录已变更，请重新选择。');
        const data={form,size,zone:selected,location:locationText};
        if(photoPalette)data.palette=photoPalette;
        const previous=index>=0?GardenLayout.located(list[index]):null;
        const specimen={...(editing?previous:{}),...p,...data,model:cachedModel(p.latin)||p.model};
        Object.assign(data,GardenLayout.place(specimen,list.filter(r=>r.uid!==originalUid).concat(design.decorations),previous?.zone===selected?previous:null));
        if(editing){Object.assign(list[index],data);return}
        const record={...data,growth:0,generation:1,uid:plantedId,name:p.name,latin:p.latin,family:p.family,note:p.note,photo,demo,date:new Date().toLocaleDateString('zh-CN'),model:cachedModel(p.latin)};
        if(replacing)list.splice(index,1,record);else list.unshift(record);
      });
      zone=selected;if(places[zone].room)indoorZone=zone;else outdoorZone=zone;
      modal.close();location.hash='garden';startStudioLayout(plantedId);route();toast('已加入本地布置，完成后点「保存布置」。');
      if(!demo)void refinePlant(p);
    }catch(e){$('feedback').textContent=e.name==='QuotaExceededError'?'浏览器存储已满，本次修改未保存。':e.message;button.disabled=false}
  };
}
function choosePhoto(input,context={}){input.plantContext=context;input.click()}
function guide(context={}){
  show('<div class="body"><div class="eyebrow">PL@NTNET</div><h2>拍下身边的植物</h2><p>让叶、花或果实清晰入镜。确认后，照片将发送至 Pl@ntNet 识别。</p><div class="actions"><button class="primary" style="width:auto" id="take">打开相机</button><button class="light" id="choose">选择照片</button></div></div>');
  $('take').onclick=()=>choosePhoto($('cam'),context);$('choose').onclick=()=>choosePhoto($('file'),context);
}
$('shoot').onclick=$('add').onclick=()=>guide();$('album').onclick=()=>choosePhoto($('file'));$('trial').onclick=()=>library();
function prepare(file){
  const url=URL.createObjectURL(file);
  return (async()=>{try{
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw Error();
    const thumb=document.createElement('canvas'),factor=Math.min(1,640/Math.max(canvas.width,canvas.height));thumb.width=Math.max(1,Math.round(canvas.width*factor));thumb.height=Math.max(1,Math.round(canvas.height*factor));thumb.getContext('2d').drawImage(canvas,0,0,thumb.width,thumb.height);
    return {blob,photo:thumb.toDataURL('image/jpeg',.73)};
  }finally{URL.revokeObjectURL(url)}})();
}
function preview(photo,title,inside){show('<img alt="待识别的植物" class="detailArt"><div class="body"><div class="eyebrow">PL@NTNET</div><h2>'+title+'</h2>'+inside+'</div>');body.querySelector('img').src=photo}
async function identifyPhoto(item,context={}){
  requestController?.abort();const controller=new AbortController();requestController=controller;
  preview(item.photo,'正在辨认植物','<p role="status">正在查询 Pl@ntNet 物种库…</p>');
  try{
    const headers={'Content-Type':'image/jpeg'};if(apiKey)headers['x-plantnet-key']=apiKey;
    const response=await fetch('/api/identify',{method:'POST',headers,body:item.blob,signal:controller.signal});
    const data=await response.json();if(controller.signal.aborted)return;
    if(data.code==='key'){
      preview(item.photo,'连接识别服务','<p>'+esc(data.error)+' 密钥只在当前页面内存中使用。</p><label>Pl@ntNet API Key<input type="password" id="token" autocomplete="off"></label><button class="primary" id="connect">连接并识别</button><p><a href="https://my.plantnet.org/" target="_blank" rel="noopener">获取自己的 Pl@ntNet 密钥</a></p>');
      $('connect').onclick=()=>{apiKey=$('token').value.trim();if(apiKey)identifyPhoto(item,context);else $('token').focus()};return;
    }
    if(!response.ok)throw Error(data.error||'识别服务暂时不可用。');
    if(!data.results.length){preview(item.photo,'未找到匹配植物','<p>请靠近一朵花或一片完整的叶子重新拍摄。</p><button class="light" id="again">换张照片</button>');$('again').onclick=()=>guide(context);return}
    const options=data.results.map(r=>{const known=samples.find(p=>p.latin.startsWith(r.latin+' ')||p.latin===r.latin);return {...r,name:known?.name||FloraCatalog.name(r.latin)||r.name,note:known?.note}});
    plantEditor(options,item.photo,false,context);
  }catch(e){if(controller.signal.aborted)return;preview(item.photo,'这次识别未完成','<p>'+esc(e.message)+'</p><button class="light" id="retry">重新识别</button>');$('retry').onclick=()=>identifyPhoto(item,context)}
}
for(const input of [$('cam'),$('file')])input.onchange=async()=>{
  const context=input.plantContext||{};input.plantContext=null;const file=input.files[0];input.value='';if(!file)return;
  try{const item=await prepare(file);
    if(location.protocol==='file:'){preview(item.photo,'在线识别植物','<p>离线版支持种植图鉴示例。拍照识别请打开在线版并选择照片。</p><a href="'+hosted+'">打开在线版</a>');return}
    preview(item.photo,'识别这株植物','<p>将这张照片经植迹在线服务发送至 Pl@ntNet，获取候选物种。</p><button class="primary" id="identify">开始识别</button>');$('identify').onclick=()=>identifyPhoto(item,context);
  }catch{show('<div class="body"><h2>照片读取失败</h2><p>请尝试 JPG、PNG 或 WebP 格式。</p></div>')}
};
$('gardenCare').ontoggle=renderGardenCare;$('carePick').onchange=renderGardenCare;
initStudio();window.addEventListener('hashchange',route);setAccountButton();route();if(!localGardenOnly)void refreshAccount();
