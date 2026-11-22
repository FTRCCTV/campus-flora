import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Load the same model definitions as the browser and the bundled Worker.
const context=vm.createContext({});
for(const file of ['profile','layout','specimen']){
  vm.runInContext(readFileSync(new URL('../dist/'+file+'.js',import.meta.url),'utf8'),context);
}
const layout=context.GardenLayout;
const prop=(kind,x=0,z=0,scale=1,rotation=0)=>({kind,uid:kind,zone:'path',x,z,scale,rotation});
const plant=(latin,form,size='small')=>({latin,uid:latin,form,size,zone:'path',x:0,z:0});

function pair(a,b,allowed){
  assert.equal(layout.clear(a,[b]),allowed);
  assert.equal(layout.clear(b,[a]),allowed);
  const records=[a,b].filter(item=>!item.kind);
  const design={...layout.empty(),decorations:[a,b].filter(item=>item.kind)};
  assert.equal(layout.valid(records,design),allowed);
}

test('a small plant fits inside an arch while a tall crown meets the beam',()=>{
  const arch=prop('arch'),mint=plant('Mentha canadensis','herb');
  pair(arch,mint,true);
  pair(arch,plant('Ginkgo biloba','tree','large'),false);
  pair(arch,{...mint,x:.78},false);
  pair({...arch,scale:.5},mint,false);
  assert.deepEqual({...layout.place(mint,[arch],{x:0,z:0})},{x:0,z:0});
});

test('quarter-turn rotates pillars into the former opening',()=>{
  const arch=prop('arch',1,-1,1,Math.PI/2);
  pair(arch,prop('rock',1,-.22,.5),false);
  pair(arch,prop('rock',1.78,-1,.5),true);
});

test('leg, seat and shelf clearances depend on the height and scale of both models',()=>{
  const smallRock=prop('rock',0,0,.5),lowStones=prop('steppingstones',0,0,.5);
  pair(prop('bench'),smallRock,true);
  pair(prop('bench'),prop('rock'),false);
  pair(prop('worktable'),lowStones,true);
  pair(prop('worktable'),smallRock,false);
  pair(prop('plantstand'),lowStones,true);
  pair(prop('plantstand'),smallRock,false);
  pair(prop('teatable',0,0,2),smallRock,true);
  pair(prop('teatable',0,0,2),prop('rock',.66,0,.5),false);
  pair(prop('fence'),prop('rock',0,.66,.5),true);
  pair(prop('fence'),smallRock,false);
});

test('previously separated items stay valid, including migrated slot-only plants',()=>{
  const tree={...plant('Ginkgo biloba','tree','large'),slot:1,zone:'meadow'};
  delete tree.x;delete tree.z;
  const arch=prop('arch');
  const migrated=layout.unpack({records:[tree],design:{...layout.empty(),decorations:[arch]}});
  assert.equal(migrated.records[0].zone,'path');
  assert.equal(layout.valid(migrated.records,migrated.design),true);
  pair(prop('lantern'),prop('rock'),false);
});
