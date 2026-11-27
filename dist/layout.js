const GardenLayout=(()=>{
  const zones=['sill','path'];
  const legacyZones={bench:'sill',shelf:'sill',pond:'path',meadow:'path'};
  const scenes={campus:'校园植物园',terrace:'屋顶露台',courtyard:'中式庭院',starlight:'繁星之夜'};
  const weather={sunny:'晴天',rain:'细雨',snow:'飘雪'};
  const props={bench:'木长椅',lantern:'庭园灯',rock:'景石',arch:'花架拱门',planter:'装饰花槽',terrarium:'玻璃生态箱',worktable:'园艺操作台',plantstand:'三层盆栽架',wateringcan:'珐琅浇水壶',teatable:'庭院茶桌',steppingstones:'苔石步道',fence:'木栅栏',fountain:'双层石泉',herbmarker:'黄铜植物铭牌',birdbath:'青瓷鸟浴盆',sundial:'日晷观测台',armillary:'黄铜浑仪'};
  const propRadii={bench:.90,lantern:.36,rock:.62,arch:1.03,planter:.55,terrarium:.64,worktable:.84,plantstand:.66,wateringcan:.70,teatable:.48,steppingstones:.76,fence:.80,fountain:.61,herbmarker:.33,birdbath:.50,sundial:.55,armillary:.59};
  const effects={none:'关闭',petals:'风送花瓣',fireflies:'流萤微光',butterflies:'蝶影花径',prism:'花窗流彩',meteors:'流星天幕',aurora:'极光星图'};
  const rewards=[
    {at:1,id:'herbmarker',label:props.herbmarker},{at:2,id:'petals',label:effects.petals},
    {at:3,id:'birdbath',label:props.birdbath},{at:4,id:'fireflies',label:effects.fireflies},
    {at:5,id:'sundial',label:props.sundial},{at:6,id:'butterflies',label:effects.butterflies},
    {at:8,id:'prism',label:effects.prism},{at:10,id:'armillary',label:props.armillary},
    {at:12,id:'meteors',label:effects.meteors},{at:15,id:'aurora',label:effects.aurora}
  ];
  function discoveries(records,previous=[]){
    const keys=new Set(Array.isArray(previous)?previous:[]);
    for(const p of records){
      const key=globalThis.FloraCatalog.speciesKey(p.latin);
      if(key)keys.add(key);
    }
    return [...keys];
  }
  function unlocked(id,count){return !rewards.some(r=>r.id===id&&count<r.at)}
  // A collected seed variety is reusable and survives removal of its parent plant.
  function carePlan(plant){
    const stage=plant.growth??2,form=plant.model?.form||plant.form;
    const water=stage===0||form==='rosette'?1:2;
    const light=stage===2||form==='flower'||form==='rosette'?2:1;
    return {water,light};
  }
  function tend(plant,action){
    const stage=plant.growth??2;
    if(stage===3&&action==='harvest'){plant.growth=4;return}
    const goals=carePlan(plant),care={water:0,light:0,...plant.care};
    if(stage>=3||!Object.hasOwn(goals,action)||care[action]>=goals[action])throw Error('这项照料已完成。');
    care[action]++;
    if(care.water>=goals.water&&care.light>=goals.light){
      plant.growth=stage+1;delete plant.care;
    }else plant.care=care;
  }
  function seedKey(plant){return globalThis.FloraCatalog.speciesKey(plant.latin)||String(plant.latin).trim().toLowerCase()}
  function seedCatalogue(records,previous=[]){
    const packets=new Map(previous.map(p=>[seedKey(p),p]));
    for(const p of records){
      if(p.growth!==4)continue;
      const key=seedKey(p),generation=p.generation??1;
      if((packets.get(key)?.generation||0)>=generation)continue;
      const packet={name:p.name,latin:p.latin,form:p.form,size:p.size,zone:p.zone,generation};
      for(const field of ['family','palette','model'])if(p[field])packet[field]=p[field];
      packets.set(key,packet);
    }
    return [...packets.values()];
  }
  const empty=()=>({scene:'campus',weather:'sunny',effect:'none',seeds:[],discovered:[],decorations:[]});
  function unpack(value){
    const records=Array.isArray(value)?value:value?.records||[],design=value?.design||empty();
    const all=[...records,...design.decorations],moved=new Map();
    const occupied=all.filter(p=>zones.includes(p.zone)).map(located);
    for(const p of all){
      if(!Object.hasOwn(legacyZones,p.zone))continue;
      const item={...p,zone:legacyZones[p.zone]};
      Object.assign(item,place(item,occupied,located(p)));
      occupied.push(item);moved.set(p,item);
    }
    const convert=p=>moved.get(p)||p;
    return {records:records.map(convert),design:{...design,seeds:seedCatalogue(records,design.seeds),effect:design.effect??'none',discovered:discoveries(records,design.discovered),decorations:design.decorations.map(convert)}};
  }
  function radius(p){
    if(p.kind)return propRadii[p.kind]*(p.scale??1);
    return ((legacyZones[p.zone]||p.zone)==='sill'?{small:.454,medium:.625,large:.867}:{small:.637,medium:1.043,large:1.455})[p.size]||1.043;
  }
  function legacyPoint(n){
    if(!Number.isInteger(n)||n<=0)return {x:0,z:0};
    const side=Math.ceil((Math.sqrt(n+1)-1)/2),length=side*2,offset=(2*side+1)**2-1-n;
    const edge=Math.floor(offset/length),i=offset%length;
    const [x,z]=[[side-i,side],[-side,side-i],[-side+i,-side],[side,-side+i]][edge];
    return {x:x*3,z:z*3};
  }
  function located(p){return Number.isFinite(p.x)&&Number.isFinite(p.z)?p:{...p,...legacyPoint(p.slot)}}

  // Solid components in the same local X/Y/Z units as studioPropFaces.
  // Empty space between these components is available for placement.
  const box=(x,y,z,w,h,d)=>({x,z,lo:y,hi:y+h,hx:w/2,hz:d/2});
  const disk=(x,y,z,r,h)=>({x,z,lo:y,hi:y+h,r});
  const components={
    arch:[],bench:[],worktable:[],plantstand:[],teatable:[],fence:[],
    // These items can themselves be placed in the openings of other furniture.
    rock:[box(0,.015,0,1.2,.345,.9),box(-.09,.36,.015,.86,.21,.64)],
    lantern:[disk(0,0,0,.32,.11),disk(0,.11,0,.19,.54),box(0,.65,0,.46,.48,.46),disk(0,1.13,0,.35,.18),disk(0,1.31,0,.05,.10)],
    planter:[disk(0,0,0,.44,.48),disk(0,.48,0,.48,.094),disk(0,.574,0,.40,.45)],
    terrarium:[box(0,0,0,1.05,.21,.72),box(0,.21,0,1.02,.61,.69),box(0,.82,0,1.03,.29,.69)],
    wateringcan:[disk(-.10,0,0,.26,.53),box(.27,.09,0,.40,.30,.16),box(.52,.36,0,.32,.28,.18)],
    steppingstones:[disk(-.47,.015,.13,.27,.105),disk(0,.015,-.14,.27,.065),disk(.46,.015,.10,.27,.115)],
    herbmarker:[disk(0,0,0,.14,.06),box(0,.05,0,.055,.48,.055),box(0,.50,0,.58,.28,.07)],
    birdbath:[disk(0,0,0,.32,.13),disk(0,.13,0,.13,.47),disk(0,.60,0,.48,.22)],
    armillary:[disk(0,0,0,.38,.14),disk(0,.14,0,.14,.42),disk(0,.56,0,.54,1.07)],
    sundial:[disk(0,0,0,.34,.12),disk(0,.12,0,.17,.51),disk(0,.63,0,.53,.13),box(0,.76,0,.08,.31,.43)],
    fountain:[disk(0,0,0,.607,.205),disk(0,.205,0,.122,.41),disk(0,.61,0,.26,.13),disk(0,.74,0,.037,.12)]
  };
  for(const x of [-.78,.78]){
    components.arch.push(box(x,.01,0,.28,.16,.43));
    for(const z of [-.14,.14])components.arch.push(box(x,.17,z,.106,1.52,.11));
    for(let i=0;i<4;i++)components.arch.push(box(x,.36+i*.3,0,.09,.07,.38));
  }
  components.arch.push(box(0,1.62,0,1.87,.13,.29));
  for(let i=0;i<6;i++)components.arch.push(box(-.85+i*.34,1.76,0,.1,.1,.7));
  for(const x of [-.60,.60]){
    for(const z of [-.16,.16])components.bench.push(box(x,.01,z,.09,.39,.10));
    components.bench.push(box(x,.38,-.19,.07,.45,.075));
  }
  for(let i=0;i<3;i++)components.bench.push(box(0,.39,-.14+i*.14,1.58,.06,.112));
  for(const y of [.65,.81])components.bench.push(box(0,y,-.21,1.58,.085,.07));
  for(const x of [-.63,.63])for(const z of [-.28,.28])components.worktable.push(box(x,0,z,.084,1.02,.084));
  for(let i=0;i<4;i++)components.worktable.push(box(0,.17,-.23+i*.15,1.31,.06,.13));
  components.worktable.push(box(0,.84,.014,1.35,.16,.65),box(0,.994,0,1.48,.075,.76),box(0,1.43,-.28,1.34,.056,.21));
  for(const x of [-.64,.64])components.worktable.push(box(x,1.05,-.30,.055,.49,.06));
  for(const x of [-.32,0])components.worktable.push(disk(x,.233,.07,.135,.207));
  for(const x of [-.40,-.21,-.02])components.worktable.push(disk(x,1.486,-.28,.077,.105));
  components.worktable.push(disk(.31,1.07,-.04,.15,.25),box(-.25,1.069,.01,.38,.065,.24));
  // Short vertical segments follow the sloped legs without boxing in the room underneath.
  function leg(parts,x0,y0,z0,x1,y1,z1,r){
    for(let i=0;i<5;i++){
      const t=(i+.5)/5;
      parts.push(box(x0+(x1-x0)*t,y0+(y1-y0)*i/5,z0+(z1-z0)*t,
        2*r+Math.abs(x1-x0)/5,(y1-y0)/5,2*r+Math.abs(z1-z0)/5));
    }
  }
  for(const x of [-.47,.47])for(const z of [.29,-.31])leg(components.plantstand,x,.02,z,x,1.36,-.28,.035);
  for(let i=0;i<3;i++){
    const y=.25+i*.46,z=.10-i*.14;
    components.plantstand.push(box(0,y,z,1.08,.066,.39),box(0,y+.066,z-.176,1.07,.065,.034));
    for(const x of [-.25,.24])components.plantstand.push(disk(x,y+.068,z,(i===1?.14:.113)*1.32,.22));
  }
  for(let i=0;i<3;i++){
    const a=i*2*Math.PI/3,c=Math.cos(a),s=Math.sin(a);
    leg(components.teatable,.33*c,.01,.33*s,.19*c,.58,.19*s,.05);
  }
  components.teatable.push(disk(0,.55,0,.475,.102),box(0,.649,0,.57,.031,.27),
    disk(-.108,.68,0,.11,.18),box(-.23,.73,0,.12,.10,.08));
  for(const z of [-.078,.078])components.teatable.push(disk(.16,.682,z,.056,.061));
  for(const y of [.19,.57])components.fence.push(box(0,y,-.016,1.59,.073,.074));
  for(let i=0;i<7;i++)components.fence.push(box((i-3)*.242,.012,.03,.139,i===0||i===6?.988:.888,.079));
  for(let i=0;i<10;i++){
    const a=.5*Math.PI+(i+.5)*Math.PI/10;
    components.wateringcan.push(disk(-.39+.19*Math.cos(a),.30+.19*Math.sin(a)-.052,0,.055,.104));
  }
  for(const y of [.112,.49])components.wateringcan.push(box(-.34,y-.026,0,.14,.052,.052));

  const broadProps=Object.fromEntries(Object.entries(components).map(([kind,parts])=>{
    const reach=Math.max(...parts.map(p=>p.r===undefined
      ?Math.hypot(Math.abs(p.x)+p.hx,Math.abs(p.z)+p.hz):Math.hypot(p.x,p.z)+p.r));
    return [kind,Math.max(propRadii[kind],reach)];
  }));
  const broadRadius=item=>item.kind?broadProps[item.kind]*(item.scale??1):radius(item);
  let specimenMeshFactory;
  const plantParts=new Map();
  function setSpecimenMesh(factory){specimenMeshFactory=factory;plantParts.clear()}
  function plantEnvelope(item){
    const indoor=(legacyZones[item.zone]||item.zone)==='sill',model=item.model||{};
    const key=JSON.stringify([indoor,item.growth,item.size,item.potStyle,item.latin,item.family,item.form,model.form,
      model.count,model.height,model.spread,model.leafShape,model.crownShape,model.petals,
      model.arrangement,model.inflorescence,model.margin,model.leafAspect,model.habit,
      model.leafCompound,model.leaflets,model.flowerShape,model.bloomLoad,model.fruit]);
    if(plantParts.has(key))return plantParts.get(key);
    if(!specimenMeshFactory){
      const heights=indoor?{small:1.248,medium:1.608,large:2.008}:{small:1.05,medium:1.72,large:2.4};
      return [disk(0,0,0,radius(item),heights[item.size]||heights.medium)];
    }
    const faces=specimenMeshFactory(item,indoor);
    const bands=[],step=.10;
    // A cylinder per horizontal slice leaves the area below a tree canopy
    // clear. Sample every edge crossing a slice boundary, including long stems.
    function mark(i,x,z){
      const band=bands[i]??={r:0,minX:x,maxX:x,minZ:z,maxZ:z};
      band.r=Math.max(band.r,Math.hypot(x,z));
      band.minX=Math.min(band.minX,x);band.maxX=Math.max(band.maxX,x);
      band.minZ=Math.min(band.minZ,z);band.maxZ=Math.max(band.maxZ,z);
    }
    let top=0;
    for(const {vertices} of faces){
      for(let k=0;k<vertices.length;k++){
        const a=vertices[k],b=vertices[(k+1)%vertices.length];
        top=Math.max(top,a[1]);
        const low=a[1]<=b[1]?a:b,high=a[1]<=b[1]?b:a;
        const first=Math.max(0,Math.floor(low[1]/step)),last=Math.max(0,Math.floor(high[1]/step));
        mark(first,low[0],low[2]);mark(last,high[0],high[2]);
        for(let i=first+1;i<=last;i++){
          const t=(i*step-low[1])/(high[1]-low[1]),x=low[0]+t*(high[0]-low[0]),z=low[2]+t*(high[2]-low[2]);
          mark(i-1,x,z);mark(i,x,z);
        }
      }
    }
    const parts=bands.flatMap((b,i)=>{
      if(!b.r||i*step>=top)return [];
      const h=Math.min(step,top-i*step),slice=disk(0,i*step,0,b.r,h);
      slice.bounds=box((b.minX+b.maxX)/2,i*step,(b.minZ+b.maxZ)/2,
        Math.max(.001,b.maxX-b.minX),h,Math.max(.001,b.maxZ-b.minZ));
      return [slice];
    });
    if(plantParts.size>=96)plantParts.delete(plantParts.keys().next().value);
    plantParts.set(key,parts);return parts;
  }
  function worldParts(item){
    const scale=item.kind?(item.scale??1):1,angle=item.rotation??0,c=Math.cos(angle),s=Math.sin(angle);
    const parts=item.kind?components[item.kind]:plantEnvelope(item);
    const transform=p=>({
      x:item.x+scale*(p.x*c-p.z*s),z:item.z+scale*(p.x*s+p.z*c),
      lo:p.lo*scale,hi:p.hi*scale,r:p.r===undefined?null:p.r*scale,
      hx:(p.hx||0)*scale,hz:(p.hz||0)*scale,c,s
    });
    return parts.map(p=>({...transform(p),bounds:p.bounds&&transform(p.bounds)}));
  }
  const epsilon=.00001;
  function partOverlap(a,b){
    if(a.hi<=b.lo+epsilon||b.hi<=a.lo+epsilon)return false;
    const dx=b.x-a.x,dz=b.z-a.z;
    if(a.r!==null&&b.r!==null)return dx*dx+dz*dz<(a.r+b.r-epsilon)**2;
    if(a.r!==null||b.r!==null){
      const rect=a.r===null?a:b,r=(a.r??b.r)-epsilon;
      const x=Math.max(0,Math.abs(dx*rect.c+dz*rect.s)-rect.hx);
      const z=Math.max(0,Math.abs(-dx*rect.s+dz*rect.c)-rect.hz);
      return x*x+z*z<r*r;
    }
    // Separating axes of two oriented rectangles, with touching faces allowed.
    const c=Math.abs(a.c*b.c+a.s*b.s),s=Math.abs(a.c*b.s-a.s*b.c);
    return Math.abs(dx*a.c+dz*a.s)<a.hx+b.hx*c+b.hz*s-epsilon&&
      Math.abs(-dx*a.s+dz*a.c)<a.hz+b.hz*c+b.hx*s-epsilon&&
      Math.abs(dx*b.c+dz*b.s)<b.hx+a.hx*c+a.hz*s-epsilon&&
      Math.abs(-dx*b.s+dz*b.c)<b.hz+a.hz*c+a.hx*s-epsilon;
  }
  function blocker(p,list){
    let candidate;
    return list.find(q=>{
      if(q.zone!==p.zone||q.uid===p.uid&&p.uid)return false;
      const other=located(q);
      const reach=broadRadius(p)+broadRadius(q)-epsilon;
      if((other.x-p.x)**2+(other.z-p.z)**2>=reach*reach)return false;
      candidate??=worldParts(p);
      const obstacle=worldParts(other);
      return candidate.some(a=>obstacle.some(b=>partOverlap(a,b)&&(!(a.bounds||b.bounds)||partOverlap(a.bounds||a,b.bounds||b))));
    });
  }
  function clear(p,list){return !blocker(p,list)}
  function place(p,list,preferred){
    if(preferred&&Number.isFinite(preferred.x)&&Number.isFinite(preferred.z)&&clear({...p,x:preferred.x,z:preferred.z},list))return {x:preferred.x,z:preferred.z};
    for(let n=0;n<10000;n++){
      const pt=legacyPoint(n);
      if(clear({...p,...pt},list))return pt;
    }
    throw Error('当前区域已满，请选择其他区域。');
  }
  function valid(records,design){
    if(!design||!Object.hasOwn(scenes,design.scene)||!Object.hasOwn(weather,design.weather)||!Array.isArray(design.decorations)||design.decorations.length>300)return false;
    const count=discoveries(records,design.discovered).length,effect=design.effect??'none';
    if(!Object.hasOwn(effects,effect)||!unlocked(effect,count)||design.decorations.some(p=>!unlocked(p?.kind,count)))return false;
    const ids=new Set(),prior=[];
    for(const [index,p] of [...records,...design.decorations].entries()){
      if(!p||!zones.includes(p.zone)||typeof p.uid!=='string'||!p.uid||p.uid.length>400||ids.has(p.uid))return false;
      const decor=index>=records.length;
      if(decor?(!Object.hasOwn(props,p.kind)||Object.keys(p).some(k=>!['uid','kind','zone','x','z','rotation','scale'].includes(k))):('kind' in p))return false;
      if(p.x==null&&p.z==null&&!decor){if(!Number.isInteger(p.slot)||p.slot<0||p.slot>2000)return false}
      else if(![p.x,p.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=160))return false;
      if(decor&&p.scale!==undefined&&(!Number.isFinite(p.scale)||p.scale<.5||p.scale>2))return false;
      if(!decor&&p.potStyle!==undefined&&!['clay','celadon','basalt'].includes(p.potStyle))return false;
      if(p.rotation!==undefined&&(!Number.isFinite(p.rotation)||Math.abs(p.rotation)>Math.PI*2))return false;
      const positioned=located(p);
      if(!clear(positioned,prior))return false;
      ids.add(p.uid);prior.push(positioned);
    }
    return true;
  }
  return {carePlan,tend,seedKey,seedCatalogue,rewards,effects,discoveries,unlocked,zones,scenes,weather,props,propRadii,empty,unpack,radius,located,blocker,clear,place,valid,setSpecimenMesh};
})();
globalThis.GardenLayout=GardenLayout;
