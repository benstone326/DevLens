# DevLens Design Tokens
> Auto-extracted from Figma file `c2qwPI44oCmlGzB5PLG4dl` node `7:134` (Elements canvas)

---

## Panel Structure

| Element | Value |
|---|---|
| Panel width | 360px |
| Panel radius | `16px 0 0 16px` (left side rounded only) |
| Panel background | `#ffffff` |
| Navigation width | 52px |
| Content width | 307px (360 - 52 - 1px border) |

---

## Navigation Bar

| Property | Value |
|---|---|
| Width | 52px |
| Padding (top/bottom) | 12px |
| Padding (left/right) | 0 (centered) |
| Gap between items | 4px |
| Background | `#ffffff` |
| Right border | `1px solid #bbbbbb` |
| Layout | Vertical, centered |

### Logo badge
| Property | Value |
|---|---|
| Size | 36×36px |
| Background | `#000000` |
| Radius | 12px |
| Icon size | 18×18px, white |

### Separator
| Property | Value |
|---|---|
| Width | 24px |
| Height | 1px |
| Color | `#bbbbbb` |
| Vertical padding | 4px top/bottom |

---

## Tool Icons (36×36px, radius 12px)

Each tool has a unique accent color. Inactive icons use `#aaaaaa` for the icon, active shows the accent color.

| Tool | Accent color | Active bg |
|---|---|---|
| Inspector | `#6366f1` | `rgba(99,102,241,0.1)` |
| Color Picker | `#f43f5e` | `rgba(244,63,94,0.1)` |
| Tokens | `#10b981` | `rgba(16,185,129,0.1)` |
| Responsive | `#f59e0b` | `rgba(245,158,11,0.1)` |
| Screenshot | `#3b82f6` | `rgba(59,130,246,0.1)` |
| Assets | `#8b5cf6` | `rgba(139,92,246,0.1)` |
| Debug | `#ec4899` | `rgba(236,72,153,0.1)` |
| Snap/Drag/Magnet | `#aaaaaa` (utility) | — |

### Active indicator
- Rectangle `2×16px` on the **left edge** of the icon button
- Color matches the tool's accent color
- Radius: `0 999px 999px 0` (pill on right side only, flush left)
- **Inactive**: same color but hidden / `#aaaaaa` for tools without active state

### Icon states
| State | Icon color | Background |
|---|---|---|
| Inactive | `#aaaaaa` | transparent |
| Active | accent color | `rgba(accent, 0.1)` |

---

## Spacing scale (observed)
| Token | Value | Usage |
|---|---|---|
| `gap-1` | 4px | Between nav icons |
| `gap-2` | 8px | Between panel sections |
| `p-nav` | 12px | Nav top/bottom padding |
| `p-panel` | 8px | Panel section padding |
| `radius-btn` | 12px | Icon buttons, cards |
| `radius-panel` | 16px | Panel outer corners |

---

## Notes
- **Neon placeholder fills** (`#00ff00`, `#0000ff`, `#ffff00`, `#ff00ff`) appear in Frame 5–10 inside the Panel content area — these are Figma layout placeholders, not real colors. The actual panel content UI (Inspector styles tab, breadcrumb, etc.) is not yet designed in Figma at this node.
- The Figma file only contains the **navigation sidebar + tool icon system** as finalized design. Panel content is being built in code.
- Font: **Inter** throughout.
