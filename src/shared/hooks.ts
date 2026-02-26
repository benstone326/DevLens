import { useState, useCallback } from 'react'

/**
 * useHover — returns [isHovered, hoverProps]
 * Replaces inline onMouseEnter/Leave style mutations throughout the codebase.
 * Components use the boolean to derive styles declaratively instead of
 * imperatively mutating element.style inside event handlers.
 */
export function useHover() {
  const [isHovered, setIsHovered] = useState(false)
  const hoverProps = {
    onMouseEnter: useCallback(() => setIsHovered(true),  []),
    onMouseLeave: useCallback(() => setIsHovered(false), []),
  }
  return [isHovered, hoverProps] as const
}
