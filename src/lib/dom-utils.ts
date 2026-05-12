/**
 * Shared utility functions that interact with the DOM or Browser APIs.
 */

/**
 * Gets the current device pixel ratio, falling back to 1 if not available.
 * Useful for canvas scaling.
 */
export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return window.devicePixelRatio || 1
}
