import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/duel-rules.js';
import {duelApi,duelFaction} from '../server/duel.mjs';
const game=ButterflyDuel;
const wall={type:'plain',owner:0,name:'草'};
test('every unobstructed flight is shortest and stops on first scoring edge',()=>{
  for(const r of [0,.2,.5,.8,.99999]){
    const s=game.create();assert.equal(game.paths(s).count[0],70);
    while(s.winner===null){
      const old=s.pos;game.play(s,null);game.play(s,null,null,()=>r);
      assert.ok([1,5].includes(s.pos-old));assert.ok(s.round<=7);
    }
    assert.equal(s.winner,s.pos>=20?0:1);
    assert.throws(()=>game.play(s,null));
  }
});
test('published route is stable until affected, includes the winning edge and matches each flight',()=>{
  const s=game.create(()=>0);assert.deepEqual(s.forecast,[1,2,3,4,9,14,19,24]);
  game.play(s,game.basic,1,()=>.9);
  assert.equal(s.forecast[0],5);assert.ok(!s.forecast.includes(1));
  const initial=[...s.forecast];game.play(s,null,null,()=>0);
  assert.equal(s.pos,initial[0]);assert.deepEqual(s.forecast,initial.slice(1));
  while(s.winner===null){
    const route=[...s.forecast];game.play(s,null,null,()=>0);assert.deepEqual(s.forecast,route);
    game.play(s,null,null,()=>.99);assert.equal(s.pos,route[0]);assert.deepEqual(s.forecast,s.winner===null?route.slice(1):[]);
  }
  const t=game.create(()=>0);game.play(t,game.basic,24,()=>0);
  assert.equal(t.wandering,true);assert.deepEqual(t.forecast,[1]);
  game.play(t,null,null,()=>.999);assert.equal(t.pos,1);assert.equal(t.forecast.length,1);
});
test('shortest detour, random walking, fully trapped flutter and reopening a route',()=>{
  const s=game.create();s.pos=12;s.cells[13]=wall;s.cells[17]=wall;
  const before=game.paths(s).dist[s.pos];game.fly(s,()=>0);
  assert.ok([7,11].includes(s.pos));assert.equal(game.paths(s).dist[s.pos],before-1);
  const t=game.create();t.cells[24]=wall;game.fly(t,()=>.9999);assert.equal(t.pos,5);
  for(const c of [0,6,10])t.cells[c]=wall;game.fly(t,()=>0);assert.equal(t.pos,6);assert.ok(t.cells[6]);
  game.play(t,game.tool,24);assert.equal(t.cells[24],null);assert.equal(t.trial[0],false);
  assert.ok(game.paths(t).dist[t.pos]>0);
});
test('lures respect shortest paths, vines stop at board boundaries, reusable cards cool down',()=>{
  const s=game.create();game.play(s,{key:'x',name:'蜜源',type:'nectar'},5);game.play(s,null,null,()=>0);
  assert.equal(s.pos,5);assert.equal(s.cells[5],null);assert.equal(s.turn,1);
  game.play(s,null);assert.throws(()=>game.play(s,{key:'x',type:'nectar'},6));
  const t=game.create();game.play(t,{key:'v',type:'vine',name:'藤'},4);
  assert.ok(t.cells[4]);assert.equal(t.cells[5],null);
  const u=game.create();u.cells[0]={type:'wind',owner:1};game.fly(u,()=>.95);assert.equal(u.pos,1);
});
function bucket(){
  const map=new Map();let rev=0;
  return {get:async k=>map.get(k),put:async(k,txt,opts={})=>{
    const old=map.get(k),c=opts.onlyIf;
    if(c&&(c.has('If-None-Match')&&old||c.has('If-Match')&&old?.httpEtag!==c.get('If-Match')))return null;
    const obj={httpEtag:'"'+(++rev)+'"',json:async()=>JSON.parse(txt)};map.set(k,obj);return obj;
  }};
}
test('DeepSeek assigns a canonical species once; unsupported replies stay retryable',async()=>{
  const env={BUCKET:bucket(),DEEPSEEK_API_KEY:'test'};
  const req=latin=>new Request('https://test/api/faction',{method:'POST',body:JSON.stringify({latin})});
  let count=0;
  const upstream=async()=>{count++;return Response.json({choices:[{message:{content:JSON.stringify({type:'wind',reason:'果实具翅。'})}}]})};
  assert.equal((await (await duelFaction(req('Acer palmatum'),env,upstream)).json()).type,'wind');
  await duelFaction(req('Acer palmatum Thunb.'),env,upstream);assert.equal(count,1);
  const fail=()=>Response.json({choices:[{message:{content:'{"type":"other"}'}}]});
  assert.equal((await duelFaction(req('Bellis perennis'),env,fail)).status,503);
  assert.equal((await duelFaction(req('Bellis perennis'),env,upstream)).status,200);
});
test('two authenticated friends invite, join, reconnect, use collected cards, and reject stale writes',async()=>{
  const db=bucket(),tokens=['a'.repeat(64),'b'.repeat(64)],names=['alice','bob'];
  const env={BUCKET:db,DB:{prepare:()=>({bind:()=>({first:async()=>({sender:'alice',recipient:'bob'})})})}};
  const hash=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
  for(const [i,name] of names.entries()){
    const account={user:{id:name,name},revision:1};
    await db.put('auth/names/'+await hash(name),JSON.stringify(account));
    await db.put('auth/sessions/'+await hash(tokens[i]),JSON.stringify({...account,until:Date.now()+60000}));
  }
  await db.put('gardens/v1/alice.json',JSON.stringify([{latin:'Acer palmatum',name:'鸡爪槭'}]));
  await db.put('duel/factions/v1/acer%20palmatum.json',JSON.stringify({type:'wind'}));
  async function call(i,body){
    const r=await duelApi(new Request('https://test/api/duel?friend=test',{method:body?'POST':'GET',headers:{Origin:'https://test',Cookie:'__Host-flora_session='+tokens[i]},...(body?{body:JSON.stringify(body)}:{})}),env);
    return {status:r.status,...await r.json()};
  }
  for(const deck of [{wind:'not owned'},{vine:'acer palmatum'},{wind:'standard-nectar'}]){
    assert.equal((await call(0,{action:'invite',match:null,rev:0,deck})).status,400);
  }
  let room=(await call(0,{action:'invite',match:null,rev:0,deck:{wind:'acer palmatum'}})).room;
  assert.equal(room.deck.length,5);
  assert.equal(room.deck.find(c=>c.type==='wind').key,'acer palmatum');
  const act=(i,action,extra={})=>call(i,{action,rev:room.rev,match:room.match,...extra});
  assert.equal((await act(0,'join')).status,409);room=(await act(1,'join')).room;
  assert.equal(room.deck.find(c=>c.type==='wind').key,'standard-wind');
  const roomKey='duel/rooms/v1/test.json',legacy=await (await db.get(roomKey)).json();
  delete legacy.board.forecast;legacy.board.plan=[];
  await db.put(roomKey,JSON.stringify(legacy));
  const restored=(await call(0)).room.board.forecast;
  assert.ok(restored.length>=4);assert.deepEqual((await call(1)).room.board.forecast,restored);
  assert.equal((await act(0,'play',{key:'standard-wind',cell:1})).status,400);
  assert.equal((await act(1,'play',{key:null})).status,409);
  assert.equal((await act(0,'play',{key:'fake plant',cell:1})).status,400);
  const prev=room.rev;room=(await act(0,'play',{key:'acer palmatum',cell:1,type:'breaker'})).room;
  assert.equal(room.board.cells[1].type,'wind');
  const announced=room.board.forecast[0];
  assert.equal((await act(1,'play',{rev:prev,key:null})).status,409);
  assert.equal((await act(1,'play',{key:'trial',cell:1})).status,400);
  room=(await act(1,'play',{key:null})).room;
  assert.equal(room.board.pos,announced);assert.equal(room.board.round,2);assert.equal(room.board.plan,undefined);
  assert.equal((await call(0)).room.rev,room.rev);
  room=(await act(1,'end')).room;assert.equal(room.board.winner,0);
});
