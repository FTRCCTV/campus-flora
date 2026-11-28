let visitingGarden=null;
// query: a friendship-edge id (legacy ?visit=) or an object of search params
// such as {comments:edgeId}. Existing visit calls keep working unchanged.
async function socialRequest(body,query,endpoint='friends'){
  const params=typeof query==='string'?new URLSearchParams({visit:query}):query?new URLSearchParams(query):null;
  const search=params?.toString();
  const response=await fetch('/api/'+endpoint+(search?'?'+search:''),{
    method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,
    credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'好友服务暂不可用。');
  return result;
}
function exitVisit(){
  visitingGarden=null;zone=indoorZone;route();
}
async function openGiftPicker(person,seed){
  const type=seed?'种子':'分株';
  show('<div class="body accountPanel"><h2>送'+type+'给'+esc(person.name)+'</h2><p>'+(seed?'对方可以从幼苗开始养下一代，你的种子品种也会保留。':'原株会留在你的花园。')+'</p><label>选择'+type+'<select id="giftPlant"></select></label><label><input type="checkbox" id="giftWantsReturn"> 希望交换（对方领取时会看到回赠提示）</label><button class="primary" id="sendCutting">确认赠送</button><p id="giftMessage" role="status"></p><button class="light" id="giftBack">返回花友</button></div>');
  const select=$('giftPlant'),send=$('sendCutting'),feedback=$('giftMessage'),wantsReturn=$('giftWantsReturn');
  const choices=seed?(gardenAccount.design.seeds||[]):gardenAccount.records;
  for(const plant of choices)select.add(new Option(plant.name+' · '+(seed?'第 '+plant.generation+' 代':placementName(plant)),seed?GardenLayout.seedKey(plant):plant.uid));
  if(!select.length){send.disabled=true;feedback.textContent=seed?'在植株的生长手记里完成收种后，就能赠送。':'先种下一株植物并保存。'}
  $('giftBack').onclick=()=>friendsPanel();
  send.onclick=async()=>{
    send.disabled=true;
    try{
      const body=seed?{action:'sendSeed',id:person.id,species:select.value}:{action:'send',id:person.id,uid:select.value};
      if(wantsReturn.checked)body.wantsReturn=true;
      await socialRequest(body,null,'gifts');
      if(send.isConnected&&modal.open&&gardenAccount.user)await friendsPanel(type+'已送出，等待对方领取。');
    }catch(e){feedback.textContent=e.message;send.disabled=false}
  };
}
function sharedDetail(plant){
  show('<div class="body"><h2>'+esc(plant.name)+'</h2><i>'+esc(plant.latin)+'</i><canvas class="friendSpecimen" id="friendSpecimen"></canvas><p>'+esc(placementName(plant))+' · '+esc(sizes[plant.size])+'</p></div>');
  portrait($('friendSpecimen'),plant);
}
async function friendsPanel(message='',offer=null){
  if(!gardenAccount.user){accountPanel();return}
  const owner=gardenAccount.user.id;
  show('<div class="body accountPanel"><h2>我的花友</h2><p>同意申请后，双方可以参观彼此的植物和布置。照片、发现地点和手记仅自己可见。</p><form class="authForm" id="friendSearch"><label>好友用户名<input name="friendName" placeholder="输入对方的完整用户名" maxlength="48" required></label><button class="primary">发送好友申请</button></form><p id="socialMessage" role="status"></p><div id="friendList"></div><button class="light" id="refreshFriends">刷新列表</button></div>');
  const list=$('friendList'),status=$('socialMessage'),form=$('friendSearch');
  const active=()=>modal.open&&list.isConnected&&gardenAccount.user?.id===owner;
  status.textContent=message||'正在读取好友列表…';
  $('refreshFriends').onclick=()=>friendsPanel();
  async function submit(body,button,success){
    button.disabled=true;
    try{await socialRequest(body);if(active())await friendsPanel(success)}
    catch(e){if(active()){status.textContent=e.message;button.disabled=false}}
  }
  form.onsubmit=e=>{e.preventDefault();submit({action:'request',name:form.elements.friendName.value},form.querySelector('button'),'申请已发送。')};
  function control(row,label,run){
    const b=document.createElement('button');b.className='smallBtn';b.textContent=label;b.onclick=()=>run(b);row.append(b);
  }
  try{
    const {people}=await socialRequest();if(!active())return;
    const giftBox=document.createElement('section');list.append(giftBox);
    async function giftAction(data,button,success,offer=null){
      button.disabled=true;
      try{
        await socialRequest(data,null,'gifts');
        if(!active())return;
        await refreshAccount();
        if(active())await friendsPanel(success,offer);
      }catch(e){if(active()){status.textContent=e.message;button.disabled=false}}
    }
    async function inbox(){
      try{
        const {gifts}=await socialRequest(null,null,'gifts');if(!active()||!gifts.length)return;
        const title=document.createElement('h3');title.textContent='收到的植物礼物';giftBox.append(title);
        for(const g of gifts){
          const row=document.createElement('div'),label=document.createElement('strong'),area=document.createElement('select');
          row.className='friendRow';label.textContent=g.from+' 赠送的'+g.plant.name+(g.kind==='seed'?'种子 · 第 '+g.plant.generation+' 代':'分株');area.setAttribute('aria-label','领取后种在哪里');
          for(const [key,place] of Object.entries(places))area.add(new Option(place.name,key));
          area.value=g.plant.zone;row.append(label,area);
          if(g.wantsReturn){const hint=document.createElement('em');hint.className='giftExchange';hint.textContent='对方希望交换';row.append(hint)}
          giftBox.append(row);
          control(row,g.kind==='seed'?'领取并播种':'领取并种下',b=>{
            const canvas=document.createElement('canvas');portrait(canvas,g.plant);
            const person=g.wantsReturn?people.find(p=>p.status==='friends'&&p.name===g.from)||null:null;
            giftAction({action:'accept',id:g.id,zone:area.value,cover:canvas.toDataURL('image/jpeg',.82)},b,g.kind==='seed'?'种子已在你的花园中萌发。':'分株已种入你的花园。',person?{person}:null);
          });
          control(row,'婉拒',b=>giftAction({action:'decline',id:g.id},b,'已婉拒这份礼物。'));
        }
      }catch(e){if(active())giftBox.textContent=e.message}
    }
    void inbox();
    if(offer?.person){
      const row=document.createElement('div'),label=document.createElement('strong');row.className='friendRow';
      label.textContent='已收下 '+offer.person.name+' 的礼物，可以回赠一株表示感谢。';
      row.append(label);control(row,'回赠一株',()=>openGiftPicker(offer.person,false));giftBox.append(row);
    }
    status.textContent=message;
    if(!people.length){list.append('还没有花友。输入同学的用户名，邀请对方来逛花园。');return}
    for(const [kind,title] of [['received','收到的申请'],['friends','我的好友'],['sent','已发出的申请']]){
      const group=people.filter(p=>p.status===kind);if(!group.length)continue;
      const h=document.createElement('h3');h.textContent=title;list.append(h);
      for(const p of group){
        const row=document.createElement('div'),name=document.createElement('strong');row.className='friendRow';name.textContent=p.name;row.append(name);list.append(row);
        const mutate=(b,action,msg)=>submit({action,id:p.id},b,msg);
        if(kind==='received'){
          control(row,'同意',b=>mutate(b,'accept','已成为花友。'));
          control(row,'婉拒',b=>mutate(b,'decline','申请已处理。'));
        }else if(kind==='sent')control(row,'撤回',b=>mutate(b,'cancel','已撤回申请。'));
        else{
          control(row,'留言',()=>{
            if(typeof globalThis.openGardenGuestbook==='function')globalThis.openGardenGuestbook(p.id,p.name,()=>friendsPanel());
            else status.textContent='留言功能暂不可用。';
          });
          control(row,'逛花园',async b=>{
            b.disabled=true;
            try{
              const garden=await socialRequest(null,p.id);if(!active())return;
              visitingGarden={...garden,owner,id:p.id};zone=garden.plants[0]?.zone||'sill';
              if(places[zone].room)indoorZone=zone;else outdoorZone=zone;
              modal.close();location.hash='garden';route();
            }catch(e){if(active()){status.textContent=e.message;b.disabled=false}}
          });
          for(const seed of [true,false]){
            const type=seed?'种子':'分株';
            control(row,'赠送'+type,()=>openGiftPicker(p,seed));
          }
          control(row,'解除好友',b=>{if(confirm('解除与「'+p.name+'」的好友关系？双方将无法互访。'))mutate(b,'remove','已解除好友关系。')});
        }
      }
    }
  }catch(e){if(active())status.textContent=e.message}
}
document.getElementById('friends').onclick=()=>friendsPanel();
document.getElementById('backGarden').onclick=exitVisit;
document.getElementById('ng').addEventListener('click',()=>{if(visitingGarden)exitVisit()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&visitingGarden){if(modal.open)modal.close();exitVisit()}});
