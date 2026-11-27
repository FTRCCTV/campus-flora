// Keep each form's select as its data model and expose one keyboard-friendly picker.
(()=>{
  const fields=new WeakMap(),dirty=new Set();
  let current=null,serial=0,scheduled=false,positionFrame=0;

  function labelText(select){
    const explicit=select.getAttribute('aria-label');
    if(explicit)return explicit;
    const referenced=select.getAttribute('aria-labelledby');
    if(referenced)return referenced.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();
    const label=select.labels?.[0];
    if(!label)return '';
    const parts=[];
    function collect(node){
      if(node.nodeType===3){parts.push(node.textContent);return}
      if(node.nodeType!==1||node.matches('select,button,input,textarea'))return;
      node.childNodes.forEach(collect);
    }
    collect(label);return parts.join('').trim();
  }
  const disabled=o=>o.disabled||o.parentElement?.disabled;
  const visible=o=>!o.hidden&&!o.parentElement?.hidden;
  function update(field){
    const {select,button,caption}=field;
    if(!select.isConnected){if(current===field)close();button.remove();return}
    if(select.nextElementSibling!==button)select.after(button);
    const selected=select.options[select.selectedIndex],name=labelText(select);
    const value=selected?.label||(select.options.length?'请选择':'暂无可选项');
    if(caption.textContent!==value)caption.textContent=value;
    button.setAttribute('aria-label',name?name+'，'+value:value);
    button.title=name?name+' · '+value:value;
    button.disabled=select.matches(':disabled')||!Array.from(select.options).some(o=>visible(o)&&!disabled(o));
    button.hidden=select.hidden||select.style.display==='none';
    if(current===field){
      if(button.hidden||button.disabled||!button.getClientRects().length){close();return}
      drawOptions(field);queuePosition();
    }
  }
  function mark(field){
    if(!field)return;
    dirty.add(field);
    if(!scheduled){
      scheduled=true;
      queueMicrotask(()=>{scheduled=false;const changed=[...dirty];dirty.clear();changed.forEach(update)});
    }
  }
  function enhance(select){
    const existing=fields.get(select);
    if(existing){mark(existing);return}
    const button=document.createElement('button'),caption=document.createElement('span');
    button.type='button';button.className='flora-choice';caption.className='flora-choice-value';
    button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');button.append(caption);
    const id='flora-options-'+(++serial),field={select,button,caption,id,active:-1};
    fields.set(select,field);select.dataset.floraChoice='';select.after(button);
    // Programmatic property assignment does not emit events or DOM mutations.
    for(const key of ['value','selectedIndex']){
      const descriptor=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,key);
      if(!descriptor?.set||Object.hasOwn(select,key))continue;
      Object.defineProperty(select,key,{configurable:true,get:descriptor.get,
        set(value){descriptor.set.call(this,value);mark(field)}});
    }
    button.onclick=()=>current===field?close():open(field);
    button.onkeydown=e=>keyDown(e,field);
    select.addEventListener('change',()=>mark(field));
    select.addEventListener('invalid',e=>{e.preventDefault();button.focus();open(field)});
    update(field);
  }
  function close(){
    const f=current;if(!f)return;current=null;
    f.button.setAttribute('aria-expanded','false');f.button.removeAttribute('aria-controls');
    f.button.removeAttribute('aria-activedescendant');f.menu.remove();f.menu=null;f.keyBuffer='';
  }
  function selectOption(field,index){
    const {select}=field,option=select.options[index];
    if(!option||disabled(option)||!visible(option)||select.matches(':disabled'))return;
    const changed=select.selectedIndex!==index;
    select.selectedIndex=index;close();update(field);
    field.button.focus({preventScroll:true});
    if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))}
  }
  function drawOptions(field){
    const {select,menu}=field,activeBefore=menu.scrollTop;
    const rows=document.createDocumentFragment();let group=null;
    const choices=[];
    Array.from(select.options).forEach((o,index)=>{
      if(!visible(o))return;
      const g=o.parentElement.tagName==='OPTGROUP'?o.parentElement:null;
      if(g&&g!==group){const heading=document.createElement('div');heading.className='flora-choice-heading';heading.textContent=g.label;rows.append(heading)}
      group=g;
      const row=document.createElement('div');row.id=field.id+'-'+index;row.dataset.index=String(index);
      row.setAttribute('role','option');row.setAttribute('aria-selected',String(index===select.selectedIndex));
      row.setAttribute('aria-disabled',String(!!disabled(o)));row.textContent=o.label;rows.append(row);
      if(!disabled(o))choices.push(index);
    });
    field.choices=choices;menu.replaceChildren(rows);
    if(!choices.includes(field.active))field.active=choices.includes(select.selectedIndex)?select.selectedIndex:choices[0]??-1;
    activate(field,field.active,false);menu.scrollTop=activeBefore;
  }
  function activate(field,index,scroll=true){
    const menu=field.menu;
    menu.querySelector('.flora-choice-active')?.classList.remove('flora-choice-active');
    const row=menu.querySelector('[data-index="'+index+'"]');field.active=index;
    if(!row){field.button.removeAttribute('aria-activedescendant');return}
    row.classList.add('flora-choice-active');field.button.setAttribute('aria-activedescendant',row.id);
    if(scroll){
      const delta=row.getBoundingClientRect().top-menu.getBoundingClientRect().top;
      if(delta<4)menu.scrollTop+=delta-4;
      else if(delta+row.offsetHeight>menu.clientHeight-4)menu.scrollTop+=delta+row.offsetHeight-menu.clientHeight+4;
    }
  }
  function place(){
    const f=current;if(!f)return;
    const {button,menu}=f,r=button.getBoundingClientRect(),vv=window.visualViewport;
    const x0=vv?.offsetLeft||0,y0=vv?.offsetTop||0,w=vv?.width||innerWidth,h=vv?.height||innerHeight;
    if(!button.isConnected||!r.width||r.bottom<y0||r.top>y0+h){close();return}
    const below=y0+h-r.bottom-10,above=r.top-y0-10;
    const up=below<Math.min(205,menu.scrollHeight)&&above>below;
    const width=Math.min(w-16,Math.max(r.width,Math.min(290,Math.max(184,f.longest*13+48))));
    menu.style.width=width+'px';menu.style.maxHeight=Math.max(36,Math.min(340,up?above:below))+'px';
    menu.style.left=Math.max(x0+8,Math.min(r.left,x0+w-width-8))+'px';
    menu.style.top=(up?r.top-menu.offsetHeight-4:r.bottom+4)+'px';
  }
  function queuePosition(){
    if(!current||positionFrame)return;
    positionFrame=requestAnimationFrame(()=>{positionFrame=0;place()});
  }
  function open(field){
    if(field.button.disabled||!field.select.isConnected)return;
    close();current=field;
    const {select,button}=field,menu=document.createElement('div');
    field.menu=menu;field.active=select.selectedIndex;
    field.longest=Array.from(select.options).reduce((n,o)=>Math.max(n,o.label.length),0);
    menu.className='flora-choice-list';menu.id=field.id;menu.setAttribute('role','listbox');
    menu.setAttribute('aria-label',labelText(select)||'可选项');
    const portal=button.closest('dialog[open]')||document.body;
    if(typeof menu.showPopover==='function')menu.setAttribute('popover','manual');
    portal.append(menu);if(menu.hasAttribute('popover'))menu.showPopover();
    button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',menu.id);
    drawOptions(field);place();if(current!==field)return;activate(field,field.active);
    menu.addEventListener('mousedown',e=>e.preventDefault());
    menu.onclick=e=>{const row=e.target.closest('[data-index]');if(row)selectOption(field,Number(row.dataset.index))};
  }
  function keyDown(e,field){
    const isOpen=current===field;
    if(e.key==='Escape'&&isOpen){e.preventDefault();e.stopPropagation();close();return}
    if(e.key==='Tab'){if(isOpen)close();return}
    if(['Enter',' '].includes(e.key)){e.preventDefault();if(e.repeat)return;if(isOpen)selectOption(field,field.active);else open(field);return}
    if(e.metaKey||e.ctrlKey||e.isComposing)return;
    const arrows=['ArrowDown','ArrowUp','Home','End'];
    if(!arrows.includes(e.key)&&e.key.length!==1)return;
    e.preventDefault();if(!isOpen)open(field);if(current!==field)return;
    const list=field.choices,index=list.indexOf(field.active);
    if(arrows.includes(e.key)){
      const next=e.key==='Home'?0:e.key==='End'?list.length-1:index+(e.key==='ArrowDown'?1:-1);
      activate(field,list[Math.min(list.length-1,Math.max(0,next))]);return;
    }
    const now=performance.now();field.keyBuffer=(now-(field.typedAt||0)>650?'':field.keyBuffer||'')+e.key.toLocaleLowerCase();
    field.typedAt=now;
    const match=list.find(i=>field.select.options[i].label.toLocaleLowerCase().startsWith(field.keyBuffer));
    if(match!==undefined)activate(field,match);
  }
  function visit(node,callback){
    if(node.nodeType!==1)return;
    if(node.tagName==='SELECT')callback(node);
    else if(!node.matches('.flora-choice,.flora-choice-list')&&!node.closest('.flora-choice-list,.flora-choice'))node.querySelectorAll('select').forEach(callback);
  }
  const observer=new MutationObserver(records=>{
    for(const m of records){
      const el=m.target.nodeType===1?m.target:m.target.parentElement;
      if(!el||el.closest('.flora-choice,.flora-choice-list'))continue;
      const select=el.closest('select');
      if(select){mark(fields.get(select));continue}
      if(m.type==='childList'){
        m.addedNodes.forEach(n=>visit(n,enhance));
        m.removedNodes.forEach(n=>visit(n,s=>mark(fields.get(s))));
      }else if(m.type==='attributes'&&el.tagName==='FIELDSET')el.querySelectorAll('select').forEach(s=>mark(fields.get(s)));
    }
    if(current&&(!current.button.isConnected||!current.button.getClientRects().length))close();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:['disabled','hidden','label','selected','value','aria-label','aria-labelledby','open']});
  document.querySelectorAll('select').forEach(enhance);
  document.addEventListener('pointerdown',e=>{if(current&&!current.menu.contains(e.target)&&!current.button.contains(e.target))close()},true);
  document.addEventListener('focusin',e=>{if(current&&e.target!==current.button&&!current.menu.contains(e.target))close()});
  document.addEventListener('reset',e=>queueMicrotask(()=>e.target.querySelectorAll('select').forEach(s=>mark(fields.get(s)))));
  document.addEventListener('scroll',e=>{if(current&&!current.menu.contains(e.target))queuePosition()},true);
  window.addEventListener('resize',queuePosition);window.visualViewport?.addEventListener('resize',queuePosition);
  window.visualViewport?.addEventListener('scroll',queuePosition);
})();
