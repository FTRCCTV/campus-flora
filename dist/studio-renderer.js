const studioViewCaches=new WeakMap();
function studioColorMix(color,target,amount){
  if(!/^#[0-9a-f]{6}$/i.test(color))return color;
  const n=parseInt(color.slice(1),16),t=parseInt(target.slice(1),16);
  return '#'+[16,8,0].map(bit=>Math.round(((n>>bit)&255)*(1-amount)+((t>>bit)&255)*amount).toString(16).padStart(2,'0')).join('');
}
const studioSurfaceCache=new WeakMap(),studioPropMeshes=new Map();
function weatherGoal(weather){return {rain:Number(weather==='rain'),snow:Number(weather==='snow')}}
function sampleWeather(state,now){
  const progress=Math.max(0,Math.min(1,(now-state.start)/3000)),t=progress*progress*(3-2*progress);
  const to=weatherGoal(state.weather);
  return {rain:state.from.rain+(to.rain-state.from.rain)*t,snow:state.from.snow+(to.snow-state.from.snow)*t,progress:t};
}
function studioSurfaceFaces(meshes,view){
  const night=view.scene==='starlight',outdoor=!studioIndoor(view.zone);
  const climate=view.surface||weatherGoal(view.weather);
  const wet=outdoor?Math.round(climate.rain*24)/24:0,snow=outdoor?Math.round(climate.snow*24)/24:0;
  if(!night&&!wet&&!snow)return meshes;
  const mode=[night,wet,snow].join('/');
  let variants=studioSurfaceCache.get(meshes);
  if(!variants){variants=new Map();studioSurfaceCache.set(meshes,variants)}
  if(variants.has(mode))return variants.get(mode);
  const result=[];
  for(const mesh of meshes){
    const colored=night?studioColorMix(mesh.color,'#263d62',outdoor?.42:.18):mesh.color;
    const foliage=outdoor&&(mesh.surface==='leaf'||mesh.surface==='bloom');
    const base=foliage&&wet?studioColorMix(colored,'#244e4d',.28*wet):colored;
    result.push({...mesh,color:base});
    if(!foliage||(!wet&&!snow))continue;
    const v=mesh.vertices,center=[0,0,0],normal=[0,0,0];
    for(let i=0;i<v.length;i++){
      const p=v[i],q=v[(i+1)%v.length];
      for(let j=0;j<3;j++)center[j]+=p[j]/v.length;
      normal[0]+=(p[1]-q[1])*(p[2]+q[2]);normal[1]+=(p[2]-q[2])*(p[0]+q[0]);normal[2]+=(p[0]-q[0])*(p[1]+q[1]);
    }
    const incline=normal[1]/(Math.hypot(...normal)||1);
    if(incline<.27)continue;
    const sheen=incline>=.64?wet:0,coat=.16*sheen+(.44+incline*.47)*snow;
    if(!coat)continue;
    const damp=studioColorMix(base,'#a5bfb7',sheen);
    result.push({vertices:v.map(p=>p.map((c,j)=>center[j]+(c-center[j])*coat+(j===1?.003:0))),
      color:studioColorMix(damp,night?'#c4d8e8':'#f0f6f4',snow),overlay:true});
  }
  if(variants.size>=3)variants.delete(variants.keys().next().value);
  variants.set(mode,result);return result;
}
// Cache projected vertices for layout drags. Camera changes reproject the original mesh.
function studioObjectFaces(item,view,projection,ratio){
  const {zone,weather}=view,rotation=item.rotation||0,ca=Math.cos(rotation),sa=Math.sin(rotation);
  const snowy=!studioIndoor(zone)&&weather==='snow',key=item.kind+'/'+snowy;
  if(item.kind&&!studioPropMeshes.has(key))studioPropMeshes.set(key,studioPropFaces(item.kind,snowy));
  const meshes=item.kind?studioPropMeshes.get(key):studioPlantAsset(item,zone).faces;
  const [cx,cy]=projection.project([0,0,0]),size=item.kind?(item.scale??1):1;
  return studioSurfaceFaces(meshes,view).map(mesh=>{
    const p=mesh.vertices.map(([x,y,z])=>{
      const [u,v,d]=projection.project([(x*ca-z*sa)*size,y*size,(x*sa+z*ca)*size]);
      return [(u-cx)*ratio,(v-cy)*ratio,d+(mesh.overlay ? .004 : 0)];
    });
    return studioProjectedFace(p,mesh.color);
  });
}
// Paint into the ground pass so soil cannot cover a neighbouring plant or intercept a pick.
function paintPlantingBasin(ctx,projection,item,radius,weather,night){
  let seed=0;
  for(const c of String(item.uid||item.latin))seed=(seed*31+c.charCodeAt(0))>>>0;
  const phase=(seed%180)*Math.PI/90,segments=18;
  const size={small:.24,medium:.36,large:.53}[item.size]||.36;
  const r=Math.max(size,Math.min(size*1.65,radius*.78));
  const colors=weather==='snow'?['#c5c8ba','#908478','#625646','#807061']:
    weather==='rain'?['#665648','#4a3e32','#392f26','#584634']:['#ab8862','#8b6b49','#604a33','#755a3d'];
  const ink=colors.map(c=>night?studioColorMix(c,'#263d62',.42):c);
  function screen(x,h,z){return projection.project([item.x+x*r,h*r,item.z+z*r])}
  function fill(points,color){
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  const rim=[],lip=[],bed=[];
  for(let i=0;i<segments;i++){
    const a=i*2*Math.PI/segments,edge=1+.07*Math.sin(3*a+phase)+.04*Math.sin(7*a-phase);
    const x=Math.cos(a)*edge,z=Math.sin(a)*edge*.89;
    rim.push(screen(x,0,z));lip.push(screen(x*.85,.065,z*.85));bed.push(screen(x*.66,0,z*.66));
  }
  fill(rim,ink[1]);
  for(let i=0;i<segments;i++){
    const j=(i+1)%segments;
    fill([rim[i],rim[j],lip[j],lip[i]],i%5<3?ink[0]:ink[1]);
  }
  fill(lip,ink[2]);fill(bed,ink[3]);
  for(let i=0;i<9;i++){
    const a=phase+i*2.4,s=.26+.32*((i*7)%9)/9,x=s*Math.cos(a),z=s*Math.sin(a);
    fill([screen(x-.043,.016,z),screen(x,.035,z-.045),screen(x+.06,.012,z+.03)],i%3?ink[1]:ink[2]);
  }
}
function paintStudioScene(canvas,view){
  const width=canvas.clientWidth||canvas.width,height=canvas.clientHeight||canvas.height;
  // Keep one sample grid for the entire gesture, including pointer release.
  const ratio=Math.min(canvas.clientWidth?(window.devicePixelRatio||1):1,2,Math.sqrt(4e6/(width*height)));
  const pw=Math.max(1,Math.round(width*ratio)),ph=Math.max(1,Math.round(height*ratio));
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
  const {zone,scene,weather,angle,zoom,extent,pitch=.53,panX=0,panY=0,items,selected}=view;
  const key=[width,height,ratio,zone,scene,weather,angle,zoom,extent,pitch,panX,panY].join('|');
  let cache=studioViewCaches.get(canvas);
  if(!cache||cache.frame.width!==pw||cache.frame.height!==ph){
    const backdrop=document.createElement('canvas'),overlay=document.createElement('canvas');
    backdrop.width=overlay.width=pw;backdrop.height=overlay.height=ph;
    const frame=studioRaster(pw,ph);
    frame.owners=new Uint32Array(pw*ph);
    cache={backdrop,overlay,frame,architecture:studioRaster(pw,ph)};
    studioViewCaches.set(canvas,cache);
  }
  const pose=[width,height,ratio,zone,scene,angle,zoom,extent,pitch,panX,panY].join('|');
  if(cache.key!==key){
    if(cache.pose===pose&&view.surface?.progress<1){
      if(!cache.fade){cache.fade=document.createElement('canvas');cache.fade.width=pw;cache.fade.height=ph}
      const old=cache.fade.getContext('2d');old.globalAlpha=cache.fading?(cache.blend??1):1;
      old.drawImage(cache.backdrop,0,0);old.globalAlpha=1;cache.fading=true;
    }else cache.fading=false;
    cache.pose=pose;
    cache.projection=studioProjection(width,height,angle,zoom,extent,pitch,panX,panY);
    cache.habitat=buildStudioBackdrop(cache.backdrop,view,cache.projection,ratio,cache.architecture);
    cache.objects=new Map();cache.key=key;
  }
  const {projection,habitat,frame}=cache,ctx=canvas.getContext('2d');
  ctx.resetTransform();
  cache.blend=view.surface?.progress??1;
  if(cache.fading&&cache.blend<1){ctx.drawImage(cache.fade,0,0);ctx.globalAlpha=cache.blend}
  else{cache.fading=false;cache.fade=null}
  ctx.drawImage(cache.backdrop,0,0);ctx.globalAlpha=1;ctx.setTransform(ratio,0,0,ratio,0,0);
  frame.depth.set(cache.architecture.depth);frame.pixels.set(cache.architecture.pixels);frame.owners.fill(0);
  const transparent=habitat.transparent.slice(),ids=[null],currentObjects=new Map();
  let handle=null;
  for(const item of items){
    const [x,y,depth]=projection.project([item.x,0,item.z]),id=item.uid??item.id;
    const owner=ids.push(id)-1;
    const assetKey=JSON.stringify([Math.round((view.surface?.rain||0)*24),Math.round((view.surface?.snow||0)*24),item.kind,item.growth,item.latin,item.family,item.form,item.model,item.palette,item.size,item.rotation,item.scale,item.potStyle,item.potSticker,item.plantCharm]);
    let asset=currentObjects.get(assetKey)||cache.objects.get(assetKey);
    if(!asset)asset={faces:studioObjectFaces(item,view,projection,ratio),radius:studioFootprint(item,zone)};
    currentObjects.set(assetKey,asset);
    for(const surface of asset.faces){
      if((surface.color>>>24)===255)studioRasterFace(frame,surface,x*ratio,y*ratio,depth,owner);
      else transparent.push({surface,dx:x*ratio,dy:y*ratio,dz:depth,id:owner,depth:depth+surface.depth});
    }
    const r=asset.radius*projection.scale;
    if(!item.kind&&!studioIndoor(zone))paintPlantingBasin(ctx,projection,item,asset.radius,weather,scene==='starlight');
    ctx.fillStyle='#3549322d';ctx.beginPath();ctx.ellipse(x+1,y+1,r*.96,Math.max(.6,r*.85*Math.sin(pitch)),0,0,Math.PI*2);ctx.fill();
    if(selected===id){
      const orbit=Math.max(r+12,38),rotation=item.rotation||0;
      ctx.strokeStyle='#466b54';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,orbit,orbit*Math.sin(pitch),0,0,Math.PI*2);ctx.stroke();
      handle=[x+orbit*Math.cos(rotation+angle),y+orbit*Math.sin(rotation+angle)*Math.sin(pitch),rotation];
    }
  }
  cache.objects=currentObjects;
  transparent.sort((a,b)=>a.depth-b.depth);
  for(const t of transparent)studioRasterFace(frame,t.surface,t.dx,t.dy,t.dz,t.id);
  cache.overlay.getContext('2d').putImageData(frame.image,0,0);
  ctx.resetTransform();ctx.drawImage(cache.overlay,0,0);
  function hit(px,py,tolerance=0){
    const x=Math.floor(px*ratio),y=Math.floor(py*ratio);
    if(x<0||y<0||x>=pw||y>=ph)return null;
    const center=y*pw+x,exact=frame.owners[center];
    if(exact||!tolerance)return ids[exact];
    const limit=Math.ceil(tolerance*ratio),front=cache.architecture.depth[center];
    let closest=limit*limit+.01,owner=0;
    for(let dy=-limit;dy<=limit;dy++){
      if(y+dy<0||y+dy>=ph)continue;
      for(let dx=-limit;dx<=limit;dx++){
        const distance=dx*dx+dy*dy;
        if(distance>=closest||x+dx<0||x+dx>=pw)continue;
        const i=(y+dy)*pw+x+dx;
        if(frame.owners[i]&&frame.depth[i]>=front-.06){closest=distance;owner=frame.owners[i]}
      }
    }
    return ids[owner];
  }
  // Clip indoor weather and window clicks to the same visible glass pixels.
  let windowMask=null;
  if(habitat.panes.length){
    if(!cache.paneImage)cache.paneImage=new ImageData(pw,ph);
    const pixels=new Uint32Array(cache.paneImage.data.buffer);
    pixels.fill(0);
    const mask={width:pw,height:ph,depth:frame.depth,pixels};
    for(const pane of habitat.panes)studioRasterFace(mask,pane);
    // The scene overlay has already been composited, and can now hold the mask.
    cache.overlay.getContext('2d').putImageData(cache.paneImage,0,0);
    windowMask=cache.overlay;
  }
  function windowHit(x,y){
    const px=Math.floor(x*ratio),py=Math.floor(y*ratio);
    return !!windowMask&&px>=0&&py>=0&&px<pw&&py<ph&&cache.paneImage.data[(py*pw+px)*4+3]>0;
  }
  return {surface:view.surface,night:scene==='starlight',hit,handle,ground:projection.ground,windowHit,windowMask,width,height,ratio};
}
