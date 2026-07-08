import { $, debounce, esc, toast } from './utils.js';
import { state } from './state.js';
import { refreshCodeText, renderFrame, setCodeHighlight, setDirty, syncNow, updateModeUI } from './editor.js';
import { histPush } from './history.js';
import { openFontMenu } from './fonts.js';

/* ======================= file theme panel (🎨 Colors) ======================= */
/* operates only on CSS regions: <style> blocks and style="" attributes */
function mapCssRegions(html,fn){
  html=html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(m,a,css,b)=>a+fn(css)+b);
  html=html.replace(/(\bstyle\s*=\s*")([^"]*)(")/gi,(m,a,css,b)=>a+fn(css)+b);
  html=html.replace(/(\bstyle\s*=\s*')([^']*)(')/gi,(m,a,css,b)=>a+fn(css)+b);
  return html;
}
function hslToRgb(h,s,l){
  h=(((h%360)+360)%360)/360;
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  const f=t=>{t=((t%1)+1)%1;
    if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;
    if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};
  return[Math.round(f(h+1/3)*255),Math.round(f(h)*255),Math.round(f(h-1/3)*255)];
}
function parseColor(tok){
  let m;
  if(m=tok.match(/^#([0-9a-fA-F]{3,8})$/)){
    const h=m[1];
    if(h.length===3||h.length===4)return{r:parseInt(h[0]+h[0],16),g:parseInt(h[1]+h[1],16),
      b:parseInt(h[2]+h[2],16),a:h.length===4?parseInt(h[3]+h[3],16)/255:1};
    if(h.length===6||h.length===8)return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),
      b:parseInt(h.slice(4,6),16),a:h.length===8?parseInt(h.slice(6,8),16)/255:1};
    return null;
  }
  if(m=tok.match(/^rgba?\(([^)]*)\)$/i)){
    const p=m[1].split(/[,\/\s]+/).filter(Boolean).map(parseFloat);
    if(p.length<3||p.slice(0,3).some(isNaN))return null;
    return{r:Math.round(p[0]),g:Math.round(p[1]),b:Math.round(p[2]),a:p.length>3&&!isNaN(p[3])?p[3]:1};
  }
  if(m=tok.match(/^hsla?\(([^)]*)\)$/i)){
    const p=m[1].split(/[,\/\s%]+/).filter(Boolean).map(parseFloat);
    if(p.length<3||p.slice(0,3).some(isNaN))return null;
    const[r,g,b]=hslToRgb(p[0],p[1]/100,p[2]/100);
    return{r,g,b,a:p.length>3&&!isNaN(p[3])?p[3]:1};
  }
  return null;
}
const toHex=(r,g,b)=>'#'+[r,g,b].map(n=>Math.max(0,Math.min(255,n)).toString(16).padStart(2,'0')).join('');
const normFam=v=>v.trim().replace(/\s+/g,' ');
function scanTheme(html){
  const colors=new Map(),fonts=new Map();
  mapCssRegions(html,css=>{
    for(const m of css.matchAll(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)){
      const c=parseColor(m[0]);if(!c)continue;
      const k=c.r+','+c.g+','+c.b;
      let e=colors.get(k);
      if(!e){e={hex:toHex(c.r,c.g,c.b),count:0,tokens:new Map()};colors.set(k,e)}
      e.count++;e.tokens.set(m[0],(e.tokens.get(m[0])||0)+1);
    }
    for(const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)){
      const f=normFam(m[1]);
      fonts.set(f,(fonts.get(f)||0)+1);
    }
    return css;
  });
  return{
    colors:[...colors.values()].sort((a,b)=>b.count-a.count),
    fonts:[...fonts.entries()].map(([fam,count])=>({fam,count})).sort((a,b)=>b.count-a.count)
  };
}
function replaceToken(css,tok,rep){
  const escd=tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  /* hex needs a boundary so #fff never matches inside #ffffff */
  return css.replace(new RegExp(escd+(tok[0]==='#'?'(?![0-9a-fA-F])':''),'g'),rep);
}
let themeBase='',themeScan=null,themeOrig='',themeHist=[],themeExpanded=-1,themeHoverT=null;
function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;
  if(mx===mn)return[0,0,l];
  const d=mx-mn,s=l>.5?d/(2-mx-mn):d/(mx+mn);
  const h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;
  return[h*60,s,l];
}
const hslHex=(h,s,l)=>{const[r,g,b]=hslToRgb(h,s,l);return toHex(r,g,b)};
function swappedHtml(grp,newHex){
  const c=parseColor(newHex);if(!c)return themeBase;
  return mapCssRegions(themeBase,css=>{
    for(const[tok]of grp.tokens){
      const a=(parseColor(tok)||{a:1}).a;
      const rep=a<1?`rgba(${c.r},${c.g},${c.b},${a})`:toHex(c.r,c.g,c.b);
      css=replaceToken(css,tok,rep);
    }
    return css;
  });
}
function previewColorSwap(grp,newHex){ /* live preview — no dirty flag, no history */
  const html=swappedHtml(grp,newHex);
  if(html===state.cur.html)return;
  state.cur.html=html;renderFrame();
}
function revertThemePreview(){
  clearTimeout(themeHoverT);
  if(state.cur.html!==themeBase){state.cur.html=themeBase;renderFrame()}
}
function applyColorSwap(grp,newHex,commit){
  if(!commit)return previewColorSwap(grp,newHex);
  clearTimeout(themeHoverT);
  const html=swappedHtml(grp,newHex);
  if(html===themeBase)return revertThemePreview(); /* no actual change — drop any preview */
  themeHist.push(themeBase);
  state.cur.html=html;setDirty(true);
  histPush(html);setCodeHighlight(-1);renderFrame();refreshCodeText();renderThemePanel();
}
function renderThemePanel(){
  if(!state.themeOpen||!state.cur)return;
  syncNow();
  themeBase=state.cur.html;
  const t=themeScan=scanTheme(themeBase);
  const panel=$('#themePanel');
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:13px">🎨 File colors &amp; fonts</b>
      <button class="ghost" id="thClose" title="Close">✕</button></div>
    <div class="throw">
      <button id="thBack" ${themeHist.length?'':'disabled'} title="Undo the last color/font change">↶ Back</button>
      <button id="thReset" ${state.cur.html!==themeOrig?'':'disabled'} title="Undo everything changed since this panel was opened">Reset all</button></div>
    <div class="hint" style="font-size:11.5px">A swatch swaps that color <b>everywhere</b> in this file's CSS (transparent variants follow along).
      Click a row to open the picker — <b>the sliders preview live</b>, release to apply.</div>
    <div class="field"><label>Colors (${t.colors.length})</label>
      <div class="tswl">${t.colors.map((c,i)=>`
        <div class="tsw">
          <div class="tswh" data-ci="${i}" title="Click to open the color picker">
            <input type="color" data-ci="${i}" value="${c.hex}">
            <div class="tswi"><span class="thex">${c.hex}</span>
              <span class="tuse">${c.count} use${c.count>1?'s':''}${c.tokens.size>1?' · '+c.tokens.size+' forms':''}</span></div>
            <button class="texp ghost">${themeExpanded===i?'▴':'▾'}</button>
          </div>
          ${themeExpanded===i?`<div class="tpicker" data-ci="${i}">
            <input type="range" class="tph" min="0" max="360" step="1" title="Hue">
            <input type="range" class="tps" min="0" max="100" step="1" title="Saturation">
            <input type="range" class="tpl" min="0" max="100" step="1" title="Lightness">
            <div class="tphexrow"><span class="tpprev"></span>
              <input type="text" class="tphex" maxlength="7" spellcheck="false" title="Hex — press Enter to apply"></div>
          </div>`:''}
        </div>`).join('')||'<span class="tuse">No colors found in this file\'s CSS.</span>'}
      </div></div>
    <div class="field"><label>Font stacks (${t.fonts.length})</label>
      ${t.fonts.map((f,i)=>`<div class="tfont">
        <input type="text" list="fontList" data-fi="${i}" value="${esc(f.fam)}" title="${esc(f.fam)}">
        <button class="fpick" data-fi="${i}" title="Built-in font stacks (work on any machine)">🅰</button>
        <span class="tuse">${f.count}×</span></div>`).join('')||'<span class="tuse">No font-family declarations found.</span>'}`;
  $('#thClose').onclick=closeThemePanel;
  $('#thBack').onclick=()=>{
    if(!themeHist.length)return;
    const prev=themeHist.pop();
    state.cur.html=prev;histPush(prev);setDirty(true);
    setCodeHighlight(-1);renderFrame();refreshCodeText();renderThemePanel();
  };
  $('#thReset').onclick=()=>{
    if(state.cur.html===themeOrig)return;
    state.cur.html=themeOrig;histPush(themeOrig);setDirty(true);themeHist=[];
    setCodeHighlight(-1);renderFrame();refreshCodeText();renderThemePanel();
    toast('Back to how it was when the panel was opened');
  };
  panel.querySelectorAll('.tswh').forEach(h=>{
    h.onclick=e=>{
      if(e.target.type==='color')return; /* let the native picker open */
      const i=+h.dataset.ci;
      themeExpanded=themeExpanded===i?-1:i;
      renderThemePanel();
    };
  });
  panel.querySelectorAll('.fpick').forEach(b=>b.onclick=()=>{
    const inp=panel.querySelector(`input[data-fi="${b.dataset.fi}"]`);
    openFontMenu(b,stack=>{inp.value=stack;inp.dispatchEvent(new Event('change'))});
  });
  const liveSwap=debounce((grp,val)=>previewColorSwap(grp,val),350);
  panel.querySelectorAll('input[type=color]').forEach(inp=>{
    const grp=t.colors[+inp.dataset.ci];
    inp.oninput=()=>liveSwap(grp,inp.value);
    inp.onchange=()=>applyColorSwap(grp,inp.value,true);
  });
  /* HSL slider picker: sliders live-preview the whole file, releasing commits */
  panel.querySelectorAll('.tpicker').forEach(pk=>{
    const grp=t.colors[+pk.dataset.ci];
    const c0=parseColor(grp.hex),[h0,s0,l0]=rgbToHsl(c0.r,c0.g,c0.b);
    const hI=pk.querySelector('.tph'),sI=pk.querySelector('.tps'),lI=pk.querySelector('.tpl');
    const hexI=pk.querySelector('.tphex'),prev=pk.querySelector('.tpprev');
    hI.value=Math.round(h0);sI.value=Math.round(s0*100);lI.value=Math.round(l0*100);
    const cur=()=>hslHex(+hI.value,+sI.value/100,+lI.value/100);
    const paint=()=>{ /* slider tracks show what moving each one would do */
      const h=+hI.value,s=+sI.value/100,l=+lI.value/100,hx=cur();
      hexI.value=hx;prev.style.background=hx;
      hI.style.background='linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
      sI.style.background=`linear-gradient(90deg,${hslHex(h,0,l)},${hslHex(h,1,l)})`;
      lI.style.background=`linear-gradient(90deg,#000,${hslHex(h,s,.5)},#fff)`;
    };
    paint();
    [hI,sI,lI].forEach(sl=>{
      sl.oninput=()=>{paint();clearTimeout(themeHoverT);
        const hx=cur();themeHoverT=setTimeout(()=>previewColorSwap(grp,hx),80)};
      sl.onchange=()=>applyColorSwap(grp,cur(),true);
    });
    hexI.onchange=()=>{
      let v=hexI.value.trim();if(v&&!v.startsWith('#'))v='#'+v;
      if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v))applyColorSwap(grp,v,true);
      else{toast('Enter a hex color like #54C8FF');hexI.value=cur()}
    };
  });
  panel.querySelectorAll('input[data-fi]').forEach(inp=>{
    inp.onchange=()=>{
      const old=t.fonts[+inp.dataset.fi].fam,nv=inp.value.trim();
      if(!nv||nv===old)return;
      const html=mapCssRegions(themeBase,css=>
        css.replace(/(font-family\s*:\s*)([^;}]+)/gi,(m,p,val)=>normFam(val)===old?p+nv:m));
      if(html===themeBase)return;
      themeHist.push(themeBase);
      state.cur.html=html;histPush(html);setDirty(true);
      setCodeHighlight(-1);renderFrame();refreshCodeText();renderThemePanel();
    };
  });
}
function closeThemePanel(){
  if(state.themeOpen)revertThemePreview(); /* drop any un-committed hover preview */
  state.themeOpen=false;
  $('#themePanel').classList.add('off');
  $('#btnColors').classList.remove('primary');
  updateModeUI();
}
$('#btnColors').onclick=()=>{
  if(!state.cur)return;
  if(state.themeOpen){closeThemePanel();return}
  state.themeOpen=true;
  syncNow();
  themeOrig=state.cur.html;themeHist=[];themeExpanded=-1;
  $('#themePanel').classList.remove('off');
  $('#btnColors').classList.add('primary');
  updateModeUI();renderThemePanel();
};


export { mapCssRegions, hslToRgb, parseColor, toHex, normFam, scanTheme, replaceToken, themeBase, themeScan, themeOrig, themeHist, themeExpanded, themeHoverT, rgbToHsl, hslHex, swappedHtml, previewColorSwap, revertThemePreview, applyColorSwap, renderThemePanel, closeThemePanel };
