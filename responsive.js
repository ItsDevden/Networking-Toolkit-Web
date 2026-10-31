'use strict';
(() => {
 const sidebar = document.getElementById('sidebar');
 const navigation = document.getElementById('navigation');
 const logo = document.getElementById('logo');
 const content = document.getElementById('content');
 const mobile = window.matchMedia('(max-width: 720px)');
 const labels = {
  ipv4:['IPv4','network'],
  ipv6:['IPv6','globe'],
  vlsm:['VLSM','layers'],
  flsm:['FLSM','grid'],
  v6flsm:['v6 FLSM','grid'],
  commands:['Commands','terminal'],
  reference:['Reference','book'],
  troubleshooting:['Troubleshoot','tool'],
  cli:['CLI','server']
 };
 const paths = {
  network:'<circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 11l10-5M7 13l10 5M19 7v10"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6Z"/>',
  tool:'<path d="M14 6a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 3 3l5-5a5 5 0 0 0 6-6l-3 3-3-3 3-3Z"/>',
  server:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 8h.01M7 17h.01M11 8h6M11 17h6"/>'
 };
 const icon = name => `<svg class="nav-symbol" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
 const buttons = Array.from(navigation.querySelectorAll('button[data-key]'));
 buttons.forEach(button => {
  const key = button.dataset.key;
  const name = button.textContent.trim();
  const pair = labels[key] || [name,'grid'];
  button.textContent = '';
  button.insertAdjacentHTML('beforeend',`${icon(pair[1])}<span class="nav-label">${name}</span><span class="nav-short">${pair[0]}</span>`);
  button.setAttribute('aria-label',name);
  button.title = name;
 });
 const backdrop = document.createElement('div');
 backdrop.id = 'mobile-nav-backdrop';
 backdrop.setAttribute('aria-hidden','true');
 document.body.append(backdrop);
 const bar = document.createElement('nav');
 bar.id = 'mobile-tabs';
 bar.setAttribute('aria-label','Mobile quick navigation');
 const primary = ['ipv4','ipv6','vlsm','flsm'];
 primary.forEach(key => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.mobileKey = key;
  btn.innerHTML = icon(labels[key][1]) + `<span>${labels[key][0]}</span>`;
  btn.setAttribute('aria-label',navigation.querySelector(`[data-key="${key}"]`).getAttribute('aria-label'));
  btn.addEventListener('click',() => {
   navigation.querySelector(`[data-key="${key}"]`).click();
   closeMenu();
   window.scrollTo(0,0);
  });
  bar.append(btn);
 });
 const more = document.createElement('button');
 more.type = 'button';
 more.dataset.mobileKey = 'more';
 more.innerHTML = icon('grid') + '<span>More</span>';
 more.setAttribute('aria-label','More sections');
 more.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  syncMenu();
 });
 bar.append(more);
 document.body.append(bar);
 function syncMenu(){
  const opened = mobile.matches && !sidebar.classList.contains('collapsed');
  backdrop.classList.toggle('visible',opened);
  logo.setAttribute('aria-expanded',String(!sidebar.classList.contains('collapsed')));
  more.setAttribute('aria-expanded',String(opened));
 }
 function closeMenu(){
  if(mobile.matches)sidebar.classList.add('collapsed');
  syncMenu();
 }
 function syncSelected(){
  const active = navigation.querySelector('button[data-key].active')?.dataset.key;
  bar.querySelectorAll('button[data-mobile-key]').forEach(btn=>{
   const selected = btn.dataset.mobileKey === active || (btn.dataset.mobileKey === 'more' && active && !primary.includes(active));
   btn.classList.toggle('active',!!selected);
   if(selected)btn.setAttribute('aria-current','page');
   else btn.removeAttribute('aria-current');
  });
 }
 function setupMobileInputModes(){
  if(!mobile.matches)return;
  const section=navigation.querySelector('button[data-key].active')?.dataset.key;
  const parent=content.querySelector('#parent');
  if(parent&&(section==='flsm'||section==='vlsm')&&!parent.dataset.mobileSplit){
   const source=parent.closest('label');
   const control=document.createElement('div');
   control.className='mobile-cidr-field';
   const title=document.createElement('div');
   title.className='mobile-cidr-heading';
   title.textContent=section==='flsm'?'Parent IPv4 / CIDR':'Starting IPv4 / CIDR';
   const entry=document.createElement('div');
   entry.className='mobile-cidr-entry';
   const addressLabel=document.createElement('label');
   addressLabel.textContent='IPv4 address';
   const address=document.createElement('input');
   address.className='mobile-cidr-address';
   address.type='text';
   address.inputMode='decimal';
   address.autocomplete='off';
   address.spellcheck=false;
   address.setAttribute('aria-label','IPv4 address');
   const prefixLabel=document.createElement('label');
   prefixLabel.textContent=section==='vlsm'?'Prefix (optional)':'Prefix';
   const prefix=document.createElement('input');
   prefix.className='mobile-cidr-prefix';
   prefix.type='text';
   prefix.inputMode='numeric';
   prefix.autocomplete='off';
   prefix.maxLength=2;
   prefix.setAttribute('aria-label','CIDR prefix');
   const slash=document.createElement('span');
   slash.className='mobile-cidr-slash';
   slash.textContent='/';
   slash.setAttribute('aria-hidden','true');
   const parts=parent.value.split('/');
   address.value=parts[0]||'';
   prefix.value=parts.length===2?parts[1]:'';
   addressLabel.append(address);
   prefixLabel.append(prefix);
   entry.append(addressLabel,slash,prefixLabel);
   control.append(title,entry);
   source.classList.add('mobile-cidr-source');
   source.after(control);
   parent.dataset.mobileSplit='1';
   function sync(type){
    const normalized=address.value.replaceAll(',','.').replace(/[^0-9.]/g,'');
    if(address.value!==normalized){
     const position=address.selectionStart;
     address.value=normalized;
     if(position!==null)address.setSelectionRange(Math.min(position,normalized.length),Math.min(position,normalized.length));
    }
    const cleanPrefix=prefix.value.replace(/[^0-9]/g,'');
    if(prefix.value!==cleanPrefix)prefix.value=cleanPrefix;
    parent.value=address.value.trim()+(prefix.value?'/'+prefix.value.trim():'');
    parent.dispatchEvent(new Event(type,{bubbles:true}));
   }
   address.addEventListener('input',()=>sync('input'));
   prefix.addEventListener('input',()=>sync('input'));
   address.addEventListener('change',()=>sync('change'));
   prefix.addEventListener('change',()=>sync('change'));
   address.addEventListener('blur',()=>sync('change'));
   prefix.addEventListener('blur',()=>sync('change'));
  }
  content.querySelectorAll('#params [data-param]').forEach(input=>{
   if(['ip','mask','gateway','destination','destmask','network','dns','source','wildcard'].includes(input.dataset.param))input.inputMode='decimal';
   if(['acl','vlan','port'].includes(input.dataset.param))input.inputMode='numeric';
  });
  content.querySelectorAll('.vlsm-cell-input').forEach(input=>{
   const column=input.closest('td')?.dataset.col;
   if(column==='hosts'||column==='prefix')input.inputMode='numeric';
  });
  content.querySelectorAll('.cell-inline-input').forEach(input=>{
   const cell=input.closest('td');
   const column=Number(cell?.dataset.c);
   if(column===2||column===5){
    if(!/[a-fA-F:]/.test(input.value))input.inputMode='decimal';
   }else if(column===4)input.inputMode='numeric';
  });
 }
 function updateLabels(){
  if(!mobile.matches)return;
  setupMobileInputModes();
  content.querySelectorAll('.table-wrap table').forEach(table => {
   const headings=Array.from(table.querySelectorAll('thead th'),th=>th.textContent.trim());
   table.querySelectorAll('tbody tr').forEach(tr => {
    Array.from(tr.cells).forEach((td,i) => {
     const label=headings[i] || `Column ${i+1}`;
     if(td.dataset.mobileLabel!==label)td.dataset.mobileLabel=label;
    });
   });
  });
 }
 let labelPending=false;
 const changes=new MutationObserver(() => {
  syncSelected();
  if(!labelPending){
   labelPending=true;
   queueMicrotask(()=>{labelPending=false;updateLabels()});
  }
 });
 changes.observe(navigation,{subtree:true,attributes:true,attributeFilter:['class']});
 const tableChanges = new MutationObserver(() => {
  if(labelPending)return;
  labelPending=true;
  queueMicrotask(()=>{labelPending=false;updateLabels()});
 });
 tableChanges.observe(content,{subtree:true,childList:true});
 navigation.addEventListener('click',event=>{
  if(event.target.closest('button[data-key]')){closeMenu();if(mobile.matches)window.scrollTo(0,0)}
 });
 logo.addEventListener('click',syncMenu);
 logo.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();logo.click()}
 });
 backdrop.addEventListener('click',closeMenu);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&mobile.matches&&!sidebar.classList.contains('collapsed'))closeMenu();
 });
 content.addEventListener('click',event=>{
  if(!mobile.matches||!window.matchMedia('(pointer: coarse)').matches)return;
  const td = event.target.closest('#vlsm-grid td.vlsm-edit, .attached-inventory tbody td');
  if(!td || event.target.closest('input,textarea,select,button'))return;
  td.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
 });
 mobile.addEventListener('change',event=>{
  if(event.matches)sidebar.classList.add('collapsed');
  else sidebar.classList.remove('collapsed');
  syncMenu();
  updateLabels();
 });
 if(mobile.matches)sidebar.classList.add('collapsed');
 syncMenu();
 syncSelected();
 updateLabels();
})();
