import { $, debounce, esc } from './utils.js';
import { state } from './state.js';
import { showModal, hideModal } from './ui.js';
import { setMMode, renderFrame, flushSerialize, serializeSrc, refreshCodeText, setDirty,
  selectDisplayEl, srcEl, getDispDoc, HS } from './editor.js';
import { histPush } from './history.js';

/* ======================= slide filmstrip (slideshows only) =======================
   The editor stays ONE editor, and slideshows are EXPLICIT (2+ sections was a
   false-positive machine — plain documents use <section> too). A file gets the
   🎞 button, the filmstrip, and the Insert "Slide" item only when:
   - the shelf file carries a "slideshow" tag (the normal tags UI adds/removes it), or
   - the file itself marks its body with data-hs-slideshow — that marker travels
     with the file (share links, downloads, disk files) and is how the deck
     template opts in. Everything else sees none of the slide UI. */

function isSlideshow(cur){
  if(!cur)return false;
  if((cur.tags||[]).some(t=>/^slide ?show$/i.test(t)))return true;
  return/data-hs-slideshow/.test(cur.html||'');
}
function getSlides(doc){return[...doc.querySelectorAll('section')]}

let activeSlide=0;

/* ---------- slide layouts (add-slide picker) ---------- */
/* inner HTML only — the <section> wrapper + deck base class come from addSlide,
   so layouts inherit the deck's own styling. Inline styles only where a layout
   needs structure the deck CSS can't know about. */
const SLIDE_LAYOUTS=[
  {ic:'🔤',name:'Title',html:'\n  <h1>Big statement</h1>\n  <p>One supporting line under it.</p>\n'},
  {ic:'📋',name:'Bullets',html:'\n  <h2>Topic</h2>\n  <ul>\n    <li>First point</li>\n    <li>Second point</li>\n    <li>Third point</li>\n  </ul>\n'},
  {ic:'🀫',name:'Two columns',html:'\n  <h2>Side by side</h2>\n  <div style="display:flex;gap:6vw;align-items:flex-start">\n    <div style="flex:1"><h3>Left</h3><p>First half.</p></div>\n    <div style="flex:1"><h3>Right</h3><p>Second half.</p></div>\n  </div>\n'},
  {ic:'❝',name:'Quote',html:'\n  <blockquote style="font-size:4.5vh;line-height:1.4;margin:0;font-style:italic">&ldquo;Something worth quoting.&rdquo;</blockquote>\n  <p style="opacity:.7;margin-top:3vh">— who said it</p>\n'},
  {ic:'➖',name:'Section divider',html:'\n  <h1 style="text-align:center">Next chapter</h1>\n'},
  {ic:'⬜',name:'Blank',html:'\n'},
];
let layoutMenu=null;
function closeLayoutMenu(){
  if(layoutMenu){layoutMenu.remove();layoutMenu=null;
    document.removeEventListener('mousedown',onLayoutOutside,true)}
}
function onLayoutOutside(e){if(layoutMenu&&!layoutMenu.contains(e.target))closeLayoutMenu()}
function openLayoutMenu(anchor,afterIdx){
  closeLayoutMenu();
  layoutMenu=document.createElement('div');layoutMenu.id='layoutMenu';
  layoutMenu.innerHTML=SLIDE_LAYOUTS.map((l,i)=>
    `<button data-i="${i}"><span class="iic">${l.ic}</span><span>${l.name}</span></button>`).join('');
  document.body.appendChild(layoutMenu);
  const r=anchor.getBoundingClientRect(),mh=layoutMenu.offsetHeight;
  layoutMenu.style.top=(r.bottom+6+mh>innerHeight?Math.max(8,r.top-mh-6):r.bottom+6)+'px';
  layoutMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-200))+'px';
  layoutMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const l=SLIDE_LAYOUTS[+b.dataset.i];closeLayoutMenu();addSlide(afterIdx,l.html)});
  setTimeout(()=>document.addEventListener('mousedown',onLayoutOutside,true),0);
}

/* ---------- structural ops: mutate srcDoc, commit like every other edit ---------- */
function withEdit(fn){
  if(!state.cur)return;
  if(state.mmode!=='edit')setMMode('edit');
  flushSerialize();
  if(!state.srcDoc)return;
  if(fn()===false)return;
  syncDecoCount(); /* keep the "n / total" in the numbers style honest */
  state.cur.html=serializeSrc();histPush(state.cur.html);setDirty(true);
  renderFrame();refreshCodeText();
}
function addSlide(afterIdx,layoutHtml){
  withEdit(()=>{
    const secs=getSlides(state.srcDoc);
    const ref=secs[Math.min(afterIdx??secs.length-1,secs.length-1)];
    const s=state.srcDoc.createElement('section');
    /* inherit the deck's BASE slide styling: only classes every slide shares —
       per-slide modifiers (title, accent…) must not leak onto new slides */
    if(secs.length){
      const sets=secs.map(x=>new Set(x.classList));
      s.className=[...sets[0]].filter(c=>sets.every(t=>t.has(c))).join(' ');
    }else s.className='slide';
    s.innerHTML=layoutHtml||'\n  <h2>New slide</h2>\n  <p>Double-click any text to edit it.</p>\n';
    if(ref)ref.after(s);else state.srcDoc.body.appendChild(s);
    activeSlide=ref?secs.indexOf(ref)+1:0;
  });
  focusSlide(activeSlide);
}
/* Insert-palette entry: layout picker, anchored at ＋ Insert, adding after the
   slide that holds the selection (else at the end) */
function addSlideAfterSelection(){
  if(state.mmode!=='edit')setMMode('edit');
  const s=srcEl(),sec=s&&s.closest('section');
  const idx=sec?getSlides(state.srcDoc).indexOf(sec):-1;
  openLayoutMenu($('#btnInsert'),idx>=0?idx:undefined);
}

/* ---------- slide numbers & footer (a managed style block INSIDE the file) ---------- */
const DECO_SEL='style[data-hs-slidedeco]';
function decoCSS(numbers,footer,total){
  let css='section{position:relative}body{counter-reset:hs-slide}section{counter-increment:hs-slide}';
  if(numbers)css+='section::after{content:counter(hs-slide)" / '+total+'";position:absolute;right:26px;bottom:18px;font:600 13px/1 system-ui;opacity:.5;pointer-events:none}';
  if(footer)css+='section::before{content:"'+footer.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'";position:absolute;left:26px;bottom:18px;font:600 13px/1 system-ui;opacity:.5;letter-spacing:.04em;pointer-events:none}';
  return css;
}
function parseDeco(txt){
  const f=/section::before\{content:"((?:[^"\\]|\\.)*)"/.exec(txt||'');
  return{numbers:/section::after/.test(txt||''),
    footer:f?f[1].replace(/\\"/g,'"').replace(/\\\\/g,'\\'):''};
}
function syncDecoCount(){
  const st=state.srcDoc&&state.srcDoc.querySelector(DECO_SEL);
  if(!st)return;
  const o=parseDeco(st.textContent);
  st.textContent=decoCSS(o.numbers,o.footer,getSlides(state.srcDoc).length);
}
function setDeco(numbers,footer){
  withEdit(()=>{
    const doc=state.srcDoc;
    let st=doc.querySelector(DECO_SEL);
    if(!numbers&&!footer){if(!st)return false;st.remove();return}
    if(!st){st=doc.createElement('style');st.setAttribute('data-hs-slidedeco','');doc.head.appendChild(st)}
    st.textContent=decoCSS(numbers,footer,getSlides(doc).length);
  });
}
function openDecoDialog(){
  if(!state.cur)return;
  if(state.mmode!=='edit')setMMode('edit');
  flushSerialize();
  const st=state.srcDoc&&state.srcDoc.querySelector(DECO_SEL);
  const cur=st?parseDeco(st.textContent):{numbers:false,footer:''};
  showModal(`<h3>Slide numbers &amp; footer</h3>
    <div class="mrow"><label>Numbers</label>
      <input type="checkbox" id="decoNum"${cur.numbers?' checked':''} style="flex:none;width:auto">
      <span style="color:var(--muted);font-size:12px">"3 / ${getSlides(state.srcDoc).length}" in the corner of every slide</span></div>
    <div class="mrow"><label>Footer</label><input type="text" id="decoFoot" value="${esc(cur.footer)}" placeholder="e.g. Team update · July 2026 (empty = none)"></div>
    <div class="mbtns"><button id="mCancel">Cancel</button><button class="primary" id="mOk">Apply</button></div>`);
  $('#mCancel').onclick=hideModal;
  $('#mOk').onclick=()=>{hideModal();setDeco($('#decoNum').checked,$('#decoFoot').value.trim())};
}
function dupSlide(i){
  withEdit(()=>{
    const sec=getSlides(state.srcDoc)[i];if(!sec)return false;
    const clone=sec.cloneNode(true);
    clone.removeAttribute(HS);
    clone.querySelectorAll('['+HS+']').forEach(el=>el.removeAttribute(HS));
    sec.after(clone);activeSlide=i+1;
  });
  focusSlide(activeSlide);
}
function delSlide(i){
  withEdit(()=>{
    const secs=getSlides(state.srcDoc);
    if(secs.length<2||!secs[i])return false; /* never delete the last slide */
    if(!confirm(`Delete slide ${i+1}?`))return false;
    secs[i].remove();activeSlide=Math.max(0,i-1);
  });
  focusSlide(activeSlide);
}
function moveSlide(i,d){
  withEdit(()=>{
    const secs=getSlides(state.srcDoc);
    const sec=secs[i],nb=secs[i+d];if(!sec||!nb)return false;
    d<0?nb.before(sec):nb.after(sec);activeSlide=i+d;
  });
  focusSlide(activeSlide);
}
/* scroll the editor to a slide and select it (polls — a fresh iframe may still be loading) */
async function focusSlide(i){
  for(let t=0;t<20;t++){
    const doc=getDispDoc();
    if(doc&&doc.body){
      const el=doc.querySelectorAll('section')[i];
      if(el){el.scrollIntoView({behavior:'smooth',block:'start'});selectDisplayEl(el);break}
    }
    await new Promise(r=>setTimeout(r,60));
  }
  activeSlide=i;markActive();
}

/* ---------- rendering ---------- */
/* one slide per thumbnail: full document, other sections hidden, scripts inert */
function slideThumbHtml(html,i){
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script').forEach(s=>s.setAttribute('type','text/plain'));
  [...doc.querySelectorAll('section')].forEach((s,j)=>{if(j!==i)s.setAttribute('data-hs-thumbhide','')});
  const st=doc.createElement('style');
  st.textContent='[data-hs-thumbhide]{display:none!important}html,body{overflow:hidden!important}';
  doc.head.appendChild(st);
  return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML;
}
function markActive(){
  $('#slideList')&&$('#slideList').querySelectorAll('.sthumb').forEach((t,i)=>
    t.classList.toggle('active',i===activeSlide));
}
function renderPanel(){
  const list=$('#slideList');if(!list)return;
  const html=state.cur.html;
  const n=(html.match(/<section[\s>]/gi)||[]).length;
  if(activeSlide>=n)activeSlide=Math.max(0,n-1);
  list.innerHTML=n?'':'<div class="hint" style="padding:4px 2px">No slides yet — ＋ Add creates the first one.</div>';
  for(let i=0;i<n;i++){
    const t=document.createElement('div');t.className='sthumb'+(i===activeSlide?' active':'');
    t.innerHTML=`<div class="twrap"></div><span class="snum">${i+1}</span>
      <div class="sops">
        <button data-op="add" title="Add slide after">＋</button>
        <button data-op="dup" title="Duplicate slide">⧉</button>
        <button data-op="up" title="Move up">↑</button>
        <button data-op="down" title="Move down">↓</button>
        <button data-op="del" title="Delete slide">✕</button>
      </div>`;
    const fr=document.createElement('iframe');
    fr.setAttribute('sandbox','');fr.loading='lazy';
    fr.srcdoc=slideThumbHtml(html,i);
    t.querySelector('.twrap').appendChild(fr);
    t.onclick=e=>{
      const op=e.target.dataset&&e.target.dataset.op;
      if(op){e.stopPropagation();
        if(op==='add')openLayoutMenu(e.target,i);
        if(op==='dup')dupSlide(i);
        if(op==='up')moveSlide(i,-1);
        if(op==='down')moveSlide(i,1);
        if(op==='del')delSlide(i);
        return;}
      if(state.mmode!=='edit')setMMode('edit');
      focusSlide(i);
    };
    list.appendChild(t);
  }
}
/* visibility: 🎞 button only for decks; panel follows the persisted toggle */
function refreshSlidesUI(){
  const deck=isSlideshow(state.cur);
  $('#btnSlides').classList.toggle('off',!deck);
  const show=deck&&localStorage.getItem('hs-slides')!=='0';
  $('#slidePanel').classList.toggle('off',!show);
  $('#btnSlides').classList.toggle('primary',show);
  if(show)renderPanel();
}
const refreshSoon=debounce(refreshSlidesUI,300);
addEventListener('hs-rendered',refreshSoon);
addEventListener('hs-edited',refreshSoon);

$('#btnSlides').onclick=()=>{
  localStorage.setItem('hs-slides',localStorage.getItem('hs-slides')==='0'?'1':'0');
  refreshSlidesUI();
};
$('#slideAdd').onclick=e=>openLayoutMenu(e.target,activeSlide);
$('#slideDeco').onclick=openDecoDialog;

export { isSlideshow, SLIDE_LAYOUTS, addSlide, addSlideAfterSelection, dupSlide, delSlide, moveSlide, focusSlide, refreshSlidesUI, setDeco, parseDeco, decoCSS };
