import { $ } from './utils.js';
import { grid } from './library.js';
import { connectFolder, createExampleSite } from './disk.js';
import { state } from './state.js';

/* ======================= first-run tour ======================= */
const TOUR=[
  {title:'Welcome to Hypershelf 👋',text:'A library + editor for self-contained HTML files. Everything stays on your machine — nothing is uploaded anywhere. Here\'s a 30-second tour.'},
  {sel:'.btnrow',title:'Add files',text:'＋ New creates a blank file, Upload imports .html files, Paste adds raw HTML. You can also drag & drop files straight onto the grid.'},
  {sel:'#diskSection',title:'Real files on your computer',
   text:'Connect any folder — even your Desktop (Chrome/Edge). Sites split across separate HTML, CSS and JS files open as ONE editable document, and Save writes every change back to the right file. The button below picks a folder and drops a small example site into it so you can try it right now.',
   action:{label:'📂 Connect a folder & add the example site',
     run:async()=>{const d=await connectFolder();if(d)await createExampleSite(d)}}},
  {sel:'.side-footer',title:'Backups, theme & this tour',text:'Shelf files live in this browser — export a JSON backup to move or protect them. The light/dark toggle and a tour replay live here too.'},
  {sel:'#grid .card',title:'Start with the Welcome file',text:'It\'s an interactive playground: every editor feature — click-to-edit, drag, resize, "apply to all similar", 🎨 Colors, built-in fonts, ⌛ History, 🤖 AI — each with a small "try it" you can do in seconds.'}
];
let tourI=-1;
function startTour(){
  localStorage.setItem('hs-toured','1');tourI=-1;
  if(!$('#tourHole')){
    const h=document.createElement('div');h.id='tourHole';document.body.appendChild(h);
    const c=document.createElement('div');c.id='tourCard';document.body.appendChild(c);
  }
  tourNext();
}
function endTour(){const h=$('#tourHole'),c=$('#tourCard');if(h)h.remove();if(c)c.remove()}
function tourNext(){
  tourI++;
  while(tourI<TOUR.length&&TOUR[tourI].sel&&!document.querySelector(TOUR[tourI].sel))tourI++;
  if(tourI>=TOUR.length){endTour();return}
  const s=TOUR[tourI],hole=$('#tourHole'),card=$('#tourCard'),pad=6;
  let r={left:innerWidth/2,top:innerHeight/2,width:0,height:0};
  if(s.sel)r=document.querySelector(s.sel).getBoundingClientRect();
  Object.assign(hole.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',
    width:(r.width+(s.sel?pad*2:0))+'px',height:(r.height+(s.sel?pad*2:0))+'px'});
  card.innerHTML=`<h4>${s.title}</h4><p>${s.text}</p>
    ${s.action?`<button class="primary" id="tAct" style="width:100%;margin-bottom:10px">${s.action.label}</button>`:''}
    <div class="tbtns"><span class="tstep">${tourI+1} / ${TOUR.length}</span>
      <span><button class="ghost" id="tSkip">Skip</button>
      <button class="primary" id="tNext">${tourI===TOUR.length-1?'Done':'Next'}</button></span></div>`;
  let cx=r.left+r.width+18,cy=r.top;
  if(!s.sel){cx=innerWidth/2-160;cy=innerHeight/2-100}
  if(cx+320>innerWidth)cx=Math.max(10,r.left-320);
  card.style.left=cx+'px';card.style.top=Math.max(10,Math.min(cy,innerHeight-190))+'px';
  $('#tSkip').onclick=endTour;$('#tNext').onclick=tourNext;
  if(s.action)$('#tAct').onclick=async()=>{
    try{await s.action.run()}catch{}
    /* the layout may have changed (folder connected, grid re-rendered) — re-anchor this step */
    tourI--;tourNext();
  };
}
$('#btnTour').onclick=startTour;


export { TOUR, tourI, startTour, endTour, tourNext };
