// ============================================================
// The onboarding's test bench: a stand-in capture, a hand-cranked frame
// ============================================================
//
// The beats read the mic once a screen frame. A stand-in for the room
// kit's capture holds the frames a test says the mic gave, and counts what
// was asked of it; a screen frame is drawn only when a test cranks one.

import { vi } from 'vitest'
import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { TAKE_MAX_SEC, TAKE_SEC } from './first-note'

export interface Stand {
  capture: ExerciseCapture
  calls: { acquire: number; release: number; startWindow: number }
  /** What the mic has given since the window opened. */
  frames: PitchFrame[]
  /** How the next acquire answers. */
  answer: () => Promise<void>
}

/** A stand-in capture: a new window empties its frames. */
export function stand(): Stand {
  const s: Stand = {
    calls: { acquire: 0, release: 0, startWindow: 0 },
    frames: [],
    answer: async () => Promise.resolve(),
    capture: {
      acquire: async () => {
        s.calls.acquire += 1
        return s.answer()
      },
      release: () => {
        s.calls.release += 1
      },
      held: () => false,
      startWindow: () => {
        s.calls.startWindow += 1
        s.frames = []
      },
      peekFrames: () => [...s.frames],
      takeFrames: () => [...s.frames],
      playTone: async () => Promise.resolve(),
      audio: async () => Promise.resolve(null),
      runningAudio: () => null,
    },
  }
  return s
}

let queued = new Map<number, FrameRequestCallback>()
let nextFrame = 1

/** requestAnimationFrame by hand: nothing is drawn until flushFrame. */
export function stubFrames(): void {
  queued = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame++
    queued.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queued.delete(id)
  })
}

/** Draw one screen frame: every callback waiting for it runs. */
export function flushFrame(): void {
  const now = queued
  queued = new Map()
  for (const callback of now.values()) callback(performance.now())
}

/** Lets the mic's answer land. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const RATE = 100

/**
 * A first-note take: a second of room, then `hz` to its end. An unvoiced
 * noise (0) runs to the longest take there is: too little voice keeps it
 * open.
 */
export function noteTake(hz: number): PitchFrame[] {
  const frames: PitchFrame[] = []
  const end = 1 + (hz > 0 ? TAKE_SEC : TAKE_MAX_SEC) + 0.05
  for (let i = 0; i < end * RATE; i++) {
    const t = i / RATE
    frames.push(
      t < 1
        ? { t, f0: 0, conf: 0, rms: 0.002 }
        : { t, f0: hz, conf: hz > 0 ? 0.95 : 0, rms: 0.12 },
    )
  }
  return frames
}
