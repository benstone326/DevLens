import { useState, useCallback } from 'react'

// Replaces inline onMouseEnter/Leave style mutations.
// Returns [isHovered, hoverProps] — spread hoverProps onto any element.
export function useHover() {
  const [isHovered, setIsHovered] = useState(false)
  const hoverProps = {
    onMouseEnter: useCallback(() => setIsHovered(true),  []),
    onMouseLeave: useCallback(() => setIsHovered(false), []),
  }
  return [isHovered, hoverProps] as const
}
