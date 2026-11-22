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
  toothed: [[0,0],[.17,.52],[.24,.44],[.31,.84],[.36,.68],[.45,.97],[.51,.8],[.6,.96],[.63,.73],[.73,.78],[.75,.52],[.86,.45],[1,0]],
  // A flattened cypress spray, a sword leaf, a peltate disc and a pinnately lobed blade.
  scale: [[0,0],[.16,.46],[.27,.36],[.43,.84],[.54,.66],[.69,1],[.79,.68],[.91,.6],[1,0]],
  strap: [[0,0],[.04,.72],[.3,1],[.72,.8],[1,0]],
  round: [[0,0],[.03,.36],[.13,.68],[.3,.92],[.5,1],[.7,.92],[.87,.68],[.97,.36],[1,0]],
  lobed: [[0,0],[.1,.34],[.2,.2],[.32,.66],[.42,.34],[.55,.95],[.66,.5],[.78,.82],[.88,.4],[1,0]]
};
// Half-width of a blade relative to its length.
const specimenLeafWidths = {oval:.38,lanceolate:.26,needle:.07,fan:.64,palmate:.65,heart:.5,succulent:.25,spoon:.34,toothed:.38,scale:.44,strap:.1,round:.5,lobed:.45};
const specimenScales = {
  small: {ground:1.05, pot:.67},
  medium: {ground:1.72, pot:1.03},
  large: {ground:2.4, pot:1.43}
};
function meshTint(color, multiplier) {
  return '#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*multiplier)).toString(16).padStart(2,'0')).join('');
}
function specimenMesh(record, potted=false) {
  const m=plantProfile(record);
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
    }else if(width>.045&&shape!=='scale'){
      const base=point(.06,0,length*fold*.7),tip=point(.89,0,length*fold*.71);
      face([base,point(.50,.045,length*fold*1.025),tip,center],tint(color,1.17));
      if(shape==='toothed'||shape==='heart'||shape==='round'){
        for(const sign of [-1,1]){
          face([mix(base,center,.60),center,mix(center,point(.64,sign*.75,0),.9)],tint(color,1.08));
        }
      }
    }
  }
  // A flat single-face blade for leaflets, pods and other small parts.
  function blade(origin,a,length,width,rise,shape,color,surface='leaf') {
    const edge=outline(shape);
    const point=(t,k)=>[
      origin[0]+length*t*Math.cos(a)-k*width*Math.sin(a),
      origin[1]+rise*t+width*k*.3,
      origin[2]+length*t*Math.sin(a)+k*width*Math.cos(a)
    ];
    const left=edge.map(([t,w])=>point(t,w)),right=edge.map(([t,w])=>point(t,-w)).reverse().slice(1,-1);
    upperFace([...left,...right],color,surface);
  }
  const green=pigment(palette.leaf,m.leaf),flower=pigment(palette.bloom,m.bloom),wood=pigment(m.bark,'#876a4e');
  const heart=pigment(m.center,null),fruitColor=pigment(m.fruitColor,'#b5533c');
  const leafShape=Object.hasOwn(specimenLeaves,m.leafShape)?m.leafShape:'oval';
  const compound=m.leafCompound==='pinnate'||m.leafCompound==='palmate'||m.leafCompound==='trifoliate';
  const leavesPerNode=m.arrangement==='whorled'?3:m.arrangement==='opposite'?2:1;
  const flowering=m.inflorescence!=='none'&&(m.petals>0||m.flowerShape==='ear');
  const load=m.bloomLoad||2,woody=m.form==='tree'||m.form==='shrub';
  const widthOf=(shape,length)=>(specimenLeafWidths[shape]||.38)*length;
  // Pinnate leaves carry paired leaflets on a rachis; palmate and trifoliate
  // leaves spread their leaflets from the tip of the petiole.
  function compoundLeaf(origin,a,length,rise,color) {
    const side=[-Math.sin(a)*.007,0,Math.cos(a)*.007],total=Math.max(3,m.leaflets||5);
    const shift=(p,k)=>p.map((c,i)=>c+k*side[i]);
    if(m.leafCompound==='pinnate'){
      const tip=advance(origin,a,length,rise),pairs=Math.max(1,Math.min(4,Math.floor(total/2)));
      face([shift(origin,-1),shift(origin,1),shift(tip,.6),shift(tip,-.6)],tint(color,.78));
      const size=length*(pairs>3?.30:.36);
      for(let p=1;p<=pairs;p++){
        const node=mix(origin,tip,.14+.76*p/(pairs+.35));
        for(const sign of [-1,1])blade(node,a+sign*1.08,size*(1-.07*p),widthOf(leafShape,size)*.82,rise*.12,leafShape,tint(color,sign>0?1:.87));
      }
      blade(tip,a,size,widthOf(leafShape,size)*.82,rise*.25,leafShape,tint(color,1.05));
      return;
    }
    const hub=advance(origin,a,length*.42,rise*.5),n=m.leafCompound==='trifoliate'?3:Math.max(3,Math.min(7,total));
    face([shift(origin,-1),shift(origin,1),shift(hub,.6),shift(hub,-.6)],tint(color,.78));
    const fanWidth=n===3?2.1:2.7,size=length*.6;
    for(let j=0;j<n;j++){
      const offset=n===1?0:(j/(n-1)-.5)*fanWidth,taper=1-.3*Math.abs(offset)/(fanWidth/2);
      blade(hub,a+offset,size*taper,widthOf(leafShape,size*taper)*.9,rise*.18,leafShape,tint(color,.9+.1*(j%2)));
    }
  }
  function foliage(point,dir,length,rise,shade,fold=.09,tilt=.44) {
    const color=tint(green,shade);
    if(compound)compoundLeaf(point,dir,length*1.55,rise,color);
    else if(leafShape==='scale')leaf(point,dir,length*.9,widthOf('scale',length*.9),rise+.03,'scale',color,.04,1.05);
    else leaf(point,dir,length,widthOf(leafShape,length),rise,leafShape,color,fold,tilt);
  }
  // A low-poly ball. Small fruits use an octahedron.
  function orb(c,r,color,small=false,surface) {
    const n=small?4:5,ring=(y,k)=>Array.from({length:n},(_,i)=>[c[0]+k*r*Math.cos(tau*i/n+.4),c[1]+y*r,c[2]+k*r*Math.sin(tau*i/n+.4)]);
    const top=[c[0],c[1]+r,c[2]],bottom=[c[0],c[1]-r,c[2]];
    const put=(v,shade)=>surface?upperFace(v,tint(color,shade),surface):face(v,tint(color,shade));
    if(small){
      const belt=ring(0,1);
      for(let i=0;i<n;i++){const j=(i+1)%n;put([belt[i],belt[j],top],.96+.1*(i%2));put([belt[j],belt[i],bottom],.74+.08*(i%2))}
      return;
    }
    const low=ring(-.45,.85),high=ring(.45,.85);
    for(let i=0;i<n;i++){
      const j=(i+1)%n,light=.86+.14*Math.cos(tau*i/n);
      put([low[j],low[i],bottom],light*.8);put([low[i],low[j],high[j],high[i]],light);put([high[i],high[j],top],light*1.1);
    }
  }
  function fruitAt(point,a,index=0) {
    const kind=m.fruit;
    if(kind==='pome'){const c=advance(point,a,.02,-.085);tube(point,[c[0],c[1]+.06,c[2]],.006,.005,wood,3);orb(c,.078,fruitColor)}
    else if(kind==='berry'){for(let j=0;j<3;j++)orb(advance(point,a+j*2.1+index,.034,-.035-.012*j),.036,fruitColor,true)}
    else if(kind==='pod'){for(let j=0;j<2;j++)blade(advance(point,a,.01,0),a+j*1.9+index,.055,.026,-.3-.05*j,'strap',tint(fruitColor,1-.1*j),undefined)}
    else if(kind==='samara'){for(const sign of [-1,1])blade(point,a+sign*.55,.1,.03,-.13,'lanceolate',tint(fruitColor,sign>0?1:.88),undefined)}
    else if(kind==='cone'){
      const base=advance(point,a,.01,.0),n=5,ring=Array.from({length:n},(_,i)=>[base[0]+.052*Math.cos(tau*i/n),base[1]+.045,base[2]+.052*Math.sin(tau*i/n)]);
      const top=[base[0],base[1]+.15,base[2]],bottom=[base[0],base[1]-.02,base[2]];
      for(let i=0;i<n;i++){const j=(i+1)%n;face([ring[i],ring[j],top],tint(fruitColor,.86+.2*(i%2)));face([ring[j],ring[i],bottom],tint(fruitColor,.7))}
    }else if(kind==='capsule'){
      for(let k=0;k<2;k++){
        const top=advance(point,a+k*2.4+index,.03*k,-.01),ring=Array.from({length:3},(_,i)=>[top[0]+.05*Math.cos(tau*i/3+k),top[1]-.075,top[2]+.05*Math.sin(tau*i/3+k)]);
        const bottom=[top[0],top[1]-.16,top[2]];
        for(let i=0;i<3;i++){const j=(i+1)%3;face([top,ring[i],ring[j]],tint(fruitColor,1.05-.1*i));face([ring[j],ring[i],bottom],tint(fruitColor,.9-.08*i))}
      }
    }
  }
  // Flower faces tilt toward the side; the petal ring and centre remain
  // visible at the lower angle used for the shelf as well as from above.
  function flowerHead(center,a,radius,petals,shape,detail=true,tilt) {
    const forward=[Math.cos(a),0,Math.sin(a)],right=[-forward[2],0,forward[0]];
    const sin=tilt??(shape==='trumpet'?.9:shape==='pea'?.86:.61),cos=Math.sqrt(1-sin*sin);
    const normal=[sin*forward[0],cos,sin*forward[2]],across=[cos*forward[0],-sin,cos*forward[2]];
    const point=(x,y,z)=>center.map((c,i)=>c+radius*(x*right[i]+y*across[i]+z*normal[i]));
    function radial(t,r,w,h){
      return point(Math.cos(t)*r-Math.sin(t)*w,Math.sin(t)*r+Math.cos(t)*w,h);
    }
    function ring(n,{mid=.68,reach=.96,breadth=.3,raise=.055,lift=.072,color=flower,offset=0,two=detail,inner=.09}={}) {
      for(let j=0;j<n;j++){
        const t=offset+j*tau/n,far=reach*(1+.047*Math.sin(j*golden));
        const a0=radial(t,inner,0,0),l=radial(t,mid,-breadth,raise),u=radial(t,far-.05*reach,-breadth*.73,raise+lift*.76),end=radial(t,far,0,raise+lift),v=radial(t,far-.03*reach,breadth*.66,raise+lift*.7),p=radial(t,mid+.03*reach,breadth,raise);
        if(two){
          const rib=radial(t,mid,0,raise+lift*.6+.045);
          upperFace([a0,l,u,end,rib],tint(color,.97+.03*(j%3)),'bloom');upperFace([a0,rib,end,v,p],tint(color,.85+.035*(j%2)),'bloom');
        }else upperFace([a0,l,u,end,v,p],tint(color,j%2?.9:1),'bloom');
      }
    }
    const disk=(r,h,color,sides=detail?12:7)=>upperFace(Array.from({length:sides},(_,i)=>radial(i*tau/sides,r,0,h)),color,'bloom');
    const n=Math.max(3,Math.min(24,Math.round(petals||5)));
    if(shape==='pea'){
      // Banner, two wings and a keel.
      upperFace([point(0,0,.05),point(-.55,-.3,.18),point(-.44,-.92,.34),point(0,-1.05,.4),point(.44,-.92,.34),point(.55,-.3,.18)],flower,'bloom');
      for(const s of [-1,1])upperFace([point(0,.02,.12),point(s*.42,.12,.5),point(s*.32,.56,.78),point(s*.05,.46,.62)],tint(flower,.84),'bloom');
      upperFace([point(0,.1,.2),point(-.13,.5,.66),point(0,.72,.84),point(.13,.5,.66)],tint(flower,1.1),'bloom');
      return;
    }
    if(shape==='iris'){
      for(let j=0;j<3;j++){
        const t=j*tau/3,s=t+tau/6;
        upperFace([radial(t,.08,0,.1),radial(t,.55,-.34,.3),radial(t,.98,-.2,-.12),radial(t,1.08,0,-.3),radial(t,.98,.2,-.12),radial(t,.55,.34,.3)],tint(flower,.92+.05*j),'bloom');
        upperFace([radial(t,.2,0,.2),radial(t,.5,-.07,.31),radial(t,.74,0,.14),radial(t,.5,.07,.31)],heart||'#f1dd8a','bloom');
        upperFace([radial(s,.06,0,.15),radial(s,.3,-.2,.6),radial(s,.2,0,1.05),radial(s,.3,.2,.6)],tint(flower,1.1),'bloom');
      }
      return;
    }
    if(shape==='tuft'){
      for(let j=0;j<n;j++){
        const t=j*tau/n,r=.55+.4*((j*7)%5)/5;
        upperFace([radial(t,.06,0,.05),radial(t,r,-.05,.75),radial(t,r+.06,.05,.8)],tint(flower,.92+.12*(j%3)/2),'bloom');
      }
      disk(.14,.08,tint(green,1.1),6);
      return;
    }
    if(shape==='star'){
      const b=Math.min(.24,1.25/n);
      for(let j=0;j<n;j++){
        const t=j*tau/n;
        upperFace([radial(t,.08,0,.02),radial(t,.52,-b,.08),radial(t,1,0,.12),radial(t,.52,b,.08)],tint(flower,j%2?.9:1),'bloom');
      }
      disk(.15,.09,heart||'#e9c65a',6);
      return;
    }
    if(shape==='double'){
      const outer=Math.max(5,Math.min(9,Math.round(n*.45)));
      ring(outer,{mid:.62,reach:1,breadth:Math.min(.52,2.7/outer),raise:.12,lift:.2,two:false});
      ring(Math.max(4,outer-2),{mid:.42,reach:.7,breadth:.3,raise:.3,lift:.24,offset:.4,color:tint(flower,.93),two:false});
      ring(4,{mid:.24,reach:.42,breadth:.2,raise:.46,lift:.2,offset:.9,color:tint(flower,.86),two:false});
      disk(.12,.6,heart||tint(flower,.78),6);
      return;
    }
    if(shape==='trumpet'){
      ring(n,{breadth:Math.min(.55,2.9/n),raise:.25,lift:.072});
      disk(.17,.115,heart||tint(flower,.7));
      if(detail){
        const apex=point(.02,.08,.78);tube(center,apex,.012,.009,'#dd9a79');
        for(let j=0;j<6;j++){const s=radial(j*tau/6,.11,0,.66);tube(s,advance(s,j,.009,.025),.018,.012,'#e7bf58',4)}
      }
      return;
    }
    if(shape==='cup'||shape==='cross'){
      const flat=shape==='cross';
      ring(n,{mid:.6,reach:.94,breadth:Math.min(flat?.44:.52,2.5/n),raise:flat?.07:.24,lift:flat?.05:.26});
      disk(flat?.15:.2,flat?.1:.17,heart||'#e9c65a');
      if(detail&&!flat)for(let k=0;k<5;k++)face(Array.from({length:4},(_,q)=>radial(k*tau/5+.3,.1,0,.2).map((c,i)=>c+radius*.035*(q%2?right[i]:across[i])*(q<2?1:-1))),'#f6e2a0');
      return;
    }
    // Daisy heads. A head of ray florets only has a second, shorter ring in place of the disc.
    const ligulate=heart&&heart.toLowerCase()===m.bloom.toLowerCase();
    ring(n,{breadth:Math.min(.35,2.05/n)});
    if(ligulate){
      ring(Math.max(6,Math.round(n/2)),{mid:.36,reach:.58,breadth:.13,raise:.1,lift:.08,offset:.2,color:tint(flower,.93),two:false});
      disk(.13,.17,tint(flower,.86),7);
      return;
    }
    disk(.235,.115,heart||'#d49835');
    if(detail){
      // Small florets give the raised flower centre a granular surface at close range.
      const pale=heart?tint(heart,1.25):'#edbc4c',bright=heart?tint(heart,1.5):'#ffe094';
      for(let k=0;k<10;k++){
        const ang=k*golden,r=.18*Math.sqrt(k/10),cx=r*Math.cos(ang),cy=r*Math.sin(ang),h=.125+.06*(1-r/.18);
        face(Array.from({length:5},(_,q)=>point(cx+.037*Math.cos(q*tau/5),cy+.037*Math.sin(q*tau/5),h)),k%3?pale:bright);
      }
    }
  }
  // Tiny florets of a dense inflorescence: two crossed diamonds.
  function bud(p,dir,size,color) {
    const c=Math.cos(dir+Math.PI/2)*size,s=Math.sin(dir+Math.PI/2)*size;
    upperFace([[p[0]-c,p[1],p[2]-s],[p[0],p[1]+size*.85,p[2]],[p[0]+c,p[1],p[2]+s],[p[0],p[1]-size*.85,p[2]]],color,'bloom');
    upperFace([[p[0]-size,p[1],p[2]],[p[0],p[1],p[2]-size],[p[0]+size,p[1],p[2]],[p[0],p[1],p[2]+size]],tint(color,.86),'bloom');
  }
  // A grass ear, catkin or other dense spike without visible petals.
  function ear(base,a,length,nod=.25) {
    const top=advance(base,a,length*nod,length*Math.sqrt(1-nod*nod)),r=length*.105,n=4;
    const axis=top.map((v,i)=>v-base[i]),ring=(t,k)=>Array.from({length:n},(_,i)=>{
      const p=mix(base,top,t),ang=tau*i/n+.5;
      return [p[0]+k*r*Math.cos(ang),p[1]+k*r*.25*Math.sin(ang),p[2]+k*r*Math.sin(ang)];
    });
    const low=ring(.2,1),high=ring(.72,.82);
    for(let i=0;i<n;i++){
      const j=(i+1)%n,shade=.84+.2*(i%2);
      upperFace([base,low[i],low[j]],tint(flower,shade*.9),'bloom');upperFace([low[i],low[j],high[j],high[i]],tint(flower,shade),'bloom');upperFace([high[i],high[j],top],tint(flower,shade*1.08),'bloom');
    }
    for(let k=0;k<5;k++){
      const p=mix(base,top,.3+.14*k),ang=a+k*golden,tip=[p[0]+r*2.3*Math.cos(ang),p[1]+length*.3,p[2]+r*2.3*Math.sin(ang)];
      face([p,[p[0]+axis[0]*.05,p[1]+axis[1]*.05,p[2]+axis[2]*.05],tip],tint(flower,1.16));
    }
  }
  function flowerSpray(tip,a,radius,detail=!woody) {
    if(!flowering)return;
    const shape=m.flowerShape,layout=m.inflorescence,petals=Math.max(3,Math.min(24,Math.round(m.petals||5)));
    if(shape==='ear'){ear(tip,a,radius*2.1);return}
    if(shape==='globe'){orb(advance(tip,a,0,radius*.45),radius*.5,flower,false,'bloom');return}
    if(layout==='solitary'){flowerHead(tip,a,radius,petals,shape,detail);return}
    if(layout==='cluster'){
      const n=detail?4:3;
      for(let i=0;i<n;i++){
        const az=a+i*golden,end=advance(tip,az,radius*(.5+.16*(i%2)),radius*(.3+.26*(i%2)));
        tube(tip,end,.007,.004,green,3);
        flowerHead(end,az,radius*.5,Math.min(10,petals),shape,false);
      }
      return;
    }
    if(layout==='spike'){
      const n=detail?6:5,height=radius*2.4,top=advance(tip,a,.03,height);
      tube(tip,top,.011,.004,green,4);
      for(let i=0;i<n;i++){
        const az=a+i*golden,base=mix(tip,top,.12+.8*i/(n-1)),size=radius*(.42-.035*i);
        flowerHead(advance(base,az,size*.5,size*.12),az,size,Math.min(8,petals),shape,false);
      }
      return;
    }
    // Panicles rise as a cone of florets; pendant racemes hang and taper.
    const hanging=layout==='pendant',n=hanging?11:13,height=radius*(hanging?2.9:2.3);
    const end=hanging?advance(tip,a,radius*.5,-height):advance(tip,a,.02,height);
    tube(tip,end,.008,.003,green,3);
    for(let i=0;i<n;i++){
      const level=(i+.5)/n,az=a+i*golden,spread=radius*(hanging?.2+.28*(1-level):.62*(1-level)+.06);
      const p=advance(mix(tip,end,level),az,spread,0);
      bud(p,az,radius*(hanging?.2-.09*level:.21-.07*level),tint(flower,.9+.16*((i*5)%4)/3));
    }
  }
  function branchExtras(i,tip,twigEnd,a,flowersAt) {
    if(flowering){
      const every=load>=3?1:load<=1?4:3;
      if(i%every===(every===1?0:1))flowerSpray(tip,a,flowersAt);
      if(load>=3&&i%2===0)flowerSpray(twigEnd,a+1.3,flowersAt*.85);
    }
    if(m.fruit!=='none'&&(flowering?i%3===2:i%2===0))fruitAt(twigEnd,a,i);
  }
  function leafyTree() {
    const crown=m.crownShape,weeping=crown==='weeping',shrub=m.form==='shrub',spreading=crown==='spreading';
    const needle=leafShape==='needle',scale=leafShape==='scale',conifer=needle||scale;
    const conical=crown==='conical'||(conifer&&crown!=='columnar'&&crown!=='spreading'&&crown!=='rounded'),columnar=crown==='columnar';
    const tall=(conical||columnar?2.15:shrub?1.24:1.86)*m.height;
    const trunk=[[0,0,0],[-.05,tall*.35,.02],[.035,tall*.66,-.025],[.015,tall,.01]];
    for(let i=0;i<3;i++)tube(trunk[i],trunk[i+1],.082-i*.023,.059-i*.021,wood,7);
    const tiers=Math.max(6,Math.min(scale?12:11,m.count+(scale?5:2)));
    for(let i=0;i<tiers;i++){
      const a=golden*i+.22,t=i/tiers,y=tall*(columnar?.14+.76*t:scale?.18+.7*t:.26+.59*t);
      const crownWidth=crown==='rounded'?.68+.36*Math.sin(Math.PI*t):columnar?.55+.3*Math.sin(Math.PI*t):scale?1.02-.74*t:.99-.52*t;
      const width=(conical?1.05:columnar?.56:weeping?.98:spreading?.97:shrub?.62:.70)*crownWidth*m.spread;
      const climb=columnar?.34:.22;
      const base=[.012,y,0],elbow=advance(base,a,width*.49,climb),tip=advance(elbow,a+.12,width*.46,needle?.09:columnar?.3:scale?.1:.20);
      tube(base,elbow,.045-.018*t,.031-.012*t,wood);tube(elbow,tip,.031-.012*t,.011,wood);
      if(weeping){
        for(let j=0;j<3;j++){
          const az=a+(j-1)*.49,join=j===1?tip:mix(elbow,tip,.62);
          const arc=advance(join,az,.16,.07),mid=advance(arc,az,.13,-.35),end=advance(mid,az,-.04,-(.43+.23*Math.sin(i+j)**2));
          tube(join,arc,.013,.01,wood,4);tube(arc,mid,.01,.006,'#718157',4);tube(mid,end,.006,.003,'#849063',4);
          const shape=compound?'lanceolate':leafShape,n=compound?4:6;
          for(let k=0;k<n;k++){
            const point=k<n/2?mix(arc,mid,k/(n/2)):mix(mid,end,(k-n/2)/(n/2));
            if(compound)compoundLeaf(point,az+(k%2?1.4:-1.35),.2,-.2,tint(green,.91+.1*(k%2)));
            else leaf(point,az+(k%2?1.4:-1.35),.12,Math.min(.05,widthOf(shape,.12)*.77),-.19,shape,tint(green,.91+.1*(k%2)));
          }
          if(j===1&&flowering&&i%3===1)flowerSpray(mid,az,.13);
        }
        continue;
      }
      let twigEnd=tip;
      for(let j=0;j<2;j++){
        const az=a+(j===0?-.60:.56),join=j===0?mix(elbow,tip,.56):tip;
        const end=advance(join,az,.21,needle?.02:scale?.08:.13);
        tube(join,end,.013,.005,wood,4);
        if(j===0)twigEnd=end;
        const n=needle?8:scale?4:compound?2:leavesPerNode===3?6:4,perNode=compound?1:leavesPerNode;
        for(let k=0;k<n;k++){
          const node=Math.floor(k/perNode),nodes=Math.ceil(n/perNode);
          const along=m.arrangement==='basal'?.07+.03*k:.23+.71*node/Math.max(1,nodes-1);
          const point=mix(join,end,along),dir=az+node*golden+(k%perNode)*tau/perNode;
          foliage(point,scale?az+(k-1.5)*.5:dir,.29,.105+.065*Math.sin(k+i),.92+.06*((i+k)%3));
        }
      }
      branchExtras(i,tip,twigEnd,a,shrub?.2:.18);
    }
    if(conical||columnar)foliage(trunk[3],.4,.24,.2,1);
  }
  // Fountain-shaped shrubs such as forsythia: long canes rise and arch over.
  function archingShrub() {
    const canes=Math.max(5,Math.min(8,Math.round(m.count*.9))),tall=1.2*m.height;
    for(let j=0;j<canes;j++){
      const a=golden*j+.4,reach=m.spread*(.82+.22*Math.sin(j*1.7)**2),lift=tall*(.78+.22*Math.cos(j*2.3)**2);
      const p0=advance([0,0,0],a,.04,0),p1=advance(p0,a,.2*reach,lift*.62),p2=advance(p1,a+.12,.36*reach,lift*.3),p3=advance(p2,a+.22,.3*reach,-lift*.2);
      tube(p0,p1,.03,.021,wood,4);tube(p1,p2,.021,.013,wood,4);tube(p2,p3,.013,.005,wood,4);
      const path=t=>t<.5?mix(p1,p2,t*2):mix(p2,p3,t*2-1),nodes=compound?3:5;
      for(let k=0;k<nodes;k++){
        const point=path((k+.4)/nodes),sides=compound?1:Math.max(1,Math.min(2,leavesPerNode));
        for(let s=0;s<sides;s++)foliage(point,a+(sides===2?(s?1.25:-1.25):(k%2?1.2:-1.2)),.24,.05,.92+.06*((j+k+s)%3));
        if(!flowering)continue;
        const spot=advance(point,a+(k%2?-1.5:1.5),.04,.03);
        if(m.inflorescence==='solitary'){if(load>=3||k%2===0)flowerHead(spot,a+k*golden,.1,Math.max(3,Math.min(12,m.petals)),m.flowerShape,false,.45)}
        else if(k%2===(j%2)||load>=3&&k%2===0)flowerSpray(spot,a+k*golden,.13);
      }
      if(m.fruit!=='none'&&j%2===0)fruitAt(path(.8),a,j);
    }
  }
  // Climbers twine up a tripod of canes.
  function vine() {
    const tall=2.02*m.height,cane='#a98f6a',stem=woody?wood:tint(green,.82),apex=[0,tall,0];
    for(let k=0;k<3;k++)tube(advance([0,0,0],k*tau/3+.5,.36*m.spread,0),apex,.022,.014,cane,4);
    for(const y of [.33,.66]){
      const hoop=Array.from({length:3},(_,k)=>advance([0,tall*y,0],k*tau/3+.5,.36*m.spread*(1-y),0));
      for(let k=0;k<3;k++)tube(hoop[k],hoop[(k+1)%3],.009,.009,cane,3);
    }
    const steps=11;
    for(let s=0;s<2;s++){
      const at=j=>{const t=j/steps;return advance([0,tall*(.02+.96*t),0],s*Math.PI+t*tau*1.45,(.4*(1-t)+.05)*m.spread,0)};
      for(let j=0;j<steps;j++){
        const p=at(j),q=at(j+1),dir=Math.atan2(p[2],p[0]);
        tube(p,q,(woody?.02:.012)*(1-.5*j/steps),(woody?.018:.011)*(1-.5*(j+1)/steps),stem,3);
        if(j===0)continue;
        const sides=compound?1:Math.max(1,Math.min(2,leavesPerNode));
        for(let k=0;k<sides;k++)foliage(p,dir+(k?-.8:.7)*(j%2?1:-1),.27,.02,.9+.07*((j+k+s)%3));
        if(flowering&&(load>=3?j%2===s:j%3===s+1)){
          const out=advance(p,dir,.07,m.inflorescence==='pendant'?-.02:.05);
          flowerSpray(out,dir,m.inflorescence==='pendant'?.15:.17);
        }else if(m.fruit!=='none'&&j%4===2+s)fruitAt(advance(p,dir,.05,-.02),dir,j);
      }
    }
  }
  function bamboo() {
    const culms=Math.max(3,Math.min(5,Math.round(m.count/2.4))),culm=tint(green,.94);
    for(let c=0;c<culms;c++){
      const a=golden*c+.3,lean=.1+.07*(c%3),tall=m.height*(1.95-.17*(c%3)),base=advance([0,0,0],a,.09+.05*(c%2),0),joints=6;
      const at=j=>advance(base,a,lean*(j/joints)**1.6,tall*j/joints);
      for(let j=0;j<joints;j++){
        const p=at(j),q=at(j+1),r=.034*(1-.1*j);
        tube(p,q,r,r*.92,tint(culm,j%2?.92:1.04),5);
        if(j<2)continue;
        const az=a+j*golden,end=advance(q,az,.2,.06);
        tube(q,end,.008,.004,tint(culm,.9),3);
        for(let k=0;k<4;k++)blade(mix(q,end,.4+.2*k),az+(k-1.5)*.62,.24,.03*aspect,-.05-.03*k,'lanceolate',tint(green,.92+.07*((j+k)%3)));
      }
    }
  }
  // Lotus and water lilies: peltate pads on long stalks around the blooms.
  function aquatic() {
    const pads=Math.max(3,Math.min(5,Math.round(m.count/2))),floating=m.height<.75;
    for(let j=0;j<pads;j++){
      const a=golden*j+.5,reach=m.spread*(.2+.16*(j%3)),high=floating?.06+.02*j:m.height*(.5+.2*((j*2)%3)),top=advance([0,0,0],a,reach,high);
      tube(advance([0,0,0],a,.04,0),top,.014,.011,tint(green,.86),4);
      const r=(.3-.03*(j%2))*m.spread,n=10,dip=floating?0:.05;
      const rim=Array.from({length:n},(_,i)=>[top[0]+r*Math.cos(tau*i/n+a),top[1]+dip+.03*Math.sin(tau*i/n*2+j),top[2]+r*Math.sin(tau*i/n+a)]);
      for(let i=0;i<n;i+=2)upperFace([top,rim[i],rim[i+1],rim[(i+2)%n]],tint(green,.9+.08*((i/2+j)%3)),'leaf');
    }
    if(flowering){
      const blooms=m.count>=9?2:1;
      for(let j=0;j<blooms;j++){
        const a=golden*(j+2.4),top=advance([0,0,0],a,.1+.16*j,floating?.16:m.height*(1.12-.22*j));
        tube(advance([0,0,0],a,.03,0),top,.014,.011,tint(green,.86),4);
        flowerHead(top,a,.25,m.petals,m.flowerShape,true,.3);
      }
    }
    if(m.fruit==='cone'){
      const a=golden*5,top=advance([0,0,0],a,.3*m.spread,m.height*.86),n=7,r=.1;
      tube(advance([0,0,0],a,.05,0),top,.012,.01,tint(green,.86),4);
      const rim=Array.from({length:n},(_,i)=>[top[0]+r*Math.cos(tau*i/n),top[1]+.11,top[2]+r*Math.sin(tau*i/n)]);
      for(let i=0;i<n;i++)face([top,rim[i],rim[(i+1)%n]],tint(fruitColor,.8+.14*(i%2)));
      upperFace(rim,tint(fruitColor,1.12),'leaf');
      for(let i=0;i<5;i++){const p=[top[0]+.055*Math.cos(i*tau/5),top[1]+.112,top[2]+.055*Math.sin(i*tau/5)];face([[p[0]-.014,p[1],p[2]],[p[0],p[1],p[2]-.014],[p[0]+.014,p[1],p[2]],[p[0],p[1],p[2]+.014]],tint(fruitColor,.62))}
    }
  }
  function rosette() {
    const count=Math.min(14,Math.max(4,m.count)),succulent=leafShape==='succulent';
    for(let tier=0;tier<3;tier++){
      const n=succulent?Math.max(6,Math.min(12,count)-tier*2):Math.max(5,Math.round(count*.5)-tier);
      for(let j=0;j<n;j++){
        const a=tau*j/n+tier*golden,origin=advance([0,tier*.065,0],a,.035,0);
        if(succulent)leaf(origin,a,.67-.19*tier,.16-.025*tier,.13+tier*.17,'succulent',tint(green,.88+.09*(tier+j%2)),.34);
        else leaf(origin,a,.56-.13*tier,(leafShape==='strap'?.05:widthOf(leafShape,.5)*.5),.2+tier*.3,leafShape,tint(green,.88+.08*((tier+j)%3)),.06,.2);
      }
    }
    if(flowering){
      const tip=[.035,succulent?.84:1.3,.025];
      tube([0,.08,0],tip,.016,.008,green,5);
      flowerSpray(tip,.35,succulent?.16:.22,true);
    }
  }
  function grass() {
    const count=Math.min(12,Math.max(4,m.count)),wide=leafShape==='strap';
    for(let tier=0;tier<2;tier++){
      for(let j=0;j<count;j++){
        const a=tau*j/count+tier*golden,origin=advance([0,tier*.065,0],a,.035,0);
        leaf(origin,a,(.38+.13*Math.cos(j))*(wide?1.12:1),wide?.052:.037,(.66+.39*Math.sin(j+tier)**2)*(wide?.8:1),wide?'strap':'lanceolate',tint(green,.88+.09*(tier+j%2)),.24);
      }
    }
    if(!flowering)return;
    const culms=m.flowerShape==='ear'?3:2;
    for(let k=0;k<culms;k++){
      const a=golden*k+.8,base=advance([0,.05,0],a,.03,0),top=advance(base,a,.13+.06*k,(wide?.86:1.02)+.12*k);
      tube(base,top,.012,.007,tint(green,.95),4);
      if(m.flowerShape==='ear')ear(top,a,.3,m.bloom.toLowerCase()==='#a9c47a'?.5:.22);
      else flowerSpray(top,a,.13,false);
    }
  }
  // Tall grasses with leaves spaced along a stout stalk, such as maize.
  function cane() {
    const stalks=m.count>=9?3:2;
    for(let s=0;s<stalks;s++){
      const a=golden*s+.6,base=advance([0,0,0],a,.1*s,0),tall=m.height*(1.5-.14*s),joints=5;
      const at=j=>advance(base,a,.04*j,tall*j/joints);
      for(let j=0;j<joints;j++){
        tube(at(j),at(j+1),.03-.003*j,.027-.003*j,tint(green,j%2?.9:1),5);
        const dir=a+Math.PI/2+j*Math.PI;
        leaf(at(j+.6),dir,.46-.03*j,.062,.15-.05*j,'strap',tint(green,.9+.08*(j%3)),.2,.2);
        if(j===2&&m.flowerShape==='ear'){const cob=advance(at(j+.4),dir+Math.PI,.05,.02);const keep=faces.length;ear(cob,dir+Math.PI,.26,.3);for(let f=keep;f<faces.length;f++)faces[f].color=tint(green,1.12)}
      }
      if(flowering)ear(at(joints),a,.3,.12);
    }
  }
  function herbs() {
    const count=Math.min(12,Math.max(3,m.count)),basal=m.arrangement==='basal',strap=leafShape==='strap';
    const showy=m.flowerShape!=='ear'&&m.flowerShape!=='globe';
    if(basal){
      if(strap){
        // Sword leaves stand in a fan; outer blades lean further out.
        const n=Math.max(6,Math.min(11,count+1));
        for(let j=0;j<n;j++){
          const a=golden*j,lean=.16+.3*((j*3)%5)/4,len=m.height*(.86-.24*lean);
          leaf(advance([0,0,0],a,.03,0),a,len*lean*1.25,.046,len,'strap',tint(green,.9+.06*(j%3)),.08,.12);
        }
      }else if(compound){
        const n=Math.max(6,Math.min(9,count));
        for(let j=0;j<n;j++)compoundLeaf(advance([0,.01,0],golden*j,.02,0),golden*j,(.34+.08*(j%3))*m.spread,.13+.09*(j%3),tint(green,.92+.05*(j%3)));
      }else{
        const broad=['heart','round','oval'].includes(leafShape)&&aspect>1.05,n=broad?9:11,len=(broad?.4:.35)*m.spread;
        for(let j=0;j<n;j++)leaf([0,.035,0],j*golden,len,widthOf(leafShape,len)*.62,broad?.13+.05*(j%3):.08,leafShape,tint(green,.92+.05*(j%3)));
      }
      if(!flowering)return;
    }
    const stems=basal?Math.max(2,Math.min(5,Math.round(count*.5))):Math.max(2,Math.min(6,Math.round(count*.63)));
    const big=m.inflorescence==='solitary'&&count<=4?1.35:1;
    for(let j=0;j<stems;j++){
      const a=golden*j,r=.13+.23*Math.sin(j*1.57)**2,stemH=m.height*(.66+.30*Math.cos(j*1.42)**2);
      const base=advance([0,.008,0],a,r*.18,0),bend=advance(base,a,r*.42,stemH*.57),tip=advance(bend,a+.26,r*.68,stemH*.43);
      const thick=basal?.8:1;
      tube(base,bend,.019*thick,.013*thick,green,basal?4:5);tube(bend,tip,.013*thick,.009*thick,green,basal?4:5);
      if(!basal){
        const perNode=compound?1:Math.max(1,leavesPerNode),nodes=compound?3:4;
        for(let k=0;k<nodes;k++){
          const node=k<2?mix(base,bend,.33+k*.53):mix(bend,tip,(k-2)*.65+.19);
          for(let side=0;side<perNode;side++){
            const dir=a+k*(perNode===2?Math.PI/2:golden)+side*tau/perNode,len=(.31-.037*k)*m.spread*big;
            if(compound)compoundLeaf(node,dir,len*1.15,.06,tint(green,.91+.07*((k+side)%3)));
            else leaf(node,dir,len,widthOf(leafShape,len)*(leafShape==='needle'?1.6:.8),.075,leafShape,tint(green,.91+.07*((k+side)%3)));
          }
        }
      }
      if(flowering)flowerSpray(tip,1.15+.52*Math.sin(j*golden),(showy&&m.flowerShape==='daisy'&&m.petals>=14&&big===1?.18:.21)*big,true);
    }
  }
  if(m.habit==='bamboo')bamboo();
  else if(m.habit==='aquatic')aquatic();
  else if(m.habit==='vine')vine();
  else if(woody)(m.crownShape==='arching'?archingShrub:leafyTree)();
  else if(m.form==='rosette')rosette();
  else if(m.form==='grass')(m.arrangement==='alternate'?cane:grass)();
  else herbs();
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
GardenLayout.setSpecimenMesh(specimenMesh);
function paintPot(canvas,plant){paintSpecimen(canvas,plant,{potted:true,portrait:false,width:300,height:320})}
