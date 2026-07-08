import { $, esc, fmtDate, toast, uid } from './utils.js';
import { idb } from './db.js';
import { state } from './state.js';
import { addFile, closeMenu, downloadBlob, grid, renderLibrary, setOpenMenu } from './library.js';
import { offerDraftRecovery, renderFrame, setDirty, updateModeUI } from './editor.js';
import { histInit } from './history.js';
import { closeThemePanel } from './colors.js';

/* ======================= disk folders (File System Access) ======================= */
/* multiple folders can be connected at once — each is {id,handle,name,files,needsPerm} */
function activeDisk(){return state.disks.find(d=>d.id===state.filter.disk)||null}
function renderDiskSection(){
  const el=$('#diskSection');
  if(!window.showDirectoryPicker){
    el.innerHTML='<div style="color:var(--muted);font-size:12px;padding:0 4px">Direct folder access needs Chrome or Edge.</div>';return}
  el.innerHTML=
    state.disks.map(d=>`
    <div class="navitem${state.filter.disk===d.id?' active':''}" data-disk-id="${d.id}" title="${d.needsPerm?'Click to reconnect':'Files edited here save straight to disk'}">
      <span>💻</span><span>${esc(d.name)}${d.needsPerm?' ⚠':''}</span>
      <button class="del" data-x="1" title="Disconnect folder">✕</button>
      <span class="count">${d.needsPerm?'':d.files.length}</span>
    </div>`).join('')+
    `<button class="ghost" id="btnOpenFolder" style="text-align:left${state.disks.length?';font-size:11px':''}">📂 ${state.disks.length?'Add another folder…':'Open folder…'}</button>`+
    (activeDisk()&&!activeDisk().needsPerm?`
    <button class="ghost" id="btnRefreshDisk" style="text-align:left;font-size:11px">↻ Refresh list</button>
    <button class="ghost" id="btnExample" style="text-align:left;font-size:11px" title="Writes a small multi-file demo site (html + css + js) into this folder">⊕ Create example site</button>`:'');
  $('#btnOpenFolder').onclick=connectFolder;
  el.querySelectorAll('.navitem').forEach(nav=>{
    nav.onclick=async e=>{
      const d=state.disks.find(x=>x.id===nav.dataset.diskId);if(!d)return;
      if(e.target.dataset.x){disconnectFolder(d.id);return}
      if(d.needsPerm){
        try{
          const p=await d.handle.requestPermission({mode:'readwrite'});
          if(p!=='granted')return toast('Folder access was denied');
          d.needsPerm=false;await listDisk(d);
        }catch{return toast('Could not reconnect to the folder')}
      }
      state.filter.disk=d.id;state.filter.folder=null;state.filter.tag=null;renderLibrary();
    };
  });
  const rf=$('#btnRefreshDisk');
  if(rf)rf.onclick=async()=>{const d=activeDisk();if(d)await listDisk(d);renderLibrary()};
  const ex=$('#btnExample');
  if(ex)ex.onclick=()=>{const d=activeDisk();if(d)createExampleSite(d)};
}
async function connectFolder(){
  try{
    const handle=await showDirectoryPicker({mode:'readwrite'});
    /* already connected? just switch to it */
    for(const d of state.disks){
      try{if(await d.handle.isSameEntry(handle)){
        state.filter.disk=d.id;state.filter.folder=null;state.filter.tag=null;
        renderLibrary();return d;
      }}catch{}
    }
    const d={id:uid(),handle,name:handle.name,files:[],needsPerm:false};
    state.disks.push(d);
    try{await idb.put('handles',{id:d.id,handle})}catch{}
    await listDisk(d);
    state.filter.disk=d.id;state.filter.folder=null;state.filter.tag=null;
    renderLibrary();
    return d;
  }catch{return null/* user cancelled the picker */}
}
async function listDisk(d){
  if(!d||!d.handle)return;
  d.files=[];
  try{
    async function walk(dir,prefix,depth){
      for await(const h of dir.values()){
        if(h.kind==='file'&&/\.html?$/i.test(h.name))d.files.push({name:prefix+h.name,handle:h});
        else if(h.kind==='directory'&&depth<3&&!/^(node_modules|\.git|\.next|dist|build|\.vercel)$/i.test(h.name))
          await walk(h,prefix+h.name+'/',depth+1);
      }
    }
    await walk(d.handle,'',0);
    d.files.sort((a,b)=>a.name.localeCompare(b.name));
  }catch{toast('Could not read the folder')}
}

/* ---------- multi-file projects: bundle linked css/js so the whole editor works on them ---------- */
function resolveRel(base,ref){ /* → folder-relative path, or null for external/unreachable */
  if(!ref||/^(https?:)?\/\/|^[a-z]+:|^#|^\//i.test(ref))return null;
  const parts=base?base.split('/'):[];
  for(const s of ref.split('/')){
    if(s==='.'||s==='')continue;
    if(s==='..'){if(!parts.length)return null;parts.pop()}
    else parts.push(s);
  }
  return parts.join('/')||null;
}
async function getFileByPath(root,path,create){
  const parts=path.split('/'),file=parts.pop();
  let dir=root;
  for(const p of parts)dir=await dir.getDirectoryHandle(p,{create:!!create});
  return dir.getFileHandle(file,{create:!!create});
}
const attrVal=(tag,name)=>{
  const m=tag.match(new RegExp(name+'\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));
  return m?(m[2]??m[3]??m[4]):null;
};
/* replace <link rel=stylesheet> and external <script src> with inline blocks tagged data-hs-src */
async function bundleDiskHtml(root,relPath,raw,opts={}){
  const base=relPath.includes('/')?relPath.slice(0,relPath.lastIndexOf('/')):'';
  const assets={},warns=[];
  let html=raw;
  for(const tag of [...raw.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0])){
    if(!/rel\s*=\s*["']?stylesheet/i.test(tag))continue;
    const ref=(attrVal(tag,'href')||'').split(/[?#]/)[0];
    const path=resolveRel(base,ref);if(!path)continue;
    try{
      const text=await(await(await getFileByPath(root,path)).getFile()).text();
      assets[path]={origTag:tag,kind:'css',orig:text};
      html=html.replace(tag,`<style data-hs-src="${path}">\n${text}\n</style>`);
    }catch{warns.push(ref)}
  }
  if(opts.withScripts!==false){
    for(const tag of [...raw.matchAll(/<script\b[^>]*\bsrc\s*=\s*[^>]*>\s*<\/script>/gi)].map(x=>x[0])){
      const ref=(attrVal(tag,'src')||'').split(/[?#]/)[0];
      const path=resolveRel(base,ref);if(!path)continue;
      try{
        const text=await(await(await getFileByPath(root,path)).getFile()).text();
        assets[path]={origTag:tag,kind:'js',orig:text};
        const open=tag.match(/<script\b[^>]*?>/i)[0]
          .replace(/\ssrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i,'')
          .replace(/>$/,` data-hs-src="${path}">`);
        html=html.replace(tag,open+'\n'+text.replace(/<\/script/gi,'<\\/script')+'\n</'+'script>');
      }catch{warns.push(ref)}
    }
  }
  return{html,assets,warns,base};
}
/* images/fonts referenced with relative paths → data URIs, used at RENDER time only
   (the working document keeps the original paths, so files stay clean) */
async function preloadDiskAssets(root,base,html){
  const cache=new Map(),refs=new Set();
  for(const m of html.matchAll(/<(?:img|source|audio|video)\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi))refs.add(m[2]??m[3]??m[4]);
  for(const m of html.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi))refs.add(m[1]);
  for(const ref of refs){
    const clean=ref.split(/[?#]/)[0];
    const path=resolveRel(base,clean);
    if(!path||cache.has(ref))continue;
    if(!/\.(png|jpe?g|gif|webp|svg|ico|bmp|avif|woff2?|ttf|otf|mp3|mp4|webm)$/i.test(path))continue;
    try{
      const f=await(await getFileByPath(root,path)).getFile();
      if(f.size>3*1024*1024)continue;
      cache.set(ref,await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)}));
    }catch{}
  }
  return cache;
}
function applyAssetCache(html){
  const cache=state.cur&&state.cur.assetCache;
  if(!cache||!cache.size)return html;
  for(const[ref,uri]of cache){
    const e=ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html=html.replace(new RegExp('(src\\s*=\\s*["\'])'+e+'(["\'])','gi'),'$1'+uri+'$2');
    html=html.replace(new RegExp('(url\\(\\s*["\']?)'+e+'(["\']?\\s*\\))','gi'),'$1'+uri+'$2');
  }
  return html;
}
/* Save for disk projects: css/js blocks → their own files (only if changed), tags restored in the html */
async function saveDiskProject(cur,html){
  const root=cur.root,assets=cur.assets||{},writes=[];
  html=html.replace(/<style\b[^>]*\bdata-hs-src="([^"]+)"[^>]*>\n?([\s\S]*?)\n?<\/style>/gi,(m,path,css)=>{
    writes.push({path,text:css});
    return(assets[path]&&assets[path].origTag)||`<link rel="stylesheet" href="${path}">`;
  });
  html=html.replace(/<script\b[^>]*\bdata-hs-src="([^"]+)"[^>]*>\n?([\s\S]*?)\n?<\/script>/gi,(m,path,js)=>{
    writes.push({path,text:js.replace(/<\\\/script/g,'</'+'script')});
    return(assets[path]&&assets[path].origTag)||`<script src="${path}"></`+`script>`;
  });
  let n=0;
  for(const item of writes){
    if(assets[item.path]&&assets[item.path].orig===item.text)continue;
    const fh=await getFileByPath(root,item.path,true);
    const w=await fh.createWritable();await w.write(item.text);await w.close();
    (assets[item.path]||(assets[item.path]={kind:'css'})).orig=item.text;
    n++;
  }
  const w=await cur.handle.createWritable();await w.write(html);await w.close();
  return n+1;
}

/* ---------- built-in example site (shows off multi-file editing) ---------- */
const DEMO_FILES={
'hypershelf-example/index.html':`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aurora Coffee — Hypershelf example site</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<header>
  <img src="images/logo.svg" alt="Aurora Coffee logo" class="logo">
  <nav><a href="#">Menu</a><a href="#">Story</a><a href="#">Visit</a></nav>
</header>

<section class="howto">
  <span class="chip">✎ Edit mode: click anything to restyle it</span>
  <span class="chip">↔ drag a selected card to reorder</span>
  <span class="chip">◢ resize the banner by its handles</span>
  <span class="chip">🎨 Colors reskins every file at once</span>
</section>

<main>
  <section class="hero">
    <h1>Aurora Coffee</h1>
    <p class="tag">Small-batch roasts, big ideas.</p>
    <button id="cta">Order a cup ☕</button>
    <p class="clock">Roastery time: <span id="clock">--:--:--</span> — ticking proof that <b>js/app.js</b> is running (Interact mode).</p>
  </section>

  <section class="cards">
    <div class="card"><h2>Ember</h2><p>Dark roast with cocoa depth and a slow, warm finish.</p><span class="price">$4</span></div>
    <div class="card"><h2>Drift</h2><p>Smooth medium roast, honey sweetness, zero bitterness.</p><span class="price">$5</span></div>
    <div class="card"><h2>Polar</h2><p>Flash-chilled and bright, with citrus high notes.</p><span class="price">$6</span></div>
  </section>
  <p class="note">☝ These three share the class <b>.card</b> — select one, set "Apply style edits to: <b>all .card (3)</b>", and one edit styles all of them. On Save the rule lands in <b>css/style.css</b>.</p>

  <section class="banner">◢ Select this banner and drag its corner handle to resize it — then try a <b>glow</b> shadow from the Border &amp; effects section.</section>
</main>

<footer>This site is Hypershelf's multi-file example: the page is <b>index.html</b>, its look lives in <b>css/style.css</b>, its behavior in <b>js/app.js</b>. Edit anything, hit Save once — every change is written back to the right file.</footer>
<script src="js/app.js"><\/script>
</body>
</html>`,
'hypershelf-example/css/style.css':`/* ====================================================================
   Aurora Coffee — css/style.css (a real separate file)
   Hypershelf bundles this into the editor, so everything here can be
   edited visually:
   · open 🎨 Colors — every color below becomes a swatch, and the TWO
     font-family stacks (headings vs body) appear as editable font rows
   · "apply to all similar" edits are appended here as rules on Save
   ==================================================================== */

:root { color-scheme: dark; }

body {
  margin: 0;
  background: #171310;
  color: #f3e9dc;
  font-family: Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', sans-serif;
  line-height: 1.6;
}
h1, h2 {
  font-family: Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', serif;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  border-bottom: 1px solid #3a2c22;
}
.logo { width: 44px; height: 44px; }
nav a {
  color: #cbb59e;
  text-decoration: none;
  margin-left: 22px;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
nav a:hover { color: #e08e45; }

/* the "how to play" strip */
.howto {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 12px 20px;
  background: #0d0c0a;
  border-bottom: 1px solid #2c241d;
}
.chip {
  border: 1px solid #3a2c22;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 12.5px;
  color: #cbb59e;
}

.hero {
  text-align: center;
  padding: 64px 24px 44px;
  background: radial-gradient(circle at 50% 120%, rgba(224, 142, 69, 0.25), transparent 65%);
}
.hero h1 {
  margin: 0 0 10px;
  font-size: 52px;
  color: #e08e45;
  letter-spacing: 0.04em;
}
.hero .tag {
  margin: 0 0 26px;
  color: #cbb59e;
  font-style: italic;
  font-size: 19px;
}
#cta {
  background: #e08e45;
  color: #241505;
  border: none;
  border-radius: 999px;
  padding: 13px 30px;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.15s;
}
#cta:hover { transform: scale(1.05); }
.clock { font-size: 13px; color: #8a7461; margin: 20px 0 0; }
.clock b { color: #cbb59e; }
#clock { color: #7fb069; font-weight: bold; }

.cards {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  padding: 26px 24px 4px;
}
.card {
  background: #241d16;
  border: 1px solid #3a2c22;
  border-radius: 14px;
  padding: 20px 22px;
  width: 230px;
}
.card h2 { margin: 0 0 8px; color: #7fb069; font-size: 22px; }
.card p { margin: 0 0 14px; color: #cbb59e; font-size: 14.5px; }
.card .price {
  color: #e08e45;
  font-weight: bold;
  font-size: 18px;
}
.note {
  max-width: 640px;
  margin: 8px auto 0;
  padding: 0 24px;
  text-align: center;
  font-size: 13px;
  color: #8a7461;
}
.note b { color: #e08e45; }

.banner {
  max-width: 560px;
  margin: 30px auto 40px;
  background: linear-gradient(135deg, #2a1c10, #171310);
  border: 1px dashed #e08e45;
  border-radius: 14px;
  padding: 26px 30px;
  text-align: center;
  color: #cbb59e;
}
.banner b { color: #e08e45; }

footer {
  text-align: center;
  color: #8a7461;
  font-size: 13px;
  padding: 20px 24px;
  border-top: 1px solid #3a2c22;
}
footer b { color: #cbb59e; }`,
'hypershelf-example/js/app.js':`// ====================================================================
// Aurora Coffee — js/app.js (a real separate file)
// It runs live in 🖱 Interact mode; ✎ Edit mode pauses it so the page
// holds still while you restyle it. Edits made to this block in the
// ‹/› Code panel are written back to js/app.js on Save.
// ====================================================================

const btn = document.getElementById('cta');
let orders = 0;
btn.addEventListener('click', () => {
  orders++;
  btn.textContent = orders + (orders === 1 ? ' cup' : ' cups') + ' coming up ☕';
});

// live clock — visible proof the script file is running
const clock = document.getElementById('clock');
function tick(){ clock.textContent = new Date().toLocaleTimeString(); }
tick();
setInterval(tick, 1000);

// gentle entrance for the menu cards
document.querySelectorAll('.card').forEach((card, i) => {
  card.style.opacity = 0;
  card.style.transform = 'translateY(14px)';
  setTimeout(() => {
    card.style.transition = 'opacity 0.5s, transform 0.5s';
    card.style.opacity = 1;
    card.style.transform = 'none';
  }, 250 + i * 160);
});`,
'hypershelf-example/images/logo.svg':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#261d17" stroke="#e08e45" stroke-width="3"/>
  <path d="M20 26h20v12a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="#e08e45"/>
  <path d="M40 28h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#e08e45" stroke-width="3"/>
  <path d="M25 20c0-3 2-3 2-6M31 20c0-3 2-3 2-6" stroke="#cbb59e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`
};
async function createExampleSite(d){
  d=d||activeDisk();
  if(!d||!d.handle)return;
  try{
    for(const[path,text]of Object.entries(DEMO_FILES)){
      const fh=await getFileByPath(d.handle,path,true);
      const w=await fh.createWritable();await w.write(text);await w.close();
    }
    await listDisk(d);renderLibrary();
    toast('Example site created — open hypershelf-example/index.html');
  }catch(err){toast('Could not create the example: '+err.message)}
}
async function disconnectFolder(id){
  state.disks=state.disks.filter(d=>d.id!==id);
  if(state.filter.disk===id)state.filter.disk=false;
  try{await idb.del('handles',id)}catch{}
  renderLibrary();
}
let diskThumbObserver;
function renderDiskGrid(){
  const d=activeDisk();
  if(!d){state.filter.disk=false;renderLibrary();return}
  const q=state.filter.q.toLowerCase();
  const files=d.files.filter(f=>!q||f.name.toLowerCase().includes(q));
  $('#libTitle').textContent='💻 '+d.name;
  $('#libCount').textContent=files.length+(files.length===1?' file':' files')+' on disk — edits save directly to the real files';
  const grid=$('#grid');
  if(!files.length){
    grid.innerHTML=`<div class="empty"><div class="big">💻</div>No .html files in this folder.<br>
      <button class="primary" id="btnExample2" style="margin-top:16px">⊕ Create an example site here</button><br>
      <span style="font-size:12px">Writes a small demo (html + css + js in separate files) so you can try multi-file editing.</span></div>`;
    $('#btnExample2').onclick=()=>createExampleSite(d);
    return}
  /* disk view keeps its own thumbnail observer (the library grid has one too) */
  grid.innerHTML=files.map((f,i)=>`
    <div class="card" data-disk="${i}">
      <div class="thumb"><div class="ph">‹/›</div></div>
      <div class="card-info">
        <div class="row1"><span class="fname" title="${esc(f.name)}">${esc(f.name)}</span>
          <button class="menu-btn" title="Actions">⋮</button></div>
        <div class="fmeta"><span class="fdate">on disk</span></div>
      </div>
    </div>`).join('');
  if(diskThumbObserver)diskThumbObserver.disconnect();
  diskThumbObserver=new IntersectionObserver(entries=>{
    for(const en of entries){
      if(!en.isIntersecting)continue;
      diskThumbObserver.unobserve(en.target);
      const f=files[+en.target.dataset.disk];if(!f)continue;
      (async()=>{try{
        const file=await f.handle.getFile();
        en.target.querySelector('.fdate').textContent=fmtDate(file.lastModified);
        let src=await file.text();
        /* thumbnails get the linked css too (scripts never run in thumbs) */
        try{src=(await bundleDiskHtml(d.handle,f.name,src,{withScripts:false})).html}catch{}
        const ifr=document.createElement('iframe');
        ifr.setAttribute('sandbox','');ifr.loading='lazy';ifr.srcdoc=src;
        const th=en.target.querySelector('.thumb');th.innerHTML='';th.appendChild(ifr);
      }catch{}})();
    }},{root:grid,rootMargin:'200px'});
  grid.querySelectorAll('.card').forEach(card=>{
    diskThumbObserver.observe(card);
    card.onclick=e=>{
      const f=files[+card.dataset.disk];if(!f)return;
      if(e.target.classList.contains('menu-btn')){openDiskMenu(e.target,d,f);return}
      openDiskFile(d,f);};
  });
}
function openDiskMenu(btn,d,f){
  closeMenu();
  const m=document.createElement('div');m.className='dropdown';
  m.innerHTML=`<button data-a="open">Open</button>
    <button data-a="import">Import a copy to shelf</button>
    <button data-a="dl">Download a copy</button>`;
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect();
  m.style.left=Math.min(r.left,innerWidth-180)+'px';m.style.top=(r.bottom+4)+'px';
  setOpenMenu(m);
  m.onclick=async e=>{const a=e.target.dataset.a;if(!a)return;closeMenu();
    try{
      if(a==='open')openDiskFile(d,f);
      if(a==='import'){const file=await f.handle.getFile();
        await addFile(f.name,await file.text());toast('Copied to shelf')}
      if(a==='dl'){const file=await f.handle.getFile();
        downloadBlob(f.name,new Blob([await file.text()],{type:'text/html'}))}
    }catch(err){toast('Failed: '+err.message)}};
}
async function openDiskFile(d,f){
  try{
    const file=await f.handle.getFile();
    const raw=await file.text();
    let html=raw,assets={},assetCache=new Map();
    try{
      const b=await bundleDiskHtml(d.handle,f.name,raw);
      html=b.html;assets=b.assets;
      assetCache=await preloadDiskAssets(d.handle,b.base,html);
      if(b.warns.length)toast('Could not load linked file(s): '+b.warns.slice(0,3).join(', '));
    }catch{}
    /* root + diskId travel with the open file so saves and version keys hit the right folder */
    state.cur={id:null,disk:true,diskId:d.id,root:d.handle,handle:f.handle,name:f.name,html,assets,assetCache};
    state.srcDoc=null;state.selEl=null;setDirty(false);
    state.mmode='interact';state.codeOpen=false;
    $('#edName').value=f.name;$('#edName').readOnly=true;
    const na=Object.keys(assets).length;
    $('#edSub').textContent='💻 editing real files on disk'+(na?` · ${na} linked file${na>1?'s':''} bundled`:'');
    $('#codePanel').classList.add('off');$('#codeResizer').classList.add('off');
    $('#btnCode').classList.remove('primary');closeThemePanel();
    $('#libView').style.display='none';$('#edView').classList.add('show');
    await offerDraftRecovery();
    $('#widthSel').value='';histInit(state.cur.html);
    updateModeUI();renderFrame();
  }catch(err){toast('Could not open file: '+err.message)}
}


export { renderDiskSection, activeDisk, connectFolder, listDisk, resolveRel, getFileByPath, attrVal, bundleDiskHtml, preloadDiskAssets, applyAssetCache, saveDiskProject, DEMO_FILES, createExampleSite, disconnectFolder, diskThumbObserver, renderDiskGrid, openDiskMenu, openDiskFile };
