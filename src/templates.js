/* ======================= new-file templates ======================= */
/* Every template is fully self-contained and deliberately uses a distinct
   palette + font stacks so the 🎨 Colors panel demos well on all of them.
   NOTE: none of these may contain a literal </script — see CLAUDE.md. */

const TEMPLATES=[
{id:'blank',emoji:'📄',name:'Blank',desc:'A clean page to start from nothing.',
html:`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Untitled</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:60px auto;padding:0 24px;line-height:1.6;color:#1b1f27;background:#ffffff}
  h1{color:#1786c9}
</style>
</head>
<body>
<h1>Untitled</h1>
<p>Start writing — double-click any text to edit it, or use ＋ Insert to add elements.</p>
</body>
</html>`},

{id:'doc',emoji:'📝',name:'Document',desc:'Notes / write-up with headings, lists and quotes.',
html:`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New document</title>
<style>
  body{font-family:Charter,'Bitstream Charter','Sitka Text',Cambria,serif;max-width:680px;
    margin:70px auto;padding:0 24px;line-height:1.7;color:#22272e;background:#fbfaf7;font-size:17px}
  h1{font-size:34px;margin:0 0 4px;color:#14324f}
  .meta{color:#8a8f98;font-size:14px;font-family:system-ui,sans-serif;margin:0 0 34px}
  h2{font-size:21px;color:#14324f;margin:38px 0 10px;border-bottom:1px solid #e3ded2;padding-bottom:6px}
  blockquote{margin:20px 0;padding:12px 20px;border-left:3px solid #c9a227;background:#f4efe3;color:#5a5546;font-style:italic}
  li{margin-bottom:6px}
  strong{color:#14324f}
</style>
</head>
<body>
<h1>Document title</h1>
<p class="meta">A subtitle, a date, or an author line.</p>
<h2>First section</h2>
<p>Double-click this paragraph to start writing. Use <strong>＋ Insert</strong> to add headings, lists, images and more.</p>
<h2>Key points</h2>
<ul>
  <li>Everything lives in one portable HTML file.</li>
  <li>The 🎨 Colors panel can retheme this whole document at once.</li>
  <li>Every save keeps a version you can roll back to.</li>
</ul>
<blockquote>A quote or callout looks like this.</blockquote>
</body>
</html>`},

{id:'deck',emoji:'🖥️',name:'Slide deck',desc:'Full-screen slides — present with the ▶ button.',
tags:['slideshow'], /* shelf tag switches the filmstrip on; the body attribute below travels with the file */
html:`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New deck</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;color:#eceeed;background:#0b0d10}
  section.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;
    padding:8vh 10vw;box-sizing:border-box}
  .slide h1{font-size:8vh;margin:0 0 2vh;letter-spacing:.02em}
  .slide h2{font-size:5.5vh;margin:0 0 4vh;color:#54C8FF}
  .slide p,.slide li{font-size:3.1vh;line-height:1.55;color:#b9c2cc}
  .slide li{margin-bottom:1.6vh}
  .slide.title{background:radial-gradient(circle at 50% 130%,rgba(84,200,255,.3),transparent 60%),#0b0d10;
    text-align:center;align-items:center}
  .slide.accent{background:#101820}
  .tagline{color:#54C8FF;font-size:3vh}
</style>
</head>
<body data-hs-slideshow>
<section class="slide title">
  <h1>Presentation title</h1>
  <p class="tagline">A subtitle goes here — double-click any text to edit it.</p>
</section>
<section class="slide">
  <h2>First point</h2>
  <ul>
    <li>Each &lt;section&gt; is one slide.</li>
    <li>Duplicate a slide from the inspector to add more.</li>
    <li>Hit ▶ Present and use ← → to navigate.</li>
  </ul>
</section>
<section class="slide accent">
  <h2>Thank you</h2>
  <p>Made with Hypershelf.</p>
</section>
</body>
</html>`},

{id:'landing',emoji:'🚀',name:'Landing page',desc:'Hero, feature cards and a call to action.',
html:`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New landing page</title>
<style>
  body{margin:0;font-family:Avenir,Montserrat,Corbel,'URW Gothic',sans-serif;color:#1d2430;background:#f5f7f4;line-height:1.6}
  .hero{text-align:center;padding:90px 24px 70px;background:radial-gradient(circle at 50% 130%,rgba(46,164,79,.18),transparent 60%),#ffffff;border-bottom:1px solid #e2e8dd}
  .hero h1{font-size:46px;margin:0 0 12px;color:#173420}
  .hero p{font-size:19px;color:#5c6b60;margin:0 0 30px}
  .cta{display:inline-block;background:#2ea44f;color:#ffffff;text-decoration:none;font-weight:700;
    padding:14px 34px;border-radius:10px;font-size:17px}
  .features{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;padding:56px 24px;max-width:980px;margin:0 auto}
  .feature{background:#ffffff;border:1px solid #e2e8dd;border-radius:14px;padding:24px;width:260px}
  .feature h3{margin:0 0 8px;color:#173420}
  .feature p{margin:0;font-size:14.5px;color:#5c6b60}
  footer{text-align:center;padding:34px;color:#8a978d;font-size:13.5px;border-top:1px solid #e2e8dd}
</style>
</head>
<body>
<div class="hero">
  <h1>Your product name</h1>
  <p>One sentence about why it matters. Double-click to make it yours.</p>
  <a class="cta" href="#">Get started</a>
</div>
<div class="features">
  <div class="feature"><h3>Feature one</h3><p>These three cards share the class .feature — restyle them all at once with the scope picker.</p></div>
  <div class="feature"><h3>Feature two</h3><p>Drag cards to reorder them, or duplicate one to add a fourth.</p></div>
  <div class="feature"><h3>Feature three</h3><p>Open 🎨 Colors to swap this page's whole palette in seconds.</p></div>
</div>
<footer>Built with Hypershelf — one self-contained HTML file.</footer>
</body>
</html>`}
];

export { TEMPLATES };
