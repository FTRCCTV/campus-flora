import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({});
for(const name of ['profile','layout','specimen','studio-renderer']){
  vm.runInContext(readFileSync(new URL('../dist/'+name+'.js',import.meta.url),'utf8'),context);
}
const layout=context.GardenLayout;

test('seedlings fit closer together while overlapping adult crowns still collide',()=>{
  const a={uid:'a',latin:'Ginkgo biloba',form:'tree',size:'large',zone:'path',x:0,z:0};
  let gap;
  for(let x=.1;x<2.5;x+=.1){
    const b={...a,uid:'b',x};
    if(!layout.clear(a,[b])&&layout.clear({...a,growth:0},[{...b,growth:0}])){gap=x;break}
  }
  assert.ok(gap);
  const lantern={kind:'lantern',uid:'1',zone:'path',x:0,z:0};
  const marker={kind:'herbmarker',uid:'2',zone:'path',x:0,z:.53};
  assert.equal(layout.clear(marker,[lantern]),true);
  assert.equal(layout.blocker({...marker,z:0},[lantern]),lantern);
});
test('water and light survive a save, require separate actions, and end in harvest',()=>{
  const p={growth:0,form:'flower'};
  layout.tend(p,'water');assert.equal(p.growth,0);
  assert.throws(()=>layout.tend(p,'water'));
  const saved=JSON.parse(JSON.stringify(p));layout.tend(saved,'light');
  assert.equal(saved.care.light,1);layout.tend(saved,'light');
  assert.equal(saved.growth,1);assert.equal(saved.care,undefined);
  while(saved.growth<3){
    const goals=layout.carePlan(saved);
    for(const [key,steps] of Object.entries(goals))for(let i=0;i<steps;i++)layout.tend(saved,key);
  }
  layout.tend(saved,'harvest');assert.equal(saved.growth,4);
});
test('interrupting a snow transition starts the rain from the current leaf cover',()=>{
  const snow={weather:'snow',from:{rain:0,snow:0},start:0};
  const mid=context.sampleWeather(snow,1500);
  assert.equal(mid.snow,.5);
  const rain={weather:'rain',from:mid,start:1500};
  assert.equal(context.sampleWeather(rain,1500).snow,.5);
  const mixed=context.sampleWeather(rain,3000);
  assert.equal(mixed.snow,.25);assert.equal(mixed.rain,.5);
  assert.equal(context.sampleWeather(rain,4500).snow,0);
  assert.equal(context.sampleWeather(rain,4500).rain,1);
});
