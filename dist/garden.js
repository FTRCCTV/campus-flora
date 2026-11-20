// All scene geometry uses Y-up coordinates. Mesh owners are indices in the
// caller's record array so a plant stays selectable from every camera angle.
function gardenScene(canvas, inspect, onEmptySlot) {
  const ctx = canvas.getContext('2d');
  const wood = ['#ac815c', '#947051', '#b68e67', '#8a664c'];
  const stone = ['#c0b8a1', '#a9ac97', '#d6cbb1', '#b4ae98'];
  const foliage = ['#708f60', '#85a377', '#93ad74'];
  const zones = ['pond', 'path', 'meadow'];
  const initialCamera = {angle: .62, pitch: .57, zoom: 1};
  let {angle, pitch, zoom} = initialCamera;
  let meshes = [], hits = [], active = -1, layer = 0;
  let width = 12, depth = 9, tallest = 2;
  let drag = null, frame = 0;

  function face(vertices, color, emptySlot) {
    meshes.push({vertices, color, owner: active, layer, emptySlot});
  }
  function ring(x, y, z, rx, rz, sides, phase = 0) {
    return Array.from({length: sides}, (_, i) => {
      const a = phase + Math.PI * 2 * i / sides;
      return [x + rx * Math.cos(a), y, z + rz * Math.sin(a)];
    });
  }
  function loft(bottom, top, colors, lid = colors[0]) {
    for (let i = 0; i < bottom.length; i++) {
      const j = (i + 1) % bottom.length;
      face([bottom[i], bottom[j], top[j], top[i]], colors[i % colors.length]);
    }
    face(top, lid);
  }
  function box(x, y, z, w, h, d, colors) {
    const bottom = [[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]];
    loft(bottom, bottom.map(([px,py,pz]) => [px, py+h, pz]), colors);
  }
  function tile(x, y, z, w, d, cut) {
    const a=w/2, b=d/2;
    return [[-a+cut,-b],[a-cut,-b],[a,-b+cut],[a,b-cut],[a-cut,b],[-a+cut,b],[-a,b-cut],[-a,-b+cut]]
      .map(([dx,dz])=>[x+dx,y,z+dz]);
  }
  function rock(x, z, r, h, y = .04) {
    const lower = ring(x,y,z,r,r*.66,6,.32);
    const upper = ring(x-r*.12,y+h,z+r*.05,r*.59,r*.48,6,.04);
    loft(lower,upper,stone,'#cbc8b1');
  }
  function grass(x,z,h,tone) {
    for(let i=0;i<4;i++){
      const a=i*2.4+.53,dx=Math.cos(a),dz=Math.sin(a),r=h*.35;
      face([[x-.04*dz,.045,z+.04*dx],[x+.04*dz,.045,z-.04*dx],[x+dx*r,h*(.6+i*.13),z+dz*r]],foliage[(i+tone)%3]);
    }
  }
  function pond(x,z) {
    const outer=ring(x,.055,z,1.46,1.01,12,.18);
    const water=ring(x,.062,z,1.33,.87,12,.18);
    for(let i=0;i<outer.length;i++){
      const j=(i+1)%outer.length;
      face([outer[i],outer[j],water[j],water[i]],stone[i%4]);
    }
    face(water,'#79aaa0');
    face(ring(x-.16,.065,z-.14,.9,.48,9,.19),'#73a49d');
    layer=3;
    for(let i=0;i<4;i++){
      const px=x-.63+i*.32,pz=z+.15*Math.cos(i*1.8);
      face([[px,.07,pz],[px+.22,.07,pz-.02],[px+.33,.07,pz+.015],[px+.07,.07,pz+.028]],'#c6d9c6');
    }
    for(let i=0;i<3;i++){
      const px=x+.2+i*.19,pz=z+.32+.09*Math.sin(i*2);
      const pad=ring(px,.083,pz,.15,.10,9);
      pad.splice(1,0,[px,.083,pz]);face(pad,['#9eae76','#aeba83','#8ea470'][i]);
    }
    for(let i=0;i<5;i++){
      const a=2.35+i*.35;
      grass(x+1.3*Math.cos(a),z+.94*Math.sin(a),.35+.15*(i%2),i);
    }
    rock(x+1.18,z-.47,.28,.18); rock(x+1.07,z-.72,.18,.11);rock(x-.87,z+.73,.24,.12);
  }
  function bench(x,z) {
    const iron=['#637869','#50675c','#758979'];
    for(const dx of [-.57,.57]){
      for(const dz of [-.15,.17])box(x+dx,.04,z+dz,.10,.38,.10,iron);
      box(x+dx,.38,z-.2,.075,.47,.08,iron);
    }
    for(let i=0;i<3;i++)box(x,.39,z-.14+i*.14,1.54,.07,.115,wood);
    box(x,.63,z-.22,1.54,.085,.075,wood);
    box(x,.79,z-.22,1.54,.085,.075,wood);
  }
  function pergola(x,z) {
    for(const dx of [-.92,.92]) {
      for(const dz of [-.49,.49]){
        box(x+dx,.025,z+dz,.22,.13,.22,stone);
        box(x+dx,.15,z+dz,.115,1.47,.115,wood);
      }
      box(x+dx,1.58,z,.17,.15,1.38,wood);
    }
    for(let i=0;i<6;i++)box(x,1.72,z-.64+i*.255,2.24,.11,.11,wood);
    bench(x,z);
  }
  function wildflowers(x,z) {
    for(let i=0;i<16;i++){
      const a=i*2.4,r=.2+.8*Math.sqrt(i/16),px=x+r*Math.cos(a),pz=z+.64*r*Math.sin(a);
      grass(px,pz,.20+.06*(i%4),i);
      if(i%2) {
        const h=.23+.04*(i%4);
        face([[px-.02,.06,pz],[px+.02,.06,pz],[px+.015,h,pz]],'#758e64');
        face(ring(px,h,pz,.068,.06,5,a),i%3?'#ebd998':'#c5aec2');
      }
    }
  }
  function layOut(records) {
    const occupied=Object.fromEntries(zones.map(zone=>[zone,new Set()]));
    return records.map((record,index)=>{
      // The fallback is for demo plants and records from the first release.
      const zone=occupied[record.zone] instanceof Set ? record.zone : zones[index%zones.length];
      const taken=occupied[zone];
      let slot=Number.isSafeInteger(record.slot)&&record.slot>=0 ? record.slot : 0;
      while(taken.has(slot))slot++;
      taken.add(slot);
      return {record,index,zone,slot};
    });
  }
  function build(records, focusedZone) {
    meshes=[];hits=[];active=-1;layer=0;tallest=1.8;
    const plants=layOut(records);
    const slots=Math.max(2,...plants.map(p=>p.slot+2));
    const planted=new Set(plants.map(p=>p.zone+'/'+p.slot));
    const lanes=Math.max(1,Math.ceil(Math.sqrt(slots/3)));
    const rows=Math.max(2,Math.ceil(slots/lanes));
    const spacing=2.95,section=lanes*spacing+.65;
    width=3*section+2.15;depth=rows*spacing+3.5;
    const left=-width/2,back=-depth/2;
    const zoneX=i=>left+1.075+section*(i+.5);
    const position=(zone,slot)=>[zoneX(zones.indexOf(zone))+(slot%lanes-(lanes-1)/2)*spacing,back+3.65+spacing*Math.floor(slot/lanes)];
    const ground=tile(0,-.53,0,width-.26,depth-.26,.58);
    loft(ground,tile(0,-.17,0,width,depth,.68),['#bb9875','#b28e6b','#a58665','#c7a680']);
    layer=1;loft(tile(0,-.17,0,width,depth,.68),tile(0,0,0,width,depth,.68),['#a4b87c','#91a976','#b2be84'],'#b6c991');
    // Each planting strip has its own ground treatment and a fixed landmark.
    for(let i=0;i<3;i++){
      const z=back+3.65+(rows-1)*spacing/2;
      if(zones[i]===focusedZone){
        layer=1.1;face(tile(zoneX(i),.012,z,section-.10,rows*spacing+.04,.39),'#698557');
      }
      layer=1.2;
      face(tile(zoneX(i),.019,z,section-.27,rows*spacing-.18,.34),['#a9c194','#c5c6a0','#afc689'][i]);
    }
    const walkZ=back+2.28;
    layer=1.3;
    face(tile(0,.03,walkZ,width-1.1,.62,.19),'#ded0ab');
    for(const i of [0,1]){
      const x=(zoneX(i)+zoneX(i+1))/2;
      layer=1.3;
      face(tile(x,.032,back+depth*.60,.51,depth*.72,.13),'#ddcfab');
      layer=1.4;
      for(let j=0;j<rows*3;j++){
        const z=walkZ+.49+j*.78;
        if(z>depth/2-.5)break;
        face(tile(x,.038,z,.38,.47,.09),j%2?'#c7bea2':'#cfc5a6');
      }
    }
    for(let i=0;i<3;i++)for(let slot=0;slot<rows*lanes;slot++){
      const [x,z]=position(zones[i],slot);
      const boundary=ring(x,.04,z,.90,.72,10,.22);
      const emptySlot=onEmptySlot&&!planted.has(zones[i]+'/'+slot) ? {zone:zones[i],slot} : null;
      layer=1.5;
      face(boundary,['#93ac80','#b4a280','#9eb17a'][i],emptySlot);
      layer=1.6;
      face(ring(x,.046,z,.80,.63,10,.22),['#afbf91','#c3b491','#b3c58a'][i],emptySlot);
      if(emptySlot){
        layer=1.7;
        face(tile(x,.05,z,.36,.085,.022),'#f2eed7',emptySlot);
        face(tile(x,.05,z,.085,.36,.022),'#f2eed7',emptySlot);
      }
    }
    layer=2;pond(zoneX(0),back+1.25);
    layer=3;pergola(zoneX(1),back+1.12);
    wildflowers(zoneX(2),back+1.25);
    // A short split-rail fence outlines the meadow and leaves the path open.
    const fenceZ=back+.43,meadowX=zoneX(2);
    for(let i=0;i<4;i++)box(meadowX-1.09+.73*i,.025,fenceZ,.10,.52,.10,wood);
    for(const y of [.21,.39])box(meadowX,y,fenceZ,2.29,.075,.065,wood);
    for(let i=0;i<rows;i++){
      const z=back+3.8+i*spacing;
      grass(left+.45,z,.32,1);grass(width/2-.46,z+.26,.3,2);
      rock(width/2-.42,z+.58,.15,.11);
    }
    for(const {record,index,zone,slot} of plants){
      const [x,z]=position(zone,slot);
      layer=2;active=-1;
      face(ring(x+.11,.052,z+.08,.64,.39,9,.17),'#9da978');
      layer=3;active=index;
      for(const mesh of specimenMesh(record)){
        const vertices=mesh.vertices.map(([px,y,pz])=>[px+x,y+.06,pz+z]);
        for(const vertex of vertices)tallest=Math.max(tallest,vertex[1]);
        face(vertices,mesh.color);
      }
    }
    active=-1;draw();
  }
  function draw() {
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    const ratio=Math.min(2,devicePixelRatio||1);
    const pw=Math.round(w*ratio),ph=Math.round(h*ratio);
    if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    const ca=Math.cos(angle),sa=Math.sin(angle),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const diameter=Math.hypot(width,depth);
    const scale=Math.min(w/(diameter+1.35),h/(diameter*.68+Math.max(2,tallest)+1.65))*zoom;
    const project=([x,y,z])=>{
      const d=x*sa+z*ca;
      return [w/2+(x*ca-z*sa)*scale,h*.54+(d*sp-y*cp)*scale,d*cp+y*sp];
    };
    const shadow=tile(.12,-.61,.14,width,depth,.73).map(project);
    ctx.beginPath();shadow.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.fillStyle='#64724c30';ctx.shadowColor='#5b694936';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;
    const ordered=meshes.map(f=>{
      const p=f.vertices.map(project);
      return {f,p,depth:p.reduce((n,v)=>n+v[2],0)/p.length};
    }).sort((a,b)=>a.f.layer-b.f.layer||a.depth-b.depth);
    hits=[];
    for(const {f,p} of ordered){
      const shape=new Path2D();
      p.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      ctx.fillStyle=ctx.strokeStyle=f.color;ctx.lineWidth=.42;ctx.fill(shape);ctx.stroke(shape);
      if(f.layer===3||f.emptySlot)hits.push({shape,owner:f.owner,emptySlot:f.emptySlot});
    }
  }
  function redraw(){
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw()});
  }
  canvas.onpointerdown=e=>{
    if(drag)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,a:angle,p:pitch,moved:false};
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.hypot(dx,dy)>4)drag.moved=true;
    if(!drag.moved)return;
    angle=drag.a+dx*.009;pitch=Math.max(.22,Math.min(1.18,drag.p+dy*.006));redraw();
  };
  canvas.onpointercancel=e=>{if(drag?.id===e.pointerId)drag=null};
  canvas.onpointerup=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(!drag.moved){
      const rect=canvas.getBoundingClientRect();
      ctx.save();ctx.resetTransform();
      let hit;
      for(let i=hits.length-1;i>=0;i--){
        if(ctx.isPointInPath(hits[i].shape,e.clientX-rect.left,e.clientY-rect.top)){hit=hits[i];break}
      }
      ctx.restore();
      if(hit?.emptySlot)onEmptySlot(hit.emptySlot.zone,hit.emptySlot.slot);
      else if(hit&&hit.owner>=0)inspect(hit.owner);
    }
    drag=null;
  };
  function resize(factor){zoom=Math.max(.62,Math.min(2.8,zoom*factor));draw()}
  canvas.onwheel=e=>{e.preventDefault();resize(Math.exp(-Math.sign(e.deltaY)*.12))};
  canvas.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft')angle-=.15;
    else if(e.key==='ArrowRight')angle+=.15;
    else if(e.key==='ArrowUp')pitch=Math.min(1.18,pitch+.1);
    else if(e.key==='ArrowDown')pitch=Math.max(.22,pitch-.1);
    else {resize(e.key==='-'?.9:1.1);return}
    draw();
  };
  $('larger').onclick=()=>resize(1.2);
  $('smaller').onclick=()=>resize(1/1.2);
  $('resetView').onclick=()=>{({angle,pitch,zoom}=initialCamera);draw()};
  new ResizeObserver(redraw).observe(canvas);
  return build;
}
