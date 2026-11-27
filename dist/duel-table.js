// An orthographic miniature. The picking polygons come from the same projected
// faces and draw order as the picture, including leaves which overhang a tile.
const drawDuelTable=(()=>{
  const cache=new WeakMap(),tau=Math.PI*2;
  const pitch=.78,slope=Math.sin(pitch),up=Math.cos(pitch);
  const turf=['#d9d7ae','#c2c99a'],brass=['#a1844e','#c6a15e','#efd399'];
  const owners=[['#245a51','#478777','#88b9a3'],['#954a32','#c3764f','#e9ab7e']];
  function projector(w,h,angle){
    const cs=Math.cos(angle),sn=Math.sin(angle),span=Math.abs(cs)+Math.abs(sn);
    const scale=Math.min(w/(5.92*span+.30),h/(5.92*span*slope+1.72));
    return ([x,y,z])=>{
      const along=x*sn+z*cs;
      return [w/2+(x*cs-z*sn)*scale,h*.50+(along*slope-y*up)*scale,along*up+y*slope];
    };
  }
  function inside(x,y,poly){
    let covered=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const [ax,ay]=poly[i],[bx,by]=poly[j];
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)covered=!covered;
    }
    return covered;
  }
  function polygon(ctx,poly,ink){
    ctx.beginPath();ctx.moveTo(poly[0][0],poly[0][1]);
    for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i][0],poly[i][1]);
    ctx.closePath();ctx.fillStyle=ink;ctx.fill();
  }
  function ring(x,y,z,rx,rz,n=12){
    return Array.from({length:n},(_,i)=>[x+rx*Math.cos(tau*i/n),y,z+rz*Math.sin(tau*i/n)]);
  }
  function bevelRect(x,y,z,w,d,clip){
    const l=x-w/2,r=x+w/2,t=z-d/2,b=z+d/2,c=clip;
    return [[l+c,y,t],[r-c,y,t],[r,y,t+c],[r,y,b-c],[r-c,y,b],[l+c,y,b],[l,y,b-c],[l,y,t+c]];
  }
  function builder(project){
    const faces=[];
    function face(vertices,ink,cell=-1){
      const poly=vertices.map(project),depth=poly.reduce((s,p)=>s+p[2],0)/poly.length;
      faces.push({poly,ink,cell,depth});
    }
    function join(low,high,inks,cell=-1){
      for(let i=0;i<low.length;i++){
        const j=(i+1)%low.length;
        face([low[i],low[j],high[j],high[i]],inks[i%inks.length],cell);
      }
    }
    function taper(x,y,z,r0,r1,height,inks,cell=-1,n=10){
      const a=ring(x,y,z,r0,r0,n),b=ring(x,y+height,z,r1,r1,n);
      join(a,b,inks,cell);face(b,inks.at(-1),cell);
    }
    function flush(ctx,hits){
      for(const f of faces.sort((a,b)=>a.depth-b.depth)){
        polygon(ctx,f.poly,f.ink);if(hits&&f.cell>=0)hits.push(f);
      }
      faces.length=0;
    }
    return {face,join,taper,flush};
  }
  function trace(ctx,project,vertices,ink,width){
    ctx.beginPath();vertices.forEach((p,i)=>{const [x,y]=project(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});
    ctx.strokeStyle=ink;ctx.lineWidth=width;ctx.stroke();
  }
  function tag(ctx,p,text,color,font){
    ctx.save();ctx.font='bold '+font+'px Georgia, serif';ctx.fillStyle=color;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p[0],p[1]);ctx.restore();
  }
  function floor(ctx,w,h,project){
    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#f5efdd');bg.addColorStop(.54,'#e3e6d4');bg.addColorStop(1,'#ccdac8');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    // Lines follow the tabletop plane and remain stationary during a turn.
    ctx.save();ctx.lineWidth=.65;ctx.strokeStyle='#446e5811';
    for(let x=-h;x<w+h;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h*.38,h);ctx.stroke()}
    ctx.restore();
    ctx.save();ctx.shadowOffsetY=Math.min(w,h)*.021;ctx.shadowBlur=Math.min(w,h)*.047;
    ctx.shadowColor='#304d413d';polygon(ctx,bevelRect(.03,-.34,.08,5.65,5.65,.16).map(project),'#83937b');
    ctx.restore();
  }
  function drawBase(ctx,w,h,project){
    floor(ctx,w,h,project);
    const mesh=builder(project);
    const under=bevelRect(0,-.36,0,5.43,5.43,.15),rail=bevelRect(0,-.28,0,5.68,5.68,.17);
    const seam=bevelRect(0,-.14,0,5.68,5.68,.17),rim=bevelRect(0,-.105,0,5.68,5.68,.17);
    const top=bevelRect(0,-.035,0,5.62,5.62,.15);
    mesh.join(under,rail,['#5d4938','#514735','#766048']);mesh.join(rail,seam,['#856b4f','#947852','#695642']);
    mesh.join(seam,rim,['#ac8d5a','#bf995e','#a3865d']);mesh.join(rim,top,['#715d45','#867253','#8e795b']);
    mesh.flush(ctx);polygon(ctx,top.map(project),'#78684b');
    const border=bevelRect(0,-.024,0,5.51,5.51,.12);
    trace(ctx,project,[...border,border[0]],'#cdb98c',1);
    const centers=[],picks=[];
    for(let i=0;i<25;i++){
      const x=i%5-2,z=Math.floor(i/5)-2;
      const foot=bevelRect(x,-.032,z,.978,.978,.052),tile=bevelRect(x,.034,z,.954,.954,.058);
      mesh.join(foot,tile,['#919676','#97916b','#b4a77f','#a3a27b'],i);
      mesh.face(tile,turf[(i+Math.floor(i/5)*2)%2],i);centers.push(project([x,.035,z]).slice(0,2));
    }
    mesh.flush(ctx,picks);
    for(let i=0;i<25;i++){
      const x=i%5-2,z=Math.floor(i/5)-2;
      // Short scored lines and stippling read as cut stone without competing with the pieces.
      for(let j=0;j<4;j++){
        const dx=((i*37+j*53)%83)/100-.41,dz=((i*71+j*29)%77)/100-.38;
        trace(ctx,project,[[x+dx,.036,z+dz],[x+dx+.025+(j%2)*.02,.036,z+dz-.018]],'#837e5d55',1);
      }
    }
    const south=[[-2.47,0,2.51],[2.47,0,2.51],[2.47,0,2.73],[-2.47,0,2.73]];
    const east=[[2.51,0,-2.47],[2.73,0,-2.47],[2.73,0,2.47],[2.51,0,2.47]];
    polygon(ctx,south.map(project),owners[0][0]);polygon(ctx,east.map(project),owners[1][0]);
    for(let k=-2;k<=2;k++){
      const size=Math.max(9,Math.min(15,w*.023));
      tag(ctx,project([k,.01,-2.63]),'ABCDE'[k+2],'#f7e9c8',size);
      tag(ctx,project([-2.63,.01,k]),String(k+3),'#f7e9c8',size);
      if(k!==0){
        trace(ctx,project,[[k-.07,.01,2.58],[k,.01,2.67],[k+.07,.01,2.58]],'#d9dcb3',1.1);
        trace(ctx,project,[[2.58,.01,k-.07],[2.67,.01,k],[2.58,.01,k+.07]],'#f0d8b7',1.1);
      }
    }
    // Raised brass pins identify the four corners even at steep rotations.
    for(const x of [-2.62,2.62])for(const z of [-2.62,2.62])mesh.taper(x,-.025,z,.053,.041,.034,brass);
    mesh.flush(ctx);
    return {centers,picks};
  }
  // A faceted botanical leaf with a curved central rib.
  function blade(mesh,x,y,z,angle,length,rise,width,colors,cell){
    const dx=Math.cos(angle),dz=Math.sin(angle);
    const base=[x,y,z],tip=[x+dx*length,y+rise,z+dz*length];
    const mid=[x+dx*length*.53,y+rise*.67+.036,z+dz*length*.53];
    const l=[mid[0]-dz*width,mid[1]-.047,mid[2]+dx*width],r=[mid[0]+dz*width,mid[1]-.047,mid[2]-dx*width];
    mesh.face([base,l,mid],colors[1],cell);mesh.face([mid,l,tip],colors[0],cell);
    mesh.face([base,mid,r],colors[2],cell);mesh.face([mid,tip,r],colors[1],cell);
  }
  function stalk(mesh,x,y,z,dx,h,dz,r,cell){
    const a=ring(x,y,z,r,r,5),b=ring(x+dx,y+h,z+dz,r*.64,r*.64,5);
    mesh.join(a,b,['#3c5d3c','#536c44','#80905c'],cell);
  }
  function blossom(mesh,x,y,z,cell){
    for(let n=0;n<8;n++)blade(mesh,x,y,z,tau*n/8,.146,.01,.047,['#fff0bb','#f9d9a6','#ddba8c'],cell);
    mesh.taper(x,y+.012,z,.054,.04,.025,['#ba733d','#edac43','#f9c65c'],cell,8);
  }
  function plant(mesh,x,z,tile,cell){
    const green=['#93aa6d','#68905d','#3f7051'],forest=['#88ae76','#548766','#346c54'];
    const c=owners[tile.owner===1?1:0],h=.126;
    mesh.taper(x,.04,z,.24,.29,.077,[c[0],c[1],c[0],c[1],c[2]],cell,12);
    mesh.face(ring(x,.120,z,.248,.248), '#706747',cell);
    if(tile.type==='nectar'){
      for(const [dx,dz,height] of [[-.11,-.03,.31],[.10,.09,.39],[.08,-.12,.49]]){
        stalk(mesh,x,h,z,dx,height,dz,.014,cell);
        blade(mesh,x+dx*.55,h+height*.42,z+dz*.55,(dx+1)*2.6,.15,.09,.044,forest,cell);
        blossom(mesh,x+dx,h+height,z+dz,cell);
      }
    }else if(tile.type==='wind'){
      for(let n=0;n<6;n++)blade(mesh,x,h,z,n*2.4,.28,.11,.039,green,cell);
      for(const [dx,dz,height] of [[-.10,-.03,.41],[.10,.07,.52]]){
        stalk(mesh,x,h,z,dx,height,dz,.016,cell);
        for(let n=0;n<6;n++)blade(mesh,x+dx,h+height-.07+n*.014,z+dz,n*2.4,.11,.14,.028,['#ead7a5','#c6b880','#aba16a'],cell);
      }
    }else if(tile.type==='vine'){
      for(let n=0;n<8;n++){
        const a=n*2.4,dx=Math.cos(a)*.17,dz=Math.sin(a)*.17;
        stalk(mesh,x,h,z,dx,.08+n*.012,dz,.013,cell);
        blade(mesh,x+dx,h+.08+n*.012,z+dz,a,.21,.08,.073,forest,cell);
      }
    }else{
      for(let n=0;n<9;n++)blade(mesh,x,h+n*.012,z,n*2.4,.28-n*.01,.18+n*.023,.083-n*.005,green,cell);
    }
  }
  function butterfly(mesh,x,y,z,phase,cell){
    // Layer the amber forewings, pale hindwings and eyespots on dark wing membranes.
    const lift=.58+.23*Math.sin(Math.PI*phase),spread=1.04-Math.sin(Math.PI*phase)*.18;
    for(const side of [-1,1]){
      const wing=(u,v,raise=0)=>[x+side*u*spread,y+u*lift+raise,z+v];
      const patch=(points,color,lift=0)=>mesh.face(points.map(([u,v])=>wing(u,v,lift)),color,cell);
      patch([[0,-.06],[.12,-.24],[.34,-.31],[.39,-.25],[.31,-.03],[.18,.07],[.036,.05]],'#403d37');
      patch([[.032,-.055],[.16,-.215],[.32,-.253],[.28,-.09],[.16,.022]],'#ed9955',.006);
      patch([[.055,-.065],[.20,-.19],[.26,-.205],[.18,-.078]],'#fad277',.011);
      patch([[0,.015],[.21,-.01],[.31,.08],[.28,.19],[.14,.24],[.032,.165]],'#4c483b');
      patch([[.035,.043],[.179,.017],[.253,.09],[.215,.16],[.13,.20],[.054,.14]],'#d58248',.008);
      for(const [u,v] of [[.336,-.239],[.305,-.183],[.28,.087],[.218,.17]]){
        patch([[u-.015,v],[u,v-.018],[u+.014,v],[u,v+.018]],'#f7e4ab',.014);
      }
      const root=wing(.012,-.12),tip=wing(.075,-.248,.066);
      mesh.face([root,[root[0]+.012,root[1],root[2]],tip],'#504738',cell);
    }
    mesh.face([[x-.024,y+.015,z-.13],[x+.023,y+.018,z-.14],[x+.032,y+.023,z+.05],[x,y+.018,z+.185],[x-.026,y+.02,z+.03]],'#423d32',cell);
  }
  function prepare(canvas,angle){
    const w=Math.max(1,canvas.clientWidth||canvas.width||480),h=Math.max(1,canvas.clientHeight||canvas.height||380);
    const dpr=Math.min(2,globalThis.devicePixelRatio||1),pw=Math.round(w*dpr),ph=Math.round(h*dpr);
    const key=[w,h,dpr,angle].join('|');
    let model=cache.get(canvas);
    if(model?.key===key)return model;
    if(canvas.width!==pw)canvas.width=pw;if(canvas.height!==ph)canvas.height=ph;
    const base=document.createElement('canvas');base.width=pw;base.height=ph;
    const ctx=base.getContext('2d');ctx.scale(dpr,dpr);
    const project=projector(w,h,angle);
    model={key,w,h,dpr,base,project,...drawBase(ctx,w,h,project)};cache.set(canvas,model);return model;
  }
  return function drawDuelTable(canvas,{board=null,angle=.25,highlight=-1,legal,flight=1}={}){
    const {w,h,dpr,base,centers,picks,project}=prepare(canvas,angle);
    const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(base,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const foreground=[],mesh=builder(project),pos=board?.pos??0;
    for(let i=0;i<25;i++){
      const x=i%5-2,z=Math.floor(i/5)-2,tile=board?.cells[i],marked=highlight===i;
      if(marked||legal?.[i]===false){
        const corners=bevelRect(x,.04,z,.94,.94,.056);
        if(marked){polygon(ctx,corners.map(project),'#f3dc917a');trace(ctx,project,[...corners,corners[0]],'#916534',2.1)}
        else polygon(ctx,corners.map(project),'#625e5624');
      }
      if(tile){
        polygon(ctx,ring(x+.05,.045,z+.055,.33,.25,16).map(project),'#354d3b2b');plant(mesh,x,z,tile,i);
      }else if(i!==pos&&board?.trail?.includes(i)){
        polygon(ctx,ring(x,.045,z,.063,.063,10).map(project),'#788e67');
      }
    }
    const last=board?.trail?.at(-2)??pos,t=Math.max(0,Math.min(1,flight));
    const x=(last%5+(pos%5-last%5)*t)-2,z=(Math.floor(last/5)+(Math.floor(pos/5)-Math.floor(last/5))*t)-2;
    const height=(board?.cells[pos] ? .48 : .22)+Math.sin(Math.PI*t)*.26;
    polygon(ctx,ring(x+.025,.045,z+.052,.23,.14,14).map(project),'#5d56322c');
    butterfly(mesh,x,height,z,t,pos);mesh.flush(ctx,foreground);
    const font=Math.max(10,Math.min(15,w*.025));
    function sideBadge(p,label,color){
      const [bx,by]=project(p);ctx.fillStyle=color;ctx.beginPath();
      ctx.roundRect(bx-font,by-font*.64,font*2,font*1.28,font*.35);ctx.fill();
      tag(ctx,[bx,by+.5],label,'#fff8e4',font);
    }
    sideBadge([0,.035,2.62],'1P',owners[0][0]);sideBadge([2.62,.035,0],'2P',owners[1][0]);
    return {centers,hit(px,py){
      if(px<0||py<0||px>w||py>h)return -1;
      for(const layers of [foreground,picks])for(let i=layers.length-1;i>=0;i--){
        if(inside(px,py,layers[i].poly))return layers[i].cell;
      }
      return -1;
    }};
  };
})();
globalThis.drawDuelTable=drawDuelTable;
