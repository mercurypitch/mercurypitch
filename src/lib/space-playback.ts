// ============================================================
// Space-bar transport toggle for playback surfaces.
// ============================================================
//
// Product rule: on a page whose primary object is a running playback
// transport, Space toggles play/pause — always. A focused mute chip, seek
// slider or panel button must not steal the key; the only exceptions are
// real typing surfaces (text fields, textareas, selects, contenteditable)
// and modifier chords. Focused buttons stay reachable with Enter.
//
// Install from the component that OWNS the transport, for exactly its
// lifetime. The listener runs in the capture phase so no inner widget can
// swallow the key first, and preventDefault() on keydown suppresses the
// browser's Space-activates-focused-button behavior, so the toggle never
// double-fires against a focused control.

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'radio',
  'range',
  'reset',
  'submit',
])

/** True when Space must keep its typing meaning for this event target. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type)
  }
  return false
}

export interface SpacePlaybackOptions {
  /** Toggle play/pause. Called once per discrete, unmodified Space press. */
  toggle: () => void
  /** Optional ownership gate — return false while an overlay owns the key,
   *  leaving Space untouched for its focused control. */
  ownsSpace?: () => boolean
  /** Optional gate — return false while the surface should swallow Space
   *  without toggling (e.g. a transport still loading). */
  enabled?: () => boolean
}

/** Install the capture-phase Space listener; returns the uninstall fn. */
export function installSpacePlaybackToggle(
  options: SpacePlaybackOptions,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Space' || event.repeat) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isTypingTarget(event.target)) return
    if (options.ownsSpace?.() === false) return
    event.preventDefault()
    if (options.enabled?.() === false) return
    options.toggle()
  }
  window.addEventListener('keydown', onKeyDown, true)
  return () => window.removeEventListener('keydown', onKeyDown, true)
}
