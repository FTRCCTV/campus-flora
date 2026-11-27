import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context=vm.createContext({});
for(const file of ['profile','layout','specimen']){
  vm.runInContext(readFileSync(new URL('../dist/'+file+'.js',import.meta.url),'utf8'),context);
}
const layout=context.GardenLayout;
const plant={uid:'mint',latin:'Mentha canadensis',form:'herb',size:'small',zone:'sill',x:0,z:0,growth:0};
test('indoor decals and outdoor charms follow the specimen and preserve original geometry',()=>{
  const original=context.specimenMesh(plant,true);
  const styled=context.specimenMesh({...plant,potSticker:'daisy',plantCharm:'tag'},true);
  assert.ok(styled.some(f=>f.accessory));
  assert.deepEqual(styled.filter(f=>!f.accessory),original);
  assert.ok(!context.specimenMesh({...plant,potSticker:'daisy'},false).some(f=>f.accessory));
  assert.ok(context.specimenMesh({...plant,plantCharm:'tag'},false).some(f=>f.accessory));
  assert.equal(layout.valid([{...plant,potSticker:'waves',plantCharm:'butterfly'}],layout.empty()),true);
  assert.equal(layout.valid([{...plant,plantCharm:'invalid'}],layout.empty()),false);
});
test('legacy partial care accepts fertilizer; mature plants keep a positive care record',()=>{
  const specimen={...plant,care:{water:1,light:1}};
  layout.tend(specimen,'nutrient');
  assert.equal(specimen.growth,1);assert.equal(specimen.care,undefined);
  specimen.growth=4;layout.tend(specimen,'nutrient');layout.tend(specimen,'water');
  assert.equal(specimen.growth,4);assert.equal(specimen.careCount,3);
});
