// Local model coordinates use the ground plane as y=0. These models can
// rotate as single rigid objects without changing their collision footprint.
function studioSetpiece(kind,{face,ring,loft,rectangle,box,pillar},snowy){
  const oak=['#976b49','#ae8058','#b88d66','#d1ac80'];
  const walnut=['#685044','#785b49','#85674f','#a78260'];
  const iron=['#465f58','#5c756b','#6b8275','#879783'];
  const brass=['#9b784a','#b79059','#bd9d6c','#d7bb84'];
  const clay=['#aa6b50','#c18360','#ce906b','#dda17a'];
  const porcelain=['#bfc6af','#d0d7bf','#dce2ce','#f0eddb'];
  const slate=['#90998e','#a5a899','#b5b6a4',snowy?'#dfe6dc':'#c9c8b0'];
  const enamel=['#4e766e','#61887e','#74978a','#99b4a2'];
  const water=['#588c89','#6e9f98','#84b3a9','#a7ccc0'];

  function tube(a,b,ra,rb,colors,n=8){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
    const length=Math.hypot(dx,dy,dz),horizontal=Math.hypot(dx,dz);
    const u=horizontal>1e-6?[dz/horizontal,0,-dx/horizontal]:[1,0,0];
    const v=[(dy*u[2]-dz*u[1])/length,(dz*u[0]-dx*u[2])/length,(dx*u[1]-dy*u[0])/length];
    function circle(center,r){
      return Array.from({length:n},(_,i)=>{
        const angle=2*Math.PI*i/n,c=Math.cos(angle),s=Math.sin(angle);
        return center.map((value,j)=>value+r*(c*u[j]+s*v[j]));
      });
    }
    loft(circle(a,ra),circle(b,rb),colors);
  }
  function vessel(x,y,z,r,h,colors){
    pillar(x,y,z,r*.72,r*.72,h*.85,colors,12,1.30);
    pillar(x,y+h*.84,z,r,r,h*.16,colors,12);
    face(ring(x,y+h+.001,z,r*.82,r*.82,12),'#665545');
  }
  function rosette(x,y,z,r,leafCount){
    const tones=['#608d73','#739b79','#79a388','#88b097'];
    for(let i=0;i<leafCount;i++){
      const a=i*2.39996,len=r*(1-.45*i/leafCount),c=Math.cos(a),s=Math.sin(a);
      const base=[x,y,z],tip=[x+len*c,y+r*(.26+.45*i/leafCount),z+len*s];
      const ridge=[x+len*.47*c,y+r*.31,z+len*.47*s];
      const left=[ridge[0]-len*.20*s,y+r*.16,ridge[2]+len*.20*c];
      const right=[ridge[0]+len*.20*s,y+r*.16,ridge[2]-len*.20*c];
      face([base,left,tip,ridge],tones[i%4]);face([base,ridge,tip,right],tones[(i+1)%4]);
    }
  }

  if(kind==='terrarium'){
    const w=.99,d=.66,eave=.82,peak=1.11;
    box(0,0,0,w+.06,.09,d+.06,walnut);
    box(0,.081,0,w,.12,d,brass);
    box(0,.197,0,w-.055,.023,d-.055,walnut);
    rosette(-.18,.22,.06,.24,11);rosette(.19,.22,-.07,.20,9);
    for(let i=0;i<6;i++)pillar(.22*Math.cos(i*1.6),.22,.20*Math.sin(i*1.6),.046,.038,.035,slate,6,.72);
    for(const x of [-w/2,w/2]){
      for(const z of [-d/2,d/2]){
        box(x,.17,z,.031,eave-.17,.031,brass);
        tube([x,eave,z],[x,peak,0],.018,.018,brass,6);
      }
      face([[x,.21,-d/2],[x,.21,d/2],[x,eave,d/2],[x,peak,0],[x,eave,-d/2]],'#bdddd127');
    }
    for(const z of [-d/2,d/2]){
      box(0,eave-.015,z,w+.025,.032,.03,brass);
      face([[-w/2,.21,z],[w/2,.21,z],[w/2,eave,z],[-w/2,eave,z]],'#c6e5dc26');
      face([[-w/2,eave,z],[w/2,eave,z],[w/2,peak,0],[-w/2,peak,0]],'#e1eee84e');
      tube([0,eave,z],[0,peak,0],.013,.013,brass,6);
    }
    box(0,peak-.012,0,w+.04,.028,.032,brass);
  }else if(kind==='worktable'){
    for(const x of [-.63,.63])for(const z of [-.28,.28])box(x,0,z,.084,1.02,.084,walnut);
    for(let j=0;j<4;j++)box(0,.17,-.23+j*.15,1.31,.06,.13,oak);
    box(0,.84,0,1.35,.16,.61,walnut);
    for(const x of [-.32,.32]){
      box(x,.85,.319,.61,.13,.024,oak);box(x,.91,.349,.16,.023,.034,brass);
    }
    box(0,.994,0,1.48,.075,.76,oak);
    for(const x of [-.64,.64])box(x,1.05,-.30,.055,.49,.06,walnut);
    box(0,1.43,-.28,1.34,.056,.21,oak);
    for(let i=0;i<3;i++)vessel(-.40+i*.19,1.486,-.28,.077,.105,clay);
    vessel(.31,1.07,-.04,.118,.157,enamel);rosette(.31,1.23,-.04,.13,8);
    box(-.25,1.069,.01,.38,.038,.24,iron);
    tube([-.40,1.12,.10],[-.20,1.12,.04],.018,.023,walnut);
    face([[-.21,1.112,.048],[-.13,1.110,-.01],[-.068,1.116,-.003],[-.105,1.123,.052]],'#bec9bb');
    for(let i=0;i<2;i++)vessel(-.32+i*.32,.233,.07,.135,.207,clay);
  }else if(kind==='plantstand'){
    for(const x of [-.47,.47]){
      tube([x,.02,.29],[x,1.36,-.28],.035,.035,walnut,6);
      tube([x,.02,-.31],[x,1.36,-.28],.035,.035,walnut,6);
    }
    for(let i=0;i<3;i++){
      const y=.25+i*.46,z=.10-i*.14;
      box(0,y,z,1.08,.066,.39,oak);
      box(0,y+.066,z-.176,1.07,.065,.034,walnut);
      for(let j=0;j<2;j++){
        const x=-.25+j*.49,r=i===1?.14:.113;
        vessel(x,y+.068,z,r,.158,j===i%2?clay:porcelain);
        rosette(x,y+.226,z,r*1.32,8+i);
      }
    }
  }else if(kind==='wateringcan'){
    pillar(-.10,0,0,.246,.218,.06,iron,14,1.06);
    pillar(-.10,.052,0,.26,.23,.46,enamel,14,.91);
    pillar(-.10,.48,0,.245,.217,.043,brass,14);
    face(ring(-.10,.526,0,.17,.135,14),'#475d51');
    tube([.10,.105,0],[.43,.38,0],.082,.062,enamel,10);
    tube([.43,.38,0],[.58,.535,0],.062,.045,enamel,10);
    tube([.56,.515,0],[.61,.57,0],.054,.109,brass,12);
    const x0=-.39,y0=.30;
    for(let i=0;i<10;i++){
      const a=.5*Math.PI+i*Math.PI/10,b=a+Math.PI/10;
      tube([x0+.19*Math.cos(a),y0+.19*Math.sin(a),0],[x0+.19*Math.cos(b),y0+.19*Math.sin(b),0],.026,.026,brass,7);
    }
    for(const y of [.112,.49])tube([-.39,y,0],[-.29,y,0],.026,.026,brass,7);
  }else if(kind==='teatable'){
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3;
      tube([.33*Math.cos(a),.010,.33*Math.sin(a)],[.19*Math.cos(a),.58,.19*Math.sin(a)],.039,.056,walnut,8);
    }
    pillar(0,.55,0,.46,.46,.066,walnut,20);
    pillar(0,.61,0,.475,.475,.042,oak,20);
    box(0,.649,0,.57,.03,.27,walnut);
    pillar(-.108,.68,0,.107,.10,.13,porcelain,12,1.03);
    pillar(-.108,.804,0,.109,.101,.031,porcelain,12,.76);
    pillar(-.108,.83,0,.037,.032,.031,brass,8);
    tube([-.19,.73,0],[-.273,.811,0],.039,.021,porcelain,8);
    for(const z of [-.078,.078]){
      pillar(.16,.682,z,.056,.055,.059,porcelain,9,1.12);
      face(ring(.16,.742,z,.046,.045,9),'#a76b3e');
    }
  }else if(kind==='steppingstones'){
    const stones=[[-.47,.13,.26,.20,.12],[0,-.14,.26,.21,.08],[.46,.10,.26,.19,.13]];
    for(const [x,z,rx,rz,h] of stones){
      const phase=x*2.1+.4;
      const outline=ring(x,.015,z,rx,rz,8,phase).map(([px,y,pz],i)=>[x+(px-x)*(1+.08*Math.sin(3*i+phase)),y,pz]);
      const bevel=outline.map(([px,,pz])=>[x+(px-x)*.90,h,z+(pz-z)*.90]);
      loft(outline,bevel,slate);
      for(let i=0;i<4;i++){
        const a=i*.63+.56;
        face(ring(x+rx*.64*Math.cos(a),h+.002,z+rz*.65*Math.sin(a),.036,.018,6,a),snowy?'#c6d2c6':'#8b9b75');
      }
    }
  }else if(kind==='fence'){
    for(const y of [.19,.57])box(0,y,-.016,1.59,.073,.074,walnut);
    for(let i=0;i<7;i++){
      const x=(i-3)*.242,h=i===0||i===6?.86:.76;
      box(x,.012,.03,.139,h,.079,oak);
      loft(rectangle(x,h+.012,.03,.139,.079),rectangle(x,h+.128,.03,.02,.065),oak);
      for(const y of [.225,.603])face([[x-.011,y,.071],[x,y+.012,.071],[x+.011,y,.071],[x,y-.012,.071]],'#7b7564');
    }
  }else if(kind==='fountain'){
    pillar(0,0,0,.54,.54,.075,slate,18,1.04);
    pillar(0,.071,0,.56,.56,.12,slate,18,1.06);
    const rim=ring(0,.201,0,.607,.607,18),well=ring(0,.201,0,.512,.512,18);
    loft(ring(0,.183,0,.593,.593,18),rim,slate);
    face(ring(0,.203,0,.512,.512,18),water[2]);
    for(let i=0;i<18;i++)face([rim[i],rim[(i+1)%18],well[(i+1)%18],well[i]],slate[3]);
    pillar(0,.205,0,.122,.122,.42,slate,12,.68);
    pillar(0,.61,0,.13,.13,.128,slate,14,2.0);
    face(ring(0,.740,0,.227,.227,14),water[3]);
    pillar(0,.739,0,.035,.035,.10,brass,8);
    for(let i=0;i<5;i++){
      const a=i*2*Math.PI/5,c=Math.cos(a),s=Math.sin(a);
      const stream=t=>[c*(.014+t*.37),.83+.36*t-.973*t*t,s*(.014+t*.37)];
      for(let j=0;j<5;j++)tube(stream(j/5),stream((j+1)/5),.014,.012,['#9dcac0','#c1ded4','#d2e8de'],5);
    }
  }
}
