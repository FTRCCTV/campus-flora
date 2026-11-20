function sampleLeaf(id){
 let c=document.createElement('canvas');c.width=c.height=360;let g=c.getContext('2d');g.fillStyle='#f7f4e8';g.fillRect(0,0,360,360);drawLeaf(g,id,180,295,2.15,.03);return c
}
// Segment the largest foreground object against a plain border background.
function outline(source){
 const n=112,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,n,n);
 const w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;
 let sw=n*w/Math.max(w,h),sh=n*h/Math.max(w,h),left=(n-sw)/2,top=(n-sh)/2;g.drawImage(source,left,top,sw,sh);
 let data=g.getImageData(0,0,n,n).data,edges=[[],[],[]],mask=new Uint8Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
 if(x<left||x>=left+sw||y<top||y>=top+sh)continue;
 if(Math.min(x-left,left+sw-1-x,y-top,top+sh-1-y)<3){let i=(y*n+x)*4;edges.forEach((a,k)=>a.push(data[i+k]))}}
 let bg=edges.map(a=>a.sort((a,b)=>a-b)[a.length>>1]);
 for(let y=Math.ceil(top);y<Math.floor(top+sh);y++)for(let x=Math.ceil(left);x<Math.floor(left+sw);x++){let j=y*n+x;mask[j]=Math.hypot(...bg.map((v,k)=>v-data[j*4+k]))>59}
 let best=[];for(let i=0;i<mask.length;i++){if(!mask[i])continue;let q=[i];mask[i]=0;for(let k=0;k<q.length;k++){let j=q[k];for(let v of [j-n,j+n,j%n?j-1:-1,j%n<n-1?j+1:-1])if(mask[v]){mask[v]=0;q.push(v)}}if(q.length>best.length)best=q}
 if(best.length<sw*sh*.022||best.length>sw*sh*.72)return null;
 let cx=0,cy=0;best.forEach(i=>{cx+=i%n;cy+=Math.floor(i/n)});cx/=best.length;cy/=best.length;
 let bins=Array(48).fill(0);for(let j of best){let x=j%n-cx,y=Math.floor(j/n)-cy,k=Math.floor((Math.atan2(y,x)+Math.PI)*48/(2*Math.PI))%48;bins[k]=Math.max(bins[k],Math.hypot(x,y))}
 let unit=Math.sqrt(best.length);return bins.map(x=>x/unit)
}
function matchLeaf(source){
 let vec=outline(source);if(!vec)return null;
 let scores=plants.map((_,id)=>{let ref=outline(sampleLeaf(id)),score=Infinity;for(let shift=0;shift<48;shift++)for(let dir of [1,-1]){let sum=0;for(let i=0;i<48;i++)sum+=(vec[i]-ref[(shift+i*dir+48)%48])**2;score=Math.min(score,Math.sqrt(sum/48))}return {id,score}}).sort((a,b)=>a.score-b.score);
 return scores[0].score<.20&&scores[1].score-scores[0].score>.032?scores[0].id:null
}
