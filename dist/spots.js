// 校园点位与分布图：把"发现地点"从自由文本变成可以统计的点位。
// 点位为示意坐标（0..1），不追求与真实校园比例一致；地图只用于本项目内展示。
const CampusSpots=(()=>{
  const points=[
    {id:'orchard',name:'果树园',x:.20,y:.20,note:'梨、桃与山楂'},
    {id:'admin',name:'行政楼北',x:.57,y:.14,note:'雪松与圆柏'},
    {id:'yifu',name:'一教门前',x:.42,y:.30,note:'银杏行道树'},
    {id:'library',name:'图书馆东侧',x:.63,y:.34,note:'玉兰与海棠'},
    {id:'greenhouse',name:'温室与试验田',x:.17,y:.44,note:'农作、禾草与苗床'},
    {id:'canteen',name:'三食堂后',x:.80,y:.27,note:'宿根花卉与灌木'},
    {id:'east-gate',name:'东门主路',x:.87,y:.53,note:'毛白杨与榆树'},
    {id:'lake',name:'湖畔步道',x:.30,y:.62,note:'芦苇、香蒲与睡莲'},
    {id:'dorm',name:'宿舍区花坛',x:.72,y:.69,note:'月季与薄荷'},
    {id:'stadium',name:'操场西侧',x:.49,y:.79,note:'草坪与野花'}
  ];
  const byId=new Map(points.map(p=>[p.id,p]));
  const buildings=[
    {x:.34,y:.24,w:.17,h:.11,label:'一教'},{x:.56,y:.28,w:.13,h:.10,label:'图书馆'},
    {x:.50,y:.09,w:.14,h:.08,label:'行政楼'},{x:.12,y:.36,w:.13,h:.10,label:'温室'},
    {x:.74,y:.19,w:.12,h:.09,label:'三食堂'},{x:.64,y:.62,w:.14,h:.10,label:'宿舍'},
    {x:.42,y:.72,w:.18,h:.10,label:'操场'}
  ];
  const formColor={tree:'#4f7a4a',shrub:'#6d8b4f',flower:'#c9637a',grass:'#8aa25c',rosette:'#5f8b6d',herb:'#7a9b52'};
  const formLabel={tree:'乔木',shrub:'灌木',flower:'草花',grass:'禾草',rosette:'莲座',herb:'草本'};

  function spotOf(record){return record&&byId.get(record.spot)||null}
  function label(record){const spot=spotOf(record);return spot?spot.name:(record&&record.location||'')}
  function speciesOf(records){
    const set=new Set();
    for(const record of records||[])if(record&&record.latin)set.add(record.latin);
    return [...set];
  }
  function placeLabel(record){
    const spot=spotOf(record);
    if(spot)return spot.name;
    return record&&record.location?record.location:'未标注地点';
  }
  function summarize(records){
    const groups=new Map();
    for(const record of records||[]){
      if(!record)continue;
      const id=spotOf(record)?.id||'';
      const group=groups.get(id)||{id,count:0,species:new Set(),forms:{}};
      group.count++;
      if(record.latin)group.species.add(record.latin);
      if(record.form)group.forms[record.form]=(group.forms[record.form]||0)+1;
      groups.set(id,group);
    }
    const rows=points.map(spot=>{
      const group=groups.get(spot.id);
      return {...spot,count:group?group.count:0,speciesCount:group?group.species.size:0,forms:group?.forms||{}};
    }).sort((a,b)=>b.count-a.count);
    const loose=groups.get('');
    rows.push({id:'',name:'未标注地点',x:null,y:null,note:'没有选择校园点位',count:loose?loose.count:0,speciesCount:loose?loose.species.size:0,forms:loose?.forms||{}});
    return rows;
  }
  function topForm(forms){
    const entries=Object.entries(forms||{});
    if(!entries.length)return '';
    return entries.sort((a,b)=>b[1]-a[1])[0][0];
  }
  function draw(canvas,records,{selected=''}={}){
    if(!canvas)return;
    const context=canvas.getContext('2d');
    const width=canvas.width,height=canvas.height;
    context.clearRect(0,0,width,height);
    const paper=context.createLinearGradient(0,0,width,height);
    paper.addColorStop(0,'#f7f4e8');paper.addColorStop(1,'#eef0e2');
    context.fillStyle=paper;context.fillRect(0,0,width,height);
    context.strokeStyle='#d9d5c2';context.lineWidth=1;context.strokeRect(.5,.5,width-1,height-1);
    // 草地与水系
    context.fillStyle='#e2e8d2';
    context.beginPath();context.ellipse(width*.5,height*.55,width*.42,height*.34,0,0,Math.PI*2);context.fill();
    context.fillStyle='#c7dbe4';
    context.beginPath();context.ellipse(width*.30,height*.62,width*.10,height*.07,-.2,0,Math.PI*2);context.fill();
    // 道路
    context.strokeStyle='#edead9';context.lineWidth=10;
    context.beginPath();context.moveTo(width*.06,height*.52);context.lineTo(width*.94,height*.52);context.stroke();
    context.beginPath();context.moveTo(width*.5,height*.05);context.lineTo(width*.5,height*.95);context.stroke();
    // Curving pedestrian paths connect the planted areas on the schematic.
    for(const [ink,weight] of [['#cbbf9e',8],['#fff8e6',5]]){
      context.strokeStyle=ink;context.lineWidth=weight;context.beginPath();context.moveTo(width*.06,height*.34);
      context.bezierCurveTo(width*.33,height*.02,width*.20,height*.80,width*.50,height*.78);
      context.bezierCurveTo(width*.66,height*.77,width*.78,height*.40,width*.94,height*.53);context.stroke();
    }
    context.fillStyle='#37584b';context.font='bold 16px sans-serif';context.textAlign='center';context.fillText('↑ N',width-36,35);
    // 建筑
    context.lineWidth=1.4;context.font='600 13px "Microsoft YaHei",system-ui,sans-serif';context.textAlign='center';
    for(const building of buildings){
      const x=building.x*width,y=building.y*height,w=building.w*width,h=building.h*height;
      context.fillStyle='#efe6d6';context.strokeStyle='#c9bda4';
      context.beginPath();context.roundRect?context.roundRect(x,y,w,h,6):context.rect(x,y,w,h);context.fill();context.stroke();
      context.fillStyle='#8b7f68';context.fillText(building.label,x+w/2,y+h/2+4);
    }
    const rows=summarize(records);
    const rowById=new Map(rows.map(row=>[row.id,row]));
    for(const spot of points){
      const row=rowById.get(spot.id)||{count:0,forms:{}};
      const x=spot.x*width,y=spot.y*height;
      const radius=12+Math.min(18,row.count*4);
      const form=topForm(row.forms);
      context.beginPath();context.arc(x,y,radius,0,Math.PI*2);
      context.fillStyle=row.count?(formColor[form]||'#5c7d54'):'#c9cbbd';
      context.globalAlpha=row.count?0.92:0.7;context.fill();context.globalAlpha=1;
      context.strokeStyle=spot.id===selected?'#1f2f26':'#ffffff';context.lineWidth=spot.id===selected?4:2.5;context.stroke();
      if(row.count){
        context.fillStyle='#ffffff';context.font='700 13px "Microsoft YaHei",system-ui,sans-serif';context.textAlign='center';
        context.fillText(String(row.count),x,y+5);
      }
      context.fillStyle='#4c5b48';context.font='600 12px "Microsoft YaHei",system-ui,sans-serif';context.textAlign='center';
      const labelWidth=context.measureText(spot.name).width+12;context.fillStyle=spot.id===selected?'#315b48':'#faf8ef';context.fillRect(x-labelWidth/2,y+radius+2,labelWidth,18);context.fillStyle=spot.id===selected?'white':'#324e41';context.fillText(spot.name,x,y+radius+15);
    }
  }
  function hitTest(canvas,clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return '';
    const x=(clientX-rect.left)/rect.width*canvas.width,y=(clientY-rect.top)/rect.height*canvas.height;
    let best='',distance=34;
    for(const spot of points){
      const dx=x-spot.x*canvas.width,dy=y-spot.y*canvas.height;
      const current=Math.hypot(dx,dy);
      if(current<distance){distance=current;best=spot.id}
    }
    return best;
  }
  return {points,byId,spotOf,label,placeLabel,speciesOf,summarize,topForm,draw,hitTest,formLabel};
})();
globalThis.CampusSpots=CampusSpots;

function openCampusMap(){
  const records=readGarden();
  const rows=CampusSpots.summarize(records);
  const total=records.length,species=CampusSpots.speciesOf(records).length,covered=rows.filter(row=>row.id&&row.count).length;
  show('<div class="body campusMapPanel"><div class="eyebrow">CAMPUS MAP</div><h2>校园植物地图</h2><p>手记里的记录按发现点位汇总。底层是示意图，不代表真实比例。</p><canvas id="campusCanvas" width="800" height="600" role="img" aria-label="校园植物点位示意图，圆点大小表示记录数量"></canvas><p id="campusHint" class="campusHint" role="status">共 '+total+' 条记录 · '+species+' 个物种 · 覆盖 '+covered+' 个点位。点圆点或下面的点位查看记录。</p><div id="campusSpotRows" class="campusSpotRows"></div><div id="campusRecords"></div></div>');
  const canvas=$('campusCanvas');
  let selected=null;
  const paint=()=>{
    for(const item of $('campusSpotRows').children)item.setAttribute('aria-pressed',String(item.dataset.spot===selected));
    CampusSpots.draw(canvas,records,{selected});
    const box=$('campusRecords');
    if(selected===null){box.innerHTML='';return}
    const list=records.filter(record=>(CampusSpots.spotOf(record)?.id||'')===selected);
    const row=rows.find(item=>item.id===selected);
    box.innerHTML='<h3>'+esc(row?row.name:'点位')+' · '+list.length+' 条</h3>';
    if(!list.length){box.append('这个点位还没有记录。');return}
    for(const record of list)box.append(thumbButton(record,()=>detail(record),CampusSpots.placeLabel(record)));
  };
  canvas.addEventListener('click',event=>{
    const hit=CampusSpots.hitTest(canvas,event.clientX,event.clientY);
    if(!hit)return;
    selected=hit;
    for(const row of $('campusSpotRows').children)row.setAttribute('aria-pressed',String(row.dataset.spot===hit));
    paint();
  });
  canvas.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    const withRecords=rows.filter(row=>row.count);
    if(!withRecords.length)return;
    const index=withRecords.findIndex(row=>row.id===selected);
    selected=(withRecords[(index+1)%withRecords.length]||{}).id||'';
    paint();
  });
  canvas.tabIndex=0;
  const rowBox=$('campusSpotRows'),filter=document.createElement('button');
  filter.type='button';filter.className='light';filter.textContent='只看有记录的点位';filter.setAttribute('aria-pressed','false');
  filter.disabled=!rows.some(row=>row.count);
  const search=document.createElement('input');
  search.type='search';search.placeholder='搜索点位或植物名称';search.setAttribute('aria-label',search.placeholder);
  const toolbar=document.createElement('div');toolbar.className='campusSearch';toolbar.append(search,filter);rowBox.before(toolbar);
  const result=document.createElement('p');result.setAttribute('role','status');rowBox.after(result);
  function applyFilter(){
    const query=search.value.trim().toLowerCase(),observed=filter.getAttribute('aria-pressed')==='true';
    let visible=0;
    for(const item of rowBox.children){
      item.hidden=(observed&&item.dataset.empty==='true')||!item.dataset.key.includes(query);
      if(!item.hidden)visible++;
    }
    result.textContent=visible?'':'没有符合条件的点位，试试其他植物或地点。';
  }
  search.oninput=applyFilter;
  filter.onclick=()=>{const active=filter.getAttribute('aria-pressed')==='false';filter.setAttribute('aria-pressed',String(active));filter.textContent=active?'显示全部点位':'只看有记录的点位';applyFilter()};
  for(const row of rows){
    if(!row.id&&!row.count)continue;
    const button=document.createElement('button');
    button.type='button';button.className='campusSpotRow';button.dataset.empty=String(!row.count);button.dataset.spot=row.id||'';
    button.setAttribute('aria-pressed',String(selected===(row.id||'')));
    const dot=document.createElement('span');dot.className='campusDot';dot.style.background=row.id?(CampusSpots.points.some(spot=>spot.id===row.id)?'#6d8b4f':'#c9cbbd'):'#c9cbbd';
    const name=document.createElement('strong');name.textContent=row.name;
    const meta=document.createElement('small');meta.textContent=row.count?row.count+' 条 · '+row.speciesCount+' 种':'暂无记录';
    if(row.count){const form=CampusSpots.topForm(row.forms);if(form)meta.textContent+=' · 多为'+CampusSpots.formLabel[form]}
    button.dataset.key=[row.name,...records.filter(p=>(CampusSpots.spotOf(p)?.id||'')===row.id).flatMap(p=>[p.name,p.latin])].join(' ').toLowerCase();
    button.append(dot,name,meta);
    button.onclick=()=>{selected=row.id||'';for(const child of rowBox.children)child.setAttribute('aria-pressed',String(child.dataset.spot===selected));paint()};
    rowBox.append(button);
  }
  paint();
}
globalThis.openCampusMap=openCampusMap;
