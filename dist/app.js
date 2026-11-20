const $=id=>document.getElementById(id),modal=$('modal'),body=$('content'),key='cau.flora.records.v1';
const symbols={camera:'<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1"/><path d="m4 17 5-5 4 3 3-4 5 6"/>',leaf:'<path d="M19 4C8 3 3 8 6 15c4 7 15 1 13-11Z M4 21 15 9"/>'};
const icon=k=>'<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+symbols[k]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

let apiKey='', requestController, collection=[], illustrated=false;
const hosted='https://cau-campus-flora-notebook.bubblybox131.chatgpt.site/';
function records(){
  try{return JSON.parse(localStorage.getItem(key)||'[]').map(r=>({...plants[r.id],...r})).filter(r=>r.name&&r.latin&&r.photo?.startsWith('data:image/'))}catch{return []}
}
function esc(value){const el=document.createElement('span');el.textContent=String(value??'');return el.innerHTML}
function show(html){body.innerHTML=html;if(!modal.open)modal.showModal();modal.scrollTop=0}
$('close').onclick=()=>modal.close();
modal.addEventListener('close',()=>{if(!modal.open)requestController?.abort()});
function caption(p){return '<div class="cardFoot"><div><h3>'+esc(p.name)+'</h3><i class="latin">'+esc(p.latin)+'</i></div><span class="mark">'+icon('leaf')+'</span></div>'}
function detail(r){
  show('<img class="detailArt" alt="观察照片"><div class="body"><div class="eyebrow">'+(r.demo?'图鉴示例':esc(r.provider)||'校园观察')+'</div><h2>'+esc(r.name)+'</h2><i>'+esc(r.latin)+'</i><p>'+esc(r.note||r.family||'')+'</p><div class="recinfo">'+esc(r.date)+' · '+esc(r.location||'未填写地点')+'</div></div>');
  body.querySelector('img').src=r.photo;
}
const drawGarden=gardenScene($('world'),i=>illustrated?atlasDetail(i):detail(collection[i]));
function route(){
  const garden=location.hash==='#garden';$('explore').hidden=garden;$('garden').hidden=!garden;
  $('ne').classList.toggle('active',!garden);$('ng').classList.toggle('active',garden);
  collection=records();illustrated=!collection.length;$('qty').textContent=collection.length;
  if(!garden)return;
  $('sceneLabel').textContent=illustrated?'示例花园 · 点选植株体验':'我的花园 · '+collection.length+' 株';
  drawGarden(illustrated?plants:collection);
  $('records').replaceChildren();
  if(illustrated){$('records').innerHTML='<div class="empty"><h2>种下你的第一株植物</h2><p>上方展示三种示例树形。收藏第一条记录，即可看到自己的花园。</p><button class="light" id="first">拍照识植</button></div>';$('first').onclick=guide}
  collection.forEach(r=>{const b=document.createElement('button');b.className='card';b.innerHTML='<div class="art"><img alt=""><span class="tag">'+(r.demo?'示例记录':'观察记录')+'</span></div>'+caption(r);b.querySelector('img').src=r.photo;b.onclick=()=>detail(r);$('records').append(b)});
}
function atlasDetail(id){
  const p=plants[id];show('<canvas class="detailArt"></canvas><div class="body"><div class="eyebrow">'+p.family+'</div><h2>'+p.name+'</h2><i>'+p.latin+'</i><p>'+p.note+'</p><button class="primary" id="sample">将图鉴示例种入花园</button></div>');
  const canvas=body.querySelector('canvas');plate(canvas,id);$('sample').onclick=()=>confirmPlant([p],canvas.toDataURL('image/jpeg',.76),true);
}
plants.forEach((p,id)=>{const b=document.createElement('button');b.className='card';b.innerHTML='<div class="art"><canvas></canvas><span class="tag">'+p.family+'</span></div>'+caption(p);$('atlas').append(b);plate(b.querySelector('canvas'),id);b.onclick=()=>atlasDetail(id)});
plate($('heroCanvas'),0,true);
function confirmPlant(options,photo,demo){
  show('<img class="detailArt" alt="植物记录"><div class="body"><div class="eyebrow">'+(demo?'图鉴示例':'Pl@ntNet · 识别候选')+'</div><h2>确认后种入花园</h2><label>植物名称<select id="species"></select></label><p id="taxonomy"></p><label>发现地点（选填）<input id="place" maxlength="60" placeholder="例如：东校区图书馆旁"></label><button class="primary" id="save">种入我的植物园</button><p id="feedback" role="status"></p></div>');
  body.querySelector('img').src=photo;
  options.forEach((r,i)=>$('species').add(new Option(r.name+(Number.isFinite(r.score)?' · '+(100*r.score).toFixed(1)+'%':''),i)));
  $('species').onchange=()=>{const r=options[Number($('species').value)];$('taxonomy').textContent=[r.latin,r.family].filter(Boolean).join(' · ')};$('species').onchange();
  $('save').onclick=()=>{const p=options[Number($('species').value)];
    const record={name:p.name,latin:p.latin,family:p.family,note:p.note,photo,demo,provider:demo?'图鉴示例':'Pl@ntNet',location:$('place').value.trim(),date:new Date().toLocaleDateString('zh-CN')};
    try{localStorage.setItem(key,JSON.stringify([record,...records()]))}catch{$('feedback').textContent='设备存储不可用或已满，记录未保存。';return}
    modal.close();location.hash='garden';route();
  };
}
function guide(){
  show('<div class="body"><div class="eyebrow">PL@NTNET</div><h2>拍下身边的植物</h2><p>让叶、花或果实清晰入镜。确认后，照片将发送至 Pl@ntNet 识别。</p><div class="actions"><button class="primary" style="width:auto" id="take">打开相机</button><button class="light" id="choose">选择照片</button></div></div>');
  $('take').onclick=()=>$('cam').click();$('choose').onclick=()=>$('file').click();
}
$('shoot').onclick=$('add').onclick=guide;$('album').onclick=()=>$('file').click();
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
async function identifyPhoto(item){
  requestController?.abort();const controller=new AbortController();requestController=controller;
  preview(item.photo,'正在辨认植物','<p role="status">正在查询 Pl@ntNet 物种库…</p>');
  try{
    const headers={'Content-Type':'image/jpeg'};if(apiKey)headers['x-plantnet-key']=apiKey;
    const response=await fetch('/api/identify',{method:'POST',headers,body:item.blob,signal:controller.signal});
    const data=await response.json();if(controller.signal.aborted)return;
    if(data.code==='key'){
      preview(item.photo,'连接识别服务','<p>'+esc(data.error)+' 密钥只在当前页面内存中使用。</p><label>Pl@ntNet API Key<input type="password" id="token" autocomplete="off"></label><button class="primary" id="connect">连接并识别</button><p><a href="https://my.plantnet.org/" target="_blank" rel="noopener">获取自己的 Pl@ntNet 密钥</a></p>');
      $('connect').onclick=()=>{apiKey=$('token').value.trim();if(apiKey)identifyPhoto(item);else $('token').focus()};return;
    }
    if(!response.ok)throw Error(data.error||'识别服务暂时不可用。');
    if(!data.results.length){preview(item.photo,'未找到匹配植物','<p>请靠近一朵花或一片完整的叶子重新拍摄。</p><button class="light" id="again">换张照片</button>');$('again').onclick=guide;return}
    const options=data.results.map(r=>{const known=plants.find(p=>p.latin.startsWith(r.latin+' ')||p.latin===r.latin);return {...r,name:known?.name||r.name,note:known?.note}});
    confirmPlant(options,item.photo,false);
  }catch(e){if(controller.signal.aborted)return;preview(item.photo,'这次识别未完成','<p>'+esc(e.message)+'</p><button class="light" id="retry">重新识别</button>');$('retry').onclick=()=>identifyPhoto(item)}
}
for(const input of [$('cam'),$('file')])input.onchange=async()=>{
  const file=input.files[0];input.value='';if(!file)return;
  try{const item=await prepare(file);
    if(location.protocol==='file:'){preview(item.photo,'在线识别植物','<p>离线版支持种植图鉴示例。拍照识别请打开在线版并选择照片。</p><a href="'+hosted+'">打开在线版</a>');return}
    preview(item.photo,'识别这株植物','<p>将这张照片发送至 Pl@ntNet，获取候选物种。</p><button class="primary" id="identify">开始识别</button>');$('identify').onclick=()=>identifyPhoto(item);
  }catch{show('<div class="body"><h2>照片读取失败</h2><p>请尝试 JPG、PNG 或 WebP 格式。</p></div>')}
};
window.addEventListener('hashchange',route);route();

