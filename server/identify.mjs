import {guard} from './quota.mjs';

export async function identify(request, env, upstream = fetch) {
  const reply = (data, status = 200) => Response.json(data, {status, headers: {'cache-control':'no-store'}});
  if (request.method !== 'POST') return reply({error:'请提交一张植物照片。'},405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error:'请求来源不匹配。'},403);
  const maxPhoto = 4_000_000;
  if (Number(request.headers.get('content-length') || 0) > maxPhoto + 8192) return reply({error:'照片大小超出范围，请换一张。'},413);
  if (request.headers.get('content-type') !== 'image/jpeg') return reply({error:'请使用 JPEG 图像。'},415);
  const key = env.PLANTNET_API_KEY || request.headers.get('x-plantnet-key');
  if (!key) return reply({code:'key',error:'请连接 Pl@ntNet 以开始识别。'},401);
  // Charge the quota before the photo is buffered, so a flood cannot pin 4 MB per call.
  const {ok} = await guard(request, env, {name:'identify', anonymousLimit:30, memberLimit:120, globalLimit:600});
  if (!ok) return reply({code:'rate_limit',error:'识别请求较多，请十分钟后再试。'},429);
  const photo = await request.blob();
  if (!photo.size || photo.size > maxPhoto) return reply({error:'照片大小超出范围，请换一张。'},400);
  const head = new Uint8Array(await photo.slice(0, 3).arrayBuffer());
  if (head.length !== 3 || head[0] !== 0xFF || head[1] !== 0xD8 || head[2] !== 0xFF) return reply({error:'请使用 JPEG 图像。'},415);
  const form = new FormData();
  form.append('images',photo,'plant.jpg');
  const url = new URL('https://my-api.plantnet.org/v2/identify/all');
  url.search = new URLSearchParams({'api-key':key,lang:'zh','nb-results':'5'}).toString();
  try {
    const res = await upstream(url,{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
    if ([401,403].includes(res.status)) return reply({code:env.PLANTNET_API_KEY?'config':'key',error:'识别密钥无效或权限不足，请检查 Pl@ntNet 配置。'},403);
    if (res.status === 404) return reply({results:[]});
    if (res.status === 429) return reply({error:'识别配额已用完，请稍后重试。'},429);
    if (!res.ok) return reply({error:'识别服务暂时不可用。'},502);
    const data = await res.json();
    const results = (data.results || []).filter(r=>r.species?.scientificNameWithoutAuthor).map(r=>({
      latin:r.species.scientificNameWithoutAuthor, name:r.species.commonNames?.[0] || r.species.scientificNameWithoutAuthor,
      score:r.score, family:r.species.family?.scientificNameWithoutAuthor || ''
    }));
    return reply({results});
  } catch {return reply({error:'连接识别服务超时或失败，请重试。'},503)}
}
