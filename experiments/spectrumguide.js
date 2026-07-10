/* Copy-ready workflow guide for creating Spectrum Reach-themed HTML with
   SpectrumGPT and finishing it in the user's Hyperdesk/Hypershelf workspace. */
export const SPECTRUM_GUIDE=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SpectrumGPT + Hyperdesk Guide</title>
<style>
  :root{--navy:#002139;--navy2:#000f1a;--blue:#0271eb;--blue2:#0073d1;--sky:#73b7ff;
    --slate:#63738a;--mist:#d8dde6;--white:#fff;--ink:#081722;--line:rgba(216,221,230,.22);--green:#00bf1f}
  *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#63738a #000f1a}
  *::-webkit-scrollbar{width:10px;height:10px}*::-webkit-scrollbar-track{background:#000f1a}
  *::-webkit-scrollbar-thumb{background:#63738a;border:2px solid #000f1a;border-radius:99px}
  *::-webkit-scrollbar-thumb:hover{background:#73b7ff}*::-webkit-scrollbar-corner{background:#000f1a}
  html{scroll-behavior:smooth}body{margin:0;background:var(--navy2);color:var(--white);
    font-family:"Spectrum Sans",system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55}
  a{color:inherit}.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;
    gap:20px;padding:12px clamp(20px,5vw,72px);background:rgba(0,15,26,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.02em}.brand-mark{width:24px;height:24px;border-radius:50%;
    background:conic-gradient(from 210deg,var(--blue),var(--sky),#fff,var(--blue));box-shadow:0 0 20px rgba(2,113,235,.5)}
  nav{display:flex;gap:18px;flex-wrap:wrap}nav a{text-decoration:none;color:var(--mist);font-size:12px}nav a:hover{color:var(--sky)}
  .hero{position:relative;overflow:hidden;padding:clamp(68px,10vw,132px) clamp(22px,7vw,96px) 72px;
    background:radial-gradient(circle at 82% 20%,rgba(115,183,255,.22),transparent 30%),
      linear-gradient(132deg,#002e52 0%,#002139 55%,#000f1a 100%);border-bottom:1px solid var(--line)}
  .hero::after{content:"";position:absolute;width:440px;height:440px;right:-170px;bottom:-290px;border:48px solid rgba(2,113,235,.32);
    border-radius:50%;box-shadow:0 0 0 48px rgba(115,183,255,.05)}
  .eyebrow{margin:0 0 18px;color:var(--sky);font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
  h1{max-width:890px;margin:0;font-size:clamp(42px,7vw,86px);line-height:.94;letter-spacing:-.045em}
  .hero-copy{max-width:720px;margin:24px 0 0;color:var(--mist);font-size:clamp(17px,2vw,22px)}
  .hero-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:32px}.hero-tags span{padding:7px 12px;border:1px solid rgba(115,183,255,.32);
    border-radius:99px;background:rgba(0,15,26,.4);color:#dceeff;font-size:12px}
  main{width:min(1120px,calc(100% - 40px));margin:0 auto;padding:56px 0 90px}
  section{scroll-margin-top:74px;margin-bottom:74px}.section-head{display:grid;grid-template-columns:90px 1fr;gap:20px;align-items:start;margin-bottom:24px}
  .section-no{color:var(--sky);font:700 11px/1 ui-monospace,monospace;letter-spacing:.15em}.section-head h2{margin:0;font-size:clamp(28px,4vw,48px);line-height:1.05}
  .section-head p{grid-column:2;margin:4px 0 0;max-width:720px;color:#aebccc}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:linear-gradient(150deg,rgba(0,46,82,.82),rgba(0,33,57,.62));
    border:1px solid var(--line);border-radius:16px;padding:22px}.card b{display:block;margin-bottom:8px;color:var(--sky);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
  .card h3{margin:0 0 8px;font-size:18px}.card p{margin:0;color:#b8c6d4;font-size:14px}.step{display:inline-grid;place-items:center;width:28px;height:28px;
    margin-bottom:16px;border-radius:50%;background:var(--blue);font-weight:800;font-size:12px}
  .anatomy{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.anatomy div{display:grid;grid-template-columns:120px 1fr;gap:14px;
    padding:16px 18px;border-left:3px solid var(--blue);background:rgba(0,33,57,.62);border-radius:0 12px 12px 0}
  .anatomy strong{color:var(--sky);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.anatomy span{color:#c1ccd7;font-size:14px}
  .prompt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.prompt-card{min-width:0;border:1px solid var(--line);border-radius:17px;overflow:hidden;background:#001522}
  .prompt-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 16px;border-bottom:1px solid var(--line);background:#002139}
  .prompt-head div{display:flex;flex-direction:column}.prompt-head b{font-size:14px}.prompt-head span{color:#9ba9bd;font-size:11px}
  button.copy{border:1px solid rgba(115,183,255,.38);border-radius:8px;background:#0271eb;color:#fff;padding:7px 11px;font:700 11px inherit;cursor:pointer}
  button.copy:hover{background:#1995f2}.prompt{max-height:520px;overflow:auto;margin:0;padding:20px;color:#d8e8f7;background:#000f1a;
    font:12.5px/1.65 ui-monospace,"Cascadia Code",monospace;white-space:pre-wrap}
  .recipe{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.palette{display:grid;grid-template-columns:repeat(5,1fr);min-height:156px;border-radius:16px;overflow:hidden;border:1px solid var(--line)}
  .swatch{display:flex;align-items:flex-end;padding:12px;font:700 10px/1.3 ui-monospace,monospace}.swatch:nth-child(4),.swatch:nth-child(5){color:var(--ink)}
  .rules{display:grid;gap:9px}.rule{display:flex;gap:12px;padding:13px 15px;border:1px solid var(--line);border-radius:12px;background:rgba(0,33,57,.65)}
  .rule i{flex:0 0 8px;width:8px;height:8px;margin-top:7px;border-radius:50%;background:var(--blue);box-shadow:0 0 10px var(--blue)}
  .rule span{color:#c4cfda;font-size:14px}.rule strong{color:#fff}
  .handoff{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.handoff .card{position:relative;padding-top:48px}.handoff .card::before{content:attr(data-step);
    position:absolute;top:16px;left:20px;color:var(--sky);font:800 11px ui-monospace,monospace;letter-spacing:.12em}
  .fixes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.fix{border:1px solid var(--line);border-radius:14px;padding:18px;background:#001b2d}
  .fix span{display:block;margin-bottom:10px;color:#9ba9bd;font-size:11px;text-transform:uppercase;letter-spacing:.1em}.fix p{margin:0;color:#e4edf5;font:13px/1.55 ui-monospace,monospace}
  .checklist{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.check{display:flex;gap:11px;padding:13px 15px;background:rgba(0,33,57,.7);border:1px solid var(--line);border-radius:11px;color:#c8d3de}
  .check::before{content:"✓";color:var(--green);font-weight:900}.note{margin-top:18px;padding:18px 20px;border:1px solid rgba(250,164,26,.45);border-radius:14px;
    background:rgba(250,164,26,.08);color:#f1dfbd}.note b{color:#faa41a}
  footer{padding:28px clamp(20px,7vw,96px);border-top:1px solid var(--line);color:#8292a5;font-size:12px;background:#000b13}
  .copied{background:#008516!important}
  @media(max-width:900px){.grid,.handoff{grid-template-columns:repeat(2,1fr)}.prompt-grid,.recipe{grid-template-columns:1fr}.fixes{grid-template-columns:1fr}.section-head{grid-template-columns:60px 1fr}}
  @media(max-width:620px){.topbar nav{display:none}.grid,.handoff,.anatomy,.checklist{grid-template-columns:1fr}.section-head{display:block}.section-head p{margin-top:8px}.section-no{display:block;margin-bottom:10px}.hero{padding-top:62px}.palette{grid-template-columns:1fr}.swatch{min-height:76px}.anatomy div{grid-template-columns:1fr;gap:5px}}
</style>
</head>
<body>
<header class="topbar"><div class="brand"><span class="brand-mark"></span>SpectrumGPT × Hyperdesk</div>
  <nav><a href="#workflow">Workflow</a><a href="#prompts">Prompts</a><a href="#visuals">Visual recipe</a><a href="#handoff">Handoff</a></nav></header>
<div class="hero">
  <p class="eyebrow">Spectrum Reach · HTML creation guide</p>
  <h1>Prompt clearly.<br>Build something worth showing.</h1>
  <p class="hero-copy">A focused workflow for turning a SpectrumGPT conversation into a polished, self-contained webpage or slide deck you can refine in Hyperdesk.</p>
  <div class="hero-tags"><span>One complete HTML file</span><span>Spectrum Reach visual direction</span><span>Responsive by default</span><span>Easy to edit</span></div>
</div>
<main>
  <section id="workflow">
    <div class="section-head"><span class="section-no">01 / WORKFLOW</span><h2>The fastest reliable path</h2>
      <p>Give SpectrumGPT the assignment and constraints up front. Let Hyperdesk handle inspection, small edits, saving, sharing, and presentation.</p></div>
    <div class="grid">
      <div class="card"><span class="step">1</span><b>Define</b><h3>Name the deliverable</h3><p>Page or deck, audience, single goal, required facts, and desired call to action.</p></div>
      <div class="card"><span class="step">2</span><b>Prompt</b><h3>Set the visual system</h3><p>Ask for Spectrum Reach-inspired navy, bright blue, confident typography, and multiscreen motion.</p></div>
      <div class="card"><span class="step">3</span><b>Generate</b><h3>Demand one clean file</h3><p>Complete HTML, inline CSS and JavaScript, no framework, no build step, no commentary around the code.</p></div>
      <div class="card"><span class="step">4</span><b>Finish</b><h3>Open in Hyperdesk</h3><p>Paste the file, inspect it at multiple widths, tune the theme, save, and download or share.</p></div>
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-no">02 / ANATOMY</span><h2>What a strong prompt contains</h2>
      <p>Specific direction beats a long request. These eight ingredients are enough for most assignments.</p></div>
    <div class="anatomy">
      <div><strong>Role</strong><span>Senior presentation designer and front-end developer.</span></div>
      <div><strong>Audience</strong><span>Who will view it and what they already know.</span></div>
      <div><strong>Goal</strong><span>The one decision, takeaway, or action the file should drive.</span></div>
      <div><strong>Content</strong><span>Approved facts, required sections, CTA, and source material.</span></div>
      <div><strong>Visuals</strong><span>Spectrum Reach-inspired palette, hierarchy, density, and tone.</span></div>
      <div><strong>Format</strong><span>Webpage or slide deck, length, sections, and viewport.</span></div>
      <div><strong>Constraints</strong><span>Self-contained, accessible, responsive, no invented claims or assets.</span></div>
      <div><strong>Output</strong><span>Exactly one complete HTML document and nothing else.</span></div>
    </div>
  </section>

  <section id="prompts">
    <div class="section-head"><span class="section-no">03 / COPY</span><h2>Two prompts you can reuse</h2>
      <p>Replace the bracketed fields. Keep the constraints even when SpectrumGPT already understands the Spectrum Reach brand.</p></div>
    <div class="prompt-grid">
      <article class="prompt-card"><div class="prompt-head"><div><b>Webpage prompt</b><span>Brief, guide, dashboard, leave-behind</span></div><button class="copy">Copy prompt</button></div>
<pre class="prompt">You are a senior presentation designer and front-end developer supporting Spectrum Reach.

Create a polished self-contained HTML webpage.

AUDIENCE
[Who will read this and what they need to know]

GOAL
[The single takeaway or action]

CONTENT
[Paste the approved copy, facts, sections, and CTA here]

VISUAL DIRECTION
- Spectrum Reach-inspired: deep navy foundations, bright Spectrum blue, white, pale slate, and restrained sky-blue highlights.
- Confident, clear, modern, data-informed, and human. Use strong editorial hierarchy and generous space.
- Express the idea of reaching people across screens with layered cards, connected paths, subtle rings, or directional motion.
- Use Spectrum Sans if it is available; otherwise use a clean system sans-serif stack.
- Do not invent or redraw a Spectrum Reach logo. Use a supplied approved asset only if I provide one.

FORMAT AND BEHAVIOR
- Responsive at desktop, tablet, and mobile widths.
- Use semantic HTML, visible focus states, accessible contrast, and reduced-motion support.
- Add only useful interaction. Do not build a chat interface.
- Include polished custom scrollbars that match the page.

TECHNICAL CONSTRAINTS
- Return exactly one complete HTML document beginning with &lt;!DOCTYPE html&gt;.
- Put all CSS and JavaScript inside the file. No framework, build step, CDN, external font, or remote dependency.
- If images are not provided, use typography, gradients, CSS shapes, and layout instead of broken placeholders.
- Do not invent performance figures, client names, legal claims, or source citations. Use only the approved information above.
- Do not place Markdown fences or explanation before or after the HTML.

Before returning it, check that the page has a clear first screen, no clipped content, no horizontal overflow, readable text, and a strong final CTA.</pre></article>

      <article class="prompt-card"><div class="prompt-head"><div><b>Slideshow prompt</b><span>Pitch, recap, strategy, internal presentation</span></div><button class="copy">Copy prompt</button></div>
<pre class="prompt">You are a senior presentation designer and front-end developer supporting Spectrum Reach.

Create a polished self-contained HTML slide deck for Hyperdesk.

AUDIENCE
[Who is in the room]

PRESENTATION GOAL
[The decision or takeaway]

STORY AND APPROVED CONTENT
[Paste the facts, outline, required messages, and CTA here]

SLIDE PLAN
- Build [5–8] concise slides with one clear idea per slide.
- Use this arc: opening promise, audience/problem, key insight, recommended approach, proof or plan, next step.
- Keep body copy short enough to present, not read like a report.

SPECTRUM REACH VISUAL DIRECTION
- Deep navy, bright Spectrum blue, white, pale slate, and restrained sky-blue accents.
- Bold headlines, simple data moments, confident spacing, and a visual theme of connection across screens.
- Vary layouts while preserving one system. Avoid a repeated title-and-bullets template.
- Use only approved facts. Never invent results, reach figures, customers, awards, or testimonials.

HYPERDESK SLIDESHOW REQUIREMENTS
- Return one complete HTML document beginning with &lt;!DOCTYPE html&gt;.
- Add data-hs-slideshow to the body element.
- Make every slide a top-level section element and give it min-height:100vh.
- Design for a 16:9 1280×720 presentation while remaining responsive.
- Put all CSS and JavaScript inside the file; no framework, CDN, remote font, or build step.
- Do not create custom arrow-key presentation logic; Hyperdesk supplies presentation controls.
- Do not include Markdown fences or explanation outside the HTML.

Before returning it, check every slide for overflow, readable type, consistent alignment, useful contrast, and a clear ending.</pre></article>
    </div>
  </section>

  <section id="visuals">
    <div class="section-head"><span class="section-no">04 / SYSTEM</span><h2>A Spectrum Reach visual recipe</h2>
      <p>Use this as art direction, not as a replacement for official internal brand standards. Approved brand guidance and assets always win.</p></div>
    <div class="recipe">
      <div class="palette" aria-label="Spectrum Reach inspired color palette">
        <div class="swatch" style="background:#000f1a">#000F1A<br>Foundation</div><div class="swatch" style="background:#002139">#002139<br>Navy</div>
        <div class="swatch" style="background:#0271eb">#0271EB<br>Blue</div><div class="swatch" style="background:#73b7ff">#73B7FF<br>Sky</div>
        <div class="swatch" style="background:#d8dde6">#D8DDE6<br>Mist</div>
      </div>
      <div class="rules">
        <div class="rule"><i></i><span><strong>Lead with clarity.</strong> One promise on the first screen; supporting detail comes later.</span></div>
        <div class="rule"><i></i><span><strong>Use blue to direct.</strong> Reserve the brightest blue for actions, key numbers, and connective moments.</span></div>
        <div class="rule"><i></i><span><strong>Show multiscreen reach.</strong> Use connected panels, paths, rings, or layered frames—not generic AI imagery.</span></div>
        <div class="rule"><i></i><span><strong>Keep it credible.</strong> Calm spacing, precise labels, approved facts, and restrained motion feel more trustworthy.</span></div>
      </div>
    </div>
    <div class="note"><b>Brand safety:</b> never ask the model to guess a logo, legal disclaimer, customer result, product claim, or performance statistic. Supply approved material or leave a clearly labeled text placeholder for a human to complete.</div>
  </section>

  <section id="handoff">
    <div class="section-head"><span class="section-no">05 / HANDOFF</span><h2>From SpectrumGPT to Hyperdesk</h2>
      <p>The model creates the first complete draft. Hyperdesk is where you inspect, adjust, store, and deliver it.</p></div>
    <div class="handoff">
      <div class="card" data-step="01"><h3>Generate</h3><p>Ask SpectrumGPT for one complete HTML document.</p></div>
      <div class="card" data-step="02"><h3>Copy</h3><p>Copy from the doctype through the final closing HTML tag.</p></div>
      <div class="card" data-step="03"><h3>Paste</h3><p>In Hyperdesk choose Paste, name the file, and add it to the shelf.</p></div>
      <div class="card" data-step="04"><h3>Review</h3><p>Check Design, Interact, Theme, Code, and all viewport sizes.</p></div>
      <div class="card" data-step="05"><h3>Deliver</h3><p>Save, then Download, Share, or Present the final file.</p></div>
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-no">06 / REFINE</span><h2>Short follow-up prompts that work</h2>
      <p>Change one dimension at a time. Ask SpectrumGPT to preserve everything else.</p></div>
    <div class="fixes">
      <div class="fix"><span>Too generic</span><p>Make this feel more Spectrum Reach without changing the content or structure. Strengthen navy/blue hierarchy, multiscreen connection motifs, and confident editorial typography.</p></div>
      <div class="fix"><span>Too crowded</span><p>Reduce the visual density by 25%. Shorten secondary copy, add space, and preserve every approved fact and the primary CTA.</p></div>
      <div class="fix"><span>Weak first screen</span><p>Redesign only the opening section. Give it one bold promise, one supporting sentence, one action, and a visual idea based on reaching audiences across screens.</p></div>
      <div class="fix"><span>Slides overflow</span><p>Keep the slide count and story, but make every slide fit cleanly at 1280×720. Shorten copy and resize layout before reducing body text below a readable size.</p></div>
      <div class="fix"><span>Needs polish</span><p>Run a final design QA pass. Fix alignment, spacing rhythm, contrast, responsive behavior, focus states, custom scrollbars, and any horizontal overflow.</p></div>
      <div class="fix"><span>Need code only</span><p>Return the complete corrected HTML only. Start with the doctype. Do not add Markdown fences, a summary, or implementation notes.</p></div>
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-no">07 / CHECK</span><h2>Before you call it finished</h2><p>A sixty-second review prevents most avoidable problems.</p></div>
    <div class="checklist">
      <div class="check">The opening screen communicates one clear purpose.</div><div class="check">Every claim and number came from approved material.</div>
      <div class="check">The file works with no network connection.</div><div class="check">Desktop, tablet, and mobile widths have no horizontal overflow.</div>
      <div class="check">Text remains readable and controls have visible focus states.</div><div class="check">The palette feels Spectrum Reach without inventing brand assets.</div>
      <div class="check">Slide decks use body data-hs-slideshow and top-level sections.</div><div class="check">The final CTA or next step is obvious.</div>
    </div>
  </section>
</main>
<footer>This working guide reflects the current public Spectrum Reach visual and messaging direction. Use approved internal brand standards, legal guidance, facts, and assets whenever they are available.</footer>
<script>
  document.querySelectorAll('.copy').forEach(function(button){button.addEventListener('click',function(){
    var text=button.closest('.prompt-card').querySelector('.prompt').textContent;
    function done(){var old=button.textContent;button.textContent='Copied';button.classList.add('copied');
      setTimeout(function(){button.textContent=old;button.classList.remove('copied')},1400)}
    function fallback(){var area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');
      area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
      try{document.execCommand('copy');done()}catch(e){button.textContent='Select prompt'}area.remove()}
    if(location.protocol!=='about:'&&navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(done).catch(fallback);else fallback();
  })});
</script>
</body>
</html>`;
