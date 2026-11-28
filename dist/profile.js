// Plant profiles. A profile is the complete set of visual traits consumed by
// specimen.js. Traits come from, in order of trust:
//   1. a curated campus species entry (hand-checked, works offline),
//   2. the species model returned by /api/model,
//   3. a genus prior, 4. a family prior, 5. the growth-form defaults.
const plantProfiles = {
  tree:['#70a05c','#edd277',1.18,.95,6], shrub:['#568357','#df8294',.86,1.1,6],
  flower:['#64905a','#eee6c8',.98,.82,7], grass:['#799953','#aa995c',1.05,.7,12],
  rosette:['#76a28b','#cb9588',.68,1.14,12], herb:['#679451','#b9a9d8',.91,.86,8]
};
const floraFoliage = {
  meadow:'#70a05c', forest:'#568357', sage:'#76a28b', olive:'#799953', ginkgo:'#a7bc5b',
  copper:'#bd7957', mint:'#679451', deep:'#3f6b4a', bluegreen:'#5f8f88', golden:'#c6bd55', burgundy:'#8c4f5e'
};
const floraBloom = {
  ivory:'#eee6c8', gold:'#edd277', yellow:'#efc648', rose:'#df8294', lavender:'#b9a9d8',
  violet:'#9970c9', coral:'#cb9588', crimson:'#ac575e', white:'#f8f5ec', pink:'#f0b6c6',
  magenta:'#c8589c', orange:'#e9933f', red:'#d5463f', blue:'#6f8fd8', green:'#a9c47a'
};
const floraBark = {brown:'#876a4e', grey:'#8d877b', pale:'#cfc9b8', dark:'#5f4b3c', red:'#96604a', green:'#7d9a5c'};
const floraAccent = {...floraFoliage, ...floraBloom, brown:'#8a6a45', dark:'#4a3836'};
const floraVocab = {
  form:['tree','shrub','flower','grass','rosette','herb'],
  habit:['upright','vine','bamboo','aquatic'],
  leafShape:['oval','lanceolate','needle','fan','palmate','heart','succulent','scale','strap','round','lobed','spoon'],
  leafCompound:['simple','pinnate','palmate','trifoliate'],
  arrangement:['alternate','opposite','whorled','basal'],
  margin:['smooth','toothed'],
  crownShape:['upright','rounded','spreading','weeping','conical','columnar','arching'],
  flowerShape:['daisy','cup','double','trumpet','pea','cross','star','iris','tuft','globe','ear'],
  inflorescence:['solitary','cluster','spike','panicle','pendant','none'],
  fruit:['none','berry','pome','pod','cone','samara','capsule']
};
// Compact trait notation used by the tables below:
//   c:crown  l:leafShape  cp:compound/leaflets  a:alt|opp|wh|bas  m:s|t
//   f:flowerShape/petals  i:inflorescence  b:bloom  g:foliage  ct:flower centre
//   fr:fruit/colour  bk:bark  hb:habit  h:height  s:spread  n:count  w:leafAspect
//   ld:bloom load 1 (sparse) to 3 (profuse)
const floraShort = {alt:'alternate',opp:'opposite',wh:'whorled',bas:'basal',s:'smooth',t:'toothed',tri:'trifoliate'};
const floraTokens = {c:'crownShape',l:'leafShape',a:'arrangement',m:'margin',i:'inflorescence',hb:'habit'};
function floraParse(spec){
  const out={};
  for(const token of spec.split(' ')){
    if(!token)continue;
    const cut=token.indexOf(':'),k=token.slice(0,cut),[v,n]=token.slice(cut+1).split('/'),value=floraShort[v]||v;
    const pick=(table,name)=>{if(!Object.hasOwn(table,name))throw Error('flora colour '+token);return table[name]};
    if(Object.hasOwn(floraTokens,k)){
      const field=floraTokens[k];
      if(!floraVocab[field].includes(value))throw Error('flora trait '+token);
      out[field]=value;
    }
    else if(k==='cp'){if(!floraVocab.leafCompound.includes(value)||!(+n>=3))throw Error('flora trait '+token);out.leafCompound=value;out.leaflets=+n}
    else if(k==='f'){if(!floraVocab.flowerShape.includes(value)||!(+n>=0))throw Error('flora trait '+token);out.flowerShape=value;out.petals=+n}
    else if(k==='fr'){if(!floraVocab.fruit.includes(value))throw Error('flora trait '+token);out.fruit=value;out.fruitColor=pick(floraAccent,n)}
    else if(k==='g')out.leaf=pick(floraFoliage,v);
    else if(k==='b')out.bloom=pick(floraBloom,v);
    else if(k==='ct')out.center=pick(floraAccent,v);
    else if(k==='bk')out.bark=pick(floraBark,v);
    else if(k==='h')out.height=+v;
    else if(k==='s')out.spread=+v;
    else if(k==='n')out.count=+v;
    else if(k==='w')out.leafAspect=+v;
    else if(k==='ld')out.bloomLoad=+v;
    else throw Error('flora token '+token);
  }
  return out;
}
// Campus species: 'latin|中文名|form|traits|fact'. Names follow POWO, the
// backbone Pl@ntNet reports. Facts state one feature a student can check.
const floraSpecies = [
  // Trees
  'ginkgo biloba|银杏|tree|c:upright l:fan a:alt i:none g:ginkgo bk:grey|扇形叶的叶脉从叶柄处反复二叉分开，没有网状脉。长枝上的叶散生，短枝上的叶成簇。',
  'styphnolobium japonicum|槐|tree|c:rounded l:oval cp:pinnate/11 a:alt f:pea/5 i:panicle b:ivory fr:pod/olive ld:1|奇数羽状复叶，小叶卵形。夏季开黄白色蝶形花，荚果在种子之间收缩成一串念珠。',
  'robinia pseudoacacia|刺槐|tree|c:upright l:oval cp:pinnate/13 a:alt f:pea/5 i:pendant b:white fr:pod/brown|小叶椭圆形，先端圆或微凹；叶柄基部常有一对托叶刺。春季白色蝶形花成串下垂。',
  'pinus tabuliformis|油松|tree|c:conical l:needle a:alt i:none g:deep fr:cone/brown bk:red|针叶两针一束，粗硬。老树树冠常呈平顶，树皮裂成鳞状厚块。',
  'pinus bungeana|白皮松|tree|c:conical l:needle a:alt i:none g:deep fr:cone/brown bk:pale|针叶三针一束。树皮成不规则薄片脱落，露出灰白与淡绿相间的斑块。',
  'platycladus orientalis|侧柏|tree|c:conical l:scale a:opp i:none g:forest fr:cone/brown bk:red|生鳞叶的小枝扁平，排成直立的平面，两面同为绿色。鳞形叶交互对生，紧贴小枝。',
  'juniperus chinensis|圆柏|tree|c:columnar l:scale a:opp i:none g:deep fr:berry/dark bk:red|同一株上常有两种叶：老枝多为鳞形叶，幼枝和幼树多为刺形叶。',
  'cedrus deodara|雪松|tree|c:conical l:needle a:alt i:none g:bluegreen bk:grey|针叶在长枝上散生，在短枝上簇生。大枝平展，枝梢和树顶常微微下垂。',
  'metasequoia glyptostroboides|水杉|tree|c:conical l:needle a:opp i:none g:meadow bk:red|条形叶在小枝上对生、排成羽状，冬季与小枝一同脱落。',
  'salix babylonica|垂柳|tree|c:weeping l:lanceolate a:alt m:t i:none|细枝长而下垂。叶狭披针形，边缘有细锯齿，背面颜色较浅。',
  'salix matsudana|旱柳|tree|c:rounded l:lanceolate a:alt m:t i:none|枝条直立或斜展，不像垂柳那样长垂。叶披针形，背面带白色。',
  'populus tomentosa|毛白杨|tree|c:upright l:heart a:alt m:t i:none bk:pale w:1.1|树皮灰白，散生菱形皮孔。叶三角状卵形，幼时叶背密生灰白色绒毛。',
  'populus canadensis|加杨|tree|c:upright l:heart a:alt m:t i:none bk:grey w:1.1|叶近三角形，基部平截。叶柄侧扁，所以叶片在微风中也不停翻动。',
  'fraxinus chinensis|白蜡树|tree|c:rounded l:oval cp:pinnate/7 a:opp m:t i:none fr:samara/olive|奇数羽状复叶在枝上对生，小叶通常5至7枚。翅果倒披针形，成串下垂。',
  'fraxinus pennsylvanica|美国红梣|tree|c:rounded l:lanceolate cp:pinnate/7 a:opp m:t i:none fr:samara/olive|俗称洋白蜡。羽状复叶对生，小叶7至9枚，秋季变黄。翅果的翅下延到果体中部。',
  'yulania denudata|玉兰|tree|c:upright l:oval a:alt f:cup/9 i:solitary b:white ld:3 w:1.15|先花后叶。花被片9枚，白色，大小形状相近。叶倒卵形，先端宽圆并有短突尖。',
  'yulania soulangeana|二乔玉兰|tree|c:upright l:oval a:alt f:cup/9 i:solitary b:pink ld:3 w:1.15|玉兰与紫玉兰的杂交种。花被片外面紫红，里面近白色，先叶开放。',
  'yulania liliiflora|紫玉兰|shrub|c:upright l:oval a:alt f:cup/6 i:solitary b:magenta ld:2 w:1.1|花被片外面紫色，里面近白色；最外轮3枚小而呈萼片状。常丛生成灌木。',
  'prunus persica|桃|tree|c:spreading l:lanceolate a:alt m:t f:cup/5 i:solitary b:pink ld:3|叶长披针形，边缘有细锯齿。花单生，花梗极短，先于叶开放。',
  'prunus davidiana|山桃|tree|c:spreading l:lanceolate a:alt m:t f:cup/5 i:solitary b:pink ld:3 bk:red|树皮暗紫红色，光滑而有光泽。早春先叶开花，花粉红至近白色。',
  'prunus yedoensis|东京樱花|tree|c:spreading l:oval a:alt m:t f:cup/5 i:cluster b:pink ld:3 bk:dark|花数朵排成伞形总状花序，花瓣先端有凹缺。树皮上有横向排列的皮孔。',
  'prunus serrulata|山樱花|tree|c:spreading l:oval a:alt m:t f:cup/5 i:cluster b:white ld:3 bk:dark|叶缘锯齿尖锐，齿端有芒。花数朵成伞房状，花与叶同时展开。',
  'prunus triloba|榆叶梅|shrub|c:rounded l:oval a:alt m:t f:cup/5 i:solitary b:pink ld:3|叶片像榆树叶，边缘有粗重锯齿，先端有时浅裂成三瓣。花粉红色，紧贴枝条开放。',
  'prunus cerasifera|紫叶李|tree|c:rounded l:oval a:alt m:t f:cup/5 i:solitary b:pink g:burgundy ld:2|校园常见的紫叶品种整个生长季叶片都呈紫红色。花小，淡粉白色，与叶同放。',
  'prunus armeniaca|杏|tree|c:rounded l:oval a:alt m:t f:cup/5 i:solitary b:white ld:3 w:1.3|叶宽卵形，先端短尖。花单生，先叶开放，紫红色的萼片在花后向后反折。',
  'malus spectabilis|海棠花|tree|c:upright l:oval a:alt m:t f:cup/5 i:cluster b:pink fr:pome/yellow ld:3|花蕾红艳，开放后转为粉白。花4至6朵排成近伞形花序，花梗细长。',
  'malus micromalus|西府海棠|tree|c:upright l:oval a:alt m:t f:cup/5 i:cluster b:pink fr:pome/red ld:3|树姿较直立。花蕾红色，开后粉红；秋季结直径一两厘米的红色小果。',
  'malus halliana|垂丝海棠|tree|c:spreading l:oval a:alt m:t f:cup/5 i:cluster b:rose fr:pome/crimson ld:3|花梗细长，紫红色，花朵向下垂挂。',
  'crataegus pinnatifida|山楂|tree|c:rounded l:lobed a:alt m:t f:cup/5 i:cluster b:white fr:pome/red|叶片羽状深裂，裂片边缘有锯齿。白花成伞房花序，秋季结带浅色斑点的红果。',
  'acer palmatum|鸡爪槭|tree|c:spreading l:palmate a:opp m:t i:none g:copper fr:samara/rose|叶掌状5至9深裂，多为7裂；裂片先端尾尖，边缘有细重锯齿。叶在枝上对生。',
  'acer truncatum|元宝槭|tree|c:rounded l:palmate a:opp m:s i:none g:forest fr:samara/olive|叶通常掌状5裂，裂片全缘，基部平截。翅果成对，形似元宝，因此得名。',
  'acer negundo|梣叶槭|tree|c:rounded l:oval cp:pinnate/5 a:opp m:t i:none fr:samara/olive|槭属中少见的羽状复叶，小叶3至7枚。翅果两翅成锐角，稍向内弯。',
  'koelreuteria paniculata|栾树|tree|c:rounded l:lobed cp:pinnate/9 a:alt m:t f:star/4 i:panicle b:yellow fr:capsule/coral|小叶边缘有不规则的粗齿或缺刻。夏季顶生大型黄色圆锥花序，蒴果膨大如小灯笼。',
  'diospyros kaki|柿|tree|c:rounded l:oval a:alt m:s i:none g:forest fr:pome/orange w:1.2|叶片厚而有光泽，全缘。果实成熟时橙黄至橙红，基部有四裂的宿存花萼。',
  'ailanthus altissima|臭椿|tree|c:upright l:lanceolate cp:pinnate/13 a:alt m:s i:none fr:samara/coral|小叶基部两侧各有一两个粗齿，齿背有腺体，揉碎有特殊气味。翅果中央有一粒种子。',
  'paulownia tomentosa|毛泡桐|tree|c:spreading l:heart a:opp m:s f:trumpet/5 i:panicle b:lavender w:1.2|叶大，心形，对生，有黏质短毛。春季先叶开淡紫色的漏斗状钟形花。',
  'ulmus pumila|榆树|tree|c:rounded l:oval a:alt m:t i:none fr:samara/gold|叶缘有锯齿，基部略偏斜。春季先叶结出近圆形的翅果，俗称榆钱。',
  'platanus hispanica|二球悬铃木|tree|c:spreading l:palmate a:alt m:t i:none fr:pome/brown bk:pale|树皮成片剥落，露出灰绿与乳白相间的斑块。果球通常两个一串，垂在长柄上。',
  'eucommia ulmoides|杜仲|tree|c:rounded l:oval a:alt m:t i:none|叶片断裂处有白色细胶丝相连，树皮和翅果里也有。',
  'morus alba|桑|tree|c:rounded l:heart a:alt m:t i:none fr:berry/violet|叶卵形，边缘有粗钝锯齿，有时不规则分裂。聚花果成熟时紫黑色。',
  'broussonetia papyrifera|构树|tree|c:spreading l:lobed a:alt m:t i:none fr:pome/orange|同一株上常有不裂和深裂两种叶，叶面粗糙，背面密生柔毛。雌株结橙红色球形聚花果。',
  'ziziphus jujuba|枣|tree|c:upright l:oval a:alt m:t i:none fr:berry/crimson|叶卵形，基部有三条明显的主脉。枝条呈之字形弯曲，常有托叶刺。',
  'juglans regia|胡桃|tree|c:rounded l:oval cp:pinnate/7 a:alt m:s i:none fr:pome/meadow bk:pale|奇数羽状复叶，小叶全缘，顶端一枚最大。果实外面包着绿色肉质的外果皮。',
  'albizia julibrissin|合欢|tree|c:spreading l:lanceolate cp:pinnate/13 a:alt m:s f:tuft/14 i:cluster b:pink|二回羽状复叶，小叶在夜间成对闭合。花上粉红色的长丝是雄蕊的花丝。',
  'firmiana simplex|梧桐|tree|c:rounded l:palmate a:alt m:s i:none bk:green w:1.15|树皮青绿色，平滑。叶掌状3至5裂，基部心形。',
  'liriodendron chinense|鹅掌楸|tree|c:upright l:lobed a:alt m:s f:cup/6 i:solitary b:green ld:1|叶先端平截，两侧各有一个裂片，形似马褂。',
  // Shrubs
  'lagerstroemia indica|紫薇|shrub|c:upright l:oval a:opp m:s f:cup/6 i:panicle b:magenta bk:pale|树皮薄片脱落后光滑。花瓣6枚，边缘皱缩并有长爪，夏秋连续开放。',
  'cotinus coggygria|黄栌|shrub|c:rounded l:round a:alt m:s i:none g:olive|叶近圆形或倒卵形，全缘，秋季变红。不育花的花梗伸长成羽毛状，远看如烟雾。',
  'syringa oblata|紫丁香|shrub|c:upright l:heart a:opp m:s f:cross/4 i:panicle b:lavender ld:3 w:1.2|叶对生，宽卵形至肾形，通常宽大于长。花冠管细长，顶端4裂，组成圆锥花序。',
  'forsythia suspensa|连翘|shrub|c:arching l:oval a:opp m:t f:cross/4 i:solitary b:yellow ld:3|枝条拱形下垂，节间中空。花冠4深裂，先叶开放；叶有时裂成3小叶。',
  'forsythia viridissima|金钟花|shrub|c:upright l:lanceolate a:opp m:t f:cross/4 i:solitary b:yellow ld:3|枝条较直立，髓呈薄片状。叶通常在中部以上有锯齿。',
  'jasminum nudiflorum|迎春花|shrub|c:arching l:oval cp:tri/3 a:opp m:s f:star/6 i:solitary b:yellow ld:3|小枝绿色，四棱形；三出复叶对生。花冠通常6裂，早春先叶开放。',
  'rosa chinensis|月季花|shrub|c:upright l:oval cp:pinnate/5 a:alt m:t f:double/15 i:solitary b:rose ld:2|羽状复叶，小叶3至5枚，表面有光泽。茎上有钩状皮刺，一年可多次开花。',
  'rosa xanthina|黄刺玫|shrub|c:arching l:oval cp:pinnate/9 a:alt m:t f:double/12 i:solitary b:yellow ld:3|小叶7至13枚，宽卵形至近圆形。花黄色，单生于短枝顶端，枝上有散生皮刺。',
  'rosa rugosa|玫瑰|shrub|c:rounded l:oval cp:pinnate/7 a:alt m:t f:double/12 i:solitary b:magenta ld:2|小叶表面叶脉下陷而多皱，背面有绒毛。枝上密生皮刺和刺毛。',
  'rosa multiflora|野蔷薇|shrub|c:arching l:oval cp:pinnate/7 a:alt m:t f:cup/5 i:cluster b:white ld:3|托叶边缘呈篦齿状，贴生在叶柄上。花多朵排成圆锥状花序。',
  'hibiscus syriacus|木槿|shrub|c:upright l:oval a:alt m:t f:trumpet/5 i:solitary b:rose ct:crimson ld:2|花单生于叶腋，花瓣基部常有深色斑，雄蕊合生成一根花丝筒。叶菱状卵形，常3裂。',
  'paeonia suffruticosa|牡丹|shrub|c:rounded l:lobed cp:tri/3 a:alt m:s f:double/18 i:solitary b:rose ld:2 w:1.2|茎木质，冬季地上枝条不枯死，这是它与芍药最直接的区别。顶生小叶常3裂。',
  'paeonia lactiflora|芍药|flower|l:lanceolate cp:tri/3 a:alt m:s f:double/18 i:solitary b:pink n:6|草本，冬季地上部分枯萎。小叶狭卵形至披针形，通常不分裂。',
  'lonicera maackii|金银忍冬|shrub|c:spreading l:lanceolate a:opp m:s f:star/5 i:cluster b:ivory fr:berry/red w:1.15|花成对生于叶腋，初开白色，后变黄色。秋季成对的红色浆果挂在枝上。',
  'lonicera japonica|忍冬|shrub|hb:vine l:oval a:opp m:s f:star/5 i:cluster b:ivory fr:berry/dark|缠绕藤本。花成对开放，先白后黄，所以又叫金银花。',
  'weigela florida|锦带花|shrub|c:arching l:oval a:opp m:t f:trumpet/5 i:cluster b:rose ld:3|花冠漏斗状钟形，外面玫红，里面较浅。叶对生，边缘有锯齿。',
  'kerria japonica|棣棠|shrub|c:arching l:lanceolate a:alt m:t f:cup/5 i:solitary b:gold ld:3|小枝绿色，有棱。叶缘有尖锐重锯齿，先端长渐尖。花金黄色。',
  'chaenomeles speciosa|皱皮木瓜|shrub|c:spreading l:oval a:alt m:t f:cup/5 i:cluster b:red ld:3|俗称贴梗海棠。花梗极短，花朵像贴在枝条上。枝上有刺，托叶大而呈肾形。',
  'cercis chinensis|紫荆|shrub|c:upright l:heart a:alt m:s f:pea/5 i:cluster b:magenta ld:3 w:1.2|花先叶开放，成簇直接生在老枝甚至主干上。叶近圆形，基部心形，全缘。',
  'punica granatum|石榴|shrub|c:upright l:lanceolate a:opp m:s f:cup/6 i:solitary b:red fr:pome/coral|花萼厚而肉质，红色，宿存在果实顶端。叶对生或簇生，新叶常带红色。',
  'buxus sinica|黄杨|shrub|c:rounded l:oval a:opp m:s i:none g:forest n:12|叶小而厚，革质，对生，先端圆或微凹。常修剪成绿篱或球形。',
  'euonymus japonicus|冬青卫矛|shrub|c:rounded l:oval a:opp m:t i:none g:forest fr:capsule/coral n:12|俗称大叶黄杨。叶对生，革质有光泽，边缘有浅钝齿，四季常绿。',
  'ligustrum vicaryi|金叶女贞|shrub|c:rounded l:oval a:opp m:s f:cross/4 i:panicle b:white g:golden n:12|新叶金黄色，老叶转为黄绿。叶对生，全缘。初夏开白色小花，花冠4裂。',
  'berberis thunbergii|日本小檗|shrub|c:rounded l:spoon a:alt m:s f:cup/6 i:cluster b:yellow g:burgundy fr:berry/red n:12|叶倒卵形至匙形，全缘，簇生在短枝上，短枝基部有一枚针刺。校园多见紫叶品种。',
  'sorbaria sorbifolia|珍珠梅|shrub|c:arching l:lanceolate cp:pinnate/13 a:alt m:t f:cup/5 i:panicle b:white ld:3|花蕾圆润洁白如珍珠，组成大型圆锥花序。羽状复叶，小叶边缘有重锯齿。',
  'yucca gloriosa|凤尾丝兰|rosette|l:strap a:bas m:s f:cup/6 i:panicle b:ivory n:14|叶剑形，坚硬，先端有硬刺，密集成莲座状。花葶高大，白色花朵下垂。',
  // Climbers
  'wisteria sinensis|紫藤|shrub|hb:vine l:lanceolate cp:pinnate/9 a:alt m:s f:pea/5 i:pendant b:violet fr:pod/olive ld:3|木质藤本，靠茎缠绕攀援。奇数羽状复叶，小叶7至13枚。蝶形花成串下垂，荚果密生绒毛。',
  'parthenocissus quinquefolia|五叶地锦|shrub|hb:vine l:oval cp:palmate/5 a:alt m:t i:none g:forest fr:berry/violet|掌状复叶有5枚小叶，边缘有粗锯齿。卷须顶端的吸盘能贴住墙面，秋叶变红。',
  'parthenocissus tricuspidata|地锦|shrub|hb:vine l:palmate a:alt m:t i:none g:forest fr:berry/violet|俗称爬山虎。叶通常3浅裂，基部心形；幼枝上的叶有时为3小叶。卷须短，顶端有吸盘。',
  'campsis grandiflora|凌霄|shrub|hb:vine l:oval cp:pinnate/7 a:opp m:t f:trumpet/5 i:cluster b:orange ld:2|靠气生根攀援。羽状复叶对生，小叶边缘有锯齿。花冠漏斗状，橙红色。',
  'ipomoea nil|牵牛|flower|hb:vine l:heart a:alt m:s f:trumpet/5 i:solitary b:blue ct:white ld:2|茎缠绕，叶常3裂，基部心形。花冠漏斗状，清晨开放，中午前后闭合。',
  'ipomoea purpurea|圆叶牵牛|flower|hb:vine l:heart a:alt m:s f:trumpet/5 i:solitary b:violet ct:white ld:2|叶心形，不分裂，这一点可与叶常3裂的牵牛区分。花冠漏斗状。',
  'humulus scandens|葎草|herb|hb:vine l:palmate a:opp m:t i:none|茎和叶柄上有倒钩刺。叶对生，掌状5至7深裂，表面粗糙。',
  // Herbs and bedding plants
  'hosta plantaginea|玉簪|flower|l:heart a:bas m:s f:trumpet/6 i:spike b:white w:1.2 n:8|叶基生，卵状心形，侧脉弧形并近于平行。白色花在傍晚开放，有香气。',
  'hosta ventricosa|紫萼|flower|l:heart a:bas m:s f:trumpet/6 i:spike b:violet w:1.1 n:8|叶基生，卵状心形。花紫色，花被管上部骤然扩大成钟状。',
  'iris tectorum|鸢尾|flower|l:strap a:bas m:s f:iris/6 i:solitary b:violet n:8|外花被片中脉上有一条不整齐的鸡冠状附属物。叶剑形，排成两列，基部互相套叠。',
  'iris lactea|马蔺|flower|l:strap a:bas m:s f:iris/6 i:solitary b:lavender w:.7 n:10|叶条形，坚韧，比鸢尾窄得多，基部叶鞘带红紫色。花浅蓝紫色，花被片较窄。',
  'iris germanica|德国鸢尾|flower|l:strap a:bas m:s f:iris/6 i:solitary b:violet ct:gold n:8|外花被片中脉上有黄色的须毛状附属物。叶剑形，常带粉绿色。',
  'hemerocallis fulva|萱草|flower|l:strap a:bas m:s f:trumpet/6 i:cluster b:orange ct:gold n:9|叶基生，条形，排成两列。花橘红至橘黄色，内花被片下部有“∧”形彩斑，每朵花只开一天。',
  'orychophragmus violaceus|诸葛菜|flower|l:lobed a:alt m:t f:cross/4 i:spike b:violet|俗称二月兰。花瓣4枚排成十字形。下部叶大头羽状分裂，上部叶基部抱茎。',
  'taraxacum mongolicum|蒲公英|flower|l:lobed a:bas m:t f:daisy/24 i:solitary b:yellow ct:yellow h:.7|头状花序全由舌状花组成，单生在中空无叶的花葶顶端。叶和花葶含白色乳汁。',
  'viola philippica|紫花地丁|flower|l:lanceolate a:bas m:t f:cup/5 i:solitary b:violet ct:white h:.62 w:1.3|没有地上茎，叶全部基生，叶柄上部有狭翅。花紫堇色，下方花瓣有细管状的距。',
  'viola prionantha|早开堇菜|flower|l:oval a:bas m:t f:cup/5 i:solitary b:violet ct:white h:.62|叶长圆状卵形，基部微心形或截形，比紫花地丁的叶宽。花期更早。',
  'viola tricolor|三色堇|flower|l:oval a:alt m:t f:cup/5 i:solitary b:violet ct:gold h:.65|一朵花上常有紫、白、黄三种颜色，侧方花瓣基部有须毛。',
  'bellis perennis|雏菊|flower|l:spoon a:bas m:s f:daisy/16 i:solitary b:ivory h:.72 s:.85 n:7|叶基生，匙形。头状花序单生在花葶顶端，外圈是舌状花，中间是黄色管状花。',
  'mentha canadensis|薄荷|herb|l:oval a:opp m:t i:none|茎四棱形，叶对生，揉碎有清凉香气。小花在叶腋处聚成轮伞花序。',
  'echeveria elegans|月影|rosette|l:succulent a:bas i:none g:sage|肥厚的叶片一圈圈排列成紧凑的莲座，叶面有一层白粉。',
  'helianthus annuus|向日葵|flower|l:heart a:alt m:t f:daisy/20 i:solitary b:yellow ct:brown h:1.4 n:3 w:1.1|巨大的“花”其实是头状花序：外圈舌状花不结实，中间密集的管状花结出瘦果。',
  'cosmos bipinnatus|秋英|flower|l:needle a:opp m:s f:daisy/8 i:solitary b:pink h:1.2|俗称波斯菊。叶二回羽状深裂，裂片细如丝线。舌状花通常8枚，先端有浅齿。',
  'tagetes erecta|万寿菊|flower|l:lanceolate cp:pinnate/9 a:opp m:t f:double/20 i:solitary b:orange|叶羽状分裂，裂片边缘有锯齿，揉碎有浓烈气味。头状花序橙黄色。',
  'chrysanthemum morifolium|菊花|flower|l:lobed a:alt m:t f:double/22 i:solitary b:gold|叶羽状浅裂或半裂，背面有白色短柔毛。头状花序的舌状花形态和颜色随品种变化。',
  'rudbeckia hirta|黑心菊|flower|l:lanceolate a:alt m:s f:daisy/13 i:solitary b:gold ct:dark|舌状花金黄色，中央的管状花聚成暗褐色的半球。全株有粗硬毛。',
  'trifolium repens|白车轴草|herb|l:round cp:tri/3 a:bas m:t f:globe/1 i:solitary b:white h:.6|茎匍匐，三出复叶，小叶上常有“V”形白斑。小花聚成球形的头状花序。',
  'oxalis corniculata|酢浆草|herb|l:heart cp:tri/3 a:bas m:s f:cup/5 i:solitary b:yellow h:.6|三枚小叶都是倒心形，傍晚或阴天会向下闭合。花黄色，蒴果长圆柱形，有棱。',
  'potentilla indica|蛇莓|herb|l:oval cp:tri/3 a:bas m:t f:cup/5 i:solitary b:yellow fr:berry/red h:.6|匍匐茎节上生根。三出复叶，小叶边缘有钝锯齿。花黄色，花托在果期膨大成红色。',
  'plantago asiatica|车前|herb|l:oval a:bas m:s f:ear/0 i:spike b:green h:.7 w:1.2|叶基生成莲座状，宽卵形，有5至7条弧形脉。细长的穗状花序从叶丛中抽出。',
  'capsella bursa-pastoris|荠|herb|l:lobed a:bas m:t f:cross/4 i:spike b:white h:.8|基生叶莲座状，羽状分裂。白色小花4瓣，花后结倒三角形的短角果。',
  'rehmannia glutinosa|地黄|flower|l:oval a:bas m:t f:trumpet/5 i:cluster b:crimson h:.7|全株密生灰白色长柔毛和腺毛。叶多基生，叶面皱缩。花冠筒状，外面紫红色。',
  'sedum sarmentosum|垂盆草|herb|l:succulent a:wh m:s f:star/5 i:cluster b:yellow h:.6|三叶轮生，叶倒披针形，肉质。茎匍匐，节上生根。花黄色，5瓣。',
  'phedimus aizoon|费菜|herb|l:succulent a:alt m:t f:star/5 i:cluster b:yellow|叶肉质，互生，边缘有不整齐的锯齿。聚伞花序顶生，花黄色，5瓣。',
  'portulaca oleracea|马齿苋|herb|l:succulent a:alt m:s f:cup/5 i:solitary b:yellow h:.6|茎平卧，常带紫红色。叶肥厚，倒卵形，形似马齿。',
  'chenopodium album|藜|herb|l:oval a:alt m:t f:ear/0 i:spike b:green|叶菱状卵形，边缘有不整齐的锯齿，叶背常有白色粉粒。',
  'salvia splendens|一串红|flower|l:oval a:opp m:t f:trumpet/5 i:spike b:red|花萼钟形，和花冠同为红色，花谢后仍留在花序上。茎四棱，叶对生。',
  'petunia hybrida|矮牵牛|flower|l:oval a:alt m:s f:trumpet/5 i:solitary b:magenta ct:white h:.7|花冠漏斗状，全株有黏质腺毛。',
  'begonia cucullata|四季秋海棠|flower|l:oval a:alt m:t f:cross/4 i:cluster b:pink g:forest h:.7|叶基部歪斜，两侧不对称，表面有光泽。雌雄同株异花。',
  'tulipa gesneriana|郁金香|flower|l:strap a:bas m:s f:cup/6 i:solitary b:red w:1.5 n:5|叶3至5枚，带粉绿色。花单朵顶生，花被片6枚，排成内外两轮。',
  'glycine max|大豆|herb|l:oval cp:tri/3 a:alt m:s f:pea/5 i:cluster b:lavender fr:pod/olive|三出复叶，茎、叶和荚果上都密生硬毛。',
  // Grasses, bamboo and water plants
  'setaria viridis|狗尾草|grass|l:lanceolate a:bas f:ear/0 i:spike b:green|圆锥花序紧密成圆柱状，小穗基部的刚毛比小穗长，通常绿色或带紫色，使花序毛茸茸的。',
  'triticum aestivum|小麦|grass|l:lanceolate a:bas f:ear/0 i:spike b:gold h:1.2|穗状花序直立，小穗两侧压扁，每节一枚。多数品种的外稃顶端有长芒。',
  'zea mays|玉蜀黍|grass|l:strap a:alt f:ear/0 i:spike b:gold h:1.4 w:1.5 n:6|玉米雌雄同株异花：雄花序生在茎顶，雌花序生在叶腋并被多层苞片包裹，露出须状花柱。',
  'oryza sativa|稻|grass|l:lanceolate a:bas f:ear/0 i:spike b:gold|圆锥花序成熟时下垂，小穗两侧压扁。叶舌膜质，较长。',
  'ophiopogon japonicus|麦冬|grass|l:strap a:bas f:star/6 i:spike b:lavender g:deep h:.7|叶丛生，条形，像一丛深绿色的草。花葶比叶短，种子浆果状，成熟时暗蓝色。',
  'liriope spicata|山麦冬|grass|l:strap a:bas f:star/6 i:spike b:lavender g:deep h:.8|叶丛生，条形。花葶通常长于或近等长于叶，淡紫色小花排成总状花序。',
  'phyllostachys propinqua|早园竹|grass|hb:bamboo l:lanceolate a:alt i:none g:forest|竹秆中空，节间圆筒形。每节分出两枝，一粗一细。',
  'nelumbo nucifera|莲|flower|hb:aquatic l:round a:bas m:s f:double/18 i:solitary b:pink ct:gold fr:cone/meadow|叶柄着生在圆形叶片的中央（盾状着生），叶面不沾水。花托在花后膨大成莲蓬。'
];
const floraAliases = {
  'sophora japonica':'styphnolobium japonicum','magnolia denudata':'yulania denudata',
  'magnolia soulangeana':'yulania soulangeana','magnolia liliiflora':'yulania liliiflora',
  'amygdalus persica':'prunus persica','amygdalus davidiana':'prunus davidiana','amygdalus triloba':'prunus triloba',
  'cerasus yedoensis':'prunus yedoensis','cerasus serrulata':'prunus serrulata','armeniaca vulgaris':'prunus armeniaca',
  'sabina chinensis':'juniperus chinensis','platanus acerifolia':'platanus hispanica',
  'pinus tabulaeformis':'pinus tabuliformis','duchesnea indica':'potentilla indica',
  'pharbitis nil':'ipomoea nil','pharbitis purpurea':'ipomoea purpurea','sedum aizoon':'phedimus aizoon',
  'buxus microphylla':'buxus sinica',
  'mentha haplocalyx':'mentha canadensis',
  'petunia atkinsiana':'petunia hybrida','dendranthema morifolium':'chrysanthemum morifolium'
};
// Genus priors: 'form|traits'. The species model overrides these.
const floraGenera = {
  ginkgo:'tree|c:upright l:fan a:alt i:none g:ginkgo bk:grey',
  pinus:'tree|c:conical l:needle a:alt i:none g:deep fr:cone/brown bk:red',
  picea:'tree|c:conical l:needle a:alt i:none g:bluegreen fr:cone/brown', abies:'tree|c:conical l:needle a:alt i:none g:deep',
  cedrus:'tree|c:conical l:needle a:alt i:none g:bluegreen', larix:'tree|c:conical l:needle a:alt i:none',
  metasequoia:'tree|c:conical l:needle a:opp i:none bk:red', taxodium:'tree|c:conical l:needle a:alt i:none bk:red',
  taxus:'shrub|c:rounded l:needle a:alt i:none g:deep fr:berry/red',
  juniperus:'tree|c:columnar l:scale a:opp i:none g:deep fr:berry/dark bk:red',
  platycladus:'tree|c:conical l:scale a:opp i:none fr:cone/brown bk:red', cupressus:'tree|c:columnar l:scale a:opp i:none g:deep',
  thuja:'tree|c:conical l:scale a:opp i:none', chamaecyparis:'tree|c:conical l:scale a:opp i:none',
  salix:'tree|c:rounded l:lanceolate a:alt m:t i:none', populus:'tree|c:upright l:heart a:alt m:t i:none bk:pale',
  betula:'tree|c:upright l:oval a:alt m:t i:none bk:pale', quercus:'tree|c:rounded l:lobed a:alt i:none fr:berry/brown',
  castanea:'tree|c:rounded l:lanceolate a:alt m:t i:none', ulmus:'tree|c:rounded l:oval a:alt m:t i:none',
  zelkova:'tree|c:spreading l:oval a:alt m:t i:none', celtis:'tree|c:rounded l:oval a:alt m:t i:none',
  morus:'tree|c:rounded l:heart a:alt m:t i:none', ficus:'tree|c:rounded l:oval a:alt m:s i:none g:deep',
  platanus:'tree|c:spreading l:palmate a:alt m:t i:none bk:pale fr:pome/brown',
  acer:'tree|c:rounded l:palmate a:opp m:t i:none fr:samara/olive',
  aesculus:'tree|c:rounded l:lanceolate cp:palmate/7 a:opp m:t f:cup/4 i:panicle b:white',
  fraxinus:'tree|c:rounded l:oval cp:pinnate/7 a:opp m:t i:none fr:samara/olive',
  juglans:'tree|c:rounded l:oval cp:pinnate/9 a:alt i:none', pterocarya:'tree|c:spreading l:lanceolate cp:pinnate/13 a:alt m:t i:none fr:samara/olive',
  ailanthus:'tree|c:upright l:lanceolate cp:pinnate/13 a:alt i:none fr:samara/coral',
  toona:'tree|c:upright l:lanceolate cp:pinnate/13 a:alt i:none', koelreuteria:'tree|c:rounded l:lobed cp:pinnate/9 a:alt m:t f:star/4 i:panicle b:yellow fr:capsule/coral',
  robinia:'tree|c:upright l:oval cp:pinnate/13 a:alt f:pea/5 i:pendant b:white', styphnolobium:'tree|c:rounded l:oval cp:pinnate/11 a:alt f:pea/5 i:panicle b:ivory',
  sophora:'tree|c:rounded l:oval cp:pinnate/11 a:alt f:pea/5 i:panicle b:ivory', gleditsia:'tree|c:spreading l:oval cp:pinnate/13 a:alt i:none fr:pod/brown',
  albizia:'tree|c:spreading l:lanceolate cp:pinnate/13 a:alt f:tuft/14 i:cluster b:pink',
  magnolia:'tree|c:upright l:oval a:alt f:cup/9 i:solitary b:white ld:2', yulania:'tree|c:upright l:oval a:alt f:cup/9 i:solitary b:white ld:3',
  liriodendron:'tree|c:upright l:lobed a:alt f:cup/6 i:solitary b:green ld:1',
  prunus:'tree|c:spreading l:oval a:alt m:t f:cup/5 i:cluster b:pink ld:3', malus:'tree|c:rounded l:oval a:alt m:t f:cup/5 i:cluster b:pink fr:pome/red ld:3',
  pyrus:'tree|c:upright l:oval a:alt m:t f:cup/5 i:cluster b:white ld:3', crataegus:'tree|c:rounded l:lobed a:alt m:t f:cup/5 i:cluster b:white fr:pome/red',
  sorbus:'tree|c:rounded l:lanceolate cp:pinnate/11 a:alt m:t f:cup/5 i:cluster b:white fr:berry/red',
  diospyros:'tree|c:rounded l:oval a:alt i:none fr:pome/orange', ziziphus:'tree|c:upright l:oval a:alt m:t i:none fr:berry/crimson',
  paulownia:'tree|c:spreading l:heart a:opp f:trumpet/5 i:panicle b:lavender', catalpa:'tree|c:rounded l:heart a:opp f:trumpet/5 i:panicle b:white fr:pod/brown',
  tilia:'tree|c:rounded l:heart a:alt m:t i:none', firmiana:'tree|c:rounded l:palmate a:alt i:none bk:green',
  eucommia:'tree|c:rounded l:oval a:alt m:t i:none', broussonetia:'tree|c:spreading l:lobed a:alt m:t i:none',
  cinnamomum:'tree|c:rounded l:oval a:alt i:none g:deep', osmanthus:'shrub|c:rounded l:oval a:opp f:cross/4 i:cluster b:gold g:deep',
  ligustrum:'shrub|c:rounded l:oval a:opp f:cross/4 i:panicle b:white g:forest', syringa:'shrub|c:upright l:heart a:opp f:cross/4 i:panicle b:lavender ld:3',
  forsythia:'shrub|c:arching l:oval a:opp m:t f:cross/4 i:solitary b:yellow ld:3', jasminum:'shrub|c:arching l:oval cp:tri/3 a:opp f:star/6 i:solitary b:yellow',
  rosa:'shrub|c:upright l:oval cp:pinnate/5 a:alt m:t f:double/12 i:solitary b:rose', spiraea:'shrub|c:arching l:lanceolate a:alt m:t f:cup/5 i:cluster b:white ld:3',
  kerria:'shrub|c:arching l:lanceolate a:alt m:t f:cup/5 i:solitary b:gold', chaenomeles:'shrub|c:spreading l:oval a:alt m:t f:cup/5 i:cluster b:red ld:3',
  cotoneaster:'shrub|c:arching l:oval a:alt f:cup/5 i:cluster b:white fr:berry/red', pyracantha:'shrub|c:spreading l:oval a:alt f:cup/5 i:cluster b:white fr:berry/orange',
  photinia:'shrub|c:rounded l:oval a:alt m:t f:cup/5 i:cluster b:white g:copper', sorbaria:'shrub|c:arching l:lanceolate cp:pinnate/13 a:alt m:t f:cup/5 i:panicle b:white',
  hibiscus:'shrub|c:upright l:oval a:alt m:t f:trumpet/5 i:solitary b:rose ct:crimson', lagerstroemia:'shrub|c:upright l:oval a:opp f:cup/6 i:panicle b:magenta bk:pale',
  hydrangea:'shrub|c:rounded l:oval a:opp m:t f:cross/4 i:panicle b:blue ld:3', viburnum:'shrub|c:rounded l:oval a:opp m:t f:cup/5 i:cluster b:white fr:berry/red',
  weigela:'shrub|c:arching l:oval a:opp m:t f:trumpet/5 i:cluster b:rose', lonicera:'shrub|c:spreading l:oval a:opp f:star/5 i:cluster b:ivory fr:berry/red',
  sambucus:'shrub|c:spreading l:lanceolate cp:pinnate/5 a:opp m:t f:star/5 i:panicle b:ivory fr:berry/red',
  deutzia:'shrub|c:arching l:lanceolate a:opp m:t f:cup/5 i:cluster b:white', philadelphus:'shrub|c:arching l:oval a:opp m:t f:cross/4 i:cluster b:white',
  buxus:'shrub|c:rounded l:oval a:opp i:none g:forest n:12', euonymus:'shrub|c:rounded l:oval a:opp m:t i:none g:forest',
  berberis:'shrub|c:rounded l:spoon a:alt f:cup/6 i:cluster b:yellow fr:berry/red', mahonia:'shrub|c:upright l:lanceolate cp:pinnate/9 a:alt m:t f:cup/6 i:spike b:yellow g:deep',
  nandina:'shrub|c:upright l:lanceolate cp:pinnate/9 a:alt f:cup/6 i:panicle b:white fr:berry/red',
  cercis:'shrub|c:upright l:heart a:alt f:pea/5 i:cluster b:magenta ld:3', punica:'shrub|c:upright l:lanceolate a:opp f:cup/6 i:solitary b:red',
  cotinus:'shrub|c:rounded l:round a:alt i:none', rhus:'shrub|c:spreading l:lanceolate cp:pinnate/11 a:alt m:t i:none',
  rhododendron:'shrub|c:rounded l:oval a:alt f:trumpet/5 i:cluster b:magenta g:deep ld:3', camellia:'shrub|c:rounded l:oval a:alt m:t f:double/12 i:solitary b:red g:deep',
  paeonia:'shrub|c:rounded l:lobed cp:tri/3 a:alt f:double/18 i:solitary b:rose', nerium:'shrub|c:upright l:lanceolate a:wh f:cup/5 i:cluster b:rose g:deep',
  gardenia:'shrub|c:rounded l:oval a:opp f:double/12 i:solitary b:white g:deep', lycium:'shrub|c:arching l:lanceolate a:alt f:star/5 i:solitary b:lavender fr:berry/red',
  amorpha:'shrub|c:upright l:oval cp:pinnate/13 a:alt f:ear/0 i:spike b:violet', caragana:'shrub|c:upright l:oval cp:pinnate/9 a:alt f:pea/5 i:solitary b:yellow',
  lespedeza:'shrub|c:arching l:oval cp:tri/3 a:alt f:pea/5 i:cluster b:magenta', yucca:'rosette|l:strap a:bas f:cup/6 i:panicle b:ivory n:14',
  wisteria:'shrub|hb:vine l:lanceolate cp:pinnate/9 a:alt f:pea/5 i:pendant b:violet ld:3', parthenocissus:'shrub|hb:vine l:palmate a:alt m:t i:none g:forest',
  campsis:'shrub|hb:vine l:oval cp:pinnate/7 a:opp m:t f:trumpet/5 i:cluster b:orange', vitis:'shrub|hb:vine l:palmate a:alt m:t i:none fr:berry/violet',
  hedera:'shrub|hb:vine l:palmate a:alt i:none g:deep', clematis:'shrub|hb:vine l:oval cp:tri/3 a:opp f:cup/6 i:solitary b:violet',
  ipomoea:'flower|hb:vine l:heart a:alt f:trumpet/5 i:solitary b:blue ct:white', calystegia:'flower|hb:vine l:lanceolate a:alt f:trumpet/5 i:solitary b:pink ct:white',
  convolvulus:'flower|hb:vine l:lanceolate a:alt f:trumpet/5 i:solitary b:pink ct:white', humulus:'herb|hb:vine l:palmate a:opp m:t i:none',
  phyllostachys:'grass|hb:bamboo l:lanceolate a:alt i:none g:forest', bambusa:'grass|hb:bamboo l:lanceolate a:alt i:none g:forest',
  pleioblastus:'grass|hb:bamboo l:lanceolate a:alt i:none g:forest', indocalamus:'grass|hb:bamboo l:lanceolate a:alt i:none g:forest w:1.4',
  nelumbo:'flower|hb:aquatic l:round a:bas f:double/18 i:solitary b:pink ct:gold fr:cone/meadow', nymphaea:'flower|hb:aquatic l:round a:bas f:double/16 i:solitary b:white ct:gold h:.6',
  hosta:'flower|l:heart a:bas f:trumpet/6 i:spike b:lavender n:8', iris:'flower|l:strap a:bas f:iris/6 i:solitary b:violet n:8',
  hemerocallis:'flower|l:strap a:bas f:trumpet/6 i:cluster b:orange ct:gold n:9', lilium:'flower|l:lanceolate a:alt f:trumpet/6 i:cluster b:orange',
  tulipa:'flower|l:strap a:bas f:cup/6 i:solitary b:red w:1.5 n:5', narcissus:'flower|l:strap a:bas f:cup/6 i:solitary b:yellow ct:orange n:6',
  allium:'flower|l:strap a:bas f:globe/1 i:solitary b:lavender n:6', hyacinthus:'flower|l:strap a:bas f:star/6 i:spike b:blue n:6',
  taraxacum:'flower|l:lobed a:bas m:t f:daisy/24 i:solitary b:yellow ct:yellow h:.7', bellis:'flower|l:spoon a:bas f:daisy/16 i:solitary b:ivory',
  viola:'flower|l:heart a:bas m:t f:cup/5 i:solitary b:violet ct:white h:.62', helianthus:'flower|l:heart a:alt m:t f:daisy/20 i:solitary b:yellow ct:brown h:1.3 n:3',
  chrysanthemum:'flower|l:lobed a:alt m:t f:double/20 i:solitary b:gold', cosmos:'flower|l:needle a:opp f:daisy/8 i:solitary b:pink h:1.2',
  tagetes:'flower|l:lanceolate cp:pinnate/9 a:opp m:t f:double/20 i:solitary b:orange', zinnia:'flower|l:oval a:opp f:double/18 i:solitary b:red',
  rudbeckia:'flower|l:lanceolate a:alt f:daisy/13 i:solitary b:gold ct:dark', echinacea:'flower|l:lanceolate a:alt f:daisy/14 i:solitary b:rose ct:brown',
  coreopsis:'flower|l:lanceolate a:opp f:daisy/8 i:solitary b:gold', erigeron:'flower|l:lanceolate a:alt f:daisy/24 i:cluster b:white',
  aster:'flower|l:lanceolate a:alt f:daisy/18 i:cluster b:lavender', symphyotrichum:'flower|l:lanceolate a:alt f:daisy/18 i:cluster b:lavender',
  ixeris:'flower|l:lanceolate a:bas f:daisy/20 i:cluster b:yellow ct:yellow', sonchus:'flower|l:lobed a:alt m:t f:daisy/24 i:cluster b:yellow ct:yellow',
  cirsium:'flower|l:lobed a:alt m:t f:tuft/16 i:solitary b:magenta', orychophragmus:'flower|l:lobed a:alt m:t f:cross/4 i:spike b:violet',
  brassica:'flower|l:lobed a:alt f:cross/4 i:spike b:yellow', capsella:'herb|l:lobed a:bas m:t f:cross/4 i:spike b:white',
  salvia:'flower|l:oval a:opp m:t f:trumpet/5 i:spike b:violet', mentha:'herb|l:oval a:opp m:t i:none', lavandula:'flower|l:lanceolate a:opp f:ear/0 i:spike b:lavender',
  petunia:'flower|l:oval a:alt f:trumpet/5 i:solitary b:magenta ct:white', begonia:'flower|l:oval a:alt m:t f:cross/4 i:cluster b:pink',
  pelargonium:'flower|l:round a:alt m:t f:cup/5 i:cluster b:red', impatiens:'flower|l:lanceolate a:alt m:t f:cup/5 i:solitary b:rose',
  dianthus:'flower|l:lanceolate a:opp f:cup/5 i:cluster b:rose g:sage',
  papaver:'flower|l:lobed a:alt m:t f:cup/4 i:solitary b:red ct:dark', ranunculus:'flower|l:lobed a:alt f:cup/5 i:solitary b:yellow',
  aquilegia:'flower|l:lobed cp:tri/3 a:alt f:star/5 i:cluster b:violet', delphinium:'flower|l:palmate a:alt f:star/5 i:spike b:blue',
  rehmannia:'flower|l:oval a:bas m:t f:trumpet/5 i:cluster b:crimson h:.7', plantago:'herb|l:oval a:bas f:ear/0 i:spike b:green h:.7',
  trifolium:'herb|l:round cp:tri/3 a:bas f:globe/1 i:solitary b:white h:.6', medicago:'herb|l:oval cp:tri/3 a:alt f:pea/5 i:cluster b:violet',
  oxalis:'herb|l:heart cp:tri/3 a:bas f:cup/5 i:solitary b:yellow h:.6', potentilla:'herb|l:oval cp:palmate/5 a:bas m:t f:cup/5 i:solitary b:yellow h:.6',
  fragaria:'herb|l:oval cp:tri/3 a:bas m:t f:cup/5 i:cluster b:white fr:berry/red h:.6', geranium:'herb|l:palmate a:opp f:cup/5 i:solitary b:rose',
  sedum:'herb|l:succulent a:alt f:star/5 i:cluster b:yellow h:.6', hylotelephium:'herb|l:succulent a:opp m:t f:star/5 i:panicle b:pink',
  phedimus:'herb|l:succulent a:alt m:t f:star/5 i:cluster b:yellow', portulaca:'herb|l:succulent a:alt f:cup/5 i:solitary b:yellow h:.6',
  echeveria:'rosette|l:succulent a:bas i:none g:sage', sempervivum:'rosette|l:succulent a:bas i:none g:sage', aloe:'rosette|l:succulent a:bas i:none g:sage',
  haworthia:'rosette|l:succulent a:bas i:none g:deep', agave:'rosette|l:strap a:bas i:none g:bluegreen n:12',
  chenopodium:'herb|l:oval a:alt m:t f:ear/0 i:spike b:green', amaranthus:'herb|l:oval a:alt f:ear/0 i:spike b:crimson',
  polygonum:'herb|l:lanceolate a:alt f:ear/0 i:spike b:pink', persicaria:'herb|l:lanceolate a:alt f:ear/0 i:spike b:pink', rumex:'herb|l:lanceolate a:bas f:ear/0 i:spike b:green',
  glycine:'herb|l:oval cp:tri/3 a:alt f:pea/5 i:cluster b:lavender fr:pod/olive', vicia:'herb|hb:vine l:oval cp:pinnate/9 a:alt f:pea/5 i:cluster b:violet',
  solanum:'herb|l:oval a:alt f:star/5 i:cluster b:lavender ct:gold fr:berry/red', capsicum:'herb|l:oval a:alt f:star/5 i:solitary b:white fr:pod/red',
  gossypium:'shrub|c:upright l:palmate a:alt f:trumpet/5 i:solitary b:ivory', zea:'grass|l:strap a:alt f:ear/0 i:spike b:gold h:1.4 w:1.5 n:6',
  triticum:'grass|l:lanceolate a:bas f:ear/0 i:spike b:gold h:1.2', hordeum:'grass|l:lanceolate a:bas f:ear/0 i:spike b:gold h:1.1',
  oryza:'grass|l:lanceolate a:bas f:ear/0 i:spike b:gold', sorghum:'grass|l:strap a:alt f:ear/0 i:spike b:crimson h:1.4 w:1.4 n:6',
  setaria:'grass|l:lanceolate a:bas f:ear/0 i:spike b:green', pennisetum:'grass|l:lanceolate a:bas f:ear/0 i:spike b:lavender',
  miscanthus:'grass|l:strap a:bas f:ear/0 i:spike b:ivory h:1.3', phragmites:'grass|l:strap a:alt f:ear/0 i:spike b:lavender h:1.4',
  ophiopogon:'grass|l:strap a:bas f:star/6 i:spike b:lavender g:deep h:.7', liriope:'grass|l:strap a:bas f:star/6 i:spike b:lavender g:deep h:.8',
  carex:'grass|l:lanceolate a:bas i:none', poa:'grass|l:lanceolate a:bas i:none', festuca:'grass|l:lanceolate a:bas i:none g:bluegreen',
  typha:'grass|l:strap a:bas f:ear/0 i:spike b:coral h:1.3'
};
// Family priors, weaker than a genus prior.
const floraFamilies = {
  pinaceae:'tree|c:conical l:needle a:alt i:none g:deep fr:cone/brown', cupressaceae:'tree|c:conical l:scale a:opp i:none g:deep',
  taxaceae:'shrub|c:rounded l:needle a:alt i:none g:deep', ginkgoaceae:'tree|c:upright l:fan a:alt i:none g:ginkgo',
  fagaceae:'tree|c:rounded l:lobed a:alt i:none', betulaceae:'tree|c:upright l:oval a:alt m:t i:none', juglandaceae:'tree|c:rounded l:oval cp:pinnate/9 a:alt i:none',
  salicaceae:'tree|c:rounded l:lanceolate a:alt m:t i:none', ulmaceae:'tree|c:rounded l:oval a:alt m:t i:none', moraceae:'tree|c:rounded l:heart a:alt m:t i:none',
  platanaceae:'tree|c:spreading l:palmate a:alt m:t i:none bk:pale', sapindaceae:'tree|c:rounded l:palmate a:opp i:none fr:samara/olive',
  magnoliaceae:'tree|c:upright l:oval a:alt f:cup/9 i:solitary b:white', lauraceae:'tree|c:rounded l:oval a:alt i:none g:deep',
  simaroubaceae:'tree|c:upright l:lanceolate cp:pinnate/13 a:alt i:none', meliaceae:'tree|c:upright l:lanceolate cp:pinnate/11 a:alt i:none',
  anacardiaceae:'tree|c:rounded l:lanceolate cp:pinnate/9 a:alt i:none', ebenaceae:'tree|c:rounded l:oval a:alt i:none fr:pome/orange',
  paulowniaceae:'tree|c:spreading l:heart a:opp f:trumpet/5 i:panicle b:lavender', bignoniaceae:'tree|c:rounded l:heart a:opp f:trumpet/5 i:cluster b:orange',
  rhamnaceae:'tree|c:upright l:oval a:alt m:t i:none', eucommiaceae:'tree|c:rounded l:oval a:alt m:t i:none',
  rosaceae:'shrub|c:rounded l:oval a:alt m:t f:cup/5 i:cluster b:pink', oleaceae:'shrub|c:rounded l:oval a:opp f:cross/4 i:panicle b:white',
  fabaceae:'herb|l:oval cp:pinnate/7 a:alt f:pea/5 i:cluster b:violet', malvaceae:'shrub|c:upright l:palmate a:alt m:t f:trumpet/5 i:solitary b:rose',
  caprifoliaceae:'shrub|c:spreading l:oval a:opp f:star/5 i:cluster b:ivory', adoxaceae:'shrub|c:rounded l:oval a:opp m:t f:cup/5 i:cluster b:white',
  viburnaceae:'shrub|c:rounded l:oval a:opp m:t f:cup/5 i:cluster b:white', hydrangeaceae:'shrub|c:rounded l:oval a:opp m:t f:cross/4 i:cluster b:white',
  buxaceae:'shrub|c:rounded l:oval a:opp i:none g:forest', celastraceae:'shrub|c:rounded l:oval a:opp m:t i:none g:forest',
  berberidaceae:'shrub|c:rounded l:spoon a:alt f:cup/6 i:cluster b:yellow', lythraceae:'shrub|c:upright l:oval a:opp f:cup/6 i:panicle b:magenta',
  ericaceae:'shrub|c:rounded l:oval a:alt f:trumpet/5 i:cluster b:magenta g:deep', theaceae:'shrub|c:rounded l:oval a:alt m:t f:double/12 i:solitary b:red g:deep',
  paeoniaceae:'shrub|c:rounded l:lobed cp:tri/3 a:alt f:double/18 i:solitary b:rose', vitaceae:'shrub|hb:vine l:palmate a:alt m:t i:none',
  araliaceae:'shrub|hb:vine l:palmate a:alt i:none g:deep', convolvulaceae:'flower|hb:vine l:heart a:alt f:trumpet/5 i:solitary b:pink ct:white',
  cucurbitaceae:'herb|hb:vine l:palmate a:alt f:trumpet/5 i:solitary b:yellow', cannabaceae:'herb|hb:vine l:palmate a:opp m:t i:none',
  asteraceae:'flower|l:lanceolate a:alt m:t f:daisy/16 i:solitary b:yellow', compositae:'flower|l:lanceolate a:alt m:t f:daisy/16 i:solitary b:yellow',
  violaceae:'flower|l:heart a:bas m:t f:cup/5 i:solitary b:violet ct:white h:.62', brassicaceae:'flower|l:lobed a:alt f:cross/4 i:spike b:yellow',
  lamiaceae:'herb|l:oval a:opp m:t f:trumpet/5 i:spike b:lavender', plantaginaceae:'herb|l:oval a:bas f:ear/0 i:spike b:green',
  ranunculaceae:'flower|l:lobed a:alt f:cup/5 i:solitary b:yellow', papaveraceae:'flower|l:lobed a:alt f:cup/4 i:solitary b:red',
  caryophyllaceae:'flower|l:lanceolate a:opp f:cup/5 i:cluster b:pink', geraniaceae:'herb|l:palmate a:opp f:cup/5 i:solitary b:rose',
  oxalidaceae:'herb|l:heart cp:tri/3 a:bas f:cup/5 i:solitary b:yellow h:.6', apiaceae:'herb|l:lanceolate cp:pinnate/9 a:alt f:globe/1 i:cluster b:white',
  solanaceae:'herb|l:oval a:alt f:star/5 i:cluster b:lavender ct:gold', polygonaceae:'herb|l:lanceolate a:alt f:ear/0 i:spike b:pink',
  amaranthaceae:'herb|l:oval a:alt f:ear/0 i:spike b:green', chenopodiaceae:'herb|l:oval a:alt f:ear/0 i:spike b:green',
  portulacaceae:'herb|l:succulent a:alt f:cup/5 i:solitary b:yellow h:.6', crassulaceae:'rosette|l:succulent a:bas i:none g:sage',
  cactaceae:'rosette|l:succulent a:bas i:none g:sage', liliaceae:'flower|l:lanceolate a:alt f:trumpet/6 i:solitary b:orange',
  iridaceae:'flower|l:strap a:bas f:iris/6 i:solitary b:violet n:8', asphodelaceae:'flower|l:strap a:bas f:trumpet/6 i:cluster b:orange n:9',
  amaryllidaceae:'flower|l:strap a:bas f:star/6 i:cluster b:white n:6', asparagaceae:'flower|l:strap a:bas f:star/6 i:spike b:lavender n:8',
  orchidaceae:'flower|l:strap a:bas f:iris/6 i:spike b:magenta n:6', commelinaceae:'herb|l:lanceolate a:alt f:cross/3 i:solitary b:blue',
  nelumbonaceae:'flower|hb:aquatic l:round a:bas f:double/18 i:solitary b:pink ct:gold', nymphaeaceae:'flower|hb:aquatic l:round a:bas f:double/16 i:solitary b:white ct:gold h:.6',
  poaceae:'grass|l:lanceolate a:bas f:ear/0 i:spike b:gold', gramineae:'grass|l:lanceolate a:bas f:ear/0 i:spike b:gold',
  cyperaceae:'grass|l:lanceolate a:bas f:ear/0 i:spike b:coral', juncaceae:'grass|l:lanceolate a:bas i:none', typhaceae:'grass|l:strap a:bas f:ear/0 i:spike b:coral h:1.3'
};
const floraFamilyNames = {
  '银杏科':'ginkgoaceae','松科':'pinaceae','柏科':'cupressaceae','杨柳科':'salicaceae','无患子科':'sapindaceae','蔷薇科':'rosaceae',
  '木樨科':'oleaceae','木犀科':'oleaceae','豆科':'fabaceae','菊科':'asteraceae','唇形科':'lamiaceae','景天科':'crassulaceae','禾本科':'poaceae',
  '莎草科':'cyperaceae','堇菜科':'violaceae','十字花科':'brassicaceae','木兰科':'magnoliaceae','锦葵科':'malvaceae','忍冬科':'caprifoliaceae',
  '鸢尾科':'iridaceae','百合科':'liliaceae','天门冬科':'asparagaceae','葡萄科':'vitaceae','旋花科':'convolvulaceae','芍药科':'paeoniaceae',
  '莲科':'nelumbonaceae','睡莲科':'nymphaeaceae','榆科':'ulmaceae','桑科':'moraceae','壳斗科':'fagaceae','胡桃科':'juglandaceae',
  '悬铃木科':'platanaceae','柿科':'ebenaceae','苦木科':'simaroubaceae','黄杨科':'buxaceae','卫矛科':'celastraceae','小檗科':'berberidaceae',
  '千屈菜科':'lythraceae','车前科':'plantaginaceae','毛茛科':'ranunculaceae','石竹科':'caryophyllaceae','蓼科':'polygonaceae','苋科':'amaranthaceae',
  '茄科':'solanaceae','酢浆草科':'oxalidaceae','伞形科':'apiaceae','紫葳科':'bignoniaceae','泡桐科':'paulowniaceae','阿福花科':'asphodelaceae',
  '石蒜科':'amaryllidaceae','兰科':'orchidaceae'
};
const floraIndex = new Map(floraSpecies.map(line=>[line.slice(0,line.indexOf('|')),line]));
const floraParsed = new Map();
function floraKey(latin){
  return String(latin||'').toLowerCase().replace(/[×✕]/g,' ').replace(/\s+x\s+/g,' ').trim().split(/\s+/).slice(0,2).join(' ');
}
function floraEntry(level,key,line){
  const id=level+'/'+key;
  if(floraParsed.has(id))return floraParsed.get(id);
  const parts=line.split('|');
  const entry=level==='species'
    ?{level,key,name:parts[1],form:parts[2],...floraParse(parts[3]),fact:parts[4]}
    :{level,key,form:parts[0],...floraParse(parts[1])};
  if(!Object.hasOwn(plantProfiles,entry.form))throw Error('flora form '+id);
  floraParsed.set(id,entry);return entry;
}
// Find the most specific prior for a botanical name.
function floraLookup(latin,family){
  let key=floraKey(latin);
  if(Object.hasOwn(floraAliases,key))key=floraAliases[key];
  if(floraIndex.has(key))return floraEntry('species',key,floraIndex.get(key));
  const genus=key.split(' ')[0];
  if(genus&&Object.hasOwn(floraGenera,genus))return floraEntry('genus',genus,floraGenera[genus]);
  let fam=String(family||'').trim();
  fam=Object.hasOwn(floraFamilyNames,fam)?floraFamilyNames[fam]:fam.toLowerCase().split(/\s+/)[0];
  if(fam&&Object.hasOwn(floraFamilies,fam))return floraEntry('family',fam,floraFamilies[fam]);
  return null;
}
const floraFormTraits = {
  tree:{crownShape:'upright',leafShape:'oval',arrangement:'alternate',inflorescence:'none',petals:0},
  shrub:{crownShape:'rounded',leafShape:'oval',arrangement:'alternate',inflorescence:'none',petals:0},
  flower:{crownShape:'upright',leafShape:'oval',arrangement:'alternate',inflorescence:'solitary',petals:7},
  grass:{crownShape:'upright',leafShape:'lanceolate',arrangement:'basal',inflorescence:'none',petals:0},
  rosette:{crownShape:'upright',leafShape:'succulent',arrangement:'basal',inflorescence:'none',petals:0},
  herb:{crownShape:'upright',leafShape:'oval',arrangement:'opposite',inflorescence:'none',petals:0}
};
function floraDefaults(form){
  const [leaf,bloom,height,spread,count]=plantProfiles[form];
  return {form,leaf,bloom,height,spread,count,habit:'upright',leafCompound:'simple',leaflets:5,margin:'smooth',leafAspect:1,
    bloomLoad:2,fruit:'none',bark:floraBark.brown,...floraFormTraits[form]};
}
const floraHex = value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
// Keep only well-formed fields of a stored or freshly generated species model.
function floraModelTraits(model){
  const out={},within=(v,lo,hi)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):undefined;
  for(const field of ['form','habit','leafShape','leafCompound','arrangement','margin','crownShape','flowerShape','inflorescence','fruit']){
    if(floraVocab[field].includes(model[field]))out[field]=model[field];
  }
  for(const field of ['leaf','bloom','center','fruitColor','bark'])if(floraHex(model[field]))out[field]=model[field];
  const numbers={height:[.6,1.4],spread:[.6,1.4],count:[3,14],leafAspect:[.65,1.5],petals:[0,24],leaflets:[3,15],bloomLoad:[1,3]};
  for(const [field,[lo,hi]] of Object.entries(numbers)){
    const value=within(model[field],lo,hi);
    if(value!==undefined)out[field]=['height','spread','leafAspect'].includes(field)?value:Math.round(value);
  }
  if(typeof model.fact==='string'&&model.fact.trim())out.fact=model.fact.trim();
  return out;
}
function plantProfile(plant){
  const prior=floraLookup(plant.latin,plant.family);
  const curated=prior?.level==='species';
  const model=!curated&&plant.model&&Object.hasOwn(plantProfiles,plant.model.form)?floraModelTraits(plant.model):null;
  const form=model?.form??prior?.form??'herb';
  const {level,key,name,...traits}=prior||{};
  // A prior for a different growth form says little about this plant.
  const profile={...floraDefaults(form),...(prior?.form===form?traits:{}),...model,form};
  profile.source=curated?'species':model?'model':prior?prior.level:'form';
  if(curated&&name)profile.name=name;
  if(profile.flowerShape===undefined)profile.flowerShape=profile.petals>=10?'daisy':'cup';
  if(profile.center===undefined)delete profile.center;
  return profile;
}
// Short Chinese labels for the traits that drive the model, for the UI.
function floraTraitLabels(profile){
  const p=profile,labels=[];
  const habit={vine:'藤本',bamboo:'竹类',aquatic:'水生草本'}[p.habit];
  labels.push(habit||{tree:'乔木',shrub:'灌木',flower:'草花',grass:'禾草',rosette:'莲座',herb:'草本'}[p.form]);
  const shapes={oval:'卵形叶',lanceolate:'披针形叶',needle:'针形叶',fan:'扇形叶',palmate:'掌状裂叶',heart:'心形叶',succulent:'肉质叶',
    scale:'鳞形叶',strap:'条形叶',round:'圆形叶',lobed:'羽状裂叶',spoon:'匙形叶'};
  if(p.leafCompound==='pinnate')labels.push('羽状复叶');
  else if(p.leafCompound==='palmate')labels.push('掌状复叶');
  else if(p.leafCompound==='trifoliate')labels.push('三出复叶');
  else labels.push(shapes[p.leafShape]||'单叶');
  labels.push({alternate:'叶互生',opposite:'叶对生',whorled:'叶轮生',basal:'叶基生'}[p.arrangement]);
  if(p.margin==='toothed'&&!['needle','scale','succulent'].includes(p.leafShape))labels.push('叶缘有齿');
  const flowering=p.inflorescence!=='none'&&(p.petals>0||p.flowerShape==='ear');
  if(flowering){
    labels.push({daisy:'头状花序',cup:p.petals+'瓣花',double:'重瓣花',trumpet:'漏斗形花',pea:'蝶形花',cross:p.petals+'瓣十字形花',star:'星形小花',
      iris:'鸢尾形花',tuft:'绒球状花',globe:'球形花序',ear:'穗状花序'}[p.flowerShape]);
    const layout={cluster:'花簇生',spike:'总状或穗状排列',panicle:'圆锥花序',pendant:'花序下垂'}[p.inflorescence];
    if(layout&&!['ear','globe'].includes(p.flowerShape))labels.push(layout);
  }
  const fruit={berry:'浆果状小果',pome:'球形果',pod:'荚果',cone:p.habit==='aquatic'?'莲蓬':'球果',samara:'翅果',capsule:'蒴果'}[p.fruit];
  if(fruit)labels.push(fruit);
  if(p.form==='tree'||p.form==='shrub'){
    const crown={weeping:'枝条下垂',conical:'塔形树冠',columnar:'柱状树冠',arching:'枝条拱垂',spreading:'树冠开展'}[p.crownShape];
    if(crown&&p.habit==='upright')labels.push(crown);
  }
  return labels.filter(Boolean);
}
const floraSourceNames = {species:'校园图鉴株形',model:'AI 物种档案',genus:'属级特征',family:'科级特征',form:'基础株形'};
function plantChineseName(latin){const entry=floraLookup(latin);return entry?.level==='species'?entry.name:null}
function collectedSpeciesKey(latin){
  const key=floraKey(latin);
  if(!/^[a-z][a-z-]+ [a-z][a-z-]+$/.test(key)||/ (sp|spp|cf|aff)$/.test(key))return '';
  return Object.hasOwn(floraAliases,key)?floraAliases[key]:key;
}
const FloraCatalog = {speciesKey:collectedSpeciesKey,lookup:floraLookup,labels:floraTraitLabels,vocab:floraVocab,foliage:floraFoliage,bloom:floraBloom,bark:floraBark,accent:floraAccent,
  sources:floraSourceNames,species:()=>[...floraIndex.keys()],genera:()=>Object.keys(floraGenera),families:()=>Object.keys(floraFamilies),name:plantChineseName,
  isKnownSpecies:key=>floraIndex.has(key)};
globalThis.plantProfile=plantProfile;globalThis.FloraCatalog=FloraCatalog;
const sillExamples=[
  {name:'雏菊',latin:'Bellis perennis',family:'菊科',note:'黄花心周围绕着一圈浅色的小花。'},
  {name:'薄荷',latin:'Mentha canadensis',family:'唇形科',note:'茎上成对生长的叶片，沿枝条向上舒展。'},
  {name:'拟石莲花',latin:'Echeveria elegans',family:'景天科',note:'肥厚的叶片一圈圈排列，形成紧凑的莲座。'}
];
