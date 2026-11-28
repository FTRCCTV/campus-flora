// Tools share the garden viewport and its rendered plant hit map.
let gardenGesture=null,gardenCareBusy=false,careFrame=0;
function careAvailable(){
  return studio.mode==='view'&&studioOwner()&&!visitingGarden&&!activeStudioDraft()&&!$('garden').hidden;
}
function toolMesh(kind){
  if(kind==='water')return studioPropFaces('wateringcan',false);
  const faces=[],p=studioPrimitives((vertices,color)=>faces.push({vertices,color}));
  const rim=p.rectangle(0,.72,0,.47,.10);
  p.loft(p.rectangle(0,0,0,.61,.34),p.rectangle(0,.46,0,.65,.38),['#ad8353','#ceae74','#967246','#cba674']);
  p.loft(p.rectangle(0,.46,0,.65,.38),rim,['#dbbf88','#c2a06f','#b29565']);
  p.box(0,.71,0,.53,.05,.12,['#766440','#8f7953','#7a6746']);
  p.box(0,.16,.197,.33,.18,.014,['#506e51','#799269','#547951']);
  return faces;
}
const careMeshes={};
function paintCareTool(ctx,kind,x,y,pouring,dragging=false){
  const mesh=careMeshes[kind]??=toolMesh(kind),proj=dragging?studio.picker.projection:studioProjection(160,140,-.38,1,1,.34);
  ctx.save();ctx.translate(x,y);
  const toolScale=dragging?1.25:2,tilt=pouring?-.65:0,cos=Math.cos(tilt),sin=Math.sin(tilt);
  const origin=proj.project([0,0,0]);
  const shapes=mesh.map(f=>({p:f.vertices.map(([a,b,c])=>proj.project([a*cos-b*sin,a*sin+b*cos,c])),ink:f.color}));
  for(const f of shapes.sort((a,b)=>a.p.reduce((s,p)=>s+p[2],0)/a.p.length-b.p.reduce((s,p)=>s+p[2],0)/b.p.length)){
    ctx.beginPath();f.p.forEach(([a,b],i)=>ctx[i?'lineTo':'moveTo']((a-origin[0])*toolScale,(b-origin[1])*toolScale));ctx.closePath();ctx.fillStyle=f.ink;ctx.fill();
  }
  ctx.restore();
}
function drawCareShelf(now=performance.now()){
  const canvas=$('careSurface'),world=$('world'),w=world.clientWidth,h=world.clientHeight;
  if(!w||!h)return;
  const ratio=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  if(!careAvailable())return;
  const g=gardenGesture;
  ctx.fillStyle='#efe7d5eb';ctx.fillRect(8,h-88,128,68);ctx.fillStyle='#947657';ctx.fillRect(8,h-41,128,4);ctx.fillStyle='#334939';ctx.font='12px sans-serif';ctx.textAlign='center';
  for(const [kind,x,title] of [['water',42,'水壶'],['nutrient',101,'肥料袋']]){
    if(g?.kind!==kind)paintCareTool(ctx,kind,x,h-42,false);
    ctx.fillText(title,x,h-23);
  }
  if(!g)return;
  {
    paintCareTool(ctx,g.kind,g.x-12,g.y-6,!!g.target,true);
    if(g.target)for(let i=0;i<13;i++){
      const t=(now/430+i/13)%1;
      ctx.fillStyle=g.kind==='water'?'#69b7d7':'#aa814e';ctx.beginPath();
      ctx.ellipse(g.x+Math.sin(i)*t*8,g.y+4+t*t*36,1.7,g.kind==='water'?3.5:1.8,0,0,Math.PI*2);ctx.fill();
    }
  }
  if(g.target){ctx.fillStyle='#243c33e8';ctx.fillRect(w/2-67,9,134,27);ctx.fillStyle='white';ctx.fillText(g.target.name+' · '+Math.round(g.progress*100)+'%',w/2,27)}
}
async function finishGardenGesture(commit){
  const g=gardenGesture;if(!g)return;
  gardenGesture=null;cancelAnimationFrame(careFrame);scheduleStudio();
  if(!commit||!g.target||gardenCareBusy)return;
  gardenCareBusy=true;
  try{await careForPlant(g.target,g.kind,g.owner);route();toast(g.target.name+'已完成'+careVerbs[g.kind])}
  catch(e){toast(e.message)}finally{gardenCareBusy=false;scheduleStudio()}
}
function initSceneCare(){
  const world=$('world');
  const pos=e=>{const r=world.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  function target(x,y,tool){
    for(const offset of tool?[0,10,20,32,46]:[0]){
      const id=studio.picker?.hit(x,y+offset,4),p=studio.items.find(p=>p.uid===id&&p.latin&&!p.studioSample);
      if(p)return p;
    }
  }
  function tick(now){
    const g=gardenGesture;if(!g)return;
    if(!careAvailable()||studioScope()!==g.scope){finishGardenGesture(false);return}
    {
      const plant=target(g.x,g.y,true);
      if(plant?.uid!==g.target?.uid)g.progress=0;
      g.target=plant;
      // The scene hit map accounts for nearer plants, props and camera rotation.
      if(plant)g.progress=Math.min(1,g.progress+Math.max(0,Math.min(60,now-g.last))/1200);
      if(g.progress===1){finishGardenGesture(true);return}
    }
    g.last=now;drawCareShelf(now);careFrame=requestAnimationFrame(tick);
  }
  world.addEventListener('pointerdown',e=>{
    if(!careAvailable()||studio.busy||gardenCareBusy||gardenGesture||e.button!==0)return;
    const [x,y]=pos(e),h=world.clientHeight;
    if(x<8||x>136||y<h-88||y>h-20)return;
    const kind=x<72?'water':'nutrient';
    e.stopImmediatePropagation();e.preventDefault();world.setPointerCapture(e.pointerId);
    gardenGesture={kind,pid:e.pointerId,scope:studioScope(),owner:studioOwner(),x,y,progress:0,last:performance.now()};
    tick(performance.now());
  },true);
  world.addEventListener('pointermove',e=>{
    const g=gardenGesture;if(!g||g.pid!==e.pointerId)return;e.stopImmediatePropagation();
    [g.x,g.y]=pos(e);
  },true);
  world.addEventListener('pointerup',e=>{
    const g=gardenGesture;if(!g||g.pid!==e.pointerId)return;e.stopImmediatePropagation();
    finishGardenGesture(false);
  },true);
  for(const event of ['pointercancel','lostpointercapture'])world.addEventListener(event,e=>{if(gardenGesture?.pid===e.pointerId)finishGardenGesture(false)});
}
function initGardenSound(){
  const button=$('gardenSound');let audio,source,filter,volume,enabled=false;
  function sync(){
    if(!audio)return;
    const scene=studio.design?.scene,indoor=studioIndoor(zone);
    const tone=indoor?330:({campus:760,terrace:1350,courtyard:580,reedpond:1750,starlight:260}[scene]||750);
    filter.frequency.setTargetAtTime(tone+(studio.design?.weather==='rain'?680:0),audio.currentTime,.8);
    volume.gain.setTargetAtTime(enabled&&!document.hidden&&location.hash==='#garden'? (indoor?.07:.12):0,audio.currentTime,.25);
  }
  function accent(){
    if(!enabled||document.hidden||location.hash!=='#garden'||studioIndoor(zone)||!audio)return;
    const scene=studio.design?.scene;
    if(scene==='terrace'||studio.design?.weather==='rain')return;
    const pond=scene==='reedpond',night=scene==='starlight',at=audio.currentTime;
    const base=(pond?480:night?2900:scene==='courtyard'?1550:2100)*(1+Math.random()*.16);
    for(let i=0;i<(pond?1:2);i++){
      const start=at+i*.16,voice=audio.createOscillator(),amp=audio.createGain();
      voice.frequency.setValueAtTime(base,start);voice.frequency.exponentialRampToValueAtTime(base*(pond?1.7:night?.96:1.25),start+.13);
      amp.gain.setValueAtTime(.0001,start);amp.gain.exponentialRampToValueAtTime(night?.07:.16,start+.035);amp.gain.exponentialRampToValueAtTime(.0001,start+.16);
      voice.connect(amp).connect(volume);voice.start(start);voice.stop(start+.18);voice.onended=()=>{voice.disconnect();amp.disconnect()};
    }
  }
  let accents;
  button.onclick=async()=>{
    try{
      if(!audio){
        audio=new AudioContext();const buffer=audio.createBuffer(1,audio.sampleRate*6,audio.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(.76+.18*Math.sin(i/data.length*Math.PI*2));
        source=audio.createBufferSource();source.buffer=buffer;source.loop=true;filter=audio.createBiquadFilter();filter.type='lowpass';
        volume=audio.createGain();volume.gain.value=0;source.connect(filter).connect(volume).connect(audio.destination);source.start();
      }
      await audio.resume();enabled=!enabled;clearInterval(accents);if(enabled)accents=setInterval(accent,3700);button.textContent=enabled?'关闭环境声':'开启环境声';button.setAttribute('aria-pressed',String(enabled));sync();
    }catch{toast('当前设备暂时无法播放环境声。')}
  };
  window.addEventListener('hashchange',sync);document.addEventListener('visibilitychange',sync);
  button.addEventListener('gardenchange',sync);
}
