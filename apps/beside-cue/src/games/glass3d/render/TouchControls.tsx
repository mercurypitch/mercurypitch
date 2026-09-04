// The controls, on the glass.
// ============================================================
//
// A walk strip and a jump button, laid over the bottom of the stage.
// Everything about WHAT a press means lives in `input/pad-intent`, which
// has tests; this file is the part that has to touch the DOM, and it is
// kept thin on purpose.
//
// Pointer events, not touch events: one code path covers a thumb, a
// mouse and a stylus, and pointer capture means a finger that slides off
// the pad keeps steering instead of leaving him walking into a wall
// forever. `touch-action: none` in the CSS is what stops the browser
// deciding a horizontal drag was a scroll and swallowing the moves.

import { onCleanup } from 'solid-js'
import type { IntentSource, PadConfig } from '../input/pad-intent'
import { isTap, PAD_CONFIG, padMove } from '../input/pad-intent'

interface TouchControlsProps {
  source: IntentSource
  cfg?: PadConfig
}

export const TouchControls = (props: TouchControlsProps) => {
  let padEl!: HTMLDivElement
  const cfg = (): PadConfig => props.cfg ?? PAD_CONFIG

  /** The press in progress. One at a time on the pad: a second finger
   * landing on it is a mis-grab, not a second opinion. */
  let pointerId: number | null = null
  let rect = { left: 0, width: 0 }
  let downAt = 0
  let maxOff = 0

  const offRatio = (clientX: number): number => {
    const half = rect.width / 2
    if (!(half > 0)) return 0
    return Math.min(1, Math.abs(clientX - (rect.left + half)) / half)
  }

  const onDown = (event: PointerEvent): void => {
    if (pointerId !== null) return
    pointerId = event.pointerId
    const measured = padEl.getBoundingClientRect()
    rect = { left: measured.left, width: measured.width }
    downAt = event.timeStamp
    maxOff = offRatio(event.clientX)
    // Capture can be refused -- a pointer that has already gone away, a
    // synthetic event in a test -- and the pad still has to work without
    // it. It buys "a finger that slides off the pad keeps steering", not
    // the ability to steer at all.
    try {
      padEl.setPointerCapture(event.pointerId)
    } catch {
      /* no capture; the handlers below still see this pointer */
    }
    props.source.setMove(padMove(event.clientX, rect, cfg().deadZoneRatio))
  }

  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return
    maxOff = Math.max(maxOff, offRatio(event.clientX))
    props.source.setMove(padMove(event.clientX, rect, cfg().deadZoneRatio))
  }

  const onUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return
    pointerId = null
    props.source.setMove(0)
    // `timeStamp` is the browser's own clock for the event, which is the
    // same origin `performance.now()` uses -- so the pulse is measured
    // from when the finger actually lifted rather than from whenever
    // this handler happened to run.
    const held = (event.timeStamp - downAt) / 1000
    if (isTap(held, maxOff, cfg())) props.source.pulseJump(event.timeStamp)
  }

  const onLost = (): void => {
    pointerId = null
    props.source.setMove(0)
  }

  // A jump held down while the app is backgrounded never sees its
  // pointerup, and he arrives back mid-hop forever.
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') props.source.release()
  }
  document.addEventListener('visibilitychange', onHide)
  onCleanup(() => document.removeEventListener('visibilitychange', onHide))

  return (
    <div class="stage3d__controls">
      <div
        class="stage3d__pad"
        ref={padEl}
        role="group"
        aria-label="Walk. Press either side to go that way, tap to jump."
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onLost}
        onLostPointerCapture={onLost}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
        <i />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </div>

      <button
        class="stage3d__jump"
        type="button"
        aria-label="Jump"
        onPointerDown={() => props.source.setHeldJump(true)}
        onPointerUp={() => props.source.setHeldJump(false)}
        onPointerCancel={() => props.source.setHeldJump(false)}
        onPointerLeave={() => props.source.setHeldJump(false)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V6m0 0-6 6m6-6 6 6" />
        </svg>
      </button>
    </div>
  )
}
