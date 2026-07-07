

/* ======================= IndexedDB ======================= */
let db;
function openDB(){return new Promise((res,rej)=>{
  const r=indexedDB.open('hypershelf',4);
  r.onupgradeneeded=e=>{const d=e.target.result;
    if(!d.objectStoreNames.contains('files'))d.createObjectStore('files',{keyPath:'id'});
    if(!d.objectStoreNames.contains('folders'))d.createObjectStore('folders',{keyPath:'name'});
    if(!d.objectStoreNames.contains('handles'))d.createObjectStore('handles',{keyPath:'id'});
    if(!d.objectStoreNames.contains('versions'))d.createObjectStore('versions',{keyPath:'vid'});
    if(!d.objectStoreNames.contains('drafts'))d.createObjectStore('drafts',{keyPath:'fileId'});};
  r.onsuccess=e=>{db=e.target.result;res()};r.onerror=()=>rej(r.error);})}
const idb={
  all:s=>new Promise((res,rej)=>{const q=db.transaction(s).objectStore(s).getAll();
    q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}),
  get:(s,k)=>new Promise((res,rej)=>{const q=db.transaction(s).objectStore(s).get(k);
    q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}),
  put:(s,v)=>new Promise((res,rej)=>{const q=db.transaction(s,'readwrite').objectStore(s).put(v);
    q.onsuccess=()=>res();q.onerror=()=>rej(q.error)}),
  del:(s,k)=>new Promise((res,rej)=>{const q=db.transaction(s,'readwrite').objectStore(s).delete(k);
    q.onsuccess=()=>res();q.onerror=()=>rej(q.error)}),
};


export { db, openDB, idb };
