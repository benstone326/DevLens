// Shared system color tokens — follow OS/browser light or dark mode automatically.
// Import this instead of redefining S in every component.
export const S = {
  bg:      'Canvas',
  bgDeep:  'ButtonFace',
  surface: 'Field',
  border:  'color-mix(in srgb, ButtonBorder 35%, Canvas)',
  text:    'CanvasText',
  sub:     'GrayText',
} as const
