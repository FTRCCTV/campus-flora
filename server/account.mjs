import {currentUser} from './auth.mjs';
import '../dist/layout.js';
import '../dist/profile.js';
import '../dist/specimen.js';
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
    if(p.growth!==undefined&&(!Number.isInteger(p.growth)||p.growth<0||p.growth>4))return false;
    if(p.care!==undefined){
      if(!p.care||typeof p.care!=='object'||Array.isArray(p.care)||Object.keys(p.care).some(k=>!['water','light'].includes(k)))return false;
      if((p.growth??2)>=3||!['water','light'].every(k=>Number.isInteger(p.care[k])&&p.care[k]>=0&&p.care[k]<=2))return false;
    }
    if(p.generation!==undefined&&(!Number.isSafeInteger(p.generation)||p.generation<1||p.generation>1000000))return false;
    if(p.seedFrom!==undefined&&(typeof p.seedFrom!=='string'||p.seedFrom.length>80))return false;
    if(p.palette!=null&&(typeof p.palette!=='object'||Array.isArray(p.palette)||Object.entries(p.palette).some(([k,v])=>!['leaf','bloom'].includes(k)||typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))))return false;
    if(p.model){
      const m=p.model;
      if(!['tree','shrub','flower','grass','rosette','herb'].includes(m.form)||
        ![m.leaf,m.bloom].every(c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c))||
        ![m.height,m.spread].every(n=>Number.isFinite(n)&&n>=.6&&n<=1.4)||
        (m.arrangement!=null&&!['alternate','opposite','whorled','basal'].includes(m.arrangement))||
        (m.inflorescence!=null&&!['solitary','cluster','spike','none'].includes(m.inflorescence))||
        (m.margin!=null&&!['smooth','toothed'].includes(m.margin))||
        (m.leafAspect!=null&&(!Number.isFinite(m.leafAspect)||m.leafAspect<.65||m.leafAspect>1.5))||
        (m.fact!=null&&(typeof m.fact!=='string'||m.fact.length>240))||
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
    if(!Array.isArray(design?.decorations)||design.decorations.length>300||design.decorations.some(p=>!p||typeof p!=='object'))return send({error:'装饰数据无效。'},400);
    const current=await env.BUCKET.get(objectKey);
    if((current?.httpEtag||'new')!==data.version)return send({error:'花园已有更新，请刷新后重试。'},409);
    const previous=current?await current.json():[];
    const oldGarden=GardenLayout.unpack(previous),history=oldGarden.design.discovered;
    const oldById=new Map(oldGarden.records.map(p=>[p.uid,p]));
    for(const p of data.records){
      const old=oldById.get(p.uid);
      if(!old||GardenLayout.seedKey(old)!==GardenLayout.seedKey(p))continue;
      if(p.growth===undefined&&old.growth!==undefined)p.growth=old.growth;
      if(p.growth!==undefined&&(p.growth<(old.growth??2)||p.growth>(old.growth??2)+1))return send({error:'养成进度已变化，请重新打开植株。'},409);
      if(p.care===undefined&&old.care&&(p.growth??2)===(old.growth??2))p.care=old.care;
      for(const field of ['generation','seedFrom'])if(old[field]!==undefined)p[field]=old[field];
    }
    // Earn discoveries from saved specimens. A client cannot award itself extra milestones.
    const normalized=GardenLayout.unpack({records:data.records,design:{...design,seeds:oldGarden.design.seeds,discovered:history}});
    data.records=normalized.records;design=normalized.design;
    if(!GardenLayout.valid(data.records,design))return send({error:'物品超出布置范围或彼此重叠，请重新摆放。'},400);
    // The inbox and garden share one version. Preserve unopened gifts on ordinary editor saves.
    const gifts=previous.gifts||[];
    const serialized=JSON.stringify({records:data.records,design:{scene:design.scene,weather:design.weather,effect:design.effect,seeds:design.seeds,discovered:design.discovered,decorations:design.decorations},gifts});
    if(new TextEncoder().encode(serialized).length>maxBytes)return send({error:'花园已超过同步容量。'},413);
    const condition=data.version==='new'?{'If-None-Match':'*'}:{'If-Match':data.version};
    const saved=await env.BUCKET.put(objectKey,serialized,{onlyIf:new Headers(condition),httpMetadata:{contentType:'application/json'}});
    if(!saved)return send({error:'另一台设备已更新花园。已请求最新记录，请重新操作。'},409);
    return send({version:saved.httpEtag,seeds:design.seeds,discovered:design.discovered});
  }catch{return send({error:'同步服务暂不可用，请稍后重试。'},503)}
}
