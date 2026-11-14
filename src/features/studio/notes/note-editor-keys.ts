// ============================================================
// Studio notes key — E opens the notes of the MIDI clip with the focus, or of the selected one
// ============================================================
//
// A bare E, with no modifier, while the focus is in the Studio or on
// nothing in particular, as X does for the mix desk (mix/mix-shortcut.ts).
// The clip with the focus wins; with the focus anywhere else, the selected
// clip opens. Text fields keep the letter, and so do dialogs, menus and
// listboxes, which answer their own keys first; the note editor keeps it
// too. No other key of the app (M, V, R, P, Space, Home) or of the Studio
// (S, M, X, Z, =, -, Delete, the arrows and the Ctrl chords) uses E.
import { isInsideOverlay, isTypingTarget } from '@/lib/space-playback'
import { studioEditorFocus } from '../editor/key-scope'

/** The key shown in a MIDI clip's `aria-keyshortcuts` and the Edit notes button's. */
export const STUDIO_NOTES_SHORTCUT = 'E'

/** The clip this key press asks to open, in a Studio rooted at `scope`; null when it is not the notes key. */
export function studioNotesKeyClip(
  event: KeyboardEvent,
  scope: Element | null,
  selectedClipId: string | null,
): string | null {
  if (!isBareE(event) || !isStudioKey(event.target, scope)) return null
  return studioEditorFocus(event.target)?.clipId ?? selectedClipId
}

/** A press of E alone, not held down, that nothing has answered yet. */
function isBareE(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat) return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
    return false
  return event.key.toLowerCase() === 'e'
}

/** Whether a key pressed on `target` is the Studio's: in `scope`, or on nothing in particular, and not in a field, an overlay or the note editor. */
function isStudioKey(
  target: EventTarget | null,
  scope: Element | null,
): boolean {
  if (isTypingTarget(target) || isInsideOverlay(target)) return false
  if (target === document.body || target === document.documentElement)
    return true
  if (!(target instanceof Node) || scope?.contains(target) !== true)
    return false
  return !(
    target instanceof Element && target.closest('[data-studio-note-editor]')
  )
}

/** Listen for E for exactly the Studio workspace's lifetime. */
export function installStudioNotesKey(options: {
  scope(): Element | null
  selectedClipId(): string | null
  /** Open a clip's notes; false for a clip that plays no MIDI. */
  open(clipId: string): boolean
}): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const clipId = studioNotesKeyClip(
      event,
      options.scope(),
      options.selectedClipId(),
    )
    if (clipId !== null && options.open(clipId)) event.preventDefault()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
