// Low-poly meshes in world coordinates, rendered with an orthographic orbit camera.
function gardenScene(canvas, inspect) {
  const ctx = canvas.getContext('2d');
  let meshes=[], hits=[], angle=.68, pitch=.53, zoom=1, extent=5, active=-1, layer=0;
  const face=(vertices,color)=>meshes.push({vertices,color,owner:active,layer});
  function ring(x,y,z,rx,rz,n,phase=0){
    return Array.from({length:n},(_,i)=>{
      const a=phase+2*Math.PI*i/n;
      return [x+rx*Math.cos(a),y,z+rz*Math.sin(a)];
    });
  }
  function loft(lower,upper,colors){
    lower.forEach((p,i)=>{const j=(i+1)%lower.length;face([p,lower[j],upper[j],upper[i]],colors[i%colors.length])});
    face(upper,colors[0]);
  }
  function box(x,y,z,w,h,d,colors){
    const corners=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]];
    loft(corners,corners.map(([x,y,z])=>[x,y+h,z]),colors);
  }
  const bark=['#92704b','#785535','#ad875b'],gold=['#b5c85e','#9fb449','#d5d76c','#aaba51'],red=['#db8961','#bd6148','#eaaa71','#cb7553'],green=['#86ac77','#699865','#a3c18a','#78a06e'];
  function crown(x,y,z,r,h,palette,phase){
    const middle=ring(x,y+h*.44,z,r,r*.87,7,phase);
    loft(ring(x,y,z,r*.48,r*.40,7,phase+.16),middle,palette);
    loft(middle,ring(x+.09,y+h,z-.06,r*.23,r*.2,7,phase+.25),palette.slice(1).concat(palette[0]));
  }
  function tree(x,z,record){
    const species=record.latin.toLowerCase();
    const type=species.startsWith('ginkgo ')?0:species.startsWith('acer ')?1:species.startsWith('salix ')?2:3;
    const palette=[gold,red,green,['#72ad80','#59936c','#93bd85','#68996d']][type];
    loft(ring(x,.03,z,.17,.17,7),ring(x,1.55,z,.09,.09,7),bark);
    for(let i=0;i<5;i++){
      const a=i*2.4,dx=Math.cos(a)*.48,dz=Math.sin(a)*.48,y=1.05+.13*i;
      loft(ring(x,y-.4,z,.09,.09,5),ring(x+dx,y+.24,z+dz,.05,.05,5),bark);
      crown(x+dx,type===2?.61:y,z+dz,type===2?.41:.54,type===2?1.38:.8,palette,a);
    }
    crown(x,1.68,z,type===0?.62:.57,type===0?1.18:.84,palette,.1);
  }
  function build(records){
    meshes=[];active=-1;layer=0;
    const cols=Math.max(2,Math.ceil(Math.sqrt(records.length||3))),rows=Math.max(2,Math.ceil(records.length/cols));
    const w=cols*2.35+2.8,d=rows*2.35+2.6;extent=Math.hypot(w,d)/2;
    const soil=['#bd9972','#a98764','#cba982'],grass=['#acc983','#99b676','#b7d08f'];
    box(0,-.65,0,w,.52,d,soil);layer=1;box(0,-.13,0,w+.04,.13,d+.04,grass);
    layer=2;const pathX=-w/2+.86;
    for(let i=0;i<Math.floor(d/.68);i++)box(pathX,.015,-d/2+.47+i*.68,.73,.05,.49,['#dfd4b0','#c9bb95']);
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const x=(i-(cols-1)/2)*2.35+.58,z=(j-(rows-1)/2)*2.35;
      loft(ring(x,.011,z,.92,.78,10),ring(x,.08,z,.94,.8,10),['#c5b88c','#cfc499']);
    }
    layer=3;
    for(let z of [-d/2+.5,d/2-.5]){
      for(let dx of [-.48,.48])box(pathX+dx,.01,z,.12,1.1,.13,bark);
      box(pathX,1.12,z,1.35,.18,.25,bark);
    }
    for(let i=0;i<records.length;i++){
      active=i;tree((i%cols-(cols-1)/2)*2.35+.58,(Math.floor(i/cols)-(rows-1)/2)*2.35,records[i]);
    }
    active=-1;draw();
  }
  function draw(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const ratio=Math.min(2,devicePixelRatio||1);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    const scale=Math.min(w/(extent*2.24),h/(extent*1.70+1.8))*zoom;
    const ca=Math.cos(angle),sa=Math.sin(angle),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const project=([x,y,z])=>{const depth=x*sa+z*ca;return [w/2+(x*ca-z*sa)*scale,h*.54+(depth*sp-y*cp)*scale,depth*cp+y*sp]};
    const ordered=meshes.map(f=>{const p=f.vertices.map(project);return {...f,p,depth:p.reduce((n,v)=>n+v[2],0)/p.length}}).sort((a,b)=>a.layer-b.layer||a.depth-b.depth);
    hits=[];
    for(const f of ordered){const shape=new Path2D();f.p.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();ctx.fillStyle=ctx.strokeStyle=f.color;ctx.lineWidth=.55;ctx.fill(shape);ctx.stroke(shape);if(f.owner>=0)hits.push([shape,f.owner])}
  }
  let drag;
  canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,a:angle,p:pitch,moved:false};canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;angle=drag.a+dx*.009;pitch=Math.max(.23,Math.min(1.18,drag.p+dy*.006));draw()};
  canvas.onpointercancel=()=>{drag=null};
  canvas.onpointerup=e=>{if(drag&&!drag.moved){let rect=canvas.getBoundingClientRect();ctx.save();ctx.resetTransform();const hit=hits.slice().reverse().find(([p])=>ctx.isPointInPath(p,e.clientX-rect.left,e.clientY-rect.top));ctx.restore();if(hit)inspect(hit[1])}drag=null};
  const resize=factor=>{zoom=Math.max(.62,Math.min(2.4,zoom*factor));draw()};
  canvas.onwheel=e=>{e.preventDefault();resize(Math.exp(-Math.sign(e.deltaY)*.12))};
  canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')angle-=.15;else if(e.key==='ArrowRight')angle+=.15;else if(e.key==='ArrowUp')pitch=Math.min(1.18,pitch+.1);else if(e.key==='ArrowDown')pitch=Math.max(.23,pitch-.1);else resize(e.key==='-'?.9:1.1);draw()};
  $('larger').onclick=()=>resize(1.2);$('smaller').onclick=()=>resize(1/1.2);$('resetView').onclick=()=>{angle=.68;pitch=.53;zoom=1;draw()};
  new ResizeObserver(draw).observe(canvas);return build;
}
