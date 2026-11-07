'use strict';
const $=id=>document.getElementById(id), el=(tag,attrs={},text='')=>{const e=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));e.textContent=text;return e};
const sections=[['TOOLS',[['Topology','topology'],['Network Chart','chart'],['Checklist','checklist'],['Notes','notes']]],['ADDRESS PLANNING',[['Subnetting','ipv4'],['VLSM Planner','vlsm'],['FLSM Planner','flsm']]],['REFERENCE',[['OSI Model','osi'],['Prefix Guide','prefixguide']]]];
const nav=$('navigation'),content=$('content');let active='ipv4',selectedGroup=0;
const defaults={sketches:{},flsm:1,v6flsm:4,ipRows:[Array(8).fill('')],flsmInventory:[],vlsmInventory:[],columnWidths:{},vlsm:[],cli:'Basic setup',osiLayer:7,osiStep:0,osiDirection:'send',osiScenario:'web',checklistDevices:[],checklistSelected:null,ipv4:0,ipv6:Array(8).fill('0000'),fields:{},notes:{version:1,pages:[],selected:null}};
function loadState(){try{const saved=JSON.parse(localStorage.getItem(toolkitStorageKey('devden-toolkit-v2'))||'null');if(!saved||typeof saved!=='object')return structuredClone(defaults);const out={...structuredClone(defaults),...saved};if(!Array.isArray(out.ipRows)||!Array.isArray(out.vlsm)||!Array.isArray(out.ipv6)||out.ipv6.length!==8||!out.fields||typeof out.fields!=='object')return structuredClone(defaults);if(!Array.isArray(out.flsmInventory))out.flsmInventory=out.ipRows.filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()));if(!Array.isArray(out.vlsmInventory))out.vlsmInventory=[];if(!out.columnWidths||typeof out.columnWidths!=='object')out.columnWidths={};for(const key of ['flsmInventory','vlsmInventory'])out[key]=out[key].filter(r=>Array.isArray(r)&&r.length===8).slice(0,10000).map(r=>r.map(v=>String(v??'')));out.ipRows=out.ipRows.filter(r=>Array.isArray(r)&&r.length===8).slice(0,10000).map(r=>r.map(v=>String(v??'')));out.vlsm=out.vlsm.filter(r=>Array.isArray(r)&&r.length===3).slice(0,4096).map(r=>r.map(v=>String(v??'')));out.ipv4=Number.isInteger(out.ipv4)&&out.ipv4>=0&&out.ipv4<=65535?out.ipv4:0;out.ipv6=out.ipv6.map(v=>/^[a-fA-F0-9]{4}$/.test(v)?v:'0000');return out}catch{return window.DEVDEN_EMBEDDED_CONFIG?.state?{...structuredClone(defaults),...structuredClone(window.DEVDEN_EMBEDDED_CONFIG.state)}:structuredClone(defaults)}}
let state=loadState(),history=[JSON.stringify(state)],historyIndex=0,restoring=false;
function checkpoint(){if(restoring)return;const snapshot=JSON.stringify(state);if(snapshot===history[historyIndex])return;history=history.slice(0,historyIndex+1);history.push(snapshot);if(history.length>100)history.shift();historyIndex=history.length-1;try{localStorage.setItem(toolkitStorageKey('devden-toolkit-v2'),snapshot);window.dispatchEvent(new Event('devden-state-updated'))}catch{}}
function travelHistory(direction){const next=historyIndex+direction;if(next<0||next>=history.length)return;historyIndex=next;restoring=true;state=JSON.parse(history[next]);navigate(active);restoring=false;try{localStorage.setItem(toolkitStorageKey('devden-toolkit-v2'),history[next])}catch{}}
document.addEventListener('keydown',e=>{if(active==='topology')return;if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const target=e.target;if(target.closest('input,textarea,[contenteditable="true"]'))return;const key=e.key.toLowerCase();if(key==='z'){e.preventDefault();travelHistory(e.shiftKey?1:-1)}else if(key==='y'){e.preventDefault();travelHistory(1)}});
document.addEventListener('change',e=>{if(active==='cli'||!content.contains(e.target))return;const inp=e.target;if(!inp.id||!['INPUT','SELECT'].includes(inp.tagName)||!['parent','target','count','prefix','group','decimal','hex','binary'].includes(inp.id))return;if(inp.id==='decimal'||inp.id==='hex'||inp.id==='binary'||(active==='ipv6'&&inp.id==='group'))return;state.fields[active+':'+inp.id]=inp.value;checkpoint()});
function navigate(k){if(window.DevDenSketch)window.DevDenSketch.leave();if(active==='notes'&&k!=='notes')notesCommit();content.classList.remove('notes-content');document.body.classList.remove('topo-fullscreen','chart-fullscreen');active=k;[...nav.querySelectorAll('button')].forEach(b=>b.classList.toggle('active',b.dataset.key===({'ipv6':'ipv4','v6flsm':'flsm'}[k]||k)));({ipv4:renderIpv4,ipv6:renderIpv6,vlsm:renderVlsm,flsm:renderFlsm,v6flsm:renderV6Flsm,commands:renderCommands,reference:renderReference,troubleshooting:renderTroubleshooting,cli:renderCli,checklist:renderChecklist,chart:renderNetworkChart,topology:renderTopology,osi:renderOSI,prefixguide:renderPrefixGuide,notes:()=>renderNotes()}[k])();polishWorkspace();window.DevDenSketch?.render();}
for(const [group,items] of sections){const section=el('section',{class:'nav-section','data-nav-group':group});section.append(el('div',{class:'nav-title'},group));nav.append(section);for(const [name,k] of items){const b=el('button',{'data-key':k},'');b.title=name;b.setAttribute('aria-label',name);const icon=el('i',{class:'nav-icon','aria-hidden':'true'});icon.innerHTML=navIcon(k);b.append(icon,el('span',{},name));b.onclick=()=>navigate(k);section.append(b)}}$('logo').onclick=()=>$('sidebar').classList.toggle('collapsed');
const title=(t,sub='')=>{
 content.innerHTML='';
 const heading=el('div',{class:'tool-title-row'});
 heading.append(el('h1',{},t));
 if(['ipv4','ipv6','flsm','v6flsm'].includes(active)){
  const modes=el('div',{class:'tool-mode-switch','role':'group','aria-label':'IP version'});
  const flsm=['flsm','v6flsm'].includes(active);
  for(const [name,key] of [['IPv4',flsm?'flsm':'ipv4'],['IPv6',flsm?'v6flsm':'ipv6']]){
   const b=el('button',{'type':'button','class':active===key?'selected':'','aria-pressed':String(active===key)},name);
   b.onclick=()=>navigate(key);modes.append(b);
  }
  heading.append(modes);
 }
 content.append(heading);
 document.body.dataset.tool=active;
};
const field=(label,id,value='',type='text')=>`<label>${label} <input id="${id}" type="${type}" value="${esc(state.fields[active+':'+id]??value)}"></label>`;
const btn=(text,id)=>`<button id="${id}">${text}</button>`;
function resetScope(kind){
 const names={flsm:'FLSM calculator',vlsm:'VLSM table',flsmInventory:'FLSM IP Plan',vlsmInventory:'VLSM IP Plan',ipv4:'IPv4 Subnetting',ipv6:'IPv6 Subnetting',v6flsm:'IPv6 FLSM'};
 if(!confirm('Reset '+names[kind]+' to defaults? This clears its saved values and column widths.'))return;
 if(kind==='flsm'){state.flsm=defaults.flsm;delete state.columnWidths['flsm-results'];}
 else if(kind==='vlsm'){state.vlsm=[];delete state.columnWidths['vlsm-results'];}
 else if(kind==='flsmInventory'||kind==='vlsmInventory'){state[kind]=[];delete state.columnWidths[kind.replace('Inventory','')+'-inventory'];}
 else if(kind==='ipv4'){state.ipv4=defaults.ipv4;}
 else if(kind==='ipv6'){state.ipv6=[...defaults.ipv6];selectedGroup=0;}
 else if(kind==='v6flsm'){state.v6flsm=defaults.v6flsm;}
 const fieldKey=kind.endsWith('Inventory')?null:kind;
 if(fieldKey)for(const key of Object.keys(state.fields))if(key.startsWith(fieldKey+':'))delete state.fields[key];
 checkpoint();navigate(active);
}
function wireReset(kind,id='reset'){const button=$(id);if(button)button.onclick=()=>resetScope(kind)}

const headers=(columns)=>`<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody id="results"></tbody></table></div>`;
const status=()=>'<div id="status" class="status"></div>';
function setStatus(s,err=false){$('status').textContent=s;$('status').classList.toggle('error',err);if(['flsm','v6flsm'].includes(active))updateAllocation()}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderRows(rows){$('results').innerHTML=rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
function getRows(){return [...$('results').querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.textContent))}
function copyTable(){const lines=[...content.querySelectorAll('table tr')].map(tr=>[...tr.children].map(c=>c.innerText).join('\t')).join('\n');copyValue(lines,$('copy'))}
function fallbackCopy(s){const ta=el('textarea');ta.value=s;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}
function download(name,body,mime='text/plain'){const a=el('a');a.href=URL.createObjectURL(new Blob([body],{type:mime}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function csv(rows){return rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(',')).join('\r\n')}
function exportCSV(filename){const rows=[...content.querySelectorAll('table tr')].map(tr=>[...tr.children].map(c=>c.innerText));download(filename,'\ufeff'+csv(rows),'text/csv')}
function xmlSafe(v){return String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function zipArchive(entries){const encoder=new TextEncoder(),chunks=[],directory=[];let offset=0;const u16=n=>[n&255,(n>>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];let crcTable=Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});for(const [name,body] of entries){const nb=encoder.encode(name),data=encoder.encode(body);let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...nb]);chunks.push(local,data);directory.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nb]));offset+=local.length+data.length}const directorySize=directory.reduce((a,b)=>a+b.length,0),end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(directorySize),...u32(offset),...u16(0)]);return new Blob([...chunks,...directory,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function exportStyledExcel(filename,sections){
 const letters=n=>{let result='';for(n++;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result};
 const colors={head:'FF243142',odd:'FF304155',even:'FF202C3C',section:'FF243142',edge:'FF101820'};
 const styleXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Aptos"/><color rgb="FF000000"/></font><font><sz val="11"/><name val="Aptos"/><color rgb="FFE1E8F1"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="13"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="${colors.head}"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="${colors.odd}"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="${colors.even}"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="${colors.edge}"/></left><right style="thin"><color rgb="${colors.edge}"/></right><top style="thin"><color rgb="${colors.edge}"/></top><bottom style="thin"><color rgb="${colors.edge}"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const entries=[['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Network Plan" sheetId="1" r:id="rId1"/></sheets></workbook>'],['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],['xl/styles.xml',styleXml]];
 let pos=1,maxcols=1;const rows=[],widths=[];
 const merges=[];
 const add=(cells,kind,stripe=0,width=0)=>{const number=pos++;if(kind==='gap'){rows.push(`<row r="${number}" ht="17" customHeight="1"/>`);return}const style=kind==='section'?4:kind==='header'?1:stripe%2?3:2;const height=kind==='section'?27:kind==='header'?28:25;const count=kind==='section'?2:Math.max(width,cells.length);const xml=Array.from({length:count},(_,i)=>{const value=kind==='section'&&i===1?'':String(cells[i]??'');const at=`${letters(i)}${number}`;return value?`<c r="${at}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlSafe(value)}</t></is></c>`:`<c r="${at}" s="${style}"/>`}).join('');if(kind==='section')merges.push(`A${number}:B${number}`);rows.push(`<row r="${number}" ht="${height}" customHeight="1">${xml}</row>`)};
 sections.forEach((section,i)=>{const rowsData=section.rows||[],head=rowsData[0]||[];if(i)add([], 'gap');maxcols=Math.max(maxcols,head.length);add([section.name],'section');add(head,'header',0,head.length);const entries=rowsData.slice(1).filter(row=>row.some(value=>String(value??'').trim()));const size=entries.length;for(let j=0;j<size;j++)add(entries[j]||[],'data',j,head.length);const sectionWidths=section.widths||[];head.forEach((header,k)=>{const desired=Math.round((Number(sectionWidths[k])||Math.max(125,String(header).length*11+30))/7);widths[k]=Math.max(widths[k]||0,Math.min(65,Math.max(15,desired)))})});
 const cols=Array.from({length:maxcols},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${widths[i]||19}" customWidth="1"/>`).join('');const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${letters(maxcols-1)}${pos-1}"/><sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;entries.push(['xl/worksheets/sheet1.xml',xml]);download(filename,zipArchive(entries),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
function exportExcel(filename){const table=content.querySelector('table');const rows=[...table.rows].map(tr=>[...tr.cells].map(c=>c.textContent.trim()));exportStyledExcel(filename.replace(/\.xls$/i,'.xlsx'),[{name:'Calculated Subnets',rows:rows,widths:[]}])}
function wireExports(label){$('copy').onclick=copyTable;if($('csv'))$('csv').onclick=()=>exportCSV(label+'.csv');if($('excel'))$('excel').onclick=()=>exportExcel(label+'.xlsx')}
function parseIPv4(ip){const xs=ip.trim().split('.');if(xs.length!==4||xs.some(x=>!/^(0|[1-9]\d{0,2})$/.test(x)||+x>255))throw Error('Invalid IPv4 address');return xs.reduce((v,x)=>((v<<8)>>>0)+Number(x),0)>>>0}
function ip4(n){return [24,16,8,0].map(s=>(n>>>s)&255).join('.')}
function ipv4cidr(x){const a=x.trim().split('/');if(a.length!==2||!/^\d{1,2}$/.test(a[1])||+a[1]>32)throw Error('Enter a valid IPv4 CIDR, e.g. 10.0.0.0/24');const p=+a[1],ip=parseIPv4(a[0]),mask=p===0?0:(0xffffffff<<(32-p))>>>0;return {ip,p,mask,net:(ip&mask)>>>0,size:2**(32-p)}}
function usable(net,p,size){return p===32?[ip4(net),ip4(net),1]:p===31?[ip4(net),ip4(net+1),2]:[ip4(net+1),ip4(net+size-2),Math.max(0,size-2)]}
function netRow(i,net,p){const size=2**(32-p),[first,last,hosts]=usable(net,p,size);return[i,ip4(net),'/'+p,ip4(p===0?0:(0xffffffff<<(32-p))>>>0),first,last,ip4((net+size-1)>>>0),hosts]}
function renderFlsm(){title('FLSM PLANNER','Divide a parent IPv4 network into equal-sized subnets. Select the results table, then Enter / Backspace to change the count.');content.insertAdjacentHTML('beforeend',`<div class="toolbar">${field('Parent IPv4 / CIDR:','parent','10.0.0.0/24')}${field('Subnets needed:','count',state.flsm,'number')}${btn('Calculate','calc')}${btn('Reset','reset')}${btn('Copy table','copy')}${btn('Export CSV','csv')}${btn('Export Excel','excel')}</div>${headers(['#','Network ID','CIDR','Subnet mask','First usable','Last usable','Broadcast','Usable hosts'])}${status()}${inventoryMarkup('flsm')}`);$('count').min=1;$('count').max=4096;function calc(){try{const c=ipv4cidr($('parent').value),n=Math.min(4096,Math.max(1,+$('count').value||1)),extra=Math.ceil(Math.log2(n)),p=c.p+extra;if(p>32)throw Error('Not enough addresses for that many subnets');const size=2**(32-p);renderRows(Array.from({length:n},(_,i)=>netRow(i+1,c.net+i*size,p)));state.flsm=n;checkpoint();setStatus(`Parent: ${ip4(c.net)}/${c.p}  |  Each subnet: /${p}, ${usable(0,p,size)[2]} usable hosts  |  ${n} shown, ${2**extra} possible equal subnets (${2**extra-n} unused).`)}catch(e){renderRows([]);setStatus(e.message,true)}}$('calc').onclick=calc;$('count').onchange=calc;$('parent').onchange=calc;$('results').tabIndex=0;$('results').title='Click a result, then press Enter to add or Backspace to remove a subnet';$('results').onclick=()=>{$('results').focus()};$('results').onkeydown=e=>{if(e.key!=='Enter'&&e.key!=='Backspace')return;if(e.target.closest('input,textarea,[contenteditable=true]'))return;e.preventDefault();e.stopPropagation();const current=Number($('count').value)||1;$('count').value=Math.max(1,Math.min(4096,current+(e.key==='Enter'?1:-1)));calc()};wireCombinedExports('IPv4-FLSM','flsm');wireReset('flsm');calc();setupInventory('flsm');enableColumnResize('flsm-results',content.querySelector('#results').closest('table'))}
function expand6(address){const str=address.toLowerCase().split('%')[0];if(!/^[a-f0-9:]+$/.test(str)||str.includes(':::'))throw Error('Invalid IPv6 address');const parts=str.split('::');if(parts.length>2)throw Error('Invalid IPv6 address');const left=parts[0]?parts[0].split(':'):[],right=parts.length===2&&parts[1]?parts[1].split(':'):[];if([...left,...right].some(p=>p.length>4||!p||!/^[a-f0-9]+$/.test(p)))throw Error('Invalid IPv6 block');const missing=8-left.length-right.length;if(parts.length===1?missing!==0:missing<1)throw Error('Invalid IPv6 address');return [...left,...Array(missing).fill('0'),...right].map(x=>x.padStart(4,'0'))}
function parse6(s){return BigInt('0x'+expand6(s).join(''))}
function format6(v){const parts=v.toString(16).padStart(32,'0').match(/.{4}/g).map(p=>parseInt(p,16).toString(16));let bestStart=-1,bestLen=0;for(let i=0;i<8;){if(parts[i]!=='0'){i++;continue}let j=i;while(j<8&&parts[j]==='0')j++;if(j-i>bestLen&&j-i>=2){bestStart=i;bestLen=j-i}i=j}if(bestStart<0)return parts.join(':');const l=parts.slice(0,bestStart).join(':'),r=parts.slice(bestStart+bestLen).join(':');return l+'::'+r}
function cidr6(text){const a=text.trim().split('/');if(a.length!==2||!/^(\d{1,3})$/.test(a[1])||+a[1]>128)throw Error('Enter valid IPv6 CIDR e.g. 2001:db8:1234::/48');return{ip:parse6(a[0]),p:+a[1]}}
function renderV6Flsm(){title('FLSM PLANNER','Divide an IPv6 prefix into equal-sized subnetworks.');content.insertAdjacentHTML('beforeend',`<div class="toolbar">${field('IPv6 network / CIDR:','parent','2001:db8:1234::/48')}${field('Target prefix /','target',64,'number')}${field('Show:','count',state.v6flsm,'number')}${btn('Calculate','calc')}${btn('Reset','reset')}${btn('Copy table','copy')}${btn('Export Excel','excel')}</div>${headers(['#','Network ID','Prefix','Addresses per subnet'])}${status()}`);$('count').min=1;$('count').max=4096;$('target').min=0;$('target').max=128;function calc(){try{const c=cidr6($('parent').value),p=+$('target').value,n=Math.max(1,Math.min(4096,+$('count').value||1));if(p<c.p||p>128)throw Error('Target prefix must be between parent prefix and /128');const avail=1n<<BigInt(p-c.p);if(BigInt(n)>avail)throw Error('Only '+avail+' subnets fit inside that parent');const base=(c.ip>>BigInt(128-c.p))<<BigInt(128-c.p),step=1n<<BigInt(128-p);renderRows(Array.from({length:n},(_,i)=>[i+1,format6(base+BigInt(i)*step),'/'+p,(1n<<BigInt(128-p)).toLocaleString('en-US')]));state.v6flsm=n;checkpoint();setStatus(`Parent /${c.p}  |  Target /${p}  |  ${n} shown  |  ${avail.toLocaleString()} possible subnets  |  Network bits: ${p}, interface bits: ${128-p}`)}catch(e){renderRows([]);setStatus(e.message,true)}}$('calc').onclick=calc;['parent','target','count'].forEach(id=>$(id).onchange=calc);$('results').tabIndex=0;const adjust=e=>{if(e.key!=='Enter'&&e.key!=='Backspace')return;if(e.target.matches('input,textarea,[contenteditable=true]'))return;e.preventDefault();$('count').value=Math.max(1,Math.min(4096,(+$('count').value||1)+(e.key==='Enter'?1:-1)));calc()};$('results').onkeydown=adjust;$('results').title='Click the table, then Enter adds or Backspace removes one subnet';$('results').onclick=()=>{$('results').focus()};wireExports('IPv6-FLSM');wireReset('v6flsm');calc()}
function renderVlsm(){
 title('VLSM PLANNER','One starting IP/CIDR and one editable allocation table. Enter a subnet name and host count, or override its prefix.');
 content.insertAdjacentHTML('beforeend',`<div class="toolbar">${field('Starting IP / CIDR:','parent','192.168.10.0/24')}${btn('Reset VLSM','reset')}${btn('Copy table','copy')}${btn('Export CSV','csv')}${btn('Export Excel','excel')}</div><div class="table-wrap"><table id="vlsm-grid"><thead><tr>${['Subnet','Hosts Needed','Network ID','Prefix','Subnet mask','First usable','Last usable','Broadcast','Usable hosts'].map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody id="vlsm-body"></tbody></table></div>${status()}${inventoryMarkup('vlsm')}`);
 const tbody=$('vlsm-body');let rows=state.vlsm.map(r=>({name:String(r[0]||''),hosts:String(r[1]||''),prefix:String(r[2]||'')}));if(!rows.length)rows=[];
 function blank(r){return !r.name.trim()&&!r.hosts.trim()&&!r.prefix.trim()}
 let anchor=null,selected=null,editing=null,drag=false;
 const columns=['name','hosts',null,'prefix',null,null,null,null,null];
 function bounds(){if(!anchor||!selected)return null;return [Math.min(anchor[0],selected[0]),Math.max(anchor[0],selected[0]),Math.min(anchor[1],selected[1]),Math.max(anchor[1],selected[1])]}
 function paintSelection(){tbody.querySelectorAll('.grid-selected,.grid-range').forEach(c=>c.classList.remove('grid-selected','grid-range'));const b=bounds();if(!b)return;for(let r=b[0];r<=b[1];r++)for(let c=b[2];c<=b[3];c++)tbody.rows[r]?.cells[c]?.classList.add('grid-range');tbody.rows[selected[0]]?.cells[selected[1]]?.classList.add('grid-selected')}
 function focusAt(r,c,extend=false){r=Math.max(0,Math.min(r,tbody.rows.length-1));c=Math.max(0,Math.min(c,8));if(!extend||!anchor)anchor=[r,c];selected=[r,c];const cell=tbody.rows[r]?.cells[c];cell?.focus();paintSelection();return cell}
 function render(fr=null,fc=null){const visible=[...rows,{name:'',hosts:'',prefix:''}];tbody.innerHTML=visible.map((r,i)=>`<tr data-row="${i}"><td class="vlsm-edit" data-col="name" tabindex="0">${esc(r.name)}</td><td class="vlsm-edit" data-col="hosts" tabindex="0">${esc(r.hosts)}</td><td data-out="network" tabindex="0"></td><td class="vlsm-edit ${r.prefix?'manual-prefix':''}" data-col="prefix" tabindex="0">${esc(r.prefix)}</td><td data-out="mask" tabindex="0"></td><td data-out="first" tabindex="0"></td><td data-out="last" tabindex="0"></td><td data-out="broadcast" tabindex="0"></td><td data-out="usable" tabindex="0"></td></tr>`).join('');calculate();if(fr!==null)focusAt(fr,typeof fc==='number'?fc:Math.max(0,columns.indexOf(fc)));else if(selected)paintSelection()}
 function save(r,c,value){if(!columns[c]||r>=4096)return;while(rows.length<=r)rows.push({name:'',hosts:'',prefix:''});rows[r][columns[c]]=String(value).trim();while(rows.length&&blank(rows[rows.length-1]))rows.pop();state.vlsm=rows.map(x=>[x.name,x.hosts,x.prefix]);checkpoint()}
 function finishEditing(commit=true,next=null){if(!editing)return;const {r,c,inp,before}=editing;editing=null;if(commit)save(r,c,inp.value);render(next?next[0]:r,next?next[1]:c)}
 function edit(cell,initial=null){if(editing||!cell?.classList.contains('vlsm-edit'))return;const r=+cell.parentElement.dataset.row,c=cell.cellIndex,before=c===3&&!rows[r]?.prefix?'':cell.textContent,inp=document.createElement('input');inp.className='vlsm-cell-input';inp.value=initial===null?before:initial;cell.textContent='';cell.append(inp);editing={r,c,inp,before};inp.focus();if(initial===null)inp.setSelectionRange(inp.value.length,inp.value.length);inp.addEventListener('blur',()=>{if(editing?.inp===inp)finishEditing(true)});inp.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishEditing(false);return}let target=null;if(e.key==='Enter')target=[r+(e.shiftKey?-1:1),c];else if(e.key==='Tab'){let opts=[0,1,3],index=opts.indexOf(c)+(e.shiftKey?-1:1),nr=r;if(index<0){nr--;index=2}else if(index>2){nr++;index=0}target=[nr,opts[index]]}else if(initial!==null&&e.key.startsWith('Arrow'))target=[r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0),c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)];if(target){e.preventDefault();e.stopPropagation();finishEditing(true,target)}})}
 function rangeText(){const b=bounds();if(!b)return '';const out=[];for(let r=b[0];r<=b[1];r++){const arr=[];for(let c=b[2];c<=b[3];c++)arr.push(tbody.rows[r]?.cells[c]?.textContent||'');out.push(arr.join('\t'))}return out.join('\n')}
 function clearRange(){const b=bounds();if(!b)return;for(let r=b[0];r<=b[1];r++)for(let c=b[2];c<=b[3];c++)if(columns[c]){while(rows.length<=r)rows.push({name:'',hosts:'',prefix:''});rows[r][columns[c]]=''}while(rows.length&&blank(rows[rows.length-1]))rows.pop();state.vlsm=rows.map(x=>[x.name,x.hosts,x.prefix]);checkpoint();render(b[0],b[2])}
 function pasteText(raw){if(!selected)return;const [r,c]=selected,matrix=raw.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));if(r+matrix.length>4096)return;for(let y=0;y<matrix.length;y++)for(let x=0;x<matrix[y].length&&c+x<9;x++)if(columns[c+x]){while(rows.length<=r+y)rows.push({name:'',hosts:'',prefix:''});rows[r+y][columns[c+x]]=matrix[y][x].trim()}while(rows.length&&blank(rows[rows.length-1]))rows.pop();state.vlsm=rows.map(x=>[x.name,x.hosts,x.prefix]);checkpoint();render(r,c)}
 tbody.addEventListener('pointerdown',e=>{const cell=e.target.closest('td');if(!cell||e.target.tagName==='INPUT')return;const r=+cell.parentElement.dataset.row,c=cell.cellIndex;if(editing){e.preventDefault();finishEditing(true,[r,c]);return}drag=true;focusAt(r,c,e.shiftKey)});
 tbody.addEventListener('pointerover',e=>{if(!drag||!selected)return;const cell=e.target.closest('td');if(cell)focusAt(+cell.parentElement.dataset.row,cell.cellIndex,true)});
 tbody.addEventListener('pointerup',()=>{drag=false});
 tbody.addEventListener('click',e=>{const cell=e.target.closest('td');if(cell&&!editing&&document.activeElement!==cell)focusAt(+cell.parentElement.dataset.row,cell.cellIndex,e.shiftKey)});
 tbody.addEventListener('dblclick',e=>{const cell=e.target.closest('.vlsm-edit');if(cell)edit(cell)});
 tbody.addEventListener('copy',e=>{if(!selected||editing)return;e.preventDefault();e.clipboardData.setData('text/plain',rangeText())});
 tbody.addEventListener('cut',e=>{if(!selected||editing)return;e.preventDefault();e.clipboardData.setData('text/plain',rangeText());clearRange()});
 tbody.addEventListener('paste',e=>{if(!selected||editing)return;e.preventDefault();pasteText(e.clipboardData.getData('text/plain'))});
 tbody.addEventListener('keydown',e=>{if(editing)return;const cell=e.target.closest('td');if(!cell)return;const r=+cell.parentElement.dataset.row,c=cell.cellIndex,editable=!!columns[c];if((e.ctrlKey||e.metaKey)&&!e.altKey){if(['c','v','x','z','y'].includes(e.key.toLowerCase()))return}if(e.key==='F2'){e.preventDefault();edit(cell);return}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();clearRange();return}if(e.key==='Enter'){e.preventDefault();focusAt(r+(e.shiftKey?-1:1),c);return}if(e.key==='Tab'){e.preventDefault();const opts=[0,1,3];let i=opts.indexOf(c)+(e.shiftKey?-1:1),nr=r;if(i<0){nr--;i=2}else if(i>=opts.length){nr++;i=0}focusAt(nr,opts[i]);return}if(e.key.startsWith('Arrow')){e.preventDefault();focusAt(r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0),c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0),e.shiftKey);return}if(editable&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();edit(cell,e.key)}});

 function calculate(){const statusEl=$('status');try{
   const value=$('parent').value.trim();const parts=value.split('/');if(parts.length>2)throw Error('Invalid starting IP/CIDR');const ip=parseIPv4(parts[0]);let start=ip,limit=2**32;
   if(parts.length===2){const parent=ipv4cidr(value);start=parent.net;limit=start+parent.size}
   let next=start,allocated=0,gaps=0;const results=new Map();const requests=[];
   for(let i=0;i<rows.length;i++){const r=rows[i],h=r.hosts.trim(),override=r.prefix.trim().replace(/^\//,'');if(!h&&!override)continue;
     if(h&&!/^[0-9]+$/.test(h))throw Error(`Row ${i+1}: Hosts Needed must be a positive whole number.`);const hosts=h?Number(h):0;if(hosts>4294967294||(h&&hosts<1))throw Error(`Row ${i+1}: Invalid host count.`);
     let prefix=30,size=4;if(override){if(!/^\d+$/.test(override)||+override>30)throw Error(`Row ${i+1}: manual prefix must be /0 to /30.`);prefix=+override;size=2**(32-prefix);if(hosts>size-2)throw Error(`Row ${i+1}: /${prefix} cannot hold ${hosts} hosts.`)}else{while(size<hosts+2&&prefix>0){size*=2;prefix--}}
     requests.push({i,prefix,size});
   }
   requests.sort((a,b)=>b.size-a.size);for(const r of requests){const aligned=Math.ceil(next/r.size)*r.size;if(aligned+r.size>limit)throw Error('Requests do not fit the starting network. Use a larger CIDR or reduce the hosts.');gaps+=aligned-next;next=aligned+r.size;allocated+=r.size;const network=aligned,broadcast=next-1,p=r.prefix;results.set(r.i,{network:ip4(network),prefix:'/'+p,mask:ip4(p===0?0:(0xffffffff<<(32-p))>>>0),first:ip4(network+1),last:ip4(broadcast-1),broadcast:ip4(broadcast),usable:r.size-2})}
   [...tbody.rows].forEach((tr,i)=>{const data=results.get(i)||{};tr.querySelectorAll('[data-out]').forEach(c=>c.textContent=data[c.dataset.out]??'');const pc=tr.querySelector('[data-col="prefix"]');if(!rows[i]?.prefix)pc.textContent=data.prefix||''});statusEl.textContent=requests.length?`${requests.length} subnets calculated. ${allocated.toLocaleString()} addresses allocated. ${gaps.toLocaleString()} skipped for alignment. Yellow prefixes are manual overrides.`:'Enter Hosts Needed or a manual Prefix. Press Enter or an arrow to finish editing.';statusEl.classList.remove('error');updateAllocation();
 }catch(e){tbody.querySelectorAll('[data-out]').forEach(c=>c.textContent='');statusEl.textContent=e.message;statusEl.classList.add('error');updateAllocation()}}
 $('parent').oninput=calculate;wireReset('vlsm');wireCombinedExports('VLSM','vlsm');render();setupInventory('vlsm');enableColumnResize('vlsm-results',$('vlsm-grid'));
}
const inventoryLabels=['Device','Interface / Port','IP Address','Prefix / Mask','VLAN','Default Gateway','Role','Notes'];
function inventoryMarkup(kind){return `<section class="attached-inventory" data-inventory="${kind}"><div class="inventory-toolbar"><h2>IP Plan</h2>${btn('Reset IP Plan','reset-inventory-'+kind)}${btn('Export CSV','export-'+kind)}<input type="search" id="filter-${kind}" placeholder="Find device, IP, VLAN…"><span class="inventory-hint">Click to select, double-click or F2 to edit; type to replace. Drag edges to resize.</span></div><div class="table-wrap inventory-scroll"><table id="inventory-${kind}"><thead><tr>${inventoryLabels.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody></tbody></table></div><p id="inventory-status-${kind}" class="tip"></p></section>`}
function ensureInventory(kind){const key=kind+'Inventory';if(!Array.isArray(state[key]))state[key]=[];return state[key]}
function enableColumnResize(name,table){if(!table)return;const heads=[...table.tHead?.rows[0]?.cells||[]];const sizes=state.columnWidths?.[name]||[];table.style.tableLayout='fixed';table.style.width='100%';table.style.minWidth='max-content';const colgroup=document.createElement('colgroup');heads.forEach((th,i)=>{const col=document.createElement('col');const width=Math.max(75,Math.min(600,Number(sizes[i])||Math.max(110,Math.ceil(th.textContent.length*9+38))));col.style.width=sizes.length?width+'px':(100/heads.length)+'%';colgroup.append(col);th.style.position='relative';const grip=document.createElement('span');grip.className='column-resize-grip';grip.title='Drag to resize';th.append(grip);grip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const start=e.clientX,initial=col.getBoundingClientRect().width;grip.setPointerCapture(e.pointerId);const move=ev=>{col.style.width=Math.max(75,Math.min(600,initial+ev.clientX-start))+'px'};const finish=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',finish);grip.removeEventListener('pointercancel',finish);if(!state.columnWidths)state.columnWidths={};state.columnWidths[name]=[...colgroup.children].map(c=>Math.round(c.getBoundingClientRect().width));checkpoint()};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',finish);grip.addEventListener('pointercancel',finish)})});table.insertBefore(colgroup,table.firstChild)}
function copyCombinedRows(kind){const primary=kind==='flsm'?content.querySelector('#results')?.closest('table'):document.getElementById('vlsm-grid');const secondary=document.getElementById('inventory-'+kind);const extract=table=>[...table.rows].map(tr=>[...tr.cells].map(c=>c.textContent.trim()));const first=extract(primary),second=extract(secondary);return {first,second}}
function wireCombinedExports(name,kind){const buttons={copy:$('copy'),csv:$('csv'),excel:$('excel')};buttons.copy.onclick=()=>{const {first,second}=copyCombinedRows(kind);copyValue(first.map(r=>r.join('\t')).join('\n')+'\n\nIP Plan\n'+second.map(r=>r.join('\t')).join('\n'),buttons.copy)};buttons.csv.onclick=()=>{const {first,second}=copyCombinedRows(kind);const width=Math.max(first[0].length,second[0].length);const pad=r=>[...r,...Array(Math.max(0,width-r.length)).fill('')];download(name+'.csv','\ufeff'+csv([pad(['CALCULATED SUBNETS']),...first.map(pad),Array(width).fill(''),pad(['IP Plan']),...second.map(pad)]),'text/csv')};buttons.excel.onclick=()=>{const {first}=copyCombinedRows(kind);const second=[inventoryLabels,...ensureInventory(kind)];const primary=kind==='flsm'?'flsm-results':'vlsm-results',w1=state.columnWidths?.[primary]||[],w2=state.columnWidths?.[kind+'-inventory']||[];exportStyledExcel(name+'.xlsx',[{name:name.toUpperCase()+'  /  CALCULATED SUBNETS',rows:first,widths:w1},{name:'IP LIST',rows:second,widths:w2}])}}

function setupInventory(kind){const table=$('inventory-'+kind),tbody=table.tBodies[0],key=kind+'Inventory',filter=$('filter-'+kind),status=$('inventory-status-'+kind),maxrows=10000;let anchor=null,selected=null,editing=null,drag=false;
const data=()=>ensureInventory(kind);
function normalize(){state[key]=data().filter(r=>r.some(v=>String(v??'').trim())).slice(0,maxrows)}
function bounds(){if(!anchor||!selected)return null;return [Math.min(anchor[0],selected[0]),Math.max(anchor[0],selected[0]),Math.min(anchor[1],selected[1]),Math.max(anchor[1],selected[1])]}
function paintSelection(){tbody.querySelectorAll('.grid-selected,.grid-range').forEach(x=>x.classList.remove('grid-selected','grid-range'));const b=bounds();if(!b)return;for(let r=b[0];r<=b[1];r++)for(let c=b[2];c<=b[3];c++)tbody.querySelector(`td[data-r="${r}"][data-c="${c}"]`)?.classList.add('grid-range');tbody.querySelector(`td[data-r="${selected[0]}"][data-c="${selected[1]}"]`)?.classList.add('grid-selected')}
function focusAt(r,c,extend=false){const listed=[...tbody.rows].map(row=>+row.dataset.row);r=Math.max(0,Math.min(r,data().length));if(!listed.includes(r))r=listed[0]??0;c=Math.max(0,Math.min(c,7));if(!extend||!anchor)anchor=[r,c];selected=[r,c];const cell=tbody.querySelector(`td[data-r="${r}"][data-c="${c}"]`);cell?.focus();paintSelection();return cell}
function render(restore=null){const q=filter.value.trim().toLowerCase(),rows=data(),visible=rows.map((r,i)=>({r,i})).filter(({r})=>!q||r.some(x=>String(x).toLowerCase().includes(q)));visible.push({r:Array(8).fill(''),i:rows.length});tbody.innerHTML=visible.map(({r,i})=>`<tr data-row="${i}">${r.map((v,c)=>`<td tabindex="0" data-r="${i}" data-c="${c}">${esc(v)}</td>`).join('')}</tr>`).join('');status.textContent=q?`${visible.length-1} of ${rows.length} interfaces matched`:'';status.hidden=!q;if(restore)focusAt(restore[0],restore[1]);else if(selected)paintSelection();updateInventorySummary(kind)}
function save(r,c,value){while(data().length<=r){if(data().length>=maxrows)return;data().push(Array(8).fill(''))}data()[r][c]=String(value).replace(/\r?\n/g,' ').trim();normalize();checkpoint()}
function finishEditing(commit=true,next=null){if(!editing)return;const {r,c,inp}=editing;editing=null;if(commit)save(r,c,inp.value);render(next||[r,c])}
function start(cell,initial=null){if(editing||!cell)return;const r=+cell.dataset.r,c=+cell.dataset.c,before=cell.textContent,inp=document.createElement('input');inp.className='cell-inline-input';inp.value=initial===null?before:initial;cell.textContent='';cell.append(inp);editing={r,c,inp,before};inp.focus();if(initial===null)inp.setSelectionRange(inp.value.length,inp.value.length);inp.addEventListener('blur',()=>{if(editing?.inp===inp)finishEditing(true)});inp.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishEditing(false);return}let next=null;if(e.key==='Enter')next=[r+(e.shiftKey?-1:1),c];else if(e.key==='Tab')next=[r,c+(e.shiftKey?-1:1)];else if(initial!==null&&e.key.startsWith('Arrow'))next=[r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0),c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)];if(next){e.preventDefault();e.stopPropagation();finishEditing(true,next)}})}
function rangeText(){const b=bounds();if(!b)return '';const lines=[];for(let r=b[0];r<=b[1];r++){const vals=[];for(let c=b[2];c<=b[3];c++)vals.push(data()[r]?.[c]??'');lines.push(vals.join('\t'))}return lines.join('\n')}
function clearRange(){const b=bounds();if(!b)return;for(let r=b[0];r<=b[1];r++)for(let c=b[2];c<=b[3];c++)if(data()[r])data()[r][c]='';normalize();checkpoint();render([b[0],b[2]])}
function pasteText(raw){if(!selected)return;const [r,c]=selected,matrix=raw.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));if(r+matrix.length>maxrows){status.textContent='Paste exceeds 10,000 rows';return}for(let y=0;y<matrix.length;y++){while(data().length<=r+y)data().push(Array(8).fill(''));for(let x=0;x<matrix[y].length&&c+x<8;x++)data()[r+y][c+x]=matrix[y][x].trim()}normalize();checkpoint();render([r,c])}
tbody.addEventListener('pointerdown',e=>{const cell=e.target.closest('td');if(!cell||e.target.tagName==='INPUT')return;const r=+cell.dataset.r,c=+cell.dataset.c;if(editing){e.preventDefault();finishEditing(true,[r,c]);return}drag=true;focusAt(r,c,e.shiftKey)});
tbody.addEventListener('pointerover',e=>{if(!drag||!selected)return;const cell=e.target.closest('td');if(cell)focusAt(+cell.dataset.r,+cell.dataset.c,true)});
tbody.addEventListener('pointerup',()=>{drag=false});
tbody.addEventListener('click',e=>{const cell=e.target.closest('td');if(cell&&!editing&&document.activeElement!==cell)focusAt(+cell.dataset.r,+cell.dataset.c,e.shiftKey)});
tbody.addEventListener('dblclick',e=>{const cell=e.target.closest('td');if(cell)start(cell)});
tbody.addEventListener('copy',e=>{if(!selected||editing)return;e.preventDefault();e.clipboardData.setData('text/plain',rangeText())});
tbody.addEventListener('cut',e=>{if(!selected||editing)return;e.preventDefault();e.clipboardData.setData('text/plain',rangeText());clearRange()});
tbody.addEventListener('paste',e=>{if(!selected||editing)return;e.preventDefault();pasteText(e.clipboardData.getData('text/plain'))});
tbody.addEventListener('keydown',e=>{if(editing)return;const cell=e.target.closest('td');if(!cell)return;const r=+cell.dataset.r,c=+cell.dataset.c;if((e.ctrlKey||e.metaKey)&&!e.altKey&&['c','v','x','z','y'].includes(e.key.toLowerCase()))return;if(e.key==='F2'){e.preventDefault();start(cell);return}if(e.key==='Enter'){e.preventDefault();focusAt(r+(e.shiftKey?-1:1),c);return}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();clearRange();return}if(e.key==='Tab'||e.key.startsWith('Arrow')){e.preventDefault();const dr=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0,dc=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='Tab'?(e.shiftKey?-1:1):0;focusAt(r+dr,c+dc,e.shiftKey&&e.key!=='Tab');return}if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();start(cell,e.key)}});
filter.addEventListener('input',()=>{anchor=null;selected=null;render()});wireReset(kind+'Inventory','reset-inventory-'+kind);$('export-'+kind).onclick=()=>download(kind.toUpperCase()+'-Inventory.csv','\ufeff'+csv([inventoryLabels,...data()]),'text/csv');render();enableColumnResize(kind+'-inventory',table)}
const gridStyle=document.createElement('style');gridStyle.textContent='.attached-inventory{margin-top:26px}.inventory-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}.inventory-toolbar h2{margin:0 12px 0 0}.inventory-toolbar input[type=search]{min-width:190px}.inventory-hint{opacity:.7;font-size:12px}.column-resize-grip{position:absolute;right:-4px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:4}.column-resize-grip:hover{background:rgba(100,170,240,.45)}.attached-inventory td,.attached-inventory th{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.attached-inventory td:focus,.attached-inventory td.grid-selected{outline:2px solid #5a9df2;outline-offset:-2px}.attached-inventory td.grid-range,#vlsm-grid td.grid-range{background:rgba(80,145,245,.2)}#vlsm-grid td.grid-selected{outline:2px solid #5a9df2;outline-offset:-2px}.cell-inline-input{display:block;width:100%;height:100%;box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:none;outline:none;padding:0}.attached-inventory td{height:38px;padding:9px 12px;box-sizing:border-box}.attached-inventory th{height:43px;padding:10px 12px;box-sizing:border-box}.inventory-scroll{overflow-x:auto;overflow-y:hidden}';document.head.append(gridStyle);
function gridStep(i,key){
 const row=Math.floor(i/8),col=i%8;
 if(key==='ArrowLeft')return col>0?{index:i-1}:{index:i,edge:true,axis:'left'};
 if(key==='ArrowRight')return col<7?{index:i+1}:{index:i,edge:true,axis:'right'};
 if(key==='ArrowUp')return row>0?{index:i-8}:{index:i,edge:true,axis:'up'};
 if(key==='ArrowDown')return row<1?{index:i+8}:{index:i,edge:true,axis:'down'};
 return null;
}
function renderIpv4(){
 title('SUBNETTING','Explore 16 bits • decimal, hexadecimal, binary and clickable bits. Arrow keys move through the grid; Enter or Space toggles a bit.');
 content.insertAdjacentHTML('beforeend',`<div class="toolbar">${field('Decimal:','decimal',0,'number')}${field('Hex:','hex','0000')}${field('Binary:','binary','0000000000000000')}</div><div class="card"><h2>BINARY WORKBENCH</h2><div id="bits" class="bits"></div></div><div id="status" class="status"></div>`);
 let value=state.ipv4;
 function focus(i){$('bits').querySelector(`[data-bit="${15-i}"]`)?.focus()}
 function paint(focusIndex=null){
  $('bits').innerHTML=Array.from({length:16},(_,i)=>{const power=15-i,on=!!(value&(1<<power));return `<div class="bit ${on?'on':''}" data-bit="${power}" tabindex="0" role="button" aria-label="Bit ${power}, value ${2**power}, ${on?'on':'off'}"><strong>${2**power}</strong><small>${on?1:0}</small></div>`}).join('');
  update67Reaction(value);$('decimal').value=value;$('hex').value=value.toString(16).toUpperCase().padStart(4,'0');$('binary').value=value.toString(2).padStart(16,'0');
  setStatus(`Decimal ${value}  |  Hex 0x${$('hex').value}  |  Binary ${$('binary').value}`);
  if(focusIndex!==null)focus(focusIndex);
 }
 const resetBtn=el('button',{id:'reset'},'Reset');content.querySelector('.toolbar').append(resetBtn);wireReset('ipv4');
 $('bits').onclick=e=>{const b=e.target.closest('[data-bit]');if(!b)return;const i=15-Number(b.dataset.bit);value^=1<<Number(b.dataset.bit);state.ipv4=value;checkpoint();paint(i)};
 $('bits').onkeydown=e=>{
  const b=e.target.closest('[data-bit]');if(!b)return;
  const i=15-Number(b.dataset.bit);
  if(e.key==='Enter'||e.key===' '){e.preventDefault();value^=1<<Number(b.dataset.bit);state.ipv4=value;checkpoint();paint(i);return}
  const step=gridStep(i,e.key);if(!step)return;e.preventDefault();if(!step.edge)focus(step.index);
 };
 for(const [id,radix] of [['decimal',10],['hex',16],['binary',2]]){
  $(id).onchange=()=>{const raw=$(id).value.trim();if(!raw||!new RegExp(radix===2?'^[01]+$':radix===16?'^[a-fA-F0-9]+$':'^\\d+$').test(raw)){setStatus('Invalid value',true);return}const n=parseInt(raw,radix);if(n>65535){setStatus('Maximum is 65535 (16 bits)',true);return}value=n;state.ipv4=value;checkpoint();paint()};
 }
 paint();
}
function renderIpv6(){
 title('SUBNETTING','Explore all 128 bits. Arrow keys move up/down/left/right inside each bit grid; Enter or Space toggles a bit.');
 content.insertAdjacentHTML('beforeend',`<div class="toolbar">${field('PREFIX','prefix',64,'number')}${field('EDIT BLOCK','group',1,'number')}${btn('◀','prev')}${btn('▶','next')}</div><div id="blocks" class="ipv6-blocks"></div><div class="card"><h2>BLOCK WORKBENCH</h2><p id="editorTitle" class="muted"></p><div class="bits" id="bits"></div></div>${status()}`);
 $('prefix').min=0;$('prefix').max=128;$('group').min=1;$('group').max=8;
 let parts=[...state.ipv6];
 const blockInput=i=>$('blocks').querySelector(`[data-index="${i}"]`);
 const bitCell=i=>$('bits').querySelector(`[data-bit="${15-i}"]`);
 function paint(focusKind=null,focusIndex=null){
  const p=Math.max(0,Math.min(128,+$('prefix').value||0));
  $('blocks').innerHTML=parts.map((v,i)=>`<label class="${i===selectedGroup?'selected':''}" data-group="${i}">BLOCK ${i+1} · BITS ${i*16+1}–${(i+1)*16}<input data-index="${i}" value="${v}" maxlength="4" aria-label="IPv6 block ${i+1}"></label>`).join('');
  $('group').value=selectedGroup+1;
  const v=parseInt(parts[selectedGroup],16);
  $('editorTitle').textContent=`Editing block ${selectedGroup+1} of 8: ${parts[selectedGroup].toUpperCase()}`;
  $('bits').innerHTML=Array.from({length:16},(_,i)=>`<div class="bit ${v&(1<<(15-i))?'on':''}" data-bit="${15-i}" tabindex="0" role="button" aria-label="Bit ${15-i}, ${v&(1<<(15-i))?'on':'off'}">${2**(15-i)}<small>${v&(1<<(15-i))?1:0} ${selectedGroup*16+i<p?'NET':'HOST'}</small></div>`).join('');
  const ip=parts.map(s=>BigInt('0x'+s)).reduce((a,b)=>(a<<16n)|b,0n),net=p===0?0n:(ip>>BigInt(128-p))<<BigInt(128-p);
  setStatus(`Compressed: ${format6(ip)}  |  Expanded: ${parts.join(':')}\nNetwork: ${format6(net)}/${p}  |  Network bits: ${p}  |  Interface bits: ${128-p}`);
  updateIPv6Visual(parts,p,net);
  if(focusKind==='block')blockInput(focusIndex??selectedGroup)?.focus();
  if(focusKind==='bit')bitCell(focusIndex)?.focus();
 }
 $('blocks').onclick=e=>{const label=e.target.closest('[data-group]');if(!label||e.target.tagName==='INPUT')return;selectedGroup=+label.dataset.group;paint('block',selectedGroup)};
 $('blocks').onfocusin=e=>{const inp=e.target.closest('[data-index]');if(!inp)return;const next=+inp.dataset.index;if(next!==selectedGroup){selectedGroup=next;paint('block',next)}};
 $('blocks').onchange=e=>{const inp=e.target.closest('[data-index]');if(!inp)return;if(!/^[a-fA-F0-9]{1,4}$/.test(inp.value)){setStatus('Enter 1 to 4 hexadecimal digits',true);return}const index=+inp.dataset.index;parts[index]=inp.value.padStart(4,'0').toLowerCase();state.ipv6=[...parts];checkpoint();selectedGroup=index;paint('block',index)};
 $('blocks').onkeydown=e=>{
  const inp=e.target.closest('[data-index]');if(!inp)return;
  const index=+inp.dataset.index;
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};
  if(!(e.key in offsets))return;
  e.preventDefault();const next=Math.max(0,Math.min(7,index+offsets[e.key]));
  selectedGroup=next;paint('block',next);
 };
 $('bits').onclick=e=>{const b=e.target.closest('[data-bit]');if(!b)return;const i=15-Number(b.dataset.bit);parts[selectedGroup]=(parseInt(parts[selectedGroup],16)^(1<<Number(b.dataset.bit))).toString(16).padStart(4,'0');state.ipv6=[...parts];checkpoint();paint('bit',i)};
 $('bits').onkeydown=e=>{
  const b=e.target.closest('[data-bit]');if(!b)return;
  const i=15-Number(b.dataset.bit);
  if(e.key==='Enter'||e.key===' '){e.preventDefault();parts[selectedGroup]=(parseInt(parts[selectedGroup],16)^(1<<Number(b.dataset.bit))).toString(16).padStart(4,'0');state.ipv6=[...parts];checkpoint();paint('bit',i);return}
  const step=gridStep(i,e.key);if(!step)return;e.preventDefault();
  if(!step.edge){bitCell(step.index)?.focus();return}
  const delta=step.axis==='left'?-1:step.axis==='right'?1:step.axis==='up'?-4:4;
  const target=selectedGroup+delta;
  if(target<0||target>7)return;
  selectedGroup=target;
  const nextIndex=step.axis==='left'?i+7:step.axis==='right'?i-7:step.axis==='up'?i+8:i-8;
  paint('bit',nextIndex);
 };
 const resetBtn=el('button',{id:'reset'},'Reset');content.querySelector('.toolbar').append(resetBtn);wireReset('ipv6');$('prefix').onchange=()=>paint();
 $('group').onchange=()=>{selectedGroup=Math.max(0,Math.min(7,+$('group').value-1));paint('block',selectedGroup)};
 $('prev').onclick=()=>{selectedGroup=(selectedGroup+7)%8;paint('block',selectedGroup)};
 $('next').onclick=()=>{selectedGroup=(selectedGroup+1)%8;paint('block',selectedGroup)};
 paint();
}
const refs={commands:[['show ip interface brief','Interface addresses and up/down status'],['show running-config','Inspect current configuration'],['show ip route','Routing table and default route'],['show ip nat translations','Active NAT translations'],['show access-lists','ACL entries and hit counters'],['show vlan brief','VLAN membership (switch)'],['show interfaces trunk','Trunk status and allowed VLANs'],['show cdp neighbors detail','Discover directly connected Cisco devices'],['show ip dhcp binding','DHCP addresses leased'],['show version','IOS version, uptime and platform'],['copy running-config startup-config','Save running configuration'],['ping 8.8.8.8','Test Layer 3 reachability'],['traceroute 8.8.8.8','Trace the path towards a host'],['terminal length 0','Disable paginated show output']],reference:[['Private IPv4','10.0.0.0/8  |  172.16.0.0/12  |  192.168.0.0/16'],['Loopback','127.0.0.0/8 (IPv4)  |  ::1 (IPv6)'],['Link-local','169.254.0.0/16 (IPv4)  |  fe80::/10 (IPv6)'],['IPv6 ULA','fc00::/7 (commonly fd00::/8 locally assigned)'],['IPv6 global unicast','2000::/3'],['Default routes','0.0.0.0/0  |  ::/0'],['/24','256 addresses; 254 usable conventionally'],['/30','4 addresses; 2 usable conventionally'],['/31','Point-to-point links may use both addresses (RFC 3021)'],['/32','Single IPv4 host route'],['DHCP','UDP ports 67 (server), 68 (client)'],['DNS','UDP/TCP port 53'],['SSH','TCP port 22'],['HTTP / HTTPS','TCP ports 80 / 443']],troubleshooting:[['01  Physical','Check cables, link LEDs, interface shutdown state and speed/duplex'],['02  Local config','Check IP, prefix, mask, gateway and DNS addresses'],['03  Loopback','Ping 127.0.0.1; if this fails, inspect the local TCP/IP stack'],['04  Gateway','Ping the default gateway to verify LAN reachability'],['05  Routing','Check show ip route and the next hop in both directions'],['06  Internet by IP','Ping 8.8.8.8. If it works but names fail, investigate DNS'],['07  DNS','Use nslookup or Resolve-DnsName; verify DNS server and forwarders'],['08  NAT','Check inside/outside interfaces, ACL matches and NAT translations'],['09  DHCP','Verify pool, excluded addresses, gateway and helper addresses'],['10  ACL / firewall','Inspect inbound/outbound ACLs, host firewall and rule order'],['11  Tracing','Use tracert / traceroute to locate the failing hop'],['12  Confirm','Retest from client and save the working configuration']]};
const commandCategories={'show ip interface brief':'Interfaces','show running-config':'Basics','show ip route':'Routing','show ip nat translations':'NAT','show access-lists':'Security','show vlan brief':'Switching','show interfaces trunk':'Switching','show cdp neighbors detail':'Discovery','show ip dhcp binding':'DHCP','show version':'Basics','copy running-config startup-config':'Basics','ping 8.8.8.8':'Troubleshooting','traceroute 8.8.8.8':'Troubleshooting','terminal length 0':'Basics'};
const commandExamples={'show ip interface brief':'R1# show ip interface brief\nInterface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     10.0.0.1        YES manual up                    up','show running-config':'R1# show running-config\nBuilding configuration...\nhostname R1\ninterface GigabitEthernet0/0\n ip address 10.0.0.1 255.255.255.0','show ip route':'R1# show ip route\nC 10.0.0.0/24 is directly connected, GigabitEthernet0/0\nS* 0.0.0.0/0 [1/0] via 10.0.0.254','show ip nat translations':'R1# show ip nat translations\nPro  Inside global       Inside local        Outside local       Outside global','show access-lists':'R1# show access-lists\nStandard IP access list 1\n 10 permit 10.0.0.0, wildcard bits 0.0.0.255','show vlan brief':'S1# show vlan brief\nVLAN Name                             Status    Ports\n1    default                          active    Fa0/1','show interfaces trunk':'S1# show interfaces trunk\nPort        Mode         Encapsulation  Status        Native vlan','show cdp neighbors detail':'R1# show cdp neighbors detail\nDevice ID: S1\nIP address: 10.0.0.2','show ip dhcp binding':'R1# show ip dhcp binding\nIP address       Client-ID/Hardware address        Lease expiration','show version':'R1# show version\nCisco IOS Software ...','copy running-config startup-config':'R1# copy running-config startup-config\nDestination filename [startup-config]?\nBuilding configuration...\n[OK]','ping 8.8.8.8':'R1# ping 8.8.8.8\n!!!!!\nSuccess rate is 100 percent (5/5)','traceroute 8.8.8.8':'R1# traceroute 8.8.8.8\nTracing the route to 8.8.8.8','terminal length 0':'R1# terminal length 0'};
function copyValue(v,button=null){const done=()=>{if(!button)return;const old=button.textContent;button.textContent='Copied!';setTimeout(()=>{if(button.isConnected&&button.textContent==='Copied!')button.textContent=old},1100)};if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(v).then(done).catch(()=>{fallbackCopy(v);done()});else{fallbackCopy(v);done()}}
function showRef(k,name){title(name,'Searchable, expandable offline reference.');const cats=[...new Set(refs.commands.map(x=>commandCategories[x[0]]||'Basics'))].sort();content.insertAdjacentHTML('beforeend',`<div class="toolbar"><input id="search" class="reference-search" placeholder="Search topics or descriptions…">${k==='commands'?`<select id="category"><option>All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select>`:''}</div><div id="entries"></div>`);let expanded=null;function update(){const q=$('search').value.toLowerCase(),category=$('category')?.value;$('entries').innerHTML=refs[k].filter(([a,b])=>(a+' '+b+' '+(commandCategories[a]||'Basics')).toLowerCase().includes(q)&&(k!=='commands'||category==='All categories'||(commandCategories[a]||'Basics')===category)).map(([a,b])=>`<div class="reference-item expandable"><div class="reference-header"><button class="reference-expand" data-expand="${esc(a)}">${expanded===a?'▾':'▸'} &nbsp;${esc(a)}${k==='commands'?` <small> · ${esc(b)}</small>`:''}</button><button data-copy="${esc(a)}">Copy</button></div>${expanded===a?`<div class="reference-detail"><pre>${esc(k==='commands'?(commandExamples[a]||a):b)}</pre>${k==='commands'?`<button data-copy-example="${esc(a)}">Copy CLI</button>`:''}</div>`:''}</div>`).join('')||'<p>No matches.</p>';$('entries').querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.expand?null:b.dataset.expand;update()});$('entries').querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{const key=b.dataset.copy;copyValue(k==='commands'?key:refs[k].find(x=>x[0]===key)?.[1]||'',b)});$('entries').querySelectorAll('[data-copy-example]').forEach(b=>b.onclick=()=>copyValue(commandExamples[b.dataset.copyExample]||b.dataset.copyExample,b))}$('search').oninput=update;if($('category'))$('category').onchange=update;update()}
const renderCommands=()=>showRef('commands','CISCO COMMAND LIBRARY'),renderReference=()=>showRef('reference','NETWORK REFERENCE'),renderTroubleshooting=()=>showRef('troubleshooting','NETWORK TROUBLESHOOTING');
const taskNames=['Basic setup','Interface IP','Management SVI','Static route','Default route','Create VLAN','Access VLAN port','SSH access','DHCP pool','NAT overload','Standard ACL','Extended ACL','Show commands'];
function renderCli(){title('ROUTER / SWITCH CLI','Offline Cisco IOS command generator  |  Preview only, nothing is sent to a device.');
 const categories={Router:['Basic setup'],Switch:['Basic setup','Management SVI'],Interfaces:['Interface IP'],Routing:['Static route','Default route'],VLANs:['Create VLAN','Access VLAN port'],SSH:['SSH access'],DHCP:['DHCP pool'],NAT:['NAT overload'],ACL:['Standard ACL','Extended ACL'],Show:['Show commands']};
 content.insertAdjacentHTML('beforeend',`<div class="cli-layout"><div class="cli-left"><h2>CLI CATEGORIES</h2><div id="cli-categories"></div><div class="cli-settings"><h2 id="cli-settings-title">SETTINGS</h2><div id="params"></div></div></div><div class="cli-right"><div class="toolbar">${btn('Copy commands','copycli')}${btn('Export .txt','savecli')}</div><h2>Generated IOS commands</h2><textarea id="preview" class="text-preview" spellcheck="false" readonly></textarea><p class="tip">Task-specific snippets only. Review addresses and interfaces before applying.</p></div></div><select id="task" hidden><option>${esc(state.cli)}</option></select>`);
 let openCategory='Router';const matchingCategory=Object.entries(categories).find(([_,tasks])=>tasks.includes(state.cli));if(matchingCategory)openCategory=matchingCategory[0];
 function drawCategories(){ $('cli-categories').innerHTML=Object.entries(categories).map(([name,tasks])=>`<div class="cli-category"><button class="cli-category-head" data-cat="${esc(name)}">${openCategory===name?'▾':'▸'} &nbsp; ${esc(name)}</button>${openCategory===name?`<div class="cli-category-items">${tasks.map(task=>`<button class="${state.cli===task?'selected':''}" data-cli-task="${esc(task)}">${esc(task)}</button>`).join('')}</div>`:''}</div>`).join('');$('cli-categories').querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{openCategory=openCategory===b.dataset.cat?'':b.dataset.cat;drawCategories()});$('cli-categories').querySelectorAll('[data-cli-task]').forEach(b=>b.onclick=()=>{state.cli=b.dataset.cliTask;$('task').innerHTML=`<option>${esc(state.cli)}</option>`;drawCategories();changeTask()})}
 drawCategories();
 const configs={hostname:['Hostname','R1'],domain:['Domain name','lab.local'],interface:['Interface','GigabitEthernet0/0'],ip:['IPv4 address','192.168.1.1'],mask:['Subnet mask','255.255.255.0'],gateway:['Next hop / gateway','192.168.1.254'],destination:['Destination network','10.10.0.0'],destmask:['Destination mask','255.255.0.0'],vlan:['VLAN ID','10'],vlanname:['VLAN name','USERS'],username:['Username','admin'],password:['Password','ChangeMe123!'],pool:['DHCP pool name','LAN'],network:['Network ID','192.168.1.0'],dns:['DNS server','8.8.8.8'],inside:['Inside interface','GigabitEthernet0/1'],outside:['Outside interface','GigabitEthernet0/0'],acl:['ACL number','1'],wildcard:['Wildcard mask','0.0.0.255'],source:['Source network','192.168.1.0'],protocol:['Protocol','tcp'],port:['Destination port','80']};const needs={'Basic setup':['hostname','domain'],'Interface IP':['interface','ip','mask'],'Management SVI':['vlan','ip','mask','gateway'],'Static route':['destination','destmask','gateway'],'Default route':['gateway'],'Create VLAN':['vlan','vlanname'],'Access VLAN port':['interface','vlan'],'SSH access':['hostname','domain','username','password'],'DHCP pool':['pool','network','mask','gateway','dns'],'NAT overload':['inside','outside','source','wildcard','acl'],'Standard ACL':['acl','source','wildcard'],'Extended ACL':['acl','protocol','source','wildcard','port'],'Show commands':[]};const vals=Object.fromEntries(Object.entries(configs).map(([k,v])=>[k,v[1]]));function update(){const v=k=>vals[k].trim(),t=$('task').value;let lines=[];switch(t){case'Basic setup':lines=['hostname '+v('hostname'),'no ip domain-lookup','ip domain-name '+v('domain'),'service password-encryption'];break;case'Interface IP':lines=['interface '+v('interface'),'ip address '+v('ip')+' '+v('mask'),'no shutdown','exit'];break;case'Management SVI':lines=['interface vlan '+v('vlan'),'ip address '+v('ip')+' '+v('mask'),'no shutdown','exit','ip default-gateway '+v('gateway')];break;case'Static route':lines=['ip route '+v('destination')+' '+v('destmask')+' '+v('gateway')];break;case'Default route':lines=['ip route 0.0.0.0 0.0.0.0 '+v('gateway')];break;case'Create VLAN':lines=['vlan '+v('vlan'),'name '+v('vlanname'),'exit'];break;case'Access VLAN port':lines=['interface '+v('interface'),'switchport mode access','switchport access vlan '+v('vlan'),'no shutdown','exit'];break;case'SSH access':lines=['hostname '+v('hostname'),'ip domain-name '+v('domain'),'username '+v('username')+' privilege 15 secret '+v('password'),'crypto key generate rsa modulus 2048','ip ssh version 2','line vty 0 4','login local','transport input ssh','exit'];break;case'DHCP pool':lines=['ip dhcp excluded-address '+v('gateway'),'ip dhcp pool '+v('pool'),'network '+v('network')+' '+v('mask'),'default-router '+v('gateway'),'dns-server '+v('dns'),'exit'];break;case'NAT overload':lines=['access-list '+v('acl')+' permit '+v('source')+' '+v('wildcard'),'interface '+v('inside'),'ip nat inside','exit','interface '+v('outside'),'ip nat outside','exit','ip nat inside source list '+v('acl')+' interface '+v('outside')+' overload'];break;case'Standard ACL':lines=['access-list '+v('acl')+' permit '+v('source')+' '+v('wildcard')];break;case'Extended ACL':lines=['ip access-list extended '+v('acl'),'permit '+v('protocol')+' '+v('source')+' '+v('wildcard')+' any eq '+v('port'),'exit'];break;case'Show commands':lines=refs.commands.map(x=>x[0])} $('preview').value=lines.join('\n')+'\n'}function changeTask(){state.cli=$('task').value;$('cli-settings-title').textContent=state.cli.toUpperCase()+'  •  SETTINGS';$('params').innerHTML=(needs[state.cli]||[]).map(k=>`<div class="card"><label>${esc(configs[k][0])}<input style="width:100%;margin-top:8px" data-param="${k}" value="${esc(vals[k])}"></label></div>`).join('');$('params').querySelectorAll('[data-param]').forEach(inp=>inp.oninput=()=>{vals[inp.dataset.param]=inp.value;update()});update()}$('task').onchange=changeTask;$('copycli').onclick=()=>copyValue($('preview').value,$('copycli'));$('savecli').onclick=()=>download('Cisco-'+state.cli.replaceAll(' ','-')+'.txt',$('preview').value);changeTask()}

const checklistGuides={
 Router:[
 {id:'basic',name:'01  Basic Setup',note:'Prepare the device, name it and configure console behavior.',code:`! BASIC SETUP — Router (from Router> prompt)
! 1. Enter privileged and global configuration modes.
enable
configure terminal
!
! 2. Give the router an IOS-compatible hostname (no spaces).
hostname R1
!
! 3. Disable accidental DNS lookups for mistyped commands.
no ip domain-lookup
!
! 4. Set an appropriate warning banner. ^ is the delimiter.
banner motd ^Authorized access only. All activity may be monitored.^ 
!
! 5. Improve console usability.
line console 0
 logging synchronous
 exec-timeout 10 0
 exit
!
! 6. Confirm identity. Don't save until final validation.
end
show running-config | include hostname|banner|domain-lookup
! OPTIONAL: terminal length 0 (current session only)`},
 {id:'access',name:'02  Security & SSH',note:'One complete management-access workflow: users, enable secret, SSH, console and VTY.',code:`! SECURITY AND SSH — do this before exposing management access.
enable
configure terminal
!
! 1. Set a strong enable secret and a named local administrator.
! Replace placeholders with unique secrets; do not keep samples.
enable secret <STRONG_ENABLE_SECRET>
username admin privilege 15 secret <STRONG_ADMIN_SECRET>
!
! 2. Set a domain name. Hostname was set in Basic Setup.
ip domain-name lab.local
!
! 3. SSH requires RSA keys and a supported IOS crypto image.
crypto key generate rsa modulus 2048
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
!
! 4. Require local authentication on console and VTY.
line console 0
 login local
 exec-timeout 10 0
 logging synchronous
 exit
line vty 0 4
 login local
 transport input ssh
 exec-timeout 10 0
 exit
! If this platform also has VTY 5–15, configure them likewise:
! line vty 5 15
!  login local
!  transport input ssh
!  exec-timeout 10 0
!  exit
!
! 5. Optional: allow only a trusted management subnet.
! ip access-list standard MGMT-SOURCES
!  permit <MANAGEMENT_NETWORK> <WILDCARD_MASK>
!  deny any log
!  exit
! line vty 0 4
!  access-class MGMT-SOURCES in
!  exit
!
! 6. Verification. Keep a working session during changes.
end
show ip ssh
show ssh
show running-config | section line vty
show running-config | include username|enable secret|ip domain-name
! From a separate client: ssh -l admin <ROUTER_IP>`},
 {id:'interfaces',name:'03  Interfaces & IPv4',note:'Assign LAN/WAN addresses, descriptions, interface state and optional subinterfaces.',code:`! ROUTER INTERFACE CONFIGURATION
! Physical interface names depend on the device: G0/0, G0/0/0, F0/0, etc.
enable
configure terminal
!
! 1. LAN side
interface GigabitEthernet0/0
 description LAN - users
 ip address 192.168.10.1 255.255.255.0
 no shutdown
 exit
!
! 2. WAN / transit side (edit to your actual routed link)
interface GigabitEthernet0/1
 description WAN - ISP or upstream
 ip address 10.0.0.2 255.255.255.252
 no shutdown
 exit
!
! 3. OPTIONAL: router-on-a-stick instead of a plain LAN IP.
! A parent interface with subinterfaces should NOT also have a normal L3 address.
! interface GigabitEthernet0/0
!  no ip address
!  no shutdown
!  exit
! interface GigabitEthernet0/0.10
!  encapsulation dot1Q 10
!  description VLAN10 - users
!  ip address 192.168.10.1 255.255.255.0
!  exit
! interface GigabitEthernet0/0.20
!  encapsulation dot1Q 20
!  description VLAN20 - guests
!  ip address 192.168.20.1 255.255.255.0
!  exit
!
end
show ip interface brief
show interfaces description
show ip interface GigabitEthernet0/0
! Verify that interfaces show up/up before moving on.`},
 {id:'routing',name:'04  Static & Default Routing',note:'Configure the required next hops and verify both forward and return paths.',code:`! ROUTING — replace example destinations and next hops.
! Do not add routes for directly connected networks.
enable
configure terminal
!
! 1. Default IPv4 route to upstream/ISP.
ip route 0.0.0.0 0.0.0.0 10.0.0.1
!
! 2. OPTIONAL: route a remote private subnet via a reachable neighbor.
! ip route 172.16.20.0 255.255.255.0 10.0.0.1
!
! 3. OPTIONAL: backup floating default route (higher administrative distance).
! ip route 0.0.0.0 0.0.0.0 10.0.0.5 200
!
end
show ip route
show ip route static
ping 10.0.0.1
traceroute 8.8.8.8
! Confirm return routes exist on the other router and ACLs permit traffic.
! IMPORTANT: ip default-gateway is for an L2 switch, not an IP-routing router.`},
 {id:'dhcp',name:'05  DHCP Server & Relay',note:'Router DHCP pools, exclusions, DNS, lease and forwarding to external DHCP.',code:`! DHCP — choose LOCAL SERVER or RELAY for each subnet, not both.
enable
configure terminal
!
! OPTION A — Router is DHCP server for the LAN.
service dhcp
ip dhcp excluded-address 192.168.10.1 192.168.10.20
ip dhcp pool USERS
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.1
 dns-server 192.168.10.10 1.1.1.1
 domain-name lab.local
 lease 7
 exit
!
! OPTION B — DHCP server lives elsewhere (omit local pool above).
! Apply helper on the interface receiving DHCP broadcasts.
! interface GigabitEthernet0/0
!  ip helper-address 172.16.10.10
!  exit
!
end
show ip dhcp pool
show ip dhcp binding
show ip dhcp conflict
show running-config | section ip dhcp
! Check clients receive IP, prefix/mask, default gateway and DNS.`},
 {id:'acl',name:'06  ACLs & Traffic Rules',note:'Build standard or extended ACLs, apply in the intended direction, inspect hits.',code:`! ACLs — examples are alternatives, not a ready-made security policy.
! A missing permit becomes an implicit deny. Plan your rule order first.
enable
configure terminal
!
! OPTION A — Standard ACL: allow known source subnet.
! ip access-list standard LAN-SOURCES
!  remark Allowed client subnet
!  permit 192.168.10.0 0.0.0.255
!  deny any log
!  exit
!
! OPTION B — Extended ACL: protect a destination/port with precise matching.
ip access-list extended LAN-POLICY
 remark Allow LAN DNS queries to internal DNS
 permit udp 192.168.10.0 0.0.0.255 host 192.168.10.10 eq 53
 permit tcp 192.168.10.0 0.0.0.255 host 192.168.10.10 eq 53
 remark Allow other IPv4 traffic (replace with actual policy)
 permit ip 192.168.10.0 0.0.0.255 any
 deny ip any any log
 exit
!
! 3. Attach to the correct interface and direction.
interface GigabitEthernet0/0
 ip access-group LAN-POLICY in
 exit
!
end
show access-lists
show ip interface GigabitEthernet0/0
! CAUTION: test SSH reachability before applying management ACLs remotely.
! Use 'no ip access-group LAN-POLICY in' to remove this attachment.`},
 {id:'nat',name:'07  NAT & PAT',note:'NAT overload, inside/outside roles, translations and optional port forwarding.',code:`! NAT/PAT — required only when this router translates addresses.
! The outside interface must have upstream reachability.
enable
configure terminal
!
! 1. Identify inside and outside interfaces.
interface GigabitEthernet0/0
 ip nat inside
 exit
interface GigabitEthernet0/1
 ip nat outside
 exit
!
! 2. Match the private source networks that need translation.
ip access-list standard NAT-SOURCES
 permit 192.168.10.0 0.0.0.255
 exit
!
! 3. Overload many inside addresses on the outside interface address.
ip nat inside source list NAT-SOURCES interface GigabitEthernet0/1 overload
!
! 4. OPTIONAL: static TCP forward to an internal web server.
! ip nat inside source static tcp 192.168.10.10 443 interface GigabitEthernet0/1 443
!
end
show ip nat statistics
show ip nat translations
show ip interface brief
! Generate real traffic from a LAN host before expecting translations.
! NAT alone does not provide a default route; configure that in Routing.`},
 {id:'ospf',name:'08  OSPF Dynamic Routing',note:'Single-area OSPF, passive LANs, router ID, neighbor and route verification.',code:`! OSPFv2 — use only if the network runs a dynamic routing protocol.
! Example: transit 10.0.0.0/30, LAN 192.168.10.0/24.
enable
configure terminal
router ospf 1
 router-id 1.1.1.1
 passive-interface default
 no passive-interface GigabitEthernet0/1
 network 10.0.0.0 0.0.0.3 area 0
 network 192.168.10.0 0.0.0.255 area 0
 exit
!
! OPTIONAL: advertise default route if one exists in this router's RIB.
! router ospf 1
!  default-information originate
!  exit
!
end
show ip ospf neighbor
show ip ospf interface brief
show ip protocols
show ip route ospf
! Each neighbor needs matching area, subnet, hello/dead timers and MTU.
! Router ID changes may require clearing the process (disruptive).`},
 {id:'ipv6',name:'09  IPv6 & SLAAC',note:'Dual-stack interfaces, IPv6 routing, default route and address discovery.',code:`! IPv6 — optional, but complete when the lab uses IPv6.
! 2001:db8::/32 is DOCUMENTATION ONLY, not public production space.
enable
configure terminal
ipv6 unicast-routing
!
interface GigabitEthernet0/0
 ipv6 address 2001:DB8:ACAD:10::1/64
 ipv6 enable
 no shutdown
 exit
interface GigabitEthernet0/1
 ipv6 address 2001:DB8:ACAD:20::2/64
 ipv6 enable
 no shutdown
 exit
!
! Stateless autoconfiguration is advertised with IPv6 Router Advertisements.
! Client-side SLAAC requires an enabled /64 LAN and permitted ICMPv6.
!
! OPTIONAL IPv6 default route via a known upstream next hop.
! ipv6 route ::/0 2001:DB8:ACAD:20::1
!
! OPTIONAL DHCPv6 other-info mode (only if DHCPv6 service exists):
! interface GigabitEthernet0/0
!  ipv6 nd other-config-flag
!  exit
!
end
show ipv6 interface brief
show ipv6 route
show ipv6 neighbors
ping ipv6 2001:DB8:ACAD:20::1`},
 {id:'services',name:'10  Time, Logs & Discovery',note:'NTP, syslog, DNS lookup and CDP/LLDP operational settings.',code:`! NETWORK SERVICES — select those provided in your network.
enable
configure terminal
!
! 1. Set an appropriate timezone (example: Denmark, winter time UTC+1).
clock timezone CET 1
! OPTIONAL DST rules must match the jurisdiction and IOS syntax.
!
! 2. Synchronize time with an authorized NTP server.
ntp server 192.168.10.10 prefer
!
! 3. Send operational logs to the syslog collector.
service timestamps log datetime msec localtime show-timezone
logging host 192.168.10.10
logging trap informational
!
! 4. DNS resolution is optional and was disabled for typos in Basic Setup.
! ip name-server 192.168.10.10
! ip domain-lookup
!
! 5. Neighbor discovery; avoid exposing topology on untrusted ports.
cdp run
! lldp run
!
end
show clock detail
show ntp associations
show logging
show cdp neighbors detail
! SNMP is deliberately NOT enabled with a default/community credential.
! If required, configure authenticated SNMPv3 per your monitoring platform.`},
 {id:'verify',name:'11  Verify, Save & Backup',note:'Final checks, configuration persistence and safe backup/recovery.',code:`! FINAL CHECK — run in privileged EXEC mode (Router#).
enable
show version
show ip interface brief
show interfaces description
show ip route
show ip protocols
show running-config
show ip ssh
show access-lists
show logging
!
! Verify with real endpoint tests:
! ping <LOCAL_GATEWAY>
! ping <REMOTE_SUBNET_HOST>
! traceroute <REMOTE_SUBNET_HOST>
! From a client: verify DHCP, DNS, SSH and permitted traffic.
!
! Save only after checks pass.
copy running-config startup-config
! Confirm Destination filename [startup-config]? by pressing Enter.
show startup-config
!
! OPTIONAL: save a backup to a server you control.
! copy running-config scp:
! Supply the remote host, username and filename when prompted.
! Avoid insecure TFTP outside isolated labs.
!
! OPTIONAL rollback instructions (use deliberately):
! configure replace nvram:startup-config force
! This may cut off your remote session. Back up and verify first.`}
 ],
 Switch:[
 {id:'basic',name:'01  Basic Setup',note:'Switch identity, terminal preparation, banner and safe initial checks.',code:`! BASIC SWITCH SETUP — from Switch> prompt.
enable
configure terminal
hostname SW1
no ip domain-lookup
banner motd ^Authorized access only. All activity may be monitored.^ 
line console 0
 logging synchronous
 exec-timeout 10 0
 exit
end
show version
show running-config | include hostname|domain-lookup
show interfaces status
! Port names and feature support vary between Catalyst/IOS variants.`},
 {id:'access',name:'02  Security & SSH',note:'Single place for enable secret, local users, RSA, SSH and management login.',code:`! SWITCH MANAGEMENT ACCESS — configure while console-connected.
enable
configure terminal
enable secret <STRONG_ENABLE_SECRET>
username admin privilege 15 secret <STRONG_ADMIN_SECRET>
ip domain-name lab.local
crypto key generate rsa modulus 2048
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
!
line console 0
 login local
 exec-timeout 10 0
 logging synchronous
 exit
line vty 0 4
 login local
 transport input ssh
 exec-timeout 10 0
 exit
! If VTY 5–15 exist, secure those too:
! line vty 5 15
!  login local
!  transport input ssh
!  exit
end
show ip ssh
show running-config | section line vty
! Test SSH only after Management IP is configured.`},
 {id:'management',name:'03  Management IP & Gateway',note:'SVI, management VLAN, L2 default gateway and management reachability.',code:`! LAYER 2 SWITCH MANAGEMENT — use an existing management VLAN.
enable
configure terminal
vlan 99
 name MANAGEMENT
 exit
interface Vlan99
 description Switch management
 ip address 192.168.99.2 255.255.255.0
 no shutdown
 exit
!
! For a LAYER-2 switch only, with ip routing disabled:
ip default-gateway 192.168.99.1
!
! Ensure VLAN 99 has an active connected port/trunk, or SVI may be down.
! Assign access/trunk membership in the VLAN & Trunks category.
end
show ip interface brief
show vlan brief
ping 192.168.99.1
! On a multilayer switch with 'ip routing', use 'ip route 0.0.0.0 ...' instead.`},
 {id:'vlans',name:'04  VLANs, Access & Trunks',note:'VLAN database, access endpoints, voice VLAN, 802.1Q trunks and native VLAN.',code:`! VLAN AND PORT DEPLOYMENT — interface names are examples.
enable
configure terminal
!
! 1. Create user, voice and native VLANs.
vlan 10
 name USERS
 exit
vlan 20
 name VOICE
 exit
vlan 999
 name NATIVE_UNUSED
 exit
!
! 2. Assign a client-facing ACCESS port.
interface GigabitEthernet0/1
 description User workstation
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
 no shutdown
 exit
!
! 3. OPTIONAL phone + PC port (if IP phones are deployed).
! interface GigabitEthernet0/2
!  switchport mode access
!  switchport access vlan 10
!  switchport voice vlan 20
!  spanning-tree portfast
!  no shutdown
!  exit
!
! 4. Uplink as trunk: agree allowed/native VLANs with neighbor.
interface GigabitEthernet0/24
 description Uplink to distribution
 switchport mode trunk
 switchport trunk native vlan 999
 switchport trunk allowed vlan 10,20,99,999
 no shutdown
 exit
! Some older platforms also require 'switchport trunk encapsulation dot1q'.
end
show vlan brief
show interfaces trunk
show interfaces switchport
! Verify both ends have matching trunk/native/allowed settings.`},
 {id:'stp',name:'05  STP & Loop Protection',note:'Rapid-PVST, edge protection and root placement (no accidental loops).',code:`! SPANNING TREE — configure deliberately on every relevant switch.
enable
configure terminal
!
! 1. Rapid PVST is common on IOS Catalyst. Verify platform support.
spanning-tree mode rapid-pvst
!
! 2. Edge ports should use PortFast; global BPDU Guard protects them.
spanning-tree portfast default
spanning-tree portfast bpduguard default
!
! 3. OPTIONAL: choose the intended root on the distribution switch only.
! spanning-tree vlan 10,20,99 root primary
! On the backup distribution switch:
! spanning-tree vlan 10,20,99 root secondary
!
! 4. OPTIONAL: disable unused access ports (review port range!).
! interface range GigabitEthernet0/10 - 23
!  description UNUSED - disabled
!  shutdown
!  exit
end
show spanning-tree summary
show spanning-tree vlan 10
show spanning-tree inconsistentports
! Do not enable edge/PortFast on links between switches.`},
 {id:'portsec',name:'06  Access Port Security',note:'MAC learning limits, sticky addresses and violation handling.',code:`! PORT SECURITY — ordinary access ports only; do not apply blindly to trunks.
enable
configure terminal
interface GigabitEthernet0/1
 switchport mode access
 switchport port-security
 switchport port-security maximum 2
 switchport port-security mac-address sticky
 switchport port-security violation restrict
 exit
end
show port-security
show port-security interface GigabitEthernet0/1
show port-security address
! 'restrict' logs/drops extra MACs; 'shutdown' err-disables the port.
! IP phones/virtualization may require a higher legitimate MAC limit.`},
 {id:'dhcpguard',name:'07  DHCP Snooping & ARP',note:'Block rogue DHCP servers, trust uplinks, and optionally use DAI.',code:`! L2 DHCP PROTECTION — only where supported and appropriate.
enable
configure terminal
ip dhcp snooping
ip dhcp snooping vlan 10,20
!
! Trust ONLY legitimate uplinks toward your DHCP server.
interface GigabitEthernet0/24
 ip dhcp snooping trust
 exit
!
! OPTIONAL: limit client DHCP packets on ordinary access ports.
! interface GigabitEthernet0/1
!  ip dhcp snooping limit rate 15
!  exit
!
! OPTIONAL: DAI uses DHCP snooping bindings for inspection.
! Static hosts may require ARP ACLs before enabling DAI.
! ip arp inspection vlan 10,20
! interface GigabitEthernet0/24
!  ip arp inspection trust
!  exit
end
show ip dhcp snooping
show ip dhcp snooping binding
show ip arp inspection vlan 10
! DHCP server configuration itself belongs on the router/server, not this L2 switch.`},
 {id:'etherchannel',name:'08  EtherChannel / LACP',note:'Bundle matching uplink ports using LACP; verify channel and trunk consistency.',code:`! LACP — only use when both endpoints intentionally share a port-channel.
! Member ports must have matching speed, duplex, VLAN and trunk settings.
enable
configure terminal
interface range GigabitEthernet0/23 - 24
 description LACP uplink members
 switchport mode trunk
 switchport trunk allowed vlan 10,20,99,999
 channel-group 1 mode active
 no shutdown
 exit
interface Port-channel1
 description Bundled uplink
 switchport mode trunk
 switchport trunk allowed vlan 10,20,99,999
 exit
end
show etherchannel summary
show interfaces port-channel 1
show interfaces trunk
! Verify neighbor uses a compatible LACP bundle; don't combine unrelated links.`},
 {id:'l3',name:'09  L3 Switching & Inter-VLAN',note:'Optional routed SVIs for a multilayer switch; routes, not L2 default gateway.',code:`! MULTILAYER SWITCH ONLY — skip if the switch is L2-only.
! Verify it supports 'ip routing' and has the right license/features.
enable
configure terminal
ip routing
!
interface Vlan10
 description Gateway - users
 ip address 192.168.10.1 255.255.255.0
 no shutdown
 exit
interface Vlan20
 description Gateway - voice
 ip address 192.168.20.1 255.255.255.0
 no shutdown
 exit
!
! Configure the VLAN membership/uplinks in VLANs & Trunks.
! A true routed uplink may use 'no switchport' (platform-dependent).
ip route 0.0.0.0 0.0.0.0 192.168.99.1
end
show ip route
show ip interface brief
ping 192.168.99.1
! Do NOT use 'ip default-gateway' with routing enabled.
! DHCP relay (if needed) belongs on each client-facing SVI:
! interface Vlan10
!  ip helper-address <DHCP_SERVER_IP>
!  exit`},
 {id:'acl',name:'10  VLAN ACL / Traffic Policy',note:'Optional inter-VLAN ACLs on multilayer switches, including interface binding.',code:`! L3 SWITCH FILTERING — requires routed SVIs and ACL support.
! Decide the traffic policy before applying it.
enable
configure terminal
ip access-list extended USER-TO-SERVERS
 remark Allow user subnet to internal DNS
 permit udp 192.168.10.0 0.0.0.255 host 192.168.99.10 eq 53
 permit tcp 192.168.10.0 0.0.0.255 host 192.168.99.10 eq 53
 remark Other traffic per site policy
 permit ip 192.168.10.0 0.0.0.255 any
 deny ip any any log
 exit
interface Vlan10
 ip access-group USER-TO-SERVERS in
 exit
end
show access-lists
show ip interface Vlan10
! Applying ACLs can block connectivity or management. Test with console access.
! Plain L2 switches generally cannot apply routed SVI ACLs.`},
 {id:'services',name:'11  Time, Logs & Discovery',note:'Switch clock, NTP, syslog and neighbor visibility.',code:`! NETWORK SERVICES — point at authorized infrastructure.
enable
configure terminal
clock timezone CET 1
ntp server 192.168.99.10 prefer
service timestamps log datetime msec localtime show-timezone
logging host 192.168.99.10
logging trap informational
cdp run
! lldp run
end
show clock detail
show ntp associations
show logging
show cdp neighbors detail
! Do not enable insecure SNMPv1/v2c with guessable community strings.
! If required, use authenticated SNMPv3 as supported by your platform.`},
 {id:'verify',name:'12  Verify, Save & Backup',note:'Port/VLAN/STP/SSH validation, startup configuration and backups.',code:`! FINAL SWITCH VERIFICATION — privileged EXEC mode.
enable
show version
show interfaces status
show interfaces description
show vlan brief
show interfaces trunk
show spanning-tree summary
show etherchannel summary
show ip interface brief
show ip ssh
show running-config
show logging
!
! Verify from a client: VLAN assignment, DHCP, DNS, SSH to switch,
! and connectivity through the correct trunk/uplink.
!
copy running-config startup-config
show startup-config
!
! OPTIONAL secure backup:
! copy running-config scp:
! Verify destination and credentials before transferring.
! Have console access before making changes that may lose management.`}
 ]
};
function checklistCommands(guide){
 return String(guide?.code||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith('!'));
}
function checklistHostname(device){
 const text=String(device?.name||'').trim().replace(/[^a-zA-Z0-9_-]/g,'');
 return text && /^[a-zA-Z]/.test(text)?text.slice(0,40):(device?.kind==='Switch'?'S1':'R1');
}
function checklistTerminal(device,guide){
 if(!device||!guide)return '';
 const commands=checklistCommands(guide);
 let host=checklistHostname(device),level='user',submode='',indent='';
 const prompt=()=>host+(level==='user'?'>':level==='exec'?'#':level==='config'?'(config)#':'(config-'+submode+')#');
 const lines=[];
 for(const command of commands){
  lines.push(prompt()+command);
  if(command==='enable' && level==='user'){level='exec';continue}
  if(command==='disable' && level==='exec'){level='user';continue}
  if(command==='configure terminal' || command==='conf t'){level='config';submode='';continue}
  if(command==='end' && (level==='config'||level==='sub')){level='exec';submode='';continue}
  if(command==='exit'){
   if(level==='sub'){level='config';submode=''}
   else if(level==='config')level='exec';
   else if(level==='exec')level='user';
   continue;
  }
  if(level==='config' && /^hostname\s+\S+/i.test(command)){host=command.split(/\s+/)[1];continue}
  if(level==='config'){
   if(/^interface(?:\s|$)/i.test(command)){level='sub';submode='if'}
   else if(/^line\s/i.test(command)){level='sub';submode='line'}
   else if(/^router\s/i.test(command)){level='sub';submode='router'}
   else if(/^ip\s+dhcp\s+pool\s/i.test(command)){level='sub';submode='dhcp-config'}
   else if(/^ip\s+access-list\s/i.test(command)){level='sub';submode='ext-nacl'}
   else if(/^ipv6\s+access-list\s/i.test(command)){level='sub';submode='ipv6-acl'}
   else if(/^vlan\s+\d/i.test(command)){level='sub';submode='vlan'}
  }
  if(command==='copy running-config startup-config'){
   lines.push('Destination filename [startup-config]?');
   lines.push('Building configuration...');
   lines.push('[OK]');
  }
 }
 lines.push(prompt());
 return lines.join('\n');
}
const checklistCss=`
.checklist-top{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:18px 0 12px}
.checklist-top label{display:grid;gap:5px;color:#bfcde0;font-size:12px;font-weight:650}
.checklist-top select,.checklist-top input{min-width:160px;background:#172537;color:#e5edf7;border:1px solid #425571;border-radius:8px;padding:11px}
.checklist-top button,.checklist-actions button,.checklist-output button{border-radius:8px;padding:10px 14px;cursor:pointer}
.checklist-device-list{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 16px}
.checklist-device{position:relative;min-width:145px;min-height:80px;text-align:left;background:#19293a;border:1px solid #40536c;border-radius:12px;padding:12px 14px;cursor:pointer;color:#e4eafa}
.checklist-device strong,.checklist-device small{display:block}.checklist-device small{margin-top:9px;color:#9faec2}
.checklist-device.chosen{border:2px solid #6ea8fb;background:#203650}
.checklist-device.finished{background:#163b33;border-color:#299e75}.checklist-device.finished small{color:#81e1af}
.checklist-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:0 0 16px}
.checklist-actions .checklist-complete{background:#226b55;color:white;border:1px solid #369a79}
.checklist-actions .checklist-reopen{background:#414d61;color:white;border:1px solid #718096}
.checklist-grid{display:grid;grid-template-columns:minmax(265px,0.85fr) minmax(350px,1.35fr);gap:18px;align-items:stretch}
.checklist-panel{background:#172332;border:1px solid #34465b;border-radius:13px;padding:14px;min-width:0}
.checklist-panel h2{margin:0 0 9px}.checklist-subtle{color:#a6b9cf;font-size:13px;line-height:1.55}
.checklist-rows{display:grid;gap:7px;margin-top:15px}
.checklist-entry{display:flex;align-items:stretch;gap:7px}
.checklist-select{display:flex;align-items:center;text-align:left;flex:1;min-width:0;background:#243449;color:#e5edf7;border:1px solid #40546d;border-radius:9px;padding:11px;cursor:pointer;font-size:14px}
.checklist-select.chosen{border-color:#6ca8e4;background:#28476b}
.checklist-check{display:flex;align-items:center;justify-content:center;min-width:42px;padding:0 9px;background:#243449;border:1px solid #40546d;border-radius:9px;cursor:pointer}
.checklist-check input{width:19px;height:19px;accent-color:#42a885;cursor:pointer}
.checklist-output{display:flex;flex-direction:column;min-height:0}
.checklist-output-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:9px}
.checklist-output-tools{display:flex;gap:8px;flex-wrap:wrap}
.checklist-code{display:block;box-sizing:border-box;width:100%;flex:1 1 auto;height:clamp(560px,75vh,1100px);min-height:560px;overflow:auto;margin-top:12px;padding:16px;background:#090f17;color:#d9e5f4;border:1px solid #45617c;border-radius:8px;line-height:1.6;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;tab-size:2;user-select:text}
.checklist-empty{background:#192b3d;border:1px dashed #4d627a;border-radius:10px;padding:26px;color:#b5c4d6}
.checklist-top label{color:#c8c2d0}
.checklist-top select,.checklist-top input{background:#2b2c35;color:#e9e5ef;border:1px solid #625a6c;border-radius:8px}
.checklist-top button,.checklist-actions button,.checklist-output button{background:#35333e;color:#e8e4ed;border:1px solid #615a6a;border-radius:8px;transition:background .14s,border-color .14s}
.checklist-top button:hover,.checklist-actions button:hover,.checklist-output button:hover{background:#423d4b;border-color:#8a7b98}
#checklist-add{background:#484050;border-color:#877693;color:#f1ebf5;font-weight:600}
#checklist-add:hover{background:#574a60;border-color:#a494b0}
.checklist-device{background:#303039;border-color:#56515e;color:#eeeaf1}
.checklist-device.chosen{background:#403b48!important;border:1px solid #8c7a99;color:#f5f0f7}
.checklist-device small{color:#b6abbf}
.checklist-device.finished{background:#303e38;border-color:#749b83!important}
.checklist-device.finished small{color:#a9cbb1}
.checklist-panel{background:#2b2c35!important;border-color:#534d5d!important}
.checklist-subtle{color:#b7adbf}
.checklist-select{background:#34313c!important;border:1px solid #5d5567;color:#e8e3ed}
.checklist-select.chosen{background:#47404f!important;border-color:#9d8aab}
.checklist-check{background:#34313c;border:1px solid #5d5567;border-radius:8px}
.checklist-check input{width:18px;height:18px;accent-color:#a88db7;cursor:pointer}
.checklist-check:has(input:checked){background:#453b4a;border-color:#9b82aa}
.checklist-check:focus-within{outline:2px solid #a88db7;outline-offset:2px}
.checklist-code{background:#23252c!important;border-color:#554e61;color:#e3e1e8}
.checklist-empty{background:#323039;border-color:#655a6c;color:#bfb4c7}
.checklist-actions .checklist-complete{background:#40584c;border-color:#739d83;color:#edf5ef}
.checklist-actions .checklist-reopen{background:#45404e;border-color:#82738f;color:#f1ebf5}

@media(max-width:920px){.checklist-grid{grid-template-columns:1fr}.checklist-code{height:500px;min-height:500px}}
`;
const checklistCompact=document.createElement('style');checklistCompact.textContent=`
body:has(#checklist-cli) main{padding-top:10px}
body:has(#checklist-cli) main h1{margin-bottom:5px}
body:has(#checklist-cli) .subtitle{margin-bottom:8px}
.checklist-top{margin-top:3px!important;margin-bottom:6px!important}
.checklist-device-list{margin-bottom:7px!important}
.checklist-actions{margin-bottom:8px!important}
.checklist-grid{gap:10px}
.checklist-panel{padding:10px}
.checklist-rows{gap:4px;margin-top:7px}
.checklist-select{padding:7px 9px;font-size:12px}
.checklist-code{height:calc(100vh - 265px);min-height:300px;max-height:calc(100vh - 265px);margin-top:7px}
@media(min-width:921px){.checklist-grid{align-items:start}.checklist-panel{max-height:calc(100vh - 235px);overflow:auto}.checklist-output{overflow:hidden}.checklist-code{height:calc(100vh - 300px);max-height:calc(100vh - 300px)}}
`;document.head.append(checklistCompact);
const checklistStyle=document.createElement('style');checklistStyle.textContent=checklistCss;document.head.append(checklistStyle);
function renderChecklist(){
 title('CHECKLIST');content.querySelector('.tool-title-row')?.remove();content.querySelector('h1')?.remove();
 if(!Array.isArray(state.checklistDevices))state.checklistDevices=[];
 let devices=state.checklistDevices;
 let selected=devices.find(d=>d.id===state.checklistSelected)||devices[0]||null;
 let categoryId=selected?.category||'basic';
 content.insertAdjacentHTML('beforeend',`<div class="checklist-top"><label>ADD DEVICE<select id="checklist-kind"><option>Router</option><option>Switch</option></select></label><button id="checklist-add">+ Add device</button><button id="checklist-reset-all" type="button">Reset all devices</button></div><div id="checklist-device-list" class="checklist-device-list"></div><div id="checklist-device-actions" class="checklist-actions"></div><div class="checklist-grid"><section class="checklist-panel"><h2 id="checklist-heading" hidden>Configuration categories</h2><div id="checklist-progress" class="checklist-subtle"></div><div id="checklist-categories" class="checklist-rows"></div></section><section class="checklist-panel checklist-output"><div class="checklist-output-head"><h2 id="checklist-output-title">IOS CLI</h2><div class="checklist-output-tools"><button id="checklist-copy">Copy CLI</button><button id="checklist-export">Export .txt</button></div></div><pre id="checklist-cli" class="checklist-code" tabindex="0" aria-label="Cisco IOS terminal transcript"></pre></section></div>`);
 const current=()=>devices.find(d=>d.id===state.checklistSelected)||null;
 const guide=()=>{const d=current();return d?(checklistGuides[d.kind].find(g=>g.id===categoryId)||checklistGuides[d.kind][0]):null};
 function redraw(){
  const d=current();
  $('checklist-device-list').innerHTML=devices.length?devices.map(x=>`<button class="checklist-device ${x.id===d?.id?'chosen':''} ${x.done?'finished':''}" data-device="${esc(x.id)}"><strong>${x.kind==='Router'?'◉':'▦'} ${esc(x.name)}</strong><small>${x.done?'✓ Device completed':'○ In progress'}</small></button>`).join(''):'<div class="checklist-empty">No devices yet. Add a Router or Switch above to begin.</div>';
  $('checklist-device-list').querySelectorAll('[data-device]').forEach(b=>b.onclick=()=>{state.checklistSelected=b.dataset.device;const x=current();categoryId=x.category||'basic';checkpoint();redraw()});
  $('checklist-device-actions').innerHTML=d?`<button id="checklist-mark" class="${d.done?'checklist-reopen':'checklist-complete'}">${d.done?'↺ Reopen Device':'✓ Mark Device as Complete'}</button><button id="checklist-rename">Rename</button><button id="checklist-reset">Reset checklist</button><button id="checklist-delete">Remove device</button>`:'';
  if(d){
    $('checklist-mark').onclick=()=>{d.done=!d.done;checkpoint();redraw()};
    $('checklist-rename').onclick=()=>{const name=prompt('Device name',d.name);if(name===null)return;const value=name.trim().slice(0,65);if(!value)return;d.name=value;checkpoint();redraw()};
    $('checklist-reset').onclick=()=>{if(!confirm('Reset '+d.name+' checklist? This clears checked categories and reopens the device, but keeps the device.'))return;d.checked=[];d.done=false;checkpoint();redraw()};
    $('checklist-delete').onclick=()=>{if(!confirm('Remove '+d.name+' and its checklist progress?'))return;devices=devices.filter(x=>x.id!==d.id);state.checklistDevices=devices;state.checklistSelected=devices[0]?.id||null;categoryId='basic';checkpoint();redraw()};
  }
  $('checklist-heading').textContent=d?`${d.name} · Checklist`:'Configuration categories';
  const categories=d?checklistGuides[d.kind]:[];
  const done=d?categories.filter(g=>d.checked?.includes(g.id)).length:0;
  $('checklist-progress').textContent=d?`${done} of ${categories.length} categories checked · Device status: ${d.done?'Completed':'In progress'} · Categories are optional; only you decide when the device is ready.`:'Add a device to see its configuration guide.';
  $('checklist-categories').innerHTML=categories.map(g=>`<div class="checklist-entry"><button class="checklist-select ${categoryId===g.id?'chosen':''}" data-category="${g.id}">${esc(g.name)}</button><label class="checklist-check" title="Mark this category done"><input type="checkbox" data-checked="${g.id}" ${d.checked?.includes(g.id)?'checked':''} aria-label="Mark ${esc(g.name)} completed"></label></div>`).join('');
  $('checklist-categories').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{categoryId=b.dataset.category;d.category=categoryId;checkpoint();updateOutput();$('checklist-categories').querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('chosen',x===b))});
  $('checklist-categories').querySelectorAll('[data-checked]').forEach(b=>b.onchange=()=>{d.checked=Array.isArray(d.checked)?d.checked:[];d.checked=b.checked?[...new Set([...d.checked,b.dataset.checked])]:d.checked.filter(x=>x!==b.dataset.checked);checkpoint();$('checklist-progress').textContent=`${categories.filter(g=>d.checked.includes(g.id)).length} of ${categories.length} categories checked · Device status: ${d.done?'Completed':'In progress'} · Categories are optional; only you decide when the device is ready.`});
  updateOutput();
 }
 function updateOutput(){const d=current(),g=guide();$('checklist-output-title').textContent=g?`${d.name} · ${g.name.replace(/^\d+\s+/,'')}`:'IOS CLI';$('checklist-cli').textContent=g?checklistTerminal(d,g):'Add a Router or Switch to view the terminal.';$('checklist-cli').scrollTop=0;$('checklist-copy').disabled=!g;$('checklist-export').disabled=!g}
 $('checklist-reset-all').onclick=()=>{if(!devices.length)return;if(!confirm('Delete ALL checklist devices and their progress? This cannot be undone after you leave the page.'))return;devices=[];state.checklistDevices=[];state.checklistSelected=null;categoryId='basic';checkpoint();redraw()};
 $('checklist-add').onclick=()=>{const kind=$('checklist-kind').value,num=devices.filter(d=>d.kind===kind).length+1,name=`${kind} ${num}`;const id='d'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);devices.push({id,kind,name,done:false,checked:[],category:'basic'});state.checklistDevices=devices;state.checklistSelected=id;categoryId='basic';checkpoint();redraw()};
 $('checklist-copy').onclick=()=>copyValue(checklistCommands(guide()).join('\n'),$('checklist-copy'));
 $('checklist-export').onclick=()=>{const d=current(),g=guide();if(!d||!g)return;download((d.name+'-'+g.id).replace(/[^a-z0-9-]/gi,'_')+'.txt',checklistCommands(g).join('\n'))};
 if(selected&&!state.checklistSelected)state.checklistSelected=selected.id;
 redraw();
}


const osiLayers=[
 {number:7,name:'Application',pdu:'Data',key:'Network services for applications',address:'Application-level names and resources',examples:['HTTP / HTTPS','DNS','DHCP','SMTP'],explain:'The services that applications use to communicate over a network. A web browser requesting a page and a DNS client resolving a name are examples.',diagnose:'Website fails by name but works by IP',check:'Test DNS resolution, the requested URL, and application service availability.',color:'#866ab8'},
 {number:6,name:'Presentation',pdu:'Data',key:'How the data is represented',address:'No OSI-layer address',examples:['Encoding','Compression','Data format','Encryption representation'],explain:'Makes the data understandable to the receiving application: representation, formatting, encoding, and (in the OSI model) encryption or compression.',diagnose:'One endpoint cannot interpret received data',check:'Compare data format, character encoding, and cryptographic compatibility.',color:'#a476b7'},
 {number:5,name:'Session',pdu:'Data',key:'Keeping a conversation organized',address:'Session context',examples:['Session establishment','Session maintenance','Session termination'],explain:'Organizes communication sessions, including establishing, maintaining, and closing an exchange. Real TCP/IP implementations do not map every OSI session function to a separate protocol.',diagnose:'A connection repeatedly loses its application session',check:'Inspect session lifetimes, authentication state, and application logs.',color:'#7293c6'},
 {number:4,name:'Transport',pdu:'TCP segment / UDP datagram',key:'The right process on the right host',address:'TCP/UDP port numbers',examples:['TCP','UDP','Port 443','Port 53'],explain:'Provides end-to-end process communication. TCP manages reliable ordered byte streams; UDP offers lightweight datagrams. Ports identify the destination service.',diagnose:'Ping works but the expected TCP service does not',check:'Check listening ports, TCP/UDP choice, host firewalls, and transport reachability.',color:'#4eaa93'},
 {number:3,name:'Network',pdu:'Packet',key:'Across networks to the destination',address:'Source / destination IP',examples:['IPv4','IPv6','Routers','ICMP'],explain:'Uses logical addressing and routing between networks. A router chooses a next hop and forwards an IP packet.',diagnose:'Same-subnet traffic works but remote networks do not',check:'Check IP address, prefix, default gateway, and routing tables.',color:'#d1a65a'},
 {number:2,name:'Data Link',pdu:'Frame',key:'Delivery across one local link',address:'Source / destination MAC',examples:['Ethernet','Switches','VLANs','MAC table'],explain:'Packages packets into frames for a local link. Ethernet switches forward frames using MAC addresses; the Layer 2 header can change at each routed hop.',diagnose:'Wrong VLAN or no MAC learning on a switch port',check:'Check switchport mode, VLAN membership, trunking, ARP/ND, and the MAC table.',color:'#ce8567'},
 {number:1,name:'Physical',pdu:'Bits',key:'Signals over the medium',address:'No MAC/IP address here',examples:['Copper','Fiber','Radio','Link LEDs'],explain:'Moves raw bits as signals through copper, fiber, or wireless media. Without a working physical link, nothing higher up can communicate.',diagnose:'Link down or no link light',check:'Check cable/transceiver, port shutdown state, link LEDs, and speed/duplex.',color:'#c96678'}
];
const osiStages=[
 {label:'Application → data',pdu:'Data',parts:[['DATA','data']],desc:'An application creates information to send. Upper OSI layers prepare it for the network.'},
 {label:'Transport → segment',pdu:'TCP Segment',parts:[['TCP header','tcp'],['DATA','data']],desc:'Transport adds information such as source and destination ports. This example uses TCP; with UDP, it would be a datagram.'},
 {label:'Network → packet',pdu:'IP Packet',parts:[['IP header','ip'],['TCP header','tcp'],['DATA','data']],desc:'The packet gets source and destination IP addresses so routers can deliver it between networks.'},
 {label:'Data Link → frame',pdu:'Ethernet Frame',parts:[['Ethernet header','eth'],['IP header','ip'],['TCP header','tcp'],['DATA','data'],['FCS','fcs']],desc:'The Ethernet frame adds local-link MAC addressing and an FCS trailer. The frame is rebuilt for each routed Ethernet hop.'},
 {label:'Physical → bits',pdu:'Bits',parts:[['10110100 01101001 11001010 00110101','bits']],desc:'The complete frame is transmitted as signals. On reception, the receiver processes it back up the stack.'}
];
const osiScenarios={
 web:{title:'PC → Switch → Router → Web Server',steps:[
  ['PC · Application','The browser requests a web page. DNS resolution may happen first.'],
  ['PC · Transport','TCP uses source and destination ports; HTTPS commonly uses destination port 443.'],
  ['PC · Network','The source PC builds an IP packet addressed to the server. The destination is outside the local subnet.'],
  ['PC · Data Link','The PC uses its default gateway’s MAC as the frame destination (after ARP or Neighbor Discovery).'],
  ['Switch · Layer 2','The switch forwards the Ethernet frame using its MAC address table. It normally does not change the packet’s IP destination.'],
  ['Router · Layer 3','The router removes the incoming link framing, examines the destination IP, decrements the hop limit/TTL, and sends a new frame to the next hop.'],
  ['Server · Receive','The server processes the incoming frame, IP packet, transport data, and application request. The response follows a return path.']
 ]},
 lan:{title:'PC → Switch → PC (same VLAN)',steps:[
  ['Sender · Application','A local application creates data for another host in the same IP subnet.'],
  ['Sender · Network','The destination IP is on-link; no router or default gateway is needed for this packet.'],
  ['Sender · Data Link','ARP (IPv4) or Neighbor Discovery (IPv6) resolves the peer’s local-link address as needed.'],
  ['Switch · Layer 2','The switch learns source MAC addresses and forwards the frame to the destination port.'],
  ['Receiver · Decapsulation','The receiving host checks the frame, then delivers the IP payload up to the correct transport/application process.']
 ]}
};
const osiCss=`
.osi-actions{display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 14px}
.osi-intro{color:#b3c5d9;line-height:1.55;max-width:850px}
.osi-grid{display:grid;grid-template-columns:minmax(270px,.88fr) minmax(320px,1.12fr);gap:14px}
.osi-card{background:#222e3e;border:1px solid #485b72;border-radius:11px;padding:17px;min-width:0;margin-bottom:14px}
.osi-card h2{margin:0 0 13px;font-size:16px}
.osi-stack{display:grid;gap:6px}.osi-layer{display:flex;align-items:center;gap:10px;width:100%;background:#1a2838;border:1px solid #45556b;text-align:left;padding:10px;border-radius:7px;min-height:58px}
.osi-layer.active{background:#2a4056;outline:2px solid #7cb3e8;outline-offset:-2px}.osi-n{display:grid;place-items:center;flex:none;width:35px;height:35px;border-radius:5px;color:#fff;font-size:17px;font-weight:750}
.osi-layer strong,.osi-layer small{display:block}.osi-layer small{margin-top:4px;color:#b4c5d8;font-size:11px}.osi-grow{flex:1}.osi-pdu{color:#c3d1e1;font-size:11px;text-align:right;max-width:115px}
.osi-layer-title{display:flex;align-items:center;gap:11px;margin-bottom:14px}.osi-layer-title h2{margin:0}.osi-description{font-size:14px;line-height:1.65;color:#e4eaf3}
.osi-kv{display:grid;grid-template-columns:minmax(105px,.3fr) 1fr;border-top:1px solid #415066;padding:10px 0;gap:12px}.osi-kv span:first-child{color:#9eb3ca}.osi-examples{display:flex;gap:7px;flex-wrap:wrap}.osi-chip{background:#304358;border:1px solid #4c647e;border-radius:20px;padding:5px 10px;font-size:12px}
.osi-section-desc{color:#acc0d6;line-height:1.55;margin:0 0 14px}.osi-step-title{font-size:13px;color:#c9d8e9;margin:12px 0 9px}.osi-packet{display:flex;gap:3px;overflow-x:auto;align-items:stretch;padding:12px;background:#111d2b;border-radius:8px;min-height:88px}
.osi-packet-part{display:grid;place-items:center;text-align:center;padding:13px 10px;min-width:78px;flex:1;color:#fff;border-radius:3px;font:600 11px Consolas,monospace;white-space:nowrap}.osi-packet-part.data{flex:2}.osi-packet-part.bits{min-width:360px;font-size:13px}
.osi-controls{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:13px;flex-wrap:wrap}.osi-controls button:disabled{opacity:.4;cursor:default}.osi-step-note{min-height:55px;line-height:1.55;color:#cbd9e9}
.osi-models{display:grid;grid-template-columns:1fr 1fr;gap:12px}.osi-model-stack{display:grid;gap:4px}.osi-model-cell{padding:11px 9px;border:1px solid #526176;border-radius:5px;font-size:12px;background:#253549;text-align:center}.osi-model-cell strong{display:block;margin-bottom:4px}.osi-model-cell small{color:#c0d1e0}
.osi-scenario-select{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.osi-scenario-select select{max-width:100%;flex:1}.osi-scenario-steps{display:grid;gap:8px}.osi-scenario-step{display:flex;align-items:start;gap:12px;background:#1b2a3a;border:1px solid #3a4e65;border-radius:7px;padding:10px 12px}.osi-scenario-step b{display:grid;place-items:center;background:#365e83;border-radius:50%;width:27px;height:27px;flex:none}.osi-scenario-step strong{display:block;margin-bottom:5px}.osi-scenario-step p{margin:0;color:#bdcbda;line-height:1.5}
.osi-warning{font-size:12px;color:#a8bdd1;line-height:1.5}.osi-card .osi-tagline{font-size:12px;color:#b6c6d8;margin:0 0 8px}
@media(max-width:900px){.osi-grid{grid-template-columns:1fr}}@media(max-width:540px){.osi-models{grid-template-columns:1fr 1fr}.osi-pdu{display:none}.osi-card{padding:11px}}
`;
const osiStyle=document.createElement('style');osiStyle.textContent=osiCss;document.head.append(osiStyle);
function renderOSI(){
 title('OSI MODEL','Understand the layers, follow encapsulation, and trace a packet through a real network. No quizzes, no distractions.');
 const getLayer=()=>osiLayers.find(x=>x.number===state.osiLayer)||osiLayers[0];
 const stage=Math.max(0,Math.min(4,Number(state.osiStep)||0));state.osiStep=stage;
 content.insertAdjacentHTML('beforeend',`<div class="osi-actions"><span class="osi-intro">Select a layer to understand its job and what to troubleshoot. Then follow data down the stack and back up at the receiver.</span><button id="osi-reset" type="button">Reset OSI</button></div><div class="osi-grid"><section class="osi-card"><h2>7 layers · click to explore</h2><div class="osi-stack" id="osi-stack"></div></section><section class="osi-card" id="osi-detail" aria-live="polite"></section></div><section class="osi-card"><h2>Encapsulation &amp; Decapsulation</h2><p class="osi-section-desc">Follow one TCP-based Ethernet example. Every step adds or removes information as data moves through the stack.</p><div class="osi-controls" style="margin-top:0"><div class="tool-mode-switch" role="group" aria-label="Direction"><button id="osi-send">Sender · down</button><button id="osi-receive">Receiver · up</button></div><span id="osi-progress" class="osi-warning"></span></div><div class="osi-step-title" id="osi-stage-title"></div><div class="osi-packet" id="osi-packet"></div><p class="osi-step-note" id="osi-stage-note"></p><div class="osi-controls"><button id="osi-back">← Previous</button><button id="osi-next">Next step →</button></div></section><div class="osi-grid"><section class="osi-card"><h2>OSI vs TCP/IP</h2><p class="osi-section-desc">Same communication, different ways of grouping functions. TCP/IP is the practical internet protocol suite.</p><div class="osi-models"><div class="osi-model-stack"><div class="osi-model-cell"><strong>OSI 7</strong>Application</div><div class="osi-model-cell"><strong>OSI 6</strong>Presentation</div><div class="osi-model-cell"><strong>OSI 5</strong>Session</div><div class="osi-model-cell"><strong>OSI 4</strong>Transport</div><div class="osi-model-cell"><strong>OSI 3</strong>Network</div><div class="osi-model-cell"><strong>OSI 2</strong>Data Link</div><div class="osi-model-cell"><strong>OSI 1</strong>Physical</div></div><div class="osi-model-stack"><div class="osi-model-cell" style="grid-row:span 3;display:grid;align-content:center"><strong>TCP/IP Application</strong><small>HTTP · DNS · application data formats</small></div><div class="osi-model-cell"><strong>Transport</strong><small>TCP · UDP</small></div><div class="osi-model-cell"><strong>Internet</strong><small>IP · ICMP</small></div><div class="osi-model-cell" style="grid-row:span 2;display:grid;align-content:center"><strong>Network Access</strong><small>Ethernet · physical media</small></div></div></div><p class="osi-warning">The four-layer TCP/IP model is shown. Other teaching materials sometimes separate Link and Physical into five layers.</p></section><section class="osi-card"><h2>Follow a real packet</h2><p class="osi-section-desc">See which addresses and headers matter as data crosses the network.</p><div class="osi-scenario-select"><label for="osi-scenario">Scenario</label><select id="osi-scenario"><option value="web">PC → Switch → Router → Web Server</option><option value="lan">PC → Switch → PC (same VLAN)</option></select></div><div class="osi-scenario-steps" id="osi-scenario-steps"></div></section></div><section class="osi-card"><h2>Troubleshooting by OSI layer</h2><p class="osi-section-desc">Use the same layer selection above to see typical failures and first checks. Layer 1 → Layer 7 is a useful diagnostic order, not a rule that every problem has only one layer.</p><div class="osi-grid" style="margin:0"><div class="osi-kv"><span>Example symptom</span><strong id="osi-trouble-symptom"></strong></div><div class="osi-kv"><span>Where to look</span><strong id="osi-trouble-check"></strong></div></div></section>`);
 const renderLayer=()=>{
  $('osi-stack').innerHTML=osiLayers.map(l=>`<button class="osi-layer ${state.osiLayer===l.number?'active':''}" data-layer="${l.number}" aria-pressed="${state.osiLayer===l.number}"><span class="osi-n" style="background:${l.color}">${l.number}</span><span class="osi-grow"><strong>${l.name}</strong><small>${l.key}</small></span><span class="osi-pdu">${l.pdu}</span></button>`).join('');
  const l=getLayer();$('osi-detail').innerHTML=`<div class="osi-layer-title"><span class="osi-n" style="background:${l.color}">${l.number}</span><h2>${l.name}</h2></div><p class="osi-tagline">${l.key}</p><p class="osi-description">${l.explain}</p><div class="osi-kv"><span>PDU</span><strong>${l.pdu}</strong></div><div class="osi-kv"><span>Address / identifier</span><strong>${l.address}</strong></div><div class="osi-kv"><span>Recognize it by</span><div class="osi-examples">${l.examples.map(x=>`<span class="osi-chip">${x}</span>`).join('')}</div></div><div class="osi-kv"><span>Think of it as</span><strong>${l.key}</strong></div>`;
  $('osi-trouble-symptom').textContent=l.diagnose;$('osi-trouble-check').textContent=l.check;
  $('osi-stack').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.osiLayer=Number(b.dataset.layer);checkpoint();renderLayer()});
 };
 const renderStage=()=>{const receiving=state.osiDirection==='receive';const index=receiving?4-state.osiStep:state.osiStep;const info=osiStages[index];$('osi-stage-title').textContent=info.label;$('osi-progress').textContent=`Step ${state.osiStep+1} / 5 · ${receiving?'Receiver':'Sender'}`;$('osi-packet').innerHTML=info.parts.map(([label,type])=>`<span class="osi-packet-part ${type}" style="background:${({data:'#517d9e',tcp:'#319474',ip:'#be914a',eth:'#a9678d',fcs:'#83597a',bits:'#355e86'})[type]}">${label}</span>`).join('');$('osi-stage-note').textContent=receiving?[
 'The receiving interface interprets the signals as bits and reconstructs a link-layer frame.',
 'The receiver validates the frame, removes the Ethernet header and FCS, and passes the IP packet upward.',
 'IP checks the destination address and hands the transport payload to the right next protocol.',
 'TCP uses port numbers and transport state to deliver application data to the correct process.',
 'The receiving application processes the data.'
 ][state.osiStep]:info.desc;
  $('osi-back').disabled=state.osiStep===0;$('osi-next').disabled=state.osiStep===4;$('osi-send').classList.toggle('selected',!receiving);$('osi-receive').classList.toggle('selected',receiving);
 };
 const renderScenario=()=>{const key=state.osiScenario in osiScenarios?state.osiScenario:'web';$('osi-scenario').value=key;$('osi-scenario-steps').innerHTML=osiScenarios[key].steps.map(([heading,description],i)=>`<div class="osi-scenario-step"><b>${i+1}</b><div><strong>${heading}</strong><p>${description}</p></div></div>`).join('')};
 $('osi-send').onclick=()=>{state.osiDirection='send';state.osiStep=0;checkpoint();renderStage()};$('osi-receive').onclick=()=>{state.osiDirection='receive';state.osiStep=0;checkpoint();renderStage()};$('osi-back').onclick=()=>{state.osiStep=Math.max(0,state.osiStep-1);checkpoint();renderStage()};$('osi-next').onclick=()=>{state.osiStep=Math.min(4,state.osiStep+1);checkpoint();renderStage()};$('osi-scenario').onchange=()=>{state.osiScenario=$('osi-scenario').value;checkpoint();renderScenario()};
 $('osi-reset').onclick=()=>{if(!confirm('Reset OSI view to its defaults?'))return;state.osiLayer=7;state.osiStep=0;state.osiDirection='send';state.osiScenario='web';checkpoint();renderLayer();renderStage();renderScenario()};
 renderLayer();renderStage();renderScenario();
}


document.addEventListener('keydown',event=>{
 const target=event.target;
 if(!(target instanceof HTMLElement)||!content.contains(target))return;
 if(event.altKey||event.ctrlKey||event.metaKey)return;
 const tag=target.tagName;
 if(tag==='INPUT' && target.type==='checkbox' && event.key==='Enter'){
  event.preventDefault();target.click();return;
 }
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||target.isContentEditable)return;
 const key=event.key;
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))return;
 let container=null,selector=null;
 if(target.matches('#checklist-categories .checklist-select')){
  container=$('checklist-categories');selector='.checklist-select';
 }else if(target.matches('#checklist-device-list .checklist-device')){
  container=$('checklist-device-list');selector='.checklist-device';
 }else if(target.matches('#osi-stack .osi-layer')){
  container=$('osi-stack');selector='.osi-layer';
 }else return;
 const nodes=[...container.querySelectorAll(selector)];
 const index=nodes.indexOf(target);
 if(index<0||!nodes.length)return;
 event.preventDefault();
 const delta=key==='ArrowUp'||key==='ArrowLeft'?-1:1;
 const next=nodes[Math.max(0,Math.min(nodes.length-1,index+delta))];
 if(next!==target){
  next.click();
  const refreshed=[...container.querySelectorAll(selector)];
  (refreshed[nodes.indexOf(next)]||next).focus();
 }
});

const TOPO_KEY='devden-topology-v1';
const TOPO_TYPES=['Router','Switch','ISP','Server','PC','Laptop','Mobile Phone'];
const TOPO_PALETTE=['#62bda8','#dfae68','#b799dc','#d7889d','#8ca6de','#c3bd70','#68a9e5'];
const TOPO_ICONS={Router:'router',Switch:'switch',ISP:'cloud',Server:'server',PC:'pc',Laptop:'laptop','Mobile Phone':'phone'};
function topoIcon(type){const inner={Router:'<rect x="3" y="8" width="26" height="14" rx="5"/><path d="M9 13h14M9 17h14M8 5l4-3m12 3-4-3"/><circle cx="9" cy="17" r="1"/>',Switch:'<rect x="2" y="8" width="28" height="16" rx="3"/><path d="M6 13h4m3 0h4m3 0h4M6 19h4m3 0h4m3 0h4"/>',ISP:'<path d="M8 24a7 7 0 0 1-1-14 10 10 0 0 1 19 2 6 6 0 0 1-2 12Z"/>',Server:'<rect x="6" y="3" width="20" height="26" rx="2"/><path d="M6 12h20M6 21h20"/><circle cx="11" cy="8" r="1"/><circle cx="11" cy="17" r="1"/><circle cx="11" cy="25" r="1"/>',PC:'<rect x="3" y="3" width="26" height="19" rx="2"/><path d="M16 22v6M9 28h14"/>','Mobile Phone':'<rect x="10" y="2" width="12" height="28" rx="3"/><path d="M14 26h4"/>',Laptop:'<rect x="5" y="3" width="22" height="20" rx="2"/><path d="M2 27h28l-3-4H5Z"/>'}[type]||'';return `<svg class="topo-hardware" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`}
function topoDefault(){return {devices:[],links:[],zones:[],notes:[],view:'physical',cable:'normal',counter:0,zoneCounter:0,noteCounter:0,paletteVersion:2};}
function topoLoad(){try{const s=JSON.parse(localStorage.getItem(toolkitStorageKey(TOPO_KEY)));if(!s||!Array.isArray(s.devices)||!Array.isArray(s.links)||!Array.isArray(s.zones))return topoDefault();const t={...topoDefault(),...s};t.notes=Array.isArray(t.notes)?t.notes:[];for(const d of t.devices){const old=d.positions?.physical||d.positions?.logical;d.x=Number.isFinite(d.x)?d.x:(old?.x??140);d.y=Number.isFinite(d.y)?d.y:(old?.y??140);delete d.positions;d.locked=!!d.locked;}for(const l of t.links){if(typeof l.physical==='string')l.physical={a:'',middle:l.physical,b:''};if(typeof l.logical==='string')l.logical={a:'',middle:l.logical,b:''};l.physical ||= {a:'',middle:'',b:''};l.logical ||= {a:'',middle:'',b:''};l.locked=!!l.locked;}for(const [index,z] of t.zones.entries()){z.locked=!!z.locked;if(s.paletteVersion!==2&&TOPO_PALETTE.includes(z.color)){const ordinal=Number(String(z.id).replace(/^z/,''));z.color=TOPO_PALETTE[(Number.isFinite(ordinal)&&ordinal>0?ordinal-1:index)%TOPO_PALETTE.length]}}t.paletteVersion=2;t.notes=t.notes.flatMap(note=>{if(note.type!=='chartMirror'||!Array.isArray(note.sourceIds)||note.sourceIds.length<2)return[note];const width=Math.max(172,Math.round((note.w||480)/note.sourceIds.length));return note.sourceIds.map((id,index)=>({...note,id:index?'n'+(++t.noteCounter):note.id,sourceIds:[id],x:(note.x||0)+index*(width+14),w:width}))});return t}catch{return window.DEVDEN_EMBEDDED_CONFIG?.topology?{...topoDefault(),...structuredClone(window.DEVDEN_EMBEDDED_CONFIG.topology)}:topoDefault()}}
let topo=topoLoad(),topoSelected=null,topoSelection=[],topoConnecting=null,topoDrag=null,topoSkipClick=false,topoTool='select',topoZoom=1,topoUndo=[],topoRedo=[],topoHistoryPending=null,topoNudgeUntil=0,topoGuideTimer=null;
// Collaboration-safe history stores only locally changed objects/properties.
// In particular, a remote update must never become part of somebody's Undo.
function topoHistorySnapshot(){return {topology:structuredClone(topo),checklist:structuredClone(state.checklistDevices||[])}}
const topoHistoryEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function topoHistoryChanges(before,after){
 const changes=[];
 const deep=(kind,id,a,b,path=[])=>{
  if(topoHistoryEqual(a,b))return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
   for(const key of new Set([...Object.keys(a),...Object.keys(b)]))deep(kind,id,a[key],b[key],[...path,key]);
  }else changes.push({kind,id,path,before:structuredClone(a),after:structuredClone(b)});
 };
 for(const kind of ['device','zone','note','link','checklist']){
  const source=kind==='checklist'?before.checklist:before.topology[kind==='device'?'devices':kind==='zone'?'zones':kind==='note'?'notes':'links'];
  const target=kind==='checklist'?after.checklist:after.topology[kind==='device'?'devices':kind==='zone'?'zones':kind==='note'?'notes':'links'];
  const a=new Map(source.map(x=>[x.id,x])),b=new Map(target.map(x=>[x.id,x]));
  for(const id of new Set([...a.keys(),...b.keys()])){
   if(!a.has(id)||!b.has(id))changes.push({kind,id,path:null,before:a.has(id)?structuredClone(a.get(id)):undefined,after:b.has(id)?structuredClone(b.get(id)):undefined});
   else deep(kind,id,a.get(id),b.get(id));
  }
 }
 return changes;
}
function topoHistoryList(kind){return kind==='checklist'?(state.checklistDevices||=[]):topoList(kind)}
function topoHistoryAt(object,path){return path.reduce((current,key)=>current?.[key],object)}
function topoHistoryApply(changes,reverse){
 let applied=0,skipped=0;
 // Restore objects before property edits. Deletions are processed last.
 const ordered=[...changes].sort((a,b)=>Number(a.path===null&&((reverse?a.before:a.after)===undefined))-Number(b.path===null&&((reverse?b.before:b.after)===undefined)));
 for(const change of ordered){
  const {kind,id,path}=change,list=topoHistoryList(change.kind);
  const index=list.findIndex(x=>x.id===id),item=index<0?undefined:list[index],expected=reverse?change.after:change.before,value=reverse?change.before:change.after;
  if(window.DevDenCollab&&kind!=='checklist'&&item&&!window.DevDenCollab.canEditRef({kind,id})){skipped++;continue}
  if(path===null){
   if(!topoHistoryEqual(item,expected)){skipped++;continue}
   if(value===undefined){
    // Never delete a teammate's newly added cable to our device.
    if(kind==='device'&&topo.links.some(l=>(l.a===id||l.b===id)&&!changes.some(c=>c.kind==='link'&&c.id===l.id&&c.path===null&&(reverse?c.before:c.after)===undefined))){skipped++;continue}
    if(index>=0)list.splice(index,1);
   }else if(index>=0)list[index]=structuredClone(value);
   else list.push(structuredClone(value));
  }else{
   if(!item||!topoHistoryEqual(topoHistoryAt(item,path),expected)){skipped++;continue}
   const parent=topoHistoryAt(item,path.slice(0,-1)),key=path.at(-1);
   if(!parent||typeof parent!=='object'){skipped++;continue}
   if(value===undefined)delete parent[key];else parent[key]=structuredClone(value);
  }
  applied++;
 }
 return {applied,skipped};
}
function topoSave(){
 const editing=Boolean(document.activeElement?.matches('#topo-board input:not([readonly]),#topo-board textarea:not([readonly])'));
 if(topoHistoryPending&&!editing){
  const changes=topoHistoryChanges(topoHistoryPending,topoHistorySnapshot());topoHistoryPending=null;
  if(changes.length){topoUndo.push(changes);if(topoUndo.length>70)topoUndo.shift();topoRedo=[]}
 }
 try{localStorage.setItem(toolkitStorageKey(TOPO_KEY),JSON.stringify(topo));window.dispatchEvent(new Event('devden-state-updated'))}catch{}
 topoUpdateSaveStatus();topoUpdateHistoryButtons();
}
function topoCheckpoint(){if(!topoHistoryPending)topoHistoryPending=topoHistorySnapshot()}
function topoTravelHistory(reverse){
 if(topoHistoryPending){topoSave();if(topoHistoryPending)return}
 const from=reverse?topoUndo:topoRedo,to=reverse?topoRedo:topoUndo;
 if(!from.length)return;
 const changes=from.pop(),before=topoHistorySnapshot(),result=topoHistoryApply(changes,reverse);
 if(result.applied){
  const after=topoHistorySnapshot();to.push(topoHistoryChanges(reverse?after:before,reverse?before:after));
  // For Undo the redo entry represents afterUndo -> beforeUndo; for Redo
  // the undo entry represents beforeRedo -> afterRedo.
  topoSelection=topoSelection.filter(ref=>Boolean(topoItem(ref)));topoSelected=topoSelection.at(-1)||null;
  try{localStorage.setItem(toolkitStorageKey('devden-toolkit-v2'),JSON.stringify(state))}catch{}
  topoSave();topoRefresh();
 }
 if(result.skipped){const msg=`${result.skipped} change(s) skipped: another member changed or locked the item.`;const status=$('topo-search-feedback');if(status)status.textContent=msg;else console.info(msg)}
 topoUpdateHistoryButtons();
}
function topoUndoLast(){topoTravelHistory(true)}
function topoRedoLast(){topoTravelHistory(false)}
function topoUpdateHistoryButtons(){const undo=$('topo-undo'),redo=$('topo-redo');if(undo)undo.disabled=!topoUndo.length;if(redo)redo.disabled=!topoRedo.length}
function topoPosition(d){return {x:d.x??140,y:d.y??140}}
function topoSafe(s){return esc(String(s??''))}
function topoList(kind){return kind==='device'?topo.devices:kind==='zone'?topo.zones:kind==='link'?topo.links:topo.notes}
function topoItem(sel){return sel?topoList(sel.kind).find(x=>x.id===sel.id):null}
function topoGetSelected(){return topoItem(topoSelected)}
function topoContains(kind,id){return topoSelection.some(x=>x.kind===kind&&x.id===id)}
function topoSelect(kind,id,append=false){const ref={kind,id};if(append){const exists=topoContains(kind,id);topoSelection=exists?topoSelection.filter(x=>x.kind!==kind||x.id!==id):[...topoSelection,ref];topoSelected=topoSelection.at(-1)||null}else{topoSelection=[ref];topoSelected=ref}topoPaintSelection();window.dispatchEvent(new Event('devden-topo-selection'))}
function topoClear(){topoSelection=[];topoSelected=null;topoPaintSelection();window.dispatchEvent(new Event('devden-topo-selection'))}
function topoPaintSelection(){const board=$('topo-board');if(!board)return;board.querySelectorAll('[data-device],[data-zone],[data-note],[data-link]').forEach(e=>{let kind=e.dataset.device?'device':e.dataset.zone?'zone':e.dataset.note?'note':'link',id=e.dataset.device||e.dataset.zone||e.dataset.note||e.dataset.link;e.classList.toggle('selected',topoContains(kind,id));if(kind==='link'&&e.classList.contains('topo-link-wrap')){const input=e.querySelector('input');if(input)input.placeholder=''}});topoUpdateStatus();topoGuides();window.DevDenCollab?.paint?.()}
function topoAdd(type){topoCheckpoint();const n=++topo.counter,number=topo.devices.filter(d=>d.type===type).length+1,x=130+((n-1)%5)*150,y=115+Math.floor(((n-1)%20)/5)*120;const prefixes={ISP:'ISP',Router:'R',Switch:'SW',Server:'SRV',PC:'PC',Laptop:'LAP','Mobile Phone':'MOB'};const d={id:'d'+crypto.randomUUID(),type,name:prefixes[type]+number,ip:'',ports:'',x,y,locked:false};topo.devices.push(d);topoSelection=[{kind:'device',id:d.id}];topoSelected=topoSelection[0];topoSave();topoRefresh()}
function topoAddZone(){topoCheckpoint();const n=++topo.zoneCounter,used=new Set(topo.zones.map(z=>/^LAN\s+(\d+)$/i.exec(z.name||'')).filter(Boolean).map(m=>+m[1]));let number=1;while(used.has(number))number++;topo.zones.push({id:'z'+crypto.randomUUID(),name:'LAN '+number,network:'',color:TOPO_PALETTE[(number-1)%TOPO_PALETTE.length],x:55+(n%3)*35,y:70+(n%3)*32,w:300,h:220,locked:false});topoSelection=[{kind:'zone',id:topo.zones.at(-1).id}];topoSelected=topoSelection[0];topoSave();renderTopology()}
const TOPO_STICKY_TYPES={troubleshooting:['Troubleshooting','amber','⚠'],error:['Error','red','!'],solution:['Solution','green','✓'],information:['Information','blue','ⓘ'],reminder:['Reminder','purple','◷'],custom:['Sticky note','neutral','▣']};
function topoStickyKind(type){return type==='warning'?'troubleshooting':type==='info'?'information':(TOPO_STICKY_TYPES[type]?type:'custom')}
function topoAddSticky(type='information'){topoCheckpoint();const n=++topo.noteCounter;const note={id:'n'+crypto.randomUUID(),type:'sticky',stickyType:topoStickyKind(type),x:230+(n%5)*30,y:220+(n%5)*25,w:180,h:125,title:'',text:'',scope:'both',locked:false};topo.notes.push(note);topoSelection=[{kind:'note',id:note.id}];topoSelected=topoSelection[0];topoSave();topoRefresh()}
function topoAddNote(){topoCheckpoint();const n=++topo.noteCounter;const note={id:'n'+crypto.randomUUID(),x:230+(n%5)*30,y:220+(n%5)*25,w:108,h:32,physical:'',logical:'',scope:'both',locked:false};topo.notes.push(note);topoSelection=[{kind:'note',id:note.id}];topoSelected=topoSelection[0];topoSave();topoRefresh()}
function topoDelete(){if(window.DevDenCollab&&topoSelection.some(x=>!window.DevDenCollab.canEditRef(x))){window.DevDenCollab.warn();return}const remove=topoSelection.filter(x=>!topoItem(x)?.locked);if(!remove.length)return;topoCheckpoint();const ids=new Set(remove.filter(x=>x.kind==='device').map(x=>x.id));for(const kind of ['device','zone','note','link']){const excluded=new Set(remove.filter(x=>x.kind===kind).map(x=>x.id));if(kind==='link')topo.links=topo.links.filter(x=>!excluded.has(x.id)&&!ids.has(x.a)&&!ids.has(x.b));else if(kind==='device')topo.devices=topo.devices.filter(x=>!excluded.has(x.id));else if(kind==='zone')topo.zones=topo.zones.filter(x=>!excluded.has(x.id));else topo.notes=topo.notes.filter(x=>!excluded.has(x.id))}topoClear();topoConnecting=null;topoSave();topoRefresh()}
function topoToggleLock(){if(!topoSelection.length)return;topoCheckpoint();const unlocked=topoSelection.some(s=>!topoItem(s)?.locked);topoSelection.forEach(s=>{const x=topoItem(s);if(x)x.locked=unlocked});topoSave();topoRefresh()}
function topoZoneText(z,view=topo.view){z.labels ||= {physical:{name:z.name||'',network:z.network||''},logical:{name:z.name||'',network:z.network||''}};return z.labels[view] ||= {name:'',network:''}}
function topoGrowTextBox(input,note){
 if(!note||note.type==='sticky'||note.type==='chartMirror')return;
 const box=input.closest('.topo-note');if(!box)return;
 // This is a writing box, not an automatically wrapping paragraph: ordinary
 // typing grows its width, while an explicit newline adds a visible row.
 const lines=String(input.value||'').split('\n');
 const style=getComputedStyle(input);
 const measure=document.createElement('canvas').getContext('2d');
 measure.font=style.font||'11px Consolas,monospace';
 const maxLine=Math.max(0,...lines.map(line=>measure.measureText(line||' ').width));
 const wantedWidth=Math.max(52,Math.min(700,Math.ceil(maxLine)+24));
 const wantedHeight=Math.max(28,lines.length*17+12);
 // Respect an intentionally larger manual resize, but never clip newly typed text.
 const width=Math.max(note.w||52,wantedWidth);
 const height=Math.max(note.h||28,wantedHeight);
 if(width!==note.w||height!==note.h){note.w=width;note.h=height;box.style.width=width+'px';box.style.height=height+'px';}
}
function topoEditOnDouble(input,save,locked=false){
 input.readOnly=true;input.tabIndex=-1;input.classList.add('topo-readonly');let original=input.value;
 input.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();if(locked||topoTool!=='select')return;const parent=input.closest('[data-device],[data-zone],[data-note],[data-link]');if(parent&&window.DevDenCollab&&!window.DevDenCollab.canEdit(parent)){window.DevDenCollab.warn();return}original=input.value;topoCheckpoint();input.readOnly=false;input.tabIndex=0;input.classList.remove('topo-readonly');input.focus();input.select()});
 input.addEventListener('input',()=>save(input.value));
 input.addEventListener('blur',()=>{input.readOnly=true;input.tabIndex=-1;input.classList.add('topo-readonly');topoSave()});
 input.addEventListener('keydown',e=>{if(input.readOnly)return;e.stopPropagation();if(e.key==='Escape'){e.preventDefault();input.blur()}else if(e.key==='Enter'&&!e.shiftKey&&input.tagName!=='TEXTAREA'){e.preventDefault();input.blur()}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();input.blur()}});
}
// Endpoint labels belong to the devices, not the free space between them.
// Each connection therefore has three constant anchors: device A, wire midpoint, device B.
// Labels may grow as text gets longer, but typing must never move them elsewhere.
// Device attachment points are computed from the device's actual rendered size.
// Start/end labels grow OUTWARD from the border; the middle stays at the wire midpoint.
function topoWireLabelPositions(x1,y1,x2,y2,sizeA={w:106,h:76},sizeB={w:106,h:76}){
 const edge=(x,y,tx,ty,size)=>{
  const dx=tx-x,dy=ty-y;
  const halfW=Math.max(1,size.w/2),halfH=Math.max(1,size.h/2);
  const t=Math.min(Math.abs(dx)>0.001?halfW/Math.abs(dx):Infinity,
                   Math.abs(dy)>0.001?halfH/Math.abs(dy):Infinity);
  const px=x+dx*(Number.isFinite(t)?t:0),py=y+dy*(Number.isFinite(t)?t:0);
  // Attach to the actual side hit by the cable, with a tiny visible gap.
  if(Math.abs(Math.abs(px-x)-halfW)<0.01)
   return dx>=0?{x:px+2,y:py,transform:'translate(0,-50%)'}
               :{x:px-2,y:py,transform:'translate(-100%,-50%)'};
  return dy>=0?{x:px,y:py+2,transform:'translate(-50%,0)'}
              :{x:px,y:py-2,transform:'translate(-50%,-100%)'};
 };
 return {
  a:edge(x1,y1,x2,y2,sizeA),
  middle:{x:(x1+x2)/2,y:(y1+y2)/2,transform:'translate(-50%,-50%)'},
  b:edge(x2,y2,x1,y1,sizeB)
 };
}
function topoRenderedDeviceSize(device){
 const node=document.querySelector(`#topo-board [data-device="${CSS.escape(device.id)}"]`);
 return node?{w:node.offsetWidth,h:node.offsetHeight}:{w:106,h:76};
}
function topoWireLabelWidth(slot,value=''){
 const text=String(value||'');
 const min=slot==='middle'?54:46;
 const max=slot==='middle'?360:240;
 return Math.max(min,Math.min(max,text.length*7+18));
}
function topoWireLabelPosition(x1,y1,x2,y2,slot,value=''){
 return topoWireLabelPositions(x1,y1,x2,y2)[slot];
}
function topoLines(){
 const svg=$('topo-links'),labels=$('topo-labels');if(!svg||!labels)return;
 svg.innerHTML='';labels.innerHTML='';
 for(const l of topo.links){
  const a=topo.devices.find(d=>d.id===l.a),b=topo.devices.find(d=>d.id===l.b);if(!a||!b)continue;
  const {x:x1,y:y1}=topoPosition(a),{x:x2,y:y2}=topoPosition(b);
  const color=l.type==='crossover'?'#e2a46c':l.type==='wireless'?'#b89ada':'#91a6b8';
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  for(const [k,v] of Object.entries({x1,y1,x2,y2,stroke:color,'stroke-width':2.1,'stroke-linecap':'round'}))line.setAttribute(k,v);
  if(l.type==='wireless')line.setAttribute('stroke-dasharray','7 6');svg.append(line);
  const hit=document.createElementNS('http://www.w3.org/2000/svg','line');
  for(const [k,v] of Object.entries({x1,y1,x2,y2,stroke:'transparent','stroke-width':13}))hit.setAttribute(k,v);
  hit.dataset.link=l.id;hit.classList.add('topo-wire-hit');hit.style.pointerEvents='stroke';svg.append(hit);
  const mode=l[topo.view]||(l[topo.view]={a:'',middle:'',b:''});
  const refs={};const positions=()=>topoWireLabelPositions(x1,y1,x2,y2,topoRenderedDeviceSize(a),topoRenderedDeviceSize(b));
  const relocate=()=>{const all=positions();for(const slot of ['a','middle','b']){
   const wrap=refs[slot],pos=all[slot];if(wrap&&pos){wrap.style.left=pos.x+'px';wrap.style.top=pos.y+'px';wrap.style.transform=pos.transform||'translate(-50%,-50%)';}
  }};
  for(const slot of ['a','middle','b']){
   const wrap=document.createElement('div');wrap.className='topo-link-wrap'+(topoContains('link',l.id)?' selected':'');
   wrap.dataset.link=l.id;wrap.dataset.slot=slot;wrap.tabIndex=0;
   wrap.title='Click to select; double-click to edit';
   const input=document.createElement('input');input.className='topo-wire-input';
   input.placeholder='+';
   input.value=mode[slot]||'';input.style.width=topoWireLabelWidth(slot,input.value)+'px';
   topoEditOnDouble(input,v=>{mode[slot]=v;input.style.width=topoWireLabelWidth(slot,v)+'px';topoSave()},l.locked);
   wrap.append(input);labels.append(wrap);refs[slot]=wrap;
  }
  relocate();
 }
}
function topoDrawNodes(){const board=$('topo-board');if(!board)return;board.querySelectorAll('.topo-node,.topo-zone,.topo-note').forEach(e=>e.remove());for(const z of topo.zones){const e=document.createElement('div');e.className='topo-zone'+(topoContains('zone',z.id)?' selected':'')+(z.locked?' locked':'');e.dataset.zone=z.id;e.tabIndex=0;Object.assign(e.style,{left:z.x+'px',top:z.y+'px',width:z.w+'px',height:z.h+'px'});e.style.setProperty('--zone-color',z.color);e.innerHTML=`<div class="topo-zone-handle" title="Drag LAN border"></div><input class="topo-zone-name" value="${topoSafe(topoZoneText(z).name)}" aria-label="LAN name"/><input class="topo-zone-network" value="${topoSafe(topoZoneText(z).network)}" placeholder="Network ID /prefix" aria-label="Network ID and prefix"/><div class="topo-zone-resize" title="Resize LAN zone"></div>`;topoEditOnDouble(e.querySelector('.topo-zone-name'),v=>{topoZoneText(z).name=v;topoSave()},z.locked);topoEditOnDouble(e.querySelector('.topo-zone-network'),v=>{topoZoneText(z).network=v;topoSave()},z.locked);board.append(e)}for(const d of topo.devices){const e=document.createElement('div');e.className='topo-node'+(topoContains('device',d.id)?' selected':'')+(topoConnecting===d.id?' connecting':'')+(d.locked?' locked':'');e.dataset.device=d.id;e.tabIndex=0;e.style.left=d.x+'px';e.style.top=d.y+'px';e.innerHTML=`<span class="topo-device-icon">${topoIcon(d.type)}</span><input class="topo-node-name" aria-label="${d.type} name" value="${topoSafe(d.name)}"/><input class="topo-node-extra" aria-label="${topo.view==='physical'?'Ports':'IP address'}" placeholder="${topo.view==='physical'?'':'IP /prefix'}" value="${topoSafe(topo.view==='physical'?d.ports:d.ip)}"/>`;topoEditOnDouble(e.querySelector('.topo-node-name'),v=>{d.name=v;topoSave()},d.locked);topoEditOnDouble(e.querySelector('.topo-node-extra'),v=>{d[topo.view==='physical'?'ports':'ip']=v;topoSave()},d.locked);board.append(e)}for(const n of topo.notes){if(n.scope!=='both'&&n.scope!==topo.view)continue;if(n.type==='chartMirror'){board.append(topoMirrorNode(n));continue}if(n.type==='sticky'){const e=document.createElement('div');e.className='topo-note topo-sticky topo-sticky-'+topoStickyKind(n.stickyType)+(topoContains('note',n.id)?' selected':'')+(n.locked?' locked':'');e.dataset.note=n.id;e.tabIndex=0;Object.assign(e.style,{left:n.x+'px',top:n.y+'px',width:(n.w||180)+'px',height:(n.h||125)+'px'});const def=TOPO_STICKY_TYPES[topoStickyKind(n.stickyType)];e.innerHTML='<div class="topo-sticky-heading"><span class="topo-sticky-heading-icon">'+def[2]+'</span><span>'+def[0]+'</span></div><input class="topo-sticky-title" aria-label="Sticky title" placeholder="Title"/><textarea aria-label="Sticky body" placeholder="Double-click to write"></textarea><div class="topo-zone-resize topo-sticky-resize" title="Resize sticky note"></div>';const titleInput=e.querySelector('.topo-sticky-title');titleInput.value=n.title||'';topoEditOnDouble(titleInput,v=>{n.title=v;topoSave()},n.locked);const field=e.querySelector('textarea');field.value=n.text||'';topoEditOnDouble(field,v=>{n.text=v;topoSave()},n.locked);board.append(e);continue}const e=document.createElement('div');e.className='topo-note'+(topoContains('note',n.id)?' selected':'')+(n.locked?' locked':'');e.dataset.note=n.id;e.style.left=n.x+'px';e.style.top=n.y+'px';e.style.width=(n.w||140)+'px';e.style.height=(n.h||82)+'px';e.tabIndex=0;e.innerHTML=`<textarea rows="3" aria-label="Optional topology text" placeholder="Double-click to add note"></textarea><div class="topo-zone-resize topo-text-resize" title="Resize text box"></div>`;const input=e.querySelector('textarea');input.value=n[topo.view]||'';topoEditOnDouble(input,v=>{n[topo.view]=v;topoGrowTextBox(input,n);topoSave()},n.locked);board.append(e);topoGrowTextBox(input,n)}}
function topoRefresh(){const focusBoard=$('topo-board')?.contains(document.activeElement);topoDrawNodes();topoLines();topoPaintSelection();topoExpandBoard();topoGuides();window.DevDenSketch?.render?.();if(focusBoard)$('topo-board').focus({preventScroll:true})}
function topoUpdateStatus(){const s=$('topo-status');if(s)s.textContent=`${topo.devices.length} devices · ${topo.links.length} links · ${topo.zones.length} LANs · ${topoSelection.length} selected${topoConnecting?' · Choose next endpoint':''}`;const lk=$('topo-lock');if(lk){lk.disabled=!topoSelection.length;lk.textContent=topoSelection.length&&topoSelection.every(s=>topoItem(s)?.locked)?'🔓 Unlock selected':'🔒 Lock selected'}const del=$('topo-delete');if(del)del.disabled=!topoSelection.some(s=>!topoItem(s)?.locked);for(const name of ['select','wire'])$('topo-mode-'+name)?.classList.toggle('active',topoTool===name);$('topo-cable-choices')?.classList.toggle('hidden',topoTool!=='wire');document.querySelectorAll('[data-cable]').forEach(b=>b.classList.toggle('active',b.dataset.cable===topo.cable))}
function topoSetTool(mode){topoTool=mode;topoConnecting=null;topoUpdateStatus()}
function topoCancel(){if(document.activeElement?.matches('#topo-board input:not([readonly]),#topo-board textarea:not([readonly])')){document.activeElement.blur();return}if(topoConnecting){topoConnecting=null;topoRefresh();return}if(topoTool!=='select'){topoSetTool('select');return}topoClear()}
let topoPointerController=null;
function renderTopology(){topoPointerController?.abort();topoPointerController=new AbortController();topoTool='select';topoConnecting=null;title('NETWORK TOPOLOGY','Build physical and logical diagrams. Double-click text to edit. V: Select · C: Wire · Esc: Exit.');content.insertAdjacentHTML('beforeend',`<div class="topo-toolbar"><div class="topo-device-tools"><span class="topo-tool-label">ADD</span>${TOPO_TYPES.map(t=>`<button data-add-type="${t}" title="Add ${t}"><span class="topo-tool-icon">${topoIcon(t)}</span>${t}</button>`).join('')}<button id="topo-add-zone">▧ LAN / Subnet</button><button id="topo-add-note">+ Text</button></div><div class="topo-tool-row"><div class="tool-mode-switch"><button id="topo-physical" class="${topo.view==='physical'?'selected':''}">Physical</button><button id="topo-logical" class="${topo.view==='logical'?'selected':''}">Logical</button></div><button id="topo-mode-select">↖ Select</button><button id="topo-mode-wire">⌁ Wire</button><div id="topo-cable-choices" class="topo-cable-choices hidden"><button data-cable="normal">━ Normal</button><button data-cable="crossover">━ Crossover</button><button data-cable="wireless">┄ Wireless</button></div><button id="topo-lock">🔒 Lock selected</button><button id="topo-delete">Delete</button><button id="topo-undo">↶ Undo</button><button id="topo-redo" title="Redo · Ctrl+Y">↷ Redo</button><button id="topo-unlock-all">Unlock all</button><button id="topo-fit" title="Fit topology to screen · Ctrl+0">⊞ Fit</button><button id="topo-fullscreen">⛶ Fullscreen</button><button id="topo-export">Physical PNG</button><button id="topo-export-logical">Logical PNG</button><button id="topo-reset">Reset</button></div></div><div class="topo-hint">Select: tap an item to select; Ctrl+click adds · Wire: click endpoint A, then B; repeat · Double-click text to edit · Delete removes selected · Ctrl+wheel / pinch zoom · Scrollbars to pan · Ctrl+C/V copy/paste · Ctrl+D duplicate · Shift-drag locks axis · Arrows 1 px / Shift 10 px</div><div class="topo-viewport" id="topo-viewport"><div id="topo-board" class="topo-board"><svg id="topo-links" class="topo-links" width="1400" height="850" viewBox="0 0 1400 850"></svg><div id="topo-labels" class="topo-labels"></div></div></div><div class="topo-bottom"><span id="topo-status" aria-live="polite"></span><span id="topo-save-indicator" class="topo-save-indicator" aria-live="polite">Saved locally</span><span id="topo-search-feedback" class="topo-search-feedback" aria-live="polite"></span><span>Normal <i class="topo-legend normal"></i> Crossover <i class="topo-legend crossover"></i> Wireless <i class="topo-legend wireless"></i></span></div>`);
topoCompactToolbar();content.querySelectorAll('[data-add-type]').forEach(b=>b.onclick=()=>topoAdd(b.dataset.addType));$('topo-add-zone').onclick=topoAddZone;$('topo-add-note').onclick=topoAddNote;for(const view of ['physical','logical'])$('topo-'+view).onclick=()=>{if(topo.view===view)return;const viewport=$('topo-viewport'),board=$('topo-board');const mx=parseFloat(board?.style.marginLeft)||0,my=parseFloat(board?.style.marginTop)||0;const center={x:(viewport.scrollLeft+viewport.clientWidth/2)/topoZoom-mx,y:(viewport.scrollTop+viewport.clientHeight/2)/topoZoom-my};topo.view=view;topoConnecting=null;topoSave();renderTopology();requestAnimationFrame(()=>{topoCenterOn(center.x,center.y);window.DevDenSketch?.render?.()})};$('topo-mode-select').onclick=()=>topoSetTool('select');$('topo-mode-wire').onclick=()=>topoSetTool('wire');content.querySelectorAll('[data-cable]').forEach(b=>b.onclick=()=>{topo.cable=b.dataset.cable;topoSave();topoUpdateStatus()});$('topo-lock').onclick=topoToggleLock;$('topo-delete').onclick=topoDelete;$('topo-undo').onclick=topoUndoLast;$('topo-redo').onclick=topoRedoLast;$('topo-fit').onclick=topoFitToScreen;$('topo-export').onclick=()=>topoExportPNG('physical');$('topo-export-logical').onclick=()=>topoExportPNG('logical');$('topo-unlock-all').onclick=()=>{topoCheckpoint();for(const kind of ['device','zone','note','link'])for(const item of topoList(kind))item.locked=false;topoSave();topoRefresh()};$('topo-fullscreen').onclick=()=>{const on=document.body.classList.toggle('topo-fullscreen');$('topo-fullscreen').textContent=on?'⛶ Exit fullscreen':'⛶ Fullscreen'};$('topo-reset').onclick=()=>{if(confirm('Reset the entire topology? All devices, links, LANs and notes will be deleted.')){topoCheckpoint();topo=topoDefault();topoClear();topoConnecting=null;topoSave();renderTopology()}};const board=$('topo-board');board.tabIndex=0;board.style.zoom=topoZoom;topoBindViewport();topoBindSearch();topoUpdateSaveStatus();topoUpdateHistoryButtons();$('topo-fullscreen').textContent=document.body.classList.contains('topo-fullscreen')?'⛶ Exit fullscreen':'⛶ Fullscreen';
function getTarget(e){
 // Always give physical devices priority over the LAN background, cable labels and SVG layers.
 const direct=e.target.closest?.('.topo-node,.topo-note');
 if(direct?.dataset.device)return {kind:'device',id:direct.dataset.device};
 if(direct?.dataset.note)return {kind:'note',id:direct.dataset.note};
 const directLink=e.target.closest?.('.topo-link-wrap');
 if(directLink)return {kind:'link',id:directLink.dataset.link};
 const tolerance=e.pointerType==='touch'?5:e.pointerType==='pen'?3:0;
 let nearest=null,best=Infinity;
 for(const el of board.querySelectorAll('.topo-node,.topo-note')){
  const r=el.getBoundingClientRect();
  const dx=Math.max(r.left-e.clientX,0,e.clientX-r.right),dy=Math.max(r.top-e.clientY,0,e.clientY-r.bottom);
  const dist=Math.hypot(dx,dy);
  if(dist<=tolerance&&dist<best){nearest=el;best=dist}
 }
 if(nearest)return nearest.dataset.device?{kind:'device',id:nearest.dataset.device}:{kind:'note',id:nearest.dataset.note};
 const link=e.target.closest?.('[data-link]');
 if(link)return {kind:'link',id:link.dataset.link};
 const zone=e.target.closest?.('.topo-zone');
 return zone&&e.target.closest?.('.topo-zone-handle,.topo-zone-resize,.topo-zone-name,.topo-zone-network')
  ?{kind:'zone',id:zone.dataset.zone}:null;
}
function coords(e){const r=board.getBoundingClientRect();return{x:(e.clientX-r.left)/topoZoom,y:(e.clientY-r.top)/topoZoom}}
board.addEventListener('dragstart',e=>e.preventDefault());
 board.addEventListener('selectstart',e=>{if(topoDrag)e.preventDefault()});
 board.addEventListener('click',e=>{if(topoSkipClick){topoSkipClick=false;return}const t=getTarget(e);if(topoTool==='wire'){if(t?.kind!=='device')return;if(!topoConnecting){topoConnecting=t.id;topoSelection=[t];topoSelected=t;topoRefresh();return}if(t.id===topoConnecting){topoConnecting=null;topoRefresh();return}topoCheckpoint();topo.links.push({id:'l'+crypto.randomUUID(),a:topoConnecting,b:t.id,type:topo.cable,physical:{a:'',middle:'',b:''},logical:{a:'',middle:'',b:''},locked:false});topoConnecting=null;topoSave();topoRefresh();return}if(t)topoSelect(t.kind,t.id,e.ctrlKey||e.metaKey);else topoClear()});
board.addEventListener('pointerdown',e=>{if(topoPinchActive||topoTouchPointers.size>1)return;topoSkipClick=false;if(e.button!==0||topoTool!=='select')return;if(e.target.closest('input,textarea,[contenteditable="true"]'))return;let t=getTarget(e);const pos=coords(e);if(t&&t.kind!=='link'){const item=topoItem(t);if(!item||item.locked)return;if(window.DevDenCollab&&!window.DevDenCollab.canEditRef(t)){window.DevDenCollab.requestTakeover(t);return}const resize=!!e.target.closest('.topo-zone-resize,.topo-mirror-resize');if(t.kind==='zone'&&!e.target.closest('.topo-zone-handle,.topo-zone-resize')&&e.pointerType==='mouse')return;if(e.ctrlKey||e.metaKey){topoSelect(t.kind,t.id,true);topoSkipClick=true;return}if(!topoContains(t.kind,t.id)){topoSelection=[t];topoSelected=t;topoPaintSelection()}const moving=topoSelection.filter(s=>!topoItem(s)?.locked&&s.kind!=='link').map(s=>({item:topoItem(s),kind:s.kind,x:topoItem(s).x,y:topoItem(s).y}));e.preventDefault();e.stopPropagation();topoDrag={type:'move',pointerId:e.pointerId,start:pos,moving,resize,item,original:{w:item.w,h:item.h},moved:false,checkpoint:false};try{board.setPointerCapture(e.pointerId)}catch{}window.dispatchEvent(new Event('devden-topo-selection'));}else if(!t){
 e.preventDefault();e.stopPropagation();
 const append=e.shiftKey||e.ctrlKey||e.metaKey;
 if(!append)topoClear();
 const base=append?[...topoSelection]:[];
 const rect=document.createElement('div');rect.className='topo-marquee';board.append(rect);
 topoDrag={type:'marquee',pointerId:e.pointerId,start:pos,rect,base,moved:false};
 try{board.setPointerCapture(e.pointerId)}catch{}
 return;
 }else return;});
const topoHandlePointerMove=e=>{if(topoPinchActive||!topoDrag||topoDrag.pointerId!==e.pointerId)return;e.preventDefault();const d=topoDrag,cur=coords(e),rawDx=cur.x-d.start.x,rawDy=cur.y-d.start.y;let dx=rawDx,dy=rawDy;if(e.shiftKey&&d.type==='move'&&!d.resize){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}if(Math.abs(dx)+Math.abs(dy)<3&&!d.moved)return;d.moved=true;if(!board.hasPointerCapture(e.pointerId))try{board.setPointerCapture(e.pointerId)}catch{};if(d.type==='marquee'){
 const left=Math.min(d.start.x,cur.x),top=Math.min(d.start.y,cur.y),right=Math.max(d.start.x,cur.x),bottom=Math.max(d.start.y,cur.y);
 Object.assign(d.rect.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
 const hits=[];
 for(const kind of ['device','note','zone'])for(const item of topoList(kind)){
  if(kind==='note'&&item.scope!=='both'&&item.scope!==topo.view)continue;
  const b=topoItemBounds({kind,id:item.id});
  const overlap=kind==='zone'?(b.left>=left&&b.right<=right&&b.top>=top&&b.bottom<=bottom):(b.right>=left&&b.left<=right&&b.bottom>=top&&b.top<=bottom);
  if(overlap)hits.push({kind,id:item.id});
 }
 topoSelection=[...d.base,...hits.filter(h=>!d.base.some(b=>b.kind===h.kind&&b.id===h.id))];
 topoSelected=topoSelection.at(-1)||null;topoPaintSelection();return;
 }
 if(d.type==='move'){if(!d.checkpoint){topoCheckpoint();d.checkpoint=true}if(d.resize){const minW=d.item.type==='chartMirror'?125:d.item.type==='sticky'?110:d.moving.some(m=>m.kind==='note')?52:100;const minH=d.item.type==='chartMirror'?75:d.item.type==='sticky'?75:d.moving.some(m=>m.kind==='note')?28:70;if(d.item.type==='chartMirror'){const layout=topoMirrorLayout(d.item),ratio=(layout.width+12)/(layout.height+12);const targetW=Math.max(minW,minH*ratio,d.original.w+(Math.abs(dx)>=Math.abs(dy*ratio)?dx:dy*ratio));d.item.w=targetW;d.item.h=targetW/ratio;}else{d.item.w=Math.max(minW,d.original.w+dx);d.item.h=Math.max(minH,d.original.h+dy)}}else for(const m of d.moving){m.item.x=m.x+dx;m.item.y=m.y+dy}if(!d.resize)topoSnapAlignment(d,!!e.shiftKey,dx,dy);for(const m of d.moving){const element=board.querySelector(`[data-${m.kind}="${m.item.id}"]`);if(element){element.style.left=m.item.x+'px';element.style.top=m.item.y+'px'}}if(d.resize){const element=board.querySelector(`[data-${d.item.type==='chartMirror'?'note':'zone'}="${d.item.id}"]`);if(element){element.style.width=d.item.w+'px';element.style.height=d.item.h+'px';if(d.item.type==='chartMirror'){const layout=topoMirrorLayout(d.item);const content=element.querySelector('.topo-mirror-content');if(content)content.style.transform='scale('+Math.max(.05,Math.min((d.item.w-12)/layout.width,(d.item.h-12)/layout.height))+')'}}}topoLines();topoGuides()}};
window.addEventListener('pointermove',topoHandlePointerMove,{capture:true,passive:false,signal:topoPointerController.signal});
const release=e=>{if(!topoDrag||topoDrag.pointerId!==e.pointerId)return;const d=topoDrag,moved=d.moved,wasMove=d.type==='move';
 if(d.type==='marquee'){
  d.rect.remove();topoDrag=null;topoSkipClick=true;
  if(!moved){topoSelection=d.base;topoSelected=topoSelection.at(-1)||null;}
  topoPaintSelection();window.dispatchEvent(new Event('devden-topo-selection'));return;
 }
 topoDrag=null;if(wasMove||moved)topoSkipClick=true;if(moved){topoNudgeUntil=Date.now()+800;clearTimeout(topoGuideTimer);topoGuideTimer=setTimeout(()=>{topoNudgeUntil=0;topoGuides()},810);topoSave();topoRefresh()}};window.addEventListener('pointerup',release,{capture:true,signal:topoPointerController.signal});window.addEventListener('pointercancel',release,{capture:true,signal:topoPointerController.signal});
board.addEventListener('keydown',e=>{if(e.target.matches('input:not([readonly]),textarea:not([readonly]),select'))return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();topoDelete();return}if(e.key==='Enter'&&e.target.closest('.topo-node')){e.preventDefault();e.target.querySelector('.topo-node-name')?.dispatchEvent(new MouseEvent('dblclick'));return}});topoRefresh()}
document.addEventListener('keydown',e=>{if(active!=='topology')return;if(e.target.closest('input:not([readonly]),textarea:not([readonly]),select')){if(e.key==='Escape'){e.target.blur();e.preventDefault()}return}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){if(topoNudge(e))return;}if(e.key==='Escape'){e.preventDefault();if(content.querySelector('.topo-menu[open]')){content.querySelectorAll('.topo-menu[open]').forEach(d=>d.open=false)}else if(document.body.classList.contains('topo-fullscreen')){document.body.classList.remove('topo-fullscreen');$('topo-fullscreen').textContent='⛶ Fullscreen'}else topoCancel()}else if((e.key==='Delete'||e.key==='Backspace')&&!e.target.closest('#topo-board')){e.preventDefault();topoDelete()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)topoRedoLast();else topoUndoLast()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();topoRedoLast()}else if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();topoFitToScreen()}else if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&e.key.toLowerCase()==='v'){topoSetTool('select')}else if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&e.key.toLowerCase()==='c'){topoSetTool('wire')}});
function topoExportPNG(view=topo.view,returnCanvas=false){const canvas=document.createElement('canvas');const bounds=topoBounds();const resolution=returnCanvas?Math.min(3,Math.sqrt(16000000/((bounds.right-bounds.left)*(bounds.bottom-bounds.top)))):1;canvas.width=Math.ceil((bounds.right-bounds.left)*resolution);canvas.height=Math.ceil((bounds.bottom-bounds.top)*resolution);const c=canvas.getContext('2d');c.scale(resolution,resolution);c.translate(-bounds.left,-bounds.top);c.fillStyle='#142130';c.fillRect(bounds.left,bounds.top,canvas.width,canvas.height);for(let x=Math.floor(bounds.left/25)*25;x<bounds.right;x+=25)for(let y=Math.floor(bounds.top/25)*25;y<bounds.bottom;y+=25){c.fillStyle='#30445c';c.fillRect(x,y,1,1)}for(const z of topo.zones){c.fillStyle=z.color+'24';c.strokeStyle=z.color;c.lineWidth=2;c.setLineDash([6,5]);c.fillRect(z.x,z.y,z.w,z.h);c.strokeRect(z.x,z.y,z.w,z.h);c.setLineDash([]);c.font='bold 16px Segoe UI, Arial, sans-serif';c.textAlign='center';c.fillStyle=z.color;c.fillText(topoZoneText(z,view).name,z.x+z.w/2,z.y+25);c.font='13px Consolas, monospace';c.textAlign='right';c.fillText(topoZoneText(z,view).network,z.x+z.w-14,z.y+z.h-14)}
for(const l of topo.links){const a=topo.devices.find(d=>d.id===l.a),b=topo.devices.find(d=>d.id===l.b);if(!a||!b)continue;const x1=a.x,y1=a.y,x2=b.x,y2=b.y;c.strokeStyle=l.type==='crossover'?'#e2a46c':l.type==='wireless'?'#b89ada':'#91a6b8';c.lineWidth=3;c.setLineDash(l.type==='wireless'?[8,7]:[]);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.setLineDash([]);for(const slot of ['a','middle','b']){const text=l[view]?.[slot];if(!text)continue;const spot=topoWireLabelPositions(x1,y1,x2,y2,{w:120,h:84},{w:120,h:84})[slot];c.font='12px Consolas, monospace';const w=c.measureText(text).width+16,h=26;let left=spot.x-w/2,top=spot.y-h/2;if(slot!=='middle'){if(spot.transform==='translate(0,-50%)')left=spot.x;else if(spot.transform==='translate(-100%,-50%)')left=spot.x-w;else if(spot.transform==='translate(-50%,0)')top=spot.y;else if(spot.transform==='translate(-50%,-100%)')top=spot.y-h;}c.fillStyle='#172638';c.fillRect(left,top,w,h);c.fillStyle='#e1eefb';c.textAlign='center';c.fillText(text,left+w/2,top+18)}}
for(const d of topo.devices){c.fillStyle='#25384b';c.strokeStyle='#8595a5';c.lineWidth=2;c.beginPath();c.roundRect(d.x-60,d.y-42,120,84,9);c.fill();c.stroke();c.textAlign='center';c.fillStyle='#d4dae1';c.font='bold 15px Segoe UI, Arial, sans-serif';c.fillText(d.type,d.x,d.y-15);c.fillStyle='#fff';c.fillText(d.name,d.x,d.y+8);c.fillStyle='#b8c8d8';c.font='12px Consolas, monospace';c.fillText(view==='physical'?d.ports:d.ip,d.x,d.y+29)}for(const n of topo.notes){if(n.scope!=='both'&&n.scope!==view)continue;if(n.type==='chartMirror'){topoDrawMirrorPNG(c,n);continue}if(n.type==='sticky'){const kind=topoStickyKind(n.stickyType),tone={amber:'#fff2db',red:'#ffe7e9',green:'#e3f7e9',blue:'#e4f1ff',purple:'#f0e7fc',neutral:'#f1f1ed'}[TOPO_STICKY_TYPES[kind][1]];c.fillStyle=tone;c.fillRect(n.x,n.y,n.w||155,n.h||92);c.fillStyle='#243348';c.font='bold 13px Segoe UI';c.fillText(TOPO_STICKY_TYPES[kind][0],n.x+10,n.y+20);c.font='12px Segoe UI';for(const [i,line] of String(n.text||'').split('\n').entries())c.fillText(line,n.x+10,n.y+42+i*17);continue}c.font='14px Segoe UI, Arial, sans-serif';c.fillStyle='#e5f0fa';c.textAlign='left';for(const [i,line] of String(n[view]||'').split('\n').entries())c.fillText(line,n.x,n.y+i*18)}if(returnCanvas)return canvas;const a=document.createElement('a');a.download='DevDen-Topology-'+view+'.png';a.href=canvas.toDataURL('image/png');document.body.append(a);a.click();a.remove()}


function setupDevDenSketch(){
 const control=$('devden-pencil'),main=$('main'),undoButton=$('devden-sketch-undo'),redoButton=$('devden-sketch-redo');
 if(!control||!main)return;
 const tray=document.createElement('div');tray.id='devden-sketch-tools';tray.hidden=true;tray.innerHTML='<div class="devden-sketch-row devden-sketch-actions"><strong>Draw</strong><button type="button" id="devden-sketch-clear">Clear</button><button type="button" id="devden-sketch-close">Done</button></div><div class="devden-sketch-row devden-sketch-palette" id="devden-sketch-colors" aria-label="Pen color"></div><label class="devden-sketch-row devden-pen-size" title="Pen thickness"><span>Size</span><input id="devden-pen-size" type="range" min="1" max="8" step="0.5" value="2.5" aria-label="Pen thickness"><output id="devden-pen-size-value">2.5</output><span aria-hidden="true">px</span></label>';
 document.body.append(tray);
 const positionTray=()=>{const r=control.getBoundingClientRect();const w=tray.offsetWidth||170;tray.style.left=Math.max(6,Math.min(r.left,window.innerWidth-w-6))+'px';tray.style.top=Math.max(6,Math.min(window.innerHeight-tray.offsetHeight-6,r.bottom+5))+'px'};
 window.addEventListener('resize',()=>{if(!tray.hidden)positionTray()});document.getElementById('logo')?.addEventListener('click',()=>requestAnimationFrame(positionTray));
 const surface=document.createElementNS('http://www.w3.org/2000/svg','svg');
 surface.id='devden-sketch-layer';surface.setAttribute('preserveAspectRatio','none');main.append(surface);
 let enabled=false,stroke=null,pointer=null,penColor=localStorage.getItem('devden-pen-color')||'#ffffff';
 const storedWidth=Number(localStorage.getItem('devden-pen-width'));let penWidth=Number.isFinite(storedWidth)&&storedWidth>=1&&storedWidth<=8?storedWidth:2.5;
 const penSize=tray.querySelector('#devden-pen-size'),penSizeValue=tray.querySelector('#devden-pen-size-value');
 penSize.value=String(penWidth);penSizeValue.textContent=String(penWidth);
 penSize.addEventListener('input',()=>{penWidth=Number(penSize.value);penSizeValue.textContent=String(penWidth);localStorage.setItem('devden-pen-width',String(penWidth))});const colors=['#ffffff','#ef6464','#f5b84b','#64c88a','#60a5fa','#b28ae8'];const colorBox=tray.querySelector('#devden-sketch-colors');colors.forEach(color=>{const b=document.createElement('button');b.type='button';b.className='devden-color-swatch';b.style.background=color;b.title=color;b.setAttribute('aria-label','Select '+color);b.onclick=()=>{penColor=color;localStorage.setItem('devden-pen-color',color);colorBox.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b))};colorBox.append(b)});colorBox.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.style.background===penColor));
 const page=()=>active;
 // History uses stroke IDs, never full-state snapshots: remote group drawings
 // and other toolkit edits remain untouched by local sketch Undo/Redo.
 const sketchUndo=new Map(),sketchRedo=new Map();
 const stack=(map,key=page())=>{if(!map.has(key))map.set(key,[]);return map.get(key)};
 const updateSketchButtons=()=>{if(undoButton)undoButton.disabled=!stack(sketchUndo).length;if(redoButton)redoButton.disabled=!stack(sketchRedo).length};
 const rememberSketch=action=>{const previous=stack(sketchUndo);previous.push(action);if(previous.length>100)previous.shift();stack(sketchRedo).length=0;updateSketchButtons()};
 const sketchHistory=(redo=false)=>{
  if(pointer!==null)stop();
  const from=stack(redo?sketchRedo:sketchUndo),to=stack(redo?sketchUndo:sketchRedo);
  if(!from.length)return false;
  const action=from.pop();state.sketches||={};const items=state.sketches[page()]||(state.sketches[page()]=[]);
  if(action.type==='stroke'){
   const index=items.findIndex(item=>item?.id===action.stroke.id);
   if(redo&&index===-1)items.push(structuredClone(action.stroke));
   if(!redo&&index>=0)items.splice(index,1);
  }else if(action.type==='clear'){
   if(redo){const ids=new Set(action.strokes.map(item=>item.id));state.sketches[page()]=items.filter(item=>!ids.has(item?.id));}
   else{const ids=new Set(items.map(item=>item?.id));state.sketches[page()]=[...action.strokes.filter(item=>!ids.has(item?.id)).map(item=>structuredClone(item)),...items];}
  }
  to.push(action);updateSketchButtons();checkpoint();render();return true;
 };
 if(undoButton)undoButton.onclick=()=>sketchHistory(false);
 if(redoButton)redoButton.onclick=()=>sketchHistory(true);
 updateSketchButtons();

 // New strokes use persistent board coordinates for Topology, not browser dimensions.
 // Older untagged strokes stay in their original normalized space for compatibility.
 const mainSize=()=>({width:Math.max(1,main.clientWidth),height:Math.max(1,main.clientHeight)});
 const boardGeometry=()=>{
  const board=$('topo-board');
  if(active!=='topology'||!board)return null;
  const r=board.getBoundingClientRect(),m=main.getBoundingClientRect();
  return {left:r.left-m.left,top:r.top-m.top,sx:r.width/Math.max(1,board.offsetWidth),sy:r.height/Math.max(1,board.offsetHeight)};
 };
 const point=e=>{
  const r=main.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const g=boardGeometry();
  // Keep even negative/outside-board coordinates: drawing covers the entire workspace.
  return g?[Math.round((x-g.left)/g.sx*10)/10,Math.round((y-g.top)/g.sy*10)/10]:[Math.round((x+main.scrollLeft)*10)/10,Math.round((y+main.scrollTop)*10)/10];
 };
 let renderQueued=false;
 const render=()=>{
  renderQueued=false;
  const {width,height}=mainSize(),g=boardGeometry();
  surface.setAttribute('viewBox',`0 0 ${width} ${height}`);
  surface.replaceChildren();
  // Topology ink belongs to the same board DOM as devices, LANs and cables.
  // The workspace SVG is only the input catcher while drawing, not a visual overlay.
  const board=active==='topology'?$('topo-board'):null;
  let ink=board?.querySelector('#devden-topo-ink');
  if(board&&!ink){
   ink=document.createElementNS('http://www.w3.org/2000/svg','svg');
   ink.id='devden-topo-ink';ink.setAttribute('preserveAspectRatio','none');
   board.insertBefore(ink,board.firstChild);
  }
  if(ink){ink.setAttribute('viewBox',`0 0 ${board.offsetWidth} ${board.offsetHeight}`);ink.replaceChildren()}
  for(const path of state.sketches?.[page()]||[]){
   const points=Array.isArray(path)?path:path?.points;
   if(!Array.isArray(points)||!points.length)continue;
   const space=path?.space||'legacy';
   const sticky=space==='topology'&&!!ink;
   const transformed=sticky?points:points.map(pt=>{
    if(space==='topology')return g?[g.left+pt[0]*g.sx,g.top+pt[1]*g.sy]:null;
    if(space==='workspace')return [pt[0]-main.scrollLeft,pt[1]-main.scrollTop];
    return [pt[0]*width/1000,pt[1]*height/1000];
   });
   if(transformed.some(pt=>!pt))continue;
   const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
   poly.setAttribute('points',transformed.map(pt=>pt.join(',')).join(' '));
   poly.setAttribute('fill','none');poly.setAttribute('stroke',Array.isArray(path)?'#e3a3df':path.color||'#e3a3df');
   poly.setAttribute('stroke-width',String(Array.isArray(path)?3.5:(Number.isFinite(Number(path.width))&&Number(path.width)>=1&&Number(path.width)<=20?Number(path.width):3.5)));poly.setAttribute('stroke-linecap','round');poly.setAttribute('stroke-linejoin','round');
   poly.setAttribute('vector-effect','non-scaling-stroke');(sticky?ink:surface).append(poly);
  }
 };
 const queueRender=()=>{if(!renderQueued){renderQueued=true;requestAnimationFrame(render)}};
 // Scroll, pan, zoom, view switches and sidebar resizing all move the board visually.
 main.addEventListener('scroll',queueRender,true);
 main.addEventListener('wheel',queueRender,true);
 main.addEventListener('pointermove',e=>{if(e.buttons===4)queueRender()},true);
 window.addEventListener('resize',queueRender);
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(queueRender).observe(main);
 const stop=()=>{if(stroke){if(stroke.length===1)stroke.push([stroke[0][0]+.01,stroke[0][1]+.01]);const saved=(state.sketches?.[page()]||[]).find(item=>item?.points===stroke);if(saved)rememberSketch({type:'stroke',stroke:structuredClone(saved)});checkpoint();stroke=null}pointer=null};
 const setEnabled=value=>{enabled=!!value;tray.hidden=!enabled;if(enabled)positionTray();surface.classList.toggle('enabled',enabled);control.classList.toggle('selected',enabled);control.setAttribute('aria-pressed',String(enabled));if(!enabled)stop();render()};
 control.onclick=()=>setEnabled(!enabled);
 tray.querySelector('#devden-sketch-close').onclick=()=>setEnabled(false);
 const clearSketch=()=>{if(pointer!==null)stop();state.sketches||={};if(!(state.sketches[page()]||[]).length)return;rememberSketch({type:'clear',strokes:structuredClone(state.sketches[page()])});state.sketches[page()]=[];checkpoint();render()};
 tray.querySelector('#devden-sketch-clear').onclick=clearSketch;
 document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest('input,textarea,[contenteditable="true"]'))return;
  const key=e.key.toLowerCase();const redo=key==='y'||(key==='z'&&e.shiftKey);
  if(key!=='z'&&key!=='y')return;
  // When sketching is active, drawing history owns shortcuts. Otherwise let
  // normal topology/document Undo handle them (the buttons still work anytime).
  if(!enabled)return;
  e.preventDefault();e.stopImmediatePropagation();sketchHistory(redo);
 },true);
 document.addEventListener('keydown',e=>{if(!enabled||e.key!=='Delete'||e.ctrlKey||e.altKey||e.metaKey)return;if(e.target.closest('input:not([readonly]),textarea:not([readonly]),[contenteditable="true"]'))return;e.preventDefault();e.stopImmediatePropagation();clearSketch()},true);
 let pendingTrackpad=null;
 const beginStroke=(e,startPoint=point(e))=>{state.sketches||={};state.sketches[page()]||=[];stroke=[startPoint];state.sketches[page()].push({id:crypto.randomUUID(),points:stroke,color:penColor,width:penWidth,space:active==='topology'?'topology':'workspace'});pointer=e.pointerId;render()};
 surface.addEventListener('contextmenu',e=>{if(enabled)e.preventDefault()});
 surface.addEventListener('pointerdown',e=>{
  if(!enabled||pointer!==null||pendingTrackpad)return;
  if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
  if(e.pointerType==='pen'&&e.button!==0&&e.button!==2)return;
  if(e.pointerType==='touch'&&e.button!==0)return;
  e.preventDefault();
  try{surface.setPointerCapture(e.pointerId)}catch{}
  if(e.pointerType==='mouse'&&e.button===0){pendingTrackpad={id:e.pointerId,x:e.clientX,y:e.clientY,start:point(e)};return}
  beginStroke(e);
 });
 surface.addEventListener('pointermove',e=>{
  if(pendingTrackpad?.id===e.pointerId){
   if(Math.hypot(e.clientX-pendingTrackpad.x,e.clientY-pendingTrackpad.y)<4)return;
   const start=pendingTrackpad.start;pendingTrackpad=null;beginStroke(e,start);
  }
  if(pointer!==e.pointerId||!stroke)return;
  e.preventDefault();const p=point(e),last=stroke.at(-1);
  if(Math.hypot(p[0]-last[0],p[1]-last[1])>=1){stroke.push(p);render()}
 });
 surface.addEventListener('pointerup',e=>{if(pendingTrackpad?.id===e.pointerId){pendingTrackpad=null;setEnabled(false);return}if(pointer===e.pointerId)stop()});
 surface.addEventListener('pointercancel',e=>{if(pendingTrackpad?.id===e.pointerId)pendingTrackpad=null;if(pointer===e.pointerId)stop()});
 window.addEventListener('devden-state-updated',()=>{updateSketchButtons();if(pointer===null)render()});
 window.DevDenSketch={leave:()=>setEnabled(false),render,drawing:()=>pointer!==null,active:()=>enabled,clear:clearSketch};
 render();
}
setupDevDenSketch();

navigate('ipv4');

let topoClipboard=null,topoPasteCount=0;
function topoBounds(){let left=0,top=0,right=1400,bottom=850;for(const kind of ['device','zone','note'])for(const x of topoList(kind)){left=Math.min(left,x.x-160);top=Math.min(top,x.y-100);right=Math.max(right,x.x+(x.w||270)+100);bottom=Math.max(bottom,x.y+(x.h||120)+100)}return{left,top,right,bottom}}
function topoExpandBoard(){const b=$('topo-board');if(!b)return;const r=topoBounds();const previousX=parseFloat(b.style.marginLeft)||0,previousY=parseFloat(b.style.marginTop)||0;const mx=-r.left,my=-r.top;b.style.marginLeft=mx+'px';b.style.marginTop=my+'px';const viewport=$('topo-viewport');viewport.scrollLeft+=(mx-previousX)*topoZoom;viewport.scrollTop+=(my-previousY)*topoZoom;const w=Math.max(4000,r.right),h=Math.max(2600,r.bottom);b.style.width=w+'px';b.style.height=h+'px';const svg=$('topo-links');svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);topoGrid();window.DevDenSketch?.render?.()}
function topoItemBounds(ref){const item=topoItem(ref);const element=$('topo-board')?.querySelector(`[data-${ref.kind}="${ref.id}"]`);const w=item.w||(element?.offsetWidth||94),h=item.h||(element?.offsetHeight||65);const left=ref.kind==='device'?item.x-w/2:item.x,top=ref.kind==='device'?item.y-h/2:item.y;return{left,top,right:left+w,bottom:top+h,x:[left+w/2,left,left+w],y:[top+h/2,top,top+h]}}
function topoGuides(){const board=$('topo-board');if(!board)return;board.querySelectorAll('.topo-guide').forEach(e=>e.remove());const selected=topoSelection.filter(s=>s.kind!=='link'&&topoItem(s));if(!(topoDrag?.type==='move'&&topoDrag.moved)&&Date.now()>topoNudgeUntil)return;const tolerance=.000001;for(const axis of ['x','y']){let best=null;for(const ref of selected){const a=topoItemBounds(ref);for(const kind of ['device','zone','note'])for(const item of topoList(kind)){if(topoContains(kind,item.id)||kind==='note'&&item.scope!=='both'&&item.scope!==topo.view)continue;const b=topoItemBounds({kind,id:item.id});for(let i=0;i<3;i++){const distance=Math.abs(a[axis][i]-b[axis][i]);if(distance<=tolerance&&(!best||distance<best.distance))best={a,b,position:b[axis][i],distance}}}}if(best){const line=document.createElement('div');line.className='topo-guide '+axis;const pad=8/topoZoom;if(axis==='x')Object.assign(line.style,{left:best.position+'px',top:Math.min(best.a.top,best.b.top)-pad+'px',height:Math.max(best.a.bottom,best.b.bottom)-Math.min(best.a.top,best.b.top)+pad*2+'px',width:1/topoZoom+'px'});else Object.assign(line.style,{top:best.position+'px',left:Math.min(best.a.left,best.b.left)-pad+'px',width:Math.max(best.a.right,best.b.right)-Math.min(best.a.left,best.b.left)+pad*2+'px',height:1/topoZoom+'px'});board.append(line)}}}
function topoNudge(e){const moving=topoSelection.filter(s=>s.kind!=='link'&&topoItem(s)&&!topoItem(s).locked);if(!moving.length)return false;e.preventDefault();topoNudgeUntil=Date.now()+450;clearTimeout(topoGuideTimer);topoGuideTimer=setTimeout(()=>{topoNudgeUntil=0;topoGuides()},460);if(!e.repeat)topoCheckpoint();const step=e.shiftKey?10:1;for(const ref of moving){const item=topoItem(ref);item.x+=(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0);item.y+=(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)}topoSave();topoRefresh();return true}
function topoSceneBounds(){
 const refs=[...topo.devices.map(x=>({kind:'device',id:x.id})),...topo.zones.map(x=>({kind:'zone',id:x.id})),...topo.notes.filter(x=>x.scope==='both'||x.scope===topo.view).map(x=>({kind:'note',id:x.id}))];
 if(!refs.length)return {left:0,top:0,right:1200,bottom:720};
 const bounds=refs.map(topoItemBounds);
 return {left:Math.min(...bounds.map(b=>b.left)),top:Math.min(...bounds.map(b=>b.top)),right:Math.max(...bounds.map(b=>b.right)),bottom:Math.max(...bounds.map(b=>b.bottom))};
}
function topoCenterOn(x,y){
 const v=$('topo-viewport'),b=$('topo-board');if(!v||!b)return;
 const marginLeft=parseFloat(b.style.marginLeft)||0,marginTop=parseFloat(b.style.marginTop)||0;
 v.scrollLeft=(x+marginLeft)*topoZoom-v.clientWidth/2;
 v.scrollTop=(y+marginTop)*topoZoom-v.clientHeight/2;
 topoGrid();
}
function topoFitToScreen(){
 const v=$('topo-viewport'),b=$('topo-board');if(!v||!b)return;
 const scene=topoSceneBounds(),w=Math.max(1,scene.right-scene.left),h=Math.max(1,scene.bottom-scene.top);
 topoZoom=Math.max(.15,Math.min(2.5,Math.min((v.clientWidth-100)/w,(v.clientHeight-100)/h)));
 b.style.zoom=topoZoom;topoExpandBoard();topoCenterOn((scene.left+scene.right)/2,(scene.top+scene.bottom)/2);
}
function topoSearchCandidates(){
 return [...topo.devices.map(item=>({kind:'device',item,search:[item.name,item.type,item.ip,item.ports].join(' ')})),
 ...topo.zones.map(item=>({kind:'zone',item,search:[item.name,item.network,item.labels?.physical?.name,item.labels?.logical?.name,item.labels?.physical?.network,item.labels?.logical?.network].join(' ')})),
 ...topo.notes.filter(item=>item.type!=='chartMirror').map(item=>({kind:'note',item,search:[item.physical,item.logical].join(' ')}))];
}
function topoSearchGo(){
 const input=$('topo-search'),feedback=$('topo-search-feedback');if(!input)return;
 const term=input.value.trim().toLowerCase();if(!term){if(feedback)feedback.textContent='';return}
 const matches=topoSearchCandidates().filter(x=>x.search.toLowerCase().includes(term));
 if(!matches.length){if(feedback)feedback.textContent='No matching device or IP';return}
 const current=topoSelection[0],index=matches.findIndex(x=>x.kind===current?.kind&&x.item.id===current?.id),match=matches[(index+1)%matches.length];
 topoSelect(match.kind,match.item.id);const bounds=topoItemBounds({kind:match.kind,id:match.item.id});
 topoCenterOn((bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2);
 if(feedback)feedback.textContent=matches.length>1?`${index<0?1:(index+1)%matches.length+1} of ${matches.length} matches`:match.item.name||'Found';
}
function topoBindSearch(){const input=$('topo-search'),go=$('topo-search-go');if(!input||!go)return;go.onclick=topoSearchGo;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();topoSearchGo()}else if(e.key==='Escape'){e.stopPropagation();input.blur()}}}
function topoUpdateSaveStatus(){const element=$('topo-save-indicator');if(!element)return;const status=window.DevDenGroupStatus?.current?.()||'Saved locally';element.textContent=status;element.title=status}
window.addEventListener('devden-group-status',topoUpdateSaveStatus);
function topoGrid(){const v=$('topo-viewport'),b=$('topo-board');if(!v||!b)return;const x=(parseFloat(b.style.marginLeft)||0)*topoZoom-v.scrollLeft,y=(parseFloat(b.style.marginTop)||0)*topoZoom-v.scrollTop;v.style.backgroundSize=`${25*topoZoom}px ${25*topoZoom}px`;v.style.backgroundPosition=`${x}px ${y}px`}
function topoCompactToolbar(){
 const toolbar=content.querySelector('.topo-toolbar');const oldTools=content.querySelector('.topo-device-tools'),oldRow=content.querySelector('.topo-tool-row');
 const menu=(label,cls)=>{const d=document.createElement('details');d.className='topo-menu '+cls;const summary=document.createElement('summary');summary.textContent=label;d.append(summary);const panel=document.createElement('div');panel.className='topo-menu-panel';d.append(panel);return{d,panel}};
 const deviceGroup=document.createElement('div');deviceGroup.className='topo-device-picker';const type=document.createElement('select');type.id='topo-device-type';type.setAttribute('aria-label','Device type');for(const name of TOPO_TYPES){const option=document.createElement('option');option.value=name;option.textContent=name;type.append(option)}const addDevice=document.createElement('button');addDevice.id='topo-add-device';addDevice.textContent='+ Add device';addDevice.onclick=()=>topoAdd(type.value);deviceGroup.append(type,addDevice);const add=menu('+ Insert','topo-add-menu');add.panel.append($('topo-add-zone'),$('topo-add-note'));const stickyPicker=document.createElement('select');stickyPicker.id='topo-sticky-kind';stickyPicker.setAttribute('aria-label','Add sticky note');stickyPicker.innerHTML='<option value="">+ Sticky</option>'+Object.entries(TOPO_STICKY_TYPES).map(([kind,settings])=>'<option value="'+kind+'">'+settings[0]+'</option>').join('');stickyPicker.addEventListener('change',()=>{const kind=stickyPicker.value;if(!kind)return;topoAddSticky(kind);stickyPicker.value='';add.d.open=false});add.panel.append(stickyPicker);const chartInsert=document.createElement('button');chartInsert.id='topo-insert-chart';chartInsert.textContent='▥ Network Chart';chartInsert.onclick=topoInsertChartMirror;add.panel.append(chartInsert);const duplicateLAN=document.createElement('button');duplicateLAN.textContent='▧ Duplicate LAN';duplicateLAN.title='Duplicate a LAN with selected contents';duplicateLAN.onclick=topoDuplicateLAN;add.panel.append(duplicateLAN);
 const edit=menu('Edit ▾','topo-edit-menu');for(const id of ['topo-unlock-all','topo-reset'])edit.panel.append($(id));
 const duplicate=document.createElement('button');duplicate.textContent='Duplicate';duplicate.title='Ctrl+D';duplicate.onclick=()=>{topoCopy();topoPaste()};edit.panel.prepend(duplicate);
 const exp=menu('Export ▾','topo-export-menu');exp.panel.append($('topo-export'),$('topo-export-logical'));
 const help=menu('?','topo-help-menu');help.d.querySelector('summary').setAttribute('aria-label','Keyboard and mouse shortcuts');help.panel.innerHTML='<strong>Shortcuts</strong><dl><dt>Move selected</dt><dd>Arrows · Shift = 10 px</dd><dt>Move canvas</dt><dd>Hold middle mouse and drag / two fingers</dd><dt>Zoom / scroll</dt><dd>Ctrl+wheel or pinch / scrollbars</dd><dt>Fit drawing</dt><dd>Ctrl+0 / Fit</dd><dt>Undo / Redo</dt><dd>Ctrl+Z / Ctrl+Y</dd><dt>Find device</dt><dd>Search box + Enter</dd><dt>Edit text</dt><dd>Double-click · autosaves · Enter / Esc finish</dd><dt>Copy / paste / duplicate</dt><dd>Ctrl+C / Ctrl+V / Ctrl+D</dd><dt>Select / wire / exit</dt><dd>V / C / Esc</dd><dt>Constrain movement</dt><dd>Shift+drag</dd></dl>';
 const modes=document.createElement('div');modes.className='topo-primary-modes';modes.append($('topo-mode-select'),$('topo-mode-wire'));
 const view=oldRow.querySelector('.tool-mode-switch');view.classList.add('topo-view-switch');view.setAttribute('role','group');view.setAttribute('aria-label','Topology view');$('topo-physical').innerHTML='<span aria-hidden="true">▣</span> Physical';$('topo-logical').innerHTML='<span aria-hidden="true">⌘</span> Logical';$('topo-physical').title='Physical view · Device ports and cable connections';$('topo-logical').title='Logical view · IP addresses and subnets';for(const mode of ['physical','logical'])$('topo-'+mode).setAttribute('aria-pressed',String(topo.view===mode));const undo=$('topo-undo'),redo=$('topo-redo'),fit=$('topo-fit'),full=$('topo-fullscreen'),cables=$('topo-cable-choices');full.title='Expand workspace · Esc to exit';undo.title='Undo · Ctrl+Z';redo.title='Redo · Ctrl+Y / Ctrl+Shift+Z';
 const search=document.createElement('div');search.className='topo-search-box';search.innerHTML='<input id="topo-search" type="search" aria-label="Search devices and IPs" placeholder="Find device / IP" autocomplete="off" spellcheck="false"><button type="button" id="topo-search-go" title="Find and center matching object">Find</button>';
 toolbar.replaceChildren(view,modes,deviceGroup,add.d,search,undo,redo,$('topo-lock'),$('topo-delete'),edit.d,exp.d,fit,full,help.d,cables);
 content.querySelector('.topo-hint')?.remove();content.querySelector('.subtitle')?.remove();
 toolbar.querySelectorAll('details').forEach(d=>{d.addEventListener('toggle',()=>{if(d.open)toolbar.querySelectorAll('details').forEach(other=>{if(other!==d)other.open=false})});d.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{d.open=false}))});
 for(const [id,text] of Object.entries({'topo-lock':'Lock selected','topo-delete':'Delete selected','topo-unlock-all':'Unlock all','topo-reset':'Reset diagram','topo-export':'Physical view · PNG','topo-export-logical':'Logical view · PNG'}))$(id).textContent=text;
}
document.addEventListener('pointerdown',e=>{
 if(active!=='topology')return;
 const editing=document.activeElement;
 if(!editing?.matches?.('#topo-board .topo-note textarea:not([readonly])'))return;
 if(e.target.closest?.('.topo-note')===editing.closest('.topo-note'))return;
 editing.blur();
 if(!e.target.closest?.('#topo-board .topo-node,#topo-board .topo-note,#topo-board .topo-link-wrap,#topo-board .topo-zone-handle'))topoClear();
},true);
document.addEventListener('pointerdown',e=>{if(active==='topology'&&!e.target.closest('.topo-menu'))content.querySelectorAll('.topo-menu[open]').forEach(d=>d.open=false)});
let topoPinchActive=false;
const topoTouchPointers=new Map();
function topoBindViewport(){const v=$('topo-viewport'),b=$('topo-board');
 topoTouchPointers.clear();topoPinchActive=false;
 const signal=topoPointerController.signal;
 // Zoom around the gesture midpoint, keeping the same board location under the fingers.
 const zoomAt=(next,cx,cy)=>{
  const old=topoZoom,zoom=Math.max(.15,Math.min(2.5,next));
  if(Math.abs(zoom-old)<.00001)return;
  const rect=v.getBoundingClientRect(),x=cx-rect.left,y=cy-rect.top;
  const worldX=(v.scrollLeft+x)/old,worldY=(v.scrollTop+y)/old;
  topoZoom=zoom;b.style.zoom=zoom;
  v.scrollLeft=worldX*zoom-x;v.scrollTop=worldY*zoom-y;
  topoGrid();topoGuides();
 };
 // League-style camera: middle-button drag pans this user's viewport only.
 let middlePan=null;
 v.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||e.button!==1)return;
  e.preventDefault();e.stopPropagation();
  middlePan={id:e.pointerId,x:e.clientX,y:e.clientY};
  v.classList.add('topo-middle-panning');
  try{v.setPointerCapture(e.pointerId)}catch{}
 },{capture:true,passive:false,signal});
 window.addEventListener('pointermove',e=>{
  if(!middlePan||e.pointerId!==middlePan.id)return;
  e.preventDefault();e.stopPropagation();
  v.scrollLeft-=e.clientX-middlePan.x;v.scrollTop-=e.clientY-middlePan.y;
  middlePan.x=e.clientX;middlePan.y=e.clientY;
 },{capture:true,passive:false,signal});
 const endMiddle=e=>{
  if(!middlePan||e.pointerId!==middlePan.id)return;
  middlePan=null;v.classList.remove('topo-middle-panning');
  try{if(v.hasPointerCapture(e.pointerId))v.releasePointerCapture(e.pointerId)}catch{}
  e.preventDefault();e.stopPropagation();
 };
 window.addEventListener('pointerup',endMiddle,{capture:true,signal});
 window.addEventListener('pointercancel',endMiddle,{capture:true,signal});
 v.addEventListener('lostpointercapture',e=>{if(middlePan?.id===e.pointerId){middlePan=null;v.classList.remove('topo-middle-panning')}},{signal});
 v.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoomAt(topoZoom*Math.exp(-e.deltaY*.002),e.clientX,e.clientY)},{passive:false,signal});
 let pinch=null;
 const getGesture=()=>{const pts=[...topoTouchPointers.values()];if(pts.length<2)return null;const [a,c]=pts;return {distance:Math.max(1,Math.hypot(a.x-c.x,a.y-c.y)),x:(a.x+c.x)/2,y:(a.y+c.y)/2}};
 // Capture-phase handling lets a second finger cancel an element drag before the board processes it.
 v.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  topoTouchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(topoTouchPointers.size>=2){
   const g=getGesture();if(!g)return;
   topoPinchActive=true;
   if(topoDrag){
    const d=topoDrag;
    if(d.type==='marquee')d.rect.remove();
    else if(d.type==='move'){
     for(const m of d.moving){m.item.x=m.x;m.item.y=m.y;}
     if(d.resize){d.item.w=d.original.w;d.item.h=d.original.h;}
     topoRefresh();
    }
   }
   topoDrag=null;topoSkipClick=true;
   pinch={distance:g.distance,zoom:topoZoom,x:g.x,y:g.y};
   e.preventDefault();e.stopPropagation();
  }
 },{capture:true,passive:false,signal});
 window.addEventListener('pointermove',e=>{
  if(!topoTouchPointers.has(e.pointerId))return;
  topoTouchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(!topoPinchActive||!pinch)return;
  const g=getGesture();if(!g)return;
  e.preventDefault();e.stopPropagation();
  // Two-finger translation pans, while changes in finger spacing zoom.
  v.scrollLeft-=g.x-pinch.x;v.scrollTop-=g.y-pinch.y;
  pinch.x=g.x;pinch.y=g.y;
  zoomAt(pinch.zoom*g.distance/pinch.distance,g.x,g.y);
  topoGrid();
 },{capture:true,passive:false,signal});
 const finish=e=>{
  if(!topoTouchPointers.has(e.pointerId))return;
  topoTouchPointers.delete(e.pointerId);
  if(topoPinchActive){
   topoDrag=null;topoSkipClick=true;
   if(topoTouchPointers.size<2){pinch=null;topoPinchActive=false;}
  }
 };
 window.addEventListener('pointerup',finish,{capture:true,signal});
 window.addEventListener('pointercancel',finish,{capture:true,signal});
 v.addEventListener('pointerdown',e=>{if(e.target===v&&(e.button===1||e.pointerType==='touch'||e.pointerType==='pen'))e.preventDefault()},{signal});
 v.addEventListener('scroll',topoGrid,{passive:true,signal});
 v.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()},{signal});
}
function topoClipboardFromRefs(refs,{includeChecklist=true}={}){
 const known=new Set(refs.map(r=>r.kind+':'+r.id));
 const zones=refs.filter(r=>r.kind==='zone').map(r=>topoItem(r)).filter(Boolean);
 const inside=(zone,item)=>item.x>=zone.x&&item.x<=zone.x+zone.w&&item.y>=zone.y&&item.y<=zone.y+zone.h;
 for(const z of zones){
  for(const kind of ['device','note'])for(const item of topoList(kind))if(inside(z,item)&&!known.has(kind+':'+item.id)){
   refs.push({kind,id:item.id});known.add(kind+':'+item.id);
  }
 }
 const ids=new Set(refs.filter(s=>s.kind==='device').map(s=>s.id));
 const selected=refs.map(ref=>({kind:ref.kind,item:structuredClone(topoItem(ref))})).filter(x=>x.item);
 const checks=[];
 if(includeChecklist)for(const device of selected.filter(x=>x.kind==='device').map(x=>x.item)){
  const possible=(state.checklistDevices||[]).filter(c=>c.topologyDeviceId===device.id||(!c.topologyDeviceId&&c.name?.trim().toLowerCase()===device.name?.trim().toLowerCase()));
  for(const c of possible)if(!checks.some(x=>x.id===c.id))checks.push(structuredClone(c));
 }
 return {items:selected,links:topo.links.filter(l=>ids.has(l.a)&&ids.has(l.b)).map(l=>structuredClone(l)),checklists:checks};
}
function topoCopy(){topoClipboard=topoClipboardFromRefs(topoSelection.filter(s=>s.kind!=='link').map(x=>({...x})));topoPasteCount=0}
function topoDuplicateLAN(){
 const selected=topoSelection.find(x=>x.kind==='zone');const source=selected?topoItem(selected):topo.zones.at(-1);
 if(!source){alert('Create or select a LAN first.');return}
 const dialog=document.createElement('dialog');dialog.className='topo-duplicate-dialog';
 dialog.innerHTML='<form method="dialog"><h3>Duplicate LAN</h3><label><input type="checkbox" name="size" checked> LAN dimensions</label><label><input type="checkbox" name="devices" checked> Devices inside LAN</label><label><input type="checkbox" name="wires" checked> Internal connections</label><label><input type="checkbox" name="notes" checked> Text labels inside LAN</label><label><input type="checkbox" name="checklists" checked> Related checklists</label><label><input type="checkbox" name="network"> Network ID / prefix</label><footer><button value="cancel">Cancel</button><button value="duplicate">Duplicate LAN</button></footer></form>';
 document.body.append(dialog);dialog.addEventListener('close',()=>{
  if(dialog.returnValue==='duplicate'){
   const opted=Object.fromEntries(['size','devices','wires','notes','checklists','network'].map(k=>[k,dialog.querySelector('[name="'+k+'"]')?.checked]));
   const items=[{kind:'zone',item:structuredClone(source)}],inside=item=>item.x>=source.x&&item.x<=source.x+source.w&&item.y>=source.y&&item.y<=source.y+source.h;
   if(opted.devices)items.push(...topo.devices.filter(inside).map(item=>({kind:'device',item:structuredClone(item)})));
   if(opted.notes)items.push(...topo.notes.filter(inside).map(item=>({kind:'note',item:structuredClone(item)})));
   const ids=new Set(items.filter(x=>x.kind==='device').map(x=>x.item.id));
   const links=opted.wires?topo.links.filter(l=>ids.has(l.a)&&ids.has(l.b)).map(l=>structuredClone(l)):[];
   const copy=topoClipboardFromRefs([{kind:'zone',id:source.id}],{includeChecklist:opted.checklists});
   topoClipboard={items,links,checklists:opted.checklists?copy.checklists:[]};topoPasteCount=0;topoPaste({preserveNetwork:opted.network,zoneSize:opted.size});
  }
  dialog.remove();
 });dialog.showModal();
}
function topoPaste(options={}){
 if(!topoClipboard?.items.length)return;
 topoCheckpoint();const offset=30*++topoPasteCount,map=new Map();topoSelection=[];
 for(const entry of topoClipboard.items){
  const item=structuredClone(entry.item),kind=entry.kind;
  const id=(kind==='device'?'d':kind==='zone'?'z':'n')+crypto.randomUUID();
  if(kind==='device')topo.counter++;else if(kind==='zone')topo.zoneCounter++;else topo.noteCounter++;
  map.set(item.id,id);item.id=id;item.x+=offset;item.y+=offset;item.locked=false;
  if(kind==='zone'){
   const used=new Set(topo.zones.map(z=>/^LAN\s+(\d+)$/i.exec(z.name||'')).filter(Boolean).map(m=>+m[1]));let number=1;while(used.has(number))number++;
   item.name='LAN '+number;item.color=TOPO_PALETTE[(number-1)%TOPO_PALETTE.length];if(!options.preserveNetwork)item.network='';
   if(options.zoneSize===false){item.w=300;item.h=220}
   if(item.labels)for(const v of ['physical','logical'])if(item.labels[v]){item.labels[v].name=item.name;if(!options.preserveNetwork)item.labels[v].network=''}
  }
  topoList(kind).push(item);topoSelection.push({kind,id});
 }
 for(const link of topoClipboard.links){
  if(!map.has(link.a)||!map.has(link.b))continue;
  const item=structuredClone(link);item.id='l'+crypto.randomUUID();item.a=map.get(link.a);item.b=map.get(link.b);item.locked=false;topo.links.push(item);
 }
 for(const checklist of topoClipboard.checklists||[]){
  let source=checklist.topologyDeviceId;
  if(!source){const match=topoClipboard.items.find(x=>x.kind==='device'&&x.item.name?.trim().toLowerCase()===checklist.name?.trim().toLowerCase());source=match?.item.id}
  if(!map.has(source))continue;
  const copied=structuredClone(checklist);copied.id='d'+crypto.randomUUID();copied.topologyDeviceId=map.get(source);
  // Name follows the duplicated topology device; progress is deliberately reset.
  copied.name=topo.devices.find(d=>d.id===copied.topologyDeviceId)?.name||copied.name;
  copied.done=false;copied.checked=[];(state.checklistDevices||=[]).push(copied);
 }
 topoSelected=topoSelection.at(-1)||null;topoSave();checkpoint();topoRefresh();$('topo-board').focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(active!=='topology'||e.target.closest('input:not([readonly]),textarea:not([readonly]),select'))return;if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(k==='c'){e.preventDefault();topoCopy()}if(k==='v'){e.preventDefault();topoPaste()}if(k==='d'){e.preventDefault();topoCopy();topoPaste()}}});

function plannerColors(i){return TOPO_PALETTE[i%TOPO_PALETTE.length]}
function polishWorkspace(){
 const planning=['flsm','vlsm','v6flsm'].includes(active),subnet=['ipv4','ipv6'].includes(active);
 content.querySelectorAll('.inventory-hint').forEach(e=>e.remove());
 if(active==='ipv4')mountIPv4Calculator();
 if(active==='ipv6'){const hero=document.createElement('section');hero.id='ipv6-overview';hero.className='address-hero';content.querySelector('.tool-title-row').after(hero);const parts=[...state.ipv6],p=Math.max(0,Math.min(128,+$('prefix').value||0)),ip=parse6(parts.join(':')),net=(ip>>BigInt(128-p))<<BigInt(128-p);updateIPv6Visual(parts,p,net)}
 if(subnet){if($('reset'))content.querySelector('.tool-title-row').append($('reset'));const toolbar=content.querySelector('.toolbar');toolbar?.classList.add('workbench-controls');content.querySelectorAll('.card').forEach(c=>c.classList.add('workbench'));if(active==='ipv6')$('prefix').setAttribute('aria-label','IPv6 network prefix');}
 if(planning){const table=active==='vlsm'?$('vlsm-grid'):$('results')?.closest('table');if(table){const wrap=table.closest('.table-wrap');wrap?.classList.add('planner-sheet');const overview=document.createElement('section');overview.id='allocation-overview';overview.className='allocation-overview';(wrap||table).before(overview)}
 const bar=content.querySelector('.toolbar');if(bar){bar.classList.add('planner-controls');const actions=document.createElement('details');actions.className='workspace-menu';actions.innerHTML='<summary>Export ▾</summary><div></div>';for(const id of ['copy','csv','excel'])if($(id))actions.lastElementChild.append($(id));actions.lastElementChild.addEventListener('click',()=>actions.open=false);bar.append(actions);if($('calc'))$('calc').classList.add('primary');if($('reset'))$('reset').classList.add('quiet');}
 for(const kind of ['flsm','vlsm'])if($('inventory-'+kind)){const toolbar=content.querySelector(`[data-inventory="${kind}"] .inventory-toolbar`);const summary=document.createElement('span');summary.className='inventory-metrics';summary.id='inventory-metrics-'+kind;toolbar.querySelector('h2').after(summary);updateInventorySummary(kind)}
 updateAllocation();}
}
function metric(label,value,cls=''){return `<div class="metric ${cls}"><span>${label}</span><strong>${esc(value)}</strong></div>`}
function mountIPv4Calculator(){
 const section=document.createElement('section');section.className='subnet-calculator';section.innerHTML=`<div class="address-controls"><label>IPv4 address / prefix<input id="subnet-address" spellcheck="false" aria-label="IPv4 address and prefix" value="${esc(state.fields['ipv4:cidr']||'192.168.10.10/24')}"></label><div class="prefix-control"><label for="subnet-prefix">Prefix <strong id="subnet-prefix-value">/24</strong></label><input id="subnet-prefix" type="range" min="0" max="32" value="24"></div></div><div id="subnet-detail"></div>`;
 content.querySelector('.tool-title-row').after(section);
 const update=()=>{const box=$('subnet-detail');try{const c=ipv4cidr($('subnet-address').value),[first,last,hosts]=usable(c.net,c.p,c.size);state.fields['ipv4:cidr']=$('subnet-address').value;checkpoint();$('subnet-prefix').value=c.p;$('subnet-prefix-value').textContent='/'+c.p;
 const bits=c.ip.toString(2).padStart(32,'0');box.innerHTML=`<div class="address-hero"><span class="eyebrow">NETWORK</span><div class="network-address">${ip4(c.net)}<span>/${c.p}</span></div><div class="address-badges"><span>${hosts.toLocaleString('en-US')} usable ${hosts===1?'address':'addresses'}</span><span>${c.p} network / ${32-c.p} host bits</span></div></div><div class="address-bitstrip" aria-label="Address bits: ${c.p} network bits and ${32-c.p} host bits">${[...bits].map((v,i)=>`<button type="button" data-prefix-bit="${i+1}" class="${i<c.p?'network-bit':'host-bit'} ${i%8===0?'octet-start':''}" title="Set prefix /${i+1}" aria-label="Set prefix /${i+1}">${v}</button>`).join('')}</div><div class="bit-legend"><span>Network</span><span>Host</span></div><div class="subnet-metrics">${metric('Subnet mask',ip4(c.mask))}${metric('Wildcard',ip4((~c.mask)>>>0))}${metric('First usable',first)}${metric('Last usable',last)}${metric('Broadcast',c.p>=31?'Not used':ip4(c.net+c.size-1))}${metric('Total addresses',c.size.toLocaleString('en-US'))}</div>`;
 }catch(e){box.innerHTML=`<div class="inline-error" role="alert">${esc(e.message)}</div>`}};
 $('subnet-detail').onclick=e=>{const bit=e.target.closest('[data-prefix-bit]');if(!bit)return;$('subnet-address').value=$('subnet-address').value.split('/')[0]+'/'+bit.dataset.prefixBit;update();$('subnet-detail').querySelector('[data-prefix-bit="'+bit.dataset.prefixBit+'"]')?.focus()};
 $('subnet-address').oninput=update;$('subnet-address').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();update()}};$('subnet-prefix').oninput=()=>{const address=$('subnet-address').value.split('/')[0];$('subnet-address').value=address+'/'+$('subnet-prefix').value;update()};update();
}
function updateIPv6Visual(parts,p,net){const box=$('ipv6-overview');if(!box)return;const ip=parse6(parts.join(':'));box.innerHTML=`<span class="eyebrow">IPv6 ADDRESS</span><div class="network-address ipv6-address">${format6(ip)}<span>/${p}</span></div><div class="address-badges"><span>${p} network bits</span><span>${128-p} interface bits</span><span>Block ${selectedGroup+1} / 8</span></div><div class="ipv6-network"><span>Network</span><strong>${format6(net)}/${p}</strong></div>`}
function updateInventorySummary(kind){const badge=$('inventory-metrics-'+kind);if(!badge)return;const rows=ensureInventory(kind);const devices=new Set(rows.map(r=>r[0].trim()).filter(Boolean));badge.textContent=`${devices.size} ${devices.size===1?'device':'devices'} · ${rows.length} ${rows.length===1?'interface':'interfaces'}`;const table=$('inventory-'+kind);table?.querySelectorAll('tbody tr').forEach((tr,i)=>{const vlan=rows[+tr.dataset.row]?.[4]?.trim();const hash=vlan?[...vlan].reduce((n,c)=>n*31+c.charCodeAt(0),0)>>>0:null;tr.style.setProperty('--row-color',hash===null?'#60798e':plannerColors(hash));tr.classList.toggle('empty-entry',!rows[+tr.dataset.row])})}
function updateAllocation(){const overview=$('allocation-overview');if(!overview)return;const table=active==='vlsm'?$('vlsm-grid'):$('results')?.closest('table');if(!table)return;if($('status')?.classList.contains('error')){overview.innerHTML='';return}const rows=[...table.tBodies[0].rows].filter(tr=>active!=='vlsm'||tr.cells[2].textContent.trim());const count=rows.length;
 try{let total,used,segments=[],parentLabel=$('parent').value;if(active==='v6flsm'){const parent=cidr6(parentLabel),target=+$('target').value;total=1n<<BigInt(target-parent.p);used=BigInt(count);segments=rows.map((tr,i)=>{tr.style.setProperty('--row-color',plannerColors(i));return{label:tr.cells[1].textContent,color:plannerColors(i),weight:1}});}
 else{const text=parentLabel.includes('/')?parentLabel:parentLabel+'/0';const parent=ipv4cidr(text);total=parentLabel.includes('/')?parent.size:2**32-parseIPv4(parentLabel);used=0;segments=rows.map((tr,i)=>{const prefix=+(tr.cells[3]?.textContent||'').replace('/',''),p=active==='flsm'?+(tr.cells[2].textContent.replace('/','')):prefix;const weight=2**(32-p);used+=weight;tr.style.setProperty('--row-color',plannerColors(i));return{label:active==='flsm'?tr.cells[1].textContent:(tr.cells[0].textContent||'LAN '+(i+1)),weight,color:plannerColors(i)}})}
 const ratio=typeof total==='bigint'?Number(used*10000n/total)/100:Number(used)/Number(total)*100;const remainder=typeof total==='bigint'?total-used:total-used;const unit=active==='v6flsm'?'subnets':'addresses';overview.innerHTML=`<div class="allocation-top"><div><span class="eyebrow">ADDRESS ALLOCATION</span><strong>${esc(parentLabel)}</strong></div><div class="allocation-numbers"><span><b>${count}</b> planned</span><span><b>${used.toLocaleString('en-US')}</b> ${unit} used</span><span><b>${remainder.toLocaleString('en-US')}</b> unallocated</span></div></div><div class="allocation-track" aria-label="${ratio.toFixed(1)} percent allocated"><div class="allocation-used" style="width:${Math.min(100,ratio)}%">${segments.slice(0,200).map(x=>`<span style="flex:${x.weight};background:${x.color}" title="${esc(x.label)}"></span>`).join('')}</div></div><div class="allocation-legend">${segments.slice(0,8).map(x=>`<span><i style="background:${x.color}"></i>${esc(x.label)}</span>`).join('')}${segments.length>8?`<span>+${segments.length-8} more</span>`:''}<span class="allocation-free">${ratio.toFixed(1)}% allocated</span></div>`;
 }catch{overview.innerHTML=''}
}

function chartData(){if(!state.networkChart||!Array.isArray(state.networkChart.subnets)||!Array.isArray(state.networkChart.devices)||!Array.isArray(state.networkChart.entries))state.networkChart={subnets:[],devices:[],entries:[],counter:0};return state.networkChart}
function chartId(){const data=chartData();data.counter=(Number(data.counter)||0)+1;return 'nc'+data.counter}
function chartSubnetInfo(cidr){if(cidr.includes(':')){const c=cidr6(cidr),net=(c.ip>>BigInt(128-c.p))<<BigInt(128-c.p);return{prefix:c.p,cidr:format6(net)+'/'+c.p,small:c.p>=126,ipv6:true,net,size:1n<<BigInt(128-c.p)}}const c=ipv4cidr(cidr);return{...c,prefix:c.p,cidr:ip4(c.net)+'/'+c.p,small:c.p>=30,ipv6:false}}
function chartDevice(entry){return chartData().devices.find(d=>d.id===entry.device)||{name:'Unknown device',type:'PC'}}
function chartLabel(entry){const subnet=chartData().subnets.find(s=>s.id===entry.subnet);return chartDevice(entry).name+(entry.port?' · '+entry.port:'')+' — '+(subnet?.name||'Subnet')}
function chartSave(){checkpoint()}
function chartMove(id,delta){const list=chartData().subnets,i=list.findIndex(s=>s.id===id),to=i+delta;if(i<0||to<0||to>=list.length)return;list.splice(to,0,list.splice(i,1)[0]);chartSave();renderNetworkChart();document.querySelector(`[data-chart-subnet="${id}"] .chart-move-handle`)?.focus()}
function renderNetworkChart(){title('NETWORK CHART');const data=chartData();content.insertAdjacentHTML('beforeend',`<div class="chart-toolbar"><button id="chart-add-subnet" class="primary">+ Subnet</button><button id="chart-expand">⛶ Fullscreen</button><button id="chart-reset" class="quiet">Reset</button></div><div id="chart-board" class="chart-board" style="--chart-count:${Math.max(1,Math.min(5,data.subnets.length))}"></div>`);const board=$('chart-board');board.addEventListener('keydown',e=>{if(!e.target.matches('.chart-select'))return;const keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];if(!keys.includes(e.key))return;const column=e.target.closest('.chart-subnet'),cols=[...board.querySelectorAll('.chart-subnet')],buttons=[...column.querySelectorAll('.chart-select')],index=buttons.indexOf(e.target);let next;if(e.key==='ArrowUp'||e.key==='ArrowDown')next=buttons[Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)))];else{const other=cols[cols.indexOf(column)+(e.key==='ArrowRight'?1:-1)];const peers=[...other?.querySelectorAll('.chart-select')||[]];next=peers[Math.min(index,peers.length-1)]}if(next){e.preventDefault();next.focus();next.click()}});
 if(!data.subnets.length){board.innerHTML='<div class="chart-empty"><h2>No subnets yet</h2><button id="chart-example">Load example</button></div>';$('chart-example').onclick=()=>{chartLoadExample();chartSave();renderNetworkChart()}}
 for(const [index,subnet] of data.subnets.entries()){let info;try{info=chartSubnetInfo(subnet.cidr)}catch{info={small:false}}const column=document.createElement('section');column.className='chart-subnet'+(info.small?' chart-small':'');column.dataset.chartSubnet=subnet.id;column.style.setProperty('--chart-color',TOPO_PALETTE[index%TOPO_PALETTE.length]);if(subnet.width)column.style.flexBasis=subnet.width+'px';const rows=data.entries.filter(e=>e.subnet===subnet.id);column.innerHTML=`<header class="chart-subnet-header"><div class="chart-column-actions"><button class="chart-move-handle" draggable="true" aria-label="Move ${esc(subnet.name)}" title="Drag to reorder · Left/Right keys">⠿</button><button data-col-move="-1" aria-label="Move ${esc(subnet.name)} left" ${index===0?'disabled':''}>‹</button><button data-col-move="1" aria-label="Move ${esc(subnet.name)} right" ${index===data.subnets.length-1?'disabled':''}>›</button><button class="chart-edit-subnet" aria-label="Edit ${esc(subnet.name)}" title="Edit subnet">⋯</button></div><h2>${esc(subnet.name)}</h2><div class="chart-cidr">${esc(subnet.cidr)}</div><details class="chart-subnet-info"><summary>Subnet details</summary><div>${subnet.gateway?`<label>Gateway <span>${esc(subnet.gateway)}</span></label>`:''}${!info.ipv6&&info.size?`<label>Usable <span>${usable(info.net,info.p,info.size).slice(0,2).join(' – ')}</span></label>`:''}${subnet.notes?`<p>${esc(subnet.notes)}</p>`:''}<button class="chart-edit-subnet">Edit subnet</button></div></details></header><div class="chart-devices-panel"><div class="chart-entry-list"></div><button class="chart-add-here">+ Device</button></div><div class="chart-ssh-entries"></div><button class="chart-add-ssh">+ SSH</button><button class="chart-resize-handle" aria-label="Resize ${esc(subnet.name)}" title="Drag to resize · Arrow keys adjust · Double-click resets">↔</button>`;
 chartRenderSSH(column,subnet);
 const resize=column.querySelector('.chart-resize-handle');resize.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const start=e.clientX,width=column.getBoundingClientRect().width;resize.setPointerCapture(e.pointerId);const move=ev=>{subnet.width=Math.round(Math.max(145,Math.min(board.clientWidth||1600,width+ev.clientX-start)));column.style.flexBasis=subnet.width+'px'};const finish=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',finish);resize.removeEventListener('pointercancel',finish);chartSave()};resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',finish);resize.addEventListener('pointercancel',finish)};resize.ondblclick=()=>{delete subnet.width;column.style.flexBasis='';chartSave()};resize.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();subnet.width=Math.max(145,Math.min(board.clientWidth||1600,(subnet.width||column.getBoundingClientRect().width)+(e.key==='ArrowRight'?10:-10)));column.style.flexBasis=subnet.width+'px';chartSave()}};
 const list=column.querySelector('.chart-entry-list'),visited=new Set();const draw=(entry,container,depth)=>{if(visited.has(entry.id))return;visited.add(entry.id);const group=document.createElement('div');group.className='chart-entry-group';const device=chartDevice(entry),peer=data.entries.find(e=>e.id===entry.connectedTo);let issue='';try{if(entry.ip){const c=chartSubnetInfo(subnet.cidr);if(c.ipv6){const ip=parse6(entry.ip.split('/')[0]);if(ip<c.net||ip>=c.net+c.size)issue='Outside subnet'}else{const ip=parseIPv4(entry.ip.split('/')[0]);if(ip<c.net||ip>=c.net+c.size)issue='Outside subnet';else if(c.p<31&&(ip===c.net||ip===c.net+c.size-1))issue='Network / broadcast address'}if(data.entries.some(e=>e.id!==entry.id&&e.subnet===entry.subnet&&e.ip?.split('/')[0]===entry.ip.split('/')[0]))issue='Duplicate address'}}catch{issue='Check IP address'}
 const row=document.createElement('article');row.className='chart-entry'+(issue?' chart-entry-warning':'');row.dataset.chartEntry=entry.id;row.innerHTML=`<button class="chart-select" aria-pressed="false"><span class="chart-device-icon">${topoIcon(device.type)}</span><span class="chart-device-text"><strong>${esc(device.name)}</strong><span class="chart-entry-ip">${esc(entry.ip||'—')}</span>${entry.port?`<span class="chart-entry-port">${esc(entry.port)}</span>`:''}</span></button>${peer?`<button class="chart-peer" data-chart-peer="${esc(peer.id)}" title="${esc(chartLabel(peer))}">↳ ${esc(chartDevice(peer).name)}${peer.subnet!==entry.subnet?' · '+esc(data.subnets.find(s=>s.id===peer.subnet)?.name||'Subnet')+' ↗':entry.peerPort?' · '+esc(entry.peerPort):''}</button>`:''}${issue?`<span class="chart-issue">${issue}</span>`:''}<details class="chart-entry-details"><summary>Details</summary><dl>${[['Type',device.type],['Interface',entry.port],['Peer',peer?chartLabel(peer):''],['Peer port',entry.peerPort],['DNS',entry.dns],['Role',entry.role],['IPv6 / other IP',entry.otherIp],['Notes',entry.notes],...(entry.fields||[]).map(f=>[f.name,f.value])].filter(x=>x[1]).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><button class="chart-edit-entry">Edit</button></details>`;
 row.querySelector('.chart-select').onclick=()=>chartHighlight(entry.id);row.querySelector('.chart-peer')?.addEventListener('click',()=>chartHighlight(peer.id,true));row.querySelector('.chart-edit-entry').onclick=()=>chartEntryEditor(entry.id);group.append(row);container.append(group);if(depth<25){const children=rows.filter(e=>e.connectedTo===entry.id&&!visited.has(e.id));if(children.length){const branch=document.createElement('div');branch.className='chart-branches';group.append(branch);children.forEach(e=>draw(e,branch,depth+1))}}};
 const sorted=[...rows].sort((a,b)=>{try{return parseIPv4(a.ip?.split('/')[0]||'0.0.0.0')-parseIPv4(b.ip?.split('/')[0]||'0.0.0.0')}catch{return 0}});sorted.filter(e=>!rows.some(r=>r.id===e.connectedTo)).forEach(e=>draw(e,list,0));sorted.forEach(e=>draw(e,list,0));
 if(!rows.length)list.innerHTML='<div class="chart-no-devices">No devices</div>';column.querySelectorAll('.chart-edit-subnet').forEach(b=>b.onclick=()=>chartSubnetEditor(subnet.id));column.querySelector('.chart-add-here').onclick=()=>chartEntryEditor(null,subnet.id);column.querySelectorAll('[data-col-move]').forEach(b=>b.onclick=()=>chartMove(subnet.id,+b.dataset.colMove));const handle=column.querySelector('.chart-move-handle');handle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();chartMove(subnet.id,e.key==='ArrowLeft'?-1:1)}};handle.ondragstart=e=>{e.dataTransfer.setData('text/x-chart-subnet',subnet.id);e.dataTransfer.effectAllowed='move'};column.ondragover=e=>{if([...e.dataTransfer.types].includes('text/x-chart-subnet')){e.preventDefault();e.dataTransfer.dropEffect='move';column.classList.add('chart-drop-target')}};column.ondragleave=()=>column.classList.remove('chart-drop-target');column.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('text/x-chart-subnet'),from=data.subnets.findIndex(s=>s.id===id),to=data.subnets.findIndex(s=>s.id===subnet.id);if(from>=0&&to>=0&&from!==to){data.subnets.splice(to,0,data.subnets.splice(from,1)[0]);chartSave();renderNetworkChart()}column.classList.remove('chart-drop-target')};board.append(column)}
 $('chart-add-subnet').onclick=()=>chartSubnetEditor();$('chart-reset').onclick=()=>{if(!confirm('Clear all Network Chart subnets, devices and interfaces?'))return;state.networkChart={subnets:[],devices:[],entries:[],counter:0};chartSave();renderNetworkChart()};$('chart-expand').textContent=document.body.classList.contains('chart-fullscreen')?'⛶ Exit fullscreen':'⛶ Fullscreen';$('chart-expand').onclick=()=>{document.body.classList.toggle('chart-fullscreen');$('chart-expand').textContent=document.body.classList.contains('chart-fullscreen')?'⛶ Exit fullscreen':'⛶ Fullscreen'};
}
function chartHighlight(id,scroll=false){const data=chartData(),selected=data.entries.find(e=>e.id===id);if(!selected)return;const same=new Set(data.entries.filter(e=>e.device===selected.device).map(e=>e.id)),related=new Set();for(const entry of data.entries){if(same.has(entry.id)&&entry.connectedTo)related.add(entry.connectedTo);if(same.has(entry.connectedTo))related.add(entry.id)}content.querySelectorAll('[data-chart-entry]').forEach(row=>{const isSame=same.has(row.dataset.chartEntry),isRelated=related.has(row.dataset.chartEntry);row.classList.toggle('chart-highlight',isSame);row.classList.toggle('chart-related',!isSame&&isRelated);row.querySelector('.chart-select').setAttribute('aria-pressed',String(isSame))});if(scroll)content.querySelector(`[data-chart-entry="${id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}
function chartDialog(label,markup,onSave){$('chart-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='chart-dialog';dialog.setAttribute('aria-label',label);dialog.innerHTML=`<form><header><h2>${esc(label)}</h2><button type="button" id="chart-dialog-close" aria-label="Close">×</button></header>${markup}<p class="chart-form-error" role="alert" hidden></p><footer><button type="button" id="chart-dialog-delete" hidden>Delete</button><button type="button" id="chart-dialog-cancel">Cancel</button><button type="submit" class="primary">Save</button></footer></form>`;document.body.append(dialog);dialog.querySelector('#chart-dialog-close').onclick=()=>dialog.close();dialog.querySelector('#chart-dialog-cancel').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.querySelector('form').onsubmit=e=>{e.preventDefault();try{onSave(new FormData(e.target));chartSave();dialog.close();renderNetworkChart()}catch(err){const box=dialog.querySelector('.chart-form-error');box.hidden=false;box.textContent=err.message}};dialog.showModal();return dialog}
function chartField(label,name,value='',type='text'){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${['name','cidr'].includes(name)?'required':''}></label>`}
function chartSubnetEditor(id){const data=chartData(),subnet=data.subnets.find(s=>s.id===id);const dialog=chartDialog(subnet?'Edit subnet':'Add subnet',`<div class="chart-form-grid">${chartField('Name','name',subnet?.name||'LAN '+(data.subnets.length+1))}${chartField('Network / prefix','cidr',subnet?.cidr||'192.168.'+(data.subnets.length+1)+'.0/24')}${chartField('Column width (px, blank = automatic)','width',subnet?.width||'','number')}${chartField('Gateway (optional)','gateway',subnet?.gateway||'')}</div><label>Notes<textarea name="notes" rows="2">${esc(subnet?.notes||'')}</textarea></label>`,form=>{const name=String(form.get('name')).trim();if(!name)throw Error('Enter a subnet name');const info=chartSubnetInfo(String(form.get('cidr')).trim()),record={id:subnet?.id||chartId(),name,cidr:info.cidr,width:form.get('width')?Math.max(145,Math.min(2000,Number(form.get('width'))||145)):null,gateway:String(form.get('gateway')).trim(),notes:String(form.get('notes')).trim()};if(subnet)Object.assign(subnet,record);else data.subnets.push(record)});const advanced=document.createElement('details');advanced.className='chart-extra-options';advanced.innerHTML='<summary>More details</summary><div class="chart-form-grid"></div>';for(const name of ['width','gateway'])advanced.lastElementChild.append(dialog.querySelector(`[name="${name}"]`).closest('label'));advanced.append(dialog.querySelector('[name="notes"]').closest('label'));dialog.querySelector('form>footer').before(advanced);if(!subnet)dialog.querySelector('[type="submit"]').textContent='Add';if(subnet){const b=dialog.querySelector('#chart-dialog-delete');b.hidden=false;b.onclick=()=>{if(!confirm('Delete '+subnet.name+' and its interface entries?'))return;const ids=new Set(data.entries.filter(e=>e.subnet===id).map(e=>e.id));data.entries=data.entries.filter(e=>!ids.has(e.id));for(const e of data.entries)if(ids.has(e.connectedTo))e.connectedTo='';data.subnets=data.subnets.filter(s=>s.id!==id);chartSave();dialog.close();renderNetworkChart()}}}
function chartEntryEditor(id,subnetId){const data=chartData(),entry=data.entries.find(e=>e.id===id),device=entry?chartDevice(entry):null;if(!data.subnets.length)return;const selectedSubnet=entry?.subnet||subnetId||data.subnets[0].id;const dialog=chartDialog(entry?'Edit device':'Add device',`<div class="chart-form-grid"><label>Subnet<select name="subnet">${data.subnets.map(s=>`<option value="${s.id}" ${s.id===selectedSubnet?'selected':''}>${esc(s.name)} · ${esc(s.cidr)}</option>`).join('')}</select></label><label>Device<select name="device" id="chart-device-choice"><option value="new">+ New device</option>${data.devices.map(d=>`<option value="${d.id}" ${d.id===entry?.device?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>${chartField('Device name','name',device?.name||'')}<label>Device type<select name="type">${TOPO_TYPES.map(t=>`<option ${t===(device?.type||'PC')?'selected':''}>${t}</option>`).join('')}</select></label>${chartField('IP address (optional)','ip',entry?.ip||'')}${chartField('Interface / port','port',entry?.port||'')}<label>Connected to<select name="connectedTo"><option value="">Not specified</option>${data.entries.filter(e=>e.id!==id).map(e=>`<option value="${e.id}" ${entry?.connectedTo===e.id?'selected':''}>${esc(chartLabel(e))}</option>`).join('')}</select></label>${chartField('Peer port (optional)','peerPort',entry?.peerPort||'')}${chartField('DNS','dns',entry?.dns||'')}${chartField('Role','role',entry?.role||'')}${chartField('IPv6 / other IP','otherIp',entry?.otherIp||'')}</div><label>Notes<textarea name="notes" rows="2">${esc(entry?.notes||'')}</textarea></label><div id="chart-custom-fields"></div><button type="button" id="chart-add-field">+ Custom field</button>`,form=>{const deviceId=String(form.get('device')),name=String(form.get('name')).trim(),type=String(form.get('type'));if(!name)throw Error('Enter a device name');const subnet=String(form.get('subnet'));if(!data.subnets.some(s=>s.id===subnet))throw Error('Choose a subnet');const connectedTo=String(form.get('connectedTo'));if(connectedTo===id)throw Error('An interface cannot connect to itself');const record={id:entry?.id||chartId(),device:deviceId==='new'?chartId():deviceId,subnet,connectedTo};for(const key of ['ip','port','peerPort','dns','role','otherIp','notes'])record[key]=String(form.get(key)||'').trim();if(record.ip){const ip=record.ip.split('/')[0];if(ip.includes(':'))parse6(ip);else parseIPv4(ip)}record.fields=[...dialog.querySelectorAll('.chart-custom-field')].map(row=>({name:row.querySelector('[data-field-name]').value.trim(),value:row.querySelector('[data-field-value]').value.trim()})).filter(f=>f.name||f.value);const old=data.devices.find(d=>d.id===record.device);if(old)Object.assign(old,{name,type});else data.devices.push({id:record.device,name,type});if(entry)Object.assign(entry,record);else data.entries.push(record)});
 const extras=document.createElement('details');extras.className='chart-extra-options';extras.innerHTML='<summary>More details</summary><div class="chart-form-grid"></div>';for(const name of ['subnet','device','port','peerPort','dns','role','otherIp']){const input=dialog.querySelector(`[name="${name}"]`);if(input)extras.lastElementChild.append(input.closest('label'))}extras.append(dialog.querySelector('[name="notes"]').closest('label'),dialog.querySelector('#chart-custom-fields'),dialog.querySelector('#chart-add-field'));dialog.querySelector('form>footer').before(extras);if(!entry)dialog.querySelector('[type="submit"]').textContent='Add';
 const addField=(field={name:'',value:''})=>{const row=document.createElement('div');row.className='chart-custom-field';row.innerHTML=`<input aria-label="Custom field name" placeholder="Field name" data-field-name value="${esc(field.name)}"><input aria-label="Custom field value" placeholder="Value" data-field-value value="${esc(field.value)}"><button type="button" aria-label="Remove field">×</button>`;row.querySelector('button').onclick=()=>row.remove();dialog.querySelector('#chart-custom-fields').append(row)};(entry?.fields||[]).forEach(addField);dialog.querySelector('#chart-add-field').onclick=()=>addField();dialog.querySelector('#chart-device-choice').onchange=e=>{const found=data.devices.find(d=>d.id===e.target.value);dialog.querySelector('[name="name"]').value=found?.name||'';dialog.querySelector('[name="type"]').value=found?.type||'PC'};if(entry){const b=dialog.querySelector('#chart-dialog-delete');b.hidden=false;b.onclick=()=>{if(!confirm('Remove this interface from the chart?'))return;data.entries=data.entries.filter(e=>e.id!==id);for(const e of data.entries)if(e.connectedTo===id)e.connectedTo='';chartSave();dialog.close();renderNetworkChart()}}}
function chartLoadExample(){const data={subnets:[],devices:[],entries:[],counter:100};state.networkChart=data;for(let i=0;i<5;i++)data.subnets.push({id:'s'+i,name:['HQ','Servers','Guests','R1 ↔ R2','R2 loopback'][i],cidr:['192.168.1.0/26','192.168.2.0/28','192.168.5.0/27','10.0.0.0/30','10.255.0.2/32'][i],vlan:['1','2','5','',''][i],gateway:['192.168.1.1','192.168.2.1','192.168.5.1','',''][i],notes:''});data.devices=[{id:'r1',name:'R1',type:'Router'},{id:'r2',name:'R2',type:'Router'},{id:'sw1',name:'SW1',type:'Switch'},{id:'sw2',name:'SW2',type:'Switch'},{id:'pc1',name:'PC-01',type:'PC'},{id:'dc1',name:'DC1',type:'Server'},{id:'lap1',name:'LAP-01',type:'Laptop'}];const entry=(id,device,subnet,ip,port,connectedTo='',peerPort='')=>data.entries.push({id,device,subnet,ip,port,connectedTo,peerPort,fields:[]});entry('r1lan','r1','s0','192.168.1.1','Gi0/0');entry('sw1lan','sw1','s0','192.168.1.2','VLAN 1','r1lan','Gi0/0');entry('pc1lan','pc1','s0','192.168.1.10','Ethernet0','sw1lan','Fa0/3');entry('r2srv','r2','s1','192.168.2.1','Gi0/1.2','r2wan','Gi0/0');entry('sw2srv','sw2','s1','','VLAN 2','r2srv','Gi0/1.2');entry('dc1srv','dc1','s1','192.168.2.2','Ethernet0','sw2srv','Fa0/2');entry('r2guest','r2','s2','192.168.5.1','Gi0/1.5','r2wan','Gi0/0');entry('lap1guest','lap1','s2','192.168.5.10','Wi-Fi','r2guest');entry('r1wan','r1','s3','10.0.0.1','Gi0/2');entry('r2wan','r2','s3','10.0.0.2','Gi0/0','r1wan','Gi0/2');entry('r2loop','r2','s4','10.255.0.2','Loopback0');data.entries.find(e=>e.id==='dc1srv').fields=[{name:'Services',value:'AD DS · DNS'},{name:'Domain',value:'greyzone.local'}]}
document.addEventListener('keydown',e=>{if(active!=='chart'||$('chart-dialog'))return;if(e.key==='Escape'){document.body.classList.remove('chart-fullscreen');$('chart-expand').textContent='⛶ Fullscreen';content.querySelectorAll('.chart-highlight,.chart-related').forEach(row=>{row.classList.remove('chart-highlight','chart-related');row.querySelector('.chart-select')?.setAttribute('aria-pressed','false')})}});

function chartEyeIcon(revealed=false){return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${revealed?'<path d="M3 3l18 18"/>':''}</svg>`}
function chartBindEye(button,input){const mask=()=>{input.type='password';button.innerHTML=chartEyeIcon();button.setAttribute('aria-label','Show password');button.setAttribute('aria-pressed','false')};mask();button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';button.innerHTML=chartEyeIcon(show);button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show))};return mask}
function chartRenderSSH(column,subnet){if(!Array.isArray(subnet.sshEntries)){subnet.sshEntries=[];if(subnet.ssh&&(subnet.ssh.username||subnet.ssh.password))subnet.sshEntries.push({id:chartId(),...subnet.ssh});delete subnet.ssh}const list=column.querySelector('.chart-ssh-entries');const draw=()=>{list.innerHTML='';for(const login of subnet.sshEntries){const details=document.createElement('details');details.className='chart-ssh-login';details.dataset.sshId=login.id;details.innerHTML=`<summary><span>SSH</span><strong>${esc(login.name||login.host||'Login')}</strong></summary><div class="chart-ssh-panel"><label>IP<input data-ssh="ip" readonly value="${esc(login.ip||login.host||'')}" autocomplete="off" spellcheck="false"></label><label>Username<input data-ssh="username" readonly value="${esc(login.username||'')}" autocomplete="off"></label><label>Password<div class="chart-password-wrap"><input data-ssh="password" type="password" readonly value="${esc(login.password||'')}" autocomplete="off" aria-label="SSH password"><button type="button" class="chart-show-password"></button></div></label><div class="chart-ssh-actions"><button type="button" class="chart-edit-ssh">Edit</button><button type="button" class="chart-remove-ssh">Remove</button></div></div>`;const mask=chartBindEye(details.querySelector('.chart-show-password'),details.querySelector('[data-ssh="password"]'));details.querySelector('summary').onclick=()=>{if(details.open)mask()};details.addEventListener('toggle',()=>{if(!details.open)mask()});details.querySelector('.chart-edit-ssh').onclick=()=>form(login,details);details.querySelector('.chart-remove-ssh').onclick=()=>{if(!confirm('Remove this SSH login?'))return;subnet.sshEntries=subnet.sshEntries.filter(x=>x.id!==login.id);chartSave();draw()};list.append(details)}};
 const form=(login=null,details=null)=>{list.querySelector('.chart-ssh-draft')?.remove();list.querySelectorAll('.chart-ssh-login').forEach(d=>d.hidden=false);if(details)details.hidden=true;const draft=document.createElement('form');draft.className='chart-ssh-draft chart-ssh-panel';draft.innerHTML=`<label>Device name<input data-ssh="name" placeholder="Device name" value="${esc(login?.name||login?.host||'')}" required autocomplete="off"></label><label>IP<input data-ssh="ip" value="${esc(login?.ip||login?.host||'')}" autocomplete="off" spellcheck="false"></label><label>Username<input data-ssh="username" value="${esc(login?.username||'')}" autocomplete="off" spellcheck="false"></label><label>Password<div class="chart-password-wrap"><input data-ssh="password" type="password" value="${esc(login?.password||'')}" autocomplete="off" aria-label="SSH password"><button type="button" class="chart-show-password"></button></div></label><div class="chart-ssh-actions"><button type="button" class="chart-cancel-ssh">Cancel</button><button type="submit" class="chart-save-ssh">${login?'Save':'Add'}</button></div>`;chartBindEye(draft.querySelector('.chart-show-password'),draft.querySelector('[data-ssh="password"]'));draft.querySelector('.chart-cancel-ssh').onclick=()=>{draft.remove();if(details)details.hidden=false};draft.onsubmit=e=>{e.preventDefault();const name=draft.querySelector('[data-ssh="name"]').value.trim();if(!name){draft.querySelector('[data-ssh="name"]').focus();return}const values={name,ip:draft.querySelector('[data-ssh="ip"]').value.trim(),username:draft.querySelector('[data-ssh="username"]').value,password:draft.querySelector('[data-ssh="password"]').value};if(login)Object.assign(login,values);else subnet.sshEntries.push({id:chartId(),...values});chartSave();draw()};list.append(draft);draft.querySelector('input').focus()};draw();column.querySelector('.chart-add-ssh').onclick=()=>form();}

function topoMirrorColumns(mirror){const data=chartData(),ids=Array.isArray(mirror.sourceIds)?mirror.sourceIds:[];const ordered=[...data.subnets.filter(s=>ids.includes(s.id)),...ids.filter(id=>!data.subnets.some(s=>s.id===id)).map(id=>({id,name:'Source removed',cidr:'',missing:true}))];return ordered.map(subnet=>{const index=data.subnets.findIndex(s=>s.id===subnet.id),entries=data.entries.filter(e=>e.subnet===subnet.id),seen=new Set(),rows=[];const visit=(entry,depth,parentIndex=-1)=>{if(seen.has(entry.id))return;seen.add(entry.id);const device=chartDevice(entry),peer=data.entries.find(e=>e.id===entry.connectedTo);const ownIndex=rows.length;rows.push({parentIndex,name:String(device.name||''),type:TOPO_TYPES.includes(device.type)?device.type:'PC',ip:String(entry.ip||''),port:String(entry.port||''),peer:peer?String(chartDevice(peer).name)+(entry.peerPort?' · '+String(entry.peerPort):''):'',depth:Math.min(depth,3)});entries.filter(e=>e.connectedTo===entry.id).forEach(e=>visit(e,depth+1,ownIndex))};const sorted=[...entries].sort((a,b)=>{try{return parseIPv4(a.ip?.split('/')[0]||'0.0.0.0')-parseIPv4(b.ip?.split('/')[0]||'0.0.0.0')}catch{return 0}});sorted.filter(e=>!entries.some(p=>p.id===e.connectedTo)).forEach(e=>visit(e,0));sorted.forEach(e=>visit(e,0));return{name:String(subnet.name||''),cidr:String(subnet.cidr||''),gateway:String(subnet.gateway||''),color:index<0?'#87929b':TOPO_PALETTE[index%TOPO_PALETTE.length],missing:!!subnet.missing,rows}})}
function topoMirrorLayout(mirror){const columns=topoMirrorColumns(mirror);return{columns,width:Math.max(220,columns.length*220+(columns.length-1)*10),height:Math.max(170,...columns.map(col=>111+Math.max(1,col.rows.length)*76))}}
function topoMirrorNode(mirror){const layout=topoMirrorLayout(mirror),node=document.createElement('div');
 // Old mirrors could have independently stretched frames. Fit the frame to the
 // actual chart content rather than leaving an empty rectangle beside it.
 if(Number.isFinite(mirror.w)&&Number.isFinite(mirror.h)&&mirror.w>12&&mirror.h>12){
  const scale=Math.min((mirror.w-12)/layout.width,(mirror.h-12)/layout.height);
  const fitW=Math.round(layout.width*scale+12),fitH=Math.round(layout.height*scale+12);
  if(Math.abs(mirror.w-fitW)>3||Math.abs(mirror.h-fitH)>3){mirror.w=fitW;mirror.h=fitH;}
 }node.className='topo-note topo-chart-mirror'+(topoContains('note',mirror.id)?' selected':'')+(mirror.locked?' locked':'');node.dataset.note=mirror.id;node.tabIndex=0;node.setAttribute('aria-label','Network Chart mirror, read-only');Object.assign(node.style,{left:mirror.x+'px',top:mirror.y+'px',width:mirror.w+'px',height:mirror.h+'px'});const scale=Math.min((mirror.w-12)/layout.width,(mirror.h-12)/layout.height);node.innerHTML=`<div class="topo-mirror-content" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${Math.max(.05,scale)})"><div class="topo-mirror-columns">${layout.columns.map(col=>`<section class="topo-mirror-column" style="--mirror-color:${col.color}"><header><strong>${esc(col.name)}</strong><span>${esc(col.cidr||'No source available')}</span>${col.gateway?`<small>Gateway · ${esc(col.gateway)}</small>`:''}</header><div class="topo-mirror-entries">${topoMirrorConnectorSVG(col.rows)}${col.rows.length?col.rows.map(row=>`<div class="topo-mirror-entry" style="margin-left:${row.depth*18}px"><span class="topo-mirror-icon">${topoIcon(row.type)}</span><div><strong>${esc(row.name)}</strong><span>${esc(row.ip||'—')}</span>${row.port?`<small>${esc(row.port)}</small>`:''}${row.peer?`<small>via ${esc(row.peer)}</small>`:''}</div></div>`).join(''):`<div class="topo-mirror-empty">${col.missing?'Source removed':'No devices'}</div>`}</div></section>`).join('')}</div></div><div class="topo-zone-resize topo-mirror-resize" title="Resize mirror"></div>`;return node}
function topoInsertChartMirror(){const data=chartData();$('topo-mirror-picker')?.remove();const dialog=document.createElement('dialog');dialog.id='topo-mirror-picker';dialog.setAttribute('aria-label','Insert Network Chart');dialog.innerHTML=`<form><header><h2>Insert Network Chart</h2></header>${data.subnets.length?`<div class="topo-mirror-choices">${data.subnets.map((subnet,index)=>`<label style="--choice-color:${TOPO_PALETTE[index%TOPO_PALETTE.length]}"><input type="checkbox" name="source" value="${esc(subnet.id)}"><span><strong>${esc(subnet.name)}</strong><small>${esc(subnet.cidr)}</small></span></label>`).join('')}</div>`:'<p>Add a subnet in Network Chart first.</p>'}<p id="topo-mirror-error" role="alert" hidden>Choose at least one column.</p><footer><button type="button" id="topo-mirror-cancel">Cancel</button><button type="submit" ${data.subnets.length?'':'disabled'}>Insert</button></footer></form>`;document.body.append(dialog);dialog.querySelector('#topo-mirror-cancel').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const ids=[...dialog.querySelectorAll('input:checked')].map(input=>input.value);if(!ids.length){dialog.querySelector('#topo-mirror-error').hidden=false;return}topoCheckpoint();const inserted=[];for(const [index,sourceId] of ids.entries()){const mirror={id:'n'+(++topo.noteCounter),type:'chartMirror',sourceIds:[sourceId],x:100+($('topo-viewport').scrollLeft/topoZoom),y:90+($('topo-viewport').scrollTop/topoZoom),scope:'both',locked:false};const natural=topoMirrorLayout(mirror),scale=Math.min(1,950/natural.width);mirror.w=Math.ceil(natural.width*scale+12);mirror.h=Math.ceil(natural.height*scale+12);mirror.x+=index*260;topo.notes.push(mirror);inserted.push({kind:'note',id:mirror.id})}topoSelection=inserted;topoSelected=inserted[0];topoSave();dialog.close();topoRefresh();$('topo-board').focus({preventScroll:true})};dialog.showModal()}
function topoDrawMirrorPNG(context,mirror,layoutOverride=null){const layout=layoutOverride||topoMirrorLayout(mirror),scale=Math.max(.05,Math.min((mirror.w-12)/layout.width,(mirror.h-12)/layout.height));context.save();context.translate(mirror.x+6,mirror.y+6);context.scale(scale,scale);context.textAlign='left';context.textBaseline='alphabetic';const text=(value,x,y,width,font,color)=>{context.font=font;context.fillStyle=color;let result=String(value);while(result.length&&context.measureText(result).width>width)result=result.slice(0,-1);if(result!==String(value))result=result.slice(0,-1)+'…';context.fillText(result,x,y)};layout.columns.forEach((col,index)=>{const x=index*230;context.fillStyle='#2c3036';context.fillRect(x,0,220,layout.height);context.fillStyle=col.color+'12';context.fillRect(x,0,220,layout.height);context.fillStyle=col.color;context.fillRect(x,0,220,3);text(col.name,x+12,26,196,'600 15px Segoe UI, Arial, sans-serif','#edf2f7');text(col.cidr||'No source available',x+12,48,196,'12px Consolas, monospace','#d2dce6');if(col.gateway)text('Gateway · '+col.gateway,x+12,68,196,'11px Segoe UI, Arial, sans-serif','#aabac9');context.strokeStyle='#56616d';context.lineWidth=1;context.beginPath();context.moveTo(x,83);context.lineTo(x+220,83);context.stroke();if(!col.rows.length)text(col.missing?'Source removed':'No devices',x+12,112,196,'12px Segoe UI, Arial, sans-serif','#aabac9');context.strokeStyle=col.color;context.lineWidth=1;for(const segment of topoMirrorConnectors(col.rows)){context.beginPath();context.moveTo(x+segment.x,83+segment.y1);context.lineTo(x+segment.x,83+segment.y2);context.lineTo(x+segment.endX,83+segment.y2);context.stroke()}for(const [rowIndex,row]of col.rows.entries()){const indent=row.depth*18,y=94+rowIndex*76,left=x+12+indent;context.strokeStyle=col.color;context.lineWidth=1.2;context.strokeRect(left+2,y+2,12,12);const textLeft=left+24;text(row.name,textLeft,y+12,172-indent,'600 13px Segoe UI, Arial, sans-serif','#edf2f7');text(row.ip||'—',textLeft,y+30,172-indent,'12px Consolas, monospace','#c6d6e4');if(row.port)text(row.port,textLeft,y+46,172-indent,'11px Consolas, monospace','#aabac9');if(row.peer)text('via '+row.peer,textLeft,y+61,172-indent,'11px Segoe UI, Arial, sans-serif','#aabac9')}});context.restore()}
window.addEventListener('storage',event=>{if(event.key!==toolkitStorageKey('devden-toolkit-v2')||active!=='topology')return;try{const saved=event.newValue?JSON.parse(event.newValue):null;const chart=saved?.networkChart;state.networkChart=chart&&Array.isArray(chart.subnets)&&Array.isArray(chart.devices)&&Array.isArray(chart.entries)?chart:{subnets:[],devices:[],entries:[],counter:0};topoRefresh()}catch{}});

function navIcon(key){const shapes={ipv4:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',vlsm:'<path d="M5 3v18M5 7h13M5 17h13"/><rect x="16" y="4" width="5" height="6" rx="1"/><rect x="16" y="14" width="5" height="6" rx="1"/>',flsm:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M10 3v18"/>',notes:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h7M9 12h7M9 16h5"/>',checklist:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m7 8 1 1 2-2m-3 7 1 1 2-2M13 8h4m-4 6h4"/>',chart:'<rect x="2" y="4" width="6" height="16" rx="1"/><rect x="10" y="4" width="5" height="12" rx="1"/><rect x="17" y="4" width="5" height="9" rx="1"/>',topology:'<circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="m11 8-4 8m6-8 4 8M8 19h8"/>',osi:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>'};return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[key]||shapes.ipv4}</svg>`}

function topoMirrorConnectors(rows){return rows.flatMap((row,index)=>row.parentIndex>=0?[{x:12+row.depth*18-10,y1:33+row.parentIndex*76,y2:22+index*76,endX:12+row.depth*18-3}]:[])}
function topoMirrorConnectorSVG(rows){return `<svg class="topo-mirror-connectors" width="220" height="${Math.max(1,rows.length)*76+16}" aria-hidden="true">${topoMirrorConnectors(rows).map(line=>`<path d="M${line.x} ${line.y1}V${line.y2}H${line.endX}"/>`).join('')}</svg>`}

function cleanToolkitState(value,includeSSH=false){const copy=structuredClone(value);if(!includeSSH&&copy.networkChart){for(const subnet of copy.networkChart.subnets||[]){delete subnet.ssh;subnet.sshEntries=[]}}return copy}
function templateLibrary(){try{const list=JSON.parse(localStorage.getItem(toolkitStorageKey('devden-templates-v1'))||'[]');return Array.isArray(list)?list:[]}catch{return []}}
function saveTemplateLibrary(list){localStorage.setItem(toolkitStorageKey('devden-templates-v1'),JSON.stringify(list))}
function toolkitDialog(name,html,onSubmit){$('toolkit-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='toolkit-dialog';dialog.setAttribute('aria-label',name);dialog.innerHTML=`<form><header><h2>${esc(name)}</h2><button type="button" class="toolkit-close" aria-label="Close">×</button></header>${html}<p class="toolkit-error" role="alert" hidden></p><footer><button type="button" class="toolkit-cancel">Cancel</button><button class="primary" type="submit">${name.startsWith('Download')?'Download':name.startsWith('Export')?'Export PDF':'Save template'}</button></footer></form>`;document.body.append(dialog);const close=()=>dialog.close();dialog.querySelector('.toolkit-close').onclick=close;dialog.querySelector('.toolkit-cancel').onclick=close;dialog.onclose=()=>dialog.remove();dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();try{await onSubmit(dialog);dialog.close()}catch(error){const msg=dialog.querySelector('.toolkit-error');msg.hidden=false;msg.textContent=error.message}};dialog.showModal();return dialog}
function inlineScript(value){return String(value).replace(/<\/script/gi,'<\\/script')}
function offlineHTML(includeSSH=false){const source=window.DEVDEN_OFFLINE_SOURCE;if(!source?.script||!source.style||!source.logo)throw Error('The offline source bundle is missing. Keep offline-source.js beside index.html.');const cleanState=cleanToolkitState(state,includeSSH),templates=templateLibrary().map(t=>t.state?({...t,state:cleanToolkitState(t.state,false)}):structuredClone(t)),id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);const js=source.script;const embedded={state:cleanState,topology:structuredClone(topo)};const start=`window.DEVDEN_STORAGE_NAMESPACE=${JSON.stringify(id)};window.DEVDEN_OFFLINE_SOURCE=${JSON.stringify(source)};window.DEVDEN_EMBEDDED_CONFIG=${JSON.stringify(embedded)};try{if(!localStorage.getItem('devden-toolkit-v2-${id}'))localStorage.setItem('devden-toolkit-v2-${id}',JSON.stringify(window.DEVDEN_EMBEDDED_CONFIG.state));if(!localStorage.getItem('devden-topology-v1-${id}'))localStorage.setItem('devden-topology-v1-${id}',JSON.stringify(window.DEVDEN_EMBEDDED_CONFIG.topology));if(!localStorage.getItem('devden-templates-v1-${id}'))localStorage.setItem('devden-templates-v1-${id}',${JSON.stringify(JSON.stringify(templates))});}catch{}`;return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Networking Toolkit | DevDen</title><link rel="icon" href="'+source.logo+'"><style>'+source.style.replace(/<\/style/gi,'<\\/style')+'</style></head><body>'+toolkitShell(source.logo)+'<script>'+inlineScript(start)+'</script><script>'+inlineScript(js)+'</script></body></html>'}
function toolkitShell(logo='logo.png'){return `<div class="shell"><aside id="sidebar"><header><button id="devden-pencil" type="button" title="Draw on page" aria-label="Draw on page">✎</button><button id="devden-sketch-undo" type="button" title="Undo drawing" aria-label="Undo drawing" disabled>↶</button><button id="devden-sketch-redo" type="button" title="Redo drawing" aria-label="Redo drawing" disabled>↷</button><b class="brand-name">DevDen<small>NETWORKING TOOLKIT</small></b><img src="${logo}" alt="DevDen logo" id="logo" title="Collapse sidebar"></header><nav id="navigation"></nav><footer class="app-footer"><div class="footer-tools"><button id="toolkit-offline" title="Download offline copy with current setup" aria-label="Download offline copy">↓ <span>Offline copy</span></button><button id="toolkit-pdf" title="Export PDF" aria-label="Export PDF">▤ <span>PDF</span></button></div><button id="toolkit-templates" title="Saved projects and templates" aria-label="Templates">▧ <span>Templates</span></button></footer></aside><main id="main"><div id="content"></div></main></div>`}
function showOfflineDownload(){toolkitDialog('Download offline copy',`<p class="toolkit-description">The app and your current setup in one HTML file.</p><label class="toolkit-check"><input id="offline-include-ssh" type="checkbox">Include saved SSH logins</label>`,dialog=>{download('DevDen-Toolkit-offline-'+new Date().toISOString().slice(0,10)+'.html',offlineHTML(dialog.querySelector('#offline-include-ssh').checked),'text/html;charset=utf-8')})}
function projectSnapshot(){if(active==='notes')notesCommit();return {version:2,state:cleanToolkitState(state,false),topology:structuredClone(topo)}}
// Apply group changes without destroying the current topology viewport, menus,
// tool mode, selection, keyboard focus or scroll position. These are local UI state.
function applyGroupRemoteProject(item, previous){
 if(!item||item.version!==2||!item.state||!item.topology)return;
 const topologyChanged=JSON.stringify(previous?.topology)!==JSON.stringify(item.topology);
 const chartChanged=JSON.stringify(previous?.state?.networkChart)!==JSON.stringify(item.state.networkChart);
 state={...structuredClone(defaults),...structuredClone(item.state)};
 topo={...topoDefault(),...structuredClone(item.topology)};
 topo.notes ||= [];
 // Never reset topology undo history or selection just because a peer saved.
 topoSelection=topoSelection.filter(ref=>Boolean(topoItem(ref)));
 if(topoSelected&&!topoItem(topoSelected))topoSelected=null;
 try{localStorage.setItem(toolkitStorageKey('devden-toolkit-v2'),JSON.stringify(state))}catch(e){console.warn('Group state persistence',e)}
 topoSave();
 if(active==='topology'){
  // topoRefresh updates existing board DOM and leaves toolbar and viewport intact.
  if(topologyChanged||chartChanged)topoRefresh();
  window.DevDenSketch?.render?.();
 }else{
  navigate(active);
 }
}
function restoreProject(item){
 if(item.version===2&&item.state&&item.topology){
  state={...structuredClone(defaults),...structuredClone(item.state)};
  topo={...topoDefault(),...structuredClone(item.topology)};
 }else{
  const legacy=cleanToolkitState(item.state||{},false);
  state.networkChart=legacy.networkChart||{subnets:[],devices:[],entries:[],counter:0};
  state.checklistDevices=structuredClone(legacy.checklistDevices||[]).map(d=>({...d,done:false,checked:[]}));
  state.checklistSelected=legacy.checklistSelected||null;
  topo={...topoDefault(),...structuredClone(item.topology||topoDefault())};
 }
 topo.notes ||= [];topoSelection=[];topoSelected=null;topoConnecting=null;topoUndo=[];topoRedo=[];topoHistoryPending=null;
 history=[JSON.stringify(state)];historyIndex=0;checkpoint();
 try{localStorage.setItem(toolkitStorageKey('devden-toolkit-v2'),JSON.stringify(state))}catch(e){alert('Unable to save restored project: '+e.message)}
 topoSave();
}
function showTemplates(){const dialog=toolkitDialog('Saved projects & templates',`<p class="toolkit-description">Save the complete current workspace including Notes, charts, checklists and both topology views. Old reusable templates are supported.</p><label class="toolkit-field">Project name<input id="template-name" placeholder="e.g. Two-router lab" maxlength="80"></label><div class="toolkit-export-choices"><button type="button" id="project-import">Import project backup</button><button type="button" id="project-export">Export current backup</button><input id="project-import-file" type="file" accept="application/json,.json" hidden></div><div class="template-library-head"><strong>Saved projects</strong><div class="template-library-actions"><button type="button" id="template-list-import">⬆ Import file</button><button type="button" id="template-list-export">⬇ Export library</button></div></div><div id="template-list"></div>`,d=>{const name=d.querySelector('#template-name').value.trim();if(!name)throw Error('Enter a project name');const list=templateLibrary();list.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,...projectSnapshot()});saveTemplateLibrary(list)});
 const transfer=window.DevDenGroupTransfers;
 if(transfer?.connected()){
  const options=dialog.querySelector('.toolkit-export-choices');
  const tools=document.createElement('div');tools.className='template-group-transfer';
  tools.innerHTML='<button type="button" id="template-upload-group">Upload to group</button><button type="button" id="template-download-group">Save from group</button>';
  options.after(tools);
  tools.querySelector('#template-download-group').onclick=()=>{try{transfer.saveFromGroup();redraw()}catch(e){alert(e.message)}};
  tools.querySelector('#template-upload-group').onclick=async()=>{
   const projects=templateLibrary().filter(t=>t.version===2&&t.state&&t.topology);
   if(!projects.length){alert('Save a Solo project in Templates first.');return}
   const chooser=document.createElement('select');chooser.className='template-group-select';
   projects.forEach(t=>{const opt=document.createElement('option');opt.value=t.id;opt.textContent=t.name;chooser.append(opt)});
   const wrap=document.createElement('div');wrap.className='template-group-chooser';
   const label=document.createElement('label');label.textContent='Solo project';label.append(chooser);wrap.append(label);
   const send=document.createElement('button');send.type='button';send.textContent='Upload selected';wrap.append(send);
   tools.querySelector('.template-group-chooser')?.remove();tools.append(wrap);
   send.onclick=async()=>{if(!confirm('Replace the current Group configuration with this Solo project?'))return;send.disabled=true;try{await transfer.uploadToGroup(chooser.value);wrap.remove();dialog.close()}catch(e){alert(e.message);send.disabled=false}};
  };
 }
 const redraw=()=>{const list=templateLibrary(),target=dialog.querySelector('#template-list');target.innerHTML=list.length?list.map(t=>`<div class="template-item"><span>${esc(t.name)}${t.version===2?' · Project':' · Legacy template'}</span><button type="button" data-load-template="${esc(t.id)}">Open</button><button type="button" data-copy-template="${esc(t.id)}">Duplicate</button><button type="button" data-export-template="${esc(t.id)}">Export</button><button type="button" data-delete-template="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">×</button></div>`).join(''):'<p class="toolkit-empty">No saved projects yet.</p>';
  target.querySelectorAll('[data-load-template]').forEach(button=>button.onclick=async()=>{const item=list.find(t=>t.id===button.dataset.loadTemplate);if(!item)return;const group=window.DevDenGroupTransfers;if(group?.connected()){
   if(item.version!==2||!item.state||!item.topology){alert('Legacy templates cannot be uploaded to a group. Open them in Solo first.');return}
   if(!confirm('Replace the entire shared Group workspace with '+item.name+'? Every connected member will receive the changes.'))return;
   button.disabled=true;try{await group.uploadToGroup(item.id);dialog.close()}catch(e){alert(e.message);button.disabled=false}return
  }if(!confirm('Open '+item.name+'? This will replace your current Solo workspace. Save it first if you want to keep it.'))return;const target=active;restoreProject(item);dialog.close();if(target==='notes')active='ipv4';navigate(target)});
  target.querySelectorAll('[data-copy-template]').forEach(button=>button.onclick=()=>{const item=list.find(t=>t.id===button.dataset.copyTemplate);if(!item)return;const clone=structuredClone(item);clone.id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);clone.name=(clone.name+' (copy)').slice(0,80);try{saveTemplateLibrary([...list,clone]);redraw()}catch(e){alert('Could not duplicate project: '+e.message)}});
  target.querySelectorAll('[data-export-template]').forEach(button=>button.onclick=()=>{const item=list.find(t=>t.id===button.dataset.exportTemplate);if(item)download('DevDen-'+item.name.replace(/[^a-z0-9_-]+/gi,'-')+'.json',JSON.stringify({format:'devden-project',project:item},null,2),'application/json')});
  target.querySelectorAll('[data-delete-template]').forEach(button=>button.onclick=()=>{const item=list.find(t=>t.id===button.dataset.deleteTemplate);if(item&&confirm('Delete saved project '+item.name+'?')){saveTemplateLibrary(list.filter(t=>t.id!==item.id));redraw()}});
 };redraw();
 dialog.querySelector('#template-list-import').onclick=()=>dialog.querySelector('#project-import-file').click();
 dialog.querySelector('#template-list-export').onclick=()=>{const projects=templateLibrary();if(!projects.length){alert('No saved projects to export.');return}download('DevDen-Templates-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'devden-template-library',version:1,projects},null,2),'application/json')};
 dialog.querySelector('#project-export').onclick=()=>download('DevDen-Project-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'devden-project',project:{name:'Current workspace',...projectSnapshot()}},null,2),'application/json');
 dialog.querySelector('#project-import').onclick=()=>dialog.querySelector('#project-import-file').click();
 dialog.querySelector('#project-import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>40*1024*1024)throw Error('Backup exceeds 40 MB');const parsed=JSON.parse(await file.text());const imports=parsed.format==='devden-template-library'&&Array.isArray(parsed.projects)?parsed.projects:parsed.format==='devden-project'&&parsed.project?[parsed.project]:[];if(!imports.length)throw Error('Not a DevDen project or template-library backup');if(imports.length>250)throw Error('Too many projects in backup');const validated=imports.map((entry,i)=>{if(!entry||typeof entry!=='object'||!entry.state||!entry.topology||!Array.isArray(entry.topology.devices)||!Array.isArray(entry.topology.links)||!Array.isArray(entry.topology.zones))throw Error('Invalid project in backup at position '+(i+1));return {...structuredClone(entry),id:'import-'+crypto.randomUUID(),name:String(entry.name||file.name).slice(0,80),version:2}});saveTemplateLibrary([...templateLibrary(),...validated]);redraw()}catch(error){alert('Cannot import backup: '+error.message)}e.target.value=''};
}
function showPDFExport(){toolkitDialog('Export documentation PDF',`<label class="toolkit-field">Document title<input id="pdf-title" value="Network documentation" maxlength="100"></label><div class="toolkit-export-choices"><label class="toolkit-check"><input type="checkbox" id="pdf-physical" checked>Physical topology</label><label class="toolkit-check"><input type="checkbox" id="pdf-logical" checked>Logical topology</label><label class="toolkit-check"><input type="checkbox" id="pdf-chart" checked>Network Chart</label></div>`,dialog=>{const physical=dialog.querySelector('#pdf-physical').checked,logical=dialog.querySelector('#pdf-logical').checked,chart=dialog.querySelector('#pdf-chart').checked;if(!physical&&!logical&&!chart)throw Error('Choose at least one section');const title=dialog.querySelector('#pdf-title').value.trim()||'Network documentation',pages=[];if(physical)pages.push(pdfTopologyPage('physical',title,pages.length+1));if(logical)pages.push(pdfTopologyPage('logical',title,pages.length+1));if(chart)pages.push(...pdfChartPages(title,pages.length));download((title.replace(/[^a-z0-9_-]+/gi,'-')||'Network-documentation')+'.pdf',makeDocumentationPDF(pages),'application/pdf')})}
function pdfHeader(canvas,title,section,page){const c=canvas.getContext('2d');c.fillStyle='#f7f8fa';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#23303b';c.font='600 30px Segoe UI, Arial, sans-serif';c.textAlign='left';c.fillText(title,40,50,canvas.width-80);c.font='20px Segoe UI, Arial, sans-serif';c.fillStyle='#596a79';c.fillText(section,40,84,canvas.width-80);c.font='16px Segoe UI, Arial, sans-serif';c.fillText('DevDen Networking Toolkit',40,canvas.height-24);c.textAlign='right';c.fillText(String(page),canvas.width-40,canvas.height-24);c.textAlign='left';return c}
function pdfTopologyPage(view,title,page){const source=topoExportPNG(view,true),canvas=document.createElement('canvas'),base=topoBounds(),items=[...topo.devices.map(d=>({x:d.x-80,y:d.y-60,w:160,h:120})),...topo.zones.map(z=>({x:z.x,y:z.y,w:z.w,h:z.h})),...topo.notes.filter(n=>n.scope==='both'||n.scope===view).map(n=>({x:n.x,y:n.y,w:n.w||270,h:n.h||120}))];const left=items.length?Math.max(base.left,Math.min(...items.map(i=>i.x))-35):base.left,top=items.length?Math.max(base.top,Math.min(...items.map(i=>i.y))-35):base.top,right=items.length?Math.min(base.right,Math.max(...items.map(i=>i.x+i.w))+35):base.right,bottom=items.length?Math.min(base.bottom,Math.max(...items.map(i=>i.y+i.h))+35):base.bottom,w=right-left,h=bottom-top;canvas.width=w>=h?1754:1240;canvas.height=w>=h?1240:1754;const c=pdfHeader(canvas,title,view==='physical'?'Physical topology':'Logical topology',page),scale=Math.min((canvas.width-80)/w,(canvas.height-150)/h);const sx=source.width/(base.right-base.left),sy=source.height/(base.bottom-base.top);c.drawImage(source,(left-base.left)*sx,(top-base.top)*sy,w*sx,h*sy,40+(canvas.width-80-w*scale)/2,112,w*scale,h*scale);return canvas}
function pdfChartPages(title,previousPages=0){const columns=topoMirrorColumns({sourceIds:chartData().subnets.map(s=>s.id)}),pages=[];if(!columns.length){const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;const c=pdfHeader(canvas,title,'Network Chart',previousPages+1);c.font='24px Segoe UI, Arial, sans-serif';c.fillText('No chart entries.',40,145);return[canvas]}for(let start=0;start<columns.length;start+=2){const batch=columns.slice(start,start+2),chunks=Math.max(1,...batch.map(col=>Math.ceil(col.rows.length/6)));for(let chunk=0;chunk<chunks;chunk++){const offset=chunk*6,cols=batch.map(col=>({...col,name:col.name+(chunk?' (continued)':''),rows:col.rows.slice(offset,offset+6).map(row=>({...row,parentIndex:row.parentIndex>=offset?row.parentIndex-offset:-1}))}));const layout={columns:cols,width:cols.length*220+(cols.length-1)*10,height:Math.max(170,...cols.map(col=>111+Math.max(1,col.rows.length)*76))};const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;const c=pdfHeader(canvas,title,'Network Chart',previousPages+pages.length+1);topoDrawMirrorPNG(c,{x:34,y:106,w:1172,h:1572},layout);pages.push(canvas)}}return pages}
function makeDocumentationPDF(canvases){if(!canvases.length)throw Error('No pages to export');const encode=text=>new TextEncoder().encode(text),parts=[],offsets=[0];let length=0;const append=value=>{const bytes=typeof value==='string'?encode(value):value;parts.push(bytes);length+=bytes.length};const object=(id,body)=>{offsets[id]=length;append(id+' 0 obj\n');if(Array.isArray(body))body.forEach(append);else append(body);append('\nendobj\n')};append('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Count '+canvases.length+' /Kids ['+canvases.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');canvases.forEach((canvas,index)=>{const id=3+index*3,landscape=canvas.width>=canvas.height,w=landscape?842:595,h=landscape?595:842;const raw=atob(canvas.toDataURL('image/jpeg',.95).split(',')[1]),jpeg=Uint8Array.from(raw,c=>c.charCodeAt(0));const stream=`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`);object(id+1,`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`);object(id+2,[`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream'])});const xref=length,count=3+canvases.length*3;append('xref\n0 '+count+'\n0000000000 65535 f \n');for(let i=1;i<count;i++)append(String(offsets[i]).padStart(10,'0')+' 00000 n \n');append('trailer\n<< /Size '+count+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');return new Blob(parts,{type:'application/pdf'})}
function initPortableTools(){if(!$('toolkit-offline')){const footer=$('sidebar').querySelector('footer');footer.className='app-footer';footer.innerHTML='<div class="footer-tools"><button id="toolkit-offline" title="Download offline copy with current setup" aria-label="Download offline copy">↓ <span>Offline copy</span></button><button id="toolkit-pdf" title="Export PDF" aria-label="Export PDF">▤ <span>PDF</span></button></div><button id="toolkit-templates" title="Saved projects and templates" aria-label="Templates">▧ <span>Templates</span></button>'}const brand=$('sidebar').querySelector('header b');brand.classList.add('brand-name');brand.innerHTML='<button type="button" class="brand-wordmark" id="admin-login-trigger" title="Admin Login" aria-label="Open Admin Login">DevDen</button><small>NETWORKING TOOLKIT</small>';$('toolkit-offline').onclick=showOfflineDownload;$('toolkit-templates').onclick=showTemplates;$('toolkit-pdf').onclick=showPDFExport}
initPortableTools();

function initGroupDock(){
 const toggle=$('group-toggle'),overlay=$('group-overlay'),close=$('group-close');
 if(!toggle||!overlay||!close)return;
 const setOpen=open=>{overlay.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.classList.toggle('opened',open)};
 toggle.addEventListener('click',()=>setOpen(overlay.hidden));
 close.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){e.preventDefault();setOpen(false);toggle.focus()}});
 document.addEventListener('pointerdown',e=>{if(!overlay.hidden&&!overlay.contains(e.target)&&!toggle.contains(e.target))setOpen(false)});
}
/* Groups are initialized by group.js. */


function toolkitStorageKey(key){return key+(window.DEVDEN_STORAGE_NAMESPACE?'-'+window.DEVDEN_STORAGE_NAMESPACE:'')}

document.addEventListener('mousedown',e=>{if(e.shiftKey&&!e.target.closest('input,textarea,[contenteditable="true"]')&&e.target.closest('button,nav,summary,#topo-board,.chart-move-handle,.column-resize-grip'))e.preventDefault()});
function renderPrefixGuide(){
 title('PREFIX GUIDE');
 content.insertAdjacentHTML('beforeend',`<div class="prefix-controls"><label>IPv4 prefix <select id="guide-prefix">${Array.from({length:33},(_,p)=>`<option value="${p}" ${p===26?'selected':''}>/${p}</option>`).join('')}</select></label><button id="guide-hide" aria-pressed="false">Hide answers</button></div><section id="prefix-detail" class="prefix-detail"></section><div class="prefix-ladder" id="prefix-ladder"></div>`);
 let hidden=false;
 const info=p=>{const total=2**(32-p),mask=ip4(p===0?0:(0xffffffff<<(32-p))>>>0);return {total,mask,hosts:p===32?1:p===31?2:total-2}};
 function paint(){const p=+$('guide-prefix').value,d=info(p),answer=v=>hidden?'•••':v.toLocaleString('en-US');
 $('prefix-detail').innerHTML=`<div class="prefix-hero">/${p}<span>${p} network bits · ${32-p} host bits</span></div><div class="prefix-stats"><div>Subnet mask<strong>${hidden?'•••':d.mask}</strong></div><div>Total addresses<strong>${answer(d.total)}</strong></div><div>Usable hosts<strong>${answer(d.hosts)}</strong></div></div><div class="prefix-bits" aria-label="${p} network bits and ${32-p} host bits">${Array.from({length:32},(_,i)=>`<span class="${i<p?'network':'host'} ${i%8===0?'octet':''}">${i<p?'1':'0'}</span>`).join('')}</div><p class="prefix-note">Green = network · amber = host. One more prefix bit halves the address count.${p===31?' /31 uses both addresses on point-to-point links.':p===32?' /32 identifies one host.':' Usable hosts = total − network − broadcast.'}</p>`;
 $('prefix-ladder').innerHTML=`<div class="prefix-row prefix-head"><span>Prefix</span><span>Subnet mask</span><span>Addresses</span><span>Usable</span><span>Share of /24</span></div>`+Array.from({length:9},(_,i)=>{const n=24+i,v=info(n);return `<button class="prefix-row ${p===n?'active':''}" data-prefix="${n}" aria-pressed="${p===n}"><strong>/${n}</strong><span>${hidden?'•••':v.mask}</span><span>${answer(v.total)}</span><span>${answer(v.hosts)}</span><span class="prefix-bar"><i style="width:${100/2**i}%"></i></span></button>`}).join('');
 $('prefix-ladder').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('guide-prefix').value=b.dataset.prefix;paint()});
 }
 $('guide-prefix').onchange=paint;$('guide-hide').onclick=()=>{hidden=!hidden;$('guide-hide').textContent=hidden?'Reveal answers':'Hide answers';$('guide-hide').setAttribute('aria-pressed',hidden);paint()};paint();
}
document.addEventListener('contextmenu',e=>{if(active==='topology'&&topoTool==='wire'&&e.target.closest('#topo-board')){e.preventDefault();topoConnecting=null;topoSetTool('select')}});
document.addEventListener('pointerdown',e=>{if(active!=='topology'||!e.target.closest('#topo-board')||e.target.closest('input:not([readonly]),textarea:not([readonly]),[contenteditable="true"]'))return;window.getSelection()?.removeAllRanges();if(e.target.matches('input[readonly],textarea[readonly]')){e.preventDefault();try{e.target.setSelectionRange(0,0)}catch{}}},true);
document.addEventListener('keydown',e=>{if(active==='topology'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!e.target.closest('input:not([readonly]),textarea:not([readonly]),[contenteditable="true"]')){e.preventDefault();topoSelection=['device','zone','note'].flatMap(kind=>topoList(kind).map(item=>({kind,id:item.id})));topoSelected=topoSelection[0]||null;topoPaintSelection();topoUpdateStatus()}});

function topoSnapAlignment(d,constrained,dx,dy){
 for(const axis of ['x','y']){if(constrained&&((axis==='x'&&dx===0)||(axis==='y'&&dy===0)))continue;let correction=null;for(const m of d.moving){const a=topoItemBounds({kind:m.kind,id:m.item.id});for(const kind of ['device','zone','note'])for(const item of topoList(kind)){if(topoContains(kind,item.id)||kind==='note'&&item.scope!=='both'&&item.scope!==topo.view)continue;const b=topoItemBounds({kind,id:item.id});for(let i=0;i<3;i++){const delta=b[axis][i]-a[axis][i];if(Math.abs(delta)<=6/topoZoom&&(correction===null||Math.abs(delta)<Math.abs(correction)))correction=delta}}}if(correction!==null)for(const m of d.moving)m.item[axis]+=correction;
 }
}

function update67Reaction(value){let reaction=$('ipv4-67-reaction');if(!reaction){if(value!==67)return;reaction=document.createElement('span');reaction.id='ipv4-67-reaction';reaction.setAttribute('role','status');reaction.innerHTML='<span>😂😂💀</span><img alt="Bosnov 67 reaction GIF" src="'+(window.DEVDEN_OFFLINE_SOURCE?.reaction67||'')+'">';content.querySelector('.toolbar,.workbench-controls')?.append(reaction)}reaction.hidden=value!==67}
