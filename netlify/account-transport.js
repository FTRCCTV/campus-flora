// Only the Netlify build uses this transport. Keep individual requests below the platform limit.
async function netlifyAccountFetch(path,options){
  const chunkSize=2*1024*1024;
  if(options.method==='PUT'){
    const body=new Blob([options.body]);
    if(body.size<=chunkSize)return fetch(path,options);
    if(body.size>16*1024*1024)return Response.json({error:'花园已超过同步容量。'},{status:413});
    const transfer=crypto.randomUUID(),count=Math.ceil(body.size/chunkSize);
    for(let part=0;part<count;part++){
      const result=await fetch(path+'/parts?transfer='+transfer+'&part='+part,{
        ...options,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/octet-stream'},body:body.slice(part*chunkSize,(part+1)*chunkSize)
      });
      if(!result.ok)return result;
    }
    return fetch(path+'/parts?transfer='+transfer+'&count='+count,{...options,signal:AbortSignal.timeout(30000),method:'POST',body:null});
  }
  const first=await fetch(path,options),count=Number(first.headers.get('X-Flora-Parts'));
  if(!first.ok||!count)return first;
  const version=first.headers.get('X-Flora-Version'),pieces=[await first.arrayBuffer()];
  for(let i=1;i<count;i++){
    const next=await fetch(path+'?part='+i+'&version='+encodeURIComponent(version),{...options,signal:AbortSignal.timeout(25000)});
    if(!next.ok)return next;
    pieces.push(await next.arrayBuffer());
  }
  return new Response(new Blob(pieces),{headers:{'Content-Type':'application/json'}});
}
