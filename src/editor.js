import { $, $$, debounce, esc, rgbToHex, toast } from './utils.js';
import { idb } from './db.js';
import { state } from './state.js';
import { downloadFile, normalizeName, renderLibrary } from './library.js';
import { applyAssetCache, saveDiskProject } from './disk.js';
import { histGo, histInit, histPush, pushVersion, verKey } from './history.js';
import { closeThemePanel } from './colors.js';

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
  state.selEl=null;
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
      '[data-hs-drop-before]{box-shadow:0 -3px 0 0 #4cd97b!important}'+
      '[data-hs-drop-after]{box-shadow:0 3px 0 0 #4cd97b!important}';
    disp.head.appendChild(st);
    fr.onload=()=>attachEditHandlers(fr.contentDocument);
    wrap.appendChild(fr);
    fr.srcdoc=applyAssetCache('<!DOCTYPE html>\n'+disp.documentElement.outerHTML);
    renderInspector(null);
  }
  applyPreviewWidth();
}
function attachEditHandlers(doc){
  if(!doc||!doc.body)return;
  doc.body.addEventListener('mouseover',e=>{
    doc.querySelectorAll('[data-hs-hover]').forEach(el=>el.removeAttribute('data-hs-hover'));
    const t=e.target.closest('['+HS+']');if(t)t.setAttribute('data-hs-hover','')},true);
  doc.body.addEventListener('mouseout',()=>{
    doc.querySelectorAll('[data-hs-hover]').forEach(el=>el.removeAttribute('data-hs-hover'))},true);
  /* drag the SELECTED element to move it before/after any other element */
  let drag=null,justDragged=false;
  const clearMarks=()=>doc.querySelectorAll('[data-hs-drop-before],[data-hs-drop-after]')
    .forEach(el=>{el.removeAttribute('data-hs-drop-before');el.removeAttribute('data-hs-drop-after')});
  doc.body.addEventListener('mousedown',e=>{
    const t=e.target.closest('['+HS+']');
    if(!t||t!==state.selEl)return; /* only the selected element is draggable */
    drag={el:t,x:e.clientX,y:e.clientY,active:false,target:null,before:false};
  },true);
  doc.body.addEventListener('mousemove',e=>{
    if(!drag)return;
    if(!drag.active){
      if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<6)return;
      drag.active=true;doc.body.style.cursor='grabbing';
    }
    clearMarks();drag.target=null;
    const t=doc.elementFromPoint(e.clientX,e.clientY);
    const tgt=t&&t.closest('['+HS+']');
    if(!tgt||tgt===drag.el||drag.el.contains(tgt))return;
    const r=tgt.getBoundingClientRect();
    drag.before=e.clientY<r.top+r.height/2;
    tgt.setAttribute(drag.before?'data-hs-drop-before':'data-hs-drop-after','');
    drag.target=tgt;
  },true);
  doc.body.addEventListener('mouseup',()=>{
    if(!drag)return;
    const d=drag;drag=null;doc.body.style.cursor='';clearMarks();
    if(!d.active)return;
    justDragged=true; /* swallow the click this drag generates */
    if(!d.target)return;
    const s=srcEl();
    const st2=state.srcDoc.querySelector(`[${HS}="${d.target.getAttribute(HS)}"]`);
    if(!s||!st2)return;
    if(d.before){d.target.before(d.el);st2.before(s)}
    else{d.target.after(d.el);st2.after(s)}
    scheduleSerialize();
    if(state.codeOpen)jumpToEl(d.el);
  },true);
  doc.addEventListener('mouseleave',()=>{if(drag){drag=null;doc.body.style.cursor='';clearMarks()}});
  doc.body.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(justDragged){justDragged=false;return}
    const t=e.target.closest('['+HS+']');if(!t)return;
    selectDisplayEl(t)},true);
  doc.addEventListener('keydown',e=>{ /* shortcuts still work when focus is inside the page */
    if(!(e.ctrlKey||e.metaKey))return;
    const k=e.key.toLowerCase();
    if(k==='s'){e.preventDefault();saveCur()}
    else if(k==='z'){e.preventDefault();histGo(e.shiftKey?1:-1)}
    else if(k==='y'){e.preventDefault();histGo(1)}
  });
}
function selectDisplayEl(t,opt={}){
  const doc=t.ownerDocument;
  doc.querySelectorAll('[data-hs-sel]').forEach(el=>el.removeAttribute('data-hs-sel'));
  t.setAttribute('data-hs-sel','');
  if(opt.scrollPage)t.scrollIntoView({block:'center'});
  state.selEl=t;renderInspector(t);
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
  if(state.srcDoc&&state.mmode==='edit'){state.cur.html=serializeSrc();histPush(state.cur.html);refreshCodeText()}}
function flushSerialize(){if(serialT){clearTimeout(serialT);doSerialize()}}
function applyStyle(prop,val){
  const scopeSel=$('#iScope');
  if(scopeSel&&scopeSel.value){setScopedRule(scopeSel.value,prop,val);return}
  const s=srcEl();if(!s||!state.selEl)return;
  if(val===null){state.selEl.style.removeProperty(prop);s.style.removeProperty(prop);
    if(!s.getAttribute('style'))s.removeAttribute('style');}
  else{state.selEl.style.setProperty(prop,val);s.style.setProperty(prop,val);}
  scheduleSerialize();
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
function renderInspector(el){
  const insp=$('#edInspector');
  if(!el){insp.innerHTML=`<div class="hint"><b>Click any element</b> in the page to edit it.<br><br>
    You can change its text, colors, font, size, spacing, and attributes — or duplicate and delete it.<br><br>
    <b>Drag the selected element</b> to move it somewhere else on the page.<br><br>
    Scripts are paused while editing; switch the mouse to <b>Interact</b> to use the live page.<br><br>
    Open <b>‹/› Code</b> to see the clicked element highlighted in the source.</div>`;return}
  const win=el.ownerDocument.defaultView,cs=win.getComputedStyle(el);
  const leaf=el.children.length===0;
  const desc=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
    (el.classList.length?'.'+[...el.classList].join('.'):'');
  const colHex=rgbToHex(cs.color),bgHex=rgbToHex(cs.backgroundColor);
  const spRow=prop=>['top','right','bottom','left'].map(side=>{
    const p=prop+'-'+side,v=el.style.getPropertyValue(p).replace('px','');
    return `<input type="number" step="1" data-sp="${p}" title="${p}" value="${/^-?\d+(\.\d+)?$/.test(v)?v:''}"
      placeholder="${Math.round(parseFloat(cs.getPropertyValue(p))||0)}">`}).join('');
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
    <div class="field"><label>Text color</label>
      <div class="colorrow"><input type="color" id="iColor" value="${colHex||'#000000'}">
        <span class="val" id="iColorV">${colHex||'transparent'}</span>
        <button id="iColorX" title="Remove override">reset</button></div></div>
    <div class="field"><label>Background</label>
      <div class="colorrow"><input type="color" id="iBg" value="${bgHex||'#ffffff'}">
        <span class="val" id="iBgV">${bgHex||'transparent'}</span>
        <button id="iBgX" title="Remove override">reset</button></div></div>
    <div class="field"><label>Font family</label>
      <input type="text" id="iFont" list="fontList" value="${esc(el.style.fontFamily||'')}"
        placeholder="${esc(cs.fontFamily.split(',')[0].replace(/"/g,''))}"></div>
    <div class="field"><label>Font size</label>
      <div class="sizerow"><input type="number" id="iSize" step="0.5" min="1"
          placeholder="${parseFloat(cs.fontSize)}">
        <select id="iUnit"><option>px</option><option>em</option><option>rem</option><option>%</option></select>
        <button id="iSizeX" title="Remove override">reset</button></div></div>
    <div class="field"><label>Margin (px)</label><div class="boxrow">${spRow('margin')}</div></div>
    <div class="field"><label>Padding (px)</label><div class="boxrow">${spRow('padding')}</div>
      <div class="boxcap"><span>top</span><span>right</span><span>bottom</span><span>left</span></div></div>
    <div class="field"><label>Attributes</label><div id="attrList"></div></div>
    <div class="insp-actions">
      <button id="iDup">⧉ Duplicate element</button>
      <button class="danger" id="iDelete">🗑 Delete element</button>
      <button class="ghost" id="iDeselect">Deselect</button>
    </div>`;
  /* keep the chosen scope when the inspector re-renders on the same element (e.g. after a reset) */
  const scopeEl=$('#iScope');
  if(scopeEl&&prevScope&&[...scopeEl.options].some(o=>o.value===prevScope))scopeEl.value=prevScope;
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
  const sizeApply=()=>{const v=$('#iSize').value;
    applyStyle('font-size',v?v+$('#iUnit').value:null)};
  $('#iSize').oninput=sizeApply;$('#iUnit').onchange=sizeApply;
  $('#iSizeX').onclick=()=>{$('#iSize').value='';applyStyle('font-size',null)};
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


export { setDirty, openFile, offerDraftRecovery, showLibrary, saveCur, syncNow, updateModeUI, setMMode, HS, renderFrame, attachEditHandlers, selectDisplayEl, srcEl, serializeSrc, serialT, scheduleSerialize, doSerialize, flushSerialize, applyStyle, ensureRuleSheet, parseRuleText, setScopedRule, scopeOptions, hlLine, updateFileJump, refreshCodeText, renderBackdrop, syncBackScroll, setCodeHighlight, jumpToEl, codeChanged, selectElementAtLine, renderInspector, renderAttrs, commitAttr, applyPreviewWidth, saveDraft };
