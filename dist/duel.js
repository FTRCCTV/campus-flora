const duelState={mode:'local',scope:null,friend:'',room:null,ticket:0,busy:false,timer:0,local:null};
const duelTypes=ButterflyDuel.types,duelGlyph={plain:'🌱',nectar:'✿',wind:'❋',vine:'❧',breaker:'⛏'};
const duelSamples=[['nectar','花引'],['wind','风播'],['vine','蔓生'],['breaker','破障']].map(([type,name])=>({type,key:'sample-'+type,name:name+'演习牌'}));
const factionJobs=new Map(),factionMemory=new Map();
function savedFaction(key){
  if(factionMemory.has(key))return factionMemory.get(key);
  try{const value=JSON.parse(localStorage.getItem('flora.duel.type.v1.'+key));if(value&&Object.hasOwn(duelTypes,value.type))return value}catch{}
  return null;
}
async function classifyDuel(key){
  const saved=savedFaction(key);if(saved)return saved;
  if(!key)throw Error('未确定具体物种，可以作为普通阻挡。');
  if(fileDemo)throw Error('请使用一键启动版或在线版连接 DeepSeek。');
  if(factionJobs.has(key))return factionJobs.get(key);
  const job=(async()=>{
    const res=await fetch('/api/faction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latin:key}),signal:AbortSignal.timeout(36000)});
    const value=await res.json();if(!res.ok||!Object.hasOwn(duelTypes,value.type))throw Error(value.error||'暂时无法判定体系。');
    factionMemory.set(key,value);try{localStorage.setItem('flora.duel.type.v1.'+key,JSON.stringify(value))}catch{}
    return value;
  })().finally(()=>factionJobs.delete(key));
  factionJobs.set(key,job);return job;
}
async function classifyDiscoveries(keys){
  if(fileDemo)return;
  for(const key of keys){try{await classifyDuel(key)}catch{/* Retry from the specimen or battle hand. */}}
  if(location.hash==='#duel')renderDuel();
}
function showDuelTrait(plant){
  const key=FloraCatalog.speciesKey(plant.latin),line=document.createElement('p'),btn=document.createElement('button');
  $('carePanel').before(line);line.after(btn);btn.className='smallBtn';btn.textContent='判定对战体系';
  function showTrait(value){line.textContent='对战体系 · '+(value?duelTypes[value.type][0]+'。'+value.reason:key?'待判定，当前可用于占地。':'普通占地');btn.hidden=!!value||!key||fileDemo}
  showTrait(savedFaction(key));btn.onclick=async()=>{btn.disabled=true;try{showTrait(await classifyDuel(key))}catch(e){line.textContent=e.message}finally{btn.disabled=false}};
}
function duelOwner(){return gardenAccount.user?.id||'guest'}
function duelStorage(){return 'flora.duel.practice.v1.'+duelOwner()}
function duelCards(){
  const online=duelState.mode==='online',design=online?gardenAccount.design:readDesign();
  const plants=online?gardenAccount.records:readGarden(),names=new Map(plants.map(p=>[FloraCatalog.speciesKey(p.latin),p.name]));
  const cards=[ButterflyDuel.basic,ButterflyDuel.tool];
  for(const key of design?.discovered||[]){
    const value=savedFaction(key);
    cards.push({key,name:names.get(key)||key,type:value?.type||'plain',pending:!value});
  }
  return online?cards:cards.concat(duelSamples);
}
function duelMsg(msg){$('duelMessage').textContent=msg}
function leaveDuel(){
  clearTimeout(duelState.timer);
  if(duelState.scope!==null){duelState.ticket++;duelState.busy=false;duelState.scope=null}
}
function openDuel(){
  const invite=new URL(location.href).searchParams.get('duelFriend');
  const switchOnline=duelState.scope!==duelOwner()&&(!!invite||duelState.mode==='online');
  if(duelState.scope!==duelOwner()){
    leaveDuel();duelState.scope=duelOwner();duelState.room=null;duelState.friend='';duelState.mode='local';duelMsg('');
    try{duelState.local=JSON.parse(sessionStorage.getItem(duelStorage()))}catch{duelState.local=null}
    if(!duelState.local)duelState.local=ButterflyDuel.create();
  }
  if(!$('duelBoard').childElementCount)initDuel();
  if(switchOnline){void duelMode(true);return}
  renderDuel();
}
function renderDuel(){
  const online=duelState.mode==='online',room=duelState.room,s=online?room?.board:duelState.local;
  $('duelLocal').setAttribute('aria-pressed',String(!online));$('duelOnline').setAttribute('aria-pressed',String(online));
  $('duelLobby').hidden=!online;
  const play=!!s&&s.winner===null&&(!online||room.status==='playing'&&room.seat===s.turn)&&!duelState.busy;
  const sel=$('duelHand'),previous=sel.value,cards=duelCards();
  const handKey=JSON.stringify(cards.map(c=>[c.key,c.type,c.pending,c.name]));
  if(sel.dataset.hand!==handKey){sel.dataset.hand=handKey;sel.replaceChildren(...cards.map(c=>new Option(c.name+' · '+(c.pending?'待归类／占地':duelTypes[c.type][0]),c.key)))}
  if(cards.some(c=>c.key===previous))sel.value=previous;
  const card=cards.find(c=>c.key===sel.value)||cards[0];
  const specimen=(online?gardenAccount.records:readGarden()).find(p=>FloraCatalog.speciesKey(p.latin)===card.key);
  const photo=$('duelPhoto');photo.hidden=!specimen?.photo;
  if(specimen?.photo&&photo.getAttribute('src')!==specimen.photo)photo.src=specimen.photo;
  const cooling=card.key==='trial'&&!s?.trial[s?.turn]?'本局体验卡已使用。':(s?.cool[s.turn][card.type]||0)>s?.round?'该体系本轮休息。':'';
  $('duelAbility').textContent=duelTypes[card.type][1]+' '+cooling;
  $('duelClass').hidden=!card.pending||fileDemo;$('duelClass').disabled=factionJobs.has(card.key);
  $('duelTurn').textContent=online&&!room?'在线花友对局':online&&room.status==='waiting'?'等待花友入局':online&&room.status==='done'&&s.winner===null?'邀请已取消':
    s.winner!==null?(s.winner+1)+'P 获胜 · '+ButterflyDuel.sides[s.winner]:'第 '+s.round+' 轮 · '+(s.turn+1)+'P 行动';
  $('duelRibbon').textContent=$('duelTurn').textContent;
  $('duelLast').textContent=(online&&room?'你是 '+(room.seat+1)+'P。':'')+(s?s.last.join(' ／ '):'双方选择彼此的花友房，一方发起，另一方应战。');
  $('duelLink').hidden=!online||!room||room.status==='done';
  $('duelNew').hidden=online;$('duelPass').disabled=!play;
  $('duelRoomAction').textContent=!gardenAccount.user?'登录植迹账号':!room||room.status==='done'?'发起对局':room.status==='waiting'&&room.seat===1?'接受邀请':room.status==='waiting'?'撤回邀请':'认输';
  $('duelRoomAction').disabled=duelState.busy||!!gardenAccount.user&&!duelState.friend;
  const grid=$('duelBoard'),prior=Number(grid.dataset.pos),scope=online?room?.match:'practice';
  const glide=grid.dataset.scope===scope&&s?.trail.at(-2)===prior&&prior!==s?.pos;
  grid.dataset.scope=scope||'';grid.dataset.pos=String(s?.pos??0);
  for(const [i,b] of Array.from(grid.children).entries()){
    const tile=s?.cells[i],butterfly=i===(s?.pos??0),trail=s?.trail.includes(i);
    b.dataset.owner=tile?.owner??'';b.dataset.butterfly=butterfly;
    const token=butterfly?'🦋':tile?duelGlyph[tile.type]:trail?'·':'';
    b.firstChild.textContent=ButterflyDuel.coord(i);b.lastChild.textContent=token;
    b.lastChild.className=!tile&&!butterfly?'footprint':'';
    b.title=ButterflyDuel.coord(i)+(tile?' · '+(tile.owner+1)+'P '+tile.name:'')+(butterfly?' · 蝴蝶':'');
    b.setAttribute('aria-label',b.title);b.disabled=!play;
  }
  if(glide&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    const from=grid.children[prior].getBoundingClientRect(),to=grid.children[s.pos].getBoundingClientRect();
    grid.children[s.pos].lastChild.animate([{transform:'translate('+(from.x-to.x)+'px,'+(from.y-to.y)+'px)'},{transform:'translate(0,0)'}],{duration:450,easing:'ease-out'});
  }
}
function storePractice(){
  try{sessionStorage.setItem(duelStorage(),JSON.stringify(duelState.local))}catch{}
}
async function duelPlay(pass,cell){
  const online=duelState.mode==='online',board=online?duelState.room?.board:duelState.local;
  const card=pass?null:duelCards().find(c=>c.key===$('duelHand').value);
  try{
    if(!board||duelState.busy)return;
    ButterflyDuel.check(board,card,cell);
    if(online){await roomCall('play',{key:card?.key??null,asPlain:!!card?.pending,cell});return}
    ButterflyDuel.play(board,card,cell);storePractice();duelMsg('');renderDuel();
  }catch(e){duelMsg(e.message)}
}
function pollDuel(){
  clearTimeout(duelState.timer);
  if(location.hash==='#duel'&&duelState.mode==='online'&&duelState.friend)
    duelState.timer=setTimeout(()=>document.hidden?pollDuel():roomCall(),3000);
}
async function roomCall(action,extra={}){
  if(!duelState.friend||duelState.mode!=='online'||action&&duelState.busy)return;
  const ticket=++duelState.ticket;clearTimeout(duelState.timer);
  if(action){duelState.busy=true;renderDuel()}
  try{
    const p='/api/duel?friend='+encodeURIComponent(duelState.friend),room=duelState.room;
    const options=action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,match:room?.match??null,rev:room?.rev??0,...extra})}:{};
    const response=await fetch(p,{...options,cache:'no-store',signal:AbortSignal.timeout(12000)}),data=await response.json();
    if(ticket!==duelState.ticket)return;
    if(!response.ok)throw Error(data.error||'暂时无法读取棋盘。');
    duelState.room=data.room;
    if(action)duelMsg('');
  }catch(e){if(ticket===duelState.ticket)duelMsg(e.message)}
  finally{if(ticket===duelState.ticket){duelState.busy=false;renderDuel();pollDuel()}}
}
async function duelMode(online){
  ++duelState.ticket;clearTimeout(duelState.timer);duelState.room=null;duelState.friend='';duelState.busy=false;
  $('duelHand').value='basic';duelState.mode=online?'online':'local';duelMsg('');$('duelFriends').replaceChildren();renderDuel();
  if(!online)return;
  if(!gardenAccount.user){duelMsg(localGardenOnly?'在线花友对战请打开网站并登录。':'登录后即可邀请已添加的花友。');return}
  const ticket=duelState.ticket;
  try{
    const data=await socialRequest();if(ticket!==duelState.ticket)return;
    for(const f of data.people.filter(p=>p.status==='friends'))$('duelFriends').add(new Option(f.name,f.id));
    const requested=new URL(location.href).searchParams.get('duelFriend');
    if(requested){
      const found=Array.from($('duelFriends').options).some(o=>o.value===requested);
      if(!found){duelMsg('此邀请属于另一对花友，请核对账号。');return}
      $('duelFriends').value=requested;
    }
    duelState.friend=$('duelFriends').value;if(duelState.friend)await roomCall();else duelMsg('先在「管理花友」添加对方，成为花友后即可开局。');
  }catch(e){if(ticket===duelState.ticket)duelMsg(e.message)}
}
function initDuel(){
  for(let i=0;i<25;i++){
    const b=document.createElement('button');b.type='button';b.append(document.createElement('small'),document.createElement('span'));
    b.onclick=()=>duelPlay(false,i);$('duelBoard').append(b);
  }
  for(const [name,text] of Object.values(duelTypes)){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=text;$('duelGlossary').append(dt,dd);
  }
  $('duelLocal').onclick=()=>duelMode(false);$('duelOnline').onclick=()=>duelMode(true);
  $('duelLink').onclick=async()=>{
    const link=new URL(location.href);link.searchParams.set('duelFriend',duelState.friend);link.hash='duel';
    try{await navigator.clipboard.writeText(link.href);duelMsg('已复制入局链接，可发给这位花友。')}catch{duelMsg(link.href)}
  };
  $('duelManage').onclick=()=>localGardenOnly?window.open(hosted+'#duel','_blank','noopener'):friendsPanel();
  $('duelFriends').onchange=()=>{duelState.friend=$('duelFriends').value;duelState.room=null;duelState.busy=false;duelMsg('');renderDuel();void roomCall()};
  $('duelRoomAction').onclick=()=>{
    if(!gardenAccount.user){if(localGardenOnly)window.open(hosted+'#duel','_blank','noopener');else accountPanel();return}
    const r=duelState.room;
    if(!r||r.status==='done')void roomCall('invite');
    else if(r.status==='waiting'&&r.seat===1)void roomCall('join');
    else if(r.status==='waiting'||confirm('认输并结束本局？'))void roomCall('end');
  };
  $('duelHand').onchange=()=>{duelMsg('');renderDuel()};
  $('duelPass').onclick=()=>duelPlay(true);
  $('duelNew').onclick=()=>{if(duelState.local.winner===null&&duelState.local.last.length&&!confirm('重新开始这场同屏对局？'))return;duelState.local=ButterflyDuel.create();storePractice();duelMsg('');renderDuel()};
  $('duelClass').onclick=async()=>{
    const key=$('duelHand').value;$('duelClass').disabled=true;duelMsg('DeepSeek 正在查对物种性状…');
    try{await classifyDuel(key);duelMsg('已归类。')}catch(e){duelMsg(e.message)}finally{renderDuel()}
  };
}
