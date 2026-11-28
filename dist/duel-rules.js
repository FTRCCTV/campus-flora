// The browser uses this engine for same-device games; the Worker owns online turns.
const ButterflyDuel=(()=>{
  const sides=['下边','右边'];
  const types={
    plain:['占地','在空格种下阻挡。'],
    nectar:['花引','花丛可通行。蝴蝶在等长路线中优先飞入相邻花丛，触发一次。'],
    wind:['风播','留下可通行的风种。蝴蝶从这里起飞时，在等长路线中优先朝你的得分边飞一次。'],
    vine:['蔓生','种下阻挡，并向右（1P）或向下（2P）延伸一格；延伸处须为空。'],
    breaker:['破障','选一个已有硬阻挡，破开这一格，使其重新可通行。']
  };
  const basic={key:'basic',name:'草籽',type:'plain'},tool={key:'trial',name:'破土根 · 体验卡',type:'breaker'};
  const standards=Object.freeze(Object.fromEntries(Object.entries({plain:'冬青',nectar:'波斯菊',wind:'蒲公英',vine:'常春藤',breaker:'竹'}).map(([type,name])=>[type,Object.freeze({type,key:type==='plain'?'basic':'standard-'+type,name:name+'（标准）'})])));
  const hard=t=>t?.type==='plain'||t?.type==='vine';
  function neighbors(c){
    const n=[];
    if(c%5<4)n.push(c+1);
    if(c<20)n.push(c+5);
    if(c%5)n.push(c-1);
    if(c>4)n.push(c-5);
    return n;
  }
  function create(random=Math.random){
    const s={cells:Array(25).fill(null),pos:0,round:1,turn:0,actions:0,winner:null,
      plan:[],last:['蝴蝶从 A1 出发。'],trial:[true,true],cool:[{},{}],trail:[0]};
    planFlight(s,random);return s;
  }
  const coord=c=>'ABCDE'[c%5]+(1+Math.floor(c/5));
  function paths(s){
    const dist=Array(25).fill(-1),count=Array(25).fill(0),queue=[];
    if(!hard(s.cells[24])){dist[24]=0;count[24]=1;queue.push(24)}
    for(let i=0;i<queue.length;i++){
      const c=queue[i];
      for(const n of neighbors(c)){
        if(hard(s.cells[n])&&n!==s.pos)continue;
        if(dist[n]===-1){dist[n]=dist[c]+1;queue.push(n)}
        if(dist[n]===dist[c]+1)count[n]+=count[c];
      }
    }
    return {dist,count};
  }
  function pick(list,weights,random){
    let r=random()*list.reduce((sum,c)=>sum+weights(c),0);
    for(const c of list){r-=weights(c);if(r<0)return c}
    return list.at(-1);
  }
  function planFlight(s,random=Math.random){
    if(s.winner!==null){s.forecast=[];s.plan=[];return}
    const {dist,count}=paths(s),prior=s.plan||[];
    if(dist[s.pos]<0){
      const adjacent=neighbors(s.pos),open=adjacent.filter(n=>!hard(s.cells[n]));
      const trapped=!open.length,choices=trapped?adjacent:open;
      const keep=s.wandering&&s.trapped===trapped&&choices.includes(prior[0]);
      s.plan=[keep?prior[0]:pick(choices,()=>1,random)];
      s.forecast=[...s.plan];s.wandering=true;s.trapped=trapped;return;
    }
    const previous=new Map();let cursor=s.pos;
    if(!s.wandering)for(const n of prior){previous.set(cursor,n);cursor=n}
    s.wandering=false;s.trapped=false;s.plan=[];cursor=s.pos;
    while(cursor!==24){
      const steps=neighbors(cursor).filter(n=>dist[n]===dist[cursor]-1);
      const flowers=steps.filter(n=>s.cells[n]?.type==='nectar'),wind=s.cells[cursor];
      const blown=wind?.type==='wind'?cursor+(wind.owner===0?5:1):-1;
      const choices=flowers.length?flowers:steps.includes(blown)?[blown]:steps;
      const next=choices.includes(previous.get(cursor))?previous.get(cursor):pick(choices,n=>count[n],random);
      s.plan.push(next);cursor=next;
    }
    s.forecast=[...s.plan];
  }
  function fly(s,random=Math.random){
    planFlight(s,random);if(!s.plan.length)return;
    const from=s.pos,next=s.plan.shift(),tile=s.cells[from];
    const blown=tile?.type==='wind'?from+(tile.owner===0?5:1):-1;
    const msg=s.wandering?(s.trapped?'四周全封，蝴蝶随机越障一格':'终点路线被封，蝴蝶随机游走'):
      s.cells[next]?.type==='nectar'?'花香引路':next===blown?'风种引路':next<from?'沿最短路绕行':'沿最短路飞行';
    if(!s.wandering&&tile?.type==='wind')s.cells[from]=null;
    if(s.cells[next]?.type==='nectar')s.cells[next]=null;
    s.pos=next;s.trail=[...s.trail.slice(-23),next];s.last.push(msg+' · '+coord(from)+' → '+coord(next));
    if(next>=20||next%5===4)s.winner=next>=20?0:1;
    planFlight(s,random);
  }
  function check(s,card,cell){
    if(s.winner!==null)throw Error('这局已经结束。');
    if(!card)return;
    if(!Object.hasOwn(types,card.type)||!Number.isInteger(cell)||cell<0||cell>=25||cell===s.pos)throw Error('请选择蝴蝶以外的棋格。');
    if(card.key===tool.key&&!s.trial[s.turn])throw Error('本局体验卡已使用。');
    if(card.key!==tool.key&&(s.cool[s.turn][card.type]||0)>s.round)throw Error('该体系下轮恢复。');
    if(card.type==='breaker'?!hard(s.cells[cell]):!!s.cells[cell])throw Error(card.type==='breaker'?'破障需要选中一个实体阻挡。':'这格已经有植物了。');
  }
  function play(s,card,cell,random=Math.random){
    check(s,card,cell);
    const p=s.turn;
    if(s.actions===0)s.last=[];
    if(card){
      const tile={type:card.type,name:card.name,owner:p};
      s.cells[cell]=card.type==='breaker'?null:tile;
      if(card.type==='vine'){
        const n=cell+(p===0?1:5);
        if(neighbors(cell).includes(n)&&n!==s.pos&&!s.cells[n])s.cells[n]={...tile};
      }
      if(card.key===tool.key)s.trial[p]=false;
      else if(card.type!=='plain')s.cool[p][card.type]=s.round+2;
      s.last.push((p+1)+'P '+card.name+' · '+coord(cell));
    }else s.last.push((p+1)+'P 跳过栽种');
    if(++s.actions===2){
      fly(s,random);s.actions=0;
      if(s.winner===null){s.round++;s.turn=(s.round-1)%2}
    }else {s.turn=1-p;planFlight(s,random)}
  }
  return {standards,types,sides,basic,tool,hard,coord,create,check,play,paths,planFlight,fly};
})();
globalThis.ButterflyDuel=ButterflyDuel;
