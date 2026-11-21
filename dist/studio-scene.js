// Garden studio geometry, projection and picking share one world-space coordinate system.
const studioPropRadius=GardenLayout.propRadii;
const studioPlantMeshes=new Map();
function studioIndoor(zone){return ['sill','bench','shelf'].includes(zone)}
function studioPlantAsset(item,zone){
  const indoor=studioIndoor(zone);
  const key=JSON.stringify([indoor,item.latin,item.family,item.size,item.form,item.model,item.palette]);
  if(studioPlantMeshes.has(key))return studioPlantMeshes.get(key);
  const faces=specimenMesh(item,indoor);
  let radius=0;
  for(const face of faces)for(const [x,,z] of face.vertices)radius=Math.max(radius,Math.hypot(x,z));
  const asset={faces,radius};
  if(studioPlantMeshes.size>=64)studioPlantMeshes.delete(studioPlantMeshes.keys().next().value);
  studioPlantMeshes.set(key,asset);
  return asset;
}
function studioFootprint(item,zone){
  return Object.hasOwn(studioPropRadius,item.kind)?studioPropRadius[item.kind]:studioPlantAsset(item,zone||item.zone).radius;
}

function studioProjection(width,height,angle,zoom,extent,pitch=.53,panX=0,panY=0){
  const edge=extent+.62, cp=Math.cos(pitch),sp=Math.sin(pitch),ca=Math.cos(angle),sa=Math.sin(angle);
  const scale=zoom*Math.min(width/(2.92*edge+1.35),height/(1.58*edge+3.4));
  const cx=width*(.5+panX),cy=height*(.56+panY);
  function project([x,y,z]){
    const d=x*sa+z*ca;
    return [cx+(x*ca-z*sa)*scale,cy+(d*sp-y*cp)*scale,d*cp+y*sp];
  }
  function ground(px,py){
    const u=(px-cx)/scale,v=sp>.001?(py-cy)/(sp*scale):0;
    return {x:u*ca+v*sa,z:-u*sa+v*ca};
  }
  return {ground,project,scale,edge};
}
function studioPrimitives(face){
  function ring(x,y,z,rx,rz,n=10,offset=0){
    return Array.from({length:n},(_,i)=>{
      const a=2*Math.PI*i/n+offset;
      return [x+rx*Math.cos(a),y,z+rz*Math.sin(a)];
    });
  }
  function loft(bottom,top,colors){
    for(let i=0;i<bottom.length;i++){
      const j=(i+1)%bottom.length;face([bottom[i],bottom[j],top[j],top[i]],colors[i%(colors.length-1)]);
    }
    face(top,colors[colors.length-1]);
  }
  function rectangle(x,y,z,w,d){return [[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]]}
  function box(x,y,z,w,h,d,colors){loft(rectangle(x,y,z,w,d),rectangle(x,y+h,z,w,d),colors)}
  function pillar(x,y,z,rx,rz,h,colors,n=10,top=1){
    loft(ring(x,y,z,rx,rz,n),ring(x,y+h,z,rx*top,rz*top,n),colors);
  }
  return {ring,loft,rectangle,box,pillar};
}
function studioPropFaces(kind,snowy){
  const faces=[],face=(vertices,color)=>faces.push({vertices,color});
  const {ring,loft,box,pillar}=studioPrimitives(face);
  const wood=['#9a7052','#ac8463','#b99068','#d2a97d'];
  const darkWood=['#74553f','#876348','#856548','#a77c54'];
  const metal=['#4d6960','#658176','#5d756b','#879b86'];
  const stone=['#a6ac9b','#969f91','#b2b7a6','#ccd0bc'];
  const brick=['#b8795f','#a96d57','#c58d6b','#d4a383'];
  const lacquer=['#8b4e41','#a5624e','#965c48','#b27457'];
  const roof=['#657775','#758884','#697874',snowy?'#dee7de':'#909c90'];
  function prop(kind){
    if(kind==='bench'){
      for(const x of [-.60,.60]){
        for(const z of [-.16,.16])box(x,.01,z,.09,.39,.10,metal);
        box(x,.38,-.19,.07,.45,.075,metal);
      }
      for(let i=0;i<3;i++)box(0,.39,-.14+i*.14,1.58,.06,.112,wood);
      for(const y of [.65,.81])box(0,y,-.21,1.58,.085,.07,wood);
    }else if(kind==='lantern'){
      pillar(0,0,0,.32,.32,.11,stone,8);pillar(0,.11,0,.19,.19,.56,stone,8,.78);
      box(0,.65,0,.46,.08,.46,darkWood);
      box(0,.73,0,.33,.39,.33,['#e0b96d','#ffe5a2','#edc981','#fff0ba']);
      for(const x of [-.18,.18])for(const z of [-.18,.18])box(x,.72,z,.045,.43,.045,metal);
      loft(ring(0,1.13,0,.35,.35,4,.785),ring(0,1.31,0,.075,.075,4,.785),roof);
      pillar(0,1.31,0,.05,.05,.10,metal,6);
    }else if(kind==='rock'){
      loft(ring(0,.015,0,.60,.45,7,.38),ring(-.09,.36,.015,.43,.32,7,.17),stone);
      loft(ring(-.09,.36,.015,.43,.32,7,.17),ring(-.13,.57,-.03,.17,.13,7,.08),['#a2aa94','#aeb59d','#bcc3aa','#cbd0b8']);
    }else if(kind==='arch'){
      for(const x of [-.78,.78]){
        box(x,.01,0,.28,.16,.43,stone);
        for(const z of [-.14,.14])box(x,.17,z,.106,1.52,.11,darkWood);
        for(let i=0;i<4;i++)box(x,.36+i*.30,0,.09,.07,.38,wood);
      }
      box(0,1.62,0,1.87,.13,.29,wood);
      for(let i=0;i<6;i++)box(-.85+i*.34,1.76,0,.10,.10,.70,wood);
    }else if(kind==='planter'){
      pillar(0,0,0,.35,.35,.48,brick,8,1.26);pillar(0,.48,0,.48,.48,.09,brick,8);
      face(ring(0,.574,0,.425,.425,8),'#705440');
      for(let j=0;j<9;j++){
        const a=j*2.4,x=.29*Math.cos(a),z=.29*Math.sin(a),h=.78+.12*(j%3);
        face([[x*.45,.58,z*.45],[x+.07,h,z],[x+.12,.61,z+.045]],'#7d9664');
        face(ring(x,h,z,.085,.08,5,a),['#e0b456','#f4e3ac','#cd8e83'][j%3]);
      }
    }
  }
  if(['bench','lantern','rock','arch','planter'].includes(kind))prop(kind);
  else studioSetpiece(kind,{face,...studioPrimitives(face)},snowy);
  return faces;
}
function buildStudioBackdrop(canvas,view,projection,ratio){
  const {scene,weather,zone,angle,extent}=view,width=canvas.width/ratio,height=canvas.height/ratio;
  const {project,edge}=projection,ctx=canvas.getContext('2d');
  const inside=studioIndoor(zone),terrace=scene==='terrace',court=scene==='courtyard';
  const rainy=weather==='rain',snowy=weather==='snow';
  ctx.setTransform(ratio,0,0,ratio,0,0);
  const sky=ctx.createLinearGradient(0,0,0,height);
  const stops=snowy?['#afc0c9','#e7ede8','#d5ded8']:rainy?['#899eaa','#cfdbd6','#b9cabe']:
    terrace?['#a8d1ce','#f8e7bf','#e1e0c4']:court?['#c4d8c7','#f6ebce','#e2dfc4']:['#b4d8d3','#f5edcd','#d9e4ca'];
  sky.addColorStop(0,stops[0]);sky.addColorStop(.64,stops[1]);sky.addColorStop(1,stops[2]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  if(!rainy&&!snowy){
    const sx=width*.77,sy=height*.18,r=Math.min(height,width)*.068;
    const glow=ctx.createRadialGradient(sx,sy,r*.55,sx,sy,r*3.4);
    glow.addColorStop(0,'#fff6d9b5');glow.addColorStop(1,'#fff6d900');
    ctx.fillStyle=glow;ctx.fillRect(sx-r*3.4,sy-r*3.4,r*6.8,r*6.8);
    ctx.fillStyle='#fff5d8';ctx.beginPath();ctx.arc(sx,sy,r,0,2*Math.PI);ctx.fill();
  }
  function ridge(fraction,tone,amplitude,offset){
    ctx.fillStyle=tone;ctx.beginPath();ctx.moveTo(0,height);
    for(let i=0;i<=32;i++){
      const x=i/32,y=fraction+amplitude*(Math.sin(i*.54+offset)+.5*Math.cos(i*.96+offset));
      ctx.lineTo(width*x,height*y);
    }
    ctx.lineTo(width,height);ctx.closePath();ctx.fill();
  }
  ridge(.48,snowy?'#c2d0cf':rainy?'#acbeba':'#bfd3bf',.038,1.4);
  ridge(.53,snowy?'#cdd9d2':rainy?'#b4c3bc':'#cbdcc2',.026,3.5);
  if(terrace){
    ctx.fillStyle=snowy?'#b1c1c1':rainy?'#a0b2ae':'#b3c7ba';
    for(let i=0;i<27;i++){
      const bx=(i-.5)/26*width,by=(.46+.055*Math.sin(i*5.34))*height,bw=width/30;
      ctx.fillRect(bx,by,bw,height*.56-by);
      if(i%5===0)ctx.fillRect(bx+bw*.42,by-height*.027,bw*.1,height*.03);
    }
  }
  const projected=[];
  let layer=0;
  function face(vertices,color){
    const p=vertices.map(project);
    const drawLayer=layer===2&&vertices.every(v=>v[1]<-.04)?-1:layer;
    projected.push({p,color,layer:drawLayer,depth:p.reduce((sum,v)=>sum+v[2],0)/p.length});
  }
  const {ring,box,pillar,rectangle}=studioPrimitives(face);
  const floor=inside?['#cba47f','#af8968','#c39872',zone==='shelf'?'#cda77d':zone==='bench'?'#c2a07b':'#dfc5a1']:
    terrace?['#b1a69a','#bcae9b','#a29586',snowy?'#e4e7dd':'#ddc7ae']:
    court?['#a59888','#b3ab9a','#aaa18b',snowy?'#e3e8dd':'#c4c5ab']:
    ['#baa17f','#ab9376','#af987c',snowy?'#e7ebdd':zone==='pond'?'#a9c09e':zone==='meadow'?'#b5c887':'#b5be94'];
  layer=0;box(0,-.39,0,edge*2,.39,edge*2,floor);
  layer=1;
  // Surface seams and turf accents are flat and never consume placement space.
  if(inside||terrace||court){
    const gap=inside?.82:1.24,grout=inside?'#98775740':'#9d9d875a';
    for(let z=-edge+gap;z<edge;z+=gap)face(rectangle(0,.003,z,edge*2,.024),grout);
    if(!inside)for(let x=-edge+gap;x<edge;x+=gap)face(rectangle(x,.004,0,.022,edge*2),grout);
  }else{
    for(let i=0;i<85;i++){
      const x=Math.sin(i*17.03)*Math.cos(i*3.33)*extent,z=Math.sin(i*9.27)*extent;
      face(ring(x,.006,z,.056+(i%3)*.025,.03,5),snowy?'#d1dccc':'#94ae7c77');
    }
  }
  layer=2;
  // Landmarks stay in world space as the visitor turns the camera.
  const habitat=drawHabitat({zone,scene,weather,extent,angle,face,box,pillar,ring,rectangle,project,setLayer:n=>{layer=n}});
  projected.sort((a,b)=>a.layer-b.layer||a.depth-b.depth);
  ctx.lineJoin='round';ctx.lineWidth=.32;
  for(const f of projected){
    ctx.beginPath();f.p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.fillStyle=ctx.strokeStyle=f.color;ctx.fill();ctx.stroke();
  }
  return habitat;
}
