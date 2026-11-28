import {currentUser,authJson,nameKey,authQuota,sameOrigin} from './auth.mjs';

const displayFields=['name','latin','family','form','size','zone','slot','x','z','rotation','potStyle','potSticker','plantCharm','growth','generation'];
const modelFields=['form','leaf','bloom','height','spread','count','leafShape','crownShape','petals','arrangement','inflorescence','leafAspect','margin','profileVersion','fact'];
// Guestbook comments live next to the friendship edge rather than the garden, so
// they survive layout changes and can be shared by both friends.
const commentMaxText=200,commentStored=100,commentPage=50,commentQuota=20,commentWindowMs=10*60*1000;
const commentKey=id=>'social/comments/v1/'+encodeURIComponent(id)+'.json';
const commentQuotaKey=id=>'social/comments/quota/'+encodeURIComponent(id);
async function readComments(env,id){
  const object=await env.BUCKET.get(commentKey(id));
  if(!object)return {object:null,list:[]};
  let list=[];
  try{const data=await object.json();if(Array.isArray(data))list=data}catch{}
  return {object,list};
}
// Same compare-and-swap shape as the auth counters: the window and count travel
// in one object so a retried write can never spend quota twice.
async function takeCommentQuota(env,id){
  const key=commentQuotaKey(id),now=Date.now();
  for(let attempt=0;attempt<4;attempt++){
    const object=await env.BUCKET.get(key);
    let current=null;
    if(object){try{current=await object.json()}catch{current=null}}
    if(current&&Number.isInteger(current.n)&&current.n>=commentQuota&&current.until>now)return false;
    const next=!current||current.until<=now?{until:now+commentWindowMs,n:0}:current;
    next.n++;
    const onlyIf=new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'});
    if(await env.BUCKET.put(key,JSON.stringify(next),{onlyIf}))return true;
  }
  return false;
}
export function sharedPlant(plant){
  const entry=Object.fromEntries(displayFields.filter(k=>['string','number'].includes(typeof plant[k])).map(k=>[k,plant[k]]));
  if(plant.palette)entry.palette=Object.fromEntries(['leaf','bloom'].filter(k=>/^#[0-9a-f]{6}$/i.test(plant.palette[k])).map(k=>[k,plant.palette[k]]));
  if(plant.model)entry.model=Object.fromEntries(modelFields.filter(k=>['string','number'].includes(typeof plant.model[k])).map(k=>[k,plant.model[k]]));
  return entry;
}
export async function friendsApi(request,env){
  try{
    const user=await currentUser(request,env);
    if(!user)return authJson({error:'请先登录植迹账号。'},401);
    const db=env.DB,url=new URL(request.url);
    if(request.method==='GET'){
      if(url.searchParams.has('visit')){
        const id=url.searchParams.get('visit');
        const edge=await db.prepare('SELECT * FROM garden_friends WHERE id=? AND accepted=1 AND (sender=? OR recipient=?)').bind(id,user.id,user.id).first();
        if(!edge)return authJson({error:'当前无法访问这座花园。'},403);
        const outgoing=edge.sender===user.id,peer=outgoing?edge.recipient:edge.sender;
        const garden=await env.BUCKET.get('gardens/v1/'+encodeURIComponent(peer)+'.json');
        const {records,design}=GardenLayout.unpack(garden?await garden.json():[]);
        return authJson({name:outgoing?edge.recipient_name:edge.sender_name,plants:records.map(sharedPlant),design:{scene:design.scene,weather:design.weather,effect:design.effect,decorations:design.decorations}});
      }
      if(url.searchParams.has('comments')){
        const id=url.searchParams.get('comments');
        if(!id||id.length>80)return authJson({error:'留言对象无效。'},400);
        const edge=await db.prepare('SELECT * FROM garden_friends WHERE id=? AND accepted=1 AND (sender=? OR recipient=?)').bind(id,user.id,user.id).first();
        if(!edge)return authJson({error:'只有花友才能查看这座花园的留言。'},403);
        const {list}=await readComments(env,id);
        return authJson({comments:list.slice(0,commentPage).map(c=>({id:c.id,fromName:c.fromName,text:c.text,date:c.date,own:c.fromId===user.id}))});
      }
      const {results}=await db.prepare('SELECT * FROM garden_friends WHERE sender=? OR recipient=? ORDER BY rowid DESC').bind(user.id,user.id).all();
      return authJson({people:results.map(edge=>{
        const outgoing=edge.sender===user.id;
        return {id:edge.id,name:outgoing?edge.recipient_name:edge.sender_name,status:edge.accepted?'friends':outgoing?'sent':'received'};
      })});
    }
    if(request.method!=='POST')return authJson({error:'请求方式有误。'},405);
    if(!sameOrigin(request,env))return authJson({error:'请求来源不匹配。'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return authJson({error:'需要 JSON 请求。'},415);
    if(Number(request.headers.get('content-length'))>1024)return authJson({error:'请求过长。'},413);
    const body=await request.json().catch(()=>null);
    if(body?.action==='request'){
      const name=typeof body.name==='string'?body.name.trim().normalize('NFKC'):'';
      if(!name||name.length>48)return authJson({error:'请输入好友的完整用户名。'},400);
      if(!await authQuota(request,env,'friend-request'))return authJson({error:'申请太频繁，请稍后再试。'},429);
      const object=await env.BUCKET.get(await nameKey(name)),peer=object?(await object.json()).user:null;
      if(!peer)return authJson({error:'未找到这个用户名。'},404);
      if(peer.id===user.id)return authJson({error:'这是你自己的账号。'},400);
      const result=await db.prepare('INSERT INTO garden_friends(id,sender,recipient,sender_name,recipient_name) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),user.id,peer.id,user.name,peer.name).run();
      if(!result.meta.changes)return authJson({error:'已有好友关系或申请，请查看列表。'},409);
      return authJson({ok:true},201);
    }
    if(body?.action==='comment'){
      const id=body.id;
      if(typeof id!=='string'||!id||id.length>80)return authJson({error:'留言对象无效。'},400);
      const edge=await db.prepare('SELECT * FROM garden_friends WHERE id=? AND accepted=1 AND (sender=? OR recipient=?)').bind(id,user.id,user.id).first();
      if(!edge)return authJson({error:'只有花友才能留言。'},403);
      const text=typeof body.text==='string'?body.text.trim():'';
      if(!text)return authJson({error:'请写一句留言再发送。'},400);
      if(text.length>commentMaxText)return authJson({error:'留言最多 200 字。'},400);
      if(!await takeCommentQuota(env,user.id))return authJson({error:'留言太频繁，请十分钟后再试。'},429);
      const entry={id:crypto.randomUUID(),fromId:user.id,fromName:user.name,text,date:new Date().toISOString()};
      for(let attempt=0;attempt<4;attempt++){
        const {object,list}=await readComments(env,id);
        const next=[entry,...list].slice(0,commentStored);
        const saved=await env.BUCKET.put(commentKey(id),JSON.stringify(next),{onlyIf:new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'})});
        if(saved)return authJson({ok:true});
      }
      return authJson({error:'留言区刚有更新，请重试。'},409);
    }
    if(typeof body?.id!=='string'||body.id.length!==36)return authJson({error:'申请无效。'},400);
    const mutations={
      accept:'UPDATE garden_friends SET accepted=1 WHERE id=? AND recipient=? AND accepted=0',
      decline:'DELETE FROM garden_friends WHERE id=? AND recipient=? AND accepted=0',
      cancel:'DELETE FROM garden_friends WHERE id=? AND sender=? AND accepted=0',
      remove:'DELETE FROM garden_friends WHERE id=? AND ? IN (sender,recipient) AND accepted=1'
    };
    if(!Object.hasOwn(mutations,body.action))return authJson({error:'操作无效。'},400);
    const result=await db.prepare(mutations[body.action]).bind(body.id,user.id).run();
    return result.meta.changes?authJson({ok:true}):authJson({error:'关系已变更，请刷新列表。'},409);
  }catch{return authJson({error:'好友服务暂不可用，请稍后重试。'},503)}
}
