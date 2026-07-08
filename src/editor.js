import { $, $$, debounce, esc, rgbToHex, toast } from './utils.js';
import { idb } from './db.js';
import { state } from './state.js';
import { downloadFile, normalizeName, renderLibrary } from './library.js';
import { applyAssetCache, saveDiskProject } from './disk.js';
import { histGo, histInit, histPush, pushVersion, verKey } from './history.js';
import { closeThemePanel } from './colors.js';
import { openFontMenu } from './fonts.js';

/* ======================= editor ======================= */
function setDirty(d){state.dirty=d;$('#dirtyDot').classList.toggle('show',d)}
async function openFile(id){
  const f=state.files.find(x=>x.id===id);if(!f)return;
  state.cur={...f};state.srcDoc=null;state.selEl=null;setDirty(false);
  state.mmode='interact';state.codeOpen=false;
  $('#edName').value=f.displayName||f.name;$('#edName').readOnly=false;
  $('#edSub').textContent=f.displayName?f.name:'';
  $('#codePanel').classList.add('off');$('#codeResizer').classList.add('off');
  $('#btnCode').classList.remove('primary');closeThemePanel();
  $('#libView').style.display='none';$('#edView').classList.add('show');
  await offerDraftRecovery();
  $('#widthSel').value='';histInit(state.cur.html);
  updateModeUI();renderFrame();
}
/* if an autosaved draft is newer than the stored file, offer to recover it */
async function offerDraftRecovery(){
  try{
    const d=await idb.get('drafts',verKey());
    if(!d||d.html===state.cur.html)return;
    if(confirm(`Found unsaved changes autosaved ${new Date(d.ts).toLocaleString()} (the editor was closed without saving). Recover them?`)){
      state.cur.html=d.html;setDirty(true);
    }else await idb.del('drafts',verKey());
  }catch{}
}
function showLibrary(){
  /* leaving the editor is an explicit choice — the draft is no longer "crash leftovers" */
  if(state.cur)idb.del('drafts',verKey()).catch(()=>{});
  $('#edView').classList.remove('show');$('#libView').style.display='flex';
  /* free iframe memory */
  $('#frameWrap').innerHTML='';$('#codeTa').value='';$('#codeBack').innerHTML='';
  state.cur=null;state.srcDoc=null;state.selEl=null;renderLibrary();
  dispatchEvent(new CustomEvent('hs-rendered')); /* lets the slides filmstrip hide itself */
}
$('#btnBack').onclick=async()=>{
  if(state.dirty){
    if(confirm('You have unsaved changes. Save them before leaving?\n\nOK = save · Cancel = discard'))await saveCur();
  }
  showLibrary();
};
$('#edName').onchange=e=>{
  if(!state.cur||state.cur.disk)return;
  const v=e.target.value.trim();
  if(state.cur.displayName){state.cur.displayName=v||state.cur.name}
  else{state.cur.name=normalizeName(v||'Untitled.html');e.target.value=state.cur.name}
  setDirty(true)};
$('#btnDownload').onclick=()=>{syncNow();downloadFile(state.cur)};
$('#btnSave').onclick=()=>saveCur();
async function saveCur(){
  if(!state.cur)return;
  syncNow();
  /* capture locals up front — state.cur can be nulled by navigation while we await */
  const key=verKey(),html=state.cur.html;
  if(state.cur.disk){
    const cur=state.cur;
    try{
      const n=await saveDiskProject(cur,html);
      setDirty(false);toast(n>1?`Saved ${n} files to disk`:'Saved to disk');
      pushVersion(key,html);idb.del('drafts',key).catch(()=>{});
    }catch(err){toast('Save failed: '+err.message)}
    return;
  }
  state.cur.modified=Date.now();
  const i=state.files.findIndex(x=>x.id===state.cur.id);
  state.files[i]={...state.cur};
  await idb.put('files',state.files[i]);
  setDirty(false);toast('Saved');
  pushVersion(key,html);idb.del('drafts',key).catch(()=>{});
}
document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||!state.cur)return;
  const k=e.key.toLowerCase();
  if(k==='s'){e.preventDefault();saveCur();return}
  const t=document.activeElement;
  if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return; /* fields keep native undo */
  if(k==='z'){e.preventDefault();histGo(e.shiftKey?1:-1)}
  else if(k==='y'){e.preventDefault();histGo(1)}
});
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue=''}});

/* pull any pending edits into state.cur.html */
function syncNow(){
  flushSerialize();
  if(state.codeOpen&&$('#codeTa').value!==state.cur.html)state.cur.html=$('#codeTa').value;
}

/* ---------- mouse modes: Interact / Edit ---------- */
function updateModeUI(){
  $$('#mouseModes button').forEach(b=>b.classList.toggle('active',b.dataset.mmode===state.mmode));
  $('#edInspector').classList.toggle('off',state.mmode!=='edit'||state.themeOpen);
}
function setMMode(m){
  if(state.mmode===m||!state.cur)return;
  syncNow();state.mmode=m;updateModeUI();renderFrame();
}
$$('#mouseModes button').forEach(b=>b.onclick=()=>setMMode(b.dataset.mmode));

/* ---------- the page frame (rebuilt fresh on every render) ---------- */
const HS='data-hs-id';
function renderFrame(){
  state.selEl=null;dispDoc=null;
  const wrap=$('#frameWrap');wrap.innerHTML='';
  const fr=document.createElement('iframe');
  if(state.mmode==='interact'){
    fr.setAttribute('sandbox','allow-scripts allow-modals allow-forms allow-popups');
    wrap.appendChild(fr);
    fr.srcdoc=applyAssetCache(state.cur.html);
  }else{
    state.srcDoc=new DOMParser().parseFromString(state.cur.html,'text/html');
    let i=0;
    state.srcDoc.querySelectorAll('body *').forEach(el=>el.setAttribute(HS,i++));
    /* display copy: scripts + inline handlers neutralized so the page holds still */
    const disp=state.srcDoc.cloneNode(true);
    disp.querySelectorAll('script').forEach(s=>s.setAttribute('type','text/plain'));
    disp.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name)});});
    const st=disp.createElement('style');
    st.textContent='[data-hs-hover]{outline:2px dashed #54C8FF!important;outline-offset:-1px;cursor:pointer!important}'+
      '[data-hs-sel]{outline:2px solid #54C8FF!important;outline-offset:-1px}'+
      '[data-hs-dragging]{opacity:.55!important;outline:2px dashed #4cd97b!important;outline-offset:-1px}'+
      '[contenteditable]{outline:2px solid #4cd97b!important;outline-offset:-1px;cursor:text!important}'+
      '#hsHandles{position:fixed;display:none;pointer-events:none;z-index:2147483000}'+
      '#hsHandles .hsz{position:absolute;width:10px;height:10px;background:#54C8FF;border:1.5px solid #fff;border-radius:3px;pointer-events:auto;box-shadow:0 1px 4px rgba(0,0,0,.4)}'+
      '#hsHandles .hsz[data-h=e]{right:-5px;top:calc(50% - 5px);cursor:ew-resize}'+
      '#hsHandles .hsz[data-h=s]{bottom:-5px;left:calc(50% - 5px);cursor:ns-resize}'+
      '#hsHandles .hsz[data-h=se]{right:-5px;bottom:-5px;cursor:nwse-resize}'+
      '#hsSize{position:absolute;right:0;top:calc(100% + 8px);background:#0b0b0d;color:#ECEEED;font:11px monospace;padding:2px 7px;border-radius:6px;border:1px solid #26262b;display:none;white-space:nowrap}';
    disp.head.appendChild(st);
    fr.onload=()=>attachEditHandlers(fr.contentDocument);
    wrap.appendChild(fr);
    fr.srcdoc=applyAssetCache('<!DOCTYPE html>\n'+disp.documentElement.outerHTML);
    renderInspector(null);
  }
  applyPreviewWidth();
  dispatchEvent(new CustomEvent('hs-rendered')); /* panels that mirror the document (slides filmstrip) re-sync here */
}
/* ---------- resize handles (E / S / SE on the selected element) ---------- */
let dispDoc=null;
function getDispDoc(){return dispDoc}
function ensureHandles(doc){
  let box=doc.getElementById('hsHandles');
  if(box)return box;
  box=doc.createElement('div');box.id='hsHandles';
  box.innerHTML='<div class="hsz" data-h="e" title="Drag to set width"></div>'+
    '<div class="hsz" data-h="s" title="Drag to set height"></div>'+
    '<div class="hsz" data-h="se" title="Drag to resize"></div><span id="hsSize"></span>';
  doc.body.appendChild(box);
  return box;
}
function positionHandles(){
  if(!dispDoc)return;
  const box=dispDoc.getElementById('hsHandles');if(!box)return;
  const el=state.selEl;
  if(!el||state.mmode!=='edit'){box.style.display='none';return}
  const r=el.getBoundingClientRect();
  box.style.display='block';
  box.style.left=r.left+'px';box.style.top=r.top+'px';
  box.style.width=r.width+'px';box.style.height=r.height+'px';
}
function attachEditHandlers(doc){
  if(!doc||!doc.body)return;
  dispDoc=doc;
  const hbox=ensureHandles(doc);
  /* drag the SELECTED element to move it before/after any other element */
  let drag=null,justDragged=false,rz=null,editingEl=null;
  /* ---------- inline text editing (double-click a text element) ---------- */
  const onInlineInput=()=>{
    if(!editingEl)return;
    const s=srcEl();if(!s)return;
    s.textContent=editingEl.textContent;
    const it=$('#iText');if(it)it.value=editingEl.textContent;
    scheduleSerialize();positionHandles();
  };
  const inlineKeys=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();endInlineEdit()}
  };
  function endInlineEdit(){
    const t=editingEl;if(!t)return;editingEl=null;
    t.removeEventListener('input',onInlineInput);
    t.removeEventListener('keydown',inlineKeys);
    t.removeEventListener('blur',endInlineEdit);
    t.removeAttribute('contenteditable');
    flushSerialize();
  }
  function startInlineEdit(t,ev){
    if(editingEl===t)return;
    endInlineEdit();
    if(state.selEl!==t)selectDisplayEl(t);
    editingEl=t;
    try{t.contentEditable='plaintext-only'}catch{t.contentEditable='true'}
    t.focus();
    /* put the caret where the user double-clicked */
    try{
      const rng=doc.caretRangeFromPoint(ev.clientX,ev.clientY);
      if(rng){const sel=doc.getSelection();sel.removeAllRanges();sel.addRange(rng)}
    }catch{}
    t.addEventListener('input',onInlineInput);
    t.addEventListener('keydown',inlineKeys);
    t.addEventListener('blur',endInlineEdit);
  }
  doc.body.addEventListener('dblclick',e=>{
    const t=e.target.closest('['+HS+']');
    if(!t||t.children.length)return; /* text leaves only */
    e.preventDefault();e.stopPropagation();
    startInlineEdit(t,e);
  },true);
  doc.body.addEventListener('mouseover',e=>{
    if(rz||editingEl||(drag&&drag.active))return;
    doc.querySelectorAll('[data-hs-hover]').forEach(el=>el.removeAttribute('data-hs-hover'));
    const t=e.target.closest('['+HS+']');if(t)t.setAttribute('data-hs-hover','')},true);
  doc.body.addEventListener('mouseout',()=>{
    doc.querySelectorAll('[data-hs-hover]').forEach(el=>el.removeAttribute('data-hs-hover'))},true);
  /* resizing */
  hbox.addEventListener('mousedown',e=>{
    const h=e.target.closest('.hsz');if(!h||!state.selEl)return;
    e.preventDefault();e.stopPropagation();
    const cs=doc.defaultView.getComputedStyle(state.selEl);
    const r=state.selEl.getBoundingClientRect();
    const sum=(...ps)=>ps.reduce((n,p)=>n+(parseFloat(cs[p])||0),0);
    rz={h:h.dataset.h,x:e.clientX,y:e.clientY,w:r.width,ht:r.height,
      /* content-box elements need padding+border subtracted so the OUTER size follows the mouse */
      bx:cs.boxSizing==='border-box'?0:sum('paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'),
      by:cs.boxSizing==='border-box'?0:sum('paddingTop','paddingBottom','borderTopWidth','borderBottomWidth')};
    doc.getElementById('hsSize').style.display='block';
  },true);
  doc.body.addEventListener('mousedown',e=>{
    if(editingEl)return; /* typing, not dragging */
    const t=e.target.closest('['+HS+']');
    if(!t||t!==state.selEl)return; /* only the selected element is draggable */
    drag={el:t,x:e.clientX,y:e.clientY,active:false,moved:false,prevPE:'',
      origParent:t.parentElement,origNext:t.nextElementSibling};
  },true);
  doc.addEventListener('mousemove',e=>{
    if(!rz)return;
    e.preventDefault();
    const w=Math.max(8,rz.w+(rz.h.includes('e')?e.clientX-rz.x:0));
    const ht=Math.max(8,rz.ht+(rz.h.includes('s')?e.clientY-rz.y:0));
    if(rz.h.includes('e'))applyInlineStyle('width',Math.max(1,Math.round(w-rz.bx))+'px');
    if(rz.h.includes('s'))applyInlineStyle('height',Math.max(1,Math.round(ht-rz.by))+'px');
    doc.getElementById('hsSize').textContent=Math.round(w)+' × '+Math.round(ht);
  },true);
  doc.addEventListener('mouseup',()=>{
    if(!rz)return;rz=null;
    doc.getElementById('hsSize').style.display='none';
    positionHandles();
    /* sync the inspector's W/H fields with the new inline size */
    if(state.selEl){
      const wI=$('#iW'),hI=$('#iH');
      if(wI)wI.value=parseFloat(state.selEl.style.width)||'';
      if(hI)hI.value=parseFloat(state.selEl.style.height)||'';
    }
  },true);
  doc.addEventListener('scroll',()=>positionHandles(),true);
  /* elements that can't sensibly take arbitrary children */
  const NONEST=/^(img|br|hr|input|textarea|select|option|meta|link|style|script|iframe|canvas|svg|video|audio|source|track|wbr|area|base|col|embed|param|button)$/i;
  const putBefore=ref=>{if(ref.previousElementSibling!==drag.el){ref.before(drag.el);drag.moved=true}};
  const putAfter=ref=>{if(ref.nextElementSibling!==drag.el){ref.after(drag.el);drag.moved=true}};
  /* drop INSIDE a container: position among its children by cursor (rows + columns + wraps) */
  const placeInto=(container,e)=>{
    if(container===drag.el||drag.el.contains(container))return;
    let ref=null;
    for(const c of container.children){
      if(c===drag.el||!c.getAttribute||c.getAttribute(HS)===null)continue;
      const cr=c.getBoundingClientRect();
      if(e.clientY<cr.top||(e.clientY<=cr.bottom&&e.clientX<cr.left+cr.width/2)){ref=c;break}
    }
    if(ref)putBefore(ref);
    else if(!(drag.el.parentElement===container&&drag.el===container.lastElementChild)){
      container.append(drag.el);drag.moved=true;
    }
  };
  /* do this element's siblings flow horizontally? decides which axis splits before/after */
  const flowsHorizontally=el=>{
    const sib=[el.previousElementSibling,el.nextElementSibling]
      .find(s=>s&&s!==drag.el&&s.getAttribute&&s.getAttribute(HS)!==null);
    if(!sib)return false;
    const a=el.getBoundingClientRect(),b=sib.getBoundingClientRect();
    /* same row only if the rects genuinely overlap vertically */
    const ov=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    return ov>Math.min(a.height,b.height)*.5;
  };
  doc.body.addEventListener('mousemove',e=>{
    if(!drag||rz)return;
    if(!drag.active){
      if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<6)return;
      drag.active=true;doc.body.style.cursor='grabbing';
      hbox.style.display='none'; /* handles out of the way while moving */
      drag.prevPE=drag.el.style.pointerEvents;
      drag.el.style.pointerEvents='none'; /* hit-test through the element being moved */
      drag.el.setAttribute('data-hs-dragging','');
    }
    /* LIVE reorder: the element actually moves as you drag, so what you
       see during the drag is exactly what you get on release */
    const hit=doc.elementFromPoint(e.clientX,e.clientY);
    if(!hit)return;
    const tgt=hit.closest?hit.closest('['+HS+']'):null;
    if(!tgt){
      /* page background — position among the body's top-level elements */
      if(hit===doc.body||hit===doc.documentElement)placeInto(doc.body,e);
      return;
    }
    if(tgt===drag.el||drag.el.contains(tgt))return;
    if(tgt===drag.el.parentElement){
      /* over our own container's background: reposition within it — leaving a
         container happens by moving onto something OUTSIDE it, never by grazing
         its internal edges (that ejection was what made dragging feel random) */
      placeInto(tgt,e);return;
    }
    const r=tgt.getBoundingClientRect();
    const hasKids=[...tgt.children].some(c=>c!==drag.el&&c.getAttribute&&c.getAttribute(HS)!==null);
    const emptyBox=!hasKids&&!tgt.textContent.trim();
    const canNest=!NONEST.test(tgt.tagName)&&(hasKids||emptyBox);
    const horiz=flowsHorizontally(tgt);
    const pos=horiz?e.clientX:e.clientY;
    const start=horiz?r.left:r.top,len=horiz?r.width:r.height;
    if(!canNest){ /* leaves: pure halves — never nest */
      (pos<start+len/2?putBefore:putAfter)(tgt);
      return;
    }
    /* containers: edges drop beside, the middle drops inside */
    const edge=tgt.parentElement===drag.el.parentElement
      ?Math.max(len*.4,len/2-12) /* sibling containers: reorder dominates, small nest zone in the middle */
      :Math.min(16,Math.max(6,len*.25)); /* other containers: thin edges, "inside" dominates */
    if(pos<start+edge)putBefore(tgt);
    else if(pos>start+len-edge)putAfter(tgt);
    else placeInto(tgt,e);
  },true);
  const endDrag=(cancel)=>{
    const d=drag;drag=null;
    doc.body.style.cursor='';
    d.el.style.pointerEvents=d.prevPE;
    if(!d.el.getAttribute('style'))d.el.removeAttribute('style');
    d.el.removeAttribute('data-hs-dragging');
    if(cancel&&d.moved){ /* pointer left the page — put the element back */
      if(d.origNext)d.origNext.before(d.el);else d.origParent.append(d.el);
      positionHandles();return;
    }
    if(d.moved){
      /* mirror the final display position into the source document */
      const s=srcEl();
      if(s){
        let ref=d.el.previousElementSibling;
        while(ref&&ref.getAttribute(HS)===null)ref=ref.previousElementSibling;
        if(ref)state.srcDoc.querySelector(`[${HS}="${ref.getAttribute(HS)}"]`).after(s);
        else{
          ref=d.el.nextElementSibling;
          while(ref&&ref.getAttribute(HS)===null)ref=ref.nextElementSibling;
          if(ref)state.srcDoc.querySelector(`[${HS}="${ref.getAttribute(HS)}"]`).before(s);
          else{
            const p=d.el.parentElement;
            const sp=p&&p.getAttribute(HS)!==null
              ?state.srcDoc.querySelector(`[${HS}="${p.getAttribute(HS)}"]`)
              :state.srcDoc.body;
            if(sp)sp.prepend(s);
          }
        }
      }
      scheduleSerialize();
      if(state.codeOpen)jumpToEl(d.el);
    }
    positionHandles();
  };
  doc.body.addEventListener('mouseup',()=>{
    if(!drag)return;
    const wasActive=drag.active;
    if(!wasActive){drag=null;return}
    justDragged=true; /* swallow the click this drag generates */
    endDrag(false);
  },true);
  doc.addEventListener('mouseleave',()=>{if(drag&&drag.active)endDrag(true);else drag=null});
  doc.body.addEventListener('click',e=>{
    /* while editing text, clicks inside the element place the caret */
    if(editingEl&&(e.target===editingEl||editingEl.contains(e.target)))return;
    e.preventDefault();e.stopPropagation();
    if(justDragged){justDragged=false;return}
    const t=e.target.closest('['+HS+']');if(!t)return;
    selectDisplayEl(t)},true);
  doc.addEventListener('keydown',e=>{ /* shortcuts still work when focus is inside the page */
    if(!(e.ctrlKey||e.metaKey))return;
    const k=e.key.toLowerCase();
    if(k==='s'){e.preventDefault();saveCur();return}
    if(editingEl)return; /* native undo inside the contenteditable */
    if(k==='z'){e.preventDefault();histGo(e.shiftKey?1:-1)}
    else if(k==='y'){e.preventDefault();histGo(1)}
  });
}
function selectDisplayEl(t,opt={}){
  const doc=t.ownerDocument;
  doc.querySelectorAll('[data-hs-sel]').forEach(el=>el.removeAttribute('data-hs-sel'));
  t.setAttribute('data-hs-sel','');
  if(opt.scrollPage)t.scrollIntoView({block:'center'});
  state.selEl=t;renderInspector(t);positionHandles();
  if(state.codeOpen&&!opt.noJump)jumpToEl(t);
}
function srcEl(){/* the matching element in the source document */
  return state.selEl?state.srcDoc.querySelector(`[${HS}="${state.selEl.getAttribute(HS)}"]`):null}
function serializeSrc(){
  const out=state.srcDoc.cloneNode(true);
  out.querySelectorAll('['+HS+']').forEach(el=>el.removeAttribute(HS));
  return'<!DOCTYPE html>\n'+out.documentElement.outerHTML;
}

/* visual edits → source text (debounced so typing stays smooth) */
let serialT=null;
function scheduleSerialize(){setDirty(true);clearTimeout(serialT);
  serialT=setTimeout(doSerialize,300)}
function doSerialize(){serialT=null;
  if(state.srcDoc&&state.mmode==='edit'){state.cur.html=serializeSrc();histPush(state.cur.html);refreshCodeText();
    dispatchEvent(new CustomEvent('hs-edited'))}}
function flushSerialize(){if(serialT){clearTimeout(serialT);doSerialize()}}
/* always-inline dual-apply (resize handles use this directly — sizing is per-element) */
function applyInlineStyle(prop,val){
  const s=srcEl();if(!s||!state.selEl)return;
  if(val===null){state.selEl.style.removeProperty(prop);s.style.removeProperty(prop);
    if(!s.getAttribute('style'))s.removeAttribute('style');}
  else{state.selEl.style.setProperty(prop,val);s.style.setProperty(prop,val);}
  scheduleSerialize();positionHandles();
}
function applyStyle(prop,val){
  const scopeSel=$('#iScope');
  if(scopeSel&&scopeSel.value){setScopedRule(scopeSel.value,prop,val);positionHandles();return}
  applyInlineStyle(prop,val);
}

/* scoped edits are written as CSS rules into a managed style block (kept in the file) */
function ensureRuleSheet(doc){
  let st=doc.querySelector('style[data-hs-rules]');
  if(!st){st=doc.createElement('style');st.setAttribute('data-hs-rules','');doc.body.appendChild(st)}
  return st;
}
function parseRuleText(txt){
  const rules={};
  for(const m of txt.matchAll(/([^{}]+)\{([^}]*)\}/g)){
    const sel=m[1].trim();if(!sel)continue;
    const props={};
    m[2].split(';').forEach(d=>{const i=d.indexOf(':');
      if(i>0)props[d.slice(0,i).trim()]=d.slice(i+1).trim()});
    rules[sel]=props;
  }
  return rules;
}
function setScopedRule(selector,prop,val){
  if(!state.srcDoc)return;
  const srcSheet=ensureRuleSheet(state.srcDoc);
  const rules=parseRuleText(srcSheet.textContent);
  const r=rules[selector]||(rules[selector]={});
  if(val===null)delete r[prop];else r[prop]=val;
  if(!Object.keys(r).length)delete rules[selector];
  const text=Object.entries(rules).map(([s,ps])=>
    s+'{'+Object.entries(ps).map(([p,v])=>p+':'+v).join(';')+'}').join('\n');
  const dispDoc=state.selEl&&state.selEl.ownerDocument;
  if(!text){ /* nothing left — keep the file clean */
    srcSheet.remove();
    const d=dispDoc&&dispDoc.querySelector('style[data-hs-rules]');if(d)d.remove();
  }else{
    srcSheet.textContent=text;
    if(dispDoc)ensureRuleSheet(dispDoc).textContent=text;
  }
  scheduleSerialize();
}
/* candidate "similar element" selectors with live match counts */
function scopeOptions(el){
  if(!state.srcDoc)return[];
  const tag=el.tagName.toLowerCase(),cls=[...el.classList],cands=[];
  if(cls.length){
    cands.push('.'+cls.join('.'));
    cands.push(tag+'.'+cls.join('.'));
    if(cls.length>1)cls.forEach(c=>cands.push('.'+c));
  }
  cands.push(tag);
  const seen=new Set(),out=[];
  for(const sel of cands){
    if(seen.has(sel))continue;seen.add(sel);
    let n=0;try{n=state.srcDoc.querySelectorAll(sel).length}catch{continue}
    if(n>1)out.push({sel,n});
  }
  return out;
}

/* ---------- code panel (side-by-side inspector) ---------- */
let hlLine=-1;
$('#btnCode').onclick=()=>{
  if(!state.cur)return;
  state.codeOpen=!state.codeOpen;
  $('#codePanel').classList.toggle('off',!state.codeOpen);
  $('#codeResizer').classList.toggle('off',!state.codeOpen);
  $('#btnCode').classList.toggle('primary',state.codeOpen);
  if(state.codeOpen){flushSerialize();$('#codeTa').value=state.cur.html;hlLine=-1;renderBackdrop();
    if(state.selEl)jumpToEl(state.selEl)}
  updateFileJump();
};
/* multi-file disk projects: dropdown to jump to a bundled css/js block in the code */
function updateFileJump(){
  const sel=$('#fileJump');
  const assets=state.cur&&state.cur.assets?Object.keys(state.cur.assets):[];
  if(!state.codeOpen||!assets.length){sel.classList.add('off');return}
  sel.classList.remove('off');
  sel.innerHTML='<option value="">'+esc(state.cur.name)+' (html)</option>'+
    assets.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
}
$('#fileJump').onchange=()=>{
  const p=$('#fileJump').value;
  if(!p){setCodeHighlight(0,true);return}
  const i=$('#codeTa').value.split('\n').findIndex(l=>l.includes('data-hs-src="'+p+'"'));
  if(i>=0)setCodeHighlight(i,true);
};
function refreshCodeText(){
  if(!state.codeOpen)return;
  $('#codeTa').value=state.cur.html;renderBackdrop();
}
function renderBackdrop(){
  const ta=$('#codeTa'),back=$('#codeBack');
  back.innerHTML=ta.value.split('\n').map((l,i)=>
    i===hlLine?`<span class="hl">${esc(l)||' '}</span>`:esc(l)).join('\n');
  syncBackScroll();
}
function syncBackScroll(){const ta=$('#codeTa'),b=$('#codeBack');
  b.scrollTop=ta.scrollTop;b.scrollLeft=ta.scrollLeft}
function setCodeHighlight(line,scroll){
  hlLine=line;if(!state.codeOpen)return;
  renderBackdrop();
  if(line>=0&&scroll){
    const ta=$('#codeTa');
    const lh=parseFloat(getComputedStyle(ta).lineHeight)||19;
    ta.scrollTop=Math.max(0,(line-4)*lh);syncBackScroll();
  }
}
function jumpToEl(el){
  flushSerialize();
  const id=el.getAttribute(HS);if(id===null)return;
  /* serialize WITH ids; line numbers match the clean text since attrs don't add lines */
  const annLines=('<!DOCTYPE html>\n'+state.srcDoc.documentElement.outerHTML).split('\n');
  let line=annLines.findIndex(l=>l.includes(HS+'="'+id+'"'));
  if(line<0){setCodeHighlight(-1);return}
  const codeLines=$('#codeTa').value.split('\n');
  const tag='<'+el.tagName.toLowerCase();
  if(codeLines.length!==annLines.length||!codeLines[line].includes(tag)){
    /* code text was hand-edited since last sync — find the line by content instead */
    const clean=annLines[line].replace(/\s*data-hs-id="\d+"/g,'').trim();
    line=clean?codeLines.findIndex(l=>l.trim()===clean):-1;
    if(line<0)line=codeLines.findIndex(l=>l.includes(tag));
    if(line<0){setCodeHighlight(-1);return}
  }
  setCodeHighlight(line,true);
}
const codeChanged=debounce(()=>{
  if(!state.cur)return;
  state.cur.html=$('#codeTa').value;
  histPush(state.cur.html);
  renderFrame();
},600);
$('#codeTa').addEventListener('input',()=>{setDirty(true);hlLine=-1;renderBackdrop();codeChanged()});
$('#codeTa').addEventListener('scroll',syncBackScroll);
$('#codeTa').addEventListener('keydown',e=>{
  if(e.key==='Tab'){e.preventDefault();
    const t=e.target,s=t.selectionStart;
    t.setRangeText('  ',s,t.selectionEnd,'end');t.dispatchEvent(new Event('input'))}});

/* reverse mapping: click a code line → select the element in the page (Edit mode) */
$('#codeTa').addEventListener('click',()=>{
  if(state.mmode!=='edit'||!state.srcDoc)return;
  flushSerialize();
  const ta=$('#codeTa');
  if(ta.selectionStart!==ta.selectionEnd)return; /* user is selecting text */
  const line=ta.value.slice(0,ta.selectionStart).split('\n').length-1;
  selectElementAtLine(line);
});
function selectElementAtLine(line){
  /* mapping only holds while the code text matches serializeSrc() (same line count) */
  const annLines=('<!DOCTYPE html>\n'+state.srcDoc.documentElement.outerHTML).split('\n');
  if(annLines.length!==$('#codeTa').value.split('\n').length)return;
  for(let i=line;i>=0;i--){ /* walk up to the nearest line that opens an element */
    const m=annLines[i].match(/data-hs-id="(\d+)"/);
    if(!m)continue;
    const fr=$('#frameWrap iframe');
    const el=fr&&fr.contentDocument&&fr.contentDocument.querySelector(`[${HS}="${m[1]}"]`);
    if(el){selectDisplayEl(el,{noJump:true,scrollPage:true});setCodeHighlight(i)}
    return;
  }
}

/* ---------- inspector ---------- */
/* section open/closed state persists for the session */
const inspOpen={'Colors & font':true,'Spacing':true};
const SHADOWS={subtle:'0 1px 3px rgba(0,0,0,.2)',medium:'0 4px 14px rgba(0,0,0,.25)',
  large:'0 12px 32px rgba(0,0,0,.35)',glow:'0 0 18px rgba(84,200,255,.55)'};
function renderInspector(el){
  const insp=$('#edInspector');
  if(!el){insp.innerHTML=`<div class="hint"><b>Click any element</b> in the page to edit it.<br><br>
    You can change its text, colors, font, size, spacing, layout, borders, shadows, and attributes — or duplicate and delete it.<br><br>
    <b>Drag the selected element</b> to move it — <b>drag its ◢ handles</b> to resize it.<br><br>
    Scripts are paused while editing; switch the mouse to <b>Interact</b> to use the live page.<br><br>
    Open <b>‹/› Code</b> to see the clicked element highlighted in the source.</div>`;
    positionHandles();return}
  const win=el.ownerDocument.defaultView,cs=win.getComputedStyle(el);
  const leaf=el.children.length===0;
  const desc=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
    (el.classList.length?'.'+[...el.classList].join('.'):'');
  const colHex=rgbToHex(cs.color),bgHex=rgbToHex(cs.backgroundColor);
  const stv=p=>el.style.getPropertyValue(p);
  const num=v=>{const n=parseFloat(v);return isNaN(n)?'':String(n)};
  const opt=(vals,cur)=>vals.map(v=>
    `<option value="${v}"${(cur||'')===v?' selected':''}>${v||'(default)'}</option>`).join('');
  const spRow=prop=>['top','right','bottom','left'].map(side=>{
    const p=prop+'-'+side,v=el.style.getPropertyValue(p).replace('px','');
    return `<input type="number" step="1" data-sp="${p}" title="${p}" value="${/^-?\d+(\.\d+)?$/.test(v)?v:''}"
      placeholder="${Math.round(parseFloat(cs.getPropertyValue(p))||0)}">`}).join('');
  const isec=(title,body)=>`<details class="isec"${inspOpen[title]?' open':''} data-sec="${esc(title)}">
    <summary>${title}</summary><div class="ibody">${body}</div></details>`;
  const isFlex=cs.display==='flex'||cs.display==='inline-flex';
  const curShadow=stv('box-shadow')||(cs.boxShadow!=='none'?cs.boxShadow:'');
  const shadowKey=curShadow?(Object.entries(SHADOWS).find(([,v])=>v===curShadow)||['custom'])[0]:'';
  const crumbs=[];let cn=el;
  while(cn&&cn.getAttribute&&cn.getAttribute(HS)!==null){crumbs.unshift(cn);cn=cn.parentElement}
  const scopes=scopeOptions(el);
  const prevScope=($('#iScope')&&$('#iScope').value)||'';
  insp.innerHTML=`
    <div class="crumbs">body${crumbs.map((c,i)=>' › <span class="crumb'+(i===crumbs.length-1?' cur':'')+
      '" data-hs="'+c.getAttribute(HS)+'">'+esc(c.tagName.toLowerCase()+(c.id?'#'+c.id:''))+'</span>').join('')}</div>
    <div class="insp-tag">${esc(desc)}</div>
    ${scopes.length?`<div class="field"><label>Apply style edits to</label>
      <select id="iScope">
        <option value="">just this element</option>
        ${scopes.map(s=>`<option value="${esc(s.sel)}">all ${esc(s.sel)} (${s.n})</option>`).join('')}
      </select></div>`:''}
    <div class="field"><label>Text</label>
      ${leaf?`<textarea id="iText">${esc(el.textContent)}</textarea>`
        :`<div class="hint">This element contains other elements — click deeper to edit text directly.</div>`}
    </div>
    ${isec('Colors & font',`
    <div class="field"><label>Text color</label>
      <div class="colorrow"><input type="color" id="iColor" value="${colHex||'#000000'}">
        <span class="val" id="iColorV">${colHex||'transparent'}</span>
        <button id="iColorX" title="Remove override">reset</button></div></div>
    <div class="field"><label>Background</label>
      <div class="colorrow"><input type="color" id="iBg" value="${bgHex||'#ffffff'}">
        <span class="val" id="iBgV">${bgHex||'transparent'}</span>
        <button id="iBgX" title="Remove override">reset</button></div></div>
    <div class="field"><label>Font family</label>
      <div class="fontrow"><input type="text" id="iFont" list="fontList" value="${esc(el.style.fontFamily||'')}"
        placeholder="${esc(cs.fontFamily.split(',')[0].replace(/"/g,''))}">
        <button id="iFontPick" title="Built-in font stacks (work on any machine)">🅰</button></div></div>
    <div class="field"><label>Font size</label>
      <div class="sizerow"><input type="number" id="iSize" step="0.5" min="1"
          placeholder="${parseFloat(cs.fontSize)}">
        <select id="iUnit"><option>px</option><option>em</option><option>rem</option><option>%</option></select>
        <button id="iSizeX" title="Remove override">reset</button></div></div>`)}
    ${isec('Spacing',`
    <div class="field"><label>Margin (px)</label><div class="boxrow">${spRow('margin')}</div></div>
    <div class="field"><label>Padding (px)</label><div class="boxrow">${spRow('padding')}</div>
      <div class="boxcap"><span>top</span><span>right</span><span>bottom</span><span>left</span></div></div>`)}
    ${isec('Layout & size',`
    <div class="field"><label>Width · Height (px)</label>
      <div class="boxrow"><input type="number" id="iW" value="${num(stv('width'))}" placeholder="${Math.round(parseFloat(cs.width)||0)}">
        <input type="number" id="iH" value="${num(stv('height'))}" placeholder="${Math.round(parseFloat(cs.height)||0)}"></div>
      <div class="boxcap"><span style="width:50%">width</span><span style="width:50%">height</span></div></div>
    <div class="field"><label>Display</label><select id="iDisp">
      ${['','block','inline-block','inline','flex','grid','none'].map(d=>
        `<option value="${d}"${(stv('display')||'')===d?' selected':''}>${d||'(default: '+cs.display+')'}</option>`).join('')}
    </select></div>
    ${isFlex?`
    <div class="field"><label>Flex direction · wrap</label><div class="boxrow">
      <select id="iFDir" style="width:50%">${opt(['','row','column','row-reverse','column-reverse'],stv('flex-direction'))}</select>
      <select id="iFWrap" style="width:50%">${opt(['','nowrap','wrap'],stv('flex-wrap'))}</select></div></div>
    <div class="field"><label>Justify · align</label><div class="boxrow">
      <select id="iFJus" style="width:50%">${opt(['','flex-start','center','flex-end','space-between','space-around','space-evenly'],stv('justify-content'))}</select>
      <select id="iFAli" style="width:50%">${opt(['','stretch','flex-start','center','flex-end','baseline'],stv('align-items'))}</select></div></div>
    <div class="field"><label>Gap (px)</label>
      <input type="number" id="iFGap" min="0" value="${num(stv('gap'))}" placeholder="${Math.round(parseFloat(cs.gap)||0)}"></div>`:''}
    <div class="field"><label>Text align</label>
      <select id="iTAlign">${opt(['','left','center','right','justify'],stv('text-align'))}</select></div>`)}
    ${isec('Border & effects',`
    <div class="field"><label>Border width · style</label><div class="boxrow">
      <input type="number" id="iBW" min="0" value="${num(stv('border-width'))}" placeholder="${Math.round(parseFloat(cs.borderTopWidth)||0)}">
      <select id="iBSty" style="width:60%">${opt(['','none','solid','dashed','dotted','double'],stv('border-style'))}</select></div></div>
    <div class="field"><label>Border color</label>
      <div class="colorrow"><input type="color" id="iBCol" value="${rgbToHex(cs.borderTopColor)||'#000000'}">
        <span class="val">${rgbToHex(cs.borderTopColor)||'transparent'}</span></div></div>
    <div class="field"><label>Corner radius (px)</label>
      <input type="number" id="iRad" min="0" value="${num(stv('border-radius'))}" placeholder="${Math.round(parseFloat(cs.borderTopLeftRadius)||0)}"></div>
    <div class="field"><label>Shadow</label><select id="iShadow">
      <option value=""${shadowKey===''?' selected':''}>none</option>
      ${Object.keys(SHADOWS).map(k=>`<option value="${k}"${shadowKey===k?' selected':''}>${k}</option>`).join('')}
      <option value="custom"${shadowKey==='custom'?' selected':''}>custom…</option></select>
      ${shadowKey==='custom'?`<textarea id="iShadowT" style="min-height:40px;font-size:11px;margin-top:6px">${esc(curShadow)}</textarea>`:''}</div>
    <div class="field"><label>Opacity <span class="val" id="iOpaV">${Math.round((parseFloat(cs.opacity)||1)*100)}%</span></label>
      <input type="range" id="iOpa" min="5" max="100" value="${Math.round((parseFloat(cs.opacity)||1)*100)}"></div>`)}
    ${isec('Attributes','<div id="attrList"></div>')}
    <div class="insp-actions">
      <button id="iDup">⧉ Duplicate element</button>
      <button class="danger" id="iDelete">🗑 Delete element</button>
      <button class="ghost" id="iDeselect">Deselect</button>
    </div>`;
  /* keep the chosen scope when the inspector re-renders on the same element (e.g. after a reset) */
  const scopeEl=$('#iScope');
  if(scopeEl&&prevScope&&[...scopeEl.options].some(o=>o.value===prevScope))scopeEl.value=prevScope;
  insp.querySelectorAll('details.isec').forEach(d=>d.ontoggle=()=>{inspOpen[d.dataset.sec]=d.open});
  insp.querySelectorAll('.crumb:not(.cur)').forEach(c=>c.onclick=()=>{
    const t=el.ownerDocument.querySelector(`[${HS}="${c.dataset.hs}"]`);
    if(t)selectDisplayEl(t,{scrollPage:true});
  });
  insp.querySelectorAll('[data-sp]').forEach(inp=>inp.oninput=()=>
    applyStyle(inp.dataset.sp,inp.value!==''?inp.value+'px':null));
  renderAttrs();
  $('#iDup').onclick=()=>{
    flushSerialize();
    const s=srcEl();if(!s)return;
    s.after(s.cloneNode(true)); /* renderFrame re-annotates, so ids stay unique */
    state.cur.html=serializeSrc();histPush(state.cur.html);setDirty(true);
    renderFrame();refreshCodeText();toast('Element duplicated (copy placed right after the original)');
  };
  const iText=$('#iText');
  if(iText)iText.oninput=()=>{const s=srcEl();if(!s)return;
    el.textContent=iText.value;s.textContent=iText.value;scheduleSerialize()};
  $('#iColor').oninput=e=>{applyStyle('color',e.target.value);$('#iColorV').textContent=e.target.value};
  $('#iColorX').onclick=()=>{applyStyle('color',null);renderInspector(el)};
  $('#iBg').oninput=e=>{applyStyle('background-color',e.target.value);$('#iBgV').textContent=e.target.value};
  $('#iBgX').onclick=()=>{applyStyle('background-color',null);renderInspector(el)};
  $('#iFont').onchange=e=>applyStyle('font-family',e.target.value||null);
  $('#iFontPick').onclick=e=>{e.preventDefault();
    openFontMenu(e.target,stack=>{$('#iFont').value=stack;applyStyle('font-family',stack)})};
  const sizeApply=()=>{const v=$('#iSize').value;
    applyStyle('font-size',v?v+$('#iUnit').value:null)};
  $('#iSize').oninput=sizeApply;$('#iUnit').onchange=sizeApply;
  $('#iSizeX').onclick=()=>{$('#iSize').value='';applyStyle('font-size',null)};
  /* layout & size */
  const pxInput=(id,prop)=>{const i2=$(id);
    if(i2)i2.oninput=()=>applyStyle(prop,i2.value!==''?i2.value+'px':null)};
  pxInput('#iW','width');pxInput('#iH','height');pxInput('#iFGap','gap');pxInput('#iRad','border-radius');
  const selInput=(id,prop,rerender)=>{const s2=$(id);
    if(s2)s2.onchange=()=>{applyStyle(prop,s2.value||null);if(rerender)renderInspector(el)}};
  selInput('#iDisp','display',true); /* re-render so the flex controls appear/disappear */
  selInput('#iFDir','flex-direction');selInput('#iFWrap','flex-wrap');
  selInput('#iFJus','justify-content');selInput('#iFAli','align-items');
  selInput('#iTAlign','text-align');
  /* border & effects */
  const bw=$('#iBW');
  if(bw)bw.oninput=()=>{
    applyStyle('border-width',bw.value!==''?bw.value+'px':null);
    /* a width with no visible style shows nothing — default to solid once */
    if(bw.value&&cs.borderTopStyle==='none'&&!$('#iBSty').value){
      $('#iBSty').value='solid';applyStyle('border-style','solid');
    }
  };
  selInput('#iBSty','border-style');
  const bc=$('#iBCol');if(bc)bc.oninput=()=>applyStyle('border-color',bc.value);
  const sh=$('#iShadow');
  if(sh)sh.onchange=()=>{
    const v=sh.value;
    const old=$('#iShadowT');if(old&&v!=='custom')old.remove();
    if(v==='custom'){
      if(!$('#iShadowT')){
        const taEl=document.createElement('textarea');
        taEl.id='iShadowT';taEl.style.minHeight='40px';taEl.style.fontSize='11px';taEl.style.marginTop='6px';
        taEl.value=curShadow||'0 4px 14px rgba(0,0,0,.25)';
        sh.parentElement.appendChild(taEl);
        taEl.oninput=()=>applyStyle('box-shadow',taEl.value||null);
        taEl.oninput();
      }
    }else applyStyle('box-shadow',v?SHADOWS[v]:null);
  };
  const shT=$('#iShadowT');if(shT)shT.oninput=()=>applyStyle('box-shadow',shT.value||null);
  const op=$('#iOpa');
  if(op)op.oninput=()=>{
    $('#iOpaV').textContent=op.value+'%';
    applyStyle('opacity',op.value==='100'?null:String(op.value/100));
  };
  $('#iDelete').onclick=()=>{const s=srcEl();if(!s)return;
    el.remove();s.remove();state.selEl=null;
    scheduleSerialize();flushSerialize();setCodeHighlight(-1);renderInspector(null)};
  $('#iDeselect').onclick=()=>{el.removeAttribute('data-hs-sel');state.selEl=null;
    setCodeHighlight(-1);renderInspector(null)};
}
/* editable attribute list — reads from the SOURCE element (display has on* stripped) */
function renderAttrs(){
  const list=$('#attrList'),s=srcEl();
  if(!list||!s)return;
  const attrs=[...s.attributes].filter(a=>!/^data-hs-/.test(a.name)&&a.name!=='style');
  list.innerHTML=attrs.map(a=>`
    <div class="attrrow"><input class="an" data-orig="${esc(a.name)}" value="${esc(a.name)}">
      <input class="av" data-n="${esc(a.name)}" value="${esc(a.value)}">
      <button class="ax" data-n="${esc(a.name)}" title="Remove attribute">✕</button></div>`).join('')+
    `<div class="attrrow"><input class="an" id="attrNewN" placeholder="name">
      <input class="av" id="attrNewV" placeholder="value">
      <button id="attrAdd" title="Add attribute">＋</button></div>`;
  list.querySelectorAll('.an:not(#attrNewN)').forEach(inp=>inp.onchange=()=>
    commitAttr(inp.dataset.orig,inp.value,inp.parentElement.querySelector('.av').value));
  list.querySelectorAll('.av:not(#attrNewV)').forEach(inp=>inp.onchange=()=>
    commitAttr(inp.dataset.n,inp.dataset.n,inp.value));
  list.querySelectorAll('.ax').forEach(b=>b.onclick=()=>commitAttr(b.dataset.n,'',''));
  $('#attrAdd').onclick=()=>{const n=$('#attrNewN').value.trim();
    if(n)commitAttr(null,n,$('#attrNewV').value)};
  $('#attrNewV').onkeydown=e=>{if(e.key==='Enter')$('#attrAdd').click()};
}
function commitAttr(oldName,name,val){
  const s=srcEl();if(!s)return;
  name=(name||'').trim();
  if(oldName&&oldName!==name){
    s.removeAttribute(oldName);
    if(!/^on/i.test(oldName))try{state.selEl.removeAttribute(oldName)}catch{}
  }
  if(name){
    try{s.setAttribute(name,val)}catch{toast('Invalid attribute name');renderAttrs();return}
    /* inline event handlers must stay inert in the edit-mode display */
    if(!/^on/i.test(name))try{state.selEl.setAttribute(name,val)}catch{}
  }
  scheduleSerialize();renderAttrs();
}

/* ======================= insert elements ======================= */
async function insertHtmlAfterSelection(html){
  if(!state.cur)return;
  if(state.mmode!=='edit'){syncNow();state.mmode='edit';updateModeUI();renderFrame()}
  flushSerialize();
  const tpl=state.srcDoc.createElement('template');
  tpl.innerHTML=html;
  const node=tpl.content.firstElementChild;
  if(!node)return;
  const s=srcEl();
  if(s)s.after(node);else state.srcDoc.body.appendChild(node);
  /* document-order index survives renderFrame's re-annotation */
  const idx=[...state.srcDoc.querySelectorAll('body *')].indexOf(node);
  state.cur.html=serializeSrc();histPush(state.cur.html);setDirty(true);
  renderFrame();refreshCodeText();
  /* select the new element once the fresh display iframe is ready */
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,60));
    if(dispDoc&&dispDoc.body){
      const el=dispDoc.querySelector(`[${HS}="${idx}"]`);
      if(el){selectDisplayEl(el,{scrollPage:true});break}
    }
  }
}

/* ======================= presenter mode ======================= */
const PRESENT_JS="(function(){"+
  "var s=[].slice.call(document.querySelectorAll('section'));"+
  "if(s.length<2)s=[].slice.call(document.body.children).filter(function(el){return !/^(SCRIPT|STYLE)$/.test(el.tagName)});"+
  "if(!s.length)return;var i=0;"+
  "var hud=document.createElement('div');"+
  "hud.style.cssText='position:fixed;right:14px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;font:12px system-ui;padding:5px 12px;border-radius:99px;z-index:2147483647;transition:opacity .5s';"+
  "document.body.appendChild(hud);"+
  "function go(n){i=Math.max(0,Math.min(s.length-1,n));s[i].scrollIntoView({behavior:'smooth'});"+
  "hud.textContent=(i+1)+' / '+s.length+'   \\u2190 \\u2192   Esc';hud.style.opacity='1'}"+
  "addEventListener('keydown',function(e){"+
  "if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();go(i+1)}"+
  "else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(i-1)}"+
  "else if(e.key==='Escape'){parent.postMessage('hs-exit-present','*')}});"+
  "go(0);setTimeout(function(){hud.style.opacity='.35'},3000);"+
  "})();";
$('#btnPresent').onclick=()=>{
  if(!state.cur)return;
  syncNow();
  let html=applyAssetCache(state.cur.html);
  const inj='<script>'+PRESENT_JS+'<'+'/script>';
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,()=>inj+'</body>'):html+inj;
  const ov=document.createElement('div');ov.id='presentOv';
  const fr=document.createElement('iframe');
  fr.setAttribute('sandbox','allow-scripts allow-modals allow-forms allow-popups');
  fr.srcdoc=html;
  fr.onload=()=>{try{fr.contentWindow.focus()}catch{}};
  ov.appendChild(fr);document.body.appendChild(ov);
  const close=()=>{ov.remove();
    removeEventListener('message',onMsg);
    document.removeEventListener('fullscreenchange',onFs);
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})};
  ov._close=close; /* the global Escape handler uses this */
  const onMsg=ev=>{if(ev.data==='hs-exit-present')close()};
  const onFs=()=>{if(!document.fullscreenElement)close()};
  addEventListener('message',onMsg);
  if(ov.requestFullscreen)
    ov.requestFullscreen().then(()=>document.addEventListener('fullscreenchange',onFs)).catch(()=>{});
};

/* ======================= preview width presets ======================= */
function applyPreviewWidth(){
  const fr=$('#frameWrap iframe');if(!fr)return;
  const w=$('#widthSel').value;
  fr.classList.toggle('fitw',!!w);
  fr.style.width=w?w+'px':'';
}
$('#widthSel').onchange=applyPreviewWidth;

/* ======================= autosave drafts (crash recovery) ======================= */
function saveDraft(){
  if(!state.cur||!state.dirty)return;
  syncNow();
  idb.put('drafts',{fileId:verKey(),ts:Date.now(),html:state.cur.html}).catch(()=>{});
}
setInterval(saveDraft,10000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveDraft()});

/* ======================= resizable code panel ======================= */
$('#codeResizer').onmousedown=e=>{
  e.preventDefault();
  const startX=e.clientX,startW=$('#codePanel').getBoundingClientRect().width;
  document.body.classList.add('resizing');
  const mv=ev=>{$('#codePanel').style.width=Math.min(Math.max(startW+(startX-ev.clientX),240),innerWidth*.8)+'px'};
  const up=()=>{document.body.classList.remove('resizing');
    removeEventListener('mousemove',mv);removeEventListener('mouseup',up)};
  addEventListener('mousemove',mv);addEventListener('mouseup',up);
};


export { setDirty, openFile, offerDraftRecovery, showLibrary, saveCur, syncNow, updateModeUI, setMMode, HS, renderFrame, attachEditHandlers, selectDisplayEl, srcEl, getDispDoc, serializeSrc, serialT, scheduleSerialize, doSerialize, flushSerialize, applyStyle, ensureRuleSheet, parseRuleText, setScopedRule, scopeOptions, hlLine, updateFileJump, refreshCodeText, renderBackdrop, syncBackScroll, setCodeHighlight, jumpToEl, codeChanged, selectElementAtLine, renderInspector, renderAttrs, commitAttr, applyPreviewWidth, saveDraft, insertHtmlAfterSelection };
