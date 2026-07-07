import './utils.js';
import './db.js';
import './state.js';
import './library.js';
import './disk.js';
import './ui.js';
import './editor.js';
import './history.js';
import './diff.js';
import './ai.js';
import './colors.js';
import './tour.js';
import { $ } from './utils.js';
import { idb, openDB } from './db.js';
import { state } from './state.js';
import { addFile, renderLibrary } from './library.js';
import { listDisk, bundleDiskHtml, preloadDiskAssets, applyAssetCache, saveDiskProject, resolveRel, createExampleSite, openDiskFile } from './disk.js';
import { startTour } from './tour.js';
import { renderFrame, syncNow, setDirty, saveCur, flushSerialize, selectDisplayEl, saveDraft, setCodeHighlight, refreshCodeText } from './editor.js';
import { hist, histGo, histPush, verKey, pushVersion } from './history.js';
import { diffLines, renderDiffHTML } from './diff.js';
import { extractHtml } from './ai.js';
import { scanTheme, applyColorSwap, renderThemePanel, closeThemePanel, themeScan, themeBase, themeOrig, themeHist } from './colors.js';

/* console/debug handle — the bundle keeps internals out of the global scope,
   so this is the deliberate window for debugging and automated tests */
window.hs={state,idb,hist,histGo,histPush,verKey,pushVersion,
  renderFrame,syncNow,setDirty,saveCur,flushSerialize,selectDisplayEl,saveDraft,setCodeHighlight,refreshCodeText,
  listDisk,bundleDiskHtml,preloadDiskAssets,applyAssetCache,saveDiskProject,resolveRel,createExampleSite,openDiskFile,
  diffLines,renderDiffHTML,extractHtml,
  scanTheme,applyColorSwap,renderThemePanel,closeThemePanel,startTour,
  get themeScan(){return themeScan},get themeBase(){return themeBase},
  get themeOrig(){return themeOrig},get themeHist(){return themeHist}};

/* ======================= welcome file & init ======================= */
const WELCOME=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Welcome to Hypershelf</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#000;color:#eceeed}
  .hero{background:radial-gradient(circle at 50% 135%,rgba(84,200,255,.35),transparent 65%),#06090c;
    border-bottom:1px solid #14212b;color:#fff;padding:56px 32px;text-align:center}
  .hero h1{margin:0 0 8px;font-size:32px;letter-spacing:.06em}
  .hero p{margin:0;opacity:.75}
  main{max-width:660px;margin:32px auto;padding:0 24px}
  .tip{background:#0c0e10;border:1px solid #212a30;border-radius:12px;padding:18px 20px;margin-bottom:14px}
  .tip b{color:#54C8FF}
  button.demo{background:linear-gradient(135deg,#54C8FF,#2493DC);color:#02131f;font-weight:700;border:none;border-radius:8px;padding:10px 20px;
    font-size:15px;cursor:pointer;display:block;margin:24px auto}
</style>
</head>
<body>
<div class="hero"><h1>Welcome to Hypershelf 📚</h1><p>A home for your self-contained HTML files.</p></div>
<main>
  <div class="tip"><b>🖱 Interact</b> mouse mode uses the page live — scripts run in a sandbox. Try the button below.</div>
  <div class="tip"><b>✎ Edit</b> mouse mode lets you click any element to change its text, colors, font, and size — or delete it.</div>
  <div class="tip"><b>‹/› Code</b> opens the source side-by-side — clicking an element in Edit mode jumps to and highlights its line, like Chrome's inspector.</div>
  <div class="tip"><b>📂 Open folder</b> (sidebar) connects a real folder on your computer — edits save straight to the actual files.</div>
  <div class="tip">Shelf files are stored in <b>this browser</b>. Use <b>Export library backup</b> to move or back up your shelf.</div>
  <button class="demo" onclick="this.textContent='Scripts work! ✨ Clicked '+(++window.n||(window.n=1))+'x'">Click me — I'm JavaScript</button>
</main>
</body>
</html>`;
(async function init(){
  $('#favicon').href=$('.logo img.mark').src; /* favicon reuses the embedded logo (one copy in the file) */
  /* Vercel Web Analytics — only on the deployed site, so local copies stay dependency-free */
  if(location.hostname.endsWith('.vercel.app')){
    const va=document.createElement('script');va.defer=true;va.src='/_vercel/insights/script.js';
    document.head.appendChild(va);
  }
  await openDB();
  state.files=await idb.all('files');
  state.folders=await idb.all('folders');
  /* restore the connected disk folder, if any */
  try{
    const rec=await idb.get('handles','dir');
    if(rec&&rec.handle){
      state.disk.handle=rec.handle;state.disk.name=rec.handle.name;
      const p=await rec.handle.queryPermission({mode:'readwrite'});
      if(p==='granted')await listDisk();else state.disk.needsPerm=true;
    }
  }catch{}
  if(!state.files.length&&!localStorage.getItem('hs-welcomed')){
    localStorage.setItem('hs-welcomed','1');
    await addFile('Welcome to Hypershelf.html',WELCOME,{tags:['guide']});
  }
  renderLibrary();
  if(!localStorage.getItem('hs-toured'))setTimeout(startTour,500);
})();


export { WELCOME };
