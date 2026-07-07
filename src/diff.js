import { esc } from './utils.js';

/* ======================= line diff engine ======================= */
function diffLines(aText,bText){
  const A=aText.split('\n'),B=bText.split('\n');
  let s=0;while(s<A.length&&s<B.length&&A[s]===B[s])s++;
  let e=0;while(e<A.length-s&&e<B.length-s&&A[A.length-1-e]===B[B.length-1-e])e++;
  const a=A.slice(s,A.length-e),b=B.slice(s,B.length-e),out=[];
  for(let i=0;i<s;i++)out.push({t:' ',x:A[i]});
  const n=a.length,m=b.length;
  if(n*m>4e6){ /* too large for LCS — mark the whole middle as changed */
    a.forEach(x=>out.push({t:'-',x}));b.forEach(x=>out.push({t:'+',x}));
  }else if(n||m){
    const W=m+1,dp=new Uint32Array((n+1)*W);
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
      dp[i*W+j]=a[i]===b[j]?dp[(i+1)*W+j+1]+1:Math.max(dp[(i+1)*W+j],dp[i*W+j+1]);
    let i=0,j=0;
    while(i<n&&j<m){
      if(a[i]===b[j]){out.push({t:' ',x:a[i]});i++;j++}
      else if(dp[(i+1)*W+j]>=dp[i*W+j+1])out.push({t:'-',x:a[i++]});
      else out.push({t:'+',x:b[j++]});
    }
    while(i<n)out.push({t:'-',x:a[i++]});
    while(j<m)out.push({t:'+',x:b[j++]});
  }
  for(let k=A.length-e;k<A.length;k++)out.push({t:' ',x:A[k]});
  return out;
}
function renderDiffHTML(oldText,newText){
  const d=diffLines(oldText,newText);
  const adds=d.reduce((c,l)=>c+(l.t==='+'),0),dels=d.reduce((c,l)=>c+(l.t==='-'),0);
  if(!adds&&!dels)return'<div class="hint">No changes — the two versions are identical.</div>';
  const dLine=(t,x)=>`<div class="dl ${t==='+'?'da':t==='-'?'dd':''}"><span>${t==='+'?'+':t==='-'?'−':''}</span>${esc(x)||' '}</div>`;
  const rows=[];let run=[];
  const flush=()=>{ /* fold long unchanged runs to 3 lines of context each side */
    if(run.length>8){
      rows.push(...run.slice(0,3).map(x=>dLine(' ',x)));
      rows.push(`<div class="dfold">⋯ ${run.length-6} unchanged lines</div>`);
      rows.push(...run.slice(-3).map(x=>dLine(' ',x)));
    }else rows.push(...run.map(x=>dLine(' ',x)));
    run=[];
  };
  for(const l of d){if(l.t===' ')run.push(l.x);else{flush();rows.push(dLine(l.t,l.x))}}
  flush();
  return `<div class="dstats"><span style="color:var(--ok)">+${adds}</span> added · <span style="color:var(--danger)">−${dels}</span> removed</div>
    <div class="diffview">${rows.join('')}</div>`;
}


export { diffLines, renderDiffHTML };
