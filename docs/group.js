'use strict';
(()=>{
const $=id=>document.getElementById(id);
const dock=$('group-toggle'), panel=$('group-overlay');
if(!dock||!panel)return;
const config=window.DEVDEN_GROUP_CONFIG||{};
const ready=Boolean(/^https:\/\//.test(config.url||'')&&typeof config.anonKey==='string'&&config.anonKey.length>20);
const identityKey='devden-classroom-member-id-v1';let memberId=localStorage.getItem(identityKey);if(!memberId){memberId=crypto.randomUUID();localStorage.setItem(identityKey,memberId)}
const memberKey='devden-group-memberships-v1',soloKey='devden-group-solo-backup-v1',activeKey='devden-group-was-active-v1',draftKey='devden-group-recovery-v1';
// Snapshot polling is a recovery path. It can be awakened by a future Realtime event.
// Keep responsive polling while collaborators are active; back off when idle or alone.
const GROUP_POLL_ACTIVE_MS=950;
const GROUP_POLL_IDLE_MS=5000;
const GROUP_POLL_SOLO_MS=8000;
const GROUP_POLL_HIDDEN_MS=20000;
const GROUP_POLL_FAILURE_MS=2500;
let groups=[],activeGroup=null,poll=null,busy=false,dirty=false,lastSaved='',connecting=false,failures=0;
let syncWakePending=false;
// Supabase Realtime Broadcast transports *hints*, never group documents. The
// member-checked RPC remains the only source of project data. Direct Postgres
// Changes would not work here: devden_groups deliberately denies anon SELECT.
let realtimeSocket=null,realtimeGroup=null,realtimeJoined=false,realtimeJoinRef=null;
let realtimeHeartbeat=null,realtimeRetry=null,realtimeAttempt=0,realtimeSerial=0,realtimeLastMessage=0,realtimeLastSignal=0;
const REALTIME_HEARTBEAT_MS=20000;
const realtimeTopic=group=>`realtime:ntk-group-${group.code}`;
function realtimeStop(){
 realtimeLastMessage=0;
 clearInterval(realtimeHeartbeat);clearTimeout(realtimeRetry);
 realtimeHeartbeat=null;realtimeRetry=null;realtimeJoined=false;
 realtimeGroup=null;realtimeJoinRef=null;realtimeAttempt=0;
 const socket=realtimeSocket;realtimeSocket=null;
 if(socket){socket.onopen=socket.onmessage=socket.onclose=socket.onerror=null;try{socket.close()}catch{}}
}
function realtimeSend(event,payload={},topic=null,joinRef=realtimeJoinRef){
 if(!realtimeSocket||realtimeSocket.readyState!==WebSocket.OPEN)return false;
 const ref=String(++realtimeSerial);
 realtimeSocket.send(JSON.stringify({topic:topic||realtimeTopic(realtimeGroup),event,payload,ref,join_ref:event==='phx_join'?ref:joinRef}));
 return ref;
}
function realtimePublish(revision){
 // Only a revision hint: no names, document contents or lock data on the wire.
 if(!realtimeJoined||!realtimeGroup||activeGroup!==realtimeGroup)return;
 realtimeSend('broadcast',{type:'broadcast',event:'revision',payload:{revision,origin:memberId}});
}
// Movement is ephemeral over the socket; only pointer release persists coordinates.
// Other object properties never travel in these Broadcast packets.
let movementSequence=0,movementPending=0;
const movementSession=crypto.randomUUID();
function realtimeMotion(positions,ended=false){
 if(!activeGroup||!realtimeJoined||!Array.isArray(positions)||!positions.length)return;
 const items=positions.filter(p=>['device','zone','note'].includes(p.kind)&&typeof p.id==='string'&&
  Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,80).map(p=>({kind:p.kind,id:p.id,x:p.x,y:p.y}));
 if(!items.length)return;
 realtimeSend('broadcast',{type:'broadcast',event:'movement',payload:{origin:memberId,session:movementSession,seq:++movementSequence,positions:items,ended}});
}
async function persistMovement(positions){
 if(!activeGroup||!Array.isArray(positions)||!positions.length)return;
 const group=activeGroup;movementPending++;
 try{
  // Atomic, member-checked coordinate-only update. No object lease required.
  const result=await rpc('devden_move_objects',{p_code:group.code,p_member_id:memberId,p_positions:positions});
  if(activeGroup!==group)return;
  if(result?.removed){removed(group);return}
  if(!result?.ok)throw Error('Drag positions could not be saved');
  realtimePublish(result.revision);
 }catch(error){
  if(activeGroup===group){notice='Movement save pending · local copy preserved';saveRecovery(group);console.warn('Shared movement save failed',error)}
 }finally{
  movementPending=Math.max(0,movementPending-1);
  if(activeGroup===group){wakeSync(0);emitGroupStatus()}
 }
}
window.DevDenLiveMovement={send:realtimeMotion,persist:persistMovement,connected:()=>!!activeGroup};
function realtimeStart(group){
 realtimeStop();
 if(!ready||!group||typeof WebSocket==='undefined')return;
 realtimeGroup=group;
 const connectSocket=()=>{
  if(activeGroup!==group||realtimeGroup!==group)return;
  let socket;
  try{
   const endpoint=config.url.replace(/\/$/,'').replace(/^https:/,'wss:').replace(/^http:/,'ws:');
   socket=new WebSocket(endpoint+'/realtime/v1/websocket?apikey='+encodeURIComponent(config.anonKey)+'&vsn=1.0.0');
  }catch(error){console.warn('Realtime connection unavailable',error);realtimeRetryConnect();return}
  realtimeSocket=socket;realtimeJoined=false;
  socket.onopen=()=>{
   if(realtimeSocket!==socket||activeGroup!==group)return;
   realtimeJoinRef=realtimeSend('phx_join',{
    config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:false},
    access_token:config.anonKey
   },realtimeTopic(group),null);
   clearInterval(realtimeHeartbeat);
   realtimeHeartbeat=setInterval(()=>{
    if(realtimeSocket!==socket||socket.readyState!==WebSocket.OPEN)return;
    realtimeSend('heartbeat',{},'phoenix',null);
   },REALTIME_HEARTBEAT_MS);
  };
  socket.onmessage=event=>{
   if(realtimeSocket!==socket||activeGroup!==group)return;
   realtimeLastMessage=Date.now();
   let msg;try{msg=JSON.parse(event.data)}catch{return}
   if(msg.topic!==realtimeTopic(group))return;
   if(msg.event==='phx_reply'&&msg.ref===realtimeJoinRef){
    if(msg.payload?.status==='ok'){
     realtimeJoined=true;realtimeAttempt=0;emitGroupStatus();render();
     // Catch commits made while the socket was connecting or reconnecting.
     wakeSync(0);
    }else{
     console.warn('Realtime channel unavailable; polling continues',msg.payload?.response);
     socket.close();
    }
   }else if(msg.event==='broadcast'&&msg.payload?.event==='movement'){
    const movement=msg.payload.payload;
    if(movement?.origin!==memberId&&Array.isArray(movement?.positions)&&movement.positions.length<=80){
     lastRemoteActivity=Date.now();realtimeLastSignal=lastRemoteActivity;
     window.dispatchEvent(new CustomEvent('devden-remote-movement',{detail:movement}));
     if(movement.ended)wakeSync(100);
    }
   }else if(msg.event==='broadcast'&&msg.payload?.event==='revision'){
    const hint=msg.payload.payload;
    if(hint?.origin===memberId)return;
    // No trust in broadcasts: the permission-checked read/merge determines truth.
    if(!hint||!Number.isFinite(Number(hint.revision))||Number(hint.revision)<=Number(group.revision))return;
    lastRemoteActivity=Date.now();realtimeLastSignal=lastRemoteActivity;wakeSync(30);
   }else if(msg.event==='phx_close'||msg.event==='phx_error'){
    socket.close();
   }
  };
  socket.onerror=()=>{}; // onclose handles retries and preserves polling.
  socket.onclose=()=>{
   if(realtimeSocket!==socket)return;
   realtimeSocket=null;realtimeJoined=false;emitGroupStatus();render();
   clearInterval(realtimeHeartbeat);realtimeHeartbeat=null;
   realtimeRetryConnect();
  };
 };
 function realtimeRetryConnect(){
  if(activeGroup!==group||realtimeGroup!==group)return;
  clearTimeout(realtimeRetry);
  const wait=Math.min(30000,1000*2**Math.min(realtimeAttempt++,5));
  realtimeRetry=setTimeout(connectSocket,wait+Math.floor(Math.random()*350));
 }
 connectSocket();
}
let lastGroupActivity=0,lastRemoteActivity=0,lastRosterCheck=0;
function groupHasPeers(){const members=rosterCache[activeGroup?.code];return Array.isArray(members)&&members.some(m=>m.id!==memberId&&m.online)}
function pollDelay(){
 if(document.hidden)return GROUP_POLL_HIDDEN_MS;
 if(realtimeJoined&&!failures)return dirty?2500:groupHasPeers()?11000:18000;
 if(failures)return GROUP_POLL_FAILURE_MS;
 if(dirty||Date.now()-Math.max(lastLocalActivity,lastRemoteActivity,lastGroupActivity)<12000)return GROUP_POLL_ACTIVE_MS;
 return groupHasPeers()?GROUP_POLL_IDLE_MS:GROUP_POLL_SOLO_MS;
}
function schedulePoll(delay){
 clearTimeout(poll);poll=null;
 if(!activeGroup)return;
 const scheduledGroup=activeGroup;
 poll=setTimeout(()=>{
  poll=null;
  if(activeGroup!==scheduledGroup)return;
  void sync().finally(()=>{
   if(activeGroup!==scheduledGroup||poll)return;
   const urgent=syncWakePending;
   syncWakePending=false;
   schedulePoll(urgent?0:pollDelay());
  });
 },Math.max(0,delay));
}
function wakeSync(delay=120){
 if(!activeGroup)return;
 lastGroupActivity=Date.now();
 if(busy){syncWakePending=true;return;}
 schedulePoll(delay);
}
// Realtime adapters can dispatch this event on receipt of a committed revision.
window.addEventListener('devden-group-remote-change',()=>wakeSync(0));
let applyingRemote=false;let lastLocalActivity=0,conflictDraft=null,remoteConflict=false,baseDocument=null,heldLocks=new Map(),remoteLocks=[],collaboratorPalette=[],selectedCode=null,notice=null,visibleCodes=new Set(),rosterCache={},rosterErrors={},rosterPending=new Set(),lastRosterFetch={};
try{groups=JSON.parse(localStorage.getItem(memberKey)||'[]');if(!Array.isArray(groups))groups=[];}catch{groups=[]}
const saveGroups=()=>localStorage.setItem(memberKey,JSON.stringify(groups));
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>projectSnapshot();
const palette=()=>typeof TOPO_PALETTE!=='undefined'?TOPO_PALETTE:['#8bafff','#68c4a2','#b48bec','#eead6f'];
const memberColor=id=>{const roster=rosterCache[activeGroup?.code]||[];const position=Math.max(0,roster.findIndex(m=>m.id===id));return palette()[position%palette().length]};
const lockKey=(kind,id)=>kind+':'+id;
const lockOwner=key=>remoteLocks.find(l=>l.key===key&&l.member!==memberId)?.member;
const selectionPrefix='cursor:topo:';
const remoteSelections=()=>remoteLocks.filter(l=>l.key.startsWith(selectionPrefix)&&l.member!==memberId).flatMap(l=>{const code=l.key.slice(selectionPrefix.length);const parts=code.split(':');return parts.length===3?[{member:l.member,kind:parts[1],id:parts[2]}]:[]});
const ownLock=key=>heldLocks.has(key);
const online=()=>Boolean(activeGroup);
const groupStatus=()=>!activeGroup?'Saved locally':failures?'Reconnecting · changes kept locally':notice?'Connected · edit needs review':dirty?'Saving to group…':realtimeJoined?'Saved · Realtime':'Saved · Polling';
const connectionDetail=()=>!activeGroup?'Solo':failures?'Database retrying':realtimeJoined?'Realtime channel open':'Polling fallback';
window.DevDenRealtimeDiagnostics={status:()=>({mode:connectionDetail(),joined:realtimeJoined,revision:activeGroup?.revision??null,dirty,failures,lastMessage:realtimeLastMessage,lastSignal:realtimeLastSignal})};
const emitGroupStatus=()=>window.dispatchEvent(new Event('devden-group-status'));
window.DevDenGroupStatus={current:groupStatus};
async function lease(key,release=false,cursor=-1,force=false){if(!activeGroup)return true;const group=activeGroup;try{
 const response=await rpc('devden_lock_object',{p_code:group.code,p_member_id:memberId,p_object:key,p_release:release,p_cursor:cursor});
 if(activeGroup!==group)return false;
 if(response?.removed){removed(group);return false}
 if(release)heldLocks.delete(key);else if(response?.ok)heldLocks.set(key,Date.now());
 else if(response?.owner){heldLocks.delete(key);remoteLocks=remoteLocks.filter(l=>l.key!==key);remoteLocks.push({key,member:response.owner});}
 updateVisualLocks();return Boolean(response?.ok);
 }catch(e){if(!release)heldLocks.delete(key);updateVisualLocks();console.warn('Lock request failed',e);return false}}
function releaseLocks(){for(const key of heldLocks.keys())void lease(key,true);heldLocks.clear();}
const pendingLocks=new Map();
async function acquire(ref){
 if(!activeGroup)return true;
 const key=lockKey(ref.kind,ref.id);
 if(lockOwner(key)){updateVisualLocks();return false}
 if(ownLock(key))return true;
 if(pendingLocks.has(key))return pendingLocks.get(key);
 const promise=lease(key).then(ok=>{
  if(!ok)updateVisualLocks()
  return ok;
 }).finally(()=>pendingLocks.delete(key));
 pendingLocks.set(key,promise);
 return promise;
}
async function acquireMany(refs){
 if(!activeGroup)return true;
 const ordered=[...new Map(refs.filter(Boolean).map(ref=>[lockKey(ref.kind,ref.id),ref])).values()]
  .sort((a,b)=>lockKey(a.kind,a.id).localeCompare(lockKey(b.kind,b.id)));
 const acquired=[];
 for(const ref of ordered){
  const key=lockKey(ref.kind,ref.id),wasOurs=ownLock(key);
  if(!await acquire(ref)){
   for(const released of acquired)await lease(released,true);
   return false;
  }
  if(!wasOurs)acquired.push(key);
 }
 return true;
}
async function finishEdits(refs){
 if(!activeGroup)return;
 const keys=[...new Set(refs.filter(Boolean).map(r=>lockKey(r.kind,r.id)))];
 if(!keys.length)return;
 if(!busy)await sync();
 let attempts=0;
 while(activeGroup&&(dirty||busy)&&attempts++<12){
  await new Promise(resolve=>setTimeout(resolve,300));
  if(!busy)await sync();
 }
 if(!dirty&&!busy){for(const key of keys)if(ownLock(key))await lease(key,true)}
 updateVisualLocks();
}
async function finishEdit(ref){return finishEdits([ref])}

window.DevDenCollab={paint:updateVisualLocks,connected:online,acquire,acquireMany,finishEdit,finishEdits,
 requestTakeover(){/* First owner keeps the object; ordinary clicks cannot steal it. */},
 canEdit(el){if(!activeGroup||!el)return true;const kind=el.dataset.device?'device':el.dataset.zone?'zone':el.dataset.note?'note':'link';const id=el.dataset.device||el.dataset.zone||el.dataset.note||el.dataset.link;return !lockOwner(lockKey(kind,id))},
 canEditRef(ref){return !activeGroup||!lockOwner(lockKey(ref.kind,ref.id))},isGroupActive(){return !!activeGroup},notesEditable(id){return !activeGroup||ownLock(lockKey('notes',id))},
 warn(){updateVisualLocks();}};
function updateVisualLocks(){
 const board=document.getElementById('topo-board');if(board){board.querySelectorAll('.devden-collab-tag').forEach(e=>e.remove());board.querySelectorAll('[data-device],[data-zone],[data-note],[data-link]').forEach(el=>{
 const kind=el.dataset.device?'device':el.dataset.zone?'zone':el.dataset.note?'note':'link',id=el.dataset.device||el.dataset.zone||el.dataset.note||el.dataset.link;
 if(!id||el.classList.contains('topo-wire-hit'))return;
 const key=lockKey(kind,id),owner=lockOwner(key),ours=ownLock(key);const viewers=remoteSelections().filter(x=>x.kind===kind&&x.id===id);const viewing=!owner&&viewers.length>0;el.classList.toggle('devden-remote-lock',!!owner);el.classList.toggle('devden-own-lock',!owner&&ours);el.classList.toggle('devden-remote-selected',viewing);
 el.style.setProperty('--collab-color',owner?memberColor(owner):viewing?memberColor(viewers[0].member):memberColor(memberId));
 if(owner||viewing){const tag=document.createElement('span');tag.className='devden-collab-tag';const observer=owner||viewers[0]?.member;const person=(rosterCache[activeGroup?.code]||[]).find(m=>m.id===observer);tag.textContent=(person?.name||'?').slice(0,1).toUpperCase();tag.title=(person?.name||'Another member')+(owner?' is editing':' has selected this');el.append(tag)}
 })}
 const editor=document.getElementById('notes-editor');if(editor&&active==='notes'){
 const pageId=notesPage()?.id, key=pageId?lockKey('notes',pageId):null;
 const allowed=!activeGroup||(key&&ownLock(key));
 editor.contentEditable=allowed?'true':'false';
 editor.classList.toggle('devden-notes-readonly',!allowed);
 editor.title=!allowed&&lockOwner(key)?'This page is being edited by another member':(!allowed?'Click to request editing access':'');
 const status=document.getElementById('notes-status');
 if(status&&activeGroup&&!allowed)status.textContent=lockOwner(key)?'Page locked by another member':'Click page to edit';

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
async function refreshLocks(){
 if(!activeGroup)return;
 const g=activeGroup,started=Date.now();
 try{
  const list=await rpc('devden_list_locks',{p_code:g.code,p_member_id:memberId});
  if(activeGroup!==g)return;
  if(list?.removed){removed(g);return}
  if(!Array.isArray(list))return;
  const changed=JSON.stringify(remoteLocks)!==JSON.stringify(list);
  remoteLocks=list;
  const owned=new Set(list.filter(l=>l.member===memberId).map(l=>l.key));
  let ownershipChanged=false;
  // Never invalidate a lock granted AFTER this snapshot request began.
  for(const [key,grantedAt] of heldLocks){
   if(!owned.has(key)&&grantedAt<started){heldLocks.delete(key);ownershipChanged=true}
  }
  if(changed||ownershipChanged)updateVisualLocks();
 }catch(e){console.warn('Presence temporarily unavailable',e)}
}
// Renew leases even during a long drag, when document synchronization is paused.
const renewingLocks=new Set();
setInterval(()=>{
 if(!activeGroup)return;
 const now=Date.now();
 for(const [key,renewed] of heldLocks){
  const interval=key.startsWith('cursor:')&&!groupHasPeers()?6500:3500;
  if(now-renewed<interval||renewingLocks.has(key))continue;
  renewingLocks.add(key);
  // Update the timestamp only after successful renewal, not before the RPC.
  void lease(key,false).finally(()=>renewingLocks.delete(key));
 }
},1000);
let lastLockRefresh=0;
// Separate presence refresh from document reads, so idle polling does not delay selections.
const LOCK_REFRESH_INTERVAL_MS=1500;
let lockRefreshInFlight=false;
setInterval(async()=>{
 if(!activeGroup||document.hidden||lockRefreshInFlight)return;
 const interval=groupHasPeers()?LOCK_REFRESH_INTERVAL_MS:6000;
 if(Date.now()-lastLockRefresh<interval)return;
 lockRefreshInFlight=true;
 try{await refreshLocks();lastLockRefresh=Date.now()}finally{lockRefreshInFlight=false}
},LOCK_REFRESH_INTERVAL_MS);
let selectionTimer=null,notesCursorTimer=null;
let selectedPresenceKey=null;
const selectionPresenceKeys=new Set();
window.addEventListener('devden-topo-selection',()=>{
 if(!activeGroup)return;
 const selected=(typeof topoSelected!=='undefined'&&topoSelected)?topoSelected:null;
 const next=selected&&['device','zone','note','link'].includes(selected.kind)?selectionPrefix+memberId+':'+selected.kind+':'+selected.id:null;
 if(next===selectedPresenceKey)return;
 clearTimeout(selectionTimer);
 selectedPresenceKey=next;
 selectionTimer=setTimeout(async()=>{
  for(const key of [...selectionPresenceKeys])if(key!==selectedPresenceKey){selectionPresenceKeys.delete(key);await lease(key,true)}
  if(next&&next===selectedPresenceKey){selectionPresenceKeys.add(next);const ok=await lease(next,false);if(!ok)selectionPresenceKeys.delete(next)}
 },80);
});
window.addEventListener('devden-notes-cursor',e=>{if(!online()||active!=='notes')return;const key='cursor:notes:'+e.detail.page+':'+memberId;
 for(const old of heldLocks.keys())if(old.startsWith('cursor:notes:')&&old!==key)void lease(old,true);
 clearTimeout(notesCursorTimer);notesCursorTimer=setTimeout(()=>void lease(key,false,e.detail.pos),170)
});
window.addEventListener('devden-notes-blur',()=>{clearTimeout(notesCursorTimer);for(const old of heldLocks.keys())if(old.startsWith('cursor:notes:'))void lease(old,true)});

const makeCode=()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return [...bytes].map(b=>alphabet[b%alphabet.length]).join('')};
const rpc=async(name,payload={})=>{
 if(!ready)throw Error('Live Groups is currently unavailable.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{const res=await fetch(config.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{'apikey':config.anonKey,'Authorization':'Bearer '+config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl.signal});const data=await res.json();if(!res.ok)throw Error(data.message||'Group service returned '+res.status);return data}finally{clearTimeout(timer)}
};
const groupButton=group=>`<button type="button" class="group-choice ${selectedCode===group.code?'selected':''}" data-select="${escapeHTML(group.code)}"><span class="group-choice-name">${escapeHTML(group.name)}</span>${activeGroup?.code===group.code&&!failures?'<span class="group-active-dot" aria-label="Connected"></span>':''}<span class="group-choice-arrow">›</span></button>`;
const memberView=(group)=>{
 const roster=rosterCache[group.code];
 if(!roster)return '<p class="group-member-empty">'+(rosterErrors[group.code]?'Members unavailable':'Loading members…')+'</p>';
 if(!roster.length)return '<p class="group-member-empty">No members.</p>';
 const leader=roster[0]?.id,meLeader=leader===memberId;
 return roster.map(m=>`<div class="group-person"><span class="group-person-dot ${m.online?'online':''}"></span><span class="group-person-name">${escapeHTML(m.name)}${m.id===memberId?' <small>(You)</small>':''}${m.id===leader?' <small>(Leader)</small>':''}</span>${meLeader&&m.id!==memberId?`<button type="button" class="group-kick" data-kick="${escapeHTML(group.code)}" data-member="${escapeHTML(m.id)}" data-name="${escapeHTML(m.name)}">Kick</button>`:''}</div>`).join('');
};
const detail=group=>`<section class="group-detail"><div class="group-detail-top"><strong>${escapeHTML(group.name)}</strong><span>${activeGroup?.code===group.code?escapeHTML(connectionDetail()):'Offline'}</span></div><div class="group-nickname">${escapeHTML(group.nickname||'Unnamed')} <button type="button" data-rename="${escapeHTML(group.code)}">Edit</button></div><div class="group-code-line"><input readonly type="${visibleCodes.has(group.code)?'text':'password'}" aria-label="Join code" value="${escapeHTML(group.code)}"><button type="button" class="group-eye" data-eye="${escapeHTML(group.code)}" aria-label="Show join code">◉</button><button type="button" data-copy="${escapeHTML(group.code)}">Copy</button></div><div class="group-detail-actions"><button type="button" data-open="${escapeHTML(group.code)}">${activeGroup?.code===group.code?(failures?'Retry sync':'Connected'):'Connect'}</button>${activeGroup?.code===group.code?`<button type="button" data-disconnect="${escapeHTML(group.code)}">Disconnect</button>`:''}<button type="button" data-leave="${escapeHTML(group.code)}">Leave group</button></div>${(conflictDraft&&activeGroup?.code===group.code)||recoveryDrafts().some(d=>d.code===group.code)?'<button type="button" class="group-draft-button">Save recovery copy</button>':''}<div class="group-member-heading">Members <span>${(rosterCache[group.code]||[]).filter(m=>m.online).length} online</span></div><div class="group-people">${memberView(group)}</div></section>`;
const render=()=>{
 if(!groups.some(g=>g.code===selectedCode))selectedCode=null;
 const selected=groups.find(g=>g.code===selectedCode);
 $('group-memberships').innerHTML=groups.length?`<div class="group-choices">${groups.map(groupButton).join('')}</div>${selected?detail(selected):''}`:'<p class="group-empty">No groups joined yet.</p>';
 const display=dock.querySelector('.group-display'),dot=dock.querySelector('.group-status-dot'),subtitle=dock.querySelector('.group-subtitle');
 display.textContent=activeGroup?activeGroup.name:'Groups';if(subtitle){subtitle.hidden=!activeGroup;subtitle.textContent=activeGroup?(failures?'Reconnecting…':notice?'Connected · review edits':(rosterCache[activeGroup.code]||[]).filter(x=>x.online).length+' online · '+connectionDetail()):''}dot.hidden=!activeGroup&&!notice;dock.classList.toggle('group-error-state',Boolean(notice));dock.classList.toggle('group-reconnecting-state',Boolean(activeGroup&&failures&&!notice));dot.title=notice||connectionDetail();
 $('group-create').disabled=false;$('group-join').disabled=false;
 const hint=panel.querySelector('.group-availability');if(hint)hint.remove();
 panel.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{selectedCode=selectedCode===b.dataset.select?null:b.dataset.select;render();if(selectedCode)refreshRoster(selectedCode)});
 panel.querySelectorAll('.group-draft-button').forEach(b=>b.onclick=()=>{const recovered=recoveryDrafts().find(d=>d.code===selectedCode);const draft=conflictDraft||(recovered?.conflictProject)||recovered?.project;if(!draft)return;downloadRecovery(draft,(activeGroup?.name||groups.find(g=>g.code===selectedCode)?.name||'group')+' recovery');});
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
 try{const result=await rpc('devden_member_roster',{p_code:code,p_member_id:memberId});if(result?.removed){forgetMissing(code);return}if(!Array.isArray(result))throw Error('Invalid member list');const changed=JSON.stringify(rosterCache[code])!==JSON.stringify(result)||Boolean(rosterErrors[code]);rosterCache[code]=result;delete rosterErrors[code];if(changed&&selectedCode===code&&!panel.hidden)render()}
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
const open=v=>{panel.hidden=!v;dock.setAttribute('aria-expanded',String(v));dock.classList.toggle('opened',v);if(v){selectedCode=null;visibleCodes.clear();if(!conflictDraft)notice=null;render();validateGroups()}else{visibleCodes.clear()}};
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
 if(!activeGroup||failures)throw Error('Connect to a healthy group first.');
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
  group.revision=result.revision;realtimePublish(result.revision);
  baseDocument=structuredClone(snapshot);
  restoreProject(snapshot);
  navigate(active);
  lastSaved=JSON.stringify(current());
  dirty=false;failures=0;remoteConflict=false;conflictDraft=null;
  notice=null;
  render();
 }finally{busy=false}
}
window.DevDenGroupTransfers={connected:()=>Boolean(activeGroup&&!failures),name:()=>activeGroup?.name||'',saveFromGroup:saveGroupToSolo,uploadToGroup:shareSoloProject};
// Save locally recoverable project snapshots in the same backup format as the
// Templates importer. Never auto-merge an old draft into a newly joined group.
function recoveryDrafts(){try{const drafts=JSON.parse(localStorage.getItem(draftKey)||'[]');return Array.isArray(drafts)?drafts:[]}catch{return []}}
function saveRecovery(group=activeGroup){if(!group)return;try{
 const project=current();const drafts=recoveryDrafts().filter(d=>d.code!==group.code);
 drafts.push({code:group.code,name:group.name,time:new Date().toISOString(),project,conflictProject:conflictDraft?structuredClone(conflictDraft):null});
 localStorage.setItem(draftKey,JSON.stringify(drafts.slice(-8)));
}catch(e){console.warn('Cannot save group recovery copy',e)}}
function downloadRecovery(project,name){const file={format:'devden-project',project:{...structuredClone(project),name}};
 const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='DevDen-'+name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function backupSolo(){if(localStorage.getItem(soloKey))return;localStorage.setItem(soloKey,JSON.stringify(current()))}
function restoreSolo(){const raw=localStorage.getItem(soloKey);if(!raw)return;try{restoreProject(JSON.parse(raw));localStorage.removeItem(soloKey);navigate(active)}catch(e){alert('Could not restore Solo workspace: '+e.message)}}
function disconnect(){if(activeGroup&&(dirty||conflictDraft||JSON.stringify(current())!==lastSaved))saveRecovery();realtimeStop();syncWakePending=false;clearTimeout(selectionTimer);clearTimeout(notesCursorTimer);selectedPresenceKey=null;selectionPresenceKeys.clear();releaseLocks();remoteLocks=[];baseDocument=null;conflictDraft=null;clearTimeout(poll);poll=null;activeGroup=null;dirty=false;connecting=false;failures=0;remoteConflict=false;lastGroupActivity=0;lastRemoteActivity=0;lastRosterCheck=0;localStorage.removeItem(activeKey);restoreSolo();render();emitGroupStatus()}
async function connect(group,existing){if(connecting)return;if(activeGroup?.code===group.code){open(false);void sync();return}connecting=true;try{
 if(activeGroup)disconnect();const remote=existing||await rpc('devden_register_member',{p_code:group.code,p_member_id:memberId,p_nickname:group.nickname});if(!remote||!remote.document)throw Error('Group not found.');backupSolo();activeGroup={...group,revision:remote.revision};dirty=false;failures=0;remoteConflict=false;notice=null;conflictDraft=null;baseDocument=structuredClone(remote.document);restoreProject(remote.document);navigate(active);lastSaved=JSON.stringify(current());localStorage.setItem(activeKey,group.code);selectedCode=group.code;render();open(false);lastGroupActivity=Date.now();lastRemoteActivity=Date.now();lastRosterCheck=0;schedulePoll(GROUP_POLL_ACTIVE_MS);realtimeStart(activeGroup);emitGroupStatus();refreshRoster(group.code)
 }catch(e){alert('Unable to connect: '+e.message)}finally{connecting=false}}
let recoveryTimer=null;
window.addEventListener('devden-state-updated',()=>{if(activeGroup&&!applyingRemote){clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>saveRecovery(),2000);dirty=true;lastLocalActivity=Date.now();wakeSync(180);emitGroupStatus()}});
function removed(group){const name=group.name;forgetMissing(group.code);notice='Removed from '+name;render()}
async function sync(){
 if(movementPending||active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag)return;
if(!activeGroup||busy||movementPending)return;busy=true;const group=activeGroup;const previousStatus=failures+'|'+remoteConflict+'|'+String(notice);try{
 if(movementPending||active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag)return;
 if(window.DevDenSketch?.drawing?.())return;
 if(active==='notes'&&document.querySelector('.notes-ink-overlay.is-drawing'))return;
 if(active==='notes')notesCommit();const syncStart=lastLocalActivity;let local=current(),serialized=JSON.stringify(local);
 if(serialized!==lastSaved)dirty=true;
 const remote=await rpc('devden_member_read',{p_code:group.code,p_member_id:memberId});
 if(remote?.removed){removed(group);return}if(!remote?.document)throw Error('Group unavailable');
 if(activeGroup!==group)return;
 failures=0;
 if(lastLocalActivity!==syncStart||window.DevDenSketch?.drawing?.()||(active==='topology'&&typeof topoDrag!=='undefined'&&topoDrag))return;
 if(remote.revision!==group.revision){
  lastRemoteActivity=Date.now();
  if(active==='topology'&&(typeof topoDrag!=='undefined'&&topoDrag||Date.now()-lastLocalActivity<700||lastLocalActivity!==syncStart))return;
  const conflicts=[];const merged=DevDenMerge.reconcile(baseDocument||remote.document,local,remote.document,'',conflicts);
  if(conflicts.length){
   // Preserve unresolved edits for explicit recovery without disconnecting anyone.
   conflictDraft=structuredClone(local);notice='Overlapping edit saved for recovery';
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
  if(activeGroup!==group)return;
  if(result?.removed){removed(group);return}
  if(result?.ok){group.revision=result.revision;realtimePublish(result.revision);baseDocument=structuredClone(local);lastSaved=JSON.stringify(local);dirty=JSON.stringify(current())!==lastSaved;remoteConflict=false;if(!conflictDraft){notice=null;if(!dirty){clearTimeout(recoveryTimer);localStorage.setItem(draftKey,JSON.stringify(recoveryDrafts().filter(d=>d.code!==group.code)))}}}
  else if(result?.locked){notice='Item locked by another member · your changes remain local';remoteConflict=false;await refreshLocks();dirty=true;render();return}
  else {dirty=true;return} // Revision raced again; reconcile on the next poll.
 }else{lastSaved=JSON.stringify(local);remoteConflict=false;if(!conflictDraft)notice=null}
 failures=0;if(previousStatus!==failures+'|'+remoteConflict+'|'+String(notice))render();
 if(Date.now()-lastRosterCheck>=15000){lastRosterCheck=Date.now();void refreshRoster(group.code)}

 }catch(e){if(activeGroup===group){failures++;console.warn('Group sync',e);render()}}finally{busy=false;emitGroupStatus();if(syncWakePending&&activeGroup===group){syncWakePending=false;schedulePoll(0)}}}
window.addEventListener('pagehide',()=>{if(activeGroup&&(dirty||conflictDraft||JSON.stringify(current())!==lastSaved))saveRecovery()});
if(localStorage.getItem(activeKey)){localStorage.removeItem(activeKey);restoreSolo()}
render();validateGroups();document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastGroupActivity=Date.now();wakeSync(0);void refreshLocks();validateGroups()}else if(activeGroup)schedulePoll(GROUP_POLL_HIDDEN_MS)});
})();
