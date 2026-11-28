import {currentUser,authJson,sameOrigin} from '../server/auth.mjs';
import {accountGarden} from '../server/account.mjs';
const chunkSize=2*1024*1024;
export async function readGarden(request,env){
  const response=await accountGarden(request,env);
  if(!response.ok)return response;
  const bytes=new Uint8Array(await response.arrayBuffer()),url=new URL(request.url),part=Number(url.searchParams.get('part')||0);
  if(!Number.isInteger(part)||part<0||part>8)return authJson({error:'无效的花园分段。'},400);
  if(bytes.length<=chunkSize&&part===0)return new Response(bytes,{headers:response.headers});
  const {version}=JSON.parse(new TextDecoder().decode(bytes)),count=Math.ceil(bytes.length/chunkSize);
  if(part&&(version!==url.searchParams.get('version')||part>=count))return authJson({error:'花园已更新，请重新加载。'},409);
  return new Response(bytes.subarray(part*chunkSize,(part+1)*chunkSize),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie','Content-Type':'application/octet-stream','X-Flora-Parts':String(count),'X-Flora-Version':version}});
}
export async function uploadGarden(request,env){
  const url=new URL(request.url);
  if(!sameOrigin(request,env))return authJson({error:'请求来源不匹配。'},403);
  const user=await currentUser(request,env);
  if(!user)return authJson({error:'请先登录账号。'},401);
  const transfer=url.searchParams.get('transfer');
  if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(transfer))return authJson({error:'无效的同步编号。'},400);
  if(request.method==='PUT'){
    const part=Number(url.searchParams.get('part'));
    if(!Number.isInteger(part)||part<0||part>7)return authJson({error:'无效的分段。'},400);
    const bytes=Buffer.from(await request.arrayBuffer());
    if(!bytes.length||bytes.length>chunkSize)return authJson({error:'分段大小有误。'},413);
    if(part===0)await env.query('DELETE FROM flora_upload_parts WHERE expires_at<=now()');
    await env.query(`INSERT INTO flora_upload_parts(owner,part,transfer,content,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '10 minutes')
      ON CONFLICT(owner,part) DO UPDATE SET transfer=excluded.transfer,content=excluded.content,expires_at=excluded.expires_at`,
      [user.id,part,transfer,bytes]);
    return authJson({ok:true});
  }
  if(request.method!=='POST')return authJson({error:'method'},405);
  const count=Number(url.searchParams.get('count'));
  if(!Number.isInteger(count)||count<1||count>8)return authJson({error:'无效的分段数量。'},400);
  const {rows}=await env.query('SELECT part,content FROM flora_upload_parts WHERE owner=$1 AND transfer=$2 AND expires_at>now() ORDER BY part',[user.id,transfer]);
  if(rows.length!==count||rows.some((r,i)=>r.part!==i))return authJson({error:'同步已过期或被其他设备中断，请重试。'},409);
  const headers=new Headers(request.headers);headers.delete('Content-Length');headers.set('Content-Type','application/json');
  const result=await accountGarden(new Request(new URL('/api/account',url),{method:'PUT',headers,body:Buffer.concat(rows.map(r=>r.content))}),env);
  if(result.ok)await env.query('DELETE FROM flora_upload_parts WHERE owner=$1 AND transfer=$2',[user.id,transfer]);
  return result;
}
