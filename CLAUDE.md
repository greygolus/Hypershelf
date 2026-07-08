# Hypershelf — Claude Code Handoff

> Read this fully before touching `Hypershelf.html`. It is the complete context from the Cowork sessions that built this project (July 6, 2026). The app has non-obvious internal mechanics — the "How the editor actually works" section prevents the most likely misunderstandings.

## What this is

Hypershelf is "Google Drive + Google Docs, but for self-contained HTML files." Grey uses single-file HTML documents as replacements for text editors and slide shows (more customization/control, simpler AI integration). Hypershelf is the library + viewer + editor for those files.

**Core philosophy — do not violate:**
- The app SHIPS as one self-contained HTML file (`Hypershelf.html`): no framework, no runtime dependencies, vanilla JS. That file is now a **build artifact** — see Architecture below.
- No backend, no accounts. All user data stays on the user's machine (decided explicitly with Grey July 2026 — local-first forever; if sync ever happens it's an optional layer, not a rewrite).
- Deployable as-is: the built `Hypershelf.html` is what Vercel serves.

## Architecture (v1.7, July 6 2026) — READ THIS FIRST

**⚠ NEVER edit `Hypershelf.html` directly — it is generated.** Source lives in `src/`; edit there, then `npm run build` (no install needed; uses `npx esbuild`). The build bundles the ES modules, inlines JS+CSS into `src/index.html`'s shell, runs the integrity checks (script-boundary + `node --check` + `</html>`), and overwrites root `Hypershelf.html`. Commit `src/` AND the rebuilt `Hypershelf.html` together.

- `src/index.html` — markup shell (head, library + editor DOM, modal/toast/datalist)
- `src/styles.css` — all CSS
- `src/utils.js` — `$`,`$$`, esc, debounce, toast, rgbToHex, uid
- `src/db.js` — IndexedDB open + `idb` helpers
- `src/state.js` — the shared `state` object
- `src/library.js` — shelf grid/sidebar, card menu (+`setOpenMenu`), dialogs, import/create/backup/search
- `src/disk.js` — File System Access: listing, disk grid, open, multi-file bundling/unbundling, example site
- `src/editor.js` — editor core: open/save, renderFrame, edit handlers/drag, serialization, applyStyle + scoped rules, inspector, code panel, drafts, width presets, resizer
- `src/history.js` — undo/redo stack + version snapshots/modal
- `src/diff.js`, `src/ai.js`, `src/colors.js`, `src/tour.js` — line diff, AI round-trip, 🎨 Colors panel, tour
- `src/welcome.js` — the `WELCOME` playground HTML constant (own module so both `main.js` seed and `library.js` "＋ Example file" button import it without a circular dep)
- `src/share.js` — share links: deflate+base64url a `{n,h}` payload into the URL hash (`#s=…`), incoming-link confirm modal, 🔗 toolbar + card-menu wiring
- `src/slides.js` — deck-aware slide filmstrip: detection, thumbnails, add/duplicate/delete/move ops, Insert "Slide" entry hook
- `src/gradient.js` — gradient parse/serialize (first gradient in a background-image, other layers preserved) + color helpers (`normRGB` probe-span, `withAlpha`, `darken`)
- `src/main.js` — init, Welcome seed, analytics injection, and **`window.hs`** — the deliberate debug/test handle (the bundle keeps everything else off the global scope; automated tests drive the app through `hs.*`)

**Regenerate the Welcome file:** `library.js#addWelcomeFile()` adds a fresh copy of `WELCOME` to the shelf and opens it — wired to `#btnWelcome` (sidebar footer "📚 Add example file") and `#btnWelcome2` (empty-shelf state). Mirrors disk mode's `createExampleSite`.

**Dev:** `npm run dev` (http-server on :8787) → open `/src/index.html` (native ES modules, no build). **Test the BUILT file** at `/Hypershelf.html` before committing.
Cross-module mutable state goes through `state` or setter functions (e.g. `setOpenMenu`, `setCodeHighlight`) — ES module imports are read-only bindings.

**Added in v1.14 (July 8 2026) — draggable gradient preview:**
- The inspector's gradient preview strip (`#iGPrev`, now 46px) IS the position editor. The `%` text inputs are gone.
- **Stop markers** (`.gmark`) — one circle per stop, colored like its stop, hanging off the strip's bottom edge at `stopPositions(grad)[i]%`. Dragging one writes that stop's `pos` (clamped 0–100%), committing live through `applyStyle`. `stopPositions` (gradient.js) materializes auto positions the way CSS does: first 0, last 100, auto-runs spread linearly between explicit anchors; non-% units (px) fall back to interpolation and become % when dragged.
- **Dragging the gradient surface**: linear → all stops slide together (base positions captured at mousedown, per-stop clamp 0–100); radial → the `at X% Y%` center follows the mouse (`parseAt`/`setAt` rewrite only the `at` clause of the shape string; clamp −50%..150% because real centers sit off-canvas — the Welcome hero is `at 50% 135%`).
- Mechanics: `dragTrack` helper adds window-level mousemove/mouseup, commits on every move (serialize debounce collapses a whole drag into ONE history entry), and re-renders the inspector once on release. Marker mousedown `stopPropagation`s so it never triggers the surface drag. `updateMarkers` recomputes ALL marker lefts each move (moving one stop shifts neighboring auto stops).
- Stop rows keep color input + ⍺ badge + ✕; color edits also live-recolor the matching marker.

**Added in v1.13.1 (July 8 2026) — slideshows are explicit (supersedes v1.12's detection):**
- The 2+-`<section>` heuristic was a false-positive machine (plain documents use `<section>`). `isDeck(html)` is replaced by **`isSlideshow(cur)`** (slides.js): true only when the shelf file has a **"slideshow" tag** (`/^slide ?show$/i` — the normal tags UI adds/removes it) OR the file's HTML contains **`data-hs-slideshow`** (an attribute on `<body>` — travels with the file through share links, downloads, and disk mode, which has no tags).
- The **deck template opts in both ways**: `tags:['slideshow']` on the template entry (library.js passes template tags to `addFile`) + `<body data-hs-slideshow>` in its HTML.
- **Share links now carry tags** (`{n,h,t}` payload — old `{n,h}` links still parse; `t` capped at 20 strings on receive), so a shared slideshow stays a slideshow on the recipient's shelf.
- To make any existing file a slideshow: tag it `slideshow` (card ⋮ → Edit tags), or add `data-hs-slideshow` to its `<body>` (only option for disk files).

**Added in v1.13 (July 8 2026) — gradient editor in the inspector:**
- **Why**: gradients are everywhere in AI-generated files; the inspector's Background control wrote `background-color`, which is invisible under a gradient's `background-image` (or wiped it via shorthand) — "doesn't work or replaces it with a solid".
- **Detection**: `renderInspector` runs `parseGradient(cs.backgroundImage)` (computed style — shorthand already resolved, colors normalized to rgb()). If it parses, the Background field is replaced by a **gradient editor**: live preview bar, one row per stop (color input + position text + ⍺ badge when the stop has alpha), type select (linear/radial), angle input (linear only), ＋ stop / → solid / reset.
- **Every change routes through `applyStyle('background-image', …)`** — scope-picker aware (a scoped ⤳ writes ONE CSS rule hitting all matches — verified on the three .badge chips) and undoable. `→ solid` sets `background-image:none` + `background-color:<first stop>`; reset clears the override back to the file's own CSS.
- **Solid backgrounds get a ⤳ grad button** — converts to `linear-gradient(135deg, base, darken(base,.55))` (transparent backgrounds seed from brand cyan).
- **Alpha is preserved per stop**: editing a stop's color keeps its original opacity (`withAlpha`) — a `transparent 65%` fade stop stays a fade. `normRGB` parses any CSS color by assigning it to a hidden probe span and reading computed style.
- **Parser safety**: `parseGradient` handles linear/radial/repeating, `to right`/`deg` angles, `circle at X Y` shapes, multi-layer background-images (`before`/`after` kept verbatim, only the first gradient edited), nested-paren-aware top-level comma split. It returns `null` — editor stays plain, value untouched — for anything it can't faithfully round-trip: `var()`, `color-mix()`, unknown identifiers (validated against `normRGB`). Never guess: a wrong serialize corrupts user CSS.
- 🎨 Colors panel already handled gradient stop colors as individual swatches (they're plain color tokens in CSS regions) — unchanged.

**Added in v1.12 (July 8 2026) — deck-aware editor (slides filmstrip):**
- **One editor, not two apps** (decided with Grey): a file counts as a **deck** when `state.cur.html` has ≥2 `<section>` elements (`isDeck`, regex count — same slide rule as Present). Only then do the 🎞 Slides toolbar button, the filmstrip, and the Insert "Slide" entry exist; documents see none of it.
- **Filmstrip sidebar** (`src/slides.js`, `#slidePanel` left of `#frameWrap`) — one 16:9 thumbnail per slide: full document in a `sandbox=""` iframe (1280×720 scaled to 0.1344), scripts set `type=text/plain`, every other section hidden via injected `[data-hs-thumbhide]{display:none}`. Click = jump + select that section (auto-switches to Edit; polls `getDispDoc()` for the fresh iframe). Hover ops per slide: ＋ add after, ⧉ duplicate, ↑/↓ move, ✕ delete (blocked on the last slide); ＋ Add in the header. Toggle persists as `localStorage['hs-slides']` ('0' = closed; default open).
- **Structural ops go through the normal edit pipeline** (`withEdit`): ensure Edit mode → `flushSerialize` → mutate `state.srcDoc` → `serializeSrc`+`histPush`+`setDirty`+`renderFrame`+`refreshCodeText` — so undo, versions, drafts, code panel all just work. Duplicate strips `data-hs-id` from the clone tree (ids must stay unique).
- **New slides inherit the deck's BASE class** — the intersection of every slide's classList (deck template slides are `slide title` / `slide` / `slide accent` → new slide gets plain `slide`; modifiers must not leak). Empty intersection on a class-less deck yields an empty class — correct, matches the deck.
- **Editor→panel sync via window events**, no import cycle: `renderFrame` and `showLibrary` dispatch `hs-rendered`, `doSerialize` dispatches `hs-edited`; slides.js listens with a 300ms-debounced refresh. `getDispDoc()` accessor exported from editor.js.
- 🔗 **Share moved to the right of Save** (was hidden mid-toolbar).
- ⚠ Test-automation note: `openFile` is NOT on `window.hs` — open files by clicking `.card[data-id]`. Reopening a file with an unsaved draft fires a native `confirm()` (draft recovery) which BLOCKS headless automation — override `window.confirm` before clicking, or the eval renderer hangs and the preview must be restarted.

**Added in v1.11 (July 8 2026) — share links:**
- **The link IS the file** (`src/share.js`) — no upload, no backend: `makeShareLink(name,html)` JSON-encodes `{n:name,h:html}`, deflates it with the native `CompressionStream('deflate-raw')` (zero dependencies), base64url-encodes (unpadded, `-_` alphabet) and appends as `#s=…`. The hash never reaches any server. Base URL is `location.origin+pathname` when served over http(s), else the deployed `https://hypershelf.vercel.app/` (so file:// copies mint working links). Chunked `String.fromCharCode.apply` in the encoder avoids call-stack overflow on big files.
- **Outgoing**: 🔗 Share button in the editor toolbar (`syncNow()` first) + "Copy share link" in the card menu → `shareFile` copies the link and toasts. Links >8000 chars get a size warning in the toast (chat apps truncate long URLs — Download travels safer). If `navigator.clipboard` is blocked, a fallback modal shows the link in a readonly input for manual copy (an INPUT, not a textarea — ui.js's Escape handler confirm-prompts on non-empty modal textareas).
- **Incoming**: `checkShareHash()` (called at init after `renderLibrary`, plus a `hashchange` listener for links pasted into an open tab) parses `#s=`, inflates, and shows a **confirm modal** — file name, size, sandboxed preview iframe (`.shprev`) — before anything is written. "Add to my shelf" adds a copy via `addFile`, resets filters, opens it; "Not now" adds nothing. Both paths clear the hash via `history.replaceState`. Damaged/truncated links toast an error and clear the hash; nothing is added.
- Welcome playground gained a 🔗 Share tip (existing seeded copies keep the old text — re-add via 📚).
- Requires `CompressionStream` (Chrome 103+, Edge, Safari 16.4+, Firefox 113+) — same era as the File System Access API the app already leans on.

**Added in v1.10 (July 8 2026) — create from nothing + presenter:**
- **Templates gallery** (`src/templates.js`) — ＋ New opens a modal (name + 4 tiles): Blank, Document (serif notes page), Slide deck (each `<section class="slide">` is one full-viewport slide, script-free — presenter handles nav), Landing page (hero + `.feature` cards wired for the scope-picker demo). Each template uses a distinct palette/font stacks so 🎨 Colors demos well. NO template may contain a literal `</script` (the single-file trap).
- **＋ Insert palette** (`src/insert.js` UI + `editor.js#insertHtmlAfterSelection`) — heading/paragraph/button/link/list/image/container/two-columns/divider. Inserts after the selected element (or appends to body); images picked via `#imgInput` become base64 data URIs (>2MB toasts a size warning). Mechanics: node inserted into srcDoc, its `body *` document-order index computed, serialize+histPush+renderFrame, then the fresh display element is re-selected by that index (poll loop waits for iframe load — renderFrame re-annotates ids by document order, so the index is stable). Works from Interact mode too (auto-switches to Edit).
- **Inline text editing** — double-click any text LEAF in Edit mode → `contenteditable=plaintext-only` in place, caret placed via `caretRangeFromPoint`. `input` mirrors textContent to srcEl + inspector Text box + scheduleSerialize; blur/Escape end it. Guards: clicks inside the editing element pass through (no preventDefault), mousedown doesn't arm dragging, hover marks suppressed, iframe Ctrl+Z left to the native contenteditable undo while editing. Green outline via injected `[contenteditable]` style.
- **▶ Present** (editor toolbar) — fullscreen overlay `#presentOv` with a sandboxed iframe of `applyAssetCache(cur.html)` + injected `PRESENT_JS` nav (built by string concat — no literal `</script`): slides = `section` elements (fallback: body children), ←/→/PageUp/PageDown/Space navigate with smooth scroll + a fading HUD counter, Esc posts `hs-exit-present` to the parent (sandbox can't reach in). Parent closes on that message, on fullscreen exit, or via the global Escape handler (`ov._close`). `requestFullscreen` needs the click gesture; falls back to a fixed overlay.

**Added in v1.9.1 (July 8 2026):**
- **Container-aware drag** — you can now drop INTO containers, not just beside things. Zones per hovered target: leaves = pure before/after halves (never nest); containers = thin edges (6–16px) drop beside, the middle drops inside (`placeInto` positions among children by cursor, rows/columns/wraps); sibling containers = reorder dominates with a small middle nest zone. Axis-aware: horizontal rows split left/right (`flowsHorizontally` uses genuine vertical rect overlap — NOT top-distance, which misfires on tall elements). Two hard-won rules: (1) hovering your OWN container's background always repositions within it — grazing its internal edges must never eject the element (that was the "random" feel); (2) leaf halves must be an if/else, not fall-through zones — a dead-center cursor on a leaf was falling into `placeInto` and nesting. Empty containers and the page body accept drops too.
- **Multiple disk folders** — `state.disk` (single) → `state.disks` array; each entry `{id,handle,name,files,needsPerm}` persisted as its own record in the `handles` store (legacy `'dir'` record loads as a normal folder). Sidebar lists all folders (each with ✕ disconnect + per-folder permission reconnect), "Add another folder…" button, and Refresh/⊕Example act on the folder being viewed (`activeDisk()`; `state.filter.disk` now holds the disk id, not a boolean — truthiness checks all still work). Open disk files carry `root` + `diskId` on `state.cur`, so bundling/multi-file save always target the right folder; `verKey` now includes the diskId (old disk-file versions/drafts under the previous key format are orphaned — accepted).

**Added in v1.9 (July 8 2026):**
- **Live drag reorder** — dragging the selected element now MOVES it in the display doc on every mousemove (what you see mid-drag is exactly what you get), instead of only marking a drop line and committing on release. Mechanics: `pointer-events:none` on the dragged element so `elementFromPoint` hit-tests through it; a no-op guard (`tgt.previousElementSibling!==drag.el` etc.) prevents layout thrash/flip-flopping; `[data-hs-dragging]` style (dimmed + green dashed outline); mouseleave CANCELS and restores the origin position (`origParent`/`origNext`); on mouseup the final display position is mirrored into srcDoc by walking to the nearest HS-annotated prev/next sibling (skips #hsHandles / data-hs-rules), falling back to parent prepend. `data-hs-drop-before/after` marks are gone.
- **🎨 Colors picker replaced** — the 24 suggestion tiles are gone; expanding a swatch row now shows an HSL picker: 3 sliders (hue / saturation / lightness, each track painted with a live gradient of what moving it does) + a hex input + preview chip. Slider `input` = live preview (80ms debounce via `themeHoverT`, no history/dirty), slider `change` (release) = commit through `applyColorSwap`. Hex box commits on change/Enter; invalid values toast + revert. Sliders re-init from the committed color after each rescan.

**Added in v1.8.1 (July 6 2026) — guided examples:**
- **Welcome file rewritten as an interactive playground**: sectioned feature walkthrough (mouse modes / move·resize·multiply / styling power / source & safety nets / real files) with a green "▸ try it:" prompt under each feature and practice targets baked in — three `.badge` chips (scope-picker demo reads "all .badge (3)"), a dashed "resize me" box, the live-JS button. Still seeds once via `hs-welcomed`.
- **Aurora Coffee example rewritten as a self-explanatory showcase**: "how to play" chip strip under the header, a live clock proving js/app.js runs in Interact, three `.card`s with an on-page note explaining scoped edits land in css/style.css, a dashed "resize me" banner, TWO font stacks (headings serif vs body sans — the 🎨 Colors panel shows both), heavily commented css/js. `DEMO_FILES` and `C:\Users\greyg\Desktop\hypershelf-example` are kept in sync.
- **Tour step 3 is now actionable**: TOUR entries support `action:{label,run}` — the "Real files on your computer" step has a button that calls `connectFolder()` (the click is the required user gesture for showDirectoryPicker) then `createExampleSite()`, then re-anchors the step. Final tour step points at the Welcome file as the playground.

**Added in v1.8 (July 6 2026):**
- **Resize handles** — E/S/SE cyan handles (`#hsHandles`, injected into the display doc by `ensureHandles`/`positionHandles` in editor.js) on the selected element, with a live "W × H" readout. Box-sizing aware (content-box elements get padding+border subtracted so the OUTER edge follows the mouse). Always applies INLINE (`applyInlineStyle` — resize is per-element; `applyStyle` keeps routing through the scope picker for everything else). Handles hide during element-drag, reposition on scroll/edits, and sync the inspector's W/H fields on release.
- **Inspector restructured into collapsible `<details class="isec">` sections** (open state persists per session in `inspOpen`): Colors & font, Spacing, **Layout & size** (W/H, display, flex direction/wrap/justify/align/gap — flex controls appear when display is flex — text-align), **Border & effects** (border width/style/color — width auto-defaults style to solid, radius, shadow presets from `SHADOWS` + custom textarea, opacity slider), Attributes. All controls flow through `applyStyle` → scope-picker aware.
- **Built-in font stacks** (`src/fonts.js`) — 14 curated cross-platform stacks (modern-font-stacks style: System UI, Neo-Grotesque, Humanist, Geometric, Industrial, Rounded, 4 serif families, Slab, 2 monos, Handwritten) needing ZERO font files, so documents stay self-contained. `openFontMenu(anchor,onPick)` floating picker previews each stack in its own face; wired to the inspector font field (🅰) and every font row in the 🎨 Colors panel (🅰 swaps a stack file-wide).

## Current state (v1.6, working)

**Added in v1.6 (Claude Code, July 6 2026) — multi-file disk projects:**
- **Disk mode now handles real sites** (HTML + separate CSS/JS files). On open, `bundleDiskHtml` resolves relative `<link rel=stylesheet>` and external `<script src>` references against the connected folder (subfolders + `../` within root; external URLs skipped) and inlines them as `<style data-hs-src="path">` / `<script data-hs-src="path">` blocks. The WHOLE editor then works on external CSS for free: Edit mode, 🎨 Colors, scope-picker rules, code panel, undo, versions, AI round-trip.
- **Asset cache**: relative images/fonts/media (`src=` and CSS `url()`) are preloaded as data URIs (3MB/file cap) and substituted at RENDER time only (`applyAssetCache` in renderFrame + preview iframes) — the working document keeps clean paths.
- **Multi-file save** (`saveDiskProject`): each `data-hs-src` block writes back to its own file (skipped if unchanged), the original `<link>`/`<script src>` tags are restored in the HTML, and the HTML file is written. Adding a NEW `<style data-hs-src="new.css">` block in code creates that file on save. Script bodies containing `</`+`script` are escaped as `<\/script` at bundle time and unescaped at save.
- **Recursive folder listing**: `listDisk` walks subfolders (depth ≤3, skips node_modules/.git/.next/dist/build/.vercel); disk file names are folder-relative paths.
- **Code panel file-jump** dropdown (`#fileJump`, visible only for bundled projects) scrolls to a bundled file's block. Disk thumbnails bundle CSS too (never scripts).
- **AI scaffold** gains a rule to preserve `data-hs-src` blocks when the open file is a bundled project.
- **Built-in example site** (`DEMO_FILES`/`createExampleSite`): "⊕ Create example site" in the disk sidebar (and in the empty-folder state) writes `hypershelf-example/` (index.html + css/style.css + js/app.js + images/logo.svg — the "Aurora Coffee" demo) into the connected folder. A ready-made copy also lives at `C:\Users\greyg\Desktop\hypershelf-example`. NOTE: the demo html inside DEMO_FILES writes its script tag as `<\/script>` in the template literal — required, see the single-file-app trap above.
- ⚠ **Single-file-app trap (bit us in this build):** any literal `</script` sequence inside the app's own JS (even in a string) TERMINATES the app's script element — the rest of the app renders as page text with NO console error. Always write it split (`'</'+'script'`). The verify step now checks `indexOf('</script')` from the script start equals the real closing tag position — keep using that check after every edit.

## v1.5 state

**Added in v1.5 (Claude Code, July 6 2026):**
- **🎨 Colors panel — Back/Reset + hover preview (added same day):** panel has its own ↶ Back (steps through color/font changes one at a time, `themeHist` stack) and Reset all (returns to `themeOrig`, captured when the panel was opened) — both also feed the global undo stack. Clicking a swatch row expands a 24-tile suggestion palette (12-hue wheel, light/dark ramp of the current color, neutrals); **hovering a tile live-previews** the whole file (120ms delay, no dirty flag, no history entry), mouse-out reverts, click commits. Un-committed previews are dropped on panel close. Global undo/version-restore/AI-accept now **rebase the panel** (`renderThemePanel` re-scan) so a stale `themeBase` can't resurrect undone changes.
- **🎨 Colors panel (file theme editor)** — toolbar button; right-side panel (replaces the inspector while open, works in both mouse modes). `scanTheme` scans ONLY CSS regions (`mapCssRegions`: `<style>` blocks + `style=""` attributes) for hex/rgb(a)/hsl(a) tokens, groups them by base RGB (alpha variants and different notations of the same color are one swatch, shown as "N uses · M forms"), plus all `font-family` declaration values as editable "font stacks". Changing a swatch **finds & replaces** every token of that group (alpha variants keep their alpha; hex replacement uses a `(?![0-9a-fA-F])` boundary so `#fff` never matches inside `#ffffff`). Live preview while dragging (debounced 350ms, applied from `themeBase`), commit + rescan on change; all through `histPush` (undoable). Named colors (`red`, `white`) and JS-set colors are NOT detected — known limitation.
- **Scope picker ("Apply style edits to")** — dropdown in the inspector listing candidate selectors with live match counts (full class list, tag+classes, single classes, bare tag; only options matching >1 element). With a scope selected, all style controls (colors, font, size, margin/padding) write a **CSS rule** instead of inline styles, into a managed `<style data-hs-rules>` block appended to `body` (persisted in the file, one rule per selector, parsed/serialized by `parseRuleText`/`setScopedRule`, mirrored live into the display doc; sheet auto-removed when empty). Text/attributes/delete/duplicate stay single-element by design. The chosen scope survives inspector re-renders on the same element. Note: rules can lose specificity battles against the file's own stronger selectors — accepted tradeoff (no `!important`).
- **AI round-trip (🤖 AI toolbar button)** — modal with (a) "Copy file + prompt": puts the file + a rules scaffold (complete-file ```html block, stay self-contained) on the clipboard for any AI chat; (b) paste-back: extracts the HTML from the pasted reply (`extractHtml` — fenced block first, then doctype/html match, then raw-HTML heuristic), shows a folded **line diff** and a **before/after iframe preview**, Accept applies via `histPush` + `renderFrame` (undoable; Save persists).
- **Line diff engine** — `diffLines` (LCS on Uint32Array, common prefix/suffix trimmed, >4M-cell fallback marks whole middle changed) + `renderDiffHTML` (folds unchanged runs >8 lines to 3 lines of context). Shared by the AI modal and the **Diff button** in version history (snapshot → current).
- **Autosave / crash recovery** — DB bumped to **4**, new `drafts` store (keyPath `fileId`). Dirty editor state autosaved every 10s + on tab hide (`saveDraft`). Reopening a file with a differing draft prompts recovery (`offerDraftRecovery`); drafts are cleared on Save, on explicitly leaving the editor, and on file delete.
- **Attribute editor** — inspector lists/edits/adds/removes attributes. Reads from the **source** element (display has `on*` stripped); `on*` attributes are applied to source only so they stay inert in the edit iframe. `data-hs-*` and `style` excluded.
- **Spacing controls** — margin/padding T/R/B/L number inputs, computed values as placeholders, inline px values editable, empty resets.
- **Drag to move elements** — in Edit mode, drag the *selected* element; green drop indicator shows before/after target (top/bottom half); move dual-applied to display + srcDoc (ids unchanged, no re-render). Click after drag is swallowed (`justDragged`).
- **Resizable code panel** — drag handle (`#codeResizer`) between page and code panel; `body.resizing` disables iframe pointer-events during drag; clamped 240px–80vw.
- **Light theme** — `body.light` CSS variable overrides + fixes for hardcoded dark colors (code panel, diff view, hover states); ◐ toggle in sidebar footer, persisted as `localStorage['hs-theme']`.
- **First-run tour** — 5-step spotlight overlay (`#tourHole` box-shadow spotlight + `#tourCard`), runs once (`localStorage['hs-toured']`), replayable via ↺ in sidebar footer. Welcome file still seeds independently.

**Added in v1.3 (Claude Code, July 6 2026):**
- **Undo/redo** — in-memory snapshot stack of `state.cur.html` (`hist`, max 100, reset per opened file), pushed from `doSerialize`, `codeChanged`, duplicate-element, and version restore. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (also forwarded from inside the edit-mode iframe); ↶/↷ toolbar buttons. Native textarea undo is left alone when focus is in a field.
- **Version history** — DB bumped to version **3**, new `versions` store (keyPath `vid`): `{vid, fileId, ts, html}`. A snapshot is stored on every successful Save (skipped if identical to the newest one), capped at 20 per file (`VMAX`). Disk files key as `'disk:'+name`. ⌛ History button → modal with per-version sandboxed preview iframe + Restore (loads into the editor; user must Save to persist). Versions are deleted with their file.
- **Reverse code mapping** — clicking a line in the code panel selects the matching element (walks up to the nearest line carrying a `data-hs-id`); only active in Edit mode while the code text matches `serializeSrc()` (same line count), otherwise it silently does nothing.
- **Selection breadcrumb** in the inspector (`body › div › h1`), ancestor crumbs clickable.
- **Duplicate element** inspector button — clones the srcDoc element, re-serializes, full re-render (so `data-hs-id`s stay unique).
- **Preview width presets** — toolbar select (Full/1024/768/390) sizes the editor iframe; `applyPreviewWidth()` runs after every `renderFrame`.
- **Bug fixes**: `btnBack` now awaits `saveCur()` (disk saves used to silently fail when leaving via Back — `state.cur` was nulled mid-await; `saveCur` also captures locals up front now); `rgbToHex` returns `null` for fully transparent colors and the inspector shows "transparent" instead of #000000; Escape asks before discarding a modal that has typed textarea content; `beforeunload` sets `returnValue` for cross-browser support.

## v1.2 state (all still accurate)

- **Library view**: card grid with live iframe thumbnails (sandboxed, lazy via IntersectionObserver), folders, tags, search (matches file name + display name), sort by modified.
- **File sources — two kinds, different behavior:**
  1. **Shelf files** — stored in IndexedDB (copies; originals untouched). Full features: folders, tags, display names, duplicate, download, delete.
  2. **Disk files** — via File System Access API ("This computer" → 📂 Open folder). Lists .html files in a real folder; opening one edits the REAL file; Save writes to disk via `createWritable()`. Chrome/Edge only. No tags/display names/rename for disk files (no DB record for them). Directory handle persists in IndexedDB `handles` store; browser re-prompts for permission after restart (`queryPermission`/`requestPermission`, `needsPerm` flag).
- **Editor**: one live iframe + mouse-mode toggle:
  - 🖱 **Interact** — page runs live, sandbox `allow-scripts allow-modals allow-forms allow-popups` (no `allow-same-origin`).
  - ✎ **Edit** — click-to-select elements; inspector panel edits text (leaf elements only), color, background, font family, font size, delete.
  - **‹/› Code** — side-by-side editable source panel with Chrome-inspector-style behavior: clicking an element in Edit mode scrolls to + highlights its line. Typing in code re-renders the page (600ms debounce).
- **Import/export**: upload, paste, drag-drop; per-file download; whole-library JSON backup export/import (`{app:'hypershelf',version:1,folders,files}`).
- First run seeds a Welcome file (guarded by `localStorage['hs-welcomed']`).

## Data model

IndexedDB db `hypershelf`, version **4**:
- `files` (keyPath `id`): `{id, name, displayName?, folder, tags[], html, created, modified}` — `html` is the full source text, the single source of truth.
- `folders` (keyPath `name`): `{name}`.
- `handles` (keyPath `id`): one record per connected folder `{id, handle}` (FileSystemDirectoryHandle, structured-cloneable). Multiple folders supported since v1.9.1; a legacy single record with `id:'dir'` still loads as a normal folder.
- `versions` (keyPath `vid`): `{vid, fileId, ts, html}` — Save snapshots, max 20 per file. `fileId` is the file's `id`, or `'disk:'+name` for disk files. Not included in the JSON library backup (by design — backups stay lean).
- `drafts` (keyPath `fileId`): `{fileId, ts, html}` — autosaved unsaved editor state for crash recovery; at most one per file; same `fileId` scheme as versions. Also excluded from backups.

`state` object: `files, folders, filter{folder,tag,q,disk}, disk{handle,name,files,needsPerm}, cur, mmode('interact'|'edit'), codeOpen, dirty, srcDoc, selEl`.

`state.cur` is a *copy* of the open file (`{...f}`); nothing persists until Save (`saveCur`). Disk files open as `{id:null, disk:true, handle, name, html}` and Save branches to `createWritable()`.

## How the editor actually works (critical)

- `renderFrame()` builds a **fresh iframe every time** (never reuse iframes/srcdoc — reuse caused a white-screen bug in v1; that's why it's this way).
- **Edit mode pipeline**: parse `cur.html` with DOMParser → `state.srcDoc`; annotate every `body *` element with sequential `data-hs-id`; render a **display clone** in a NON-sandboxed iframe (same-origin so the parent can attach listeners) with `<script>` tags set to `type="text/plain"` and all `on*` attributes stripped — the page holds still and is safe. Hover/selection outlines via injected `[data-hs-hover]/[data-hs-sel]` style.
- **Every visual edit is applied twice**: to the clicked display element AND to the matching srcDoc element (`srcEl()` matches by data-hs-id). Serialization back to `cur.html` is debounced 300ms (`scheduleSerialize`/`doSerialize`/`flushSerialize`). `syncNow()` flushes everything before save/download/mode-switch — call it before reading `cur.html` anywhere new.
- **Serialization** = clone srcDoc, strip `data-hs-id`, emit `'<!DOCTYPE html>\n' + documentElement.outerHTML`. This NORMALIZES formatting (DOM round-trip) — accepted tradeoff; only happens after an actual visual edit, never on open.
- **Code↔element line mapping**: serialize srcDoc WITH ids and split into lines; removing attributes doesn't change line count, so the line index of `data-hs-id="N"` equals the line in the clean text — valid when the code panel content equals `serializeSrc()`. If the user hand-edited code (line counts differ), falls back to content matching then first-tag-occurrence. Don't "simplify" this without understanding it.
- **Code panel highlight**: `#codeBack` is a `<pre>` behind a transparent-background `#codeTa` textarea, identical font metrics, scroll-synced; highlighted line is a styled span in the backdrop. Fonts/padding of the two MUST stay identical or alignment breaks.
- Interact-mode iframe deliberately lacks `allow-same-origin` (origin isolation for untrusted file scripts). Thumbnails use `sandbox=""` (no scripts at all).

## Known quirks / limitations

- Visual edits normalize the file's HTML formatting (see above).
- Disk file names are read-only in the editor (`FileSystemHandle.move()` not implemented).
- Folder permission must be re-granted after browser restart — browser security, not a bug (⚠ shown, click to reconnect).
- Firefox: no File System Access API — section shows a notice.
- IndexedDB is per browser + per origin: the local file and any future deployed URL have SEPARATE shelves. JSON backup is the bridge.
- `beforeunload` guard exists but a hard browser crash loses unsaved editor changes (no autosave yet).

## ⚠ Process warnings from the build sessions

**`npm run build` is the required last step of every change** — it regenerates `Hypershelf.html` and runs the integrity checks automatically (script-boundary mismatch, JS parse, `</html>` terminator). If the build passes, the historical failure modes below are covered; they're kept for context.

While editing via Cowork, large file writes to the vault got **silently truncated at ~40KB** (a Cowork mount sync issue — the app file died mid-script and the whole site went dead until repaired). Claude Code writes directly so this specific failure shouldn't recur, but keep the habit: **after any write, verify the file still ends with `</html>` and the JS parses** (e.g. extract `<script>` body → `node --check`). A broken write here bricks the user's daily tool.

## Deployment (LIVE as of July 6 2026)

- **Live site:** https://hypershelf.vercel.app · **Repo:** https://github.com/greygolus/Hypershelf
- Repo root = this folder (`.gitignore` excludes `.claude/`, the project home note, `.vercel`, `.env*`). `Hypershelf.html` stays the only source file; `vercel.json` rewrites `/` → `/Hypershelf.html` (no rename, no duplication).
- Vercel project `hypershelf` (scope `greygolus-projects`), **git-connected**: pushing to `main` auto-deploys production. Manual deploy: `npx vercel deploy --prod` from this folder.
- The deployed site has its own origin → its own empty shelf. Migrate files with Export/Import library backup.
- **Web Analytics**: the site injects `/_vercel/insights/script.js` at init, but ONLY when `location.hostname` ends with `.vercel.app` — local copies stay dependency-free. Enabling analytics itself is dashboard-only (no public API): Vercel dashboard → hypershelf → Analytics → Enable, then redeploy (`npx vercel redeploy` or any push).

## Branding (v1.5, July 6 2026)

- Restyled to match **greygolus.com**: black `#000000` bg, silver `#ECEEED` text, cyan `#54C8FF` accent (`--accent2:#2493DC` gradient stop), near-black panels, mono uppercase section labels, faint 60px grid + cyan radial glow (`body::before`), cyan selection, glow on card hover. Light theme = silver bg `#ECEEED`, near-black text, deeper cyan `#0e87cc` (white text on accent surfaces vs black text in dark mode).
- **Logo** (neon folder PNG) embedded ONCE as base64 in the sidebar `<img class="mark">` (~41KB, 128px); the favicon `<link id="favicon">` is set from that img's src at init — don't add a second copy.
- Cyan literals also live in: edit-mode outline styles (renderFrame injected CSS), `#codeBack .hl`, and the WELCOME seed file (restyled dark to match brand).

## Agreed feature roadmap (from discussion; not yet prioritized by Grey)

Quick wins: ~~undo/redo~~ ✅ · ~~reverse mapping~~ ✅ · ~~selection breadcrumb~~ ✅ · ~~duplicate element~~ ✅ · ~~responsive-width presets~~ ✅ (v1.3) · ~~attribute editing~~ ✅ v1.4. Remaining: code panel syntax highlighting + find/replace + prettify.

Core: ~~version history with rollback + diff~~ ✅ v1.3/1.4 · ~~box-model (spacing) editing~~ ✅ v1.4 · ~~autosave/crash recovery~~ ✅ v1.4 · ~~global theme swap~~ ✅ v1.5 (🎨 Colors panel + scope picker). Remaining: DOM tree panel; console panel capturing sandbox logs; full-text content search; templates gallery; command palette (Ctrl+K); inline text editing (contenteditable); insert-element palette.

AI: ~~"Copy for AI" + paste-back with visual diff~~ ✅ v1.4. Remaining: element-level AI edits; more prompt presets.

AI (Grey's main thesis — high priority to him): "Copy for AI" (file + prompt scaffold → clipboard); paste-back with visual diff before accepting; element-level AI edits; prompt presets.

Big bets: URL-hash sharing (lz-string); self-contained audit (flag/inline external deps as base64); presenter mode for slide decks; GitHub per-file sync.

Claude's suggested first picks: version history, undo/redo, Copy for AI + paste-back diff.

## Working with Grey

- Concise and direct; no filler. He wants to understand how something works *before* it's built — explain approach first for anything significant, and ask clarifying questions up front.
- Iterative and detail-oriented; cares about clean, future-proof, vendor-lock-free structure.
- Never present unverified info as fact. Don't over-build beyond what he asked.
- This folder lives in his Obsidian vault (`Efforts/Hypershelf/`). `_Hypershelf (Project Home).md` is the project pointer note — update its Status section when meaningful changes land. Vault conventions live in `AIOS/` at the vault root (root `CLAUDE.md` explains).

## Quick test checklist after changes

1. Open the file in a browser — shelf renders, thumbnails load.
2. New / Upload / Paste / drag-drop all add files.
3. Open a file: Interact mode runs scripts (Welcome file's demo button).
4. Edit mode: click element → inspector edits text/colors/font/size; delete works; dirty dot appears; Save persists (reload to confirm).
5. Code panel: opens, element click highlights the right line, typing re-renders, edits save.
6. Tags modal, rename/display-name modal, move-to-folder, duplicate, download, delete.
7. Folder connect (Chrome): list, open, edit, Save writes to the real file; reconnect flow after browser restart.
8. Library backup export → import round-trip.
