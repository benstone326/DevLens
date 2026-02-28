# DevLens

Reverse-engineer any website in seconds. Inspect, extract, convert, and understand any UI directly in the browser — without switching tools.

DevLens is a front-end reverse engineering toolkit layered on top of Chrome DevTools.

**Core loop:** Inspect → Extract → Convert → Ask AI → Implement

-----

## Tools

### 🔍 Inspector

Hover over any element to inspect it in real time. Click to lock it for editing.

- **CSS properties** grouped by category (Layout, Spacing, Typography, Visual) with collapsible sections
- **Live CSS editing** — edit any value, changes apply instantly on the page
- **Copy as Tailwind** — convert any element’s CSS to Tailwind utility classes instantly
- **Custom CSS** — type freeform `property: value` pairs and apply them with ⌘↵
- **Filter bar** — search across all properties and values instantly
- **Per-row copy** — copy any single declaration with one click
- **Box model tab** — flat grid view of margin, border, padding with full side breakdown
- **Fonts tab** — family, size, weight, line-height, color with Google Fonts link
- **HTML tab** — syntax-highlighted `outerHTML` editor with live editing
- **Breadcrumb navigation** — traverse ancestors and children, click to lock/unlock
- **CSS variable resolution** — all `var(--x)` references resolved and shown inline

### 🪙 Token Extractor

Extract the design system behind any website.

- Extracts colors, typography, spacing, shadows, border radii, breakpoints, and CSS variables
- Reveals the full design token structure of any site
- Export as CSS variables, JSON, Tailwind config, SCSS variables, or Style Dictionary

### 🎨 Color Eyedropper

Pick colors from anywhere on the page and build a persistent palette.

- Sample any pixel on screen
- Output in HEX, RGB, and HSL
- Saved color history persists across sessions
- One-click copy in any format

### 🤖 AI Bridge *(planned — Phase 3)*

Send any inspected element to an AI with full context pre-loaded. No copy-pasting.

- One click sends CSS, HTML, box model, and CSS variables as a structured prompt
- Preset intents: “Explain this layout”, “Why is this breaking on mobile?”, “Convert to Tailwind”, “Improve accessibility”, or write a custom question
- Option A: opens Claude.ai or ChatGPT with the prompt pre-filled — zero setup required
- Option B: in-panel AI response via your own API key
- Context depth toggle — element only, element + ancestors, or full chain
- Right-click context menu shortcut — inspect and ask in one gesture

### 📦 Assets *(planned — Phase 4)*

Extract all images, SVGs, and fonts from a page with one click.

- Download any asset directly from the panel
- SVG optimization built in — every downloaded SVG is minified via SVGO, production-ready immediately

### 📐 Responsive Viewer *(planned — Phase 5)*

Preview any page at multiple viewport sizes simultaneously.

- Sync-scroll — scrolling one viewport scrolls all others in lockstep

### 📸 Screenshot *(planned — Phase 6)*

Capture full-page or element-level screenshots.

### 🐛 Debug *(planned — Phase 7, under evaluation)*

Console output, network requests, and JavaScript errors in the panel.

> Note: Debug and Screenshot tools will be re-evaluated after AI Bridge ships and user feedback is gathered. Focus > feature count.

-----

## Install

### From a release

1. Download `devlens-design-latest.zip` from the [Releases](../../releases) page
1. Unzip the file
1. Go to `chrome://extensions`
1. Enable **Developer mode** (top-right toggle)
1. Click **Load unpacked** and select the unzipped folder

### From source

```bash
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension.

-----

## Keyboard Shortcuts

|Shortcut     |Action               |
|-------------|---------------------|
|`Alt+Shift+D`|Toggle DevLens panel |
|`Alt+Shift+I`|Open Inspector       |
|`Alt+Shift+C`|Open Color Eyedropper|

-----

## Usage

- Click the DevLens icon in your toolbar, or press `Alt+Shift+D`
- The panel slides in from the right edge of your browser
- Drag the handle to float the panel anywhere on screen
- Press `Snap` to return it to the side
- Switch tools using the sidebar icons

-----

## Architecture

```
[Popup UI]  ──sendMessage──▶  [Background SW]  ──sendMessage──▶  [Content Script]
                                                                        │
                                                              mounts iframe with ▼
                                                                  [Panel UI]
                                                            (React app in iframe)
```

- **Popup** — toolbar icon UI, quick tool launcher
- **Background** — service worker, routes messages between contexts
- **Content script** — injected into every page, mounts the floating panel iframe
- **Panel** — full React app running inside the iframe, hosts all tools

-----

## Project Structure

```
devlens/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Page injection + panel mount
│   ├── panel/             # Root panel shell + navigation
│   ├── popup/             # Toolbar popup
│   ├── shared/            # Theme, messaging, hooks, clipboard
│   └── tools/
│       ├── inspector/     # Element inspector + CSS editor + Tailwind converter
│       ├── eyedropper/    # Color picker
│       ├── tokens/        # Design token extractor
│       ├── ai-bridge/     # AI context tool (planned)
│       ├── assets/        # Asset extractor + SVG optimizer (planned)
│       ├── responsive/    # Viewport previewer (planned)
│       ├── screenshot/    # Screenshot tool (planned)
│       └── debug/         # Debug console (under evaluation)
├── panel.html
├── popup.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

-----

## Roadmap

|Priority|Phase|Tool                                                         |Status            |
|--------|-----|-------------------------------------------------------------|------------------|
|1       |1    |Foundation — popup, panel, shortcuts, messaging              |✅ Done            |
|2       |2    |Inspector + Color Eyedropper + Token Extractor               |✅ Done            |
|3       |2b   |Inspector UI redesign (Figma) + Copy as Tailwind             |🔄 In progress     |
|4       |3    |AI Bridge                                                    |⏳ Planned         |
|5       |—    |Token Extractor expansion — Figma Variables, Style Dictionary|⏳ Planned         |
|6       |4    |Assets Extractor + SVG optimization (SVGO)                   |⏳ Planned         |
|7       |—    |Pause. Gather user feedback. Re-evaluate.                    |                  |
|8       |5    |Responsive Viewer + sync-scroll                              |⏳ Planned         |
|9       |6    |Screenshot + Editor                                          |⏳ Planned         |
|10      |7    |Debug Tools                                                  |⏳ Under evaluation|

### Phase 2b — Inspector redesign (in progress)

- Implementing Figma design across both `master` and `design/ux-improvements` branches
- New navigation sidebar with per-tool accent colors and active indicator strip
- Code blocks component system — collapsible groups, checkboxes, color swatches, CSS var highlighting
- Filter bar, Copy as Tailwind button

### Phase 3 — AI Bridge (full spec)

**Prompt format**

```
I'm inspecting an element on a webpage. Here is its context:

ELEMENT: <a class="btn btn-primary" href="/checkout">

CSS (matched rules):
  display: flex
  align-items: center
  padding: 12px 24px
  background: linear-gradient(...)

BOX MODEL:
  margin: 0 0 16px 0
  padding: 12px 24px
  width: 280px, height: 44px

CSS VARIABLES IN USE:
  --primary: #6366f1
  --radius: 8px

QUESTION: Why is this element not vertically centered in its parent?
```

**Build order**

1. Prompt formatter function
1. Intent selector UI (presets + free text)
1. Option A — link-out to Claude.ai
1. Option B — in-panel response via user API key
1. Right-click context menu integration

**Decisions needed before build starts**

- Option A or B first?
- Button location — Inspector header, dedicated AI tab, or both?
- Context depth — element only, or full ancestor chain, or user-controlled toggle?

-----

## Stack

- **React** + **TypeScript**
- **Tailwind CSS**
- **Vite**
- **Lucide Icons**
- **Chrome Extensions Manifest V3**
- **GitHub Actions** — auto-release on push to `design/ux-improvements`