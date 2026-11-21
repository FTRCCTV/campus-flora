import {currentUser} from './auth.mjs';
import '../dist/layout.js';
function checkGarden(items){
  if(!Array.isArray(items)||items.length>800)return false;
  const ids=new Set();
  for(const p of items){
    if(!p||typeof p!=='object')return false;
    for(const field of ['uid','latin','name','date']){
      if(typeof p[field]!=='string'||!p[field].length||p[field].length>400)return false;
    }
    for(const field of ['location','family','note']){
      if(p[field]!=null&&(typeof p[field]!=='string'||p[field].length>2000))return false;
    }
    if(p.model){
      const m=p.model;
      if(!['tree','shrub','flower','grass','rosette','herb'].includes(m.form)||
        ![m.leaf,m.bloom].every(c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c))||
        ![m.height,m.spread].every(n=>Number.isFinite(n)&&n>=.6&&n<=1.4)||
        !Number.isInteger(m.count)||m.count<3||m.count>14||
        (m.petals!=null&&(!Number.isInteger(m.petals)||m.petals<0||m.petals>24)))return false;
    }
    if(!['tree','shrub','flower','grass','rosette','herb'].includes(p.form)||
      !['small','medium','large'].includes(p.size)||!['sill','bench','shelf','pond','path','meadow'].includes(p.zone)||
      typeof p.photo!=='string'||
      !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(p.photo))return false;
    if(ids.has(p.uid))return false;
    ids.add(p.uid);
  }
  return true;
}
export async function accountGarden(request,env){
  const send=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  const method=request.method;
  if(!['GET','PUT'].includes(method))return send({error:'method'},405);
  try{
    const user=await currentUser(request,env);
    if(!user)return method==='GET'?send({user:null}):send({error:'请先登录账号。'},401);
    const objectKey='gardens/v1/'+encodeURIComponent(user.id)+'.json';
    if(method==='GET'){
      const object=await env.BUCKET.get(objectKey);
      return send({user,version:object?.httpEtag||'new',...GardenLayout.unpack(object?await object.json():[])});
    }
    if(request.headers.get('Origin')!==new URL(request.url).origin)return send({error:'请求来源不匹配。'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return send({error:'需要 JSON 请求。'},415);
    const maxBytes=16*1024*1024;
    if(Number(request.headers.get('content-length'))>maxBytes)return send({error:'花园已超过同步容量。'},413);
    const buffer=await request.arrayBuffer();
    if(buffer.byteLength>maxBytes)return send({error:'花园已超过同步容量。'},413);
    let data;try{data=JSON.parse(new TextDecoder().decode(buffer))}catch{return send({error:'数据格式有误。'},400)}
    if(data?.owner!==user.id)return send({error:'账号已切换，请刷新后重试。'},409);
    if(!checkGarden(data.records)||typeof data.version!=='string'||!(/^(new|"[a-f0-9]{32}")$/i.test(data.version)))return send({error:'花园数据或版本无效。'},400);
    let design=data.design;
    if(design===undefined){
      const old=await env.BUCKET.get(objectKey);
      if(old&&!Array.isArray(await old.json()))return send({error:'请刷新页面，载入新版自由布局。'},409);
      design=GardenLayout.empty();
    }
    if(!GardenLayout.valid(data.records,design))return send({error:'物品超出布置范围或彼此重叠，请重新摆放。'},400);
    const condition=data.version==='new'?{'If-None-Match':'*'}:{'If-Match':data.version};
    const saved=await env.BUCKET.put(objectKey,JSON.stringify({records:data.records,design:{scene:design.scene,weather:design.weather,decorations:design.decorations}}),{onlyIf:new Headers(condition),httpMetadata:{contentType:'application/json'}});
    if(!saved)return send({error:'另一台设备已更新花园。已请求最新记录，请重新操作。'},409);
    return send({version:saved.httpEtag});
  }catch{return send({error:'同步服务暂不可用，请稍后重试。'},503)}
}
