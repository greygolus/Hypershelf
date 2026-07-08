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
import { WELCOME } from './welcome.js';

/* console/debug handle — the bundle keeps internals out of the global scope,
   so this is the deliberate window for debugging and automated tests */
window.hs={state,idb,hist,histGo,histPush,verKey,pushVersion,
  renderFrame,syncNow,setDirty,saveCur,flushSerialize,selectDisplayEl,saveDraft,setCodeHighlight,refreshCodeText,
  listDisk,bundleDiskHtml,preloadDiskAssets,applyAssetCache,saveDiskProject,resolveRel,createExampleSite,openDiskFile,
  diffLines,renderDiffHTML,extractHtml,
  scanTheme,applyColorSwap,renderThemePanel,closeThemePanel,startTour,
  get themeScan(){return themeScan},get themeBase(){return themeBase},
  get themeOrig(){return themeOrig},get themeHist(){return themeHist}};

/* ======================= init ======================= */
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
