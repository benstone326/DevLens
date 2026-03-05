# DevLens — Chrome Extension

> **Reverse-engineer any website in seconds.**

DevLens is a Chrome DevTools alternative built for designers and design-engineers. Inspect computed styles, extract design tokens, detect Tailwind classes, check accessibility, and live-edit CSS — all in a clean panel.

---

## Quick Start

```bash
npm install
npm run build     # one-time build
npm run dev       # watch mode (rebuilds on file changes)
```

Load in Chrome: `chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist/`

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+D` | Toggle DevLens panel |
| `Alt+Shift+I` | Open Inspector |
| `Alt+Shift+C` | Open Color Eyedropper |

---

## Scripts

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
│   ├── content/index.ts           # Injected into pages — panel mount + hardened message bridge
│   ├── popup/                     # Extension popup
│   ├── panel/Panel.tsx            # Side panel shell — nav sidebar + tool router
│   ├── tools/
│   │   ├── inspector/
│   │   │   ├── index.ts           # extractElementData, Tailwind detection, sibling extraction
│   │   │   └── InspectorPanel.tsx # Full inspector UI
│   │   ├── eyedropper/
│   │   └── tokens/
│   └── shared/
│       ├── theme.ts
│       ├── messaging.ts
│       ├── clipboard.ts
│       └── hooks.ts
├── .gitignore                     # Excludes node_modules/, dist/
├── vite.config.ts
└── package.json
```

---

## Message Types (content ↔ panel)

| Type | Direction | Description |
|---|---|---|
| `NAVIGATE_TO` | panel → content | direction: `ancestor \| child \| sibling`, delta/steps/childIndex |
| `LOCK_ELEMENT` / `UNLOCK_ELEMENT` | panel → content | Lock current hovered element |
| `APPLY_STYLE` | panel → content | prop + value (empty string disables) |
| `APPLY_OUTERHTML` | panel → content | Replace element's outer HTML |
| `SET_BOX_MODE` | panel → content | Toggle box model overlay |
| `INSPECTOR_DATA` | content → panel | Full `InspectorElementData` payload |
| `INSPECTOR_LOCKED` / `INSPECTOR_UNLOCKED` | content → panel | Lock state change |
