import {currentUser,authJson} from './auth.mjs';
import {guard} from './quota.mjs';
import '../dist/profile.js';
import '../dist/layout.js';
import '../dist/duel-rules.js';

const factionKey=key=>'duel/factions/v1/'+encodeURIComponent(key)+'.json';
const pendingFactions=new Map();
async function assignFaction(key,env,upstream){
  const response=await upstream('https://api.deepseek.com/chat/completions',{
    method:'POST',headers:{Authorization:'Bearer '+env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},
    signal:AbortSignal.timeout(30000),
    body:JSON.stringify({model:'deepseek-v4-pro',thinking:{type:'disabled'},response_format:{type:'json_object'},
      max_tokens:230,messages:[{role:'system',content:'根据规范拉丁双名，为校园桌游做保守的物种归类。只在物种具有可靠的显著性状时选代表性最强的一项：wind 为明显风传播种子或果实；vine 为攀援或明显以匍匐茎蔓延；nectar 为昆虫访花取蜜的显著蜜源；breaker 为根茎具有显著穿隙、拓殖或顶土性状（破障只是游戏效果）。证据不足、普通根系或仅属级推测都选 plain。输出 JSON {"type":"plain","reason":"不超过四十字的中文说明"}。不得给出其他类型。'},{role:'user',content:key}]})
  });
  if(!response.ok)throw Error('upstream');
  const result=await response.json(),raw=JSON.parse(result.choices?.[0]?.message?.content);
  if(!Object.hasOwn(ButterflyDuel.types,raw?.type)||typeof raw.reason!=='string'||!raw.reason.trim())throw Error('invalid');
  const record={type:raw.type,reason:raw.reason.trim().slice(0,100)};
  const saved=await env.BUCKET.put(factionKey(key),JSON.stringify(record),{onlyIf:new Headers({'If-None-Match':'*'})});
  if(saved)return record;
  return (await env.BUCKET.get(factionKey(key))).json();
}
export async function duelFaction(request,env,upstream=fetch){
  try{
    if(request.method!=='POST')return authJson({error:'请提交一个物种。'},405);
    const origin=request.headers.get('Origin');
    if(origin&&origin!==new URL(request.url).origin)return authJson({error:'来源不符。'},403);
    const body=await request.json().catch(()=>null);
    if(typeof body?.latin!=='string'||body.latin.length>160)return authJson({error:'学名无效。'},400);
    const key=FloraCatalog.speciesKey(body.latin);
    if(!key)return authJson({error:'尚未识别到具体物种，可作普通阻挡。'},422);
    const saved=await env.BUCKET.get(factionKey(key));
    if(saved)return authJson(await saved.json());
    if(!env.DEEPSEEK_API_KEY)return authJson({error:'体系判定服务尚未配置。'},503);
    // Anonymous visitors only classify catalogue species, so random binomials can
    // no longer each trigger a paid model call; members keep the wider allowance
    // that AI-modelled garden species need.
    const {ok,user}=await guard(request,env,{name:'faction',anonymousLimit:30,memberLimit:150,globalLimit:900});
    if(!ok)return authJson({error:'请求较多，请稍后重试。'},429);
    if(!user&&!FloraCatalog.isKnownSpecies(key))return authJson({error:'该物种暂无攻防体系，可作为普通阻挡。'},422);
    if(!pendingFactions.has(key))pendingFactions.set(key,assignFaction(key,env,upstream).finally(()=>pendingFactions.delete(key)));
    return authJson(await pendingFactions.get(key));
  }catch{return authJson({error:'物种资料暂不可用。'},503)}
}
async function duelCard(env,user,key,asPlain){
  if(!key)return null;
  if(key==='basic')return ButterflyDuel.basic;
  if(key==='trial')return ButterflyDuel.tool;
  const doc=await env.BUCKET.get('gardens/v1/'+encodeURIComponent(user.id)+'.json');
  const {records,design}=GardenLayout.unpack(doc?await doc.json():[]);
  if(!design.discovered.includes(key))throw Error('请先收集并保存这个物种。');
  const plant=records.find(p=>FloraCatalog.speciesKey(p.latin)===key);
  const faction=asPlain?null:await env.BUCKET.get(factionKey(key));
  return {key,name:plant?.name||key,type:faction?(await faction.json()).type:'plain'};
}
async function lockDuelDeck(env,user,chosen={}){
  const {standards}=ButterflyDuel;
  if(!chosen||typeof chosen!=='object'||Array.isArray(chosen)||Object.keys(chosen).some(k=>!Object.hasOwn(standards,k)))throw Error('配卡格式有误。');
  const deck=[];
  let garden;
  for(const [type,standard] of Object.entries(standards)){
    const key=chosen[type]??standard.key;
    if(key===standard.key){deck.push(standard);continue}
    if(typeof key!=='string'||key.length>160||FloraCatalog.speciesKey(key)!==key)throw Error('请选择该体系的植物。');
    if(!garden){
      const doc=await env.BUCKET.get('gardens/v1/'+encodeURIComponent(user.id)+'.json');
      garden=GardenLayout.unpack(doc?await doc.json():[]);
    }
    if(!garden.design.discovered.includes(key))throw Error('该植物尚未收入你的图鉴。');
    const entry=await env.BUCKET.get(factionKey(key));
    if(!entry||(await entry.json()).type!==type)throw Error('植物与卡槽不匹配，请重新选择。');
    deck.push({type,key,name:garden.records.find(p=>FloraCatalog.speciesKey(p.latin)===key)?.name||key});
  }
  return deck;
}
function duelView(room,user){
  if(!room)return null;
  const {plan,...board}=room.board;
  const seat=room.players.indexOf(user.id);
  return {match:room.match,rev:room.rev,seat,status:room.status,deck:room.decks?.[seat]||null,board};
}
export async function duelApi(request,env){
  try{
    const user=await currentUser(request,env);
    if(!user)return authJson({error:'请先登录植迹账号。'},401);
    const url=new URL(request.url),id=url.searchParams.get('friend');
    if(!id||id.length>80)return authJson({error:'请选择一位花友。'},400);
    const edge=await env.DB.prepare('SELECT * FROM garden_friends WHERE id=? AND accepted=1 AND (sender=? OR recipient=?)').bind(id,user.id,user.id).first();
    if(!edge)return authJson({error:'需要双方先成为花友。'},403);
    const path='duel/rooms/v1/'+encodeURIComponent(id)+'.json',doc=await env.BUCKET.get(path);
    let room=doc?await doc.json():null;
    if(room?.board&&!Array.isArray(room.board.forecast)){
      let seed=2166136261;
      for(const ch of room.match+':'+room.rev)seed=Math.imul(seed^ch.charCodeAt(0),16777619);
      ButterflyDuel.planFlight(room.board,()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
    }
    if(request.method==='GET')return authJson({room:duelView(room,user)});
    if(request.method!=='POST'||request.headers.get('Origin')!==url.origin)return authJson({error:'请求不符。'},403);
    const data=await request.json().catch(()=>null);
    if(!data||data.rev!==(room?.rev??0)||data.match!==(room?.match??null))return authJson({error:'棋盘已更新，请查看最新回合。'},409);
    const other=edge.sender===user.id?edge.recipient:edge.sender;
    if(data.action==='invite'&&(!room||room.status==='done')){
      let deck;try{deck=await lockDuelDeck(env,user,data.deck)}catch(e){return authJson({error:e.message},400)}
      room={match:crypto.randomUUID(),rev:0,players:[user.id,other],decks:[deck,null],status:'waiting',board:ButterflyDuel.create()};
    }else if(room?.status==='waiting'&&data.action==='join'&&room.players[1]===user.id){
      if(room.decks){try{room.decks[1]=await lockDuelDeck(env,user,data.deck)}catch(e){return authJson({error:e.message},400)}}
      room.status='playing';
    }else if(room&&data.action==='end'&&room.status!=='done'){
      if(room.status==='playing')room.board.winner=1-room.players.indexOf(user.id);
      room.status='done';room.board.forecast=[];room.board.plan=[];room.board.last=['对局已结束。'];
    }else if(room?.status==='playing'&&data.action==='play'&&room.players[room.board.turn]===user.id){
      try{
        if(data.key!==null&&(typeof data.key!=='string'||!data.key||data.key.length>160))throw Error('植物无效。');
        const card=room.decks?room.decks[room.board.turn].find(c=>c.key===data.key):await duelCard(env,user,data.key,data.asPlain===true);
        if(data.key!==null&&!card)throw Error('本局没有携带这株植物。');
        ButterflyDuel.play(room.board,card,data.cell);
      }catch(e){return authJson({error:e.message},400)}
      if(room.board.winner!==null)room.status='done';
    }else return authJson({error:'当前无法执行这一步。'},409);
    room.rev++;
    const saved=await env.BUCKET.put(path,JSON.stringify(room),{onlyIf:new Headers(doc?{'If-Match':doc.httpEtag}:{'If-None-Match':'*'})});
    if(!saved)return authJson({error:'另一方刚刚行动，请查看最新棋盘。'},409);
    return authJson({room:duelView(room,user)});
  }catch{return authJson({error:'暂时无法连接棋局，请稍后重试。'},503)}
}
