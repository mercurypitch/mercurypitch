// ============================================================
// installSelectBlurOnPointerChange — after a pointer-driven <select>
// change, blur the element so focus returns to the document.
//
// Why: a native <select> keeps focus after you pick an option. On the
// practice pages Spacebar is play/pause, but a focused <select> swallows
// Space to re-open its dropdown instead — so picking a key/scale/mode/chord
// or a drum-machine preset left Space "broken" until you clicked elsewhere.
//
// Blurring is gated to POINTER-initiated changes: keyboard-driven changes
// (Tab to a select, arrow/Enter to commit) keep focus so keyboard navigation
// and tab order aren't disrupted. One document-level listener covers every
// <select> in the app — native and SafeSelect, present and future.
// ============================================================

export function installSelectBlurOnPointerChange(
  doc: Document = document,
): () => void {
  // Tracks whether the most recent input was a pointer (vs the keyboard).
  // A pointer-driven select pick has pointerMode=true at change time; a
  // keyboard commit flips it false on the preceding keydown.
  let pointerMode = false

  const onPointerDown = (): void => {
    pointerMode = true
  }
  const onKeyDown = (): void => {
    pointerMode = false
  }
  const onChange = (e: Event): void => {
    if (pointerMode && e.target instanceof HTMLSelectElement) {
      e.target.blur()
    }
  }

  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('change', onChange, true)

  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('change', onChange, true)
  }
}
