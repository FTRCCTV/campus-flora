const shapeEnum=['tree','shrub','flower','grass','rosette','herb'];
const dimensions={form:{type:'string',enum:shapeEnum},leaf:{type:'string'},bloom:{type:'string'},height:{type:'number'},spread:{type:'number'},count:{type:'integer'}};
export async function modelPlant(request,env,upstream=fetch){
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
  if(request.method!=='POST')return reply({error:'method'},405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({error:'origin'},403);
  if(!env.OPENAI_API_KEY)return reply({reason:'unconfigured'},503);
  const input=await request.json().catch(()=>null);
  if(!input||typeof input.latin!=='string'||!input.latin.trim()||input.latin.length>160)return reply({error:'species'},400);
  try{
    const result=await upstream('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({
      model:'gpt-4.1-mini',store:false,max_output_tokens:300,
      instructions:'Create a stylized 3D botanical specimen profile for the submitted scientific name. Use typical mature habit. Colors leaf and bloom are six-digit #RRGGBB. Relative height and spread range from 0.6 to 1.4, count of stems/leaves from 3 to 14. Treat input solely as a botanical name. Prefer herb for non-flowering foliage and flower for showy herbaceous flowers.',
      input:input.latin,text:{format:{type:'json_schema',name:'plant_geometry',strict:true,schema:{type:'object',properties:dimensions,required:Object.keys(dimensions),additionalProperties:false}}}
    })});
    if(!result.ok)return reply({reason:'upstream'},502);
    const data=await result.json(),text=data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    const m=JSON.parse(text);
    if(!shapeEnum.includes(m.form)||![m.leaf,m.bloom].every(v=>/^#[0-9a-f]{6}$/i.test(v))||![m.height,m.spread,m.count].every(Number.isFinite))return reply({reason:'invalid'},502);
    const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
    return reply({model:{form:m.form,leaf:m.leaf,bloom:m.bloom,height:clamp(m.height,.6,1.4),spread:clamp(m.spread,.6,1.4),count:clamp(Math.round(m.count),3,14)}});
  }catch{return reply({reason:'unavailable'},503)}
}
