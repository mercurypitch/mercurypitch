// ============================================================
// Lesson 7 hold to repeat — Lower and Higher, pressed and held
// ============================================================
//
// Step 4's Try is "press and hold Higher: the note climbs the column"
// (WEB-SPEC, Toys 1, Push). A press moves the note a semitone at once;
// held, it repeats every 150 ms after 400 ms, so a held Higher climbs the
// column's 24 semitones in under 4 s. It repeats from `pointerdown` to
// `pointerup`, `pointercancel` or `pointerleave`, and stops by itself at
// the column's end (`step` says so). The button swallows `contextmenu`,
// and its CSS takes `touch-action: manipulation`, `user-select: none` and
// `-webkit-touch-callout: none`, so a long press on a phone repeats instead
// of selecting text or opening a menu. A keyboard's Enter or Space is the
// button's own click: one semitone. The click a pointer press ends with
// (its `detail` counts the press) is ignored, since the press has moved.

/** Milliseconds before a held press repeats, and between repeats. */
export const HOLD_DELAY_MS = 400
export const HOLD_EVERY_MS = 150

/** The timers a hold runs on: the window's, or a test's fake clock. */
export interface HoldClock {
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
}

const windowClock: HoldClock = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
}

/**
 * Binds `button` to `step`, which moves the note once and returns whether
 * it may move again (false at the column's end). Returns the unbind.
 */
export function bindHoldRepeat(
  button: HTMLElement,
  step: () => boolean,
  clock: HoldClock = windowClock,
): () => void {
  let timer = 0
  let held = false

  const halt = (): void => {
    held = false
    if (timer !== 0) clock.clearTimeout(timer)
    timer = 0
  }
  const repeat = (): void => {
    if (!held) return
    if (!step()) {
      halt()
      return
    }
    timer = clock.setTimeout(repeat, HOLD_EVERY_MS)
  }
  const down = (e: PointerEvent): void => {
    if (e.button !== 0) return
    halt()
    held = true
    if (!step()) {
      halt()
      return
    }
    timer = clock.setTimeout(repeat, HOLD_DELAY_MS)
  }
  // a pointer's click ends a press that has already moved; a key's has no press
  const click = (e: MouseEvent): void => {
    if (e.detail === 0) step()
  }
  const menu = (e: Event): void => e.preventDefault()
  const ends = ['pointerup', 'pointercancel', 'pointerleave'] as const

  button.addEventListener('pointerdown', down)
  for (const end of ends) button.addEventListener(end, halt)
  button.addEventListener('click', click)
  button.addEventListener('contextmenu', menu)
  return () => {
    halt()
    button.removeEventListener('pointerdown', down)
    for (const end of ends) button.removeEventListener(end, halt)
    button.removeEventListener('click', click)
    button.removeEventListener('contextmenu', menu)
  }
}
