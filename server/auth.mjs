const sessionName='__Host-flora_session';
export {authJson,nameKey,authQuota};
const sessionSeconds=30*86400;
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const randomKey=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const keyHash=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const cookie=(name,value,seconds)=>name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+seconds;
const readCookie=(req,name)=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
function authJson(data,status=200,headers={}){
  return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie',...headers}});
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
async function passwordKey(password,salt){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));
}
async function authQuota(req,env,action){
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  const key='auth/quota/'+await keyHash(ip+'|'+action);
  const now=Date.now(),limit=action==='register'?12:45;
  for(let i=0;i<4;i++){
    const obj=await env.BUCKET.get(key);
    let count=obj?await obj.json():null;
    if(!count||count.until<=now)count={until:now+600000,n:0};
    if(count.n>=limit)return false;
    count.n++;
    const ok=await env.BUCKET.put(key,JSON.stringify(count),{onlyIf:new Headers(obj?{'If-Match':obj.httpEtag}:{'If-None-Match':'*'})});
    if(ok)return true;
  }
  return false;
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
    const salt=randomKey(),digest=await passwordKey(password,salt);
    user={id:'flora-'+crypto.randomUUID(),name};
    const ok=await env.BUCKET.put(key,JSON.stringify({user,salt,digest}),{onlyIf:new Headers({'If-None-Match':'*'})});
    if(!ok)return authJson({error:'这个用户名已有人使用。'},409);
  }else{
    const obj=await env.BUCKET.get(key),record=obj?await obj.json():null;
    const digest=await passwordKey(password,record?.salt||'unregistered');
    let difference=0;
    const expected=record?.digest||'0'.repeat(64);
    for(let i=0;i<64;i++)difference|=digest.charCodeAt(i)^expected.charCodeAt(i);
    if(!record||difference)return authJson({error:'用户名或密码有误。'},401);
    user=record.user;revision=record.revision;
    if(action==='password'){
      const next=input.newPassword;
      if(typeof next!=='string'||next.length<8||next.length>128||next===password)
        return authJson({error:'请输入与当前密码不同的 8–128 位新密码。'},400);
      const salt=randomKey(),digest=await passwordKey(next,salt);
      revision=crypto.randomUUID();
      const saved=await env.BUCKET.put(key,JSON.stringify({user,salt,digest,revision}),{onlyIf:new Headers({'If-Match':obj.httpEtag})});
      if(!saved)return authJson({error:'密码已在其他设备修改，请重新登录。'},409);
    }
  }
  return authJson({ok:true},200,{'Set-Cookie':await startSession(user,env,revision)});
}
export async function publicAuth(request,env,path){
  try{
    if(path==='previous-garden'){
      if(!['GET','HEAD'].includes(request.method))return authJson({error:'请求方式有误。'},405);
      const priorId=request.headers.get('oai-authenticated-user-id');
      if(!new URL(request.url).hostname.endsWith('.chatgpt.site')||!priorId||
         !request.headers.get('oai-authenticated-user-email')||!await currentUser(request,env))return authJson({},404);
      const key='gardens/v1/'+encodeURIComponent(priorId)+'.json';
      if(request.method==='HEAD'){
        const exists=await env.BUCKET.head(key);
        return new Response(null,{status:exists?200:404,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
      }
      const prior=await env.BUCKET.get(key);
      return prior?authJson({records:await prior.json()}):authJson({},404);
    }
    if(!['login','register','logout','password'].includes(path))return authJson({error:'接口不存在。'},404);
    if(request.method!=='POST')return authJson({error:'需要 POST 请求。'},405);
    if(request.headers.get('Origin')!==new URL(request.url).origin)return authJson({error:'请求来源不匹配。'},403);
    if(path==='logout'){
      const key=await sessionKey(request);
      if(key)await env.BUCKET.delete(key);
      return authJson({ok:true},200,{'Set-Cookie':cookie(sessionName,'',0)});
    }
    return await credentials(request,env,path);
  }catch{return authJson({error:'账号服务暂不可用，请稍后再试。'},503)}
}
