const fileDemo=location.protocol==='file:';
const gardenAccount={mode:fileDemo?'guest':'loading',user:null,records:[],version:'new'};
let sessionEpoch=0, saveBusy=false;
const accountButton=document.getElementById('account');
const loginUrl='/signin-with-chatgpt?return_to='+encodeURIComponent('/#garden');
const logoutUrl='/signout-with-chatgpt?return_to='+encodeURIComponent('/');

function setAccountButton(){
  accountButton.textContent=gardenAccount.user?'我的账号':({loading:'连接中',failed:'重连账号',guest:fileDemo?'离线模式':'登录 / 注册'})[gardenAccount.mode];
  accountButton.disabled=gardenAccount.mode==='loading';
}
async function refreshAccount({silent=false}={}){
  if(fileDemo||saveBusy)return;
  const epoch=++sessionEpoch,previous=gardenAccount.user?.id;
  try{
    const res=await fetch('/api/account',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data=await res.json();
    if(!res.ok)throw Error(data.error);
    if(epoch!==sessionEpoch)return;
    const changed=previous!==data.user?.id;
    Object.assign(gardenAccount,{mode:data.user?'member':'guest',user:data.user||null,records:data.records||[],version:data.version||'new'});
    if(changed&&modal.open)modal.close();
    setAccountButton();route();
  }catch{
    if(epoch!==sessionEpoch)return;
    Object.assign(gardenAccount,{mode:'failed',user:null,records:[],version:'new'});
    if(modal.open)modal.close();
    setAccountButton();route();if(!silent)toast('账号连接失败，请点击「重连账号」。');
  }
}
async function saveMemberGarden(update){
  if(saveBusy)throw Error('上一次修改正在同步，请稍后重试。');
  saveBusy=true;++sessionEpoch;
  let reload=false;
  try{
    const list=structuredClone(gardenAccount.records);update(list);
    const response=await fetch('/api/account',{
      method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({owner:gardenAccount.user.id,version:gardenAccount.version,records:list}),signal:AbortSignal.timeout(30000)
    });
    const data=await response.json();
    if(!response.ok){reload=response.status===409||response.status===401;throw Error(data.error||'同步失败，修改未保存。')}
    gardenAccount.version=data.version;gardenAccount.records=list;
  }catch(error){
    if(error instanceof TypeError||error.name==='TimeoutError'){reload=true;throw Error('连接中断，请刷新花园确认保存状态。')}
    throw error;
  }finally{saveBusy=false;if(reload)await refreshAccount()}
}
function accountPanel(){
  const {mode,user}=gardenAccount;
  if(mode==='failed'){refreshAccount();return}
  if(mode!=='member'){
    const link=fileDemo?hosted:loginUrl;
    show('<div class="body accountPanel"><div class="eyebrow">MY ACCOUNT</div><h2>'+(fileDemo?'本机花园':'登录你的植物园')+'</h2><p>'+(fileDemo?'离线版将手记保存在当前浏览器。在线版支持账号登录与云端花园。':'使用 ChatGPT 账号继续。首次登录会自动开通植迹花园，换设备也可以查看照片和手记。')+'</p><a class="primary" target="_top" href="'+link+'">'+(fileDemo?'打开在线版':'使用 ChatGPT 登录 / 注册')+'</a><button class="light" id="stayLocal">继续本机体验</button></div>');
    $('stayLocal').onclick=()=>modal.close();return;
  }
  let guest=[];try{guest=localGarden()}catch{}
  const ids=new Set(gardenAccount.records.map(r=>r.uid));
  const pending=guest.filter(r=>!ids.has(r.uid));
  show('<div class="body accountPanel"><div class="eyebrow">MY ACCOUNT</div><h2>'+esc(user.name)+'</h2><p>'+esc(user.email)+'</p><h3>账号花园</h3><p>已保存 '+gardenAccount.records.length+' 条观察。种植、调整和移除均同步到此账号。</p><h3>本机记录</h3><p>'+ (pending.length?'可导入 '+pending.length+' 条本机观察。已占用的位置会调整到同一区域的空位。':'没有待导入的本机记录。')+'</p><button class="primary" id="importGarden">导入本机花园</button><p role="status" id="accountFeedback"></p><a class="light" target="_top" href="'+logoutUrl+'">退出账号</a></div>');
  const btn=$('importGarden'),feedback=$('accountFeedback');btn.disabled=!pending.length;
  btn.onclick=async()=>{
    btn.disabled=true;let added=0;
    try{
      await writeGarden(list=>{
        const existing=new Set(list.map(r=>r.uid)), additions=[];
        for(const r of pending){
          if(existing.has(r.uid))continue;
          r.model=cachedModel(r.latin)||r.model;
          const match=list.concat(additions);
          if(match.some(p=>p.zone===r.zone&&p.slot===r.slot))r.slot=nextSlot(match,r.zone);
          additions.push(r);existing.add(r.uid);
        }
        added=additions.length;list.unshift(...additions);
      });
      route();accountPanel();$('accountFeedback').textContent='已导入 '+added+' 条观察。';
    }catch(e){feedback.textContent=e.message;btn.disabled=false}
  };
}
accountButton.onclick=accountPanel;
window.addEventListener('pageshow',e=>{if(e.persisted)refreshAccount({silent:true})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.getElementById('modal').open)refreshAccount({silent:true})});
