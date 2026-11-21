// Leaves are folded along a midrib. The outline is shared by both faces,
// so changing the camera angle reveals the silhouette as well as its depth.
const specimenLeaves = {
  oval: [[0,0],[.19,.63],[.48,1],[.75,.74],[1,0]],
  lanceolate: [[0,0],[.22,.68],[.42,1],[.79,.45],[1,0]],
  needle: [[0,0],[.12,.85],[.6,.73],[1,0]],
  fan: [[0,0],[.2,.12],[.58,.78],[.77,1],[.89,.87],[.96,.64],[.99,.32],[.86,0]],
  palmate: [[0,0],[.08,.29],[.17,.69],[.23,.41],[.49,1],[.41,.39],[.73,.67],[.59,.18],[1,0]],
  heart: [[.12,0],[0,.46],[.18,.96],[.44,1],[.73,.54],[1,0]],
  succulent: [[0,0],[.2,.59],[.54,.95],[.76,1],[.91,.47],[1,0]],
  spoon: [[0,0],[.26,.18],[.54,.42],[.74,.91],[.89,1],[.98,.51],[1,0]],
  toothed: [[0,0],[.17,.52],[.24,.44],[.31,.84],[.36,.68],[.45,.97],[.51,.8],[.6,.96],[.63,.73],[.73,.78],[.75,.52],[.86,.45],[1,0]]
};
const specimenScales = {
  small: {ground:1.05, pot:.67},
  medium: {ground:1.72, pot:1.03},
  large: {ground:2.4, pot:1.43}
};
function meshTint(color, multiplier) {
  return '#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*multiplier)).toString(16).padStart(2,'0')).join('');
}
function specimenMesh(record, potted=false) {
  const m=plantProfile(record), latin=String(record.latin||'').toLowerCase(), genus=latin.split(/\s+/)[0];
  const palette=record.palette||{};
  const pigment=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const tau=2*Math.PI, golden=2.39996, faces=[];
  const colors=new Map();
  function tint(color,light) {
    const key=color+light;
    if(!colors.has(key))colors.set(key,meshTint(color,light));
    return colors.get(key);
  }
  const face=(vertices,color)=>faces.push({vertices,color});
  // Weather uses upward-facing normals in model space, even on a folded blade.
  function upperFace(vertices,color,surface){
    let ny=0;
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length];
      ny+=a[2]*b[0]-a[0]*b[2];
    }
    faces.push({vertices:ny<0?vertices.slice().reverse():vertices,color,surface});
  }
  const aspect=Number.isFinite(m.leafAspect)?Math.max(.65,Math.min(1.5,m.leafAspect)):1;
  const outlines=new Map();
  function outline(shape){
    if(outlines.has(shape))return outlines.get(shape);
    const original=specimenLeaves[shape]||specimenLeaves.oval;
    let result=original;
    if(m.margin==='toothed'&&['oval','lanceolate','spoon','heart'].includes(shape)){
      result=[original[0]];
      for(let i=1;i<original.length;i++){
        const [a,w]=original[i-1],[b,v]=original[i];
        for(let j=1;j<4;j++){
          const t=j/4;
          result.push([a+(b-a)*t,(w+(v-w)*t)*(j%2?.86:1.05)]);
        }
        result.push(original[i]);
      }
    }
    outlines.set(shape,result);return result;
  }
  const advance=([x,y,z],a,d,h)=>[x+Math.cos(a)*d,y+h,z+Math.sin(a)*d];
  function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}
  function tube(a,b,ra,rb,color,n=5) {
    const [dx,dy,dz]=b.map((v,i)=>v-a[i]),length=Math.hypot(dx,dy,dz);
    if(length<.0001)return;
    const axis=[dx/length,dy/length,dz/length],horizontal=Math.hypot(dx,dz);
    const u=horizontal>.0001?[dz/horizontal,0,-dx/horizontal]:[1,0,0];
    const v=[axis[1]*u[2],axis[2]*u[0]-axis[0]*u[2],-axis[1]*u[0]];
    const circle=(point,r)=>Array.from({length:n},(_,i)=>point.map((c,j)=>c+r*(u[j]*Math.cos(tau*i/n)+v[j]*Math.sin(tau*i/n))));
    const base=circle(a,ra),top=circle(b,rb);
    for(let i=0;i<n;i++){const j=(i+1)%n;face([base[i],base[j],top[j],top[i]],tint(color,.89+.12*Math.cos(tau*i/n)))}
    face(top,color);
  }
  function leaf(origin,a,length,width,rise,shape,color,fold=.13,tilt=.24) {
    const edge=outline(shape);
    width*=aspect;
    const point=(t,k,h)=>[
      origin[0]+length*t*Math.cos(a)-k*width*Math.sin(a),
      origin[1]+rise*t+width*k*tilt+h*Math.sin(Math.PI*t),
      origin[2]+length*t*Math.sin(a)+k*width*Math.cos(a)
    ];
    const center=point(.51,0,length*fold);
    const left=edge.map(([t,w])=>point(t,w,0)),right=edge.map(([t,w])=>point(t,-w,0));
    upperFace([...left,center],color,'leaf');upperFace([...right,center],tint(color,.85),'leaf');
    if(shape==='succulent'){
      const keel=point(.48,0,-length*.18);
      face([...left,keel],tint(color,.72));face([...right,keel],tint(color,.79));
      const outer=left[3],glint=mix(outer,center,.13);
      face([mix(left[2],outer,.6),outer,mix(outer,left[4],.7),glint],tint(color,1.13));
    }else if(shape==='fan'||shape==='palmate'){
      // Ribs follow the fan and the maple's lobes. Their width tapers to the margin.
      const petiole=point(.12,0,length*fold*.4);
      for(const side of [left,right]){
        const veinTip=mix(center,side[shape==='fan'?5:6],.78);
        face([petiole,mix(center,side[2],.11),veinTip],tint(color,1.09));
      }
    }else if(width>.045){
      const base=point(.06,0,length*fold*.7),tip=point(.89,0,length*fold*.71);
      face([base,point(.50,.045,length*fold*1.025),tip,center],tint(color,1.17));
      if(shape==='toothed'||shape==='heart'){
        for(const sign of [-1,1]){
          face([mix(base,center,.60),center,mix(center,point(.64,sign*.75,0),.9)],tint(color,1.08));
        }
      }
    }
  }
  const green=pigment(palette.leaf,m.leaf),flower=pigment(palette.bloom,m.bloom),wood='#876a4e';
  const leafShape=Object.hasOwn(specimenLeaves,m.leafShape)?m.leafShape:'oval';
  const leavesPerNode=m.arrangement==='whorled'?3:m.arrangement==='opposite'?2:1;
  function leafyTree(kind) {
    const willow=kind==='willow'||m.crownShape==='weeping';
    const shrub=kind==='hibiscus'||m.form==='shrub';
    const spreading=kind==='maple'||m.crownShape==='spreading';
    const pine=kind==='conifer'||leafShape==='needle',conical=pine||m.crownShape==='conical';
    const tall=(conical?2.15:shrub?1.24:1.86)*m.height;
    const trunk=[[0,0,0],[-.05,tall*.35,.02],[.035,tall*.66,-.025],[.015,tall,.01]];
    for(let i=0;i<3;i++)tube(trunk[i],trunk[i+1],.082-i*.023,.059-i*.021,wood,7);
    const tiers=Math.max(6,Math.min(11,m.count+2));
    for(let i=0;i<tiers;i++){
      const a=golden*i+.22,t=i/tiers,y=tall*(.26+.59*t);
      const crownWidth=m.crownShape==='rounded'?.68+.36*Math.sin(Math.PI*t):.99-.52*t;
      const width=(conical?1.05:willow?.98:spreading?.97:shrub?.62:.70)*crownWidth*m.spread;
      const base=[.012,y,0],elbow=advance(base,a,width*.49,.22),tip=advance(elbow,a+.12,width*.46,pine?.09:.20);
      tube(base,elbow,.045-.018*t,.031-.012*t,wood);tube(elbow,tip,.031-.012*t,.011,wood);
      if(willow){
        for(let j=0;j<3;j++){
          const az=a+(j-1)*.49,join=j===1?tip:mix(elbow,tip,.62);
          const arc=advance(join,az,.16,.07),mid=advance(arc,az,.13,-.35),end=advance(mid,az,-.04,-(.43+.23*Math.sin(i+j)**2));
          tube(join,arc,.013,.01,wood,4);tube(arc,mid,.01,.006,'#718157',4);tube(mid,end,.006,.003,'#849063',4);
          for(let k=0;k<6;k++){const point=k<3?mix(arc,mid,k/3):mix(mid,end,(k-3)/3);leaf(point,az+(k%2?1.4:-1.35),.12,.024,-.19,'lanceolate',tint(green,.91+.1*(k%2)))}
        }
      }else{
        for(let j=0;j<2;j++){
          const az=a+(j===0?-.60:.56),join=j===0?mix(elbow,tip,.56):tip;
          const end=advance(join,az,.21,pine?.02:.13);
          tube(join,end,.013,.005,wood,4);
          const n=pine?8:leavesPerNode===3?6:4;
          for(let k=0;k<n;k++){
            const node=Math.floor(k/leavesPerNode),nodes=Math.ceil(n/leavesPerNode);
            const t=m.arrangement==='basal'?.07+.03*k:.23+.71*node/Math.max(1,nodes-1);
            const point=mix(join,end,t),dir=az+node*golden+(k%leavesPerNode)*tau/leavesPerNode;
            let shape=kind==='ginkgo'?'fan':kind==='maple'?'palmate':pine?'needle':leafShape;
            const length=pine?.29:kind==='hibiscus'?.24:.29;
            leaf(point,dir,length,shape==='needle'?.02:shape==='palmate'?.19:shape==='fan'?.185:.11,.105+.065*Math.sin(k+i),shape,tint(green,.92+.06*((i+k)%3)),.09,.44);
          }
        }
        if(kind==='hibiscus'&&i%3===1)flowerHead(tip,a,.28,5,true);
        if((kind==='shrub'||kind==='tree')&&m.petals>0&&i%3===1)flowerSpray(tip,a,.18,Math.min(24,m.petals));
      }
    }
  }
  // Flower faces tilt toward the side; the petal ring and centre remain
  // visible at the lower angle used for the shelf as well as from above.
  function flowerHead(center,a,radius,petals,trumpet=false) {
    const forward=[Math.cos(a),0,Math.sin(a)],right=[-forward[2],0,forward[0]];
    const sin=trumpet?.9:.61,cos=Math.sqrt(1-sin*sin);
    const normal=[sin*forward[0],cos,sin*forward[2]],across=[cos*forward[0],-sin,cos*forward[2]];
    const point=(x,y,z)=>center.map((c,i)=>c+radius*(x*right[i]+y*across[i]+z*normal[i]));
    function radial(t,r,w,h){
      return point(Math.cos(t)*r-Math.sin(t)*w,Math.sin(t)*r+Math.cos(t)*w,h);
    }
    const breadth=trumpet?.55:Math.min(.35,2.05/petals);
    for(let j=0;j<petals;j++){
      const t=j*tau/petals,raise=trumpet?.25:.055;
      const reach=.96+.045*Math.sin(j*golden);
      const a0=radial(t,.09,0,0),l=radial(t,.68,-breadth,raise),u=radial(t,reach-.05,-breadth*.73,raise+.055),end=radial(t,reach,0,raise+.072),v=radial(t,reach-.03,breadth*.66,raise+.05),p=radial(t,.71,breadth,raise);
      const rib=radial(t,.68,0,raise+.10);
      upperFace([a0,l,u,end,rib],tint(flower,.97+.03*(j%3)),'bloom');upperFace([a0,rib,end,v,p],tint(flower,.85+.035*(j%2)),'bloom');
    }
    const diskRadius=trumpet?.17:.235;
    const disk=Array.from({length:12},(_,i)=>radial(i*tau/12,diskRadius,0,.115));
    upperFace(disk,trumpet?'#995146':'#d49835','bloom');
    if(!trumpet){
      // Small golden florets give the raised flower centre a granular surface at close range.
      for(let k=0;k<10;k++){
        const a=k*golden,r=.18*Math.sqrt(k/10),cx=r*Math.cos(a),cy=r*Math.sin(a),h=.125+.06*(1-r/.18);
        face(Array.from({length:5},(_,n)=>point(cx+.037*Math.cos(n*tau/5),cy+.037*Math.sin(n*tau/5),h)),k%3?'#edbc4c':'#ffe094');
      }
    }
    if(trumpet){
      const apex=point(.02,.08,.78);tube(center,apex,.012,.009,'#dd9a79');
      for(let j=0;j<6;j++){const s=radial(j*tau/6,.11,0,.66);tube(s,advance(s,j,.009,.025),.018,.012,'#e7bf58',4)}
    }
  }
  function flowerSpray(tip,a,radius,petals){
    const layout=m.inflorescence||'solitary';
    if(layout==='none')return;
    if(layout==='solitary'){flowerHead(tip,a,radius,petals,petals<=6);return}
    const spike=layout==='spike',n=spike?7:4;
    if(spike)tube(tip,advance(tip,a,.018,radius*1.7),.011,.004,green,5);
    for(let i=0;i<n;i++){
      const az=a+i*golden,level=i/(n-1);
      const base=spike?advance(tip,a,.018*level,radius*1.7*level):tip;
      const end=advance(base,az,radius*(spike?.2:.55+.18*(i%2)),radius*(spike?.09:.34+.28*(i%2)));
      tube(base,end,.007,.004,green,4);
      flowerHead(end,az,radius*(spike?.22:.48),Math.min(10,petals));
    }
  }
  function herbs(kind) {
    const count=Math.min(12,Math.max(4,m.count));
    if(kind==='rosette'||kind==='grass'){
      const rosette=kind==='rosette',rings=rosette?3:2;
      for(let tier=0;tier<rings;tier++){
        const n=rosette?Math.max(6,count-tier*2):count;
        for(let j=0;j<n;j++){
          const a=tau*j/n+tier*golden,origin=advance([0,tier*.065,0],a,.035,0);
          const len=rosette?.67-.19*tier:.38+.13*Math.cos(j),rise=rosette?.13+tier*.17:.66+.39*Math.sin(j+tier)**2;
          leaf(origin,a,len,rosette?.16-.025*tier:.037,rise,rosette?'succulent':'lanceolate',tint(green,.88+.09*(tier+j%2)),rosette?.34:.24);
        }
      }
      if(m.inflorescence&&m.inflorescence!=='none'){
        const tip=[.035,rosette?.84:1.15,.025];
        tube([0,.08,0],tip,.016,.008,green,5);
        if(!rosette&&m.petals===0){
          for(let i=0;i<8;i++)leaf(advance(tip,0,0,i*.035),i*golden,.065,.014,.1,'lanceolate',tint(green,1.17));
        }else flowerSpray(tip,.35,.16,Math.max(3,m.petals||5));
      }
      return;
    }
    const daisy=kind==='daisy',showBloom=daisy||kind==='flower',mint=kind==='mint';
    const basal=daisy||m.arrangement==='basal';
    if(basal)for(let j=0;j<11;j++)leaf([0,.035,0],j*golden,.35*m.spread,.074,.08,daisy?'spoon':leafShape,tint(green,.92+.05*(j%3)));
    if(basal&&!showBloom&&(!m.inflorescence||m.inflorescence==='none'))return;
    const stems=Math.max(3,Math.min(6,Math.round(count*.63)));
    for(let j=0;j<stems;j++){
      const a=golden*j,r=.13+.23*Math.sin(j*1.57)**2,stemH=m.height*(.66+.30*Math.cos(j*1.42)**2);
      const base=advance([0,.008,0],a,r*.18,0),bend=advance(base,a,r*.42,stemH*.57),tip=advance(bend,a+.26,r*.68,stemH*.43);
      tube(base,bend,.019,.013,green,mint?4:5);tube(bend,tip,.013,.009,green,mint?4:5);
      if(!basal){
        const perNode=mint||!m.arrangement?2:leavesPerNode;
        for(let k=0;k<4;k++){
          const node=k<2?mix(base,bend,.33+k*.53):mix(bend,tip,(k-2)*.65+.19);
          for(let side=0;side<perNode;side++)leaf(node,a+k*(perNode===2?Math.PI/2:golden)+side*tau/perNode,(.31-.037*k)*m.spread,.095-.012*k,.075,mint?'toothed':leafShape,tint(green,.91+.07*((k+side)%3)));
        }
      }
      if(showBloom||(m.inflorescence&&m.inflorescence!=='none'&&m.petals>0)){
        const petals=daisy?16:Math.max(3,Math.min(24,Math.round(m.petals||7)));
        if(daisy)flowerHead(tip,1.15+.52*Math.sin(j*golden),.18,16);
        else flowerSpray(tip,1.15+.52*Math.sin(j*golden),.21,petals);
      }
    }
  }
  const speciesForms={
    ginkgo:['tree','ginkgo'],acer:['tree','maple'],salix:['tree','willow'],
    bellis:['flower','daisy'],mentha:['herb','mint'],echeveria:['rosette','rosette'],
    hibiscus:['shrub','hibiscus'],pinus:['tree','conifer']
  };
  const known=speciesForms[genus];
  const kind=known&&known[0]===m.form?known[1]:m.form;
  if(['ginkgo','maple','willow','hibiscus','conifer','tree','shrub'].includes(kind))leafyTree(kind);
  else herbs(kind);
  // Normalize the overall envelope once. Profile height/spread describe the
  // proportions, while the planted specimen's measured size is always manual.
  let radius=0,high=0,low=0;
  for(const f of faces)for(const [x,y,z] of f.vertices){radius=Math.max(radius,Math.hypot(x,z));high=Math.max(high,y);low=Math.min(low,y)}
  const chosen=specimenScales[record.size]||specimenScales.medium;
  const scale=(potted?chosen.pot:chosen.ground)/Math.max(.1,high-low,radius*1.65);
  const soil=potted?.578:0;
  for(const f of faces)f.vertices=f.vertices.map(([x,y,z])=>[x*scale,(y-low)*scale+soil,z*scale]);
  if(potted){
    const celadon=record.potStyle==='celadon',stone=record.potStyle==='basalt',sides=celadon?32:stone?10:20;
    const profile=celadon?[[0,.248],[.044,.248],[.058,.28],[.16,.348],[.399,.423],[.516,.429],[.549,.453],[.604,.443],[.604,.399],[.578,.393]]:
      stone?[[0,.29],[.035,.303],[.057,.298],[.093,.304],[.45,.423],[.481,.432],[.55,.453],[.604,.444],[.604,.399],[.578,.393]]:
      [[0,.275],[.046,.29],[.052,.307],[.493,.42],[.506,.445],[.57,.453],[.604,.445],[.604,.399],[.578,.393]];
    const finish=celadon?['#567c75','#82a99a','#90b5a4','#98c0af','#a4c9b6','#83afa2','#9ec5b4','#c8dbca','#72998d']:
      stone?['#424844','#595c56','#323b39','#4c5551','#5b635e','#666b63','#48534e','#838780','#444e49']:
      ['#a56650','#b77658','#c28060','#ae6d50','#c88966','#d49772','#dba782','#95684e'];
    const rings=profile.map(([y,r],band)=>Array.from({length:sides},(_,i)=>{
      const a=i*tau/sides;
      const inset=celadon&&band>=3&&band<=5&&i%2?.013:0;
      return [(r-inset)*Math.cos(a),y,(r-inset)*Math.sin(a)];
    }));
    for(let band=0;band<rings.length-1;band++){
      const lower=rings[band],upper=rings[band+1];
      for(let i=0;i<lower.length;i++){
        const j=(i+1)%lower.length;
        face([lower[i],lower[j],upper[j],upper[i]],tint(finish[band],.91+.10*Math.cos(i*tau/lower.length)));
      }
    }
    face(rings[rings.length-1],'#665043');
    for(let i=0;i<10;i++){
      const a=i*golden,r=.18+.17*((i*7)%11)/10,x=r*Math.cos(a),z=r*Math.sin(a);
      face([[x-.013,.58,z],[x-.004,.585,z-.012],[x+.017,.582,z+.003],[x+.004,.58,z+.015]],i%3?'#8e7965':'#ab967c');
    }
  }
  return faces;
}

function paintSpecimen(canvas, plant, {potted=false,portrait=true,width=520,height=460}={}) {
  const ctx=canvas.getContext('2d');canvas.width=width;canvas.height=height;
  const angle=.34,pitch=.28,ca=Math.cos(angle),sa=Math.sin(angle),cp=Math.cos(pitch),sp=Math.sin(pitch);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  const projected=specimenMesh(plant,potted).map(f=>{
    const p=f.vertices.map(([x,y,z])=>{
      const depth=x*sa+z*ca,px=x*ca-z*sa,py=depth*sp-y*cp;
      minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
      return [px,py,depth*cp+y*sp];
    });
    return {p,color:f.color,d:p.reduce((sum,v)=>sum+v[2],0)/p.length};
  }).sort((a,b)=>a.d-b.d);
  const scale=portrait?Math.min(width*.82/Math.max(.05,maxX-minX),height*.83/Math.max(.05,maxY-minY)):Math.min(width*.46,height*.427);
  const left=portrait?width*.5-(maxX+minX)*scale/2:width*.5;
  const bottom=portrait?height*.51-(maxY+minY)*scale/2:height*.89;
  ctx.fillStyle='#66564122';ctx.beginPath();ctx.ellipse(left,bottom+height*.008,scale*(potted?.41:.31),scale*.065,0,0,2*Math.PI);ctx.fill();
  ctx.lineJoin='round';ctx.lineWidth=.36;
  for(const f of projected){
    ctx.fillStyle=ctx.strokeStyle=f.color;ctx.beginPath();
    f.p.forEach(([x,y],i)=>{const px=left+x*scale,py=bottom+y*scale;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py)});
    ctx.closePath();ctx.fill();ctx.stroke();
  }
}
function paintPot(canvas,plant){paintSpecimen(canvas,plant,{potted:true,portrait:false,width:300,height:320})}
