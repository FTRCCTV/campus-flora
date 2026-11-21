const GardenLayout=(()=>{
  const zones=['sill','bench','shelf','pond','path','meadow'];
  const scenes={campus:'校园植物园',terrace:'屋顶露台',courtyard:'中式庭院'};
  const weather={sunny:'晴天',rain:'细雨',snow:'飘雪'};
  const props={bench:'木长椅',lantern:'庭园灯',rock:'景石',arch:'花架拱门',planter:'装饰花槽'};
  const empty=()=>({scene:'campus',weather:'sunny',decorations:[]});
  function unpack(value){
    return Array.isArray(value)?{records:value,design:empty()}:{records:value?.records||[],design:value?.design||empty()};
  }
  function radius(p){
    if(p.kind)return {bench:.9,lantern:.36,rock:.62,arch:1.03,planter:.55}[p.kind];
    return (zones.indexOf(p.zone)<3?{small:.454,medium:.625,large:.867}:{small:.637,medium:1.043,large:1.455})[p.size]||1.043;
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
      if(decor?(!Object.hasOwn(props,p.kind)||Object.keys(p).some(k=>!['uid','kind','zone','x','z'].includes(k))):('kind' in p))return false;
      if(p.x==null&&p.z==null&&!decor){if(!Number.isInteger(p.slot)||p.slot<0||p.slot>2000)return false}
      else if(![p.x,p.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=160))return false;
      const positioned=located(p);
      if(!clear(positioned,prior))return false;
      ids.add(p.uid);prior.push(positioned);
    }
    return true;
  }
  return {zones,scenes,weather,props,empty,unpack,radius,located,clear,place,valid};
})();
globalThis.GardenLayout=GardenLayout;
