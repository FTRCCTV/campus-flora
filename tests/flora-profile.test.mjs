import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context=vm.createContext({});
for(const file of ['profile','layout','specimen']){
  vm.runInContext(readFileSync(new URL('../dist/'+file+'.js',import.meta.url),'utf8'),context);
}
const run=code=>vm.runInContext(code,context);
const profile=(latin,family,model)=>JSON.parse(run('JSON.stringify(plantProfile('+JSON.stringify({latin,family,model})+'))'));
const faces=(latin,family,potted=false)=>JSON.parse(run('JSON.stringify(specimenMesh('+JSON.stringify({latin,family,size:'medium'})+','+potted+'))'));

test('every catalogue entry parses and yields a finite mesh within the face budget',()=>{
  const names=JSON.parse(run('JSON.stringify([...FloraCatalog.species(),...FloraCatalog.genera().map(g=>g+" sp")])'));
  assert.ok(names.length>250);
  for(const latin of names){
    const mesh=faces(latin);
    assert.ok(mesh.length>40&&mesh.length<1100,latin+' has '+mesh.length+' faces');
    for(const f of mesh)for(const v of f.vertices)assert.ok(v.every(Number.isFinite),latin);
  }
  for(const family of JSON.parse(run('JSON.stringify(FloraCatalog.families())')))assert.ok(faces('Incognita ignota',family).length>40,family);
});

test('authors, hybrid marks and synonyms resolve to the curated species',()=>{
  assert.equal(profile('Ginkgo biloba L.').source,'species');
  assert.equal(profile('Sophora japonica').name,'槐');
  assert.equal(profile('Platanus × hispanica').name,'二球悬铃木');
  assert.equal(profile('Prunus mume').source,'genus');
  assert.equal(profile('Incognita ignota','Rosaceae').source,'family');
  assert.equal(profile('Incognita ignota').form,'herb');
  assert.equal(profile('constructor').source,'form');
});

test('a stored species model overrides genus priors but not curated species',()=>{
  const model={form:'shrub',leaf:'#568357',bloom:'#df8294',height:1,spread:1,count:6,leafShape:'lanceolate',crownShape:'rounded',petals:5,
    arrangement:'alternate',inflorescence:'cluster',leafAspect:1,margin:'toothed',profileVersion:3,fact:'x'};
  const mume=profile('Prunus mume','Rosaceae',model);
  assert.equal(mume.source,'model');assert.equal(mume.form,'shrub');assert.equal(mume.leafShape,'lanceolate');
  assert.equal(profile('Ginkgo biloba','',model).leafShape,'fan');
  assert.deepEqual(profile('Ginkgo biloba','',{...model,habit:'aquatic'}),profile('Ginkgo biloba'));
  // A prior for another growth form is ignored, and junk fields never reach the mesh.
  assert.equal(profile('Acer sp','',{...model,form:'herb',leafShape:'<svg>',count:99}).leafCompound,'simple');
  assert.equal(profile('Acer sp','',{...model,leafShape:'<svg>',count:99}).count,14);
});

test('distinct campus species no longer share one generic mesh',()=>{
  const key=latin=>faces(latin).length+'/'+faces(latin)[40].color;
  const seen=new Set(['Styphnolobium japonicum','Platycladus orientalis','Yulania denudata','Wisteria sinensis','Iris tectorum','Nelumbo nucifera','Phyllostachys propinqua','Setaria viridis'].map(key));
  assert.equal(seen.size,8);
});
