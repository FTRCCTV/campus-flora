// 物候日历：用已有的观察日期，按物种排出"哪几个月在校园里见过"。
// 纯函数部分（bySpecies / summarize）可被测试直接调用，渲染只在 openPhenology 里发生。
const Phenology=(()=>{
  const monthNames=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  function monthOf(record){
    if(!record)return 0;
    const raw=String(record.date||'');
    const match=raw.match(/(?:^|\D)(\d{1,2})(?:\D|$)/g);
    if(!match)return 0;
    // 优先解析 ISO/斜杠日期，避免把年份当成月份。
    const parts=raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if(parts){const m=Number(parts[2]);return m>=1&&m<=12?m:0}
    const cn=raw.match(/(\d{1,2})月/);
    if(cn){const m=Number(cn[1]);return m>=1&&m<=12?m:0}
    const tail=raw.match(/[-/.](\d{1,2})(?:\D|$)/);
    if(tail){const m=Number(tail[1]);return m>=1&&m<=12?m:0}
    return 0;
  }
  function bySpecies(records){
    const rows=new Map();
    for(const record of records||[]){
      if(!record||!record.latin)continue;
      const key=record.latin;
      let row=rows.get(key);
      if(!row){
        row={latin:key,name:record.name||record.latin,form:record.form||'herb',months:Array(12).fill(0),count:0,spots:new Set()};
        rows.set(key,row);
      }
      row.count++;
      const month=monthOf(record);
      if(month)row.months[month-1]++;
      const spot=record.spot||record.location;
      if(spot)row.spots.add(spot);
    }
    return [...rows.values()].map(row=>({...row,spots:[...row.spots],months:row.months.slice(),active:row.months.some(Boolean)}))
      .sort((a,b)=>b.count-a.count||b.active-a.active||a.name.localeCompare(b.name,'zh'));
  }
  function summarize(records,{month=new Date().getMonth()+1}={}){
    const rows=bySpecies(records);
    const seen=new Set();
    for(const record of records||[])if(record&&record.latin)seen.add(record.latin);
    const current=rows.filter(row=>row.months[month-1]>0);
    const nearby=rows.filter(row=>row.months[(month)%12]>0||row.months[(month+10)%12]>0);
    return {rows,species:seen.size,records:(records||[]).length,month,current:current.length,nearby:nearby.length,currentRows:current};
  }
  function openPanel(){
    const records=readGarden();
    const summary=summarize(records);
    const header=monthNames.map(name=>'<span'+(monthNames.indexOf(name)+1===summary.month?' class="phenoNow"':'')+'>'+name+'</span>').join('');
    show('<div class="body phenoPanel"><div class="eyebrow">PHENOLOGY</div><h2>校园物候日历</h2><p>用你手记里的观察日期，排出一株植物在校园里被记录到的月份。记录越多，色调越深。</p><p class="phenoSummary" role="status">共 '+summary.records+' 条记录 · '+summary.species+' 个物种 · 本月有记录的物种 '+summary.current+' 个</p><div class="phenoGrid">'+header+'</div><div id="phenoRows"></div><p class="phenoNote">物候不等于花期，它只反映"被记录到"的月份；同一物种多观察几次，日历会更准。</p></div>');
    const rows=$('phenoRows');
    if(!summary.rows.length){
      rows.textContent='还没有带日期的观察记录。种下一株植物后，这里会长出它的季节。';
      return;
    }
    for(const row of summary.rows){
      const line=document.createElement('div');line.className='phenoRow';
      const title=document.createElement('div');title.className='phenoTitle';
      const strong=document.createElement('strong');strong.textContent=row.name;
      const latin=document.createElement('i');latin.textContent=row.latin;
      const count=document.createElement('small');count.textContent=row.count+' 次记录';
      title.append(strong,latin,count);
      const track=document.createElement('div');track.className='phenoTrack';
      const peak=Math.max(1,...row.months);
      for(let index=0;index<12;index++){
        const cell=document.createElement('span');
        cell.className='phenoCell'+(index+1===summary.month?' phenoNow':'');
        const value=row.months[index];
        if(value){
          cell.style.background='rgba(79,122,74,'+(0.25+0.6*value/peak).toFixed(2)+')';
          cell.title=monthNames[index]+' · '+value+' 条记录';
        }
        track.append(cell);
      }
      line.append(title,track);
      rows.append(line);
    }
  }
  return {monthNames,monthOf,bySpecies,summarize,openPanel};
})();
globalThis.Phenology=Phenology;
globalThis.openPhenology=()=>Phenology.openPanel();
