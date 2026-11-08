'use strict';
/* Three-way merge of independent project edits. Does not silently overwrite
   concurrent changes to the same scalar field. Shared by browser and tests. */
(function(root){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const clone=x=>x===undefined?undefined:structuredClone(x);
 // Safely interleave two independent single-span edits to the same HTML page.
 // This is not a CRDT: complex concurrent formatting or overlapping edits remain conflicts.
 function mergeNoteHtml(base,ours,theirs){
  if(typeof base!=='string'||typeof ours!=='string'||typeof theirs!=='string')return null;
  const edit=(next)=>{let a=0;while(a<base.length&&a<next.length&&base[a]===next[a])a++;
   let b=base.length,n=next.length;while(b>a&&n>a&&base[b-1]===next[n-1]){b--;n--}
   return {start:a,end:b,replacement:next.slice(a,n)};};
  const a=edit(ours),b=edit(theirs);
  if(a.start===b.start&&a.end===b.end&&a.replacement===b.replacement)return ours;
  if(a.start===b.start&&a.end===a.start&&b.end===b.start){
   // Deterministic ordering after revision CAS: remote insertion first, then local.
   return base.slice(0,a.start)+b.replacement+a.replacement+base.slice(a.end);
  }
  const first=a.start<b.start?a:b,second=first===a?b:a;
  if(first.end>second.start)return null;
  return base.slice(0,first.start)+first.replacement+base.slice(first.end,second.start)+second.replacement+base.slice(second.end);
 }
 function reconcile(base,ours,theirs,path='',conflicts=[]){
  if(same(ours,theirs))return clone(ours);
  if(same(ours,base))return clone(theirs);
  if(same(theirs,base))return clone(ours);
  // Position-only collisions are intentionally cooperative. The server's
  // atomic move RPC serializes completed drags; its committed x/y wins.
  // Other fields keep ordinary three-way conflict protection.
  if(/^\/topology\/(devices|zones|notes)\/[^/]+\/(x|y)$/.test(path))return clone(theirs);
  if(path.endsWith('/html')){const joined=mergeNoteHtml(base,ours,theirs);if(joined!==null)return joined;}
  const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  if(plain(ours)&&plain(theirs)&&plain(base)){
   const result={};
   for(const key of new Set([...Object.keys(base),...Object.keys(ours),...Object.keys(theirs)])){
    const value=reconcile(base[key],ours[key],theirs[key],path+'/'+key,conflicts);
    if(value!==undefined)result[key]=value;
   }
   return result;
  }
  if(path.startsWith('/state/sketches/')&&base===undefined&&Array.isArray(ours)&&Array.isArray(theirs))base=[];
  const indexed=a=>Array.isArray(a)&&a.every(x=>plain(x)&&typeof x.id==='string');
  if(indexed(base)&&indexed(ours)&&indexed(theirs)){
   const b=new Map(base.map(x=>[x.id,x])),o=new Map(ours.map(x=>[x.id,x])),t=new Map(theirs.map(x=>[x.id,x]));
   const ids=[...new Set([...theirs.map(x=>x.id),...ours.map(x=>x.id)])];
   return ids.map(id=>reconcile(b.get(id),o.get(id),t.get(id),path+'/'+id,conflicts)).filter(x=>x!==undefined);
  }
  // An edit to the exact same field is not safely mergeable.
  conflicts.push(path||'/');return clone(theirs);
 }
 root.DevDenMerge={reconcile,same,mergeNoteHtml};
})(typeof window==='undefined'?globalThis:window);
