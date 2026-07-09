/* The Slides 101 example deck. Seeded on first run next to the Welcome file
   (main.js) and re-creatable via the sidebar "🎞 Add example slideshow" button
   (library.js). Opts into slideshow mode BOTH ways: the seeding call tags it
   'slideshow', and <body data-hs-slideshow> travels with the file itself.
   The data-hs-slidedeco block matches slides.js#decoCSS exactly so the ⚙ dialog
   parses it. Script-free — Present injects its own nav. */
export const SLIDES_DEMO=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Slides 101</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;color:#eceeed;background:#060a0e}
  section.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;
    padding:8vh 10vw;box-sizing:border-box}
  .slide h1{font-size:7.5vh;margin:0 0 2vh;letter-spacing:.02em}
  .slide h2{font-size:5vh;margin:0 0 4vh;color:#54C8FF}
  .slide p,.slide li{font-size:2.9vh;line-height:1.55;color:#b9c2cc}
  .slide li{margin-bottom:1.8vh}
  .slide ul{margin:0;padding-left:1.2em}
  .slide.title{background:radial-gradient(circle at 50% 130%,rgba(84,200,255,.3),transparent 60%),#060a0e;
    text-align:center;align-items:center}
  .slide.accent{background:linear-gradient(160deg,#0a1420,#060a0e)}
  .tagline{color:#54C8FF;font-size:3vh}
  .try{display:block;margin-top:4vh;font-size:2.4vh;color:#8fa3ad}
  .try::before{content:'▸ try it: ';color:#4cd97b;font-weight:600}
  .k{background:#101820;border:1px solid #24455a;border-radius:8px;padding:.2vh 1.4vh;
    font-family:ui-monospace,monospace;font-size:2.5vh;color:#eceeed;white-space:nowrap}
  b{color:#eceeed}
</style>
<style data-hs-slidedeco>section{position:relative}body{counter-reset:hs-slide}section{counter-increment:hs-slide}section::after{content:counter(hs-slide)" / 7";position:absolute;right:26px;bottom:18px;font:600 13px/1 system-ui;opacity:.5;pointer-events:none}section::before{content:"Slides 101 · Hypershelf";position:absolute;left:26px;bottom:18px;font:600 13px/1 system-ui;opacity:.5;letter-spacing:.04em;pointer-events:none}</style>
</head>
<body data-hs-slideshow>

<section class="slide title">
  <h1>Slideshows in Hypershelf 🎞</h1>
  <p class="tagline">A deck is just an HTML file where every &lt;section&gt; is a slide.</p>
  <p>This one is a playground — each slide teaches one trick, and everything is safe to break.<br>
  It works because the file is tagged <b>slideshow</b> — tag any file that way and it gets all of this.</p>
</section>

<section class="slide">
  <h2>The filmstrip</h2>
  <ul>
    <li><b>Click a thumbnail</b> on the left to jump to that slide.</li>
    <li>Hover one for per-slide tools: <b>＋</b> add after · <b>⧉</b> duplicate · <b>↑ ↓</b> reorder · <b>✕</b> delete.</li>
    <li>Everything is one <b>Ctrl+Z</b> away — slide moves included.</li>
  </ul>
  <span class="try">hover this slide's thumbnail, press ⧉ to duplicate it — then ✕ the copy.</span>
</section>

<section class="slide">
  <h2>Add slides with layouts</h2>
  <p>The <b>＋ Add</b> button doesn't just append an empty slide — it asks what you want:</p>
  <ul>
    <li>🔤 Title &nbsp;·&nbsp; 📋 Bullets &nbsp;·&nbsp; 🀫 Two columns &nbsp;·&nbsp; ❝ Quote &nbsp;·&nbsp; ➖ Divider &nbsp;·&nbsp; ⬜ Blank</li>
    <li>New slides automatically match this deck's styling.</li>
  </ul>
  <span class="try">hit ＋ Add in the filmstrip header and drop a ❝ Quote slide after this one.</span>
</section>

<section class="slide">
  <h2>Numbers &amp; footer</h2>
  <p>Look at the corners of this slide — the <b>page number</b> (bottom-right) and the
  <b>footer line</b> (bottom-left) are stamped on every slide, and they live inside the
  file itself, so they survive downloading and sharing.</p>
  <p>The <b>⚙</b> button in the filmstrip header turns them on and off. The count updates
  itself when you add or delete slides.</p>
  <span class="try">open ⚙ and change the footer to your own name.</span>
</section>

<section class="slide">
  <h2>Presenting</h2>
  <p>The <b>▶</b> button (top bar) plays this deck fullscreen:</p>
  <ul>
    <li><span class="k">click</span> or <span class="k">→</span> next · <span class="k">←</span> back · on-screen <span class="k">‹</span> <span class="k">›</span> arrows</li>
    <li><span class="k">B</span> blacks out the screen (press again to come back)</li>
    <li>type a number like <span class="k">3</span> to jump straight to that slide</li>
    <li>progress bar along the bottom · <span class="k">Esc</span> exits</li>
  </ul>
  <span class="try">press ▶, advance with a click, hit B, then type 1 to jump home.</span>
</section>

<section class="slide">
  <h2>It's still just HTML</h2>
  <ul>
    <li>Every editor feature works here: colors, the gradient editor, drag to move, resize handles, 🤖 AI round-trips, ⌛ History.</li>
    <li>A slide is a normal element — select one and style it in the inspector.</li>
    <li>🔗 Share copies a link with the whole deck inside it. The link <b>is</b> the file.</li>
  </ul>
  <span class="try">select this slide's heading and drag a gradient onto it with ⤳ grad.</span>
</section>

<section class="slide accent">
  <h1>Make your own</h1>
  <p><b>＋ New → Slide deck</b> starts a fresh one, already in slideshow mode.<br>
  Or tag any existing file <b>slideshow</b> (card ⋮ → Edit tags) and it grows a filmstrip.</p>
  <p class="tagline">Go make something worth presenting.</p>
</section>

</body>
</html>`;
