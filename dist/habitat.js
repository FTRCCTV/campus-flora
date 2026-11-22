// Architectural scenery hugs the edge of the editable garden. The rear wall
// and its glazing share the same projection as picking and the weather mask.
function drawHabitat({zone,scene,weather,extent,angle,face,box,pillar,ring,rectangle,setLayer}){
  const inside=['sill','bench','shelf'].includes(zone),snow=weather==='snow',wet=weather==='rain',night=scene==='starlight';
  const edge=extent+.62,rear=-edge+.06;
  const oak=['#a47953','#ba9064','#a98258','#deb482'];
  const walnut=['#674b3c','#81624b','#88684e','#9e7b5a'];
  const brass=['#96733e','#b08e51','#bd9a5a','#d6b574'];
  const chalk=['#c6bca8','#d5cbb8','#e5dbca','#f3e9d5'];
  const green=['#536b5c','#64806d','#73907a','#849984'];
  const metal=['#455a55','#526760','#61776d','#7d8b7c'];
  const brick=['#a56552','#b47b60','#c78a68','#d8a37f'];
  const slate=['#5d6d73','#697c7d','#7c8987',snow?'#e6ece4':'#94a098'];
  let windowPath=null,weatherPath=null;
  function wallQuad(x1,x2,y1,y2,z){
    return [[x1,y1,z],[x2,y1,z],[x2,y2,z],[x1,y2,z]];
  }
  function shelfBooks(x,y,z,n){
    const covers=['#6f8170','#c28d68','#8c9ba1','#b5a16f','#805f57'];
    for(let i=0;i<n;i++){
      const h=.26+(i*7%4)*.075,c=covers[i%covers.length],b=x+i*.105;
      box(b,y,z,.095,h,.26,[c,c,c,'#e4d5b8']);
      face(wallQuad(b-.031,b+.031,y+h*.32,y+h*.38,z+.132),'#dfc59a');
    }
  }
  function tree(x,z,h,s){
    pillar(x,0,z,.075*s,.075*s,h*.62,walnut,6,.7);
    const leaves=snow?['#849f91','#99afa1','#c2d2c0','#d8dfcd']:['#658565','#759468','#829e70','#a0b482'];
    for(let j=0;j<3;j++){
      const px=x+(j-1)*.24*s,pz=z+(j%2-.5)*.17*s,cy=h*(j===1?.82:.67),r=s*(j===1?.5:.4);
      const a=ring(px,cy-r*.6,pz,r*.72,r*.6,7,j*.4),b=ring(px,cy,pz,r,r*.82,7,j*.4);
      for(let i=0;i<b.length;i++){const k=(i+1)%b.length;face([a[i],a[k],b[k],b[i]],leaves[(i+1)%3]);face([b[i],b[k],[px-.04,cy+r*.82,pz]],leaves[1+i%3])}
    }
  }
  if(inside){
    const desk=zone==='bench',archive=zone==='shelf';
    const panel=desk?['#586c6a','#6a807c','#708780','#93a59a']:archive?['#846249','#947152','#a17b5d','#bb9572']:green;
    const floorY=-1.12,wallH=2.68,roomHalf=edge+.26;
    const back=rear-.27,left=-roomHalf,front=edge+.41;
    const rearVisible=Math.cos(angle)>-.1,sideVisible=Math.sin(angle)>-.15;
    // A floor beneath the work surface, plus fascia, drawers and tapered feet,
    // make its height and the open, dollhouse-style cutaway legible.
    setLayer(-3);
    box(0,floorY-.09,.02,roomHalf*2,.09,roomHalf*2+.48,['#ac9982','#b2a08a','#c2b49f','#c8b79f']);
    for(let i=0;i<11;i++){
      const px=-roomHalf+(i+.5)*(roomHalf*2/11);
      face(rectangle(px,floorY+.004,front-.18,.018,.43),'#a3927c');
    }
    setLayer(-2);
    const apronZ=edge-.13;
    box(0,-.43,apronZ,edge*2-.24,.12,.18,walnut);
    for(const x of [-edge+.18,edge-.18])for(const z of [-edge+.2,apronZ])box(x,floorY,z,.16,.84,.17,oak);
    const cabinetW=archive?2.12:1.52,cabX=edge-cabinetW*.55-.28;
    box(cabX,floorY+.09,apronZ-.25,cabinetW,.71,.64,panel);
    for(let j=0;j<2;j++){
      box(cabX,floorY+.13+j*.33,apronZ+.084,cabinetW-.12,.28,.06,panel);
      box(cabX,floorY+.24+j*.33,apronZ+.132,.22,.038,.035,brass);
    }
    if(sideVisible){
      setLayer(2);
      box(left,floorY,0,.13,wallH-floorY,2*roomHalf,chalk);
      setLayer(3);
      box(left+.075,floorY,0,.06,1.67,2*roomHalf,panel);
      setLayer(4);
      box(left+.1,.50,0,.10,.08,2*roomHalf,oak);
      box(left+.085,floorY+.03,0,.09,.10,2*roomHalf,walnut);
      box(left,wallH-.07,0,.18,.09,2*roomHalf,oak);
      for(let i=0;i<8;i++){
        const z=-roomHalf+(i+.5)*roomHalf/4;
        box(left+.115,-.70,z,.04,1.18,.058,panel);
      }
      // Two timber wall shelves with seed packets, reference books and a vase.
      for(let j=0;j<2;j++){
        setLayer(5);
        const y=.98+j*.65,z=-roomHalf*.37,w=Math.min(2.36,roomHalf*.9);
        box(left+.26,y,z,.39,.085,w,walnut);
        for(const dz of [-w*.34,w*.34])box(left+.17,y-.17,z+dz,.17,.18,.085,brass);
        setLayer(6);
        for(let k=0;k<4;k++){
          const b=z-w*.35+k*.14,h=.21+(k*3%4)*.055,c=['#ad785b','#758a71','#a89a74','#72858b'][k];
          box(left+.24,y+.085,b,.21,h,.115,[c,c,c,'#eadcc2']);
        }
        pillar(left+.27,y+.085,z+w*.28,.117,.117,.22,j?green:chalk,9,.77);
        pillar(left+.27,y+.30,z+w*.28,.064,.064,.09,j?green:chalk,9);
      }
      // A pinned herbarium on the side wall, mounted with a cream paper mat.
      setLayer(5);
      const sx=left+.085,sz=roomHalf*.43;
      box(sx,1.03,sz,.055,.9,.72,walnut);
      setLayer(6);
      face([[sx+.032,1.11,sz-.29],[sx+.032,1.11,sz+.29],[sx+.032,1.85,sz+.29],[sx+.032,1.85,sz-.29]],'#eadcc1');
      setLayer(7);
      for(let j=0;j<7;j++){
        const y=1.20+j*.073,z=sz+(y-1.2)*.13,l=j%2?.13:-.12;
        face([[sx+.037,y,z],[sx+.037,y+.045,z+l],[sx+.037,y+.119,z+l*1.28],[sx+.037,y+.071,z+l*.29]],j%2?'#718367':'#82916e');
      }
    }
    if(rearVisible){
      // Four wall sections surround a physically open, recessed window bay.
      const win=Math.min(roomHalf*.47,1.79),bottom=.57,top=2.31,span=roomHalf-win;
      for(const sign of [-1,1]){
        setLayer(2);
        const x=sign*(win+span*.5);
        box(x,floorY,back,span,wallH-floorY,.17,chalk);
        setLayer(3);
        box(x,floorY,back+.09,span,1.56,.07,panel);
      }
      setLayer(2);
      box(0,floorY,back,win*2,bottom-floorY,.17,panel);
      box(0,top,back,win*2,wallH-top,.17,chalk);
      setLayer(4);
      box(0,wallH-.04,back,roomHalf*2+.12,.10,.21,oak);
      box(0,.40,back+.1,roomHalf*2,.10,.15,oak);
      const paneZ=back+.079,pane=wallQuad(-win,win,bottom,top,paneZ);
      windowPath=[pane];
      setLayer(3);
      const glass=night?(wet?'#344251':snow?'#4a5a70':'#273852'):wet?'#b4cbd1':snow?'#d0dee1':'#b8dbd6';
      const distant=night?'#4a6071':wet?'#859c98':snow?'#acbfbc':'#95b5a3',near=night?'#374f57':wet?'#748d86':snow?'#bacabb':'#86a185';
      const skyline=[[-1,.41],[-.77,.45],[-.53,.33],[-.31,.43],[-.04,.40],[.24,.54],[.51,.45],[.77,.51],[1,.46]];
      const far=skyline.map(([u,v])=>[u*win,bottom+(top-bottom)*v,paneZ]);
      const hedge=skyline.map(([u,v],i)=>[u*win,bottom+(top-bottom)*(.12+v*.22+.035*(i%2)),paneZ]);
      face([[-win,top,paneZ],[win,top,paneZ],...far.slice().reverse()],glass,night);
      face([...far,...hedge.slice().reverse()],distant,night);
      face([...hedge,[win,bottom,paneZ],[-win,bottom,paneZ]],near,night);
      if(night){
        setLayer(3.5);
        const moonX=win*.59,moonY=top-.38,r=.108;
        for(const s of studioStars.slice(0,wet?10:snow?21:46)){
          const x=(s.x*1.95-.975)*win,y=bottom+(top-bottom)*(.56+s.y*.4),size=.005+s.magnitude**3*.018;
          if(Math.hypot(x-moonX,y-moonY)<r*1.25)continue;
          face([[x-size,y,paneZ],[x,y+size*1.2,paneZ],[x+size,y,paneZ],[x,y-size*1.2,paneZ]],s.warm?'#e8d5a8':'#b3cada',true);
        }
        const crescent=[];
        for(let i=0;i<=14;i++){
          const a=(i/14-.5)*Math.PI;
          crescent.push([moonX+r*Math.cos(a),moonY+r*Math.sin(a),paneZ]);
        }
        for(let i=13;i>0;i--){
          const a=(i/14-.5)*Math.PI;
          crescent.push([moonX+r*.51*Math.cos(a),moonY+r*Math.sin(a),paneZ]);
        }
        face(crescent,wet?'#b3babd':'#f8e9c3',true);
        for(const x of [-.85,-.74,-.48,.32,.42,.80]){
          const y=bottom+.44+(1+Math.sin(x*13))*.044;
          face(wallQuad(x*win-.018,x*win+.018,y,y+.025,paneZ),'#d2ac73',true);
        }
      }
      setLayer(4);
      const mull=.058,cy=bottom+(top-bottom)*.60;
      for(const x of [-win,-win/3,win/3,win])box(x-.008,bottom-.04,paneZ+.044,.07,top-bottom+.09,.09,oak);
      for(const y of [bottom,cy,top])box(0,y,paneZ+.061,win*2+.12,mull,.11,chalk);
      weatherPath=[];
      for(let i=0;i<3;i++){
        const x0=-win+i*win*2/3+.048,x1=x0+win*2/3-.096;
        weatherPath.push(wallQuad(x0,x1,bottom+.044,cy-.036,paneZ));
        weatherPath.push(wallQuad(x0,x1,cy+.036,top-.044,paneZ));
      }
      box(0,bottom-.075,paneZ+.10,2*win+.30,.095,.42,oak);
      // Gathered linen blind, herbarium plates and an apothecary cupboard.
      box(0,top+.038,paneZ+.07,2*win+.24,.095,.15,walnut);
      for(let j=0;j<3;j++)box(0,top-.03-j*.04,paneZ+.076,2*win+.07,.045,.065,j%2?chalk:['#bbab88','#c7b792','#cdbf9d','#ddd0ad']);
      setLayer(5);
      const cupboardX=(win+roomHalf)*.5,cw=Math.min(1.40,span*.83);
      box(cupboardX,.03,back+.22,cw,.77,.45,panel);
      box(cupboardX,.78,back+.245,cw+.10,.07,.51,oak);
      for(let j=0;j<2;j++){
        box(cupboardX+(j-.5)*cw*.47,.11,back+.471,cw*.42,.56,.04,panel);
        pillar(cupboardX+(j-.5)*cw*.27,.38,back+.505,.035,.035,.054,brass,7);
      }
      setLayer(6);
      shelfBooks(cupboardX-cw*.39,.85,back+.24,Math.min(5,Math.floor(cw/.16)));
      if(night){
        // An opal-glass reading lamp on the cupboard; the light source is distinct from the lamp stand.
        const lampX=cupboardX+cw*.25,lampZ=back+.25;
        pillar(lampX,.85,lampZ,.10,.10,.045,brass,10);
        pillar(lampX,.895,lampZ,.030,.030,.23,brass,8);
        const low=ring(lampX,1.118,lampZ,.135,.135,10),wide=ring(lampX,1.24,lampZ,.165,.165,10),rim=ring(lampX,1.32,lampZ,.118,.118,10);
        for(let i=0;i<10;i++){
          const j=(i+1)%10;face([low[i],low[j],wide[j],wide[i]],i%3?'#edbe77':'#ffdc96',true);
          face([wide[i],wide[j],rim[j],rim[i]],'#f7dba1',true);
        }
        face(rim,'#fcebc7',true);
      }
      const fx=-cupboardX,w=Math.min(1.07,span*.72);
      box(fx,1.08,back+.13,w,1.02,.06,walnut);
      setLayer(6);
      face(wallQuad(fx-w*.42,fx+w*.42,1.16,2.01,back+.165),'#ecdfc4');
      setLayer(7);
      face([[fx-.05,1.22,back+.17],[fx-.03,1.22,back+.17],[fx+.085,1.91,back+.17],[fx+.07,1.91,back+.17]],'#7e7954');
      for(let j=0;j<5;j++){
        const y=1.29+j*.11,x=fx+(j-1)*.022,dx=(j%2?1:-1)*w*.20;
        face([[x,y,back+.172],[x+.55*dx,y+.13,back+.172],[x+dx,y+.19,back+.172],[x+.77*dx,y+.06,back+.172]],j%2?'#84956d':'#738260');
      }
    }
  }else if(scene==='courtyard'){
    // Moon gate: curved masonry infill keeps the centre actually open.
    const radius=1.04,cy=1.08,wallH=2.32,z=rear-.035;
    const plaster=['#c3bdad','#d2cbb8','#ddd6c4','#eee6d3'];
    for(const s of [-1,1]){
      const width=edge-radius,x=s*(radius+width/2);
      box(x,.015,z,width,wallH,.19,plaster);
      box(x,.01,z+.02,width,.28,.24,slate);
    }
    for(let i=0;i<20;i++){
      const a=Math.PI*i/20,b=Math.PI*(i+1)/20;
      const x0=radius*Math.cos(a),x1=radius*Math.cos(b),y0=radius*Math.sin(a),y1=radius*Math.sin(b);
      face([[x0,cy+y0,z+.10],[x1,cy+y1,z+.10],[x1,wallH,z+.10],[x0,wallH,z+.10]],'#ddd7c5');
      face([[x0,.02,z+.10],[x1,.02,z+.10],[x1,cy-y1,z+.10],[x0,cy-y0,z+.10]],'#d3ccba');
      for(const half of [-1,1]){
        const rt=radius+.09;
        face([[x0,cy+half*y0,z+.12],[x1,cy+half*y1,z+.12],[rt*Math.cos(b),cy+half*rt*Math.sin(b),z+.12],[rt*Math.cos(a),cy+half*rt*Math.sin(a),z+.12]],'#82908a');
      }
    }
    box(0,wallH,z,edge*2+.12,.10,.34,slate);box(0,wallH+.09,z,edge*2+.22,.075,.48,slate);
    for(const sign of [-1,1]){
      const x=sign*(edge+radius)*.5;
      box(x,.76,z+.11,.86,.78,.08,slate);
      face(wallQuad(x-.34,x+.34,.84,1.46,z+.155),'#a5ada0');
      for(const d of [-.24,0,.24])box(x+d,.84,z+.17,.042,.62,.055,walnut);
      for(const y of [.97,1.26])box(x,y,z+.18,.70,.04,.055,walnut);
    }
    tree(edge*.83,rear+.04,1.8,.7);
  }else if(scene==='terrace'){
    const iron=['#546c69','#6c827a','#789087','#8d9b89'];
    box(0,0,rear,2*edge,.31,.24,brick);
    for(let i=0;i<=9;i++)box(-edge+2*edge*i/9,.29,rear,.075,.62,.075,iron);
    for(const y of [.54,.88])box(0,y,rear,2*edge,.062,.08,iron);
    // Rooftop potting greenhouse, glazed in separate bays with a pitched roof.
    const x=-edge*.53,z=rear-.08,w=Math.min(2.05,extent*.62),d=.70,eave=1.42,peak=1.85;
    box(x,.03,z,w+.17,.16,d+.13,brick);
    for(const side of [-1,1]){
      const zz=z+side*d*.5;
      for(let i=0;i<4;i++)box(x-w*.5+i*w/3,.18,zz,.055,eave-.18,.055,iron);
      for(const y of [.72,eave])box(x,y,zz,w+.07,.04,.05,iron);
      for(let i=0;i<3;i++){
        const xx=x-w/2+i*w/3;
        face(wallQuad(xx+.035,xx+w/3-.035,.20,eave-.03,zz),wet?'#a1c0bd8c':'#b5d9cb8c');
      }
      face([[x-w/2,eave,zz],[x+w/2,eave,zz],[x+w/2,peak,z],[x-w/2,peak,z]],snow?'#dce7df':'#a9cbb9aa');
    }
    box(x,peak,z,w+.10,.055,.06,iron);
    const hvX=edge*.67;
    box(hvX,.01,rear,1.08,.57,.48,slate);
    for(let j=0;j<6;j++)box(hvX-.39+j*.155,.14,rear+.25,.058,.31,.03,metal);
  }else{
    const x=edge*.43,z=rear-.08,w=Math.min(2.91,extent*.96);
    // Brick campus gatehouse and lit courtyard windows.
    box(x,.01,z,w,1.15,.60,brick);box(x,1.14,z,w+.19,.09,.74,chalk);
    face([[x-w*.55,1.22,z+.39],[x+w*.55,1.22,z+.39],[x+w*.42,1.52,z],[x-w*.42,1.52,z]],snow?'#d7dfd3':'#70807d');
    face([[x-w*.55,1.22,z-.39],[x+w*.55,1.22,z-.39],[x+w*.42,1.52,z],[x-w*.42,1.52,z]],snow?'#c9d5ca':'#566d69');
    for(const s of [-1,1]){
      const wx=x+s*w*.33;
      box(wx,.41,z+.30,.47,.48,.075,chalk);
      face(wallQuad(wx-.17,wx+.17,.47,.83,z+.34),night?'#ffdb95':'#819b93',night);
      box(wx,.47,z+.345,.035,.36,.036,chalk);
    }
    box(x,.04,z+.31,.50,.86,.11,oak);
    face(wallQuad(x-.18,x+.18,.06,.82,z+.371),'#687e70');
    if(zone==='pond'){
      face(ring(-edge*.43,.015,rear,Math.min(1.62,edge*.43),.41,18),'#6da098');
      for(let i=0;i<5;i++)face(ring(-edge*.65+i*.24,.027,rear+.15*Math.sin(i),.09,.07,7),'#97a96f');
    }else{
      for(let k=0;k<5;k++)pillar(-edge+(.10+.11*k)*edge,.02,rear,.055,.055,.55,walnut,6);
      box(-edge*.67,.32,rear,edge*.46,.045,.065,oak);
    }
    tree(-edge*.69,rear-.04,1.97,.85);
    if(night){
      const lanternBody=['#3d464e','#49525a','#596267','#737979'];
      for(const x of [-edge*.85,edge*.84]){
        const z=rear+.56;
        setLayer(1.5);
        // Nested light pools sit flat on the path and follow its projection.
        face(ring(x,.016,z,.58,.43,20),'#ffd79715',true);
        face(ring(x,.019,z,.34,.25,18),'#ffdb9820',true);
        setLayer(2);
        pillar(x,.02,z,.10,.10,.58,lanternBody,8,.8);
        const low=ring(x,.59,z,.08,.08,8),high=ring(x,.78,z,.114,.114,8);
        for(let i=0;i<8;i++){
          const j=(i+1)%8;face([low[i],low[j],high[j],high[i]],i%3?'#f8d698':'#ffeab7',true);
        }
        pillar(x,.78,z,.15,.15,.075,lanternBody,8,.55);
      }
    }
  }
  return {windowPath,weatherPath};
}
