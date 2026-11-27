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
  if(fileDemo)throw Error('请使用一键启动版或在线版获取物种资料。');
  if(factionJobs.has(key))return factionJobs.get(key);
  const job=(async()=>{
    const res=await fetch('/api/faction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latin:key}),signal:AbortSignal.timeout(36000)});
    const value=await res.json();if(!res.ok||!Object.hasOwn(duelTypes,value.type))throw Error(value.error||'暂时无法判定体系。');
    factionMemory.set(key,value);try{localStorage.setItem('flora.duel.type.v1.'+key,JSON.stringify(value))}catch{}
    return value;
  })().finally(()=>factionJobs.delete(key));
  factionJobs.set(key,job);return job;
}
const factionRetry=new Map();
async function classifyDiscoveries(keys){
  if(fileDemo)return;
  let updated=false;
  for(const key of new Set(keys)){
    if(!key||savedFaction(key)||(factionRetry.get(key)||0)>Date.now())continue;
    try{await classifyDuel(key);updated=true}catch{factionRetry.set(key,Date.now()+5*60000)}
  }
  if(updated&&location.hash==='#duel')renderDuel();
}
function showDuelTrait(plant){
  const key=FloraCatalog.speciesKey(plant.latin),line=document.createElement('p');line.hidden=true;
  $('carePanel').before(line);
  function show(){const result=savedFaction(key);if(result&&line.isConnected){line.textContent='对战体系 · '+duelTypes[result.type][0];line.hidden=false}}
  show();if(key&&!savedFaction(key))void classifyDiscoveries([key]).then(show);
}
function duelOwner(){return gardenAccount.user?.id||'guest'}
function duelStorage(){return 'flora.duel.practice.v1.'+duelOwner()}
const deckSetup={seat:0,picks:[{},{},{}]};
function deckPool(){
  const online=duelState.mode==='online',plants=online?gardenAccount.records:readGarden(),design=online?gardenAccount.design:readDesign();
  const names=new Map(plants.map(p=>[FloraCatalog.speciesKey(p.latin),p.name]));
  const pool=Object.fromEntries(Object.entries(ButterflyDuel.standards).map(([t,c])=>[t,[c]]));
  for(const key of design?.discovered||[]){
    const result=savedFaction(key);
    if(result||fileDemo)pool[result?.type||'plain'].push({key,name:names.get(key)||key,type:result?.type||'plain'});
  }
  return pool;
}
function deckFor(pool,seat){
  return Object.values(pool).map(options=>options.find(c=>c.key===deckSetup.picks[seat][options[0].type])||options[1]||options[0]);
}
function deckKeys(deck){return Object.fromEntries(deck.map(c=>[c.type,c.key]))}
function localPlaying(){const s=duelState.local;return !!s&&(!!s.decks||s.actions>0||s.round>1||s.winner!=null)}
function duelCards(){
  if(duelState.mode==='online'&&duelState.room?.deck)return duelState.room.deck;
  const s=duelState.local;
  if(duelState.mode==='local'&&s?.decks)return s.decks[s.turn];
  const pool=deckPool();
  if(duelState.mode==='online'?duelState.room?.status==='playing':localPlaying()){
    return [ButterflyDuel.basic,ButterflyDuel.tool,...Object.values(pool).flatMap(opts=>opts.slice(1)),...(duelState.mode==='local'?duelSamples:[])];
  }
  return deckFor(pool,duelState.mode==='online'?2:deckSetup.seat);
}
function renderDeckPrep(){
  const online=duelState.mode==='online',r=duelState.room,prep=$('duelPrep');
  const visible=online?(!r||r.status==='done'||r.status==='waiting'&&r.seat===1):!localPlaying();
  prep.hidden=!visible;
  const action=$('duelRoomAction');
  if(online&&visible&&action.parentNode!==prep)prep.append(action);
  else if((!online||!visible)&&action.parentNode!==$('duelLobby'))$('duelLobby').insertBefore(action,$('duelLink'));
  action.hidden=!online;
  const status=$('duelMessage'),journal=document.querySelector('.duelJournal');
  if(visible&&status.parentNode!==prep)prep.append(status);
  else if(!visible&&status.parentNode!==journal.parentNode)journal.before(status);
  const arena=document.querySelector('.duelLayout');
  arena.hidden=visible;
  if(!visible)return;
  const pool=deckPool(),seat=online?2:deckSetup.seat,deck=deckFor(pool,seat);
  $('prepSeats').hidden=online;$('prepStart').hidden=online;
  for(const b of $('prepSeats').children)b.setAttribute('aria-pressed',String(+b.dataset.prepSeat===seat));
  const grid=$('deckSlots'),signature=JSON.stringify([seat,pool,deck.map(c=>c.key)]);
  if(grid.dataset.key===signature)return;
  grid.dataset.key=signature;
  grid.replaceChildren(...deck.map(card=>{
    const label=document.createElement('label'),title=document.createElement('strong'),hint=document.createElement('small'),select=document.createElement('select');
    title.textContent=duelGlyph[card.type]+' '+duelTypes[card.type][0];
    for(const c of pool[card.type])select.add(new Option(c.name,c.key));
    select.value=card.key;select.setAttribute('aria-label',duelTypes[card.type][0]+'出战植物');
    select.onchange=()=>{deckSetup.picks[seat][card.type]=select.value;grid.dataset.key='';};
    hint.textContent=duelTypes[card.type][1];label.append(title,select,hint);return label;
  }));
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
    leaveDuel();deckSetup.picks=[{},{},{}];deckSetup.seat=0;duelState.scope=duelOwner();duelState.room=null;duelState.friend='';duelState.mode='local';duelMsg('');
    try{duelState.local=JSON.parse(sessionStorage.getItem(duelStorage()))}catch{duelState.local=null}
    if(!duelState.local)duelState.local=ButterflyDuel.create();
  }
  if(!$('duelBoard').childElementCount)initDuel();
  void classifyDiscoveries((gardenAccount.user?gardenAccount.design:readDesign())?.discovered||[]);
  if(switchOnline){void duelMode(true);return}
  renderDuel();
}
function renderDuel(){
  const online=duelState.mode==='online',room=duelState.room,s=online?room?.board:duelState.local;
  $('duelLocal').setAttribute('aria-pressed',String(!online));$('duelOnline').setAttribute('aria-pressed',String(online));
  $('duelLobby').hidden=!online;
  renderDeckPrep();
  const play=(online||localPlaying())&&!!s&&s.winner===null&&(!online||room.status==='playing'&&room.seat===s.turn)&&!duelState.busy;
  const sel=$('duelHand'),previous=sel.value,cards=duelCards();
  const handKey=JSON.stringify(cards.map(c=>[c.key,c.type,c.name]));
  if(sel.dataset.hand!==handKey){sel.dataset.hand=handKey;sel.replaceChildren(...cards.map(c=>new Option(c.name+' · '+duelTypes[c.type][0],c.key)))}
  sel.value=cards.some(c=>c.key===previous)?previous:cards[0].key;
  const card=cards.find(c=>c.key===sel.value)||cards[0];
  const specimen=(online?gardenAccount.records:readGarden()).find(p=>FloraCatalog.speciesKey(p.latin)===card.key);
  const photo=$('duelPhoto');photo.hidden=!specimen?.photo;
  if(specimen?.photo&&photo.getAttribute('src')!==specimen.photo)photo.src=specimen.photo;
  const cooling=card.key==='trial'&&!s?.trial[s?.turn]?'本局体验卡已使用。':(s?.cool[s.turn][card.type]||0)>s?.round?'该体系本轮休息。':'';
  $('duelAbility').textContent=duelTypes[card.type][1]+' '+cooling;
  $('duelTurn').textContent=online&&!room?'在线花友对局':online&&room.status==='waiting'?'等待花友入局':online&&room.status==='done'&&s.winner===null?'邀请已取消':
    s.winner!==null?(s.winner+1)+'P 获胜 · '+ButterflyDuel.sides[s.winner]:'第 '+s.round+' 轮 · '+(s.turn+1)+'P 行动';
  $('duelRibbon').textContent=$('duelTurn').textContent;
  $('duelLast').textContent=(online&&room?'你是 '+(room.seat+1)+'P。':'')+(s?s.last.join(' ／ '):'双方选择彼此的花友房，一方发起，另一方应战。');
  $('duelLink').hidden=!online||!room||room.status==='done';
  $('duelNew').hidden=online;$('duelPass').disabled=!play;
  $('duelRoomAction').textContent=!gardenAccount.user?'登录植迹账号':!room||room.status==='done'?'锁定阵容并邀请':room.status==='waiting'&&room.seat===1?'锁定阵容并应战':room.status==='waiting'?'撤回邀请':'认输';
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
  updateDuelView(s,room,play,card,cards,glide);
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
    if(!board||duelState.busy||!online&&!localPlaying())return;
    if(!pass&&!card)throw Error('请先选择本局携带的植物。');
    ButterflyDuel.check(board,card,cell);
    if(online){await roomCall('play',{key:card?.key??null,cell});return}
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
  if(action==='join'||action==='invite')extra={...extra,deck:deckKeys(deckFor(deckPool(),2))};
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
  initDuelView();
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
  for(const b of $('prepSeats').children)b.onclick=()=>{deckSetup.seat=+b.dataset.prepSeat;renderDeckPrep()};
  $('prepStart').onclick=()=>{
    const pool=deckPool();duelState.local=ButterflyDuel.create();duelState.local.decks=[deckFor(pool,0),deckFor(pool,1)];
    storePractice();duelMsg('');renderDuel();
  };
}
