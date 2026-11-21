const GardenLayout=(()=>{
  const zones=['sill','path'];
  const legacyZones={bench:'sill',shelf:'sill',pond:'path',meadow:'path'};
  const scenes={campus:'校园植物园',terrace:'屋顶露台',courtyard:'中式庭院',starlight:'繁星之夜'};
  const weather={sunny:'晴天',rain:'细雨',snow:'飘雪'};
  const props={bench:'木长椅',lantern:'庭园灯',rock:'景石',arch:'花架拱门',planter:'装饰花槽',terrarium:'玻璃生态箱',worktable:'园艺操作台',plantstand:'三层盆栽架',wateringcan:'珐琅浇水壶',teatable:'庭院茶桌',steppingstones:'苔石步道',fence:'木栅栏',fountain:'双层石泉'};
  const propRadii={bench:.90,lantern:.36,rock:.62,arch:1.03,planter:.55,terrarium:.64,worktable:.84,plantstand:.66,wateringcan:.70,teatable:.48,steppingstones:.76,fence:.80,fountain:.61};
  const empty=()=>({scene:'campus',weather:'sunny',decorations:[]});
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
    return {records:records.map(convert),design:{...design,decorations:design.decorations.map(convert)}};
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
  function clear(p,list){
    return !list.some(q=>{
      if(q.zone!==p.zone||q.uid===p.uid&&p.uid)return false;
      const other=located(q);
      return Math.hypot(other.x-p.x,other.z-p.z)<radius(p)+radius(q)-.00001;
    });
  }
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
    const ids=new Set(),prior=[];
    for(const [index,p] of [...records,...design.decorations].entries()){
      if(!p||!zones.includes(p.zone)||typeof p.uid!=='string'||!p.uid||p.uid.length>400||ids.has(p.uid))return false;
      const decor=index>=records.length;
      if(decor?(!Object.hasOwn(props,p.kind)||Object.keys(p).some(k=>!['uid','kind','zone','x','z','rotation','scale'].includes(k))):('kind' in p))return false;
      if(p.x==null&&p.z==null&&!decor){if(!Number.isInteger(p.slot)||p.slot<0||p.slot>2000)return false}
      else if(![p.x,p.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=160))return false;
      if(decor&&p.scale!==undefined&&(!Number.isFinite(p.scale)||p.scale<.5||p.scale>2))return false;
      if(!decor&&p.potStyle!==undefined&&!['clay','celadon','basalt'].includes(p.potStyle))return false;
      if(decor&&p.rotation!==undefined&&(!Number.isFinite(p.rotation)||Math.abs(p.rotation)>Math.PI*2))return false;
      const positioned=located(p);
      if(!clear(positioned,prior))return false;
      ids.add(p.uid);prior.push(positioned);
    }
    return true;
  }
  return {zones,scenes,weather,props,propRadii,empty,unpack,radius,located,clear,place,valid};
})();
globalThis.GardenLayout=GardenLayout;
