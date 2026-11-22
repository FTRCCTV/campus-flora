import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context=vm.createContext({ImageData:class {
  constructor(w,h){this.data=new Uint8ClampedArray(w*h*4)}
}});
for(const name of ['layout','studio-depth','studio-scene','habitat']){
  vm.runInContext(readFileSync(new URL('../dist/'+name+'.js',import.meta.url),'utf8'),context);
}
const {studioRaster,studioRasterFace,studioProjectedFace,studioProjection,studioBackdropGeometry}=context;

test('a specimen inside an arch stays behind its near post and ahead of its far post throughout an orbit',()=>{
  const quad=(x,z,w)=>[[x-w,0,z],[x+w,0,z],[x+w,1,z],[x-w,1,z]];
  for(const angle of [0,.09,Math.PI-.09,Math.PI]){
    for(const pitch of [0,.25,.53]){
      const {project}=studioProjection(220,160,angle,1.8,3.25,pitch);
      const posts=[quad(-.15,-.36,.1),quad(.15,.36,.1)];
      const body=quad(0,0,.55);
      for(const reverse of [false,true]){
        const frame=studioRaster(220,160);
        frame.owners=new Uint32Array(220*160);
        const pieces=[[posts[0],1],[posts[1],1],[body,2]];
        for(const [poly,id] of reverse?pieces.reverse():pieces){
          studioRasterFace(frame,studioProjectedFace(poly.map(project),id===1?'#884422':'#449955'),0,0,0,id);
        }
        posts.forEach((_,index)=>{
          const [x,y]=project([index?.15:-.15,.5,index?.36:-.36]);
          const near=(index===1)===(Math.cos(angle)>0);
          const pixel=Math.floor(y)*220+Math.floor(x);
          assert.equal(frame.owners[pixel],near?1:2);
          assert.equal(frame.pixels[pixel],context.studioRasterColor(near?'#884422':'#449955'));
        });
      }
    }
  }
});

test('depth varies across a face and offset projection agrees with world projection',()=>{
  const frame=studioRaster(12,9);
  const a=studioProjectedFace([[0,0,-2],[8,0,2],[8,6,2],[0,6,-2]],'#ff0000');
  const b=studioProjectedFace([[0,0,0],[8,0,0],[8,6,0],[0,6,0]],'#0000ff');
  for(const f of [a,b])studioRasterFace(frame,f,2,1,3);
  assert.equal(frame.pixels[3*12+3],b.color);
  assert.equal(frame.pixels[3*12+8],a.color);
  assert.equal(frame.pixels[0],0);
});

test('wall cutaways keep the shelves and cupboard anchored at every quadrant',()=>{
  const view={zone:'sill',scene:'campus',weather:'sunny',extent:3.25};
  function furniture(angle){
    return studioBackdropGeometry({...view,angle},3.87).faces.filter(f=>f.layer===6&&f.color==='#eadcc2')
      .map(f=>JSON.stringify(f.vertices)).sort();
  }
  const initial=furniture(.57);
  assert.ok(initial.length>=8);
  for(const angle of [2.5,3.7,5.4])assert.deepEqual(furniture(angle),initial);
});
