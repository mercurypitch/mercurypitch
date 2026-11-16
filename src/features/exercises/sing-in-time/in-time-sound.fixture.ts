// ============================================================
// Sing It in Time's test clock: a page clock, frames by hand, no sound
// ============================================================
//
// The drill's run and its player keep time on the lessons' beat clock,
// pumped once a frame. Their tests hand them a page clock they move by hand,
// a sound with no audio context (so the clock keeps time on the page's
// clock, as it does on a page whose sound is off), and frames that run only
// when the test steps them.

import type { InTimeSound } from './beat-sound'
import type { FrameScheduler } from './tune-clock'

/** A frame at 60 a second, ms. */
export const FRAME_MS = 1000 / 60

/** A page clock in ms, from `start`, moved only by the test. */
export function pageClock(start = 1000) {
  let page = start
  return {
    now: (): number => page,
    advance(ms: number): void {
      page += ms
    },
  }
}

export type PageClock = ReturnType<typeof pageClock>

/** A sound with no audio: nothing booked, every beat timed on the page's clock. */
export function silentSound(clock: PageClock): InTimeSound {
  return {
    env: {
      now: clock.now,
      audioTime: () => null,
      outputStamp: () => null,
      bus: () => null,
    },
    audible: () => false,
    book: () => {},
  }
}

/** Frames that run when the test steps them: each `step` runs the frames asked for since the last. */
export function manualFrames() {
  let queue: (() => void)[] = []
  const frame: FrameScheduler = (cb) => {
    queue.push(cb)
    return () => {
      queue = queue.filter((f) => f !== cb)
    }
  }
  return {
    frame,
    step(): void {
      const due = queue
      queue = []
      for (const cb of due) cb()
    },
    get pending(): number {
      return queue.length
    },
  }
}
