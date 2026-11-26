import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

function gardenService(){
  const values=new Map(),users=['alice','bob'],tokens=['a'.repeat(64),'b'.repeat(64)];
  let serial=0,accepted=true;
  const place=(key,data)=>{const obj={httpEtag:'"'+(++serial).toString(16).padStart(32,'0')+'"',json:async()=>structuredClone(data)};values.set(key,obj);return obj};
  const env={BUCKET:{get:async key=>values.get(key),put:async(key,text,{onlyIf})=>{
    const old=values.get(key);
    if(onlyIf.get('If-Match')&&onlyIf.get('If-Match')!==old?.httpEtag||onlyIf.get('If-None-Match')&&old)return null;
    return place(key,JSON.parse(text));
  }},DB:{prepare:()=>({bind:()=>({first:async()=>accepted?{sender:'alice',recipient:'bob'}:null})})}};
  const call=async(path,who,method,body)=>{
    const response=await worker.fetch(new Request('https://garden.example/api/'+path,{method,
      headers:{Cookie:'__Host-flora_session='+tokens[who],Origin:'https://garden.example','Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{})}),env);
    return {status:response.status,...await response.json()};
  };
  return {place,users,tokens,call,setFriend:value=>{accepted=value}};
}
const sha=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');

test('a legacy plant matures, leaves a reusable seed variety and gives a friend exactly one next-generation seedling',async()=>{
  const g=gardenService();
  for(const [i,name] of g.users.entries()){
    const user={id:name,name};g.place('auth/names/'+await sha(name),{user,revision:1});
    g.place('auth/sessions/'+await sha(g.tokens[i]),{user,revision:1,until:Date.now()+60000});
  }
  const parent={uid:'parent',name:'雏菊',latin:'Bellis perennis',date:'2026',form:'flower',size:'small',zone:'sill',x:0,z:0,photo:'data:image/jpeg;base64,YQ=='};
  g.place('gardens/v1/alice.json',[parent]);
  const get=who=>g.call('account',who,'GET'),gift=(who,body)=>g.call('gifts',who,'POST',body);
  const put=(state,records)=>g.call('account',0,'PUT',{owner:'alice',version:state.version,records,design:state.design});
  const send={action:'sendSeed',id:'1'.repeat(36),species:'bellis perennis'};
  assert.equal((await gift(0,send)).status,404);
  assert.equal((await put(await get(0),[{...parent,growth:4}])).status,409);
  for(const growth of [3,4])assert.equal((await put(await get(0),[{...parent,growth}])).status,200);
  const mature=await get(0);
  assert.equal(mature.design.seeds[0].generation,1);
  assert.equal((await put(mature,[])).status,200);
  g.setFriend(false);assert.equal((await gift(0,send)).status,403);g.setFriend(true);
  assert.equal((await gift(0,send)).status,200);assert.equal((await gift(0,send)).status,409);
  const [{id,kind,plant}]=(await g.call('gifts',1,'GET')).gifts;
  assert.equal(kind,'seed');assert.equal(plant.generation,2);assert.equal(plant.photo,undefined);
  assert.equal((await get(1)).records.length,0);
  const accept={action:'accept',id,zone:'path',cover:parent.photo};
  assert.equal((await gift(1,accept)).status,200);assert.equal((await gift(1,accept)).status,409);
  const bob=await get(1);assert.equal(bob.records.length,1);assert.equal(bob.records[0].growth,0);
  assert.equal(bob.records[0].seedFrom,'alice');assert.equal(bob.records[0].generation,2);
  assert.equal(bob.design.discovered.length,1);assert.equal((await get(0)).design.seeds.length,1);
});
