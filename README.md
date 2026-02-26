# DevLens — Chrome Extension

Your personal all-in-one web developer browser extension, inspired by Hoverify.

## Phase 1 Complete ✅
Foundation is built: popup, floating panel, background worker, content script, keyboard shortcuts, and messaging system.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Build the extension
```bash
npm run build     # one-time build
npm run dev       # watch mode (rebuilds on file changes)
```

### 3. Load in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### 4. Use it
- Click the DevLens icon in your toolbar
- Or press `Alt+Shift+D` to toggle the panel
- Or press `Alt+Shift+I` to open Inspector
- Or press `Alt+Shift+C` to open Color Eyedropper

---

## Project Structure

```
devlens/
├── public/
│   └── manifest.json          # Chrome Extension config
├── src/
│   ├── background/
│   │   └── index.ts           # Service worker (post office)
│   ├── content/
│   │   ├── index.ts           # Injected into every page, mounts panel
│   │   └── content.css        # Scoped styles for injected container
│   ├── popup/
│   │   ├── index.tsx          # Popup entry point
│   │   ├── Popup.tsx          # Main popup UI
│   │   └── popup.css          # Popup styles
│   ├── panel/
│   │   ├── index.tsx          # Panel entry point
│   │   ├── Panel.tsx          # Floating side panel UI
│   │   └── panel.css          # Panel styles
│   ├── tools/
│   │   ├── inspector/         # Phase 2
│   │   ├── eyedropper/        # Phase 2
│   │   ├── assets/            # Phase 3
│   │   ├── responsive/        # Phase 4
│   │   ├── screenshot/        # Phase 5
│   │   └── debug/             # Phase 6
│   └── shared/
│       ├── store.ts           # Zustand global state
│       └── messages.ts        # Message type definitions
├── popup.html                 # Popup HTML entry
├── panel.html                 # Panel HTML entry
├── vite.config.ts             # Build config
├── tailwind.config.js         # Tailwind config
└── package.json
```

---

## Architecture: How the parts talk

```
[Popup UI]  ──sendMessage──▶  [Background SW]  ──sendMessage──▶  [Content Script]
                                                                        │
                                                              mounts iframe with ▼
                                                                  [Panel UI]
                                                            (React app in iframe)
```

- **Popup**: What you see when clicking the extension icon
- **Background**: Service worker — routes messages, handles Chrome APIs
- **Content Script**: Injected into every page — mounts the panel iframe
- **Panel**: Full React app running inside the iframe on your page

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+D` | Toggle DevLens panel |
| `Alt+Shift+I` | Open Inspector |
| `Alt+Shift+C` | Open Color Eyedropper |

---

## Roadmap

| Phase | Features | Status |
|---|---|---|
| 1 | Foundation, popup, panel, shortcuts | ✅ Done |
| 2 | Inspector + Color Eyedropper | 🔜 Next |
| 3 | Assets Extractor | ⏳ Planned |
| 4 | Responsive Viewer | ⏳ Planned |
| 5 | Screenshot + Editor | ⏳ Planned |
| 6 | Debug Tools | ⏳ Planned |

---

## Icons
You'll need to add placeholder icons at:
- `public/icons/icon16.png`
- `public/icons/icon48.png`  
- `public/icons/icon128.png`

You can use any 🔵 colored square PNG for now. A proper icon will be added later.
