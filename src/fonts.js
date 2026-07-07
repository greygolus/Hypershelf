import { esc } from './utils.js';

/* ======================= built-in font stacks ======================= */
/* Carefully ordered fallback stacks that render well on Windows / macOS /
   Linux / Android with ZERO font files — so styled documents stay fully
   self-contained and look right on machines with no fonts "set up".
   (Based on the modern-font-stacks approach.) */
export const FONT_STACKS=[
  {name:'System UI',stack:`system-ui, sans-serif`},
  {name:'Neo-Grotesque',stack:`Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif`},
  {name:'Humanist Sans',stack:`Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif`},
  {name:'Geometric Sans',stack:`Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif`},
  {name:'Industrial',stack:`Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', 'Nimbus Sans Narrow', sans-serif-condensed, sans-serif`},
  {name:'Rounded Sans',stack:`ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', 'Arial Rounded MT Bold', Calibri, source-sans-pro, sans-serif`},
  {name:'Classic Serif',stack:`Georgia, 'Times New Roman', serif`},
  {name:'Transitional Serif',stack:`Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif`},
  {name:'Old-Style Serif',stack:`'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, serif`},
  {name:'Didone Display',stack:`Didot, 'Bodoni MT', 'Noto Serif Display', 'URW Palladio L', P052, serif`},
  {name:'Slab Serif',stack:`Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'Sitka Small', serif`},
  {name:'Monospace Code',stack:`ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace`},
  {name:'Typewriter',stack:`'Nimbus Mono PS', 'Courier New', monospace`},
  {name:'Handwritten',stack:`'Segoe Print', 'Bradley Hand', Chilanka, TSCu_Comic, casual, cursive`},
];

/* floating picker — each entry previews in its own face; pick calls onPick(stack) */
let menuEl=null;
export function closeFontMenu(){
  if(menuEl){menuEl.remove();menuEl=null;
    document.removeEventListener('mousedown',onOutside,true)}
}
function onOutside(e){if(menuEl&&!menuEl.contains(e.target))closeFontMenu()}
export function openFontMenu(anchor,onPick){
  closeFontMenu();
  menuEl=document.createElement('div');menuEl.id='fontMenu';
  menuEl.innerHTML=FONT_STACKS.map((f,i)=>
    `<button data-fi="${i}"><span class="fmName">${f.name}</span>
      <span class="fmSample" style="font-family:${esc(f.stack)}">The quick brown fox · Aa Bb 123</span></button>`).join('');
  document.body.appendChild(menuEl);
  const r=anchor.getBoundingClientRect(),mh=Math.min(340,menuEl.offsetHeight);
  let top=r.bottom+6;
  if(top+mh>innerHeight)top=Math.max(8,r.top-mh-6);
  menuEl.style.top=top+'px';
  menuEl.style.left=Math.max(8,Math.min(r.left,innerWidth-310))+'px';
  menuEl.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const s=FONT_STACKS[+b.dataset.fi].stack;closeFontMenu();onPick(s)});
  setTimeout(()=>document.addEventListener('mousedown',onOutside,true),0);
}
