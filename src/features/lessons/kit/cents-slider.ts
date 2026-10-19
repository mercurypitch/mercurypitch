// ============================================================
// Cents slider — a vertical slider drawn on a figure, in cents
// ============================================================
//
// Pitch is height on every figure, so a value in cents is set by dragging
// up and down a drawing, not along a range input. This binds that drag and
// the keyboard to any element (a canvas, a drawn handle) and gives it the
// slider's semantics: role="slider", its range and a spoken value. The keys
// are the same on every figure that has one: arrows move 1 cent, Shift with
// an arrow 10, Page Up and Page Down 100, Home and End the ends.
//
// The element owns its scale (`valueAt` turns a pointer's height into
// cents); this owns the gesture. A drag is live only while the element
// holds that pointer's capture, so a lost capture or a cancel the browser
// never sends cannot leave it stuck (MISTAKES.md, "A drag binding must not
// trust its own 'a pointer is down'"). Touch is claimed before contact by
// the element's own `touch-action` in CSS, never mid-gesture.

import { clamp } from './dom'

export interface CentsSliderOptions {
  readonly min: number
  readonly max: number
  /** The value now. */
  value(): number
  /** Takes a new value, already clamped and rounded to a whole cent. */
  set(cents: number): void
  /** The value at a pointer's clientY over the element. */
  valueAt(clientY: number): number
  /** The spoken value (aria-valuetext). */
  valueText(cents: number): string
}

export interface CentsSlider {
  /** Re-reads the value into the slider's attributes. */
  refresh(): void
  /** Turns the slider on or off (a figure can lock it until a demo has played). */
  setEnabled(on: boolean): void
}

const STEP: Readonly<Record<string, number>> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageUp: 100,
  PageDown: -100,
}

export function bindCentsSlider(
  el: HTMLElement,
  opts: CentsSliderOptions,
): CentsSlider {
  let enabled = true
  el.setAttribute('role', 'slider')
  el.setAttribute('aria-valuemin', String(opts.min))
  el.setAttribute('aria-valuemax', String(opts.max))
  el.setAttribute('aria-orientation', 'vertical')

  const put = (cents: number): void => {
    opts.set(Math.round(clamp(cents, opts.min, opts.max)))
    refresh()
  }

  function refresh(): void {
    const v = opts.value()
    el.setAttribute('aria-valuenow', String(Math.round(v)))
    el.setAttribute('aria-valuetext', opts.valueText(v))
  }

  function nextValue(e: KeyboardEvent): number | null {
    if (e.key === 'Home') return opts.min
    if (e.key === 'End') return opts.max
    const step = STEP[e.key]
    if (step === undefined) return null
    const fine = Math.abs(step) === 1 && e.shiftKey ? 10 : 1
    return opts.value() + step * fine
  }

  el.addEventListener('keydown', (e) => {
    if (!enabled) return
    const next = nextValue(e)
    if (next === null) return
    e.preventDefault()
    put(next)
  })
  el.addEventListener('pointerdown', (e) => {
    if (!enabled || e.button !== 0) return
    el.setPointerCapture(e.pointerId)
    put(opts.valueAt(e.clientY))
  })
  el.addEventListener('pointermove', (e) => {
    if (!enabled || !el.hasPointerCapture(e.pointerId)) return
    put(opts.valueAt(e.clientY))
  })

  refresh()
  return {
    refresh,
    setEnabled(on) {
      enabled = on
      el.tabIndex = on ? 0 : -1
      el.setAttribute('aria-disabled', String(!on))
    },
  }
}
