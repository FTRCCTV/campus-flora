// Sample the subject more heavily than the image edges. Edge frequencies keep
// recurring wall, sky and soil colours from dominating a small flower.
function extractPlantPalette({data,width,height},form){
  if(!data||width<2||height<2)return {};
  const bins=new Map(),grid=[],step=Math.max(1,Math.ceil(Math.max(width,height)/72));
  let centralWeight=0,borderCount=0;
  for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
    const offset=(y*width+x)*4;
    if(data[offset+3]<200)continue;
    const [r,g,b]=[data[offset],data[offset+1],data[offset+2]];
    const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,s=d/Math.max(1,hi);
    if(hi<35)continue;
    let h=d===0?0:hi===r?60*((g-b)/d):hi===g?60*((b-r)/d+2):60*((r-g)/d+4);
    h=(h+360)%360;
    const neutral=s<.17,green=h>=57&&h<=176&&s>.17;
    const key=[neutral?'n':Math.floor(h/18),Math.min(3,Math.floor(s*4)),Math.floor(hi/56)].join('/');
    const a=bins.get(key)||{r:0,g:0,b:0,weight:0,edge:0,center:0,nearLeaf:0,green,neutral,h,s,v:hi,key};
    const nx=(x+.5)/width,ny=(y+.5)/height,rad=(nx-.5)**2+(ny-.5)**2;
    const w=Math.exp(-9*rad),edge=Math.min(nx,ny,1-nx,1-ny)<.11;
    a.r+=r*w;a.g+=g*w;a.b+=b*w;a.weight+=w;
    if(edge){a.edge++;borderCount++}else{a.center+=w;centralWeight+=w}
    grid.push({x,y,green,bin:a});bins.set(key,a);
  }
  if(!centralWeight)return {};
  // Pale petals are credible beside foliage; an equally pale image border
  // alone provides no such evidence. Use a coarse neighbourhood for this cue.
  const gx=Math.max(1,width/10),gy=Math.max(1,height/10),foliage=new Set();
  for(const p of grid)if(p.green)foliage.add(Math.floor(p.x/gx)+','+Math.floor(p.y/gy));
  for(const p of grid){
    const i=Math.floor(p.x/gx),j=Math.floor(p.y/gy);
    if([[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>foliage.has((i+dx)+','+(j+dy))))p.bin.nearLeaf++;
  }
  function evidence(a){
    const fraction=a.center/centralWeight,background=a.edge/Math.max(1,borderCount);
    return Math.max(0,fraction-.8*background);
  }
  const colors=[...bins.values()];
  const strongest=(eligible,score)=>colors.filter(eligible).sort((a,b)=>score(b)-score(a))[0];
  const asHex=a=>'#'+[a.r,a.g,a.b].map(c=>Math.round(c/a.weight).toString(16).padStart(2,'0')).join('');
  const leafScore=a=>a.center/centralWeight*(.50+.50*a.s)+evidence(a);
  let leaf=strongest(a=>a.green,leafScore);
  if(leaf&&leaf.center/centralWeight<.025)leaf=null;
  // A mostly amber or red central subject can be autumn foliage.
  if(!leaf&&(form==='tree'||form==='shrub'))leaf=strongest(a=>!a.neutral&&(a.h<62||a.h>337)&&a.s>.34&&a.v>95&&evidence(a)>.14,evidence);
  const palette={};if(leaf)palette.leaf=asHex(leaf);
  const bloomScore=a=>evidence(a)*(a.neutral?.67:1)*Math.min(1.5,.65+a.nearLeaf/Math.max(1,a.center));
  const bloom=strongest(a=>{
    if(a.green||a===leaf||a.v<83||evidence(a)<.015)return false;
    if(a.neutral)return a.v>=185&&a.nearLeaf>2&&evidence(a)>.035;
    if(a.h>170&&a.h<248&&a.nearLeaf<3)return false;
    if(a.h>14&&a.h<46&&a.v<155)return false;
    return a.s>.23&&(!leaf||leaf.green||Math.min(Math.abs(a.h-leaf.h),360-Math.abs(a.h-leaf.h))>35);
  },bloomScore);
  if(bloom)palette.bloom=asHex(bloom);
  return palette;
}
async function paletteFromPhoto(url,form){
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas'),factor=Math.min(1,72/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return extractPlantPalette(ctx.getImageData(0,0,canvas.width,canvas.height),form);
}
