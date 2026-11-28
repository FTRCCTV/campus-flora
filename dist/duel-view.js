const duelViewState={angle:.25,flat:false,cell:-1,board:null,pick:null,legal:null,play:false,raf:0,flightStart:0,pointer:null};
function paintDuelView(){
  const v=duelViewState;
  clearTimeout(v.timer);
  if(v.raf)return;
  v.raf=requestAnimationFrame(now=>{
    v.raf=0;
    const canvas=$('duelCanvas');
    if(v.flat||$('duel').hidden||document.hidden||v.visible===false||!canvas.clientWidth)return;
    const still=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const flight=still||!v.flightStart?1:Math.min(1,(now-v.flightStart)/800);
    v.pick=drawDuelTable(canvas,{board:v.board,angle:v.angle,highlight:v.cell,legal:v.legal,flight,phase:still?0:now/1000});
    if(!still&&v.board&&(flight<1||v.board.winner===null))v.timer=setTimeout(paintDuelView,flight<1?16:84);
  });
}
function updateDuelView(board,room,canPlay,card,cards,glide){
  const v=duelViewState;
  const playing=duelState.mode==='online'&&room?.status==='playing';
  $('duelRoomOptions').hidden=!playing;$('duelRoomOptions').setAttribute('aria-expanded',String(!!v.roomOptions));
  if(playing)$('duelLobby').hidden=!v.roomOptions;
  v.board=board;v.play=canPlay;
  const hand=$('duelHand'),mobile=$('duelHandMobile');
  if(mobile.dataset.hand!==hand.dataset.hand){
    mobile.replaceChildren(...Array.from(hand.options,o=>o.cloneNode(true)));mobile.dataset.hand=hand.dataset.hand;
  }
  mobile.value=hand.value;
  v.legal=canPlay?Array.from({length:25},(_,i)=>{try{ButterflyDuel.check(board,card,i);return true}catch{return false}}):null;
  if(glide&&!matchMedia('(prefers-reduced-motion:reduce)').matches)v.flightStart=performance.now();
  else if(!board||board.trail.length<2)v.flightStart=0;
  for(const seat of document.querySelectorAll('.duelScore [data-seat]')){
    const n=Number(seat.dataset.seat);seat.classList.toggle('active',!!board&&board.winner===null&&board.turn===n&&(!room||room.status==='playing'));
    seat.title=room?.seat===n?'你的得分边':ButterflyDuel.sides[n];
  }
  $('duelPrompt').textContent=canPlay?(room?'轮到你了。':'同屏交给 '+(board.turn+1)+'P。')+(card.type==='breaker'?' 选择一个实体阻挡。':' 选好植物，再点一个空格。'):
    room?.status==='playing'?(duelState.busy?'正在提交落子…':'等待花友落子。'):room?.status==='waiting'?'双方入局后开始。':board?.winner!=null?'本局已结束。':'选择一位花友开始。';
  const quick=$('duelQuickCards'),group=cards.slice(0,8);
  const signature=JSON.stringify(group.map(c=>[c.key,c.name,c.type]));
  if(quick.dataset.key!==signature){
    quick.dataset.key=signature;quick.replaceChildren(...group.map(c=>{
      const b=document.createElement('button');b.type='button';b.dataset.key=c.key;
      const symbol=document.createElement('span');symbol.textContent=duelGlyph[c.type];symbol.setAttribute('aria-hidden','true');
      b.append(symbol,document.createTextNode(c.key==='trial'?'破障体验':c.name.replace('演习牌','')));
      b.title=c.name+' · '+duelTypes[c.type][1];b.onclick=()=>{$('duelHand').value=c.key;$('duelHand').dispatchEvent(new Event('change'))};return b;
    }));
  }
  for(const b of quick.children)b.setAttribute('aria-pressed',String(b.dataset.key===card.key));
  paintDuelView();
}
function initDuelView(){
  const v=duelViewState,canvas=$('duelCanvas');
  if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>{v.visible=entry.isIntersecting;if(v.visible)paintDuelView()}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)paintDuelView()});
  $('duelRoomOptions').onclick=()=>{v.roomOptions=!v.roomOptions;renderDuel()};
  $('duelHandMobile').onchange=e=>{$('duelHand').value=e.target.value;$('duelHand').dispatchEvent(new Event('change'))};
  function hit(e){const r=canvas.getBoundingClientRect();return v.pick?.hit(e.clientX-r.left,e.clientY-r.top)??-1}
  function place(i){if(i>=0&&v.play)void duelPlay(false,i)}
  canvas.onpointerdown=e=>{
    if(v.pointer||e.button!==0)return;canvas.setPointerCapture(e.pointerId);
    v.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,angle:v.angle,moved:false};
  };
  canvas.onpointermove=e=>{
    const p=v.pointer;
    if(p&&p.id!==e.pointerId)return;
    if(p){p.moved||=Math.hypot(e.clientX-p.x,e.clientY-p.y)>6;
      if(p.moved){v.angle=p.angle+(e.clientX-p.x)*.009;v.cell=-1;paintDuelView();return}}
    const i=hit(e);if(i!==v.cell){v.cell=i;paintDuelView()}
  };
  canvas.onpointerup=e=>{const p=v.pointer;if(!p||p.id!==e.pointerId)return;v.pointer=null;if(!p.moved)place(hit(e))};
  canvas.onlostpointercapture=canvas.onpointercancel=()=>{v.pointer=null};
  canvas.onpointerleave=()=>{if(!v.pointer){v.cell=-1;paintDuelView()}};
  canvas.onkeydown=e=>{
    const d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-5,ArrowDown:5};
    if(e.key==='Enter'||e.key===' '){e.preventDefault();place(v.cell);return}
    if(!Object.hasOwn(d,e.key))return;e.preventDefault();
    const n=v.cell<0?0:v.cell+d[e.key];if(n>=0&&n<25&&(Math.abs(d[e.key])===5||v.cell<0||Math.floor(n/5)===Math.floor(v.cell/5)))v.cell=n;
    paintDuelView();$('duelInputHint').textContent='已选 '+ButterflyDuel.coord(v.cell)+' · 回车落子';
  };
  $('duelResetView').onclick=()=>{v.angle=.25;v.cell=-1;paintDuelView()};
  $('duelViewMode').onclick=()=>{
    v.flat=!v.flat;canvas.hidden=v.flat;$('duelPlane').hidden=!v.flat;$('duelResetView').hidden=v.flat;
    $('duelViewMode').textContent=v.flat?'立体棋桌':'俯视棋谱';$('duelInputHint').textContent=v.flat?'点选地块落子':'点选地块 · 拖动旋转';paintDuelView();
  };
  new ResizeObserver(paintDuelView).observe(canvas);
}
