

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


export { $, $$, uid, esc, debounce, fmtDate, toastT, toast, rgbToHex };
