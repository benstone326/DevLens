# DevLens — Chrome Extension

> **Reverse-engineer any website in seconds.**

DevLens is a Chrome DevTools alternative built for designers and design-engineers. Inspect computed styles, extract design tokens, detect Tailwind classes, check accessibility, and live-edit CSS — all in a clean panel.

---

## Installation

### Download (recommended)

1. Go to [github.com/benstone326/DevLens/releases](https://github.com/benstone326/DevLens/releases) and download the latest release zip
2. Unzip it
3. In Chrome, go to `chrome://extensions` → enable **Developer mode** → click **Load unpacked** → select the unzipped folder

### Build from source

```bash
npm install
npm run build
```

Then load `dist/` as an unpacked extension as above.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+D` | Toggle DevLens panel |
| `Alt+Shift+I` | Open Inspector |
| `Alt+Shift+C` | Open Color Eyedropper |

---

## Dev Scripts

| Script | Description |
|---|---|
| `npm run dev` | Watch mode — rebuilds on save |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint on `src/` |
| `npm run lint:fix` | ESLint with auto-fix |

> **Note:** ESLint requires `eslint` + `@typescript-eslint/*` to be installed (`npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin`). TypeScript is already a dev dependency via `vite`.

---

## Positioning

**Core loop:** Inspect → Extract → Convert → Ask AI → Implement

---

## Roadmap

| Phase | Features | Status |
|---|---|---|
| 1 | Foundation, popup, panel, messaging, shortcuts | ✅ Done |
| 2 | Inspector + Color Eyedropper + Token Extractor | ✅ Done |
| 2b | Inspector redesign: Relations nav, TW bar, Checkbox toggle, A11y, Collapsible groups | ✅ Done |
| 2c | Per-property CSS line editor: autocomplete, color swatches, arrow-key nav, inline disable/restore | ✅ Done |
| 3 | AI Bridge — one-click "explain/convert/fix" via Claude/ChatGPT | ⏳ Next |
| 4 | Copy as Tailwind (per-element CSS→TW conversion) | ⏳ Planned |
| 5 | Font Download | ⏳ Planned |
| 6 | Assets + SVG optimization | ⏳ Planned |
| 7 | Responsive Viewer | ⏳ Planned |
| 8 | Screenshot | ⏳ Planned |
| 9 | Full A11y Auditor | ⏳ Planned |

---

## Architecture

```
[Popup UI]  ──sendMessage──▶  [Background SW]  ──sendMessage──▶  [Content Script]
                                                                        │
                                                              mounts iframe with ▼
                                                                  [Panel UI]
                                                            (React app in iframe)
```

**Message security:** The content script validates both `event.source === iframe.contentWindow` and `event.data.source === 'devlens-panel'` before processing any message, preventing page-script spoofing.

---

## Project Structure

```
devlens/
├── src/
│   ├── background/index.ts        # Service worker
│   ├── content/
│   │   ├── index.ts               # Injected into pages — panel mount, drag system, hardened message bridge
│   │   └── content.css            # Injected styles
│   ├── popup/
│   │   ├── Popup.tsx
│   │   ├── index.tsx
│   │   └── popup.css
│   ├── panel/
│   │   ├── Panel.tsx              # Side panel shell — nav sidebar + tool router + drag/float
│   │   ├── index.tsx
│   │   └── panel.css
│   ├── tools/
│   │   ├── inspector/
│   │   │   ├── index.ts           # extractElementData, getMatchedRules, Tailwind detection, sibling/ancestor extraction
│   │   │   └── InspectorPanel.tsx # Full inspector UI — styles, box model, relations, a11y, custom CSS editor
│   │   ├── eyedropper/
│   │   │   └── EyedropperPanel.tsx
│   │   └── tokens/
│   │       ├── index.ts           # Token extraction logic
│   │       ├── TokensPanel.tsx
│   │       └── exporters.ts
│   └── shared/
│       ├── theme.ts               # Design tokens (S)
│       ├── messaging.ts           # postToParent helper
│       ├── clipboard.ts
│       └── hooks.ts               # useHover
├── vite.config.ts
└── package.json
```

---

## Message Types (content ↔ panel)

| Type | Direction | Description |
|---|---|---|
| `PANEL_READY` | content → panel | Panel iframe has loaded and is ready to receive messages |
| `ACTIVATE_TOOL` | content → panel | Instruct panel to switch to a specific tool |
| `PANEL_FLOATING` | content → panel | Notify panel of floating/docked state change |
| `INSPECTOR_DATA` | content → panel | Full `InspectorElementData` payload for locked element |
| `INSPECTOR_LOCKED` / `INSPECTOR_UNLOCKED` | content → panel | Lock state change |
| `TOKENS_DATA` | content → panel | Extracted design token payload |
| `START_INSPECTOR` / `STOP_INSPECTOR` | panel → content | Start or stop the inspector overlay |
| `NAVIGATE_TO` | panel → content | `direction: ancestor \| child \| sibling`, with `delta` / `steps` / `childIndex` |
| `LOCK_ELEMENT` / `UNLOCK_ELEMENT` | panel → content | Lock the currently hovered element |
| `APPLY_STYLE` | panel → content | `prop` + `value` — empty string disables, `restore: true` removes suppression rule, `reapply: true` re-injects inline value |
| `REMOVE_STYLE` | panel → content | Remove a single property from inline style and disable-sheet |
| `RESET_STYLES` | panel → content | Restore element to its original style attribute |
| `APPLY_OUTERHTML` | panel → content | Replace element's outer HTML |
| `SET_BOX_MODE` | panel → content | Toggle box model overlay |
| `EXTRACT_TOKENS` | panel → content | Trigger full-page token extraction |
| `DRAG_START` / `DRAG_END` | panel → content | Panel drag — transitions to floating mode on first drag |
| `SNAP_BACK` | panel → content | Return panel from floating to docked position |
| `CLOSE_PANEL` | panel → content | Close and hide the panel |
| `OPEN_URL` | panel → content | Open a URL in a new tab |
