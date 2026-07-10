import { $, esc, toast, withAppScrollbars } from './utils.js';
import { state } from './state.js';
import { showModal, hideModal } from './ui.js';
import { addFile, renderLibrary } from './library.js';
import { openFile, syncNow } from './editor.js';

/* ======================= share links =======================
   The link IS the file: {name, html} is deflate-compressed and base64url-encoded
   into the URL hash (#s=…). The hash never reaches any server — sharing stays
   100% local-first. Uses the native CompressionStream API, zero dependencies. */

async function deflate(str){
  const cs=new CompressionStream('deflate-raw');
  const buf=await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}
async function inflate(bytes){
  const ds=new DecompressionStream('deflate-raw');
  const buf=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new TextDecoder().decode(buf);
}
/* base64url, unpadded — every character is legal in a URL hash */
function b64urlEncode(bytes){
  let s='';
  for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlDecode(s){
  const bin=atob(s.replace(/-/g,'+').replace(/_/g,'/')),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}

/* local file:// copies still mint links that open on the deployed site */
const SHARE_BASE=/^https?:$/.test(location.protocol)
  ?location.origin+location.pathname
  :'https://hypershelf.vercel.app/';
const WARN_LEN=8000; /* chat apps and mail clients get flaky with links past a few KB */

async function makeShareLink(name,html,tags){
  const payload={n:name,h:html};
  if(tags&&tags.length)payload.t=tags; /* tags travel too — a shared slideshow stays a slideshow */
  return SHARE_BASE+'#s='+b64urlEncode(await deflate(JSON.stringify(payload)));
}
async function shareFile(name,html,tags){
  let link;
  try{link=await makeShareLink(name,html,tags)}
  catch(err){console.warn(err);toast('Could not create the share link');return}
  const big=link.length>WARN_LEN
    ?` It's ${Math.round(link.length/1024)} KB — some chat apps truncate links that long; Download may travel safer.`:'';
  try{
    await navigator.clipboard.writeText(link);
    toast(big?'Link copied.'+big:'Share link copied — the whole file travels inside it');
  }catch{
    /* clipboard blocked — hand the link over for a manual copy instead */
    showModal(`<h3>🔗 Share link</h3>
      <p style="margin:4px 0 10px">Copy this link — the whole file travels inside it.${big}</p>
      <div class="mrow"><input type="text" id="shLink" readonly value="${esc(link)}"></div>
      <div class="mbtns"><button class="primary" id="shClose">Done</button></div>`);
    const inp=$('#shLink');inp.focus();inp.select();
    $('#shClose').onclick=hideModal;
  }
}

/* incoming link: parse #s=…, confirm with a preview, then add a COPY to this shelf */
async function checkShareHash(){
  const m=location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if(!m)return;
  const clearHash=()=>history.replaceState(null,'',location.pathname+location.search);
  let name,html,tags;
  try{
    const data=JSON.parse(await inflate(b64urlDecode(m[1])));
    name=String(data.n||'Shared.html');html=String(data.h||'');
    tags=Array.isArray(data.t)?data.t.filter(t=>typeof t==='string').slice(0,20):[];
    if(!html)throw 0;
  }catch{clearHash();toast('That share link is damaged or incomplete');return}
  showModal(`<h3>🔗 Shared file</h3>
    <p style="margin:4px 0 12px">This link carries a copy of <b>${esc(name)}</b> (${Math.round(html.length/1024)||1} KB). Add it to your shelf?</p>
    <div class="shprev"><iframe sandbox=""></iframe></div>
    <div class="mbtns"><button id="shNo">Not now</button><button class="primary" id="shYes">＋ Add to my shelf</button></div>`,true);
  $('.shprev iframe').srcdoc=withAppScrollbars(html);
  $('#shNo').onclick=()=>{hideModal();clearHash()};
  $('#shYes').onclick=async()=>{
    hideModal();clearHash();
    const f=await addFile(name,html,{tags});
    state.filter.disk=false;state.filter.folder=null;state.filter.tag=null;
    renderLibrary();openFile(f.id);
    toast('Added to your shelf');
  };
}
/* also catch a share link pasted into an already-open tab */
window.addEventListener('hashchange',checkShareHash);

/* editor toolbar 🔗 */
$('#btnShare').onclick=()=>{
  if(!state.cur)return;
  syncNow();
  shareFile(state.cur.name,state.cur.html,state.cur.tags);
};

export { makeShareLink, shareFile, checkShareHash };
