const plantProfiles = {
  tree:['#70a05c','#edd277',1.18,.95,6], shrub:['#568357','#df8294',.86,1.1,6],
  flower:['#64905a','#eee6c8',.98,.82,7], grass:['#799953','#aa995c',1.05,.7,12],
  rosette:['#76a28b','#cb9588',.68,1.14,12], herb:['#679451','#b9a9d8',.91,.86,8]
};
function basicProfile(plant){
  const latin=String(plant.latin).toLowerCase(), family=String(plant.family||'').toLowerCase();
  let form='herb',leaf,bloom;
  if(/^(ginkgo|salix|acer|quercus|populus|pinus|platanus|prunus|betula) /.test(latin)||/pinaceae|fagaceae/.test(family))form='tree';
  if(/^(rosa|hibiscus|syringa|hydrangea) /.test(latin))form='shrub';
  if(/^(echeveria|aloe|sempervivum|haworthia) /.test(latin)||family==='crassulaceae')form='rosette';
  if(/poaceae|莎草科|禾本科|cyperaceae/.test(family)||/^(carex|poa|festuca) /.test(latin))form='grass';
  if(/asteraceae|菊科|violaceae/.test(family)||/^(bellis|viola|taraxacum|chrysanthemum) /.test(latin))form='flower';
  if(latin.startsWith('ginkgo '))leaf='#a7bc5b';
  if(latin.startsWith('acer '))leaf='#bd7957';
  if(latin.startsWith('viola '))bloom='#9970c9';
  if(latin.startsWith('taraxacum '))bloom='#efc648';
  const [l,b,height,spread,count]=plantProfiles[form];
  return {form,leaf:leaf||l,bloom:bloom||b,height,spread,count};
}
function plantProfile(plant){return plant.model?.form in plantProfiles?plant.model:basicProfile(plant)}
function bed(plant){return plant.bed||(['tree','shrub'].includes(plantProfile(plant).form)?'outside':'inside')}
const sillExamples=[
  {name:'雏菊',latin:'Bellis perennis',family:'菊科',note:'黄花心周围绕着一圈浅色的小花。'},
  {name:'薄荷',latin:'Mentha canadensis',family:'唇形科',note:'茎上成对生长的叶片，沿枝条向上舒展。'},
  {name:'拟石莲花',latin:'Echeveria elegans',family:'景天科',note:'肥厚的叶片一圈圈排列，形成紧凑的莲座。'}
];
