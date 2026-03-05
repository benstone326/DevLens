# DevLens — Chrome Extension

> **Reverse-engineer any website in seconds.**

DevLens is a Chrome DevTools alternative built for designers and design-engineers. Inspect computed styles, extract design tokens, detect Tailwind classes, check accessibility, and live-edit CSS — all in a clean dark panel.

---

## Quick Start

```bash
npm install
npm run build     # one-time build
npm run dev       # watch mode
```

Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

**Shortcuts**

| Shortcut | Action |
|---|---|
| `Alt+Shift+D` | Toggle DevLens panel |
| `Alt+Shift+I` | Open Inspector |
| `Alt+Shift+C` | Open Color Eyedropper |

---

## Positioning

**Core loop:** Inspect → Extract → Convert → Ask AI → Implement

DevLens is a **UI reverse-engineering accelerator**, not just an inspector. The goal is to bridge the gap between "I see this on a website" and "I can build this."

---

## Roadmap

| Phase | Features | Status |
|---|---|---|
| 1 | Foundation, popup, panel, messaging, shortcuts | ✅ Done |
| 2 | Inspector + Color Eyedropper + Token Extractor | ✅ Done |
| 2b | Inspector redesign: Relations nav, TW bar, Checkbox toggle, A11y, Collapsible groups | ✅ Done |
| 3 | AI Bridge — one-click "explain/convert/fix" via Claude/ChatGPT | ⏳ Next |
| 4 | Copy as Tailwind (per-element CSS→TW conversion) | ⏳ Planned |
| 5 | Font Download (Google Fonts link / self-hosted download) | ⏳ Planned |
| 6 | Assets + SVG optimization | ⏳ Planned |
| 7 | Responsive Viewer | ⏳ Planned |
| 8 | Screenshot | ⏳ Planned |
| 9 | Full A11y Auditor (axe-core, full page scan) | ⏳ Planned |

---

## Inspector — Phase 2b Features

### Relations Navigation (replaces breadcrumb)
A 2×2 grid of pill buttons: **Parent**, **Child**, **Sibling ↑**, **Sibling ↓**.
- Click to navigate and lock to that element
- Pills show `tag#id` or `tag.class` label
- Greyed out when relation doesn't exist or element is not locked
- Current element chip above the grid is the lock toggle

### Tailwind Classes Bar
Three states based on page detection + element classes:
- **Hidden** — site doesn't use Tailwind at all
- **"No classes detected"** — site uses Tailwind but this element has no TW classes
- **Shows classes + copy button** — element has TW classes

Detection strategy (cached per page load):
1. `window.__tailwind` global (Vite/CRA)
2. Stylesheet href contains `tailwind`
3. Sample 50 elements — if any have 3+ TW-pattern classes → Tailwind detected

### Checkbox Property Toggle (Chrome DevTools style)
Each CSS row has a 10×10 checkbox. Unchecking:
- Sends `APPLY_STYLE` with empty value (disables on page)
- Renders property name + value with `line-through`
- Reduces row opacity to 0.45
Re-checking restores the value.

### Red × Reset Button
Appears on rows where value has been inline-edited. Resets to original value.
Replaces copy button on changed rows (copy button returns when reset).

### Collapsible CSS Groups
All groups (Layout, Spacing, Typography, Visual, Other) have chevron toggles.
Variables block is also collapsible.
A11Y and Element Style sections are always visible (no toggle needed).

### A11Y Inline Section
Always-open block at the bottom of the Styles tab. Three rows:
- **Contrast** — computed ratio + AA (4.5:1) / AAA (7:1) pass/fail badges
- **aria-label** — value if present, amber "Missing" badge if absent
- **role** — implicit ARIA role inferred from tag name

Contrast is computed via canvas `getImageData` on `fontColor` vs `backgroundColor`.
No external library needed.

---

## AI Bridge — Phase 3 Spec

Button in Inspector that packages element context (CSS, HTML, box model, variables) into a structured prompt.

**Delivery mode (ships first):** Link-out to Claude.ai or ChatGPT — zero setup.

**Preset intents:**
- Explain layout
- Why is this breaking on mobile?
- Convert to Tailwind
- Improve accessibility

**Context depth toggle:** element only / element + ancestors / full chain

---

## Data Model

`InspectorElementData` (in `src/tools/inspector/index.ts`):

```ts
{
  tagName, id, classes,
  computedStyles,          // matched CSS rules (not full computed styles)
  cssVars,                 // resolved var(--x) values
  ancestors, children,     // BreadcrumbNode[] for relations nav
  boxModel,                // margin/border/padding/content rect
  fonts,                   // family, size, weight, lineHeight, color
  outerHTML,               // capped at 5000 chars
  twClasses,               // Tailwind classes on this element
  hasTailwind,             // whether the page uses Tailwind (cached)
}
```

---

## Architecture

```
[Popup UI]  ──sendMessage──▶  [Background SW]  ──sendMessage──▶  [Content Script]
                                                                        │
                                                              mounts iframe with ▼
                                                                  [Panel UI]
                                                            (React app in iframe)
```

**Message types (content ↔ panel):**
- `NAVIGATE_TO` — direction: `ancestor | child | sibling`, with `steps`, `childIndex`, or `delta`
- `LOCK_ELEMENT` / `UNLOCK_ELEMENT`
- `APPLY_STYLE` — prop + value (empty string disables)
- `APPLY_OUTERHTML`
- `SET_BOX_MODE`
- `INSPECTOR_DATA` / `INSPECTOR_LOCKED` / `INSPECTOR_UNLOCKED`

---

## Project Structure

```
devlens/
├── src/
│   ├── background/index.ts        # Service worker
│   ├── content/index.ts           # Injected into pages — panel mount + message handling
│   ├── popup/                     # Extension popup
│   ├── panel/                     # Side panel shell (tab router)
│   ├── tools/
│   │   ├── inspector/
│   │   │   ├── index.ts           # extractElementData, Tailwind detection, navigation
│   │   │   └── InspectorPanel.tsx # Full inspector UI
│   │   ├── eyedropper/
│   │   └── tokens/
│   └── shared/
│       ├── theme.ts               # Color tokens (S.surface, S.border, etc.)
│       ├── messaging.ts           # postToParent / postToPanel helpers
│       ├── clipboard.ts
│       └── hooks.ts               # useHover
├── eslint.config.js
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Code Quality

ESLint 9 flat config with TypeScript strict mode. Run:

```bash
npm run lint       # check
npm run lint:fix   # auto-fix
```

Zero errors, zero warnings policy enforced.
