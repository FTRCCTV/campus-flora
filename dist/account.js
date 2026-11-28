const fileDemo=location.protocol==='file:';
const localEdition=!!document.querySelector('meta[name="flora-local-edition"]');
const localGardenOnly=fileDemo||localEdition;
const gardenAccount={mode:localGardenOnly?'guest':'loading',user:null,records:[],design:GardenLayout.empty(),version:'new'};
let sessionEpoch=0, saveBusy=false;
const accountButton=document.getElementById('account');

function setAccountButton(){
  accountButton.textContent=gardenAccount.user?'我的账号':({loading:'连接中',failed:'重连账号',guest:fileDemo?'离线模式':localEdition?'本机花园':'登录 / 注册'})[gardenAccount.mode];
  accountButton.disabled=gardenAccount.mode==='loading';
}
async function refreshAccount({silent=false}={}){
  if(localGardenOnly||saveBusy)return;
  const epoch=++sessionEpoch,previous=gardenAccount.user?.id;
  try{
    const res=await fetch('/api/account',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data=await res.json();
    if(!res.ok)throw Error(data.error);
    if(epoch!==sessionEpoch)return;
    const changed=previous!==data.user?.id;
    Object.assign(gardenAccount,{mode:data.user?'member':'guest',user:data.user||null,records:data.records||[],design:data.design||GardenLayout.empty(),version:data.version||'new'});
    if(changed&&modal.open)modal.close();
    setAccountButton();route();clearTimeout(refreshAccount.retryTimer);
  }catch{
    if(epoch!==sessionEpoch)return;
    gardenAccount.mode=gardenAccount.user?'failed':'guest';
    if(modal.open)modal.close();
    setAccountButton();route();if(!silent)toast('账号连接失败，正在用本机缓存继续；恢复网络后会自动重连。');
    clearTimeout(refreshAccount.retryTimer);refreshAccount.retryTimer=setTimeout(()=>{if(!saveBusy)refreshAccount({silent:true})},15000);
  }
}
async function saveMemberGarden(update){
  if(saveBusy)throw Error('上一次修改正在同步，请稍后重试。');
  saveBusy=true;++sessionEpoch;
  let reload=false;
  try{
    const list=gardenAccount.records.map(r=>structuredClone(GardenLayout.located(r))),design=structuredClone(gardenAccount.design);update(list,design);
    if(!GardenLayout.valid(list,design))throw Error('物品重叠或位置无效。');
    const response=await fetch('/api/account',{
      method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({owner:gardenAccount.user.id,version:gardenAccount.version,records:list,design}),signal:AbortSignal.timeout(30000)
    });
    const data=await response.json();
    if(!response.ok){reload=response.status===409||response.status===401;throw Error(data.error||'同步失败，修改未保存。')}
    design.seeds=data.seeds??GardenLayout.seedCatalogue(list,design.seeds);
    design.discovered=data.discovered??GardenLayout.discoveries(list,design.discovered);
    gardenAccount.version=data.version;gardenAccount.records=list;gardenAccount.design=design;
  }catch(error){
    if(error instanceof TypeError||error.name==='TimeoutError'){reload=true;throw Error('连接中断，请刷新花园确认保存状态。')}
    throw error;
  }finally{saveBusy=false;if(reload)await refreshAccount()}
}
function loginPanel(register=false){
  const title=register?'创建植迹账号':'登录植迹';
  show('<div class="body accountPanel"><h2>'+title+'</h2><p>用自己的账号，在不同设备上打理同一座花园。</p><form id="gardenLogin" class="authForm"><label>用户名<input id="gardenUsername" name="username" autocomplete="username" required minlength="2" maxlength="24" placeholder="2–24 个字，可用中文"></label><label>密码<input name="password" type="password" autocomplete="'+(register?'new-password':'current-password')+'" minlength="8" maxlength="128" required placeholder="至少 8 个字符"></label>'+(register?'<label>确认密码<input name="confirm" type="password" autocomplete="new-password" required maxlength="128" aria-describedby="authError"></label>':'')+'<p id="authError" role="status"></p><button class="primary">'+(register?'注册并进入花园':'登录')+'</button></form><div class="authOptions"><button class="smallBtn" id="toggleAuth">'+(register?'已有账号，去登录':'创建新账号')+'</button><button class="smallBtn" id="stayLocal">继续游客体验</button></div></div>');
  $('stayLocal').onclick=()=>modal.close();
  $('toggleAuth').onclick=()=>loginPanel(!register);
  const form=$('gardenLogin'),error=$('authError');
  form.onsubmit=async event=>{
    event.preventDefault();
    if(register&&form.elements.password.value!==form.elements.confirm.value){error.textContent='两次输入的密码不一致，请重新确认。';form.elements.confirm.focus();return}
    const button=form.querySelector('button');if(button.disabled)return;
    button.disabled=true;error.textContent='';
    try{
      const res=await fetch('/api/auth/'+(register?'register':'login'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.elements.username.value,password:form.elements.password.value}),signal:AbortSignal.timeout(20000)});
      const data=await res.json();if(!res.ok)throw Error(data.error||'登录失败。');
      await refreshAccount();
      if(!gardenAccount.user)throw Error('登录状态未保存，请在本浏览器允许本站 Cookie 后重试。');
      if(modal.open)modal.close();
      location.hash='garden';toast(register?'账号已创建，欢迎来到你的花园。':'已登录你的花园。');
    }catch(e){error.textContent=e.message||'连接失败，请重试。'}
    finally{button.disabled=false}
  };
}
function passwordPanel(){
  show('<div class="body accountPanel"><h2>修改密码</h2><p>修改后，其他设备需要用新密码重新登录。</p><form id="passwordForm" class="authForm"><label>当前密码<input name="current" type="password" autocomplete="current-password" required maxlength="128"></label><label>新密码<input name="next" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="至少 8 个字符" required></label><label>再次输入新密码<input name="confirm" type="password" autocomplete="new-password" maxlength="128" required></label><p role="status" id="passwordFeedback"></p><button class="primary">保存新密码</button></form><button class="light" id="backToAccount">返回我的账号</button></div>');
  $('backToAccount').onclick=accountPanel;
  const form=$('passwordForm'),feedback=$('passwordFeedback');
  form.onsubmit=async event=>{
    event.preventDefault();
    const {current,next,confirm}=form.elements;
    if(next.value!==confirm.value){feedback.textContent='两次输入的新密码不一致。';confirm.focus();return}
    const button=form.querySelector('button');
    if(button.disabled)return;
    button.disabled=true;feedback.textContent='正在保存…';
    try{
      const response=await fetch('/api/auth/password',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:current.value,newPassword:next.value}),signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'密码修改失败。');
      form.reset();await refreshAccount();
      if(gardenAccount.user){accountPanel();$('accountFeedback').textContent='密码已更新。'}
    }catch(error){feedback.textContent=error.message||'连接失败，请重试。'}
    finally{button.disabled=false}
  };
}
function accountPanel(){
  const {mode,user}=gardenAccount;
  if(mode==='failed'){toast('账号连接已断开，正在重试；期间可继续浏览已缓存的花园。');refreshAccount();return}
  if(mode!=='member'){
    if(!localGardenOnly){loginPanel();return}
    show('<div class="body accountPanel"><h2>本机花园</h2><p>观察手记保存在当前浏览器。在线版支持账号登录与云端花园。</p><a class="primary" target="_top" href="'+hosted+'">打开在线版</a><button class="light" id="stayLocal">继续本机体验</button></div>');
    $('stayLocal').onclick=()=>modal.close();return;
  }
  let guest=[];try{guest=localGarden()}catch{}
  const ids=new Set(gardenAccount.records.map(r=>r.uid));
  const pending=guest.filter(r=>!ids.has(r.uid));
  const guestDesign=localDocument().design;
  const importCount=GardenLayout.discoveries(pending,gardenAccount.design.discovered).length;
  const localDecor=guestDesign.decorations.filter(p=>GardenLayout.unlocked(p.kind,importCount)&&!gardenAccount.design.decorations.some(d=>d.uid===p.uid));
  show('<div class="body accountPanel"><h2>'+esc(user.name)+'</h2><h3>账号花园</h3><p>已保存 '+gardenAccount.records.length+' 条观察。种植、调整和移除均同步到此账号。</p><h3>本机记录</h3><p>'+ (pending.length||localDecor.length?'可导入 '+pending.length+' 条本机观察和 '+localDecor.length+' 件装饰。位置冲突时会自动挪开。':'没有待导入的本机记录。')+'</p><button class="primary" id="importGarden">导入本机花园</button><p role="status" id="accountFeedback"></p><button class="light" id="changePassword">修改密码</button><button class="light" id="endSession">退出账号</button></div>');
  $('changePassword').onclick=passwordPanel;
  $('endSession').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const res=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
      if(!res.ok)throw Error();
      modal.close();await refreshAccount();
    }catch{button.disabled=false;$('accountFeedback').textContent='退出失败，请重试。'}
  };
  const btn=$('importGarden'),feedback=$('accountFeedback');btn.disabled=!pending.length&&!localDecor.length;
  async function mergeRecords(records,trigger,sourceDesign){
    trigger.disabled=true;let added=0;
    try{
      await writeGarden((list,design)=>{
        const existing=new Set(list.map(r=>r.uid)), additions=[];
        for(const source of records){
          const r=structuredClone(source);
          if(existing.has(r.uid))continue;
          r.model=r.model||cachedModel(r.latin);
          const match=list.concat(additions);
          Object.assign(r,GardenLayout.place(r,match.concat(design.decorations),GardenLayout.located(r)));
          additions.push(r);existing.add(r.uid);
        }
        if(sourceDesign){
          const count=GardenLayout.discoveries(list.concat(additions),design.discovered).length;
          if(!list.length&&!design.decorations.length){design.scene=sourceDesign.scene;design.weather=sourceDesign.weather;const effect=sourceDesign.effect||'none';if(GardenLayout.unlocked(effect,count))design.effect=effect}
          for(const p of sourceDesign.decorations){
            if(!GardenLayout.unlocked(p.kind,count)||existing.has(p.uid)||design.decorations.some(d=>d.uid===p.uid))continue;
            const pt=GardenLayout.place(p,list.concat(additions,design.decorations),p);
            design.decorations.push({...p,...pt});
          }
        }
        added=additions.length;list.unshift(...additions);
      });
      route();accountPanel();$('accountFeedback').textContent='已导入 '+added+' 条观察。';
    }catch(e){feedback.textContent=e.message;trigger.disabled=false}
  };
  btn.onclick=()=>mergeRecords(pending,btn,guestDesign);
}
accountButton.onclick=accountPanel;
window.addEventListener('pageshow',e=>{if(e.persisted)refreshAccount({silent:true})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.getElementById('modal').open)refreshAccount({silent:true})});
