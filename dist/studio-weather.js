// Weather has a transparent surface so raindrops never trigger a mesh redraw.
function paintStudioWeather(canvas,frame,zone,weather,seconds,effect='none'){
  paintStudioClimate(canvas,frame,zone,weather,seconds);
  if(['butterflies','prism','meteors','aurora'].includes(effect)){
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
function paintStudioClimate(canvas,frame,zone,weather,seconds){
  const {width:w,height:h,ratio}=frame,pw=Math.round(w*ratio),ph=Math.round(h*ratio);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
  const ctx=canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);ctx.save();
  const indoor=studioIndoor(zone);
  if(indoor&&!frame.windowMask){ctx.restore();return}
  if(weather==='sunny'&&frame.night){ctx.restore();return}
  if(weather==='sunny'){
    const y=indoor?h*.28:h*.15;
    for(let i=0;i<3;i++){
      const rx=w*(.12+.035*i),x=((i*.41*w+seconds*(2.5+i)+rx)%(w+2*rx))-rx;
      const glow=ctx.createRadialGradient(x,y,0,x,y,rx);
      glow.addColorStop(0,indoor?'#ffebb857':'#fffdf34d');glow.addColorStop(1,'#fffdf300');
      ctx.save();ctx.translate(0,y*(1-.19));ctx.scale(1,.19);
      ctx.fillStyle=glow;ctx.fillRect(x-rx,y-rx,rx*2,rx*2);ctx.restore();
    }
  }else{
    const snow=weather==='snow',n=Math.min(160,Math.max(58,Math.round(w/6)));
    for(let i=0;i<n;i++){
      const seed=((i*67+13)%101)/101,depth=.45+seed*.75;
      const y=(i*79.37+seconds*(snow?34:270)*depth)%(h+22)-11;
      let x=i*113.19+(snow?Math.sin(seconds*.68+i)*12+seconds*9:seconds*62)*depth;
      x=(x%(w+24))-12;
      ctx.beginPath();
      if(snow){
        ctx.fillStyle=i%3?'#fffdf4da':'#dae8ebbb';ctx.arc(x,y,.85+depth*1.45,0,2*Math.PI);ctx.fill();
      }else{
        ctx.lineWidth=.75+depth*.55;ctx.strokeStyle=i%3?'#e0edf4ad':'#a7c2cfab';
        ctx.moveTo(x,y);ctx.lineTo(x+2.2*depth,y+12*depth);ctx.stroke();
      }
    }
  }
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
