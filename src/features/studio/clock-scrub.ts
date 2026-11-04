// ============================================================
// Studio clock scrub — the wheel over the transport's clock and a sideways drag on it move the playhead a step at a time
// ============================================================
//
// No click needed: a notch of the wheel over the clock moves the playhead
// one step, later for up (or a swipe right on a trackpad) and earlier for
// down. A trackpad steps every 40 px of swipe. A sideways drag that starts
// on the clock steps every 10 px, past a dead zone that keeps a click a
// click: the field still takes a typed time, and its arrow keys step as the
// wheel does (StudioTransport.tsx). A step is a line of the timeline's grid
// while Snap is on, else a second; Shift steps finer (scrub-step.ts). Each
// step is a seek, so it works stopped and playing.
//
// A seek ends a running take (StudioWorkspace.tsx), and a hand passing over
// the clock on its way to the mouse's rest must not. So while a take runs
// the clock holds still, as the ruler holds its range (take-running.ts): the
// wheel turns nothing, a drag moves nothing, and one under way stops. A time
// typed and entered still seeks: that is meant.
import { studioTakeRunning } from './record/take-running'
import { studioRulerSlop } from './timeline/ruler-gesture'
import type { StudioScrubGrid } from './timeline/scrub-step'
import { studioScrubFrame, studioScrubGrid } from './timeline/scrub-step'
import { isStudioWheelNotch } from './timeline/zoom-math'

/** A trackpad's swipe, in pixels, for each step. */
const SWIPE_STEP_PX = 40
/** A drag's travel, in pixels, for each step. */
const DRAG_STEP_PX = 10
/** How long a seek counts as on its way, before the playhead shows it. */
const SEEK_LANDING_MS = 500

/**
 * The steps one wheel event turns the clock (positive is later), and the
 * part of a trackpad's swipe left over for the next event.
 */
export function studioClockWheelTurn(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>,
  carry: number,
): { steps: number; carry: number } {
  // Shift turns a wheel sideways in most browsers: read it as the wheel.
  const later =
    event.shiftKey && event.deltaY === 0
      ? -event.deltaX
      : Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : -event.deltaY
  if (isStudioWheelNotch(event)) return { steps: Math.sign(later), carry: 0 }
  const total = carry + later
  const steps = Math.trunc(total / SWIPE_STEP_PX)
  return { steps, carry: total - steps * SWIPE_STEP_PX }
}

/** `steps` steps from `frame`, held inside the song. */
export function studioClockScrubTarget(
  frame: number,
  steps: number,
  grid: StudioScrubGrid | null,
  fine: boolean,
  endFrame: number,
): number {
  let target = frame
  for (let step = 0; step < Math.abs(steps); step++)
    target = studioScrubFrame(target, steps > 0 ? 1 : -1, grid, fine)
  return Math.min(Math.max(0, endFrame), target)
}

/**
 * Lets the wheel and a sideways drag over `clock` move the playhead.
 * Returns the detach.
 */
export function attachStudioClockScrub(
  clock: HTMLElement,
  options: {
    frame(): number
    endFrame(): number
    seek(frame: number): void
    grid?(): StudioScrubGrid | null
    /** True while the clock holds still: a take runs. */
    locked?(): boolean
  },
): () => void {
  const grid = () => (options.grid ?? studioScrubGrid)()
  const locked = () => (options.locked ?? studioTakeRunning)()
  let carry = 0
  // A fast turn outruns the playhead: count from the seek still on its way.
  let sent: { target: number; from: number; at: number } | null = null
  let drag: {
    pointerId: number
    startX: number
    from: number
    slop: number
    scrubbing: boolean
    steps: number
  } | null = null

  function currentFrame(): number {
    const now = options.frame()
    const landing =
      sent !== null &&
      now === sent.from &&
      performance.now() - sent.at < SEEK_LANDING_MS
    return landing && sent !== null ? sent.target : now
  }

  function seekTo(from: number, target: number): void {
    if (target === from) return
    sent = { target, from: options.frame(), at: performance.now() }
    options.seek(target)
  }

  const onWheel = (event: WheelEvent) => {
    if (event.cancelable) event.preventDefault()
    if (locked()) {
      carry = 0
      return
    }
    const turn = studioClockWheelTurn(event, carry)
    carry = turn.carry
    if (turn.steps === 0) return
    const from = currentFrame()
    seekTo(
      from,
      studioClockScrubTarget(
        from,
        turn.steps,
        grid(),
        event.shiftKey,
        options.endFrame(),
      ),
    )
  }

  const onMove = (event: PointerEvent) => {
    if (drag === null || event.pointerId !== drag.pointerId) return
    if (locked()) {
      endDrag()
      return
    }
    const travel = event.clientX - drag.startX
    if (!drag.scrubbing) {
      if (Math.abs(travel) < drag.slop) return
      drag.scrubbing = true
      clock.dataset.scrubbing = ''
      clock.blur()
    }
    const steps = Math.trunc(travel / DRAG_STEP_PX)
    if (steps === drag.steps) return
    drag.steps = steps
    const target = studioClockScrubTarget(
      drag.from,
      steps,
      grid(),
      event.shiftKey,
      options.endFrame(),
    )
    seekTo(currentFrame(), target)
  }

  function endDrag(): void {
    drag = null
    delete clock.dataset.scrubbing
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
  const onUp = (event: PointerEvent) => {
    if (drag !== null && event.pointerId === drag.pointerId) endDrag()
  }

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false || drag !== null) return
    if (locked()) return
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      from: currentFrame(),
      slop: studioRulerSlop(event.pointerType),
      scrubbing: false,
      steps: 0,
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  clock.addEventListener('wheel', onWheel, { passive: false })
  clock.addEventListener('pointerdown', onDown)
  return () => {
    endDrag()
    clock.removeEventListener('wheel', onWheel)
    clock.removeEventListener('pointerdown', onDown)
  }
}
