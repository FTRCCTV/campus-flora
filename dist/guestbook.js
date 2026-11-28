// Garden guestbook. A classic script (no modules): it renders the shared comment
// board for one friendship edge. friends.js defines socialRequest and app.js
// defines show(), so both are only touched at call time; text is escaped through
// a local helper so nothing here depends on load order beyond those calls.
(function(){
  const maxText=200;
  function escapeText(value){
    const node=document.createElement('span');
    node.textContent=String(value??'');
    return node.innerHTML;
  }
  function stamp(value){
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    const two=number=>String(number).padStart(2,'0');
    return (date.getMonth()+1)+'月'+date.getDate()+'日 '+two(date.getHours())+':'+two(date.getMinutes());
  }
  async function openGardenGuestbook(edgeId,name,back){
    if(typeof socialRequest!=='function'||typeof show!=='function'||typeof $!=='function')return;
    show('<div class="body accountPanel"><h2>'+escapeText(name)+' 的花园留言</h2><p>花友之间可以在这里留一句话，每条最多 200 字。</p><div id="guestbookList"></div><label>写一句留言<textarea id="guestbookText" rows="3" maxlength="200" placeholder="夸夸这株植物，或约一次分株交换。"></textarea></label><p id="guestbookStatus" role="status"></p><button class="primary" id="guestbookSend">发送留言</button><button class="light" id="guestbookClose">关闭</button></div>');
    const list=$('guestbookList'),status=$('guestbookStatus'),input=$('guestbookText'),send=$('guestbookSend');
    const alive=()=>list.isConnected;
    $('guestbookClose').onclick=()=>{
      if(typeof back==='function')back();
      else if(typeof modal!=='undefined')modal.close();
    };
    function render(comments){
      list.textContent='';
      if(!comments.length){
        const empty=document.createElement('p');
        empty.textContent='还没有留言，给花园主人留一句吧。';
        list.append(empty);
        return;
      }
      for(const c of comments){
        const row=document.createElement('div'),head=document.createElement('p'),text=document.createElement('p');
        row.className='friendRow';
        head.textContent=(c.own?'我':c.fromName||'花友')+' · '+stamp(c.date);
        text.textContent=typeof c.text==='string'?c.text:'';
        row.append(head,text);
        list.append(row);
      }
    }
    async function refresh(){
      status.textContent='正在读取留言…';
      try{
        const {comments}=await socialRequest(null,{comments:edgeId});
        if(!alive())return;
        render(Array.isArray(comments)?comments:[]);
        status.textContent='';
      }catch(e){if(alive())status.textContent=e.message}
    }
    async function submit(){
      const value=input.value.trim();
      if(!value){status.textContent='先写一句留言再发送。';return}
      if(value.length>maxText){status.textContent='留言最多 200 字。';return}
      send.disabled=true;
      try{
        await socialRequest({action:'comment',id:edgeId,text:value});
        if(!alive())return;
        input.value='';
        await refresh();
      }catch(e){if(alive())status.textContent=e.message}
      finally{send.disabled=false}
    }
    send.onclick=submit;
    input.onkeydown=event=>{
      if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
        event.preventDefault();
        submit();
      }
    };
    await refresh();
  }
  globalThis.openGardenGuestbook=openGardenGuestbook;
})();
