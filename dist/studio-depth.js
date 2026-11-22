/* Orthographic faces have linear depth along each projected edge and scanline.
   Sample at pixel centres so colour and picking use exactly the same surface. */
function studioRaster(width,height){
  const image=new ImageData(width,height);
  return {width,height,image,rgba:image.data,pixels:new Uint32Array(image.data.buffer),
    depth:new Float32Array(width*height).fill(-Infinity)};
}

function studioRasterFace(target,face,dx=0,dy=0,dz=0,id=0,depthOnly=false){
  const {p,color}=face,{width,height,depth,pixels,rgba,owners}=target;
  const alpha=color>>>24;
  let low=Infinity,high=-Infinity;
  for(const v of p){low=Math.min(low,v[1]);high=Math.max(high,v[1])}
  const end=Math.min(height,Math.ceil(high+dy-.5));
  const xs=[],zs=[];
  for(let y=Math.max(0,Math.ceil(low+dy-.5));y<end;y++){
    const row=y+.5-dy;
    let count=0;
    for(let i=0,j=p.length-1;i<p.length;j=i++){
      const a=p[j],b=p[i];
      if((a[1]>row)===(b[1]>row))continue;
      const t=(row-a[1])/(b[1]-a[1]);
      const x=a[0]+(b[0]-a[0])*t+dx,z=a[2]+(b[2]-a[2])*t+dz;
      let k=count++;
      while(k>0&&xs[k-1]>x){xs[k]=xs[k-1];zs[k]=zs[k-1];k--}
      xs[k]=x;zs[k]=z;
    }
    for(let k=0;k+1<count;k+=2){
      const start=Math.max(0,Math.ceil(xs[k]-.5)),stop=Math.min(width,Math.ceil(xs[k+1]-.5));
      if(start>=stop)continue;
      const slope=(zs[k+1]-zs[k])/(xs[k+1]-xs[k]);
      let z=zs[k]+(start+.5-xs[k])*slope;
      for(let i=y*width+start,last=y*width+stop;i<last;i++,z+=slope){
        if(z<depth[i]-.000001)continue;
        if(depthOnly){depth[i]=z;continue}
        if(alpha===255){
          depth[i]=z;pixels[i]=color;
          if(owners)owners[i]=id;
        }else{
          const o=i*4,a=alpha/255,under=rgba[o+3]/255*(1-a),out=a+under;
          for(let c=0;c<3;c++)rgba[o+c]=(((color>>>(8*c))&255)*a+rgba[o+c]*under)/out;
          rgba[o+3]=out*255;
          if(owners&&id)owners[i]=id;
        }
      }
    }
  }
}

function studioRasterColor(css){
  const rgb=parseInt(css.slice(1,7),16),a=css.length===9?parseInt(css.slice(7),16):255;
  return ((a<<24)|((rgb&255)<<16)|(rgb&0xff00)|(rgb>>>16))>>>0;
}

function studioProjectedFace(points,css){
  return {p:points,color:studioRasterColor(css),depth:points.reduce((s,v)=>s+v[2],0)/points.length};
}
