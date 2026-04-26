// ============================================================
// Debounce Utility - Utility functions for timing control
// ============================================================

/**
 * Debounce a function call to only execute after a delay since the last call.
 * Useful for auto-save, search input, and throttled events.
 *
 * @example
 * ```typescript
 * const debouncedSave = debounce((data: any) => {
 *   saveToDatabase(data)
 * }, 500)
 *
 * // Called 3 times within 500ms
 * debouncedSave('data1') // Won't run yet
 * debouncedSave('data2') // Won't run yet
 * debouncedSave('data3') // Still won't run - last call resets timer
 *
 * // After 500ms, 'data3' saves to database
 * ```
 *
 * @param fn - Function to debounce
 * @param delay - Milliseconds to wait after last call
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}