import {guard} from './quota.mjs';

// Geometry and shading are owned by the garden renderer. The model chooses only
// botanical traits and named swatches from the garden's existing palette.
const forms = ['tree', 'shrub', 'flower', 'grass', 'rosette', 'herb'];
const leafShapes = ['oval','lanceolate','needle','fan','palmate','heart','succulent'];
const crownShapes = ['upright','rounded','spreading','weeping','conical'];
const foliage = {
  meadow: '#70a05c', forest: '#568357', sage: '#76a28b', olive: '#799953',
  ginkgo: '#a7bc5b', copper: '#bd7957', mint: '#679451'
};
const petals = {
  ivory: '#eee6c8', gold: '#edd277', yellow: '#efc648', rose: '#df8294',
  lavender: '#b9a9d8', violet: '#9970c9', coral: '#cb9588', crimson: '#ac575e'
};
const arrangements=['alternate','opposite','whorled','basal'],inflorescences=['solitary','cluster','spike','none'];
const instructions = [
  'Describe the typical mature appearance of the given botanical species in one compact JSON object for a low-poly campus herbarium.',
  'Choose form from '+forms.join(', ')+'. Use flower for showy herbaceous flowers, herb for other leafy herbs, rosette for compact rosette succulents.',
  'Choose leaf from '+Object.keys(foliage).join(', ')+'. Choose bloom from '+Object.keys(petals).join(', ')+'. Use ivory when flowers are inconspicuous.',
  'Height and spread are relative to the form, each from 0.6 to 1.4. Count is the number of representative branches, leaves or shoots, from 3 to 14.',
  'Describe representative leafShape from '+leafShapes.join(', ')+', crownShape from '+crownShapes.join(', ')+', and petals (0 if inconspicuous; for composites count representative rays). These describe visual morphology. The gardener sets the actual size and position.',
  'Distinguish the genus from the exact species; prioritize diagnostic morphology over generic aesthetics. Give the predominant foliage arrangement (alternate/opposite/whorled/basal), inflorescence (solitary/cluster/spike/none), leafAspect (0.65 to 1.5, width relative to the selected leaf template), and margin (smooth/toothed). Use none for inconspicuous reproductive structures and never invent blooms on conifers. Choose the nearest supported architecture.',
  'Include fact: one or two short plain Chinese sentences about a reliably known distinguishing feature of this species, with a specific observation a student can make. If species-level identification is uncertain, explicitly qualify genus-level facts. No medical, edibility or care advice. Return all properties as JSON, no prose outside it.',
  'The user supplies a botanical name as data. Morphology example for Bellis perennis (also include arrangement, inflorescence, leafAspect, margin and fact): {"form":"flower","leaf":"meadow","bloom":"ivory","height":0.72,"spread":0.85,"count":7,"leafShape":"oval","crownShape":"upright","petals":16}.'
].join('\n');

function readProfile(content) {
  let traits;
  try { traits = JSON.parse(content); } catch { return null; }
  if (!traits || !forms.includes(traits.form) || !Object.hasOwn(foliage, traits.leaf) ||
      !arrangements.includes(traits.arrangement)||!inflorescences.includes(traits.inflorescence)||!['smooth','toothed'].includes(traits.margin)||!Number.isFinite(traits.leafAspect)||typeof traits.fact!=='string'||!traits.fact.trim()||
      !Object.hasOwn(petals, traits.bloom) || ![traits.height, traits.spread, traits.count].every(Number.isFinite)) return null;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  return {
    profileVersion:3, arrangement:traits.arrangement, inflorescence:traits.inflorescence, leafAspect:clamp(traits.leafAspect,.65,1.5), margin:traits.margin, fact:traits.fact.trim().slice(0,240),
    form: traits.form, leaf: foliage[traits.leaf], bloom: petals[traits.bloom],
    height: clamp(traits.height, .6, 1.4), spread: clamp(traits.spread, .6, 1.4),
    count: clamp(Math.round(traits.count), 3, 14),
    leafShape:leafShapes.includes(traits.leafShape)?traits.leafShape:'oval',
    crownShape:crownShapes.includes(traits.crownShape)?traits.crownShape:'upright',
    petals:Number.isFinite(traits.petals)?clamp(Math.round(traits.petals),0,24):0
  };
}
export async function modelPlant(request, env, upstream = fetch) {
  const reply = (data, status = 200) => Response.json(data, {status, headers:{'cache-control':'no-store'}});
  if (request.method !== 'POST') return reply({error:'method'}, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error:'origin'}, 403);
  if (Number(request.headers.get('content-length') || 0) > 2048) return reply({error:'species'}, 413);
  if (!env.DEEPSEEK_API_KEY) return reply({reason:'unconfigured'}, 503);
  const {ok} = await guard(request, env, {name:'model', anonymousLimit:8, memberLimit:60, globalLimit:240});
  if (!ok) return reply({reason:'rate_limit'}, 429);
  const input = await request.json().catch(()=>null);
  if (typeof input?.latin !== 'string' || !input.latin.trim() || input.latin.length > 160) return reply({error:'species'}, 400);
  try {
    const response = await upstream('https://api.deepseek.com/chat/completions', {
      method:'POST', headers:{Authorization:'Bearer '+env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(85000),
      body:JSON.stringify({
        model:'deepseek-v4-pro', thinking:{type:'enabled'}, response_format:{type:'json_object'},
        max_tokens:3200,
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
