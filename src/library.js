import { $, debounce, esc, fmtDate, toast, uid } from './utils.js';
import { idb } from './db.js';
import { state } from './state.js';
import { renderDiskGrid, renderDiskSection } from './disk.js';
import { hideModal, showModal } from './ui.js';
import { openFile } from './editor.js';
import { shareFile } from './share.js';
import { WELCOME } from './welcome.js';
import { TEMPLATES } from './templates.js';

/* ======================= library rendering ======================= */
function visibleFiles(){
  const{folder,tag,q}=state.filter,ql=q.toLowerCase();
  return state.files.filter(f=>
    (folder===null||f.folder===folder)&&
    (tag===null||(f.tags||[]).includes(tag))&&
    (!q||f.name.toLowerCase().includes(ql)||(f.displayName||'').toLowerCase().includes(ql)))
    .sort((a,b)=>b.modified-a.modified);
}
function renderSidebar(){
  const fl=$('#folderList');
  const items=[{name:null,label:'All files',count:state.files.length},
    ...state.folders.map(fo=>({name:fo.name,label:fo.name,
      count:state.files.filter(f=>f.folder===fo.name).length}))];
  fl.innerHTML=items.map(it=>`
    <div class="navitem${!state.filter.disk&&state.filter.folder===it.name?' active':''}" data-folder="${it.name===null?'':esc(it.name)}" data-all="${it.name===null}">
      <span>${it.name===null?'🗂':'📁'}</span><span>${esc(it.label)}</span>
      ${it.name!==null?`<button class="del" title="Delete folder">✕</button>`:''}
      <span class="count">${it.count}</span>
    </div>`).join('');
  fl.querySelectorAll('.navitem').forEach(el=>{
    el.onclick=e=>{
      if(e.target.classList.contains('del')){deleteFolder(el.dataset.folder);return}
      state.filter.folder=el.dataset.all==='true'?null:el.dataset.folder;
      state.filter.disk=false;
      renderLibrary();};
  });
  renderDiskSection();
  const tags=[...new Set(state.files.flatMap(f=>f.tags||[]))].sort();
  $('#tagChips').innerHTML=tags.length?tags.map(t=>
    `<span class="chip${state.filter.tag===t?' active':''}" data-tag="${esc(t)}">${esc(t)}</span>`).join('')
    :'<span style="color:var(--muted);font-size:12px">No tags yet</span>';
  $('#tagChips').querySelectorAll('.chip').forEach(ch=>ch.onclick=()=>{
    state.filter.tag=state.filter.tag===ch.dataset.tag?null:ch.dataset.tag;
    state.filter.disk=false;renderLibrary()});
}
let thumbObserver;
function renderGrid(){
  if(state.filter.disk){renderDiskGrid();return}
  const files=visibleFiles(),grid=$('#grid');
  $('#libTitle').textContent=state.filter.folder??'All files';
  $('#libCount').textContent=files.length+(files.length===1?' file':' files')+
    (state.filter.tag?` · tag: ${state.filter.tag}`:'');
  if(!files.length){
    grid.innerHTML=`<div class="empty"><div class="big">📄</div>
      ${state.files.length?'Nothing matches this filter.':
        `Your shelf is empty.<br>Click <b>＋ New</b>, <b>Upload</b>, or just drag &amp; drop .html files here.<br>
         <button class="primary" id="btnWelcome2" style="margin-top:16px">📚 Add the Welcome playground</button><br>
         <span style="font-size:12px">A guided page that walks you through every editor feature.</span>`}</div>`;
    if($('#btnWelcome2'))$('#btnWelcome2').onclick=addWelcomeFile;
    return;}
  grid.innerHTML=files.map(f=>`
    <div class="card" data-id="${f.id}">
      <div class="thumb"><div class="ph">‹/›</div></div>
      <div class="card-info">
        <div class="row1"><span class="fname" title="${esc(f.name)}">${esc(f.displayName||f.name)}</span>
          <button class="menu-btn" title="Actions">⋮</button></div>
        <div class="fmeta">${f.displayName?`<span class="subname">${esc(f.name)}</span>`:''}<span>${fmtDate(f.modified)}</span>
          ${f.folder?`<span>📁 ${esc(f.folder)}</span>`:''}</div>
        ${(f.tags||[]).length?`<div class="fmeta">${f.tags.map(t=>`<span class="tagpill">${esc(t)}</span>`).join('')}</div>`:''}
      </div>
    </div>`).join('');
  if(thumbObserver)thumbObserver.disconnect();
  thumbObserver=new IntersectionObserver(entries=>{
    for(const en of entries){
      if(!en.isIntersecting)continue;
      thumbObserver.unobserve(en.target);
      const f=state.files.find(x=>x.id===en.target.dataset.id);
      if(!f)continue;
      const ifr=document.createElement('iframe');
      ifr.setAttribute('sandbox','');ifr.loading='lazy';
      ifr.srcdoc=f.html;
      const th=en.target.querySelector('.thumb');
      th.innerHTML='';th.appendChild(ifr);
    }},{root:grid,rootMargin:'200px'});
  grid.querySelectorAll('.card').forEach(card=>{
    thumbObserver.observe(card);
    card.onclick=e=>{
      if(e.target.classList.contains('menu-btn')){openCardMenu(e.target,card.dataset.id);return}
      openFile(card.dataset.id);};
  });
}
function renderLibrary(){renderSidebar();renderGrid()}

/* ======================= card menu ======================= */
let openMenu=null;
function setOpenMenu(m){openMenu=m}
function closeMenu(){if(openMenu){openMenu.remove();openMenu=null}}
document.addEventListener('click',e=>{if(openMenu&&!openMenu.contains(e.target)&&!e.target.classList.contains('menu-btn'))closeMenu()},true);
function openCardMenu(btn,id){
  closeMenu();
  const f=state.files.find(x=>x.id===id);if(!f)return;
  const m=document.createElement('div');m.className='dropdown';
  m.innerHTML=`
    <button data-a="open">Open</button>
    <button data-a="rename">Name / display name…</button>
    <button data-a="move">Move to folder…</button>
    <button data-a="tags">Edit tags…</button>
    <button data-a="dup">Duplicate</button>
    <button data-a="share">Copy share link</button>
    <button data-a="dl">Download</button>
    <button data-a="del" class="danger">Delete</button>`;
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect();
  m.style.left=Math.min(r.left,innerWidth-180)+'px';m.style.top=(r.bottom+4)+'px';
  openMenu=m;
  m.onclick=async e=>{
    const a=e.target.dataset.a;if(!a)return;closeMenu();
    if(a==='open')openFile(id);
    if(a==='rename')renameDialog(f);
    if(a==='move')moveDialog(f);
    if(a==='tags')tagDialog(f);
    if(a==='dup'){const c={...f,id:uid(),name:f.name.replace(/(\.html?)?$/i,' copy$1'),
      created:Date.now(),modified:Date.now()};
      state.files.push(c);await idb.put('files',c);renderLibrary();toast('Duplicated')}
    if(a==='share')shareFile(f.name,f.html);
    if(a==='dl')downloadFile(f);
    if(a==='del'&&confirm(`Delete "${f.name}"? This can't be undone.`)){
      state.files=state.files.filter(x=>x.id!==id);await idb.del('files',id);
      try{for(const v of(await idb.all('versions')).filter(v=>v.fileId===id))await idb.del('versions',v.vid)}catch{}
      try{await idb.del('drafts',id)}catch{}
      renderLibrary();toast('Deleted')}
  };
}
function renameDialog(f){
  showModal(`<h3>Name</h3>
    <div class="mrow"><label>Display</label>
      <input type="text" id="rnDisp" value="${esc(f.displayName||'')}" placeholder="optional — shown instead of the file name"></div>
    <div class="mrow"><label>File name</label><input type="text" id="rnFile" value="${esc(f.name)}"></div>
    <div class="mbtns"><button id="mCancel">Cancel</button><button class="primary" id="mOk">Save</button></div>`);
  $('#rnDisp').focus();
  $('#mCancel').onclick=hideModal;
  $('#mOk').onclick=async()=>{
    const d=$('#rnDisp').value.trim(),n=$('#rnFile').value.trim();
    f.displayName=d||null;
    if(n)f.name=normalizeName(n);
    f.modified=Date.now();
    await idb.put('files',f);hideModal();renderLibrary();};
}
function tagDialog(f){
  let tags=[...(f.tags||[])];
  const all=[...new Set(state.files.flatMap(x=>x.tags||[]))].sort();
  showModal(`<h3>Tags — ${esc(f.displayName||f.name)}</h3>
    <div class="tagbox" id="tagBox"></div>
    <div class="chips" id="tagSugg"></div>
    <div class="mbtns"><button id="mCancel">Cancel</button><button class="primary" id="mOk">Save</button></div>`);
  function add(v){v=v.trim().replace(/,+$/,'');if(v&&!tags.includes(v))tags.push(v);draw()}
  function draw(){
    $('#tagBox').innerHTML=tags.map(t=>
      `<span class="tchip">${esc(t)}<button data-t="${esc(t)}" title="Remove">✕</button></span>`).join('')+
      `<input type="text" id="tagIn" placeholder="${tags.length?'add…':'type a tag, press Enter'}">`;
    $('#tagBox').querySelectorAll('.tchip button').forEach(b=>
      b.onclick=()=>{tags=tags.filter(t=>t!==b.dataset.t);draw()});
    const inp=$('#tagIn');inp.focus();
    inp.onkeydown=e=>{
      if(e.key==='Enter'||e.key===','){e.preventDefault();add(inp.value)}
      else if(e.key==='Backspace'&&!inp.value&&tags.length){tags.pop();draw()}};
    const sugg=all.filter(t=>!tags.includes(t));
    $('#tagSugg').innerHTML=sugg.map(t=>`<span class="chip" data-t="${esc(t)}">＋ ${esc(t)}</span>`).join('');
    $('#tagSugg').querySelectorAll('.chip').forEach(c=>c.onclick=()=>add(c.dataset.t));
  }
  draw();
  $('#mCancel').onclick=hideModal;
  $('#mOk').onclick=async()=>{
    const pending=$('#tagIn').value.trim();if(pending&&!tags.includes(pending))tags.push(pending);
    f.tags=tags;f.modified=Date.now();
    await idb.put('files',f);hideModal();renderLibrary();};
}
function moveDialog(f){
  showModal(`<h3>Move "${esc(f.displayName||f.name)}"</h3>
    <div class="mrow"><label>Folder</label><select id="mvSel">
      <option value="">(no folder)</option>
      ${state.folders.map(fo=>`<option ${f.folder===fo.name?'selected':''} value="${esc(fo.name)}">${esc(fo.name)}</option>`).join('')}
    </select></div>
    <div class="mbtns"><button id="mCancel">Cancel</button><button class="primary" id="mOk">Move</button></div>`);
  $('#mOk').onclick=async()=>{f.folder=$('#mvSel').value||null;f.modified=Date.now();
    await idb.put('files',f);hideModal();renderLibrary()};
  $('#mCancel').onclick=hideModal;
}
async function deleteFolder(name){
  if(!confirm(`Delete folder "${name}"? Files inside are kept (moved to no folder).`))return;
  state.folders=state.folders.filter(fo=>fo.name!==name);
  await idb.del('folders',name);
  for(const f of state.files.filter(f=>f.folder===name)){f.folder=null;await idb.put('files',f)}
  if(state.filter.folder===name)state.filter.folder=null;
  renderLibrary();
}

/* ======================= import / create ======================= */
function normalizeName(n){return /\.html?$/i.test(n)?n:n+'.html'}
async function addFile(name,html,extras={}){
  const f={id:uid(),name:normalizeName(name),folder:state.filter.disk?null:(state.filter.folder??null),
    tags:[],html,created:Date.now(),modified:Date.now(),...extras};
  state.files.push(f);await idb.put('files',f);return f;
}
const BLANK=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Untitled</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:60px auto;padding:0 24px;line-height:1.6;color:#1b1f27}
  h1{color:#1786c9}
</style>
</head>
<body>
<h1>Untitled</h1>
<p>Start writing…</p>
</body>
</html>`;
/* ＋ New: template gallery — pick a real starting point, not just a blank page */
$('#btnNew').onclick=()=>{
  showModal(`<h3>New file</h3>
    <div class="mrow"><label>Name</label><input type="text" id="tplName" value="Untitled.html"></div>
    <div class="tplgrid">${TEMPLATES.map(t=>`
      <button class="tpl" data-tpl="${t.id}">
        <span class="tplic">${t.emoji}</span><b>${esc(t.name)}</b>
        <span class="tpld">${esc(t.desc)}</span>
      </button>`).join('')}</div>
    <div class="mbtns"><button id="mCancel">Cancel</button></div>`);
  $('#tplName').focus();$('#tplName').select();
  $('#mCancel').onclick=hideModal;
  $('#modal').querySelectorAll('.tpl').forEach(b=>b.onclick=async()=>{
    const t=TEMPLATES.find(x=>x.id===b.dataset.tpl);
    const name=$('#tplName').value.trim()||'Untitled.html';
    hideModal();
    const f=await addFile(name,t.html,t.tags?{tags:[...t.tags]}:{});
    state.filter.disk=false;
    renderLibrary();openFile(f.id);
  });
};
/* drop a fresh copy of the interactive Welcome playground onto the shelf */
async function addWelcomeFile(){
  const f=await addFile('Welcome to Hypershelf.html',WELCOME,{tags:['guide']});
  state.filter.disk=false;state.filter.folder=null;state.filter.tag=null;
  renderLibrary();openFile(f.id);
  toast('Added the Welcome playground');
}
$('#btnWelcome').onclick=addWelcomeFile;
$('#btnUpload').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=e=>{importFileList(e.target.files);e.target.value=''};
async function importFileList(list){
  let n=0;
  for(const file of list){
    if(!/\.(html?|txt)$/i.test(file.name))continue;
    const text=await file.text();
    await addFile(file.name.replace(/\.txt$/i,'.html'),text);n++;
  }
  state.filter.disk=false;
  renderLibrary();toast(n?`Imported ${n} file${n>1?'s':''}`:'No .html files found');
}
$('#btnPaste').onclick=()=>{
  showModal(`<h3>Paste HTML</h3>
    <div class="mrow"><label>Name</label><input type="text" id="pName" value="Pasted.html"></div>
    <textarea id="pHtml" placeholder="&lt;!DOCTYPE html&gt;…"></textarea>
    <div class="mbtns"><button id="mCancel">Cancel</button><button class="primary" id="mOk">Add to shelf</button></div>`);
  $('#pHtml').focus();
  $('#mCancel').onclick=hideModal;
  $('#mOk').onclick=async()=>{
    const html=$('#pHtml').value;if(!html.trim()){toast('Nothing to add');return}
    const f=await addFile($('#pName').value||'Pasted.html',html);
    hideModal();state.filter.disk=false;renderLibrary();openFile(f.id)};
};
$('#btnNewFolder').onclick=async()=>{
  const n=prompt('Folder name:');if(!n||!n.trim())return;
  const name=n.trim();
  if(!state.folders.some(f=>f.name===name)){state.folders.push({name});await idb.put('folders',{name})}
  renderLibrary();
};
/* drag & drop */
const grid=$('#grid');
['dragover','dragenter'].forEach(ev=>grid.addEventListener(ev,e=>{e.preventDefault();grid.classList.add('dragover')}));
['dragleave','drop'].forEach(ev=>grid.addEventListener(ev,e=>{e.preventDefault();grid.classList.remove('dragover')}));
grid.addEventListener('drop',e=>{if(e.dataTransfer.files.length)importFileList(e.dataTransfer.files)});

/* ======================= export / backup ======================= */
function downloadBlob(name,blob){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
function downloadFile(f){downloadBlob(f.name,new Blob([f.html],{type:'text/html'}))}
$('#btnExportLib').onclick=()=>{
  downloadBlob(`hypershelf-backup-${new Date().toISOString().slice(0,10)}.json`,
    new Blob([JSON.stringify({app:'hypershelf',version:1,exported:Date.now(),
      folders:state.folders,files:state.files},null,1)],{type:'application/json'}));
  toast('Backup downloaded');};
$('#btnImportLib').onclick=()=>$('#libInput').click();
$('#libInput').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(data.app!=='hypershelf'||!Array.isArray(data.files))throw 0;
    let n=0;
    for(const fo of data.folders||[])if(!state.folders.some(x=>x.name===fo.name)){
      state.folders.push(fo);await idb.put('folders',fo)}
    for(const f of data.files){
      if(state.files.some(x=>x.id===f.id))f.id=uid();
      state.files.push(f);await idb.put('files',f);n++;}
    renderLibrary();toast(`Restored ${n} files`);
  }catch{toast('Not a valid Hypershelf backup')}
};

/* ======================= search ======================= */
$('#searchBox').oninput=debounce(e=>{state.filter.q=e.target.value;renderGrid()},150);


export { visibleFiles, renderSidebar, thumbObserver, renderGrid, renderLibrary, openMenu, setOpenMenu, closeMenu, openCardMenu, renameDialog, tagDialog, moveDialog, deleteFolder, normalizeName, addFile, BLANK, importFileList, grid, downloadBlob, downloadFile };
