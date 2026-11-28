const sessionName='__Host-flora_session';
export {authJson,nameKey,authQuota};
const sessionSeconds=30*86400;
const defaultPasswordRounds=100000;
const maxPasswordRounds=1000000;
const loginFailureLimit=8,loginFailureWindowMs=15*60*1000;
const encoder=new TextEncoder();
const ipPattern=/^[0-9a-fA-F:.]{3,45}$/;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const randomKey=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const keyHash=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const cookie=(name,value,seconds)=>name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+seconds;
const readCookie=(req,name)=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
function authJson(data,status=200,headers={}){
  return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie',...headers}});
}
// An address is only trusted when it looks like one; anything else shares the
// 'unknown' bucket instead of collapsing every caller into one bad header value.
export function clientIp(request){
  const raw=request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||(request.headers.get('x-forwarded-for')||'').split(',')[0];
  const address=(raw||'').trim();
  return ipPattern.test(address)?address:'unknown';
}
// Accept the request's own origin plus anything listed in PUBLIC_ORIGIN, so a
// reverse proxy that rewrites Host does not tempt anyone to delete this check.
export function sameOrigin(request,env){
  const origin=request.headers.get('Origin');
  if(!origin)return false;
  if(origin===new URL(request.url).origin)return true;
  return String(env?.PUBLIC_ORIGIN||'').split(',').map(value=>value.trim()).filter(Boolean).includes(origin);
}
const nameKey=async name=>'auth/names/'+await keyHash(name.toLowerCase());
async function sessionKey(request){
  const token=readCookie(request,sessionName);
  return /^[a-f0-9]{64}$/.test(token)?'auth/sessions/'+await keyHash(token):null;
}
export async function currentUser(request,env){
  const key=await sessionKey(request);
  if(!key)return null;
  const item=await env.BUCKET.get(key);
  if(!item)return null;
  const session=await item.json();
  if(session.until<=Date.now()){await env.BUCKET.delete(key);return null}
  const obj=await env.BUCKET.get(await nameKey(session.user.name));
  if(!obj)return null;
  const account=await obj.json();
  if(account.user.id!==session.user.id||account.revision!==session.revision)return null;
  return account.user;
}
async function startSession(user,env,revision){
  const token=randomKey();
  await env.BUCKET.put('auth/sessions/'+await keyHash(token),JSON.stringify({user,revision,until:Date.now()+sessionSeconds*1000}));
  return cookie(sessionName,token,sessionSeconds);
}
// Raising PASSWORD_ROUNDS upgrades accounts on their next successful login;
// lowering or removing it never locks anybody out, because the rounds used for a
// record are stored next to its digest.
const passwordRounds=env=>{
  const value=Number(env?.PASSWORD_ROUNDS);
  return Number.isInteger(value)&&value>=defaultPasswordRounds&&value<=maxPasswordRounds?value:defaultPasswordRounds;
};
async function passwordKey(password,salt,rounds=defaultPasswordRounds){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:rounds},key,256));
}
async function counter(env,key){
  const object=await env.BUCKET.get(key);
  if(!object)return null;
  try{return await object.json()}catch{return null}
}
async function increment(env,key,limit,windowMs){
  const now=Date.now();
  for(let attempt=0;attempt<4;attempt++){
    const object=await env.BUCKET.get(key);
    const current=object?await object.json():null;
    if(current&&Number.isInteger(current.n)&&current.n>=limit&&current.until>now)return {allowed:false,count:current.n};
    const next=!current||current.until<=now?{until:now+windowMs,n:0}:current;
    next.n++;
    const onlyIf=new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'});
    if(await env.BUCKET.put(key,JSON.stringify(next),{onlyIf}))return {allowed:true,count:next.n};
  }
  return {allowed:false,count:limit};
}
async function authQuota(req,env,action){
  const limit=action==='register'?12:45;
  return (await increment(env,'auth/quota/'+await keyHash(clientIp(req)+'|'+action),limit,10*60*1000)).allowed;
}
async function credentials(request,env,action){
  if(!request.headers.get('content-type')?.startsWith('application/json'))return authJson({error:'请求格式无效。'},415);
  if(!await authQuota(request,env,action))return authJson({error:'操作较频繁，请十分钟后再试。'},429);
  if(Number(request.headers.get('content-length'))>4096)return authJson({error:'输入过长。'},413);
  const body=await request.text();
  if(body.length>4096)return authJson({error:'输入过长。'},413);
  let input;try{input=JSON.parse(body)}catch{return authJson({error:'输入格式有误。'},400)}
  const owner=action==='password'?await currentUser(request,env):null;
  if(action==='password'&&!owner)return authJson({error:'请重新登录后修改密码。'},401);
  const name=owner?owner.name:typeof input?.name==='string'?input.name.trim().normalize('NFKC'):'';
  const password=input?.password;
  if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(name)||typeof password!=='string'||password.length<8||password.length>128)
    return authJson({error:'用户名需为 2–24 个文字、数字、下划线或短横线，密码需为 8–128 个字符。'},400);
  const key=await nameKey(name);
  let user,revision;
  if(action==='register'){
    // One global daily ceiling keeps account creation from being used as free storage.
    const daily=Number(env?.REGISTER_DAILY_LIMIT)>0?Number(env.REGISTER_DAILY_LIMIT):200;
    if(!(await increment(env,'auth/register/global',daily,24*60*60*1000)).allowed)
      return authJson({error:'今天的注册名额已满，请明天再试。'},429);
    const rounds=passwordRounds(env),salt=randomKey(),digest=await passwordKey(password,salt,rounds);
    user={id:'flora-'+crypto.randomUUID(),name};
    const ok=await env.BUCKET.put(key,JSON.stringify({user,salt,digest,rounds}),{onlyIf:new Headers({'If-None-Match':'*'})});
    if(!ok)return authJson({error:'这个用户名已有人使用。'},409);
  }else{
    const lockName='auth/locks/'+await keyHash(name.toLowerCase());
    const lock=await counter(env,lockName);
    if(lock&&lock.until>Date.now()&&lock.n>=loginFailureLimit)
      return authJson({error:'密码尝试次数过多，请十五分钟后再试。'},429);
    const obj=await env.BUCKET.get(key),record=obj?await obj.json():null;
    const recordRounds=Number.isInteger(record?.rounds)&&record.rounds>=10000?record.rounds:defaultPasswordRounds;
    const digest=await passwordKey(password,record?.salt||'unregistered',recordRounds);
    let difference=0;
    const expected=record?.digest||'0'.repeat(64);
    for(let i=0;i<64;i++)difference|=digest.charCodeAt(i)^expected.charCodeAt(i);
    if(!record||difference){
      await increment(env,lockName,loginFailureLimit,loginFailureWindowMs);
      return authJson({error:'用户名或密码有误。'},401);
    }
    user=record.user;revision=record.revision;
    await env.BUCKET.delete(lockName);
    if(action==='password'){
      const next=input.newPassword;
      if(typeof next!=='string'||next.length<8||next.length>128||next===password)
        return authJson({error:'请输入与当前密码不同的 8–128 位新密码。'},400);
      const rounds=passwordRounds(env),salt=randomKey(),hash=await passwordKey(next,salt,rounds);
      revision=crypto.randomUUID();
      const saved=await env.BUCKET.put(key,JSON.stringify({user,salt,digest:hash,rounds,revision}),{onlyIf:new Headers({'If-Match':obj.httpEtag})});
      if(!saved)return authJson({error:'密码已在其他设备修改，请重新登录。'},409);
    }else if(recordRounds<passwordRounds(env)){
      // Best-effort upgrade after a successful login; a lost race just means the
      // old record stays valid and the next login retries.
      const rounds=passwordRounds(env),salt=randomKey(),hash=await passwordKey(password,salt,rounds);
      try{await env.BUCKET.put(key,JSON.stringify({user,salt,digest:hash,rounds,revision}),{onlyIf:new Headers({'If-Match':obj.httpEtag})})}catch{}
    }
  }
  return authJson({ok:true},200,{'Set-Cookie':await startSession(user,env,revision)});
}
export async function publicAuth(request,env,path){
  try{
    // The legacy "import the previous platform account" path used to trust
    // oai-authenticated-user-id, a plain request header, to choose whose garden
    // to read. It is retired: nothing here may name another account's object.
    if(!['login','register','logout','password'].includes(path))return authJson({error:'接口不存在。'},404);
    if(request.method!=='POST')return authJson({error:'需要 POST 请求。'},405);
    if(!sameOrigin(request,env))return authJson({error:'请求来源不匹配。'},403);
    if(path==='logout'){
      const key=await sessionKey(request);
      if(key)await env.BUCKET.delete(key);
      return authJson({ok:true},200,{'Set-Cookie':cookie(sessionName,'',0)});
    }
    return await credentials(request,env,path);
  }catch{return authJson({error:'账号服务暂不可用，请稍后再试。'},503)}
}
