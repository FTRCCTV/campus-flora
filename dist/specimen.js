function specimenMesh(record,potted=false){
 const m=plantProfile(record),faces=[];
 const face=(vertices,color)=>faces.push({vertices,color});
 const tint=(c,k)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(c.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');
 const ring=(x,y,z,r,n)=>Array.from({length:n},(_,i)=>[x+r*Math.cos(i*2*Math.PI/n),y,z+r*Math.sin(i*2*Math.PI/n)]);
 function stalk(a,b,r,s,color,n=7){
   const low=ring(...a,r,n),high=ring(...b,s,n);
   for(let i=0;i<n;i++){const j=(i+1)%n;face([low[i],low[j],high[j],high[i]],tint(color,.86+.16*Math.cos(i*2*Math.PI/n+.4)))}
   face(high,color);
 }
 function blade(x,y,z,a,length,rise,width,color){
   const point=(d,o,h)=>[x+d*Math.cos(a)-o*Math.sin(a),y+h,z+d*Math.sin(a)+o*Math.cos(a)];
   const base=point(0,0,0),mid=point(length*.48,0,rise*.66+.04),tip=point(length,0,rise);
   face([base,point(length*.47,width,rise*.48),tip,mid],color);face([base,mid,tip,point(length*.47,-width,rise*.48)],tint(color,.83));
 }
 const start=potted?.59:0;
 if(potted){stalk([0,0,0],[0,.51,0],.29,.43,'#be7654',16);stalk([0,.5,0],[0,.61,0],.46,.46,'#d8946c',16);face(ring(0,.616,0,.409,16),'#674a38')}
 const woody=['tree','shrub'].includes(m.form),h=m.height*(woody?1.65:1),s=m.spread;
 if(woody){
   const shrub=m.form==='shrub',willow=record.latin.toLowerCase().startsWith('salix ');
   stalk([0,start,0],[0,start+h*.82,0],shrub?.075:.12,.055,'#946c4f');
   for(let i=0;i<m.count;i++){
     const t=i/m.count,a=i*2.4,r=(.49-.3*t)*s,x=r*Math.cos(a),z=r*Math.sin(a),y=start+h*(shrub?.29+.54*t:.42+.56*t);
     stalk([0,y-h*.18,0],[x,y,z],.052,.024,'#886747',5);
     const mid=ring(x,y+.1,z,(.43-.13*t)*s,7),top=[x,y+.43*h,z],bottom=[x,y-(willow?.57:.22),z];
     for(let k=0;k<7;k++){const j=(k+1)%7;face([mid[k],mid[j],top],tint(m.leaf,.89+.15*Math.cos(k)));face([mid[k],bottom,mid[j]],tint(m.leaf,.75+.1*Math.cos(k)))}
     if(shrub)blade(x,y+.2,z,a,.16,.08,.08,m.bloom);
   }
 }else for(let i=0;i<m.count;i++){
   const a=i*2.4,r=.16+.13*Math.sin(i*1.53),x=r*Math.cos(a),z=r*Math.sin(a),height=h*(.58+.2*(1+Math.cos(i*2.12))),y=start+height;
   if(m.form==='rosette'||m.form==='grass'){blade(0,start,0,a,s*(m.form==='grass'?.32:.52),height*(m.form==='grass'?1:.55),m.form==='grass'?.045:.14,tint(m.leaf,1-.11*(i%3)));continue}
   stalk([x*.3,start,z*.3],[x,y,z],.023,.014,m.leaf,5);
   for(let k=1;k<=3;k++)blade(x*.7,start+height*k*.22,z*.7,a+k*2.8,.27*s,.13,m.form==='flower'?.054:.11,tint(m.leaf,.9+k*.04));
   if(m.form==='flower'){for(let j=0;j<9;j++)blade(x,y,z,j*2*Math.PI/9,.14*s,.035,.048,m.bloom);stalk([x,y,z],[x,y+.045,z],.05,.043,'#ddac41',7)}
 }
 return faces;
}
function paintPot(canvas,plant){
 const ctx=canvas.getContext('2d');canvas.width=260;canvas.height=280;const shapes=specimenMesh(plant,true);
 const scale=Math.min(117,230/Math.max(...shapes.flatMap(f=>f.vertices.map(v=>v[1]))));
 ctx.fillStyle='#5c503125';ctx.beginPath();ctx.ellipse(132,257,52,8,0,0,Math.PI*2);ctx.fill();
 const projected=shapes.map(f=>{const p=f.vertices.map(([x,y,z])=>[130+(x*.96-z*.28)*scale,254+((x*.28+z*.96)*.19-y*.98)*scale,(x*.28+z*.96)*.98+y*.19]);return {p,color:f.color,d:p.reduce((n,v)=>n+v[2],0)/p.length}}).sort((a,b)=>a.d-b.d);
 for(const {p,color} of projected){ctx.fillStyle=ctx.strokeStyle=color;ctx.lineWidth=.5;ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke()}
}
