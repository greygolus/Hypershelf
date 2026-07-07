import { $ } from './utils.js';
import { closeMenu } from './library.js';

/* ======================= modal ======================= */
function showModal(html,wide){const m=$('#modal');m.classList.toggle('wide',!!wide);
  m.innerHTML=html;$('#modalWrap').classList.add('show')}
function hideModal(){$('#modalWrap').classList.remove('show')}
$('#modalWrap').onclick=e=>{if(e.target.id==='modalWrap')hideModal()};
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if($('#modalWrap').classList.contains('show')){
    const ta=$('#modal textarea');
    if(ta&&ta.value.trim()&&!confirm('Close and discard what you typed?'))return;
    hideModal();
  }
  closeMenu();
});

/* ======================= theme ======================= */
function applyTheme(t){document.body.classList.toggle('light',t==='light')}
applyTheme(localStorage.getItem('hs-theme'));
$('#btnTheme').onclick=()=>{
  const t=document.body.classList.contains('light')?'dark':'light';
  localStorage.setItem('hs-theme',t);applyTheme(t);
};


export { showModal, hideModal, applyTheme };
