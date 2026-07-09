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
import './insert.js';
import './share.js';
import './slides.js';
import { $ } from './utils.js';
import { idb, openDB } from './db.js';
import { state } from './state.js';
import { addFile, renderLibrary } from './library.js';
import { activeDisk } from './disk.js';
import { listDisk, bundleDiskHtml, preloadDiskAssets, applyAssetCache, saveDiskProject, resolveRel, createExampleSite, openDiskFile } from './disk.js';
import { startTour } from './tour.js';
import { renderFrame, syncNow, setDirty, saveCur, flushSerialize, selectDisplayEl, saveDraft, setCodeHighlight, refreshCodeText, insertHtmlAfterSelection } from './editor.js';
import { hist, histGo, histPush, verKey, pushVersion } from './history.js';
import { diffLines, renderDiffHTML } from './diff.js';
import { extractHtml } from './ai.js';
import { scanTheme, applyColorSwap, renderThemePanel, closeThemePanel, themeScan, themeBase, themeOrig, themeHist } from './colors.js';
import { WELCOME } from './welcome.js';
import { SLIDES_DEMO } from './slidesdemo.js';
import { makeShareLink, shareFile, checkShareHash } from './share.js';
import { isSlideshow, SLIDE_LAYOUTS, addSlide, addSlideAfterSelection, dupSlide, delSlide, moveSlide, focusSlide, refreshSlidesUI, setDeco, parseDeco, decoCSS } from './slides.js';
import { parseGradient, serializeGradient, normRGB } from './gradient.js';

/* console/debug handle — the bundle keeps internals out of the global scope,
   so this is the deliberate window for debugging and automated tests */
window.hs={state,idb,hist,histGo,histPush,verKey,pushVersion,
  renderFrame,syncNow,setDirty,saveCur,flushSerialize,selectDisplayEl,saveDraft,setCodeHighlight,refreshCodeText,insertHtmlAfterSelection,
  listDisk,bundleDiskHtml,preloadDiskAssets,applyAssetCache,saveDiskProject,resolveRel,createExampleSite,openDiskFile,activeDisk,renderLibrary,
  diffLines,renderDiffHTML,extractHtml,
  scanTheme,applyColorSwap,renderThemePanel,closeThemePanel,startTour,
  makeShareLink,shareFile,checkShareHash,
  isSlideshow,SLIDE_LAYOUTS,addSlide,addSlideAfterSelection,dupSlide,delSlide,moveSlide,focusSlide,refreshSlidesUI,setDeco,parseDeco,decoCSS,
  parseGradient,serializeGradient,normRGB,
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
  /* restore all connected disk folders (older versions stored a single record with id 'dir') */
  try{
    for(const rec of await idb.all('handles')){
      if(!rec.handle)continue;
      const d={id:rec.id,handle:rec.handle,name:rec.handle.name,files:[],needsPerm:false};
      state.disks.push(d);
      try{
        const p=await rec.handle.queryPermission({mode:'readwrite'});
        if(p==='granted')await listDisk(d);else d.needsPerm=true;
      }catch{d.needsPerm=true}
    }
  }catch{}
  if(!state.files.length&&!localStorage.getItem('hs-welcomed')){
    localStorage.setItem('hs-welcomed','1');
    /* Slides 101 first, Welcome second — the shelf sorts by modified, Welcome should lead */
    await addFile('Slides 101.html',SLIDES_DEMO,{tags:['slideshow','guide']});
    await addFile('Welcome to Hypershelf.html',WELCOME,{tags:['guide']});
  }
  renderLibrary();
  checkShareHash(); /* someone opened a share link — offer to add the file */
  if(!localStorage.getItem('hs-toured'))setTimeout(startTour,500);
})();
