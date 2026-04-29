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

/**
 * Dispatches a custom event to the window object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dispatchCustomEvent<T = any>(
  eventName: string,
  detail?: T,
): void {
  if (typeof window === 'undefined') return
  const event = new CustomEvent(eventName, { detail })
  window.dispatchEvent(event)
}
