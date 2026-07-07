# Hypershelf

**Google Drive + Google Docs, but for self-contained HTML files.**

Hypershelf is a library, viewer, and editor for single-file HTML documents — the kind you use instead of text editors and slide decks when you want full control and easy AI integration.

The entire app is **one self-contained HTML file**: [`Hypershelf.html`](Hypershelf.html). No build step, no framework, no external dependencies, no backend. All data stays in your browser (IndexedDB), or — with the disk-folder mode — in real files on your machine.

## Features

- **Library** — folders, tags, search, live thumbnails, JSON backup export/import
- **Disk mode** — connect a real folder (Chrome/Edge); edits save straight to the actual files
- **Editor** — Interact mode (page runs live, sandboxed) and Edit mode (click any element to restyle, drag to move, duplicate, delete; attribute + spacing editors; multi-element edits via scope picker)
- **Code panel** — side-by-side source with two-way element↔line mapping, resizable
- **🎨 Colors** — see every color and font in a file and swap them everywhere at once, with hover preview
- **🤖 AI round-trip** — copy the file + a prompt scaffold to any AI chat, paste the reply back, review a visual diff, accept or reject
- **Safety** — undo/redo, version snapshot on every save, autosave crash recovery

## Run it

Open `Hypershelf.html` in a browser. That's it.

Note: your shelf is stored per browser + per origin — the deployed site and a local copy each have their own library. Use *Export library backup* to move files between them.

## Development

Source lives in [`src/`](src/) as plain ES modules; `Hypershelf.html` is the **build output** (don't edit it directly).

```
npm run dev     # serve the repo, open /src/index.html (no build needed)
npm run build   # bundle src/ → Hypershelf.html (esbuild via npx, no install)
```

The build inlines everything into the single file and runs integrity checks. See [`CLAUDE.md`](CLAUDE.md) for the full architecture handoff (editor internals, data model, invariants) before making changes.
