import { $, debounce, toast, withAppScrollbars } from './utils.js';
import { state } from './state.js';
import { applyAssetCache } from './disk.js';
import { hideModal, showModal } from './ui.js';
import { refreshCodeText, renderFrame, setCodeHighlight, setDirty, syncNow } from './editor.js';
import { histPush } from './history.js';
import { renderDiffHTML } from './diff.js';
import { renderThemePanel } from './colors.js';

/* ======================= AI round-trip ======================= */
function extractHtml(txt){
  const blocks=[...txt.matchAll(/```[a-zA-Z]*[ \t]*\n([\s\S]*?)```/g)].map(m=>m[1]);
  for(const c of blocks)if(/<!doctype|<html[\s>]/i.test(c))return c.trim();
  const m=txt.match(/<!doctype[\s\S]*<\/html\s*>/i)||txt.match(/<html[\s\S]*<\/html\s*>/i);
  if(m)return m[0].trim();
  const t=txt.trim();
  if(/^</.test(t)&&/<\/[a-z0-9]+\s*>$/i.test(t))return t; /* looks like raw HTML */
  return null;
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text)}
  catch{
    const t=document.createElement('textarea');t.value=text;
    document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();
  }
}
$('#btnAI').onclick=()=>{
  if(!state.cur)return;
  syncNow();
  showModal(`<h3>🤖 AI round-trip</h3>
    <div class="mrow"><label>Request</label>
      <input type="text" id="aiReq" placeholder="what should the AI change? (included in the copied prompt)"></div>
    <div class="mrow"><label></label>
      <button class="primary" id="aiCopy" style="flex:0 0 auto">⧉ Copy file + prompt</button>
      <span style="color:var(--muted);font-size:11.5px">Paste it into any AI chat, then paste the full reply below.</span></div>
    <div class="field"><label>AI response</label>
      <textarea id="aiPaste" style="min-height:110px" placeholder="Paste the AI's reply — the updated HTML is extracted automatically."></textarea></div>
    <div id="aiDiff"></div>
    <div class="mbtns"><button id="mCancel">Cancel</button>
      <button class="primary" id="aiAccept" disabled>✓ Accept changes</button></div>`,true);
  $('#mCancel').onclick=hideModal;
  let pending=null;
  const showTab=code=>{
    const body=$('#dBody');if(!body||!pending)return;
    $('#dTabCode').classList.toggle('primary',code);
    $('#dTabPrev').classList.toggle('primary',!code);
    if(code)body.innerHTML=renderDiffHTML(state.cur.html,pending);
    else{
      body.innerHTML='<div class="prevsplit"><div><div class="plabel">Current</div></div><div><div class="plabel">AI version</div></div></div>';
      const hosts=body.querySelectorAll('.prevsplit>div');
      [[hosts[0],state.cur.html],[hosts[1],pending]].forEach(([host,html])=>{
        const f=document.createElement('iframe');f.setAttribute('sandbox','');f.srcdoc=withAppScrollbars(applyAssetCache(html));host.appendChild(f);});
    }
  };
  const upd=debounce(()=>{
    const txt=$('#aiPaste').value;
    pending=extractHtml(txt);
    $('#aiAccept').disabled=!pending;
    const box=$('#aiDiff');
    if(!pending){
      box.innerHTML=txt.trim()?'<div class="hint">No complete HTML document found in the reply yet — make sure it includes the whole file.</div>':'';
      return;
    }
    box.innerHTML=`<div class="mrow"><button id="dTabCode" class="primary">Line diff</button>
      <button id="dTabPrev">Before / after</button></div><div id="dBody"></div>`;
    $('#dTabCode').onclick=()=>showTab(true);
    $('#dTabPrev').onclick=()=>showTab(false);
    showTab(true);
  },300);
  $('#aiPaste').oninput=upd;
  $('#aiCopy').onclick=async()=>{
    const req=$('#aiReq').value.trim()||'(describe your changes here)';
    const scaffold=[
      'You are editing a self-contained single-file HTML document.',
      '',
      'Rules:',
      '- Return the COMPLETE updated file as a single ```html code block — no explanations before or after.',
      '- Keep it fully self-contained: all CSS and JS inline, no external resources (no CDN links, no web fonts, no remote images).',
      ...(state.cur.assets&&Object.keys(state.cur.assets).length?
        ['- This document bundles linked files as <style data-hs-src="..."> and <script data-hs-src="..."> blocks. KEEP those attributes and blocks intact — they map back to real files on disk.']:[]),
      '- Preserve the existing content and structure except where the request requires changes.',
      '',
      'Request: '+req,
      '',
      '--- FILE: '+state.cur.name+' ---',
      '',
      state.cur.html
    ].join('\n');
    await copyText(scaffold);
    toast('Copied — paste it into your AI of choice');
  };
  $('#aiAccept').onclick=()=>{
    if(!pending)return;
    state.cur.html=pending;histPush(pending);setDirty(true);
    hideModal();setCodeHighlight(-1);renderFrame();refreshCodeText();
    if(state.themeOpen)renderThemePanel();
    toast('AI changes applied — Ctrl+Z to undo, Save to keep');
  };
};


export { extractHtml, copyText };
