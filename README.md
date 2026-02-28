# DevLens

A professional browser extension for web designers and developers. Inspect, edit, and extract from any webpage — without leaving your browser.

-----

## Tools

### 🔍 Inspector

Hover over any element to inspect it in real time. Click to lock it for editing.

- **CSS properties** grouped by category (Layout, Spacing, Typography, Visual) with collapsible sections and property counts
- **Live CSS editing** — click any value to edit it and see changes apply instantly on the page
- **Custom CSS** — type freeform `property: value` pairs and apply them with ⌘↵
- **Filter bar** — search across all properties and values instantly
- **Per-row copy** — copy any single declaration with one click
- **Copy as Tailwind** — convert any element’s CSS to Tailwind utility classes instantly
- **Box model tab** — flat grid view of margin, border, and padding with top/right/bottom/left breakdown
- **Fonts tab** — family, size, weight, line-height, color with live preview and Google Fonts link
- **HTML tab** — syntax-highlighted `outerHTML` editor with live editing and scroll-synced highlighting
- **Breadcrumb navigation** — traverse ancestor and child elements, click the element chip to lock/unlock
- **CSS variable resolution** — all `var(--x)` references shown with their computed values

### 🎨 Color Eyedropper

Pick colors from anywhere on the page and build a persistent palette.

- Sample any pixel on screen
- Color output in HEX, RGB, and HSL
- Saved color history persists across sessions
- One-click copy in any format

### 🪙 Token Extractor

Extract design tokens from any website’s stylesheet automatically.

- Extracts colors, typography, spacing, shadows, border radii, and breakpoints
- Export as CSS variables, JSON, Tailwind config, SCSS variables, or Style Dictionary
- Detect CSS custom properties (`--vars`) and their resolved values

### 🤖 AI Bridge *(planned — Phase 3)*

Send any inspected element directly to an AI with full context pre-loaded. No copy-pasting.

- One-click sends CSS, HTML, box model, and CSS variables as a structured prompt
- Preset intents: “Explain this layout”, “Why is this breaking on mobile?”, “Convert to Tailwind”, “Improve accessibility”, or write a custom question
- Option A: opens Claude.ai or ChatGPT with the prompt pre-filled (zero setup)
- Option B: in-panel AI response via your own API key (no cost to DevLens)
- Context depth control — send just the element, or include its full ancestor chain
- Right-click context menu shortcut — inspect and ask in one gesture

### 📦 Assets *(planned — Phase 4)*

Extract all images, SVGs, fonts, and other assets from a page with one click.

- Download any asset directly from the panel
- SVG optimization built in — every downloaded SVG is minified via SVGO before saving, production-ready immediately
- Font detection with direct download links

### 📐 Responsive Viewer *(planned — Phase 5)*

Preview any page at multiple viewport sizes simultaneously.

- Sync-scroll — scrolling one viewport scrolls all others in lockstep
- Custom breakpoint presets

### 📸 Screenshot *(planned — Phase 6)*

Capture full-page or element-level screenshots with annotation tools.

### 🐛 Debug *(planned — Phase 7)*

Inspect console output, network requests, and JavaScript errors from the panel.

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
│       ├── inspector/     # Element inspector + CSS editor
│       ├── eyedropper/    # Color picker
│       ├── tokens/        # Design token extractor
│       ├── ai-bridge/     # AI context tool (planned)
│       ├── assets/        # Asset extractor + SVG optimizer (planned)
│       ├── responsive/    # Viewport previewer (planned)
│       ├── screenshot/    # Screenshot tool (planned)
│       └── debug/         # Debug console (planned)
├── panel.html
├── popup.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

-----

## Roadmap

|Phase|Tool                                                 |Status       |
|-----|-----------------------------------------------------|-------------|
|1    |Foundation — popup, panel, shortcuts, messaging      |✅ Done       |
|2    |Inspector + Color Eyedropper + Token Extractor       |✅ Done       |
|2b   |Inspector UI redesign (Figma) + Copy as Tailwind     |🔄 In progress|
|3    |AI Bridge — send element context to AI with one click|⏳ Planned    |
|4    |Assets Extractor + SVG optimization (SVGO)           |⏳ Planned    |
|5    |Responsive Viewer + sync-scroll                      |⏳ Planned    |
|6    |Screenshot + Editor                                  |⏳ Planned    |
|7    |Debug Tools                                          |⏳ Planned    |

### Phase 2b — Inspector redesign: In progress

- Implementing Figma design across both `master` and `design/ux-improvements` branches
- New navigation sidebar with per-tool accent colors and active indicator strip
- Code blocks component system replacing current dark panel
- Collapsible CSS groups with checkboxes, color swatches, CSS var highlighting
- Filter bar, copy-as-Tailwind button

### Phase 3 — AI Bridge: Requirements

**What it needs**

- Prompt formatter that structures CSS, HTML, box model, variables, and breadcrumb ancestors into a clean, readable prompt
- Intent selector — preset questions or free text input
- AI target selector — Claude.ai first, ChatGPT later
- Two delivery modes: link-out (Option A, zero setup) and in-panel via API key (Option B)
- Right-click context menu on the element highlight overlay

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
1. Intent selector UI
1. Option A — link-out to Claude.ai
1. Option B — in-panel response via user API key
1. Right-click context menu integration

**Decisions needed before build starts**

- Option A or B first?
- Where does the button live — Inspector header, dedicated AI tab, or both?
- Preset intents only, or free text too?
- How deep should the context go — element only, or full ancestor chain?

### Phase 4 — Assets + SVG Optimization

**SVG optimization approach**

- Bundle a browser-compatible build of SVGO (or reimplement its core passes)
- Every SVG downloaded through DevLens is minified before saving
- Removes editor metadata, empty groups, redundant attributes
- Estimated scope: 2–3 weeks

-----

## Stack

- **React** + **TypeScript**
- **Tailwind CSS**
- **Vite**
- **Lucide Icons**
- **Chrome Extensions Manifest V3**