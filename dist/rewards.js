function rewardIllustration(canvas,reward){
  canvas.width=176;canvas.height=104;
  const ctx=canvas.getContext('2d');
  if(Object.hasOwn(GardenLayout.props,reward.id)){
    const project=studioProjection(176,104,.52,1,3.25,.40).project;
    const faces=studioPropFaces(reward.id,false).map(f=>({...f,p:f.vertices.map(project)}));
    const points=faces.flatMap(f=>f.p),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const scale=Math.min(128/(right-left),86/(bottom-top));
    ctx.translate(88,52);ctx.scale(scale,scale);ctx.translate(-(left+right)/2,-(top+bottom)/2);
    for(const f of faces)f.depth=f.p.reduce((sum,p)=>sum+p[2],0)/f.p.length;
    for(const f of faces.sort((a,b)=>a.depth-b.depth)){
      ctx.beginPath();f.p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.closePath();ctx.fillStyle=f.color;ctx.fill();
    }
    return;
  }
  if(['butterflies','prism','meteors','aurora','seedsong','lanternsky'].includes(reward.id)){
    ctx.fillStyle=['meteors','aurora'].includes(reward.id)?'#293951':'#ede7d7';ctx.fillRect(0,0,176,104);
    paintRareEffect(ctx,reward.id,176,104,1.2);return;
  }
  const fire=reward.id==='fireflies';
  for(let i=0;i<12;i++){
    const x=31+(i*43%118),y=17+(i*29%70),s=2+i%4;
    ctx.save();ctx.translate(x,y);ctx.rotate(i*.7);
    ctx.fillStyle=fire?'#ffea98':i%3?'#d1857b':'#ecc0aa';
    ctx.shadowColor='#eec765';ctx.shadowBlur=fire?10:0;
    ctx.beginPath();ctx.ellipse(0,0,fire?s*.65:s*1.5,fire?s*.65:s*.72,0,0,2*Math.PI);ctx.fill();ctx.restore();
  }
}
function renderRewards(design){
  const book=$('rewardBook'),guest=!!visitingGarden;
  book.hidden=guest||!['member','guest'].includes(gardenAccount.mode);
  const count=design.discovered?.length||0;
  const next=GardenLayout.rewards.find(r=>r.at>count);
  $('effectControl').hidden=guest||!GardenLayout.unlocked('petals',count);
  $('effectChoice').disabled=guest||studio.busy;
  for(const select of [$('propChoice'),$('effectChoice')]){
    for(const opt of select.options){
      const reward=GardenLayout.rewards.find(r=>r.id===opt.value);
      if(!reward)continue;
      opt.disabled=count<reward.at;
      opt.textContent=reward.label+(opt.disabled?' · '+reward.at+' 种解锁':'');
    }
  }
  $('effectChoice').value=design.effect||'none';
  if(book.hidden)return;
  $('speciesCount').textContent='已收集 '+count+' 种';
  const meter=$('rewardMeter');meter.max=next?.at||GardenLayout.rewards.at(-1).at;meter.value=Math.min(count,meter.max);
  $('nextReward').textContent=next?'再收集 '+(next.at-count)+' 种，解锁「'+next.label+'」':'全部收集奖励已解锁';
  const shelf=$('rewardShelf');
  if(!shelf.children.length){
    for(const r of GardenLayout.rewards){
      const card=document.createElement('div'),art=document.createElement('canvas'),name=document.createElement('strong'),action=document.createElement('button');
      art.setAttribute('aria-hidden','true');art.classList.toggle('nightSwatch',r.id==='fireflies');rewardIllustration(art,r);
      name.textContent=r.label;action.type='button';action.className='smallBtn';
      action.onclick=()=>{
        if(visitingGarden||studio.busy||!GardenLayout.unlocked(r.id,readDesign().discovered?.length||0))return;
        if(Object.hasOwn(GardenLayout.props,r.id)){
          if(studio.mode!=='edit')setStudioMode('edit');
          $('propChoice').value=r.id;$('addProp').click();
        }else{
          $('effectChoice').value=r.id;$('effectChoice').dispatchEvent(new Event('change'));
        }
      };
      card.append(art,name,action);shelf.append(card);
    }
  }
  GardenLayout.rewards.forEach((r,i)=>{
    const card=shelf.children[i],btn=card.lastElementChild,locked=count<r.at,active=design.effect===r.id;
    card.classList.toggle('locked',locked);btn.disabled=locked||studio.busy||active;
    btn.textContent=locked?r.at+' 种解锁':active?'已启用':Object.hasOwn(GardenLayout.props,r.id)?'摆入花园':'启用动效';
    btn.setAttribute('aria-label',r.label+'，'+btn.textContent);
  });
}
