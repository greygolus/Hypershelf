/* The interactive Welcome playground. Seeded once for new users (main.js),
   and re-creatable any time via the "＋ Example file" sidebar button (library.js). */
export const WELCOME=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Welcome to Hypershelf</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#000;color:#eceeed;line-height:1.55}
  .hero{background:radial-gradient(circle at 50% 135%,rgba(84,200,255,.35),transparent 65%),#06090c;
    border-bottom:1px solid #14212b;color:#fff;padding:48px 32px;text-align:center}
  .hero h1{margin:0 0 8px;font-size:32px;letter-spacing:.06em}
  .hero p{margin:0;opacity:.75}
  main{max-width:740px;margin:26px auto 50px;padding:0 24px}
  h2.sec{font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#54C8FF;margin:34px 0 12px}
  .tip{background:#0c0e10;border:1px solid #212a30;border-radius:12px;padding:15px 18px;margin-bottom:12px}
  .tip b{color:#54C8FF}
  .try{display:block;margin-top:7px;font-size:13px;color:#8fa3ad}
  .try::before{content:'▸ try it: ';color:#4cd97b;font-weight:600}
  button.demo{background:linear-gradient(135deg,#54C8FF,#2493DC);color:#02131f;font-weight:700;border:none;
    border-radius:8px;padding:9px 18px;font-size:14px;cursor:pointer;display:block;margin:12px 0 2px}
  .badges{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 2px}
  .badge{background:#101418;border:1px solid #223440;border-radius:999px;padding:6px 16px;color:#9fb6c1;font-size:14px}
  .box{width:220px;height:80px;background:#0c1116;border:1px dashed #2a4a5e;border-radius:10px;
    display:flex;align-items:center;justify-content:center;color:#54C8FF;margin:12px 0 2px}
</style>
</head>
<body>
<div class="hero"><h1>Welcome to Hypershelf 📚</h1>
  <p>Your library + editor for self-contained HTML files. This page is a playground — everything below is safe to break.</p></div>
<main>
  <h2 class="sec">The two mouse modes</h2>
  <div class="tip"><b>🖱 Interact</b> runs the page live, scripts and all.
    <button class="demo" onclick="this.textContent='Scripts work! ✨ Clicked '+(++window.n||(window.n=1))+'x'">Click me — I'm JavaScript</button>
    <span class="try">click the button, then switch to ✎ Edit (top bar) and notice the page holds still.</span></div>
  <div class="tip"><b>✎ Edit</b> freezes the page so you can click any element and change it in the inspector on the right.
    <span class="try">in Edit mode, click this sentence and rewrite it in the Text box.</span></div>

  <h2 class="sec">Move · resize · multiply</h2>
  <div class="tip"><b>Drag to move</b> — a selected element can be dragged anywhere on the page.
    <div class="badges"><span class="badge">Alpha</span><span class="badge">Beta</span><span class="badge">Gamma</span></div>
    <span class="try">select a badge above, then drag it between the others — it reorders live as you move.</span></div>
  <div class="tip"><b>Resize</b> — a selected element grows cyan ◢ handles on its edges.
    <div class="box">resize me</div>
    <span class="try">select the box and drag its corner handle; watch the size readout.</span></div>
  <div class="tip"><b>Apply to all similar</b> — the inspector's scope picker turns one edit into a CSS rule for every matching element.
    <span class="try">select one badge, set "Apply style edits to: all .badge (3)", then change the background — all three change.</span></div>

  <h2 class="sec">Styling power</h2>
  <div class="tip"><b>Inspector sections</b> — Spacing, Layout &amp; size (display + flex controls), Border &amp; effects (shadows, corner radius, opacity), Attributes.
    <span class="try">give the resize box a <b>glow</b> shadow from Border &amp; effects.</span></div>
  <div class="tip"><b>🎨 Colors</b> (top bar) lists every color and font in this file with usage counts.
    <span class="try">open it, click a swatch row, and drag the sliders — the whole page recolors live; release to apply.</span></div>
  <div class="tip"><b>Built-in fonts</b> — the 🅰 button offers 14 font stacks that render on any machine, no font files needed.
    <span class="try">select this paragraph and pick "Slab Serif" — or swap the whole file's font from 🎨 Colors.</span></div>

  <h2 class="sec">Source &amp; safety nets</h2>
  <div class="tip"><b>‹/› Code</b> shows the source side-by-side: clicking an element highlights its line, clicking a line selects the element. The panel edge drags to resize.</div>
  <div class="tip"><b>Undo</b> (Ctrl+Z) covers everything; <b>⌛ History</b> keeps a snapshot of every Save with diffs and rollback; autosave recovers unsaved work after a crash.</div>
  <div class="tip"><b>🤖 AI</b> copies this file plus a ready-made prompt for any AI chat — paste the reply back and review a visual diff before accepting.
    <span class="try">click 🤖 AI, type "make the hero purple", copy, and paste it to your favorite AI.</span></div>

  <h2 class="sec">Real files on your computer</h2>
  <div class="tip"><b>📂 This computer</b> (sidebar) connects a real folder — sites with separate HTML/CSS/JS files open as one editable document, and one Save writes every file back.
    <span class="try">connect a folder and click <b>⊕ Create example site</b> for a hands-on multi-file demo.</span></div>
  <div class="tip">Shelf files live in <b>this browser</b> — use <b>⇩ Export library backup</b> to move or protect them.</div>
</main>
</body>
</html>`;
