import {currentUser,authJson,authQuota,sameOrigin} from './auth.mjs';
import {sharedPlant} from './friends.mjs';

async function giftGarden(env,id){
  const key='gardens/v1/'+encodeURIComponent(id)+'.json',object=await env.BUCKET.get(key);
  const data=object?await object.json():[];
  return {key,object,...GardenLayout.unpack(data),gifts:data.gifts||[]};
}
async function saveGiftGarden(env,garden){
  const {key,object,records,design,gifts}=garden,json=JSON.stringify({records,design,gifts});
  if(new TextEncoder().encode(json).length>16*1024*1024)return authJson({error:'花园存储空间已满。'},413);
  const saved=await env.BUCKET.put(key,json,{onlyIf:new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
  return saved?authJson({ok:true}):authJson({error:'花园刚有更新，请刷新花友列表再试。'},409);
}
export async function giftsApi(request,env){
  try{
    const user=await currentUser(request,env);
    if(!user)return authJson({error:'请先登录植迹账号。'},401);
    if(request.method==='GET'){
      const {gifts}=await giftGarden(env,user.id);
      return authJson({gifts:gifts.map(({id,from,plant,kind,wantsReturn})=>({id,from,plant,kind:kind||'cutting',...(wantsReturn?{wantsReturn:true}:{})}))});
    }
    if(request.method!=='POST')return authJson({error:'请求方式有误。'},405);
    if(!sameOrigin(request,env))return authJson({error:'请求来源不匹配。'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return authJson({error:'需要 JSON 请求。'},415);
    if(Number(request.headers.get('Content-Length'))>250000)return authJson({error:'请求过大。'},413);
    const raw=await request.text();
    if(raw.length>250000)return authJson({error:'请求过大。'},413);
    let b;try{b=JSON.parse(raw)}catch{return authJson({error:'无效请求。'},400)}
    if(typeof b?.id!=='string'||b.id.length!==36)return authJson({error:'编号无效。'},400);
    if(b.action==='send'||b.action==='sendSeed'){
      const seed=b.action==='sendSeed';
      const edge=await env.DB.prepare('SELECT * FROM garden_friends WHERE id=? AND accepted=1 AND (sender=? OR recipient=?)').bind(b.id,user.id,user.id).first();
      if(!edge)return authJson({error:'请先成为花友。'},403);
      const own=await giftGarden(env,user.id),source=seed?own.design.seeds.find(p=>GardenLayout.seedKey(p)===b.species):own.records.find(p=>p.uid===b.uid);
      if(!source)return authJson({error:seed?'请先养成母株并收种。':'这株植物已不在花园中。'},404);
      if(!await authQuota(request,env,'gift'))return authJson({error:'赠送太频繁，请稍后再试。'},429);
      const garden=await giftGarden(env,edge.sender===user.id?edge.recipient:edge.sender);
      if(garden.gifts.length>=24)return authJson({error:'对方的礼物盒已满。'},409);
      const sourceId=seed?GardenLayout.seedKey(source):source.uid,kind=seed?'seed':'cutting';
      if(garden.gifts.some(g=>g.sender===user.id&&g.source===sourceId&&(g.kind||'cutting')===kind))return authJson({error:'同一份礼物正在等待对方领取。'},409);
      const plant=sharedPlant(source);
      for(const key of ['slot','x','z','growth','generation'])delete plant[key];
      if(seed){plant.generation=Math.min(1000000,(source.generation??1)+1);plant.growth=0}
      garden.gifts.push({id:crypto.randomUUID(),from:user.name,sender:user.id,source:sourceId,kind,plant,...(b.wantsReturn===true?{wantsReturn:true}:{})});
      return saveGiftGarden(env,garden);
    }
    if(!['accept','decline'].includes(b.action))return authJson({error:'操作无效。'},400);
    const garden=await giftGarden(env,user.id),idx=garden.gifts.findIndex(g=>g.id===b.id);
    if(idx<0)return authJson({error:'这份礼物已经处理。'},409);
    const gift=garden.gifts[idx];
    if(b.action==='accept'){
      if(garden.records.length>=800)return authJson({error:'花园已满。'},409);
      if(!GardenLayout.zones.includes(b.zone)||typeof b.cover!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(b.cover))return authJson({error:'分株封面或位置无效。'},400);
      const p={...gift.plant,uid:crypto.randomUUID(),zone:b.zone,photo:b.cover,gift:true,date:new Date().toISOString().slice(0,10)};
      if(gift.kind==='seed')p.seedFrom=gift.from;
      Object.assign(p,GardenLayout.place(p,garden.records.concat(garden.design.decorations)));
      garden.records.push(p);
      garden.design.discovered=GardenLayout.discoveries([p],garden.design.discovered);
    }
    garden.gifts.splice(idx,1);
    return saveGiftGarden(env,garden);
  }catch{return authJson({error:'礼物盒暂不可用，请稍后重试。'},503)}
}
