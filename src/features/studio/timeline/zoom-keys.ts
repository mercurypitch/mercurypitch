// ============================================================
// Studio zoom keys — = or + zooms in, - zooms out, both about the playhead, and Z fits the whole song
// ============================================================
//
// The keys answer while focus is in the Studio or on nothing in particular,
// as X does for the desk (mix/mix-shortcut.ts). Text fields keep them (the
// clock takes a typed time), and so do dialogs, menus and listboxes. Ctrl or
// Cmd with + and - stays the browser's page zoom, and with Z the Studio's
// undo. Holding + or - keeps zooming; Z fits once per press. No other key of
// the app or the Studio uses =, +, - or a bare Z.
import { isInsideOverlay, isTypingTarget } from '@/lib/space-playback'

/** The keys shown in the zoom buttons' titles and `aria-keyshortcuts`. */
export const STUDIO_ZOOM_KEYS = { in: '=', out: '-', fit: 'Z' } as const

type ZoomKey = 'in' | 'out' | 'fit'

function zoomKeyOf(event: KeyboardEvent): ZoomKey | null {
  if (event.key === '=' || event.key === '+') return 'in'
  if (event.key === '-') return 'out'
  if (event.key.toLowerCase() === 'z' && !event.shiftKey) return 'fit'
  return null
}

/** Which zoom this key press asks for in a Studio rooted at `scope`, if any. */
export function studioZoomKey(
  event: KeyboardEvent,
  scope: Element | null,
): ZoomKey | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
    return null
  const key = zoomKeyOf(event)
  if (key === null || (key === 'fit' && event.repeat)) return null
  const target = event.target
  if (isTypingTarget(target) || isInsideOverlay(target)) return null
  if (target === document.body || target === document.documentElement)
    return key
  return target instanceof Node && scope?.contains(target) === true ? key : null
}

/** Listen for the zoom keys for exactly the timeline's lifetime. */
export function installStudioZoomKeys(options: {
  scope(): Element | null
  zoom: { step(direction: 1 | -1): void; fit(): void }
}): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const key = studioZoomKey(event, options.scope())
    if (key === null) return
    event.preventDefault()
    if (key === 'fit') options.zoom.fit()
    else options.zoom.step(key === 'in' ? 1 : -1)
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
