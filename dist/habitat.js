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
  function shelfBoard(x,y,z,w,h,d,finish){
    box(x,y,z,w,h,d,finish);
    face(rectangle(x,y,z,w,d),finish[0]);
  }
  function rearFooting(x,z,w,d){
    // Extend the existing floor only where the building projects beyond its edge.
    const back=z-d/2,front=Math.min(-edge,z+d/2);
    if(front>back)box(x,-.39,(back+front)/2,w,.39,front-back,slate);
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
  // Field-station label, low enough for the planting to frame its silhouette.
  function campusFieldLabel(cx,z){
    const w=Math.min(1.12,extent*.40),front=z+.026;
    for(const side of [-1,1])box(cx+side*w*.31,.015,z-.03,.045,.44,.05,walnut);
    box(cx,.37,z,w,.25,.048,green);
    const letters=[
      [[1,2.5,1,7.5],[1,2.5,8.8,2.5,8.8,7.5],[1,7,8.8,7],[5,.4,5,9.7]], // 中
      [[.7,.7,.7,9.4],[.7,.7,9,.7,9,9.4],[.7,9,9,9],[2.2,2.7,7.6,2.7],[4.8,2.7,4.8,7.2],[2.6,4.9,7,4.9],[2.1,7.2,7.9,7.2],[6.4,5.7,7.5,6.6]], // 国
      [[1,3.7,1.4,2.1,9.2,2.1,8.4,3.6],[5.6,.3,5,2.6,3.4,4.8,1.1,6.3],[3.9,4.5,3.9,9.1,6.1,7.6],[5.1,3.5,6.1,5.9,7.4,7.7,9.6,9],[8.7,4.3,6.7,6]], // 农
      [[3.3,.55,3.3,8.7],[6.4,.55,6.4,8.7],[.9,3.4,2.4,6.5],[9,3.3,7.5,6.5],[.4,9,9.6,9]], // 业
      [[.6,3.6,9.4,3.6],[5.2,.45,5,3.8,4.4,5.9,3,7.8,.7,9.3],[5,3.9,6,6.2,7.6,8,9.4,9.2]], // 大
      [[1.8,.7,2.8,2.1],[4.3,.4,5.1,1.9],[7.9,.5,6.7,2.2],[.8,4.1,1,2.8,9,2.8,8.7,4.2],[2.7,4.7,7.2,4.7,5.2,6.1],[5.2,6.1,5.2,8.9,4.7,9.4,3.4,9.1],[.6,6.9,9.4,6.9]] // 学
    ];
    const cell=w*.144,font=cell*.83,stroke=.054*font,ink='#efe8ce';
    letters.forEach((glyph,index)=>{
      const left=cx+(index-2.5)*cell-font*.5;
      for(const points of glyph)for(let j=2;j<points.length;j+=2){
        const x1=left+points[j-2]*font/10,y1=.495+font*(.5-points[j-1]/10);
        const x2=left+points[j]*font/10,y2=.495+font*(.5-points[j+1]/10);
        const len=Math.hypot(x2-x1,y2-y1),dx=(y2-y1)*stroke/len,dy=(x1-x2)*stroke/len;
        face([[x1-dx,y1-dy,front],[x2-dx,y2-dy,front],[x2+dx,y2+dy,front],[x1+dx,y1+dy,front]],ink);
      }
    });
  }
  // Folded leaves and clustered flower heads share a small, fixed face budget.
  function borderPlant(x,base,z,h,seed,kind){
    const blade=snow?'#acbbaa':wet?'#618477':'#73947a';
    const fold=snow?'#d5dfcc':wet?'#416b60':'#51775c';
    for(let i=0;i<5;i++){
      const a=seed+i*2.4,dx=Math.cos(a),dz=Math.sin(a),r=h*(.27+.045*(i%3));
      const root=[x,base,z],tip=[x+dx*r,base+h*(.42+.095*(i%3)),z+dz*r];
      const mx=x+dx*r*.46,mz=z+dz*r*.46,y=base+h*.36,b=h*.074;
      const ridge=[mx,y+.024,mz];
      face([root,[mx-dz*b,y,mz+dx*b],tip,ridge],blade);
      face([root,ridge,tip,[mx+dz*b,y,mz-dx*b]],fold);
    }
    if(kind==='grass')return;
    const top=base+h,dx=.035*Math.cos(seed),dz=.035*Math.sin(seed);
    pillar(x,base,z,.012,.012,h,[fold,blade,fold,blade],4,.68);
    if(kind==='reed'){
      pillar(x,top,z,.034,.033,h*.25,['#81664b','#927451','#866548',snow?'#d0c4a5':'#aa8965'],6,.83);
    }else{
      const r=h*.14,petals=kind==='sage'?['#877693','#a38cab','#bcacbe']:['#c29f66','#e2c388','#f2deac'];
      const lower=ring(x,top-h*.11,z,r,r*.89,5,seed),upper=ring(x+dx*.28,top,z+dz*.28,r*.76,r*.74,5,seed+.18);
      for(let i=0;i<5;i++)face([lower[i],lower[(i+1)%5],upper[(i+1)%5],upper[i]],petals[i%2]);
      face(upper,snow?'#e5e6d7':petals[2]);
    }
  }
  function gravelStone(x,z,rx,rz,seed,h){
    const base=ring(x,.008,z,rx,rz,6,seed),cap=ring(x-rx*.11,h,z+rz*.09,rx*.78,rz*.81,6,seed+.08);
    for(let i=0;i<6;i++)face([base[i],base[(i+1)%6],cap[(i+1)%6],cap[i]],i%2?'#8c9282':'#a4a594');
    face(cap,snow?'#e1e6db':wet?'#95a397':'#c2c1a9');
  }
  function trialWheat(){
    const x=-extent-.34,z=-edge*.16,depth=2.24;
    box(x,0,z,.50,.15,depth,oak);
    face(rectangle(x,.154,z,.43,depth-.09),snow?'#e0e3ce':'#716246');
    for(const row of [-1,1])for(let i=0;i<8;i++){
      const px=x+row*.114,pz=z-.91+i*.25+row*.035,h=.54+.10*Math.sin(i*2.3+row),bend=.034*Math.sin(i+row);
      const base=.16,left=px+bend,stem='#738545',grain=snow?'#e1d8ac':wet?'#b39e55':'#d7af4c';
      face([[px-.012,base,pz],[px+.012,base,pz],[left+.011,h+.03,pz],[left-.011,h+.03,pz]],stem);
      for(const s of [-1,1]){
        face([[px,base+.075,pz],[px+s*.07,base+.15,pz+s*.055],
          [px+s*.096,base+.25,pz+s*.11],[px+s*.03,base+.19,pz+s*.025]],s<0?'#7c8d49':'#91a15f');
        for(let k=0;k<3;k++){
          const y=h+k*.047,tip=left+s*(.056-k*.008);
          face([[left,y,pz],[tip,y+.049,pz+s*.009],[tip+s*.017,y+.106,pz],[left,y+.045,pz]],grain);
        }
      }
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
    }
    {
      // Two timber wall shelves with seed packets, reference books and a vase.
      const shelfZ=-roomHalf*.37,shelfW=Math.min(2.36,roomHalf*.9);
      // Floor-standing uprights also support the shelves when the wall cuts away.
      setLayer(5);
      for(const sign of [-1,1]){
        const z=shelfZ+sign*shelfW*.41;
        box(left+.145,floorY,z,.10,1.72-floorY,.09,oak);
        box(left+.18,floorY,z,.20,.065,.16,walnut);
      }
      for(let j=0;j<2;j++){
        setLayer(5);
        const y=.98+j*.65,z=shelfZ,w=shelfW;
        shelfBoard(left+.26,y,z,.39,.085,w,walnut);
        for(const dz of [-w*.41,w*.41])box(left+.21,y-.17,z+dz,.19,.17,.075,brass);
        setLayer(6);
        for(let k=0;k<4;k++){
          const b=z-w*.35+k*.14,h=.21+(k*3%4)*.055,c=['#ad785b','#758a71','#a89a74','#72858b'][k];
          box(left+.24,y+.085,b,.21,h,.115,[c,c,c,'#eadcc2']);
        }
        pillar(left+.27,y+.085,z+w*.28,.117,.117,.22,j?green:chalk,9,.77);
        pillar(left+.27,y+.30,z+w*.28,.064,.064,.09,j?green:chalk,9);
      }
    }
    if(sideVisible){
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
    const win=Math.min(roomHalf*.47,1.79),bottom=.57,top=2.31,span=roomHalf-win;
    if(rearVisible){
      // Four wall sections surround a physically open, recessed window bay.
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
    }
    const cupboardX=(win+roomHalf)*.5;
    {
      setLayer(5);
      const cw=Math.min(1.40,span*.83);
      // The rear of the cupboard overhangs the desk. A plinth joins it to the room floor.
      box(cupboardX,floorY,back+.166,cw-.10,-floorY+.03,.075,walnut);
      box(cupboardX,.03,back+.25,cw,.75,.44,panel);
      box(cupboardX,.78,back+.245,cw+.10,.07,.51,oak);
      for(let j=0;j<2;j++){
        const doorX=cupboardX+(j-.5)*cw*.47;
        box(doorX,.11,back+.49,cw*.42,.56,.04,panel);
        box(doorX,.17,back+.518,cw*.32,.43,.016,green);
        pillar(cupboardX+(j-.5)*cw*.27,.38,back+.542,.025,.025,.054,brass,7);
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
    }
    if(rearVisible){
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
    const radius=1.04,cy=1.15,wallH=2.32,z=rear-.035,halfDepth=.095;
    const plaster=['#c3bdad','#d2cbb8','#ddd6c4','#eee6d3'];
    for(const s of [-1,1]){
      const width=edge-radius,x=s*(radius+width/2);
      box(x,0,z,width,wallH,halfDepth*2,plaster);
      box(x,.01,z+.02,width,.28,.24,slate);
    }
    for(let i=0;i<20;i++){
      const a=Math.PI*i/20,b=Math.PI*(i+1)/20;
      const x0=radius*Math.cos(a),x1=radius*Math.cos(b),y0=radius*Math.sin(a),y1=radius*Math.sin(b);
      for(const half of [-1,1]){
        const rt=radius+.09,edgeY=half===1?wallH:0;
        for(const side of [-1,1]){
          const wallZ=z+side*halfDepth,trimZ=wallZ+side*.018;
          face([[x0,cy+half*y0,wallZ],[x1,cy+half*y1,wallZ],[x1,edgeY,wallZ],[x0,edgeY,wallZ]],side===1?'#ddd7c5':'#c8c3b4');
          face([[x0,cy+half*y0,trimZ],[x1,cy+half*y1,trimZ],[rt*Math.cos(b),cy+half*rt*Math.sin(b),trimZ],[rt*Math.cos(a),cy+half*rt*Math.sin(a),trimZ]],i%4===0?'#78877f':'#8b9890');
        }
        const lip=halfDepth+.018;
        face([[x0,cy+half*y0,z-lip],[x1,cy+half*y1,z-lip],[x1,cy+half*y1,z+lip],[x0,cy+half*y0,z+lip]],half===1?'#758078':'#a4aa98');
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
    tree(edge-.12,rear+.58,1.8,.65);
    // Asymmetric stone-and-iris border alongside the moon gate.
    for(let i=0;i<5;i++){
      const z=-edge*.65+i*.42;
      gravelStone(-extent-.32,z,.16+(i%2)*.05,.17,i*.8,.08+(i%3)*.03);
      borderPlant(-extent-.37,0,z+.19,.29+(i%3)*.10,i,i%2?'sage':'grass');
    }
  }else if(scene==='terrace'){
    const iron=['#546c69','#6c827a','#789087','#8d9b89'];
    // Rooftop potting greenhouse, glazed in separate bays with a pitched roof.
    const x=-edge*.53,z=rear-.08,w=Math.min(2.05,extent*.62),d=.70,eave=1.42,peak=1.85;
    const hvX=edge*.67,hvW=1.08;
    // Railings terminate at the equipment bays; rails previously crossed the glasshouse.
    for(const [start,end] of [[-edge,x-w/2-.13],[x+w/2+.13,hvX-hvW/2-.08],[hvX+hvW/2+.08,edge]]){
      if(end<=start)continue;
      const run=end-start,count=Math.ceil(run/.85);
      box((start+end)/2,0,rear,run,.31,.24,brick);
      for(let i=0;i<=count;i++)box(start+run*i/count,.31,rear,.055,.60,.055,iron);
      for(const y of [.54,.88])box((start+end)/2,y,rear,run+.055,.052,.074,iron);
    }
    rearFooting(x,z,w+.20,d+.16);
    box(x,0,z,w+.17,.18,d+.13,brick);
    for(const side of [-1,1]){
      const zz=z+side*d*.5;
      for(let i=0;i<4;i++)box(x-w*.5+i*w/3,.18,zz,.055,eave-.18,.055,iron);
      for(const y of [.72,eave])box(x,y,zz,w+.07,.04,.05,iron);
      for(let i=0;i<3;i++){
        const xx=x-w/2+i*w/3;
        face(wallQuad(xx+.035,xx+w/3-.035,.20,eave-.03,zz),wet?'#a1c0bd8c':'#b5d9cb8c');
      }
      face([[x-w/2,eave,zz],[x+w/2,eave,zz],[x+w/2,peak,z],[x-w/2,peak,z]],snow?'#dce7df':'#a9cbb9aa');
      for(let i=0;i<4;i++){
        const postX=x-w/2+i*w/3;
        face([[postX-.022,eave+.008,zz],[postX+.022,eave+.008,zz],[postX+.022,peak+.008,z],[postX-.022,peak+.008,z]],'#71877a');
      }
    }
    for(const side of [-1,1]){
      const end=x+side*w/2;
      face([[end,.18,z-d/2+.032],[end,.18,z+d/2-.032],[end,eave,z+d/2-.032],[end,peak,z],[end,eave,z-d/2+.032]],wet?'#94b3ae82':'#accbbb82');
      for(const y of [.72,eave])box(end,y,z,.05,.04,d,iron);
    }
    box(x,peak,z,w+.10,.055,.06,iron);
    rearFooting(hvX,rear,hvW+.09,.57);
    box(hvX,0,rear,hvW,.57,.48,slate);
    for(let j=0;j<6;j++)box(hvX-.39+j*.155,.14,rear+.25,.058,.31,.03,metal);
    // A narrow aromatic herb trough in the lee of the glasshouse.
    const bedX=-extent-.31,bedZ=-edge*.32;
    box(bedX,0,bedZ,.48,.24,1.72,brick);
    face(rectangle(bedX,.244,bedZ,.41,1.63),snow?'#d6dbca':'#716752');
    for(let i=0;i<6;i++)borderPlant(bedX+(i%2-.5)*.13,.245,bedZ-.67+i*.27,.25+.08*(i%3),i+.4,i%3?'sage':'grass');
  }else{
    const x=edge*.43,z=rear-.08,w=Math.min(2.91,extent*.96);
    // Brick campus gatehouse and lit courtyard windows.
    rearFooting(x,z,w+.13,.69);
    box(x,0,z,w+.08,.045,.65,slate);
    box(x,.045,z,w,1.095,.60,brick);
    shelfBoard(x,1.14,z,w+.19,.08,.74,chalk);
    face([[x-w*.55,1.22,z+.39],[x+w*.55,1.22,z+.39],[x+w*.42,1.52,z],[x-w*.42,1.52,z]],snow?'#d7dfd3':'#70807d');
    face([[x-w*.55,1.22,z-.39],[x+w*.55,1.22,z-.39],[x+w*.42,1.52,z],[x-w*.42,1.52,z]],snow?'#c9d5ca':'#566d69');
    for(const s of [-1,1]){
      face([[x+s*w*.55,1.22,z+.39],[x+s*w*.55,1.22,z-.39],[x+s*w*.42,1.52,z]],snow?'#ccd7cd':'#637873');
      const wx=x+s*w*.33;
      box(wx,.41,z+.30,.47,.48,.075,chalk);
      face(wallQuad(wx-.17,wx+.17,.47,.83,z+.34),night?'#ffdb95':'#819b93',night);
      box(wx,.47,z+.345,.035,.36,.036,chalk);
      box(wx,.68,z+.345,.34,.026,.032,chalk);
      shelfBoard(wx,.39,z+.33,.54,.04,.14,slate);
    }
    box(x,1.517,z,w*.84+.04,.035,.055,slate);
    box(x,.04,z+.31,.50,.86,.11,oak);
    face(wallQuad(x-.18,x+.18,.06,.82,z+.371),'#687e70');
    box(x,.53,z+.382,.32,.028,.024,oak);
    box(x+.125,.39,z+.393,.031,.064,.029,brass);
    if(zone==='pond'||scene==='reedpond'){
      const pondZ=rear+.24,pondX=-edge*.43,radius=Math.min(1.62,edge*.43);
      face(ring(pondX,.011,pondZ,radius,.28,18),snow?'#d4dccc':'#97a387');
      face(ring(pondX,.015,pondZ,radius*.96,.24,18),snow?'#adc4c0':wet?'#618e87':'#76a79a');
      for(let i=0;i<5;i++)face(ring(pondX+radius*(-.62+i*.21),.027,pondZ+.10*Math.sin(i),.09,.07,7),'#97a96f');
      for(let i=0;i<5;i++)borderPlant(pondX+.23*(i-2),.022,pondZ+.20+.025*Math.sin(i),.38+.055*(i%3),i+.25,i%2?'grass':'reed');
    }else if(scene==='campus'){
      const bedX=-edge*.43,bedZ=rear+.24;
      face(ring(bedX,.012,bedZ,1.08,.24,11,.23),snow?'#dce1cf':'#889375');
      for(const [dx,dz,h,kind] of [[-.83,.02,.35,'sage'],[-.66,-.09,.48,'sage'],[-.47,.13,.23,'gold'],[.45,.10,.24,'grass'],[.66,.04,.39,'gold'],[.86,-.04,.46,'sage']]){
        borderPlant(bedX+dx,.015,bedZ+dz,h,dx*4,kind);
      }
      campusFieldLabel(bedX,bedZ-.03);
      trialWheat();
    }else{
      for(let k=0;k<5;k++)pillar(-edge+(.10+.11*k)*edge,.02,rear,.055,.055,.55,walnut,6);
      box(-edge*.67,.32,rear,edge*.46,.045,.065,oak);
    }
    // Worn pavers and verge stay on the margin of the editable plot.
    for(let i=0;i<5;i++){
      const z=-edge*.46+i*.48;
      gravelStone(extent+.30+.025*Math.sin(i),z,.20,.19,i*.72,.036);
      if(i%2===0)borderPlant(extent+.49,0,z+.21,.27+.055*i,i+.73,night?'gold':'grass');
    }
    tree(-edge+.12,rear+.53,1.97,.72);
    if(night){
      const lanternBody=['#3d464e','#49525a','#596267','#737979'];
      for(const x of [-edge*.85,edge*.84]){
        const z=rear+.20;
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
