

/* ======================= utils ======================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
const fmtDate=ts=>new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200)}
function rgbToHex(rgb){const m=rgb&&rgb.match(/[\d.]+/g);if(!m)return'#000000';
  if(m.length>3&&parseFloat(m[3])===0)return null; /* fully transparent */
  return'#'+m.slice(0,3).map(n=>Math.round(+n).toString(16).padStart(2,'0')).join('')}
/* iframe documents have their own browser chrome. Add the Hypershelf scrollbar
   at preview time only, so downloaded/saved source files stay untouched. */
function withAppScrollbars(html){
  const light=document.body?.classList.contains('light');
  const track=light?'#e2e5e4':'#050506',thumb=light?'#98a29f':'#34383d';
  const accent=light?'#0e87cc':'#54c8ff',active=light?'#0a5f96':'#2493dc';
  const style=`<style data-hs-ui-scrollbars>
    html,*{scrollbar-width:thin!important;scrollbar-color:${thumb} ${track}!important}
    *::-webkit-scrollbar{width:10px!important;height:10px!important}
    *::-webkit-scrollbar-track{background:${track}!important}
    *::-webkit-scrollbar-thumb{background:${thumb}!important;border:2px solid ${track}!important;border-radius:999px!important}
    *::-webkit-scrollbar-thumb:hover{background:${accent}!important}
    *::-webkit-scrollbar-thumb:active{background:${active}!important}
    *::-webkit-scrollbar-corner{background:${track}!important}
  </style>`;
  const src=String(html||'');
  if(/<\/head\s*>/i.test(src))return src.replace(/<\/head\s*>/i,style+'</head>');
  if(/<body\b/i.test(src))return src.replace(/<body\b/i,style+'<body');
  return style+src;
}


export { $, $$, uid, esc, debounce, fmtDate, toastT, toast, rgbToHex, withAppScrollbars };
