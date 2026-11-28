import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/profile.js';
import '../dist/duel-rules.js';
import {clientIp, guard, takeQuota} from '../server/quota.mjs';
import {identify} from '../server/identify.mjs';
import {modelPlant} from '../server/model.mjs';
import {duelFaction} from '../server/duel.mjs';

function bucket(){
  const map=new Map();let rev=0;
  return {
    get:async key=>{
      const entry=map.get(key);
      return entry?{httpEtag:entry.httpEtag,json:async()=>JSON.parse(entry.value)}:null;
    },
    put:async(key,value,options={})=>{
      const old=map.get(key),condition=options&&options.onlyIf;
      if(condition&&condition.has('If-None-Match')&&old)return null;
      if(condition&&condition.has('If-Match')&&old?.httpEtag!==condition.get('If-Match'))return null;
      const entry={httpEtag:'"'+(++rev)+'"',value};
      map.set(key,entry);
      return entry;
    }
  };
}
const jpeg=new Uint8Array([0xFF,0xD8,0xFF,0xE0,0,0x10,0x4A,0x46,0x49,0x46]);
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const request=(url,{method='POST',headers={},body}={})=>new Request(url,{method,headers,body});

test('quota counters stop at the limit and reopen after the window',async()=>{
  const env={BUCKET:bucket()};
  assert.equal(await takeQuota(env,'ip:1.2.3.4',2,{windowMs:40}),true);
  assert.equal(await takeQuota(env,'ip:1.2.3.4',2,{windowMs:40}),true);
  assert.equal(await takeQuota(env,'ip:1.2.3.4',2,{windowMs:40}),false);
  await sleep(60);
  assert.equal(await takeQuota(env,'ip:1.2.3.4',2,{windowMs:40}),true);
});

test('guard scopes anonymous callers per address and falls back to a shared bucket',async()=>{
  const env={BUCKET:bucket()};
  const call=ip=>guard(new Request('https://test/api/x',{headers:{'cf-connecting-ip':ip}}),env,{name:'x',anonymousLimit:1,memberLimit:5,globalLimit:10});
  assert.equal((await call('198.51.100.7')).ok,true);
  assert.equal((await call('198.51.100.7')).ok,false);
  assert.equal((await call('198.51.100.8')).ok,true);
  assert.equal(clientIp(new Request('https://test/',{headers:{'x-forwarded-for':'203.0.113.9, 10.0.0.1'}})),'203.0.113.9');
  assert.equal(clientIp(new Request('https://test/',{headers:{'cf-connecting-ip':'not an ip'}})),'unknown');
});

test('identify rejects oversized, non-JPEG and truncated bodies before paying upstream',async()=>{
  const env={BUCKET:bucket()};
  let calls=0;
  const upstream=async()=>{calls++;return Response.json({results:[]})};
  const oversized=request('https://test/api/identify',{headers:{'content-type':'image/jpeg'},body:jpeg});
  oversized.headers.set('content-length','9000000');
  assert.equal((await identify(oversized,env,upstream)).status,413);
  assert.equal((await identify(request('https://test/api/identify',{headers:{'content-type':'text/plain'},body:'x'}),env,upstream)).status,415);
  assert.equal((await identify(request('https://test/api/identify',{headers:{'content-type':'image/jpeg','x-plantnet-key':'k'},body:new Uint8Array([0x47,0x49,0x46])}),env,upstream)).status,415);
  assert.equal(calls,0);
  const ok=await identify(request('https://test/api/identify',{headers:{'content-type':'image/jpeg','x-plantnet-key':'k'},body:jpeg}),env,upstream);
  assert.equal(ok.status,200);
  assert.equal(calls,1);
});

test('identify rate limits after the anonymous allowance',async()=>{
  const env={BUCKET:bucket(),PLANTNET_API_KEY:'k'};
  const upstream=async()=>Response.json({results:[]});
  const send=()=>identify(request('https://test/api/identify',{headers:{'content-type':'image/jpeg','cf-connecting-ip':'203.0.113.44'},body:jpeg}),env,upstream);
  for(let i=0;i<30;i++)assert.equal((await send()).status,200);
  assert.equal((await send()).status,429);
});

test('model rejects oversized payloads before parsing',async()=>{
  const env={BUCKET:bucket(),DEEPSEEK_API_KEY:'k'};
  const oversized=request('https://test/api/model',{headers:{'content-type':'application/json'},body:'{}'});
  oversized.headers.set('content-length','4096');
  assert.equal((await modelPlant(oversized,env)).status,413);
});

test('faction refuses unknown species for anonymous callers instead of paying the model',async()=>{
  const env={BUCKET:bucket(),DEEPSEEK_API_KEY:'k'};
  let calls=0;
  const upstream=async()=>{calls++;return Response.json({choices:[{message:{content:'{"type":"plain","reason":"常见。"}'}}]})};
  const res=await duelFaction(new Request('https://test/api/faction',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'203.0.113.9'},body:JSON.stringify({latin:'aaaa bbbb'})}),env,upstream);
  assert.equal(res.status,422);
  assert.equal(calls,0);
});

test('faction classifies catalogue species once and reuses the cached record',async()=>{
  const env={BUCKET:bucket(),DEEPSEEK_API_KEY:'k'};
  let calls=0;
  const upstream=async()=>{calls++;return Response.json({choices:[{message:{content:'{"type":"nectar","reason":"菊科头状花序，昆虫访花。"}'}}]})};
  const ask=()=>duelFaction(new Request('https://test/api/faction',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'203.0.113.10'},body:JSON.stringify({latin:'Bellis perennis'})}),env,upstream);
  const first=await ask();
  assert.equal(first.status,200);
  assert.equal((await first.json()).type,'nectar');
  assert.equal((await ask()).status,200);
  assert.equal(calls,1);
});
