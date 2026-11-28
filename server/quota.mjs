import {clientIp,currentUser} from './auth.mjs';

// Cost guard for the endpoints that call paid upstreams (Pl@ntNet, DeepSeek).
// Counters live in the same key-value store as sessions and use the same
// conditional-write contract, so they work on R2 and on hosts that emulate it.
// clientIp is shared with the auth layer so both limits believe the same address.
const defaultWindowMs=10*60*1000;

export async function takeQuota(env,key,limit,{windowMs=defaultWindowMs}={}){
  const bucket=env?.BUCKET;
  if(!bucket||!Number.isFinite(limit)||limit<=0)return true;
  const storeKey='quota/v1/'+key,now=Date.now();
  for(let attempt=0;attempt<4;attempt++){
    const object=await bucket.get(storeKey);
    const current=object?await object.json():null;
    const counter=!current||typeof current.n!=='number'||current.until<=now?{until:now+windowMs,n:0}:current;
    if(counter.n>=limit)return false;
    counter.n++;
    const onlyIf=new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'});
    if(await bucket.put(storeKey,JSON.stringify(counter),{onlyIf}))return true;
  }
  return false;
}

// Members are counted per account, anonymous visitors per address, and every
// call also passes one global ceiling so rotating addresses cannot drain a key.
export async function guard(request,env,{name,anonymousLimit,memberLimit,globalLimit}){
  if(!env?.BUCKET)return {ok:true,user:null};
  if(globalLimit&&!await takeQuota(env,'api/'+name+'/global',globalLimit))return {ok:false,user:null};
  let user=null;
  try{user=await currentUser(request,env)}catch{}
  const scope=user?'u:'+user.id:'ip:'+clientIp(request);
  const limit=user?memberLimit:anonymousLimit;
  return {ok:await takeQuota(env,'api/'+name+'/'+scope,limit),user};
}
