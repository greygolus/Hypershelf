# Hypershelf

**Google Drive + Google Docs, but for self-contained HTML files.**

Hypershelf is a library, viewer, and editor for single-file HTML documents—the kind you use instead of text editors and slide decks when you want full control and easy AI integration.

The entire app is **one self-contained HTML file**: [`Hypershelf.html`](Hypershelf.html). No framework, external dependencies, or backend are required at runtime. Your library stays in the browser with IndexedDB, or in real files on your machine when disk-folder mode is enabled.

## Features

- **Archive Index library** — a compact file and folder index with search, filters, tags, browser-storage usage, live thumbnails, and a full-height preview panel
- **Workbench editor** — focused Design, Interact, and Code modes with a contextual toolbar, save and draft status, responsive viewport controls, and Content, Style, Layout, and Advanced inspectors
- **Slides** — create and present opt-in HTML slide decks, choose layouts, edit numbering and footer settings, and drag thumbnails to reorder the deck
- **Code workspace** — edit source beside the live page with two-way element-to-line mapping and a resizable panel
- **Theme tools** — inspect every color and font in a document, preview changes, and replace values throughout the file
- **AI round-trip** — copy the current file with a prompt scaffold to an AI assistant, paste the result back, review a visual diff, then accept or reject it
- **Disk mode** — connect a real folder in Chrome or Edge so edits save directly to the original files
- **Consistent chrome** — custom themed scrollbars across the app and supported document previews
- **Safety** — undo and redo, a version snapshot on every save, and autosave crash recovery
- **Portability** — import or export the complete browser library as a JSON backup

## Run it

Open `Hypershelf.html` in a browser. That's it.

Your shelf is stored per browser and per origin, so the deployed app and a local copy each have their own library. Use **Export library backup** to move files between them.

## Development

Source lives in [`src/`](src/) as plain ES modules; `Hypershelf.html` is the generated build output and should not be edited directly.

```sh
npm run dev     # serve the repo; open /src/index.html
npm run build   # bundle src/ into Hypershelf.html
```

The build inlines the application into a single file and runs integrity checks. See [`CLAUDE.md`](CLAUDE.md) for the architecture handoff, including editor internals, the data model, and invariants.
