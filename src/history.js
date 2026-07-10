import { $, $$, toast, uid, withAppScrollbars } from './utils.js';
import { idb } from './db.js';
import { state } from './state.js';
import { applyAssetCache } from './disk.js';
import { hideModal, showModal } from './ui.js';
import { refreshCodeText, renderFrame, setCodeHighlight, setDirty, syncNow } from './editor.js';
import { renderDiffHTML } from './diff.js';
import { renderThemePanel } from './colors.js';

/* ======================= undo / redo ======================= */
const hist={stack:[],pos:-1,MAX:100};
function histInit(html){hist.stack=[html];hist.pos=0;histUI()}
function histPush(html){
  if(html===hist.stack[hist.pos])return;
  hist.stack.length=hist.pos+1; /* dropping the redo branch */
  hist.stack.push(html);
  if(hist.stack.length>hist.MAX)hist.stack.shift();
  hist.pos=hist.stack.length-1;histUI();
}
function histUI(){$('#btnUndo').disabled=hist.pos<=0;$('#btnRedo').disabled=hist.pos>=hist.stack.length-1}
function histGo(delta){
  if(!state.cur)return;
  syncNow();histPush(state.cur.html); /* fold pending edits into the stack first */
  const np=hist.pos+delta;
  if(np<0||np>=hist.stack.length)return;
  hist.pos=np;state.cur.html=hist.stack[np];
  setDirty(true);setCodeHighlight(-1);renderFrame();refreshCodeText();histUI();
  if(state.themeOpen)renderThemePanel(); /* rebase the colors panel so it doesn't resurrect undone state */
}
$('#btnUndo').onclick=()=>histGo(-1);
$('#btnRedo').onclick=()=>histGo(1);

/* ======================= version history (snapshot on every Save) ======================= */
const VMAX=20;
function verKey(){return state.cur.disk?'disk:'+(state.cur.diskId||'')+':'+state.cur.name:state.cur.id}
async function pushVersion(fileId,html){
  try{
    const all=(await idb.all('versions')).filter(v=>v.fileId===fileId).sort((a,b)=>b.ts-a.ts);
    if(all[0]&&all[0].html===html)return; /* unchanged since last snapshot */
    await idb.put('versions',{vid:uid(),fileId,ts:Date.now(),html});
    for(const v of all.slice(VMAX-1))await idb.del('versions',v.vid);
  }catch{}
}
$('#btnHistory').onclick=async()=>{
  if(!state.cur)return;
  syncNow();
  const vers=(await idb.all('versions')).filter(v=>v.fileId===verKey()).sort((a,b)=>b.ts-a.ts);
  const fmt=ts=>new Date(ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  showModal(`<h3>⌛ Version history</h3>
    ${vers.length?`
    <div class="vlist">${vers.map(v=>`
      <div class="vrow">
        <span>${fmt(v.ts)}</span>
        ${v.html===state.cur.html?'<span class="vcur">current</span>':''}
        <span class="vsize">${(v.html.length/1024).toFixed(1)} KB</span>
        <button class="vprev" data-vid="${v.vid}">Preview</button>
        ${v.html===state.cur.html?'':`<button class="vdiff" data-vid="${v.vid}">Diff</button><button class="vrest" data-vid="${v.vid}">Restore</button>`}
      </div>`).join('')}</div>
    <div id="vPane"><div class="vhint">Click Preview to see a version here.</div></div>
    <div class="hint">A snapshot is stored each time you hit Save (last ${VMAX} kept). Restore loads a version into the editor — hit Save to keep it.</div>`
    :'<div class="hint">No snapshots yet — one is stored every time you hit Save.</div>'}
    <div class="mbtns"><button id="mCancel">Close</button></div>`);
  $('#mCancel').onclick=hideModal;
  $$('#modal .vprev').forEach(b=>b.onclick=()=>{
    const v=vers.find(x=>x.vid===b.dataset.vid);if(!v)return;
    const pane=$('#vPane');pane.classList.remove('asdiff');pane.innerHTML='';
    const ifr=document.createElement('iframe');ifr.setAttribute('sandbox','');ifr.srcdoc=withAppScrollbars(applyAssetCache(v.html));
    pane.appendChild(ifr);
  });
  $$('#modal .vdiff').forEach(b=>b.onclick=()=>{
    const v=vers.find(x=>x.vid===b.dataset.vid);if(!v)return;
    const pane=$('#vPane');pane.classList.add('asdiff');
    pane.innerHTML='<div class="hint" style="margin-bottom:6px">That snapshot → what\'s in the editor now:</div>'+
      renderDiffHTML(v.html,state.cur.html);
  });
  $$('#modal .vrest').forEach(b=>b.onclick=()=>{
    const v=vers.find(x=>x.vid===b.dataset.vid);if(!v)return;
    state.cur.html=v.html;histPush(v.html);setDirty(true);
    hideModal();setCodeHighlight(-1);renderFrame();refreshCodeText();
    if(state.themeOpen)renderThemePanel();
    toast('Version restored — hit Save to keep it');
  });
};


export { hist, histInit, histPush, histUI, histGo, VMAX, verKey, pushVersion };
