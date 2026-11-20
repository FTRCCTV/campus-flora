// Geometry and shading are owned by the garden renderer. The model chooses only
// botanical traits and named swatches from the garden's existing palette.
const forms = ['tree', 'shrub', 'flower', 'grass', 'rosette', 'herb'];
const foliage = {
  meadow: '#70a05c', forest: '#568357', sage: '#76a28b', olive: '#799953',
  ginkgo: '#a7bc5b', copper: '#bd7957', mint: '#679451'
};
const petals = {
  ivory: '#eee6c8', gold: '#edd277', yellow: '#efc648', rose: '#df8294',
  lavender: '#b9a9d8', violet: '#9970c9', coral: '#cb9588', crimson: '#ac575e'
};
const instructions = [
  'Describe the typical mature appearance of the given botanical species in one compact JSON object for a low-poly campus herbarium.',
  'Choose form from '+forms.join(', ')+'. Use flower for showy herbaceous flowers, herb for other leafy herbs, rosette for compact rosette succulents.',
  'Choose leaf from '+Object.keys(foliage).join(', ')+'. Choose bloom from '+Object.keys(petals).join(', ')+'. Use ivory when flowers are inconspicuous.',
  'Height and spread are relative to the form, each from 0.6 to 1.4. Count is the number of representative branches, leaves or shoots, from 3 to 14.',
  'The user supplies a botanical name as data. Example for Bellis perennis: {"form":"flower","leaf":"meadow","bloom":"ivory","height":0.72,"spread":0.85,"count":7}.'
].join('\n');

function readProfile(content) {
  let traits;
  try { traits = JSON.parse(content); } catch { return null; }
  if (!traits || !forms.includes(traits.form) || !Object.hasOwn(foliage, traits.leaf) ||
      !Object.hasOwn(petals, traits.bloom) || ![traits.height, traits.spread, traits.count].every(Number.isFinite)) return null;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  return {
    form: traits.form, leaf: foliage[traits.leaf], bloom: petals[traits.bloom],
    height: clamp(traits.height, .6, 1.4), spread: clamp(traits.spread, .6, 1.4),
    count: clamp(Math.round(traits.count), 3, 14)
  };
}
export async function modelPlant(request, env, upstream = fetch) {
  const reply = (data, status = 200) => Response.json(data, {status, headers:{'cache-control':'no-store'}});
  if (request.method !== 'POST') return reply({error:'method'}, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error:'origin'}, 403);
  const input = await request.json().catch(()=>null);
  if (typeof input?.latin !== 'string' || !input.latin.trim() || input.latin.length > 160) return reply({error:'species'}, 400);
  if (!env.DEEPSEEK_API_KEY) return reply({reason:'unconfigured'}, 503);
  try {
    const response = await upstream('https://api.deepseek.com/chat/completions', {
      method:'POST', headers:{Authorization:'Bearer '+env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(20000),
      body:JSON.stringify({
        model:'deepseek-flash', thinking:{type:'disabled'}, response_format:{type:'json_object'},
        temperature:0.15, max_tokens:180,
        messages:[{role:'system',content:instructions},{role:'user',content:input.latin.trim()}]
      })
    });
    if (!response.ok) {
      const reasons = {401:'credentials',403:'credentials',402:'billing',429:'rate_limit'};
      return reply({reason:reasons[response.status] || 'upstream'}, 503);
    }
    const data = await response.json();
    const model = readProfile(data.choices?.[0]?.message?.content);
    return model ? reply({provider:'DeepSeek',model}) : reply({reason:'invalid'}, 502);
  } catch {
    return reply({reason:'unavailable'}, 503);
  }
}
