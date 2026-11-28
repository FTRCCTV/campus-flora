import test from 'node:test';
import assert from 'node:assert/strict';
import {nameKey} from '../server/auth.mjs';
import {accountGarden} from '../server/account.mjs';
import '../dist/layout.js';

const token='c'.repeat(64);
const encoder=new TextEncoder();
const sha256=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');

function bucket(){
  const map=new Map();let rev=0;
  return {
    map,
    get:async key=>{
      const entry=map.get(key);
      return entry?{httpEtag:entry.httpEtag,json:async()=>JSON.parse(entry.value)}:null;
    },
    put:async(key,value,options={})=>{
      const old=map.get(key),condition=options&&options.onlyIf;
      if(condition&&condition.has('If-None-Match')&&old)return null;
      if(condition&&condition.has('If-Match')&&old?.httpEtag!==condition.get('If-Match'))return null;
      const entry={httpEtag:'"'+(++rev).toString(16).padStart(32,'0')+'"',value};
      map.set(key,entry);
      return entry;
    },
    delete:async key=>{map.delete(key)}
  };
}
async function fixture(){
  const store=bucket(),env={BUCKET:store};
  const user={id:'flora-test',name:'测试用户'};
  await store.put(await nameKey('测试用户'),JSON.stringify({user}));
  await store.put('auth/sessions/'+await sha256(token),JSON.stringify({user,until:Date.now()+60000}));
  const call=(body)=>accountGarden(new Request('https://test/api/account',{
    method:body?'PUT':'GET',
    headers:{Origin:'https://test',Cookie:'__Host-flora_session='+token,...(body?{'content-type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined
  }),env);
  return {store,env,call,user};
}
const plant=(uid,overrides={})=>({
  uid,latin:'Bellis perennis',name:'雏菊',date:'2026-11-28',form:'flower',size:'small',zone:'sill',slot:0,
  photo:'data:image/jpeg;base64,AAAA',...overrides
});
const emptyDesign=()=>globalThis.GardenLayout.empty();

test('patchOps reports only changed records and removals',()=>{
  const first=plant('a'),second=plant('b'),extra=plant('c');
  assert.deepEqual(globalThis.GardenLayout.patchOps([first],[first]),{upserts:[],removes:[]});
  const edited={...first,slot:1};
  const ops=globalThis.GardenLayout.patchOps([first,second],[edited]);
  assert.equal(ops.upserts.length,1);
  assert.equal(ops.upserts[0].slot,1);
  assert.deepEqual(ops.removes,['b']);
  assert.equal(globalThis.GardenLayout.patchOps([],[extra]).upserts.length,1);
});

test('incremental patch appends, reorders, removes and keeps the garden version fresh',async()=>{
  const {call,user}=await fixture();
  const first=plant('u1');
  const created=await call({owner:user.id,version:'new',records:[first],design:emptyDesign()});
  assert.equal(created.status,200);
  const version=(await created.json()).version;
  assert.match(version,/^"[0-9a-f]{32}"$/);

  const second=plant('u2',{slot:1});
  const patched=await call({owner:user.id,version,patch:{upserts:[second],removes:[],order:['u2','u1'],design:emptyDesign()}});
  assert.equal(patched.status,200);
  const patchedVersion=(await patched.json()).version;
  assert.notEqual(patchedVersion,version);

  const read=await (await call()).json();
  assert.deepEqual(read.records.map(record=>record.uid),['u2','u1']);
  assert.equal(read.version,patchedVersion);

  // A patch built on the previous version must fail instead of silently merging.
  const stale=await call({owner:user.id,version,patch:{upserts:[plant('u3',{slot:2})],removes:[]}});
  assert.equal(stale.status,409);

  const removed=await call({owner:user.id,version:patchedVersion,patch:{upserts:[],removes:['u1']}});
  assert.equal(removed.status,200);
  const afterRemove=await (await call()).json();
  assert.deepEqual(afterRemove.records.map(record=>record.uid),['u2']);
});

test('a new member can plant their first specimen using the browser patch format',async()=>{
  const {call,user}=await fixture();
  const saved=await call({owner:user.id,version:'new',patch:{upserts:[plant('first')],removes:[],order:['first']}});
  assert.equal(saved.status,200);
  assert.deepEqual((await (await call()).json()).records.map(p=>p.uid),['first']);
});

test('offline replay preserves other devices’ additions and avoids same-plant conflicts',()=>{
  const a=plant('a'),b=plant('b',{slot:1}),edit={...a,location:'花坛'};
  const design=emptyDesign(),patch={upserts:[edit],removes:[],order:['a'],design};
  const pending=GardenLayout.prepareGardenReplay([a],design,patch);
  const cloud={records:[b,a],design:{...design,weather:'rain'}};
  const replay=GardenLayout.rebaseGardenReplay(pending,cloud);
  assert.deepEqual(replay.order,['b','a']);assert.deepEqual(replay.removes,[]);
  assert.deepEqual(replay.upserts,[edit]);assert.equal(replay.design.weather,'rain');
  assert.equal(GardenLayout.rebaseGardenReplay(pending,{...cloud,records:[b,{...a,location:'温室'}]}),null);
  assert.equal(GardenLayout.rebaseGardenReplay(pending,{...cloud,records:[b]}),null);
  assert.equal(GardenLayout.rebaseGardenReplay({records:[a],design},cloud),null);
});

test('malformed incremental payloads are rejected',async()=>{
  const {call,user}=await fixture();
  const created=await call({owner:user.id,version:'new',records:[plant('u1')],design:emptyDesign()});
  const version=(await created.json()).version;
  const cases=[
    {owner:user.id,version,patch:{upserts:'nope',removes:[]}},
    {owner:user.id,version,patch:{upserts:[{}],removes:[]}},
    {owner:user.id,version,patch:{upserts:[],removes:[42]}},
    {owner:user.id,version,patch:{upserts:[],removes:[],order:'u1'}}
  ];
  for(const body of cases){
    const response=await call(body);
    assert.equal(response.status,400);
  }
});

test('legacy full-document saves still work and unknown spot ids are rejected',async()=>{
  const {call,user}=await fixture();
  const tagged=plant('u1',{spot:'library',spotName:'图书馆东侧'});
  const created=await call({owner:user.id,version:'new',records:[tagged],design:emptyDesign()});
  assert.equal(created.status,200);
  const version=(await created.json()).version;

  const badSpot=plant('u2',{slot:1,spot:'Bad Id'});
  const rejected=await call({owner:user.id,version,records:[tagged,badSpot],design:emptyDesign()});
  assert.equal(rejected.status,400);

  const good=plant('u3',{slot:2,spot:'lake',spotName:'湖畔步道'});
  const saved=await call({owner:user.id,version,records:[tagged,good],design:emptyDesign()});
  assert.equal(saved.status,200);
  const read=await (await call()).json();
  assert.equal(read.records.find(record=>record.uid==='u3').spot,'lake');
});
