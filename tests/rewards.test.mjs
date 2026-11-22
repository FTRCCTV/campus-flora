import test from 'node:test';
import assert from 'node:assert/strict';
import {accountGarden} from '../server/account.mjs';

test('older records, scientific authorities and known synonyms share permanent species entries',()=>{
  const garden=GardenLayout.unpack([{latin:'Sophora japonica L.'},{latin:'Styphnolobium japonicum'},{latin:'Rosa sp.'},{latin:'Rosa chinensis Jacq.'}]);
  assert.deepEqual(garden.design.discovered,['styphnolobium japonicum','rosa chinensis']);
  assert.deepEqual(GardenLayout.unpack({...garden,records:[]}).design.discovered,garden.design.discovered);
  for(const r of GardenLayout.rewards){
    assert.equal(GardenLayout.unlocked(r.id,r.at-1),false);
    assert.equal(GardenLayout.unlocked(r.id,r.at),true);
  }
});

test('member saves derive rewards from stored and submitted plants, preserve earned rewards, and reject forged unlocks',async()=>{
  const user={id:'member',name:'member'},version='"'+'a'.repeat(32)+'"';
  const old={uid:'old',name:'银杏',latin:'Ginkgo biloba L.',date:'2026',photo:'data:image/jpeg;base64,YQ==',form:'tree',size:'small',zone:'path',x:0,z:0};
  let stored=[old];
  const env={BUCKET:{
    async get(key){
      return {httpEtag:version,json:async()=>structuredClone(key.startsWith('auth/')?{user,revision:1,until:Date.now()+60000}:stored)};
    },
    async put(key,body){stored=JSON.parse(body);return {httpEtag:version}}
  }};
  const put=(records,design)=>accountGarden(new Request('https://garden.test/api/account',{
    method:'PUT',headers:{Origin:'https://garden.test','Content-Type':'application/json',Cookie:'__Host-flora_session='+'a'.repeat(64)},
    body:JSON.stringify({owner:user.id,version,records,design})
  }),env);
  const design=GardenLayout.empty();
  assert.equal((await put([],{...design,discovered:['fake one','fake two','fake three'],effect:'petals'})).status,400);
  assert.equal((await put([],{...design,decorations:[{uid:'reward',kind:'sundial',zone:'path',x:0,z:0}]})).status,400);
  const additional=[{...old,uid:'b',latin:'Bellis perennis',x:3},{...old,uid:'c',latin:'Acer palmatum',x:6}];
  assert.equal((await put(additional,{...design,effect:'petals'})).status,200);
  assert.equal(stored.design.discovered.length,3);
  assert.equal((await put([],{...design,effect:'petals'})).status,200);
  assert.equal(stored.design.discovered.length,3);
  assert.equal(stored.design.effect,'petals');
});
