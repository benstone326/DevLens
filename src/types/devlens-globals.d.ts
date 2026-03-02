export {}

declare global {
  interface Window {
    __devlens_loaded?: boolean
    __devlens_inspector_enabled?: boolean
    __devlens_iframe?: HTMLIFrameElement | null
    __devlens_last_hovered?: Element | null
    __devlens_locked_el?: Element | null
    __devlens_original_styles?: string | null
  }
}
