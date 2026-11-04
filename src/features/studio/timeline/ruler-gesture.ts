// ============================================================
// Studio ruler gesture — a click on the ruler seeks, a drag along it draws the range, and the playhead's own handle scrubs
// ============================================================
//
// As in REAPER: a press that comes up within a few pixels of where it went
// down is a click, and seeks there when it is let go, playing or not. One
// that moves further draws the range from where it went down
// (StudioRulerRange.tsx), which Repeat loops and Punch records in; a drag
// too short to make a range is a click after all. Shift draws at once, as it
// did before a plain drag drew. Scrubbing is the playhead's: a press on its
// handle drags the playhead without a jump where it was grabbed. A stopped
// song follows the handle; a playing one moves once, on release, so it does
// not jump under every pointer move.
//
// A second finger is a pinch (lane-navigation.ts): the gesture lets go, and
// seeks and draws nothing. So does a drag while a take runs, which holds the
// range still (take-running.ts); a click still seeks, which stops the take,
// as every seek does.
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'

/** How far a mouse or pen press moves before it is a drag, in pixels. */
export const STUDIO_RULER_SLOP_PX = 4
/** How far a finger moves before its press is a drag: fingers wobble. */
const TOUCH_SLOP_PX = 10

/** The parts of a pointer event the gesture reads. */
export interface StudioRulerPointer {
  pointerId: number
  clientX: number
  pointerType: string
  shiftKey: boolean
}

/** How far a press moves before it is a drag, for this kind of pointer. */
export function studioRulerSlop(pointerType: string): number {
  return pointerType === 'touch' ? TOUCH_SLOP_PX : STUDIO_RULER_SLOP_PX
}

/** The range's drawing, as StudioRulerRange.tsx's createStudioRangeDraw does it. */
export interface StudioRulerDraw {
  /** Starts a range at `frame`; false while a take holds the range still. */
  start(frame: number): boolean
  move(event: StudioRulerPointer): void
  /** Ends the drawing and returns the range it set, or null for none. */
  end(commit: boolean): StudioFrameRange | null
}

type Gesture =
  | { kind: 'press'; pointerId: number; x: number; frame: number; slop: number }
  | { kind: 'range'; pointerId: number; frame: number; click: boolean }
  | { kind: 'held'; pointerId: number }
  | { kind: 'scrub'; pointerId: number; offset: number; moved: boolean }

export function createStudioRulerGesture(options: {
  frameAt(event: StudioRulerPointer): number
  playheadFrame(): number
  playing(): boolean
  seek(frame: number): void
  /** The range's drawing; without one, a drag draws nothing. */
  draw: StudioRulerDraw | null
}) {
  const [scrubFrame, setScrubFrame] = createSignal<number | null>(null)
  let gesture: Gesture | null = null

  function clear(): void {
    gesture = null
    setScrubFrame(null)
  }

  /** Let go without seeking or setting anything. */
  function cancel(): void {
    if (gesture?.kind === 'range') options.draw?.end(false)
    clear()
  }

  function startRange(
    pointerId: number,
    frame: number,
    click: boolean,
  ): Gesture {
    return options.draw?.start(frame) === true
      ? { kind: 'range', pointerId, frame, click }
      : { kind: 'held', pointerId }
  }

  return {
    /** Where a dragged playhead stands, or null while none is dragged. */
    scrubFrame: scrubFrame as Accessor<number | null>,
    active: () => gesture !== null,
    cancel,
    /** A press on the ruler; `onHandle` when it landed on the playhead's handle. */
    press(event: StudioRulerPointer, onHandle: boolean): void {
      if (gesture !== null) {
        if (event.pointerId !== gesture.pointerId) cancel()
        return
      }
      const frame = options.frameAt(event)
      const pointerId = event.pointerId
      if (onHandle) {
        const playhead = options.playheadFrame()
        gesture = {
          kind: 'scrub',
          pointerId,
          offset: frame - playhead,
          moved: false,
        }
        setScrubFrame(playhead)
      } else if (event.shiftKey) gesture = startRange(pointerId, frame, false)
      else {
        const slop = studioRulerSlop(event.pointerType)
        gesture = { kind: 'press', pointerId, x: event.clientX, frame, slop }
      }
    },
    move(event: StudioRulerPointer): void {
      const current = gesture
      if (current === null || event.pointerId !== current.pointerId) return
      if (current.kind === 'press') {
        if (Math.abs(event.clientX - current.x) < current.slop) return
        gesture = startRange(current.pointerId, current.frame, true)
        if (gesture.kind === 'range') options.draw?.move(event)
      } else if (current.kind === 'range') options.draw?.move(event)
      else if (current.kind === 'scrub') {
        const frame = Math.max(0, options.frameAt(event) - current.offset)
        current.moved = true
        setScrubFrame(frame)
        if (!options.playing()) options.seek(frame)
      }
    },
    release(event: StudioRulerPointer): void {
      const current = gesture
      if (current === null || event.pointerId !== current.pointerId) return
      const scrubbed = scrubFrame()
      clear()
      if (current.kind === 'press') options.seek(current.frame)
      else if (current.kind === 'range') {
        const set = options.draw?.end(true) ?? null
        if (set === null && current.click) options.seek(current.frame)
      } else if (current.kind === 'scrub' && current.moved && scrubbed !== null)
        options.seek(scrubbed)
    },
  }
}

export type StudioRulerGesture = ReturnType<typeof createStudioRulerGesture>
