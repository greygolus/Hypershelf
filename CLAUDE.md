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
- `src/main.js` — init, Welcome seed, analytics injection, and **`window.hs`** — the deliberate debug/test handle (the bundle keeps everything else off the global scope; automated tests drive the app through `hs.*`)

**Dev:** `npm run dev` (http-server on :8787) → open `/src/index.html` (native ES modules, no build). **Test the BUILT file** at `/Hypershelf.html` before committing.
Cross-module mutable state goes through `state` or setter functions (e.g. `setOpenMenu`, `setCodeHighlight`) — ES module imports are read-only bindings.

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
- `handles` (keyPath `id`): `{id:'dir', handle}` — the FileSystemDirectoryHandle (structured-cloneable).
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
