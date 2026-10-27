// ============================================================
// Studio mix shortcut — X opens and closes the mixing desk, as in Logic
// ============================================================
//
// A bare X, with no modifier, toggles the desk while focus is in the Studio
// or on nothing in particular. Text fields keep the letter, and so do
// dialogs, menus and listboxes, which answer their own keys first. The app's
// own shortcuts (M, V, R, P, Space, Home) and the Studio's (S, M, Delete and
// the Ctrl chords) do not use X.
import { isInsideOverlay, isTypingTarget } from '@/lib/space-playback'

/** The key shown in the Mix button's title and `aria-keyshortcuts`. */
export const STUDIO_MIX_SHORTCUT = 'X'

/** Whether this key press is the mix shortcut for a Studio rooted at `scope`. */
export function isStudioMixShortcut(
  event: KeyboardEvent,
  scope: Element | null,
): boolean {
  if (event.defaultPrevented || event.repeat) return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
    return false
  if (event.key.toLowerCase() !== 'x') return false
  const target = event.target
  if (isTypingTarget(target) || isInsideOverlay(target)) return false
  // Focus on the page itself, or anywhere in the Studio; not elsewhere in the app.
  if (target === document.body || target === document.documentElement)
    return true
  return target instanceof Node && scope?.contains(target) === true
}

/** Listen for X for exactly the Studio workspace's lifetime. */
export function installStudioMixShortcut(options: {
  scope(): Element | null
  toggle(): void
}): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isStudioMixShortcut(event, options.scope())) return
    event.preventDefault()
    options.toggle()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
