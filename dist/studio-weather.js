// Weather has a transparent surface so raindrops never trigger a mesh redraw.
function paintStudioWeather(canvas,frame,zone,weather,seconds,effect='none'){
  paintStudioClimate(canvas,frame,zone,weather,seconds);
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
