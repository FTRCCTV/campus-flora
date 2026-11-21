const $=id=>document.getElementById(id),modal=$('modal'),body=$('content'),key=gardenKey;
const symbols={camera:'<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1"/><path d="m4 17 5-5 4 3 3-4 5 6"/>',leaf:'<path d="M19 4C8 3 3 8 6 15c4 7 15 1 13-11Z M4 21 15 9"/>'};
const icon=k=>'<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+symbols[k]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

let apiKey='', requestController, collection=[], illustrated=false;
const hosted='https://cau-campus-flora-notebook.bubblybox131.chatgpt.site/';
const inFlight=new Map(),modelCache=new Map(),modelErrors=new Map();
const profileKey=latin=>'cau.flora.profile.ds.v2.'+latin.trim().toLowerCase();
function cachedModel(latin){
  const k=profileKey(latin);
  const saved=gardenAccount.records.find(r=>r.model&&profileKey(r.latin)===k);
  if(saved)return saved.model;
  if(modelCache.has(k))return modelCache.get(k);
  try{return JSON.parse(localStorage.getItem(k))}catch{return null}
}
async function refinePlant(r){
  const k=profileKey(r.latin);
  const owner=gardenAccount.user?.id;
  if(cachedModel(r.latin))return true;
  if(location.protocol==='file:')return false;
  if(inFlight.has(k))return inFlight.get(k);
  const job=(async()=>{
    try{
      const response=await fetch('/api/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latin:r.latin}),signal:AbortSignal.timeout(24000)});
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        const messages={billing:'DeepSeek 账户余额不足。',credentials:'DeepSeek 密钥验证失败。',rate_limit:'DeepSeek 请求频繁，请稍后再试。'};
        modelErrors.set(k,(messages[data.reason]||'DeepSeek 服务暂不可用。')+'当前显示基础株形。');
        return false;
      }
      const {model}=await response.json();if(!model||!Object.hasOwn(plantProfiles,model.form))return false;
      modelErrors.delete(k);modelCache.set(k,model);try{localStorage.setItem(k,JSON.stringify(model))}catch{}
      if(owner&&gardenAccount.user?.id===owner&&gardenAccount.records.some(plant=>profileKey(plant.latin)===k)){
        try{await writeGarden(list=>{for(const plant of list)if(profileKey(plant.latin)===k){plant.model=model;plant.form=model.form}})}
        catch{toast('株形已缓存在本机，云端株形同步未完成。')}
      }
      return true;
    }catch{return false}
  })();
  inFlight.set(k,job);try{return await job}finally{inFlight.delete(k);route()}
}
let zone='sill', outdoorZone='path', indoorZone='sill',heroIndex=0;
function esc(value){const el=document.createElement('span');el.textContent=String(value??'');return el.innerHTML}
function show(html){body.innerHTML=html;if(!modal.open)modal.showModal();modal.scrollTop=0}
$('close').onclick=()=>modal.close();
modal.addEventListener('close',()=>{if(!modal.open)requestController?.abort()});
function portrait(canvas,r){paintSpecimen(canvas,r,{potted:true,portrait:true,width:480,height:420})}
function toast(text){$('toast').textContent=text;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('toast').textContent='',2600)}
function thumbButton(r,action,subtitle){
  const b=document.createElement('button');b.className='starter';
  const image=document.createElement(r.photo?'img':'canvas');
  if(r.photo){image.src=r.photo;image.alt=''}else portrait(image,r);
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
function home(){
  const list=collection.length?collection:[sillExamples[0],plants[0],sillExamples[2],plants[1],plants[2],sillExamples[1]];
  const hero=list[heroIndex%list.length];
  paintSpecimen($('heroCanvas'),hero,{potted:true,portrait:true,width:620,height:440});
  $('heroName').textContent=hero.name;$('heroLatin').textContent=hero.latin;
  $('heroNote').textContent=collection.length?placementName(hero)+' · '+sizes[hero.size]:hero.note;
  $('heroPlant').setAttribute('aria-label','查看'+hero.name);$('heroPlant').onclick=()=>collection.length?detail(hero):sample(hero);
  $('heroNext').hidden=list.length<2;
  $('homeTitle').textContent=collection.length?'最近的观察':'选一株开始试种';
  $('homeKicker').textContent=collection.length?'RECENT OBSERVATIONS':'PLANTING LIBRARY';
  const fieldMarks={'银杏':'扇形叶 · 叶端浅裂','鸡爪槭':'掌状叶 · 尖裂片','垂柳':'细枝下垂 · 狭长叶','雏菊':'白色舌状花 · 黄色花心','薄荷':'叶片对生 · 叶缘有齿','拟石莲花':'莲座排列 · 肥厚叶'};
  $('atlas').replaceChildren(...list.slice(0,6).map(r=>thumbButton(r,()=>collection.length?detail(r):sample(r),collection.length?placementName(r):fieldMarks[r.name])));
}
$('heroNext').onclick=()=>{heroIndex++;home()};
function selectZone(id){
  zone=id;if(places[id].room)indoorZone=id;else outdoorZone=id;
  renderStudio();
}
for(const [id,place] of Object.entries(places)){
  const b=document.createElement('button');b.dataset.zone=id;b.textContent=place.name;b.onclick=()=>selectZone(id);$('zones').append(b);
}
function route(){
  const garden=location.hash==='#garden';$('explore').hidden=garden;$('garden').hidden=!garden;
  $('ne').classList.toggle('active',!garden);$('ng').classList.toggle('active',garden);
  if(!garden||visitingGarden?.owner!==gardenAccount.user?.id)visitingGarden=null;
  const visiting=!!visitingGarden;
  $('gardenTitle').textContent=visiting?visitingGarden.name+'的植物园':'我的植物园';
  $('notesTitle').textContent=visiting?'花园里的植物':'观察手记';
  $('backGarden').hidden=!visiting;$('add').hidden=visiting;$('trial').hidden=visiting;$('friends').hidden=visiting;
  try{collection=visiting?visitingGarden.plants:readGarden().map(r=>{const model=cachedModel(r.latin)||r.model;return {...r,model,form:plantProfile({...r,model}).form}})}catch{collection=[];toast('浏览器暂时无法读取观察记录。')}
  illustrated=!visiting&&!collection.length&&!readDesign().decorations.length;if(!visiting)$('qty').textContent=collection.length;
  if(!garden){home();return}renderStudio();
  $('records').replaceChildren(...collection.map(r=>thumbButton(r,()=>visiting?sharedDetail(r):detail(r),placementName(r)+' · '+sizes[r.size])));
  if(visiting&&!collection.length)$('records').textContent='这位花友还没有种下植物。';
  if(illustrated)$('records').innerHTML='<div class="empty"><h2>这里会留下你的观察记录</h2><p>拍下植物，或从图鉴中挑一株试种。</p></div>';
}
window.addEventListener('storage',e=>{if(e.key===gardenKey||e.key===null)route()});
function detail(r){
  show('<img class="detailArt" alt="观察记录"><div class="body"><div class="eyebrow">'+(r.demo?'图鉴示例':'校园观察')+'</div><h2>'+esc(r.name)+'</h2><i>'+esc(r.latin)+'</i><p>'+esc(r.note||r.family||'')+'</p><div class="recinfo">'+esc(r.date)+' · '+esc(r.location||'未填写发现地点')+'</div><p>'+esc(placementName(r))+' · '+sizes[r.size]+' · '+habits[r.form]+'</p><div class="management"><button id="move">调整体型与位置</button><button id="replace">替换植物</button><button class="danger" id="remove">移除</button></div><p class="modelnote" id="modelStatus"></p></div>');
  body.querySelector('img').src=r.photo;
  $('move').onclick=()=>plantEditor([r],r.photo,r.demo,{editUid:r.uid,previous:r});
  $('replace').onclick=()=>library({replaceUid:r.uid,previous:r,zone:r.zone});
  $('remove').onclick=()=>{
    show('<div class="body"><h2>移除'+esc(r.name)+'？</h2><p>将删除这条观察记录和照片，并腾出'+esc(placementName(r))+'。</p><div class="management"><button id="cancel">保留植物</button><button class="danger" id="confirmRemove">确认移除</button></div><p role="status" id="feedback"></p></div>');
    $('cancel').onclick=()=>detail(r);$('confirmRemove').onclick=async()=>{
      try{await writeGarden(list=>{const i=list.findIndex(x=>x.uid===r.uid);if(i<0)throw Error('这条记录已移除。');list.splice(i,1)});modal.close();route();toast('植物已移除')}catch(e){$('feedback').textContent=e.message}
    };
  };
  const status=$('modelStatus'),k=profileKey(r.latin);status.textContent=cachedModel(r.latin)?'已应用物种模型':modelErrors.get(k)||'当前显示基础模型';
  if(!cachedModel(r.latin)&&location.protocol!=='file:'){
    const b=document.createElement('button');b.className='light';b.textContent='细化物种特征';status.after(b);
    b.onclick=async()=>{b.disabled=true;status.textContent='正在细化植物特征…';const ok=await refinePlant(r);status.textContent=ok?'已应用物种模型':modelErrors.get(k)||'暂时无法生成，请稍后重试。';b.hidden=!!ok;b.disabled=false};
  }
}
function fillSelect(id,values,selected,placeholder){
  const el=$(id);if(placeholder)el.add(new Option(placeholder,''));
  for(const [value,label] of Object.entries(values))el.add(new Option(label,value));
  el.value=selected||'';
}
function plantEditor(options,photo,demo,context={}){
  const prev=context.previous,editing=!!context.editUid,replacing=!!context.replaceUid;
  show('<div class="body"><div class="eyebrow">PLANTING DESK</div><h2>'+(editing?'调整植株':replacing?'确认替换':'种植工作台')+'</h2><div class="pot-choice"><canvas id="previewPlant"></canvas><div><label>植物名称<select id="species"></select></label><i id="taxonomy"></i></div></div><label>展示大小<select id="size"></select></label><label>种植区域<select id="bed"></select></label><label>发现地点（选填）<input id="place" maxlength="60"></label><p id="actionNote"></p><button class="primary" id="save">确定</button><p id="feedback" class="error" role="status"></p></div>');
  options.forEach((r,i)=>$('species').add(new Option(r.name+(Number.isFinite(r.score)?' · '+(100*r.score).toFixed(1)+'%':''),i)));
  fillSelect('size',sizes,prev?.size,'请选择体型');
  fillSelect('bed',Object.fromEntries(Object.entries(places).map(([k,v])=>[k,v.name])),context.zone||prev?.zone||zone,'请选择区域');
  $('place').value=editing?prev.location||'':'';
  if(!demo){const img=document.createElement('img');img.src=photo;img.alt='本次观察的原始照片';img.className='observation-photo';body.querySelector('.pot-choice').before(img)}
  const originalUid=context.editUid||context.replaceUid;
  function updatePreview(){
    const p=options[Number($('species').value)];$('taxonomy').textContent=p.latin;
    const c=$('previewPlant');
    if($('size').value){paintPot(c,{...p,model:cachedModel(p.latin)||p.model,size:$('size').value})}
    else{c.width=180;c.height=200;const g=c.getContext('2d');g.fillStyle='#52674e';g.font='16px sans-serif';g.textAlign='center';g.fillText('选好体型后预览',90,105)}
  }
  const speciesPicker=$('species');
  let previewTimer;
  function selectSpecies(){
    clearTimeout(previewTimer);updatePreview();
    const selected=options[Number(speciesPicker.value)];
    if(demo||fileDemo||cachedModel(selected.latin))return;
    previewTimer=setTimeout(async()=>{
      if(!speciesPicker.isConnected||!modal.open)return;
      await refinePlant(selected);
      if(speciesPicker.isConnected&&modal.open&&selected===options[Number(speciesPicker.value)])updatePreview();
    },450);
  }
  selectSpecies();
  speciesPicker.onchange=selectSpecies;$('size').onchange=updatePreview;
  $('actionNote').textContent=replacing?'保存后，新植株会替换「'+prev.name+'」及其观察记录。':'';
  $('save').textContent=editing?'保存调整':replacing?'确认替换原植物':'种下并布置';
  $('save').onclick=async()=>{
    const p=options[Number($('species').value)],form=plantProfile({...p,model:cachedModel(p.latin)||p.model}).form,size=$('size').value,selected=$('bed').value;
    if(!size||!selected){$('feedback').textContent='请选择展示大小和区域。';return}
    const plantedId=editing?originalUid:crypto.randomUUID(),locationText=$('place').value.trim(),button=$('save');button.disabled=true;
    try{
      await writeGarden((list,design)=>{
        const index=originalUid?list.findIndex(x=>x.uid===originalUid):-1;
        if(originalUid&&index<0)throw Error('原记录已变更，请重新选择。');
        const data={form,size,zone:selected,location:locationText};
        const previous=index>=0?GardenLayout.located(list[index]):null;
        Object.assign(data,GardenLayout.place(data,list.filter(r=>r.uid!==originalUid).concat(design.decorations),previous?.zone===selected?previous:null));
        if(editing){Object.assign(list[index],data);return}
        const record={...data,uid:plantedId,name:p.name,latin:p.latin,family:p.family,note:p.note,photo,demo,date:new Date().toLocaleDateString('zh-CN'),model:cachedModel(p.latin)};
        if(replacing)list.splice(index,1,record);else list.unshift(record);
      });
      zone=selected;if(places[zone].room)indoorZone=zone;else outdoorZone=zone;
      modal.close();location.hash='garden';startStudioLayout(plantedId);route();toast(editing?'调整已保存':replacing?'已替换植物':'已种入花园');
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
    const options=data.results.map(r=>{const known=plants.find(p=>p.latin.startsWith(r.latin+' ')||p.latin===r.latin);return {...r,name:known?.name||r.name,note:known?.note}});
    plantEditor(options,item.photo,false,context);
  }catch(e){if(controller.signal.aborted)return;preview(item.photo,'这次识别未完成','<p>'+esc(e.message)+'</p><button class="light" id="retry">重新识别</button>');$('retry').onclick=()=>identifyPhoto(item,context)}
}
for(const input of [$('cam'),$('file')])input.onchange=async()=>{
  const context=input.plantContext||{};input.plantContext=null;const file=input.files[0];input.value='';if(!file)return;
  try{const item=await prepare(file);
    if(location.protocol==='file:'){preview(item.photo,'在线识别植物','<p>离线版支持种植图鉴示例。拍照识别请打开在线版并选择照片。</p><a href="'+hosted+'">打开在线版</a>');return}
    preview(item.photo,'识别这株植物','<p>将这张照片发送至 Pl@ntNet，获取候选物种。</p><button class="primary" id="identify">开始识别</button>');$('identify').onclick=()=>identifyPhoto(item,context);
  }catch{show('<div class="body"><h2>照片读取失败</h2><p>请尝试 JPG、PNG 或 WebP 格式。</p></div>')}
};
initStudio();window.addEventListener('hashchange',route);setAccountButton();route();if(!fileDemo)void refreshAccount();
