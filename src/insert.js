import { $, toast } from './utils.js';
import { state } from './state.js';
import { insertHtmlAfterSelection } from './editor.js';
import { isSlideshow, addSlideAfterSelection } from './slides.js';

/* ======================= ＋ Insert palette ======================= */
/* Templates use minimal inline styles so they inherit the document's look. */
const INSERT_ITEMS=[
  {ic:'🔠',name:'Heading',html:'<h2>New heading</h2>'},
  {ic:'📃',name:'Paragraph',html:'<p>New paragraph — double-click to edit this text.</p>'},
  {ic:'🔘',name:'Button',html:'<button>Click me</button>'},
  {ic:'🔗',name:'Link',html:'<a href="#">New link</a>'},
  {ic:'📋',name:'List',html:'<ul><li>First item</li><li>Second item</li></ul>'},
  {ic:'🖼️',name:'Image…',img:true},
  {ic:'📦',name:'Container',html:'<div style="padding:18px"><p>New section — drop elements in here.</p></div>'},
  {ic:'🀫',name:'Two columns',html:'<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:1"><p>Left column</p></div><div style="flex:1"><p>Right column</p></div></div>'},
  {ic:'➖',name:'Divider',html:'<hr>'},
];
let menuEl=null;
function closeInsertMenu(){
  if(menuEl){menuEl.remove();menuEl=null;
    document.removeEventListener('mousedown',onOutside,true)}
}
function onOutside(e){if(menuEl&&!menuEl.contains(e.target))closeInsertMenu()}
$('#btnInsert').onclick=e=>{
  if(!state.cur)return;
  if(menuEl){closeInsertMenu();return}
  menuEl=document.createElement('div');menuEl.id='insertMenu';
  /* slideshows get a Slide entry on top — adds after the slide holding the selection */
  const items=isSlideshow(state.cur)
    ?[{ic:'🎞',name:'Slide',slide:true},...INSERT_ITEMS]:INSERT_ITEMS;
  menuEl.innerHTML=items.map((it,i)=>
    `<button data-i="${i}"><span class="iic">${it.ic}</span><span>${it.name}</span></button>`).join('')+
    '<div class="ihint">Inserts after the selected element — or at the end of the page.</div>';
  document.body.appendChild(menuEl);
  const r=e.target.getBoundingClientRect();
  menuEl.style.top=(r.bottom+6)+'px';
  menuEl.style.left=Math.max(8,Math.min(r.left,innerWidth-240))+'px';
  menuEl.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const it=items[+b.dataset.i];
    closeInsertMenu();
    if(it.slide)addSlideAfterSelection();
    else if(it.img)$('#imgInput').click();
    else insertHtmlAfterSelection(it.html);
  });
  setTimeout(()=>document.addEventListener('mousedown',onOutside,true),0);
};
$('#imgInput').onchange=e=>{
  const f=e.target.files[0];e.target.value='';
  if(!f)return;
  if(f.size>2*1024*1024)
    toast('Heads up: '+(f.size/1024/1024).toFixed(1)+' MB image — it gets embedded into the file');
  const rd=new FileReader();
  rd.onload=()=>insertHtmlAfterSelection(
    `<img src="${rd.result}" alt="${f.name.replace(/"/g,'')}" style="max-width:100%">`);
  rd.readAsDataURL(f);
};

export { INSERT_ITEMS, closeInsertMenu };
