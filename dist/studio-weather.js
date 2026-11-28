// Weather has a transparent surface so raindrops never trigger a mesh redraw.
function paintStudioWeather(canvas,frame,zone,weather,seconds,effect='none'){
  paintStudioClimate(canvas,frame,zone,weather,seconds);
  if(['butterflies','prism','meteors','aurora','seedsong','lanternsky'].includes(effect)){
    const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(frame.ratio,0,0,frame.ratio,0,0);
    paintRareEffect(ctx,effect,frame.width,frame.height,seconds);ctx.restore();return;
  }
  if(effect!=='petals'&&effect!=='fireflies')return;
  const ctx=canvas.getContext('2d'),{width:w,height:h,ratio}=frame;
  ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
  const fire=effect==='fireflies';
  for(let i=0;i<(fire?17:14);i++){
    const phase=i*2.39996;
    const x=fire?w*(.07+.86*((i*47%101)/101)) + Math.sin(seconds*.42+phase)*18:
      ((i*109+seconds*(12+i%4)+22*Math.sin(seconds*.7+phase))%(w+44)+w+44)%(w+44)-22;
    const y=fire?h*(.34+.46*((i*67%101)/101))+Math.cos(seconds*.48+phase)*13:
      ((i*79+seconds*(16+i%5))%(h+28))-14;
    ctx.save();ctx.translate(x,y);
    if(fire){
      ctx.globalAlpha=.55+.35*Math.sin(seconds*1.4+phase);ctx.shadowColor='#edcc59';ctx.shadowBlur=7*ratio;
      ctx.fillStyle='#fff1a6';ctx.beginPath();ctx.arc(0,0,2.1,0,Math.PI*2);ctx.fill();
    }else{
      ctx.rotate(phase+seconds*.8);ctx.fillStyle=i%2?'#e7a49c':'#f3c2b4';
      ctx.beginPath();ctx.ellipse(0,0,4.8,1.8+Math.abs(Math.sin(phase+seconds)),0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
// All paths are deterministic at a given time, including still photos and reduced motion.
function paintRareEffect(ctx,effect,w,h,t){
  if(effect==='seedsong'||effect==='lanternsky'){
    const lantern=effect==='lanternsky';
    for(let i=0;i<(lantern?15:23);i++){
      const phase=i*2.4,s=.58+(i%5)*.15,x=w*((i*.618+.018*Math.sin(t*.65+phase))%1),y=h*(1-((i*.381+t*(.024+i%3*.006))%1));
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      if(lantern){
        const glow=ctx.createRadialGradient(0,0,1,0,0,16);glow.addColorStop(0,'#ffc269aa');glow.addColorStop(1,'#ffd87300');ctx.fillStyle=glow;ctx.fillRect(-16,-16,32,32);
        ctx.fillStyle='#e69a60';ctx.beginPath();ctx.moveTo(-5,-7);ctx.lineTo(5,-7);ctx.lineTo(4,5);ctx.lineTo(-3,5);ctx.closePath();ctx.fill();ctx.fillStyle='#ffe3a1';ctx.fillRect(-2,3,4,2);
      }else{
        ctx.rotate(.4*Math.sin(phase+t));ctx.strokeStyle='#896f4d';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-2,9);ctx.stroke();ctx.strokeStyle='#fffdf0';ctx.beginPath();
        for(let j=-3;j<=3;j++){ctx.moveTo(0,0);ctx.lineTo(j*1.7,-5+Math.abs(j)*.7)}ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  if(effect==='butterflies'){
    for(let i=0;i<6;i++){
      const phase=i*2.4,unit=Math.min(w,h)*.015;
      const x=w*(.07+.85*((i*41%73)/73)) + Math.sin(t*.43+phase)*w*.045;
      const y=h*(.28+.47*(i%4)/4)+Math.cos(t*.65+phase)*h*.05;
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*.7+phase)*.32);
      ctx.scale(unit*(.4+.6*Math.abs(Math.cos(t*3+phase))),unit);
      for(const side of [-1,1]){
        ctx.fillStyle=['#ce9a55','#93ac96','#b18dae'][i%3];ctx.beginPath();
        ctx.ellipse(side*.59,-.30,.67,.44,side*-.62,0,2*Math.PI);ctx.fill();
        ctx.fillStyle='#e6c694';ctx.beginPath();ctx.ellipse(side*.36,.27,.40,.28,side*.5,0,2*Math.PI);ctx.fill();
      }
      ctx.fillStyle='#5d594a';ctx.fillRect(-.08,-.38,.16,.84);ctx.restore();
    }
    return;
  }
  if(effect==='prism'){
    for(let i=0;i<7;i++){
      const x=w*(i*.14+.04*Math.sin(t*.22+i)),drift=w*.22;
      const gradient=ctx.createLinearGradient(x,0,x+drift,h*.72);
      gradient.addColorStop(0,['#efbeb48a','#e6cf9a75','#a8d9d280'][i%3]);gradient.addColorStop(1,'#faf7de00');
      ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-w*.046,0);ctx.lineTo(x+w*.015,0);
      ctx.lineTo(x+drift+w*.12,h*.78);ctx.lineTo(x+drift,h*.74);ctx.closePath();ctx.fill();
    }
    return;
  }
  const veil=ctx.createLinearGradient(0,0,0,h*.69);veil.addColorStop(0,'#16274f9a');veil.addColorStop(1,'#182b4900');
  ctx.fillStyle=veil;ctx.fillRect(0,0,w,h*.69);
  if(effect==='aurora'){
    for(let band=0;band<3;band++){
      const ribbon=ctx.createLinearGradient(0,0,0,h*.44);
      ribbon.addColorStop(0,'#8bedd500');ribbon.addColorStop(.42,['#88ebbe94','#93cbd594','#b4a1da90'][band]);ribbon.addColorStop(1,'#afdacc00');
      ctx.fillStyle=ribbon;ctx.beginPath();
      const edge=x=>h*(.09+band*.045+.053*Math.sin(x*6+t*.24+band)+.042*Math.cos(x*12-t*.17));
      for(let j=0;j<=56;j++){const x=j/56;if(!j)ctx.moveTo(0,edge(0));else ctx.lineTo(x*w,edge(x))}
      for(let j=56;j>=0;j--){const x=j/56;ctx.lineTo(x*w,edge(x)+h*(.09+.035*Math.sin(x*15+band)))}
      ctx.closePath();ctx.fill();
    }
  }
  for(let i=0;i<27;i++){
    const x=w*((i*71%139)/139),y=h*(.04+.30*(i*43%89)/89);
    ctx.fillStyle='rgba(250,243,211,'+(.55+.35*Math.sin(t+i))+')';ctx.beginPath();ctx.arc(x,y,1+i%3*.35,0,2*Math.PI);ctx.fill();
    if(effect==='aurora'&&i%5===1){ctx.strokeStyle='#ecf2d65c';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.034,y-h*.022);ctx.lineTo(x+w*.068,y+h*.008);ctx.stroke()}
  }
  for(let i=0;i<3;i++){
    const progress=(t*.22+i*.33+.06)%1;if(progress>.31)continue;
    const x=w*(.22+i*.27-progress*.45),y=h*(.05+progress*.58);
    const tail=ctx.createLinearGradient(x,y,x+w*.075,y-h*.065);
    tail.addColorStop(0,'#fff4cf');tail.addColorStop(1,'#fff4cc00');
    ctx.strokeStyle=tail;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.075,y-h*.065);ctx.stroke();
  }
}
// Each stream has an independent depth, phase and falling speed. A fresh seed
// at the top of each pass moves its entry point without jumping mid-flight.
function weatherRandom(seed){
  seed=Math.imul(seed^(seed>>>16),0x21f0aaad);
  seed=Math.imul(seed^(seed>>>15),0x735a2d97);
  return ((seed^(seed>>>15))>>>0)/4294967296;
}
function makeWeatherStreams(snow){
  return Array.from({length:144},(_,i)=>{
    const seed=(snow?32291:13081)+i*29;
    const depth=.16+.84*weatherRandom(seed+1)**1.4;
    return {seed,depth,start:weatherRandom(seed+2),
      speed:(snow?20+42*depth:220+285*depth)*(.82+.37*weatherRandom(seed+3)),
      drift:snow?7+13*depth+8*weatherRandom(seed+4):4+25*depth+42*weatherRandom(seed+4),
      swing:(snow?5:1.4)+depth*(snow?10:2.2),
      tempo:.7+weatherRandom(seed+5)*1.8,phase:weatherRandom(seed+6)*Math.PI*2,
      size:(snow?.52+1.8*depth:.50+.72*depth)*(.83+.38*weatherRandom(seed+7)),
      alpha:(snow?.38:.28)+depth*.32+weatherRandom(seed+8)*.14,
      exposure:.021+.015*weatherRandom(seed+9),pale:weatherRandom(seed+10)>.36};
  }).sort((a,b)=>a.depth-b.depth);
}
const studioPrecipitation={rain:makeWeatherStreams(false),snow:makeWeatherStreams(true)};
function weatherWind(t){
  return 18*Math.sin(t*.63)+9*Math.sin(t*1.17+.9)+15*Math.sin(t*.28+2.7);
}
function drawStudioPrecipitation(ctx,type,w,h,seconds,opacity){
  if(!w||!h)return;
  const snow=type==='snow',streams=studioPrecipitation[type];
  // Work in fixed scene-height units so a high-resolution photo keeps the composition.
  const scale=h/480,width=w/scale,pad=28,travel=480+2*pad,span=width+2*pad;
  const count=Math.min(streams.length,Math.max(30,Math.round(width/(snow?8.8:6.9))));
  const wind=weatherWind(seconds),windSpeed=11.34*Math.cos(seconds*.63)+10.53*Math.cos(seconds*1.17+.9)+4.2*Math.cos(seconds*.28+2.7);
  ctx.save();ctx.scale(scale,scale);ctx.lineCap='round';
  for(let i=0;i<count;i++){
    const p=streams[Math.floor(i*streams.length/count)];
    const passes=p.start+seconds*p.speed/travel,cycle=Math.floor(passes),progress=passes-cycle;
    const age=progress*travel/p.speed,born=seconds-age;
    const entry=weatherRandom(p.seed^Math.imul(cycle+1,0x9e3779b1))*span;
    const twist=seconds*p.tempo+p.phase,eddy=p.swing*Math.sin(twist);
    const response=.45+.75*p.depth;
    let x=entry+age*p.drift+response*(wind-weatherWind(born))+eddy;
    if(snow)x+=p.swing*.38*Math.sin(.47*twist+entry*.01);
    x=x-Math.floor(x/span)*span-pad;
    const y=progress*travel-pad+(snow?1.8*Math.sin(twist*1.34):0);
    ctx.globalAlpha=opacity*p.alpha;
    ctx.beginPath();
    if(snow){
      const flutter=.65+.27*Math.sin(twist*.81);
      ctx.fillStyle=p.pale?'#fffaf1':'#dbe8ef';
      ctx.ellipse(x,y,p.size,p.size*flutter,twist*.38,0,Math.PI*2);ctx.fill();
    }else{
      const vx=p.drift+response*windSpeed+p.swing*p.tempo*Math.cos(twist);
      ctx.lineWidth=p.size;ctx.strokeStyle=p.pale?'#dfedf5':'#a9c6d6';
      ctx.moveTo(x-vx*p.exposure,y-p.speed*p.exposure);ctx.lineTo(x,y);ctx.stroke();
    }
  }
  ctx.restore();
}
function paintStudioClimate(canvas,frame,zone,weather,seconds){
  const {width:w,height:h,ratio}=frame,pw=Math.round(w*ratio),ph=Math.round(h*ratio);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
  const ctx=canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);ctx.save();
  const indoor=studioIndoor(zone);
  if(indoor&&!frame.windowMask){ctx.restore();return}
  const mix=frame.surface||weatherGoal(weather);
  for(const [type,opacity] of [['sunny',1-mix.rain-mix.snow],['rain',mix.rain],['snow',mix.snow]]){
  if(opacity<=.001||(type==='sunny'&&frame.night))continue;
  ctx.globalAlpha=opacity;
  if(type==='sunny'){
    const y=indoor?h*.28:h*.15;
    for(let i=0;i<3;i++){
      const rx=w*(.12+.035*i),x=((i*.41*w+seconds*(2.5+i)+rx)%(w+2*rx))-rx;
      const glow=ctx.createRadialGradient(x,y,0,x,y,rx);
      glow.addColorStop(0,indoor?'#ffebb857':'#fffdf34d');glow.addColorStop(1,'#fffdf300');
      ctx.save();ctx.translate(0,y*(1-.19));ctx.scale(1,.19);
      ctx.fillStyle=glow;ctx.fillRect(x-rx,y-rx,rx*2,rx*2);ctx.restore();
    }
  }else{
    drawStudioPrecipitation(ctx,type,w,h,seconds,opacity);
  }
  }
  ctx.globalAlpha=1;
  if(indoor){
    ctx.globalCompositeOperation='destination-in';
    ctx.resetTransform();ctx.drawImage(frame.windowMask,0,0);
  }
  ctx.restore();
}
const studioClimate={visible:false,raf:0,last:-1};
function updateStudioWeather(){
  const frame=studio.picker;
  if(!frame||document.hidden||location.hash!=='#garden'||!studioClimate.visible){
    cancelAnimationFrame(studioClimate.raf);studioClimate.raf=0;return;
  }
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const now=performance.now(),interval=studio.design.weather==='sunny'&&(!studio.design.effect||studio.design.effect==='none')?100:33;
  if(now-studioClimate.last>=interval||studioClimate.last===-1){
    paintStudioWeather($('studioWeather'),frame,zone,studio.design.weather,reduced?0:now/1000,studio.design.effect);
    studioClimate.last=now;
  }
  if(!reduced&&!studioClimate.raf)studioClimate.raf=requestAnimationFrame(()=>{studioClimate.raf=0;updateStudioWeather()});
}
function initStudioWeather(){
  const stage=$('stage');
  new IntersectionObserver(entries=>{studioClimate.visible=entries[0].isIntersecting;studioClimate.last=-1;updateStudioWeather()}).observe(stage);
  document.addEventListener('visibilitychange',updateStudioWeather);
  matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',()=>{studioClimate.last=-1;updateStudioWeather()});
}
