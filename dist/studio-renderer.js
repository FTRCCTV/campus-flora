// Rasterize each specimen once at the current camera angle. Translation on the
// ground plane only changes its screen origin in this orthographic projection.
const studioViewCaches=new WeakMap();
function studioColorMix(color,target,amount){
  if(!/^#[0-9a-f]{6}$/i.test(color))return color;
  const n=parseInt(color.slice(1),16),t=parseInt(target.slice(1),16);
  return '#'+[16,8,0].map(bit=>Math.round(((n>>bit)&255)*(1-amount)+((t>>bit)&255)*amount).toString(16).padStart(2,'0')).join('');
}
const studioSurfaceCache=new WeakMap(),studioPropMeshes=new Map();
function studioSurfaceFaces(meshes,view){
  const night=view.scene==='starlight',outdoor=!studioIndoor(view.zone);
  if(!night&&(!outdoor||view.weather==='sunny'))return meshes;
  const mode=[night,outdoor,view.weather].join('/');
  let variants=studioSurfaceCache.get(meshes);
  if(!variants){variants=new Map();studioSurfaceCache.set(meshes,variants)}
  if(variants.has(mode))return variants.get(mode);
  const result=[];
  for(const mesh of meshes){
    const colored=night?studioColorMix(mesh.color,'#263d62',outdoor?.42:.18):mesh.color;
    const foliage=outdoor&&(mesh.surface==='leaf'||mesh.surface==='bloom');
    const rain=foliage&&view.weather==='rain';
    result.push({...mesh,color:rain?studioColorMix(colored,'#244e4d',.28):colored});
    if(!foliage||view.weather==='sunny')continue;
    const v=mesh.vertices,center=[0,0,0],normal=[0,0,0];
    for(let i=0;i<v.length;i++){
      const p=v[i],q=v[(i+1)%v.length];
      for(let j=0;j<3;j++)center[j]+=p[j]/v.length;
      normal[0]+=(p[1]-q[1])*(p[2]+q[2]);normal[1]+=(p[2]-q[2])*(p[0]+q[0]);normal[2]+=(p[0]-q[0])*(p[1]+q[1]);
    }
    const incline=normal[1]/(Math.hypot(...normal)||1);
    if(incline<(rain?.64:.27))continue;
    const coat=rain?.16:.44+incline*.47;
    result.push({vertices:v.map(p=>p.map((c,j)=>center[j]+(c-center[j])*coat+(j===1?.003:0))),color:rain?'#a5bfb7':night?'#c4d8e8':'#f0f6f4',overlay:true});
  }
  variants.set(mode,result);return result;
}
function studioSprite(item,view,projection,ratio,reusable){
  const {zone,weather}=view,rotation=item.rotation||0,ca=Math.cos(rotation),sa=Math.sin(rotation);
  const snowy=!studioIndoor(zone)&&weather==='snow',key=item.kind+'/'+snowy;
  if(item.kind&&!studioPropMeshes.has(key))studioPropMeshes.set(key,studioPropFaces(item.kind,snowy));
  const meshes=item.kind?studioPropMeshes.get(key):studioPlantAsset(item,zone).faces;
  const [cx,cy]=projection.project([0,0,0]);
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const size=item.kind?(item.scale??1):1;
  const faces=studioSurfaceFaces(meshes,view).map(mesh=>{
    const p=mesh.vertices.map(([x,y,z])=>{
      const [px,py,depth]=projection.project([(x*ca-z*sa)*size,y*size,(x*sa+z*ca)*size]);
      const u=px-cx,v=py-cy;
      left=Math.min(left,u);top=Math.min(top,v);right=Math.max(right,u);bottom=Math.max(bottom,v);
      return [u,v,depth];
    });
    return {p,color:mesh.color,depth:p.reduce((sum,v)=>sum+v[2],0)/p.length+(mesh.overlay ? .004 : 0)};
  });
  left=Math.floor(left)-1;top=Math.floor(top)-1;
  const w=Math.ceil(right-left)+2,h=Math.ceil(bottom-top)+2;
  const image=reusable||document.createElement('canvas');
  ratio=Math.min(ratio,2048/Math.max(1,w,h),Math.sqrt(2e6/Math.max(1,w*h)));
  image.width=Math.ceil(w*ratio);image.height=Math.ceil(h*ratio);
  const ctx=image.getContext('2d',{willReadFrequently:true});
  ctx.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);ctx.lineJoin='round';ctx.lineWidth=.32;
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces){
    ctx.beginPath();for(let i=0;i<f.p.length;i++){const p=f.p[i];if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1])}
    ctx.closePath();ctx.fillStyle=ctx.strokeStyle=f.color;ctx.fill();ctx.stroke();
  }
  return {image,ctx,left,top,ratio,w:image.width/ratio,h:image.height/ratio};
}
function paintStudioScene(canvas,view){
  const width=canvas.clientWidth||canvas.width,height=canvas.clientHeight||canvas.height;
  const ratio=canvas.clientWidth?Math.min(2,window.devicePixelRatio||1):1;
  const pw=Math.round(width*ratio),ph=Math.round(height*ratio);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
  const {zone,scene,weather,angle,zoom,extent,pitch=.53,panX=0,panY=0,items,selected}=view;
  const spriteKey=[pw,ph,ratio,zone,scene,weather,angle,zoom,extent,pitch].join('|');
  const key=[spriteKey,panX,panY].join('|');
  let cache=studioViewCaches.get(canvas);
  if(cache?.key!==key){
    const backdrop=cache?.backdrop||document.createElement('canvas');
    if(backdrop.width!==pw||backdrop.height!==ph){backdrop.width=pw;backdrop.height=ph}
    const projection=studioProjection(width,height,angle,zoom,extent,pitch,panX,panY);
    const habitat=buildStudioBackdrop(backdrop,view,projection,ratio);
    if(cache?.spriteKey===spriteKey)Object.assign(cache,{key,backdrop,projection,habitat});
    else{
      const spare=cache?[...cache.sprites.values()].map(a=>a.image):[];
      cache={key,spriteKey,backdrop,projection,habitat,sprites:new Map(),pixels:0,spare};
    }
    studioViewCaches.set(canvas,cache);
  }
  const {projection,habitat}=cache,ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(cache.backdrop,0,0);ctx.setTransform(ratio,0,0,ratio,0,0);
  const layers=[];
  for(const item of items){
    const [x,y,depth]=projection.project([item.x,0,item.z]),id=item.uid??item.id;
    const assetKey=JSON.stringify([item.kind,item.latin,item.family,item.form,item.model,item.palette,item.size,item.rotation,item.scale,item.potStyle]);
    let asset=cache.sprites.get(assetKey);
    if(!asset){
      asset=studioSprite(item,view,projection,ratio,cache.spare.pop());
      const pixels=asset.image.width*asset.image.height;
      while(cache.sprites.size&&cache.pixels+pixels>8e6){
        const first=cache.sprites.keys().next().value,old=cache.sprites.get(first);
        cache.pixels-=old.image.width*old.image.height;cache.sprites.delete(first);
      }
      cache.sprites.set(assetKey,asset);cache.pixels+=pixels;
    }
    const r=studioFootprint(item,zone)*projection.scale;
    ctx.fillStyle='#3549322d';ctx.beginPath();ctx.ellipse(x+1,y+1,r*.96,Math.max(.6,r*.85*Math.sin(pitch)),0,0,Math.PI*2);ctx.fill();
    if(selected===id){ctx.strokeStyle='#466b54';ctx.lineWidth=Math.max(1.5,projection.scale*.055);ctx.beginPath();ctx.ellipse(x,y,r+3,(r+3)*Math.sin(pitch),0,0,Math.PI*2);ctx.stroke()}
    layers.push({x:x+asset.left,y:y+asset.top,asset,id,depth});
  }
  for(const unused of cache.spare){unused.width=unused.height=1}cache.spare.length=0;
  layers.sort((a,b)=>a.depth-b.depth);
  for(const {x,y,asset} of layers)ctx.drawImage(asset.image,x,y,asset.w,asset.h);
  function hit(px,py){
    for(let i=layers.length-1;i>=0;i--){
      const {asset,x,y,id}=layers[i],u=px-x,v=py-y;
      if(u<0||v<0||u>=asset.w||v>=asset.h)continue;
      if(asset.ctx.getImageData(Math.floor(u*asset.ratio),Math.floor(v*asset.ratio),1,1).data[3]>18)return id;
    }
    return null;
  }
  function windowHit(x,y){
    if(!habitat.windowPath)return false;
    ctx.save();ctx.resetTransform();const isWindow=ctx.isPointInPath(habitat.windowPath,x,y);ctx.restore();return isWindow;
  }
  return {night:scene==='starlight',hit,ground:projection.ground,windowHit,weatherPath:habitat.weatherPath,layers,width,height,ratio};
}
