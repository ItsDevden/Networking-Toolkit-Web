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
let remoteConflict=false;
try{groups=JSON.parse(localStorage.getItem(memberKey)||'[]');if(!Array.isArray(groups))groups=[];}catch{groups=[]}
const saveGroups=()=>localStorage.setItem(memberKey,JSON.stringify(groups));
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>projectSnapshot();
const makeCode=()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return [...bytes].map(b=>alphabet[b%alphabet.length]).join('')};
const rpc=async(name,payload={})=>{
 if(!ready)throw Error('Live Groups is currently unavailable.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{const res=await fetch(config.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{'apikey':config.anonKey,'Authorization':'Bearer '+config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl.signal});const data=await res.json();if(!res.ok)throw Error(data.message||'Group service returned '+res.status);return data}finally{clearTimeout(timer)}
};
const row=group=>`<div class="group-member-row"><span class="group-name">${escapeHTML(group.name)}</span><div class="group-nickname">Joining as: <strong>${escapeHTML(group.nickname||"Unnamed")}</strong> <button type="button" data-rename="${escapeHTML(group.code)}" aria-label="Change your display name">Edit</button></div><div class="group-code-line"><input readonly type="password" aria-label="Join code" value="${escapeHTML(group.code)}"><button class="group-eye" data-eye="${escapeHTML(group.code)}" title="Show or hide join code" aria-label="Show or hide join code">◉</button><button data-copy="${escapeHTML(group.code)}" title="Copy join code">Copy</button></div><div class="group-row-actions"><button data-open="${escapeHTML(group.code)}">${activeGroup?.code===group.code?(failures?'Reconnect':'Connected'):'Connect'}</button>${activeGroup?.code===group.code?'<button data-solo-copy="'+escapeHTML(group.code)+'">Save to Solo</button><button data-share-solo="'+escapeHTML(group.code)+'">Share Solo</button><button data-disconnect="'+escapeHTML(group.code)+'">Disconnect</button>':''}<button data-leave="${escapeHTML(group.code)}">Leave</button></div></div>`;
const render=()=>{
 $('group-memberships').innerHTML=groups.length?groups.map(row).join(''):'<p class="group-empty">No groups joined yet.</p>';
 const display=dock.querySelector('.group-display'),dot=dock.querySelector('.group-status-dot');
 display.textContent=activeGroup?activeGroup.name:'Groups';dot.hidden=!activeGroup||failures>0||remoteConflict;
 $('group-create').disabled=false;$('group-join').disabled=false;
 const hint=panel.querySelector('.group-availability');hint.textContent=ready?'Join with a code. Only your joined groups are listed.':'Live Groups is currently unavailable.';
 panel.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=()=>disconnect());
 panel.querySelectorAll('[data-solo-copy]').forEach(b=>b.onclick=()=>saveGroupToSolo());
 panel.querySelectorAll('[data-share-solo]').forEach(b=>b.onclick=()=>shareSoloProject());
 panel.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>{const g=groups.find(x=>x.code===b.dataset.rename);if(!g)return;dialog('Your name in '+g.name,`<label>Display name<input id="group-display-name" value="${escapeHTML(g.nickname||'')}" required autocomplete="nickname"></label>`,async d=>{const name=d.querySelector('#group-display-name').value.trim();if(!name)throw Error('Enter a display name.');g.nickname=name;saveGroups();if(ready)await rpc('devden_register_member',{p_code:g.code,p_member_id:memberId,p_nickname:name});render()})});
 panel.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const input=b.parentNode.querySelector('input');input.type=input.type==='password'?'text':'password';b.setAttribute('aria-label',input.type==='password'?'Show join code':'Hide join code')});
 panel.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(b.dataset.copy).then(()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1100)}).catch(()=>window.prompt('Copy join code',b.dataset.copy)));
 panel.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const g=groups.find(x=>x.code===b.dataset.open);if(g)connect(g)});
 panel.querySelectorAll('[data-leave]').forEach(b=>b.onclick=async()=>{const g=groups.find(x=>x.code===b.dataset.leave);if(!g||!confirm('Leave '+g.name+'? You will need its code to join again.'))return;if(activeGroup?.code===g.code)disconnect();if(ready)await rpc('devden_member_leave',{p_code:g.code,p_member_id:memberId}).catch(()=>{});groups=groups.filter(x=>x.code!==g.code);saveGroups();render()});
};
const open=v=>{panel.hidden=!v;dock.setAttribute('aria-expanded',String(v));dock.classList.toggle('opened',v)};
dock.onclick=()=>open(panel.hidden);$('group-close').onclick=()=>open(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false)});
document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!dock.contains(e.target))open(false)});
function dialog(title,markup,run){const d=document.createElement('dialog');d.className='group-dialog';d.innerHTML=`<form method="dialog"><header><strong>${title}</strong><button type="button" data-dismiss aria-label="Close">×</button></header>${markup}<p class="group-error" role="alert"></p><footer><button type="button" data-dismiss>Cancel</button><button id="group-submit" type="button">Continue</button></footer></form>`;document.body.append(d);d.showModal();d.addEventListener('close',()=>d.remove());d.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',()=>d.close()));d.querySelector('#group-submit').onclick=async()=>{const button=d.querySelector('#group-submit');button.disabled=true;const error=d.querySelector('.group-error');error.textContent='';try{await run(d);d.close()}catch(e){error.textContent=e.message;button.disabled=false}}}
$('group-create').onclick=()=>dialog('Create group','<label>Group name<input id="group-new-name" maxlength="64" required placeholder="Cisco Lab"></label><label>Your display name in this group<input id="group-create-nickname" required autocomplete="nickname" placeholder="Router Goblin"></label>',async d=>{const name=d.querySelector('#group-new-name').value.trim();if(!name)throw Error('Enter a group name.');const nickname=d.querySelector('#group-create-nickname').value.trim();if(!nickname)throw Error('Enter your display name.');const code=makeCode();const response=await rpc('devden_create_group',{p_code:code,p_name:name,p_document:current()});if(!response)throw Error('Could not create group.');await rpc('devden_register_member',{p_code:code,p_member_id:memberId,p_nickname:nickname});const g={code,name,nickname};groups.push(g);saveGroups();render();await connect(g)});
$('group-join').onclick=()=>dialog('Join group','<label>Join code<input id="group-join-code" maxlength="20" autocomplete="off" spellcheck="false" placeholder="XXXXXXXXXXXX"></label><label>Your display name in this group<input id="group-join-nickname" required autocomplete="nickname" placeholder="Router Goblin"></label>',async d=>{const code=d.querySelector('#group-join-code').value.toUpperCase().replace(/[^A-Z2-9]/g,'');if(code.length!==12)throw Error('Enter the 12-character join code.');const nickname=d.querySelector('#group-join-nickname').value.trim();if(!nickname)throw Error('Enter your display name.');const remote=await rpc('devden_register_member',{p_code:code,p_member_id:memberId,p_nickname:nickname});if(!remote)throw Error('Group not found. Check the code.');let g=groups.find(x=>x.code===code);if(!g){g={code,name:remote.name,nickname};groups.push(g);saveGroups()}else{g.nickname=nickname;saveGroups()}render();await connect(g,remote)});
function addSoloProject(snapshot,name){
 const library=templateLibrary();
 library.push({id:'group-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8),name,...structuredClone(snapshot)});
 saveTemplateLibrary(library);
}
function saveGroupToSolo(){
 if(!activeGroup)return;
 try{addSoloProject(current(),activeGroup.name+' (Group copy)');alert('Saved a separate copy to Templates in your Solo project library.');}
 catch(e){alert('Unable to save Solo copy: '+e.message)}
}
function shareSoloProject(){
 if(!activeGroup)return;
 const library=templateLibrary().filter(x=>x.version===2&&x.state&&x.topology);
 if(!library.length){alert('No complete Solo projects found. Save one using Templates first.');return;}
 dialog('Share Solo project',`<label>Choose a saved Solo project<select id="group-solo-template">${library.map(x=>`<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)}</option>`).join('')}</select></label><p>This replaces the current Group configuration for everyone. Your Solo copy stays unchanged.</p>`,async d=>{
  const selected=library.find(x=>x.id===d.querySelector('#group-solo-template').value);
  if(!selected)throw Error('Select a Solo project.');
  if(!confirm('Replace the shared configuration in '+activeGroup.name+' with '+selected.name+'?'))throw Error('Cancelled.');
  if(busy)throw Error('Synchronization in progress. Try again.');
  const group=activeGroup;
  const remote=await rpc('devden_member_read',{p_code:group.code,p_member_id:memberId});
  if(!remote||remote.removed)throw Error('The group is no longer accessible.');
  if(remote.revision!==group.revision)throw Error('The group was updated by another member. Reconnect first.');
  const result=await rpc('devden_member_update',{p_code:group.code,p_member_id:memberId,p_revision:group.revision,p_document:{version:2,state:structuredClone(selected.state),topology:structuredClone(selected.topology)}});
  if(!result?.ok)throw Error('Someone updated the group. Reconnect before sharing.');
  group.revision=result.revision;
  restoreProject(selected);navigate(active);
  lastSaved=JSON.stringify(current());dirty=false;failures=0;render();
 });
}
function backupSolo(){if(localStorage.getItem(soloKey))return;localStorage.setItem(soloKey,JSON.stringify(current()))}
function restoreSolo(){const raw=localStorage.getItem(soloKey);if(!raw)return;try{restoreProject(JSON.parse(raw));localStorage.removeItem(soloKey);navigate(active)}catch(e){alert('Could not restore Solo workspace: '+e.message)}}
function disconnect(){if(poll)clearInterval(poll);poll=null;activeGroup=null;dirty=false;connecting=false;failures=0;remoteConflict=false;localStorage.removeItem(activeKey);restoreSolo();render()}
async function connect(group,existing){if(connecting)return;if(activeGroup?.code===group.code&&!failures&&!remoteConflict){open(false);return}if(activeGroup?.code===group.code){disconnect()}connecting=true;try{
 if(activeGroup)disconnect();const remote=existing||await rpc('devden_register_member',{p_code:group.code,p_member_id:memberId,p_nickname:group.nickname});if(!remote||!remote.document)throw Error('Group not found.');backupSolo();activeGroup={...group,revision:remote.revision};dirty=false;failures=0;remoteConflict=false;restoreProject(remote.document);navigate(active);lastSaved=JSON.stringify(current());localStorage.setItem(activeKey,group.code);render();open(false);poll=setInterval(sync,1800)
 }catch(e){alert('Unable to connect: '+e.message)}finally{connecting=false}}
window.addEventListener('devden-state-updated',()=>{if(activeGroup&&!busy)dirty=true});
function removed(group){disconnect();groups=groups.filter(x=>x.code!==group.code);saveGroups();render();alert('You have been removed from this group, or the group was deleted.')}
async function sync(){if(!activeGroup||busy)return;busy=true;const group=activeGroup;try{
 if(active==='notes')notesCommit();const local=current(),serialized=JSON.stringify(local);if(serialized!==lastSaved)dirty=true;
 if(dirty){const result=await rpc('devden_member_update',{p_code:group.code,p_member_id:memberId,p_revision:group.revision,p_document:local});if(result?.removed){removed(group);return}if(!result?.ok){try{addSoloProject(local,group.name+' (Unsynced conflict copy)')}catch(e){alert('Unable to save conflict backup: '+e.message)}alert('Another member edited this group at the same time. Your unsynced changes were saved in Templates as an independent Solo copy. Reconnect to load the shared version.');clearInterval(poll);poll=null;failures=1;remoteConflict=true;render();return}group.revision=result.revision;lastSaved=serialized;dirty=false}
 else{const remote=await rpc('devden_member_read',{p_code:group.code,p_member_id:memberId});if(remote?.removed){removed(group);return}if(!remote)throw Error('Group unavailable');if(remote.revision!==group.revision){group.revision=remote.revision;restoreProject(remote.document);navigate(active);lastSaved=JSON.stringify(current())}}
 failures=0;render()
 }catch(e){failures++;render()}finally{busy=false}}
if(localStorage.getItem(activeKey)){localStorage.removeItem(activeKey);restoreSolo()}
render();
})();
