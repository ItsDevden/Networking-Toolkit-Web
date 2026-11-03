(()=>{
'use strict';
const $=id=>document.getElementById(id), trigger=$('admin-login-trigger'),dock=$('admin-dock');
if(!trigger||!dock)return;
const config=window.DEVDEN_GROUP_CONFIG||{}, url=String(config.url||'').replace(/\/$/,''), key=config.anonKey||'';
let token='',refresh='',expiry=0;try{const saved=JSON.parse(sessionStorage.getItem('devden-admin-session')||'null');if(saved){token=saved.token||'';refresh=saved.refresh||'';expiry=saved.expiry||0}}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const configured=()=>url.startsWith('https://')&&key.length>20;
function popup(title,html){const old=$('devden-admin-dialog');if(old)old.close();const d=document.createElement('dialog');d.id='devden-admin-dialog';d.className='admin-modal';d.innerHTML=`<header><strong>${esc(title)}</strong><button type="button" data-close aria-label="Close admin window">×</button></header><div class="admin-body">${html}</div>`;document.body.append(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d}
async function request(path,data,bearer){const res=await fetch(url+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+(bearer||key),'Content-Type':'application/json'},body:JSON.stringify(data||{})});const json=await res.json().catch(()=>({}));if(!res.ok)throw Error(json.msg||json.message||json.error_description||'Request failed');return json}
async function ensureToken(){if(!token)throw Error('Please sign in again.');if(Date.now()<expiry-60000)return token;if(!refresh)throw Error('Session expired.');const r=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:refresh},key);token=r.access_token;refresh=r.refresh_token;expiry=Date.now()+r.expires_in*1000;sessionStorage.setItem('devden-admin-session',JSON.stringify({token,refresh,expiry}));return token}
async function adminRpc(name,args={}){return request('/rest/v1/rpc/'+name,args,await ensureToken())}
function loggedIn(v){dock.hidden=!v;if(!v){token='';refresh='';expiry=0;sessionStorage.removeItem('devden-admin-session')}else sessionStorage.setItem('devden-admin-session',JSON.stringify({token,refresh,expiry}))}

const viewState={search:'',filter:'all',page:0,expanded:null};
function activityLabel(date){if(!date)return 'No activity yet';const n=new Date(date).getTime();if(!Number.isFinite(n))return 'Unknown';const delta=Math.max(0,Date.now()-n);if(delta<120000)return 'Active recently';if(delta<3600000)return `${Math.floor(delta/60000)}m ago`;if(delta<86400000)return `${Math.floor(delta/3600000)}h ago`;return `${Math.floor(delta/86400000)}d ago`}
function renderDashboard(groups){
 const d=popup('DevDen Admin Panel',`<div class="admin-dashboard"><div class="admin-stats"></div><div class="admin-controls"><label class="admin-search-label"><span>Search groups</span><input id="admin-search" type="search" placeholder="Search by group name" autocomplete="off"></label><div class="admin-filters" role="group" aria-label="Group status"><button type="button" data-filter="all">All</button><button type="button" data-filter="online">Online</button><button type="button" data-filter="offline">Offline</button></div></div><div class="admin-results-count"></div><div id="admin-group-list" class="admin-group-list"></div><div class="admin-pagination"></div><p class="admin-error" role="alert"></p><div class="admin-foot"><button type="button" id="admin-refresh">Refresh</button><button type="button" id="admin-logout">Sign out</button></div></div>`);
 const body=d.querySelector('.admin-body'), perPage=20;
 const all=Array.isArray(groups)?groups:[];
 const members=all.flatMap(g=>g.members||[]), online=members.filter(m=>m.online).length;
 body.querySelector('.admin-stats').innerHTML=`<div><strong>${all.length}</strong><span>Groups</span></div><div><strong>${online}</strong><span>Online</span></div><div><strong>${members.length}</strong><span>Members</span></div>`;
 const search=body.querySelector('#admin-search');search.value=viewState.search;
 const error=body.querySelector('.admin-error');
 function paint(){
  const q=viewState.search.trim().toLocaleLowerCase();
  const filtered=all.filter(g=>String(g.name||'').toLocaleLowerCase().includes(q)&&(viewState.filter==='all'||(viewState.filter==='online'?(g.members||[]).some(m=>m.online):!(g.members||[]).some(m=>m.online))));
  const pages=Math.max(1,Math.ceil(filtered.length/perPage));viewState.page=Math.min(Math.max(0,viewState.page),pages-1);
  body.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===viewState.filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  body.querySelector('.admin-results-count').textContent=`${filtered.length} of ${all.length} groups`;
  const list=body.querySelector('#admin-group-list');
  const rows=filtered.slice(viewState.page*perPage,(viewState.page+1)*perPage);
  list.innerHTML=rows.length?rows.map(g=>{
   const count=(g.members||[]).length,on=(g.members||[]).filter(m=>m.online).length,opened=viewState.expanded===g.code;
   return `<section class="admin-list-item"><button type="button" class="admin-group-row" data-expand="${esc(g.code)}" aria-expanded="${opened}"><span class="admin-online-dot ${on?'online':''}" aria-hidden="true"></span><span class="admin-row-main"><strong>${esc(g.name)}</strong><small>${esc(activityLabel(g.updated_at))}</small></span><span class="admin-row-count">${count} members</span><span class="admin-row-online">${on} online</span><span class="admin-row-chevron">${opened?'⌃':'⌄'}</span></button>${opened?`<div class="admin-group-details"><div class="admin-detail-header"><strong>Members</strong><button type="button" class="admin-danger" data-delete="${esc(g.code)}">Delete group</button></div>${count?(g.members||[]).map(m=>`<div class="admin-member"><div><span class="admin-online-dot ${m.online?'online':''}" aria-hidden="true"></span>${esc(m.name)} <small>· ${m.online?'Online':'Offline'}</small></div><button type="button" data-kick="${esc(m.id)}" data-code="${esc(g.code)}">Kick</button></div>`).join(''):'<p class="admin-empty">No tracked members</p>'}</div>`:''}</section>`
  }).join(''):'<p class="admin-empty">No matching groups.</p>';
  list.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{viewState.expanded=viewState.expanded===b.dataset.expand?null:b.dataset.expand;paint()});
  {
   list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const g=all.find(x=>x.code===b.dataset.delete);if(!g||!confirm(`Permanently delete "${g.name}" and its shared configuration?`))return;b.disabled=true;try{await adminRpc('devden_admin_delete_group',{p_code:g.code});panel()}catch(e){error.textContent=e.message;b.disabled=false}});
   list.querySelectorAll('[data-kick]').forEach(b=>b.onclick=async()=>{const g=all.find(x=>x.code===b.dataset.code),m=g?.members?.find(x=>x.id===b.dataset.kick);if(!m||!confirm(`Remove "${m.name}" from "${g.name}"?`))return;b.disabled=true;try{await adminRpc('devden_admin_kick_member',{p_code:g.code,p_member_id:m.id});panel()}catch(e){error.textContent=e.message;b.disabled=false}})
  }
  const nav=body.querySelector('.admin-pagination');nav.innerHTML=`<button type="button" id="admin-prev" ${viewState.page===0?'disabled':''}>Previous</button><span>Page ${viewState.page+1} of ${pages}</span><button type="button" id="admin-next" ${viewState.page+1>=pages?'disabled':''}>Next</button>`;
  nav.querySelector('#admin-prev').onclick=()=>{viewState.page--;paint()};nav.querySelector('#admin-next').onclick=()=>{viewState.page++;paint()};
 }
 search.oninput=()=>{viewState.search=search.value;viewState.page=0;paint()};
 body.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{viewState.filter=b.dataset.filter;viewState.page=0;paint()});
 {body.querySelector('#admin-refresh').onclick=()=>panel();body.querySelector('#admin-logout').onclick=()=>{loggedIn(false);d.close()}}
 paint();return d
}
function login(){const d=popup('Admin Login',`<form id="admin-form"><label>Username<input type="text" name="username" required autocomplete="username" spellcheck="false"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label><p class="admin-error" role="alert"></p><div class="admin-foot"><button type="button" data-close>Cancel</button><button class="admin-primary" type="submit">Sign in</button></div></form>`);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());const form=d.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]'),error=form.querySelector('.admin-error');btn.disabled=true;error.textContent='';const username=form.elements.username.value.trim(),password=form.elements.password.value;
try{if(!configured())throw Error('Configure group-config.js and apply GROUP_ADMIN_SETUP.sql first.');if(!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(username))throw Error('Invalid username.');const email=username.toLowerCase()==='devden'?'devden.it@gmail.com':username.toLowerCase()+'@admin.devden.invalid';const r=await request('/auth/v1/token?grant_type=password',{email,password},key);token=r.access_token;refresh=r.refresh_token;expiry=Date.now()+r.expires_in*1000;await adminRpc('devden_admin_groups');loggedIn(true);d.close();panel()}catch(ex){loggedIn(false);error.textContent=ex.message;btn.disabled=false}}}

async function panel(){const d=popup('DevDen Admin Panel','<p class="admin-hint">Loading group activity…</p>');try{const groups=await adminRpc('devden_admin_groups');if(!d.open)return;d.close();renderDashboard(groups,false)}catch(e){if(d.open)d.querySelector('.admin-body').innerHTML=`<p class="admin-error">${esc(e.message)}</p><div class="admin-foot"><button type="button" data-close>Close</button></div>`;d.querySelector('[data-close]')?.addEventListener('click',()=>d.close());if(/authorized|session|jwt|token/i.test(e.message))loggedIn(false)}}
trigger.onclick=()=>token?panel():login();$('admin-open').onclick=()=>panel();if(token&&configured())adminRpc('devden_admin_groups').then(()=>loggedIn(true)).catch(()=>loggedIn(false));
})();