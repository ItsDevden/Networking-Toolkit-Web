'use strict';
(()=>{
const $=id=>document.getElementById(id);
const dock=$('group-toggle'), panel=$('group-overlay');
if(!dock||!panel)return;
const config=window.DEVDEN_GROUP_CONFIG||{};
const ready=Boolean(/^https:\/\//.test(config.url||'')&&typeof config.anonKey==='string'&&config.anonKey.length>20);
const identityKey='devden-classroom-member-id-v1';let memberId=localStorage.getItem(identityKey);if(!memberId){memberId=crypto.randomUUID();localStorage.setItem(identityKey,memberId)}
const memberKey='devden-group-memberships-v1',soloKey='devden-group-solo-backup-v1',activeKey='devden-group-was-active-v1';
let groups=[],activeGroup=null,poll=null,busy=false,dirty=false,lastSaved='',connecting=false,failures=0;
let applyingRemote=false;let lastLocalActivity=0,conflictDraft=null,remoteConflict=false,baseDocument=null,heldLocks=new Map(),remoteLocks=[],collaboratorPalette=[],selectedCode=null,notice=null,visibleCodes=new Set(),rosterCache={},rosterErrors={},rosterPending=new Set(),lastRosterFetch={};
try{groups=JSON.parse(localStorage.getItem(memberKey)||'[]');if(!Array.isArray(groups))groups=[];}catch{groups=[]}
const saveGroups=()=>localStorage.setItem(memberKey,JSON.stringify(groups));
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>projectSnapshot();
const palette=()=>typeof TOPO_PALETTE!=='undefined'?TOPO_PALETTE:['#8bafff','#68c4a2','#b48bec','#eead6f'];
const memberColor=id=>{const roster=rosterCache[activeGroup?.code]||[];const position=Math.max(0,roster.findIndex(m=>m.id===id));return palette()[position%palette().length]};
const lockKey=(kind,id)=>kind+':'+id;
const lockOwner=key=>remoteLocks.find(l=>l.key===key&&l.member!==memberId)?.member;
const ownLock=key=>heldLocks.has(key);
const online=()=>Boolean(activeGroup&&!failures&&!remoteConflict);
const groupStatus=()=>!activeGroup?'Saved locally':failures?'Offline · unsynced':remoteConflict?'Conflict · unsynced':dirty?'Saving to group…':'Saved in group';
const emitGroupStatus=()=>window.dispatchEvent(new Event('devden-group-status'));
window.DevDenGroupStatus={current:groupStatus};
async function lease(key,release=false,cursor=-1,force=false){if(!activeGroup)return true;const group=activeGroup;try{
 const response=await rpc('devden_lock_object',{p_code:group.code,p_member_id:memberId,p_object:key,p_release:release,p_cursor:cursor,p_force:force});
 if(response?.removed){removed(group);return false}
 if(release)heldLocks.delete(key);else if(response?.ok)heldLocks.set(key,Date.now());
 else if(response?.owner){remoteLocks=remoteLocks.filter(l=>l.key!==key);remoteLocks.push({key,member:response.owner});}
 updateVisualLocks();return Boolean(response?.ok);
 }catch(e){console.warn('Lock request failed',e);return false}}
function releaseLocks(){for(const key of heldLocks.keys())void lease(key,true);heldLocks.clear();}
window.DevDenCollab={paint:updateVisualLocks,connected:online,requestTakeover:takeover,canEdit(el){if(!activeGroup||!el)return true;const kind=el.dataset.device?'device':el.dataset.zone?'zone':el.dataset.note?'note':'link';const id=el.dataset.device||el.dataset.zone||el.dataset.note||el.dataset.link;return !lockOwner(lockKey(kind,id))},canEditRef(ref){return !activeGroup||!lockOwner(lockKey(ref.kind,ref.id))},notesEditable(id){return true},warn(){const s=document.getElementById('notes-status');if(s)s.textContent='Another member is editing this item';}};
function updateVisualLocks(){
 const board=document.getElementById('topo-board');if(board){board.querySelectorAll('.devden-collab-tag').forEach(e=>e.remove());board.querySelectorAll('[data-device],[data-zone],[data-note],[data-link]').forEach(el=>{
 const kind=el.dataset.device?'device':el.dataset.zone?'zone':el.dataset.note?'note':'link',id=el.dataset.device||el.dataset.zone||el.dataset.note||el.dataset.link;
 if(!id||el.classList.contains('topo-wire-hit'))return;
 const key=lockKey(kind,id),owner=lockOwner(key),ours=ownLock(key);el.classList.toggle('devden-remote-lock',!!owner);el.classList.toggle('devden-own-lock',!owner&&ours);
 el.style.setProperty('--collab-color',owner?memberColor(owner):memberColor(memberId));
 if(owner){const tag=document.createElement('span');tag.className='devden-collab-tag';const person=(rosterCache[activeGroup?.code]||[]).find(m=>m.id===owner);tag.textContent=(person?.name||'?').slice(0,1).toUpperCase();tag.title=(person?.name||'Another member')+' is editing';el.append(tag)}
 })}
 const editor=document.getElementById('notes-editor');if(editor&&active==='notes'){
 editor.closest('.notes-paper-wrap')?.querySelectorAll('.devden-note-caret').forEach(e=>e.remove());
 for(const lock of remoteLocks.filter(x=>x.key.startsWith('cursor:notes:'+notesPage()?.id+':'))){
  const marker=document.createElement('span');marker.className='devden-note-caret';marker.style.setProperty('--collab-color',memberColor(lock.member));
  const person=(rosterCache[activeGroup?.code]||[]).find(m=>m.id===lock.member);marker.textContent=(person?.name||'?').slice(0,1).toUpperCase();
  const wrap=editor.closest('.notes-paper-wrap');let xy={left:10,top:8};
  try{let pos=Number(lock.cursor_pos);if(pos>=0){const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(pos<=node.textContent.length){const r=document.createRange();r.setStart(node,Math.max(0,pos));r.collapse(true);const rect=r.getBoundingClientRect(),parent=wrap.getBoundingClientRect();xy={left:rect.left-parent.left+wrap.scrollLeft,top:rect.top-parent.top+wrap.scrollTop};break}pos-=node.textContent.length}}}catch{}
  Object.assign(marker.style,{left:xy.left+'px',top:xy.top+'px'});wrap.append(marker)
 }
 }
}
async function takeover(ref){if(!activeGroup)return;const key=lockKey(ref.kind,ref.id),owner=lockOwner(key);if(!owner)return;const person=(rosterCache[activeGroup.code]||[]).find(x=>x.id===owner);if(!confirm((person?.name||'Another member')+' is editing this item. Overwrite and take control?'))return;const ok=await lease(key,false,-1,true);if(ok){remoteLocks=remoteLocks.filter(x=>x.key!==key);updateVisualLocks()}else alert('Unable to take control. Try again.')}
async function refreshLocks(){if(!activeGroup)return;const g=activeGroup;try{const list=await rpc('devden_list_locks',{p_code:g.code,p_member_id:memberId});if(list?.removed){removed(g);return}if(Array.isArray(list)){const changed=JSON.stringify(remoteLocks)!==JSON.stringify(list);remoteLocks=list;const owned=new Set(list.filter(l=>l.member===memberId).map(l=>l.key));for(const key of heldLocks.keys())if(!owned.has(key))heldLocks.delete(key);if(changed)updateVisualLocks()}}catch(e){console.warn('Presence temporarily unavailable',e)}}
let selectionTimer=null;
window.addEventListener('devden-topo-selection',()=>{if(!online()||active!=='topology')return;
 const selected=topoSelection?.find(s=>s.kind!=='link');if(!selected){releaseLocks();return}
 const key=lockKey(selected.kind,selected.id);for(const old of heldLocks.keys())if(old!==key)void lease(old,true);
 if(lockOwner(key))return;if(!ownLock(key))void lease(key)
});
window.addEventListener('devden-notes-cursor',e=>{if(!online()||active!=='notes')return;const key='cursor:notes:'+e.detail.page+':'+memberId;
 for(const old of heldLocks.keys())if(old.startsWith('cursor:notes:')&&old!==key)void lease(old,true);
 clearTimeout(selectionTimer);selectionTimer=setTimeout(()=>void lease(key,false,e.detail.pos),170)
});
window.addEventListener('devden-notes-blur',()=>{for(const old of heldLocks.keys())if(old.startsWith('cursor:notes:'))void lease(old,true)});

const makeCode=()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return [...bytes].map(b=>alphabet[b%alphabet.length]).join('')};
const rpc=async(name,payload={})=>{
 if(!ready)throw Error('Live Groups is currently unavailable.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{const res=await fetch(config.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{'apikey':config.anonKey,'Authorization':'Bearer '+config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl.signal});const data=await res.json();if(!res.ok)throw Error(data.message||'Group service returned '+res.status);return data}finally{clearTimeout(timer)}
};
const groupButton=group=>`<button type="button" class="group-choice ${selectedCode===group.code?'selected':''}" data-select="${escapeHTML(group.code)}"><span class="group-choice-name">${escapeHTML(group.name)}</span>${activeGroup?.code===group.code&&!failures&&!remoteConflict?'<span class="group-active-dot" aria-label="Connected"></span>':''}<span class="group-choice-arrow">›</span></button>`;
const memberView=(group)=>{
 const roster=rosterCache[group.code];
 if(!roster)return '<p class="group-member-empty">'+(rosterErrors[group.code]?'Members unavailable':'Loading members…')+'</p>';
 if(!roster.length)return '<p class="group-member-empty">No members.</p>';
 const leader=roster[0]?.id,meLeader=leader===memberId;
 return roster.map(m=>`<div class="group-person"><span class="group-person-dot ${m.online?'online':''}"></span><span class="group-person-name">${escapeHTML(m.name)}${m.id===memberId?' <small>(You)</small>':''}${m.id===leader?' <small>(Leader)</small>':''}</span>${meLeader&&m.id!==memberId?`<button type="button" class="group-kick" data-kick="${escapeHTML(group.code)}" data-member="${escapeHTML(m.id)}" data-name="${escapeHTML(m.name)}">Kick</button>`:''}</div>`).join('');
};
const detail=group=>`<section class="group-detail"><div class="group-detail-top"><strong>${escapeHTML(group.name)}</strong><span>${activeGroup?.code===group.code&&!failures&&!remoteConflict?'Connected':'Offline'}</span></div><div class="group-nickname">${escapeHTML(group.nickname||'Unnamed')} <button type="button" data-rename="${escapeHTML(group.code)}">Edit</button></div><div class="group-code-line"><input readonly type="${visibleCodes.has(group.code)?'text':'password'}" aria-label="Join code" value="${escapeHTML(group.code)}"><button type="button" class="group-eye" data-eye="${escapeHTML(group.code)}" aria-label="Show join code">◉</button><button type="button" data-copy="${escapeHTML(group.code)}">Copy</button></div><div class="group-detail-actions"><button type="button" data-open="${escapeHTML(group.code)}">${activeGroup?.code===group.code?(failures||remoteConflict?'Reconnect':'Connected'):'Connect'}</button>${activeGroup?.code===group.code?`<button type="button" data-disconnect="${escapeHTML(group.code)}">Disconnect</button>`:''}<button type="button" data-leave="${escapeHTML(group.code)}">Leave group</button></div>${conflictDraft&&activeGroup?.code===group.code?'<button type="button" class="group-draft-button">Download unsent draft</button>':''}<div class="group-member-heading">Members <span>${(rosterCache[group.code]||[]).filter(m=>m.online).length} online</span></div><div class="group-people">${memberView(group)}</div></section>`;
const render=()=>{
 if(!groups.some(g=>g.code===selectedCode))selectedCode=null;
 const selected=groups.find(g=>g.code===selectedCode);
 $('group-memberships').innerHTML=groups.length?`<div class="group-choices">${groups.map(groupButton).join('')}</div>${selected?detail(selected):''}`:'<p class="group-empty">No groups joined yet.</p>';
 const display=dock.querySelector('.group-display'),dot=dock.querySelector('.group-status-dot'),subtitle=dock.querySelector('.group-subtitle');
 display.textContent=activeGroup?activeGroup.name:'Groups';if(subtitle){subtitle.hidden=!activeGroup;subtitle.textContent=activeGroup?(notice?'Disconnected · review':failures?'Reconnecting…':(rosterCache[activeGroup.code]||[]).filter(x=>x.online).length+' online · Connected'):''}dot.hidden=!activeGroup&&!notice;dock.classList.toggle('group-error-state',Boolean(notice));dock.classList.toggle('group-reconnecting-state',Boolean(activeGroup&&failures&&!notice));dot.title=notice||(!activeGroup?'':failures?'Reconnecting':'Connected');
 $('group-create').disabled=false;$('group-join').disabled=false;
 const hint=panel.querySelector('.group-availability');if(hint)hint.remove();
 panel.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{selectedCode=selectedCode===b.dataset.select?null:b.dataset.select;render();if(selectedCode)refreshRoster(selectedCode)});
 panel.querySelectorAll('.group-draft-button').forEach(b=>b.onclick=()=>{if(!conflictDraft)return;const blob=new Blob([JSON.stringify(conflictDraft,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='DevDen-unsent-manual-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);conflictDraft=null;notice=null;render()});
 panel.querySelectorAll('[data-kick]').forEach(b=>b.onclick=async()=>{if(!confirm('Kick '+b.dataset.name+' from this group?'))return;try{const result=await rpc('devden_leader_kick_member',{p_code:b.dataset.kick,p_actor_id:memberId,p_member_id:b.dataset.member});if(!result)throw Error('Permission denied or member not found');await refreshRoster(b.dataset.kick)}catch(e){alert('Kick failed: '+e.message)}});
 panel.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=()=>disconnect());
 panel.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>{const g=groups.find(x=>x.code===b.dataset.rename);if(!g)return;dialog('Your name in '+g.name,`<label>Display name<input id="group-display-name" value="${escapeHTML(g.nickname||'')}" required autocomplete="nickname"></label>`,async d=>{const name=d.querySelector('#group-display-name').value.trim();if(!name)throw Error('Enter a display name.');await rpc('devden_register_member',{p_code:g.code,p_member_id:memberId,p_nickname:name});g.nickname=name;saveGroups();render();refreshRoster(g.code)})});
 panel.querySelectorAll('[data-eye]').forEach(b=>{b.setAttribute('aria-label',visibleCodes.has(b.dataset.eye)?'Hide join code':'Show join code');b.onclick=()=>{if(visibleCodes.has(b.dataset.eye))visibleCodes.delete(b.dataset.eye);else visibleCodes.add(b.dataset.eye);render()}});
 panel.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(b.dataset.copy).then(()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1100)}).catch(()=>window.prompt('Copy join code',b.dataset.copy)));
 panel.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const g=groups.find(x=>x.code===b.dataset.open);if(g)connect(g)});
 panel.querySelectorAll('[data-leave]').forEach(b=>b.onclick=async()=>{const g=groups.find(x=>x.code===b.dataset.leave);if(!g||!confirm('Leave '+g.name+'? You will need its code to join again.'))return;try{await rpc('devden_member_leave',{p_code:g.code,p_member_id:memberId});if(activeGroup?.code===g.code)disconnect();groups=groups.filter(x=>x.code!==g.code);delete rosterCache[g.code];saveGroups();render()}catch(e){alert('Unable to leave: '+e.message)}});
};
async function refreshRoster(code){
 const g=groups.find(x=>x.code===code);if(!g||!ready||rosterPending.has(code))return;
 rosterPending.add(code);
 try{const result=await rpc('devden_member_roster',{p_code:code,p_member_id:memberId});if(result?.removed){forgetMissing(code);return}if(!Array.isArray(result))throw Error('Invalid member list');rosterCache[code]=result;delete rosterErrors[code];if(selectedCode===code&&!panel.hidden)render()}
 catch(e){rosterErrors[code]=true;if(selectedCode===code&&!panel.hidden)render()}
 finally{rosterPending.delete(code);lastRosterFetch[code]=Date.now()}
}
function forgetMissing(code){
 if(activeGroup?.code===code)disconnect();groups=groups.filter(g=>g.code!==code);delete rosterCache[code];delete rosterErrors[code];if(selectedCode===code)selectedCode=null;saveGroups();render()
}
async function validateGroups(){
 if(!ready||!groups.length)return;
 for(const g of [...groups]){
  try{const result=await rpc('devden_member_roster',{p_code:g.code,p_member_id:memberId});if(result?.removed){forgetMissing(g.code)}else if(Array.isArray(result)){rosterCache[g.code]=result;delete rosterErrors[g.code]}}
  catch(e){}
 }
 render();
}
const open=v=>{panel.hidden=!v;dock.setAttribute('aria-expanded',String(v));dock.classList.toggle('opened',v);if(v){selectedCode=null;visibleCodes.clear();notice=null;render();validateGroups()}else{visibleCodes.clear()}};
dock.onclick=()=>open(panel.hidden);$('group-close').onclick=()=>open(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false)});
document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!dock.contains(e.target))open(false)});
function dialog(title,markup,run){const d=document.createElement('dialog');d.className='group-dialog';d.innerHTML=`<form method="dialog"><header><strong>${title}</strong><button type="button" data-dismiss aria-label="Close">×</button></header>${markup}<p class="group-error" role="alert"></p><footer><button type="button" data-dismiss>Cancel</button><button id="group-submit" type="button">Continue</button></footer></form>`;document.body.append(d);d.showModal();d.addEventListener('close',()=>d.remove());d.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',()=>d.close()));d.querySelector('#group-submit').onclick=async()=>{const button=d.querySelector('#group-submit');button.disabled=true;const error=d.querySelector('.group-error');error.textContent='';try{await run(d);d.close()}catch(e){error.textContent=e.message;button.disabled=false}}}
$('group-create').onclick=()=>dialog('Create group','<label>Group name<input id="group-new-name" maxlength="64" required placeholder="Cisco Lab"></label><label>Your display name in this group<input id="group-create-nickname" required autocomplete="nickname" placeholder="Router Goblin"></label>',async d=>{const name=d.querySelector('#group-new-name').value.trim();if(!name)throw Error('Enter a group name.');const nickname=d.querySelector('#group-create-nickname').value.trim();if(!nickname)throw Error('Enter your display name.');const code=makeCode();const response=await rpc('devden_create_group',{p_code:code,p_name:name,p_document:{version:2,state:structuredClone(defaults),topology:topoDefault()}});if(!response)throw Error('Could not create group.');await rpc('devden_register_member',{p_code:code,p_member_id:memberId,p_nickname:nickname});const g={code,name,nickname};groups.push(g);selectedCode=g.code;saveGroups();render();await connect(g)});
$('group-join').onclick=()=>dialog('Join group','<label>Join code<input id="group-join-code" maxlength="20" autocomplete="off" spellcheck="false" placeholder="XXXXXXXXXXXX"></label><label>Your display name in this group<input id="group-join-nickname" required autocomplete="nickname" placeholder="Router Goblin"></label>',async d=>{const code=d.querySelector('#group-join-code').value.toUpperCase().replace(/[^A-Z2-9]/g,'');if(code.length!==12)throw Error('Enter the 12-character join code.');const nickname=d.querySelector('#group-join-nickname').value.trim();if(!nickname)throw Error('Enter your display name.');const remote=await rpc('devden_register_member',{p_code:code,p_member_id:memberId,p_nickname:nickname});if(!remote)throw Error('Group not found. Check the code.');let g=groups.find(x=>x.code===code);if(!g){g={code,name:remote.name,nickname};groups.push(g);saveGroups()}else{g.nickname=nickname;saveGroups()}selectedCode=g.code;render();await connect(g,remote)});
function addSoloProject(snapshot,name){
 const library=templateLibrary();
 library.push({id:'group-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8),name,...structuredClone(snapshot)});
 saveTemplateLibrary(library);
}
function saveGroupToSolo(){
 if(!activeGroup)throw Error('Connect to a group first.');
 if(active==='notes')notesCommit();
 addSoloProject(current(),activeGroup.name+' (Group copy)');
}
async function shareSoloProject(templateId){
 if(!activeGroup||failures||remoteConflict)throw Error('Connect to a healthy group first.');
 const selected=templateLibrary().find(x=>x.id===templateId&&x.version===2&&x.state&&x.topology);
 if(!selected)throw Error('Choose a complete Solo project.');
 if(busy||connecting)throw Error('Synchronization in progress. Try again.');
 if(active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag)throw Error('Finish moving the selected item first.');
 busy=true;
 const group=activeGroup;
 try{
  if(active==='notes')notesCommit();
  const local=current();
  if(dirty||JSON.stringify(local)!==lastSaved)throw Error('The group has unsynced changes. Wait for synchronization before uploading.');
  const remote=await rpc('devden_member_read',{p_code:group.code,p_member_id:memberId});
  if(activeGroup!==group)throw Error('The active group changed.');
  if(!remote||remote.removed){removed(group);throw Error('Group no longer exists.');}
  if(remote.revision!==group.revision)throw Error('The group changed. Let it sync before uploading.');
  const snapshot={version:2,state:structuredClone(selected.state),topology:structuredClone(selected.topology)};
  const result=await rpc('devden_member_update',{p_code:group.code,p_member_id:memberId,p_revision:group.revision,p_document:snapshot});
  if(activeGroup!==group)throw Error('The active group changed.');
  if(!result?.ok)throw Error('The group changed. Let it sync before uploading.');
  group.revision=result.revision;
  baseDocument=structuredClone(snapshot);
  restoreProject(snapshot);
  navigate(active);
  lastSaved=JSON.stringify(current());
  dirty=false;failures=0;remoteConflict=false;conflictDraft=null;
  notice=null;
  render();
 }finally{busy=false}
}
window.DevDenGroupTransfers={connected:()=>Boolean(activeGroup&&!failures&&!remoteConflict),name:()=>activeGroup?.name||'',saveFromGroup:saveGroupToSolo,uploadToGroup:shareSoloProject};
function backupSolo(){if(localStorage.getItem(soloKey))return;localStorage.setItem(soloKey,JSON.stringify(current()))}
function restoreSolo(){const raw=localStorage.getItem(soloKey);if(!raw)return;try{restoreProject(JSON.parse(raw));localStorage.removeItem(soloKey);navigate(active)}catch(e){alert('Could not restore Solo workspace: '+e.message)}}
function disconnect(){releaseLocks();remoteLocks=[];baseDocument=null;conflictDraft=null;if(poll)clearInterval(poll);poll=null;activeGroup=null;dirty=false;connecting=false;failures=0;remoteConflict=false;localStorage.removeItem(activeKey);restoreSolo();render();emitGroupStatus()}
async function connect(group,existing){if(connecting)return;if(activeGroup?.code===group.code&&!failures&&!remoteConflict){open(false);return}if(activeGroup?.code===group.code){if(remoteConflict&&!confirm('Your latest group edits have not synced. Discard those local changes and reload the shared project?'))return;disconnect()}connecting=true;try{
 if(activeGroup)disconnect();const remote=existing||await rpc('devden_register_member',{p_code:group.code,p_member_id:memberId,p_nickname:group.nickname});if(!remote||!remote.document)throw Error('Group not found.');backupSolo();activeGroup={...group,revision:remote.revision};dirty=false;failures=0;remoteConflict=false;notice=null;conflictDraft=null;baseDocument=structuredClone(remote.document);restoreProject(remote.document);navigate(active);lastSaved=JSON.stringify(current());localStorage.setItem(activeKey,group.code);selectedCode=group.code;render();open(false);poll=setInterval(sync,1800);emitGroupStatus();refreshRoster(group.code)
 }catch(e){alert('Unable to connect: '+e.message)}finally{connecting=false}}
window.addEventListener('devden-state-updated',()=>{if(activeGroup&&!applyingRemote){dirty=true;lastLocalActivity=Date.now();emitGroupStatus()}});
function removed(group){const name=group.name;forgetMissing(group.code);notice='Removed from '+name;render()}
async function sync(){
 if(active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag)return;
if(!activeGroup||busy)return;busy=true;const group=activeGroup;const previousStatus=failures+'|'+remoteConflict+'|'+String(notice);try{
 if(active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag)return;
 if(window.DevDenSketch?.drawing?.())return;
 if(active==='notes'&&document.querySelector('.notes-ink-overlay.is-drawing'))return;
 if(active==='notes')notesCommit();const syncStart=lastLocalActivity;let local=current(),serialized=JSON.stringify(local);
 if(serialized!==lastSaved)dirty=true;
 const remote=await rpc('devden_member_read',{p_code:group.code,p_member_id:memberId});
 if(remote?.removed){removed(group);return}if(!remote?.document)throw Error('Group unavailable');
 if(activeGroup!==group)return;
 if(lastLocalActivity!==syncStart||window.DevDenSketch?.drawing?.()||(active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag))return;
 if(remote.revision!==group.revision){
  if(active==='topology'&&(typeof topoDrag!=='undefined'&&topoDrag||Date.now()-lastLocalActivity<700||lastLocalActivity!==syncStart))return;
  const conflicts=[];const merged=DevDenMerge.reconcile(baseDocument||remote.document,local,remote.document,'',conflicts);
  if(conflicts.length){
   // Server-accepted value wins this field. Keep a manual recovery draft in
   // memory only, never create a Solo template or disconnect the participant.
   conflictDraft=structuredClone(local);notice='An overlapping edit was not applied · review in Groups';
  }
  if(active==='topology'&&Date.now()-lastLocalActivity<650)return;
  // Remote updates must not interrupt text editing inside a topology object.
  if(active==='topology'&&document.activeElement?.matches('#topo-board input:focus,#topo-board textarea:focus'))return;
  group.revision=remote.revision;baseDocument=structuredClone(remote.document);
  if(!DevDenMerge.same(merged,local)){
   // Keep keyboard focus while someone is editing rich text. Try again next poll.
   if(document.activeElement?.closest('#notes-editor,#notes-stickies-list')){
    const editor=document.getElementById('notes-editor'),selectedPage=notesPage()?.id;
    const remotePage=merged.state?.notes?.pages?.find(p=>p.id===selectedPage);
    // Keep the caret on the same character during incoming disjoint edits.
    // Never replace a focused editor if the local user typed during the request.
    notesCommit();const pageAtRequest=local.state?.notes?.pages?.find(p=>p.id===selectedPage);if(!editor||!remotePage||!pageAtRequest||notesPage().html!==pageAtRequest.html){dirty=true;return}
    if(remotePage.html!==notesPage().html){
     const sel=window.getSelection();let offset=0;
     if(sel?.rangeCount&&editor.contains(sel.anchorNode)){
      const r=document.createRange();r.selectNodeContents(editor);r.setEnd(sel.anchorNode,sel.anchorOffset);offset=r.toString().length;
     }
     editor.innerHTML=notesSanitize(remotePage.html);
     const walk=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let node,last=null;
     while((node=walk.nextNode())){last=node;if(offset<=node.length)break;offset-=node.length}
     if(last){const r=document.createRange();r.setStart(last,Math.min(offset,last.length));r.collapse(true);sel.removeAllRanges();sel.addRange(r)}
    }
    applyingRemote=true;try{restoreProject(merged)}finally{applyingRemote=false}
    // Do not navigate/rebuild Notes while a member is typing.
    local=current();serialized=JSON.stringify(local);
   }else{
    applyingRemote=true;
    try{
     if(active==='topology')applyGroupRemoteProject(merged,local);
     else{restoreProject(merged);navigate(active)}
    }finally{applyingRemote=false}
    local=current();serialized=JSON.stringify(local)
   }
  }
  dirty=!DevDenMerge.same(local,remote.document);lastSaved=JSON.stringify(remote.document);
 }
 if(dirty){
  if(active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag)return;
  local=current();
  const result=await rpc('devden_member_update',{p_code:group.code,p_member_id:memberId,p_revision:group.revision,p_document:local});
  if(result?.removed){removed(group);return}
  if(result?.ok){group.revision=result.revision;baseDocument=structuredClone(local);lastSaved=JSON.stringify(local);dirty=JSON.stringify(current())!==lastSaved;remoteConflict=false;if(!conflictDraft)notice=null}
  else if(result?.locked){notice='Another member is editing that item';remoteConflict=false;await refreshLocks();dirty=true;return}
  else {dirty=true;return} // Revision raced again; reconcile on the next poll.
 }else{lastSaved=JSON.stringify(local);remoteConflict=false;if(!conflictDraft)notice=null}
 failures=0;if(previousStatus!==failures+'|'+remoteConflict+'|'+String(notice))render();
 if(!panel.hidden&&Date.now()-(lastRosterFetch[group.code]||0)>=8000)refreshRoster(group.code);
 await refreshLocks();
 for(const [key,last] of heldLocks)if(Date.now()-last>4000)await lease(key,false);
 }catch(e){failures++;console.warn('Group sync',e);render()}finally{busy=false;emitGroupStatus()}}
if(localStorage.getItem(activeKey)){localStorage.removeItem(activeKey);restoreSolo()}
render();validateGroups();document.addEventListener('visibilitychange',()=>{if(!document.hidden)validateGroups()});
})();
