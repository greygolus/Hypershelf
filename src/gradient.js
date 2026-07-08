/* ======================= gradient parsing =======================
   Parses the FIRST linear/radial gradient out of a background-image value
   (other layers — url(), extra gradients — are preserved verbatim around it).
   Round-trips through serializeGradient so the inspector can edit stops,
   angle, and type without touching anything else in the value. */

/* split on commas at paren depth 0 — rgb(a,b,c) commas don't count */
function splitTop(s){
  const out=[];let d=0,cur='';
  for(const ch of s){
    if(ch==='(')d++;else if(ch===')')d--;
    if(ch===','&&d===0){out.push(cur.trim());cur=''}else cur+=ch;
  }
  if(cur.trim())out.push(cur.trim());
  return out;
}
const COLOR_RE=/^(#[0-9a-fA-F]{3,8}|rgba?\([^()]*\)|hsla?\([^()]*\)|[a-zA-Z]+)/;
const DIR_RE=/^(to\s|-?[\d.]+(deg|rad|grad|turn)\b|circle\b|ellipse\b|closest-|farthest-|at\s)/;

function parseGradient(v){
  if(!v||!/gradient\(/.test(v))return null;
  const m=v.match(/(repeating-)?(linear|radial)-gradient\(/);
  if(!m)return null;
  const open=v.indexOf('(',m.index);
  let d=0,close=-1;
  for(let j=open;j<v.length;j++){
    if(v[j]==='(')d++;else if(v[j]===')'&&--d===0){close=j;break}
  }
  if(close<0)return null;
  const args=splitTop(v.slice(open+1,close));
  const g={type:m[2],repeating:!!m[1],angle:'',shape:'',stops:[],
    before:v.slice(0,m.index),after:v.slice(close+1)};
  let rest=args;
  if(args.length&&DIR_RE.test(args[0])){
    if(m[2]==='linear')g.angle=args[0];else g.shape=args[0];
    rest=args.slice(1);
  }
  for(const a of rest){
    const cm=a.match(COLOR_RE);
    if(!cm)return null; /* something we don't understand — leave the value alone */
    const col=cm[1];
    if(/^[a-zA-Z]+$/.test(col)){
      if(a[col.length]==='(')return null; /* var(), color-mix(), … — not editable here */
      if(!normRGB(col))return null;       /* not a real named color */
    }
    g.stops.push({color:col,pos:a.slice(col.length).trim()});
  }
  return g.stops.length>=2?g:null;
}
function serializeGradient(g){
  const head=g.type==='linear'?g.angle:g.shape;
  return g.before+(g.repeating?'repeating-':'')+g.type+'-gradient('+
    (head?head+', ':'')+
    g.stops.map(s=>s.color+(s.pos?' '+s.pos:'')).join(', ')+')'+g.after;
}

/* ---------- color helpers (browser does the parsing) ---------- */
let probe=null;
function normRGB(c){ /* any CSS color → {hex,a} — null if unparseable */
  if(!probe){probe=document.createElement('span');probe.style.display='none';
    document.body.appendChild(probe)}
  probe.style.color='';probe.style.color=c;
  if(!probe.style.color)return null;
  const m=getComputedStyle(probe).color.match(/[\d.]+/g);
  if(!m)return null;
  return{hex:'#'+m.slice(0,3).map(n=>Math.round(+n).toString(16).padStart(2,'0')).join(''),
    a:m.length>3?parseFloat(m[3]):1};
}
function withAlpha(hex,a){ /* editing a stop must keep its original transparency */
  if(a>=1)return hex;
  return`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
}
function darken(hex,f){
  const ch=s=>Math.max(0,Math.min(255,Math.round(parseInt(s,16)*f))).toString(16).padStart(2,'0');
  return'#'+ch(hex.slice(1,3))+ch(hex.slice(3,5))+ch(hex.slice(5,7));
}

export { parseGradient, serializeGradient, normRGB, withAlpha, darken };
