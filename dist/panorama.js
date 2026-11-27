// A cylindrical campus landscape, painted once per atmosphere and shared by both cameras.
const paintCampusPanorama = (() => {
  const W = 3072, H = 592, turn = Math.PI * 2;
  const cache = new Map();
  const palettes = {
    campus: ['#86c0c5','#d5e8d6','#f4d9ad','#a9c6ba','#809f97','#658975','#99af86','#a9c9b7','#deddb0','#b68066','#5e756a'],
    courtyard: ['#a8c6be','#ebdfc4','#ffce99','#b3bca6','#969c83','#748670','#a6a87b','#abbd9f','#e7c799','#bb846b','#746c60'],
    terrace: ['#83b9cf','#d6e7e0','#f5d7ba','#b5c8c7','#92aca9','#6d9388','#a6b18c','#a5c8be','#e4d4ae','#b38f7b','#688087'],
    rain: ['#6e8798','#a5b9bc','#c7cebf','#a3b6b5','#819a9b','#66817c','#8a9b86','#98b2af','#c3cbb8','#967f72','#596c70'],
    snow: ['#a6bdcc','#dbe4e6','#f4eee2','#b8cbcf','#99b1b6','#849b97','#d0dbd5','#b7cbd0','#e2e7e1','#bb9e93','#829699'],
    starlight: ['#0e203c','#293c58','#58657b','#495c71','#364d60','#2b434c','#405852','#344f57','#647779','#685858','#394954']
  };
  function landscape(scene, weather) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d'), night = scene === 'starlight', snow = weather === 'snow', rain = weather === 'rain';
    const p = palettes[night ? 'starlight' : snow ? 'snow' : rain ? 'rain' : scene] || palettes.campus;
    let state = 391391;
    function random() { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; }
    function rect(x,y,w,h,color) { g.fillStyle = color; g.fillRect(x,y,w,h); }
    function oval(x,y,rx,ry,color) {
      g.fillStyle=color; g.beginPath(); g.ellipse(x,y,rx,ry,0,0,turn); g.fill();
    }
    function shape(points, color) {
      g.fillStyle=color; g.beginPath(); g.moveTo(...points[0]);
      for (let i=1;i<points.length;i++) g.lineTo(...points[i]);
      g.closePath(); g.fill();
    }
    function line(x,y,xx,yy,color,weight=1) {
      g.strokeStyle=color; g.lineWidth=weight; g.beginPath(); g.moveTo(x,y); g.lineTo(xx,yy); g.stroke();
    }
    function gradient(top,bottom,from,to) {
      const wash=g.createLinearGradient(0,top,0,bottom); wash.addColorStop(0,from); wash.addColorStop(1,to); return wash;
    }
    // Duplicate marks straddling the join before clipping to the full turn.
    function wrap(x, radius, draw) {
      draw(x);
      if (x-radius<0) draw(x+W);
      if (x+radius>W) draw(x-W);
    }
    const sky=g.createLinearGradient(0,0,0,360);
    sky.addColorStop(0,p[0]); sky.addColorStop(.64,p[1]); sky.addColorStop(1,p[2]);
    rect(0,0,W,H,sky);
    if(night) {
      for(let i=0;i<440;i++){
        const x=random()*W,y=12+random()*225,r=.35+random()**3*1.2;
        g.globalAlpha=(rain||snow?.24:.68)*(.4+random()*.6);
        wrap(x,2,xx=>oval(xx,y,r,r,'#f5f2da'));
      }
      g.globalAlpha=1;
    }
    if(!rain&&!snow) {
      const x=850,y=night?111:147,r=night?18:23;
      const glow=g.createRadialGradient(x,y,0,x,y,128);
      glow.addColorStop(0,night?'#d5e9ff49':'#ffedbdb0'); glow.addColorStop(1,'#fff3d400');
      rect(x-128,y-128,256,256,glow);
      oval(x,y,r,r,night?'#e5ebd8':'#fff4d5');
      if(night) { oval(x-5,y-4,3,2,'#cedacf'); oval(x+7,y+4,2,3,'#d2ded2'); }
    }
    for(let i=0;i<(rain||snow?155:75);i++){
      const x=random()*W,y=35+random()*185,length=22+random()*90,h=2+random()*(rain?12:6);
      g.globalAlpha=(rain?.22:night?.07:.27)*(.4+random()*.6);
      wrap(x,length,xx=>{
        g.beginPath(); g.moveTo(xx-length,y+h);
        g.bezierCurveTo(xx-length*.43,y+h,xx-length*.27,y-h*1.6,xx,y-h*.55);
        g.bezierCurveTo(xx+length*.32,y-h*.85,xx+length*.56,y+h*.65,xx+length,y+h);
        g.fillStyle=rain?p[4]:'#fff9e8'; g.fill();
      });
    }
    g.globalAlpha=1;
    function ridge(base,amplitude,phase,color) {
      const pts=[[0,H]];
      for(let x=0;x<=W;x+=8){
        const a=x/W*turn;
        const h=Math.sin(a*3+phase)+.55*Math.sin(a*6-phase)+.24*Math.sin(a*14+phase)+.11*Math.cos(a*33);
        pts.push([x,base+h*amplitude]);
      }
      pts.push([W,H]); shape(pts,color);
    }
    ridge(253,21,.4,p[3]); ridge(273,15,1.9,p[4]); ridge(294,7,3.3,p[5]);
    function teachingHall(x,y,s) {
      g.save(); g.translate(x,y); g.scale(s,s);
      const roof=snow?'#dee6df':p[10], trim=night?'#988674':snow?'#e1e5df':'#d6bd9f';
      rect(-84,-30,168,30,p[9]); shape([[-92,-30],[-69,-41],[66,-41],[92,-30]],roof);
      for(let row=0;row<2;row++)for(let i=0;i<15;i++){
        const xx=-78+i*10.8, yy=-23+row*11;
        rect(xx,yy,4.4,7,night&&i%4===row?'#edc488':p[10]); rect(xx+2,yy,.5,7,trim);
      }
      rect(-86,-29,172,2,trim); rect(-17,-33,34,33,p[9]);
      shape([[-23,-32],[0,-51],[23,-32]],roof);
      shape([[-18,-33],[0,-46],[18,-33]],trim);
      oval(0,-37.5,3,3,p[10]);
      for(const cx of [-10,0,10]){ oval(cx,-16,3.2,4,p[10]); rect(cx-3.2,-16,6.4,16,p[10]); }
      rect(-19,-3,38,3,trim); g.restore();
    }
    function glasshouse(x,y,s) {
      g.save(); g.translate(x,y); g.scale(s,s);
      const frame=night?'#91a398':snow?'#f1eee1':'#e5e3be', pane=night?'#796f59':rain?'#8aa9a5':'#a3c5b3';
      rect(-66,-16,132,16,pane);
      shape([[-70,-16],[-51,-27],[48,-27],[70,-16]],p[10]);
      for(let i=-63;i<=63;i+=9){line(i,-15,i,0,frame,1.4);line(i,-17,i*.76,-26,frame,.9);}
      g.fillStyle=pane; g.beginPath(); g.ellipse(0,-16,25,25,0,Math.PI,turn); g.fill();
      for(let radius=8;radius<=25;radius+=8){
        g.beginPath();g.strokeStyle=frame;g.lineWidth=1.1;g.ellipse(0,-16,radius,25,0,Math.PI,turn);g.stroke();
      }
      line(-23,-24,23,-24,frame);line(-19,-32,19,-32,frame);line(-69,-16,69,-16,frame,2);
      rect(-5,-13,10,13,p[10]); line(0,-13,0,0,frame); line(0,-41,0,-46,frame,1.2); g.restore();
    }
    if(scene==='terrace'){
      for(let i=0;i<41;i++){
        const x=20+i*74,h=10+random()*30,w=19+random()*36,base=300;
        rect(x,base-h,w,h,p[4]);rect(x+4,base-h-2,w-11,2,p[4]);
        for(let v=7;v<h;v+=6)for(let u=4;u<w-3;u+=7)rect(x+u,base-v,3,2,p[3]);
      }
    }
    for(const [x,s] of [[234,.84],[1140,.62],[1810,1.08],[2860,.74]])teachingHall(x,309,s);
    for(const [x,s] of [[769,.83],[1544,.68],[2460,1.08]])glasshouse(x,306,s);
    // Slender poplars leave the greenhouse roof and the central photo composition readable.
    for(let i=0;i<164;i++){
      const x=random()*W,y=303+random()*11,h=9+random()*22,r=h*(.11+random()*.13);
      const c=i%3?p[5]:p[4], highlight=snow?'#dce3dc':p[6];
      wrap(x,r+1,xx=>{
        rect(xx-.65,y-h*.77,1.3,h*.77,p[10]);
        oval(xx,y-h*.59,r,h*.43,c);
        oval(xx-r*.22,y-h*.69,r*.57,h*.26,highlight);
      });
    }
    ridge(311,2.8,2.2,p[6]);
    rect(0,317,W,82,gradient(317,399,p[7],p[8]));
    for(let i=0;i<1250;i++){
      const x=random()*W,y=318+random()*77,length=1+(y-310)*random()*.42;
      g.globalAlpha=.10+random()*.23;
      wrap(x,length,xx=>line(xx,y,xx+length,y,i%3?p[2]:p[5],.8));
    }
    g.globalAlpha=1;
    ridge(391,11,.8,p[6]); ridge(416,8,2.1,p[8]);
    rect(0,435,W,H-435,gradient(435,H,p[8],p[6]));
    return canvas;
  }
  return function(ctx,width,height,view) {
    if(width<=0||height<=0)return;
    const key=view.scene+'|'+view.weather;
    if(!cache.has(key)){
      if(cache.size>=3)cache.delete(cache.keys().next().value);
      cache.set(key,landscape(view.scene,view.weather));
    }
    const texture=cache.get(key),scale=height/500;
    const center=590+((view.angle||0)-.57)*W/turn;
    const top=Math.max(0,Math.min(H-500,45+((view.pitch??.53)-.53)*75-(view.panY||0)*48));
    const left=center-width/(2*scale)-(view.panX||0)*65;
    const wrapped=((left%W)+W)%W;
    const tileWidth=W*scale;
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    // Integer screen boundaries avoid sample gaps at the 360-degree join.
    for(let x=-wrapped*scale;x<width;x+=tileWidth){
      const start=Math.round(x),end=Math.round(x+tileWidth);
      ctx.drawImage(texture,0,top,W,500,start,0,end-start,height);
    }
    ctx.restore();
  };
})();
