// ============================================================
// Sing It in Time: a tune played on the beat clock, frame by frame
// ============================================================
//
// One tune at a time on the lessons' beat clock (kit/beat-clock-core.ts,
// through in-time-kit.ts): Merc's do, the count-in's bar, then the tune's
// two bars, with the clicks and notes the caller asks for (beat-sound.ts
// `tuneBars`). The clock books each sound ahead on the audio clock and says
// where the run is as it is heard; the drill draws its cursor and lights
// its beat from that, once a frame, so what is seen keeps time with what is
// heard, not with when the page asked for it.
//
// The run and the demo both play through here. Neither owns a frame loop of
// the page's: `startFrames` pumps the clock on the browser's animation
// frames for as long as its owner wants them, and stops with it.

import type { InTimeHit, InTimeSound, TuneBarsOptions } from './beat-sound'
import { LEAD_BEATS, tuneBars } from './beat-sound'
import type { Run, Spot } from './in-time-kit'
import { bars, createBeatClock } from './in-time-kit'
import type { Tune } from './tune-plan'
import { beatSeconds } from './tune-plan'

/** A frame scheduler: calls `cb` once, on the next frame; the result cancels it. */
export type FrameScheduler = (cb: () => void) => () => void

/** The browser's animation frames, or a timer where there are none. */
export const animationFrames: FrameScheduler = (cb) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(() => cb())
    return () => cancelAnimationFrame(id)
  }
  const id = setTimeout(cb, 16)
  return () => clearTimeout(id)
}

/** Calls `tick` on every frame until the returned stop is called. */
export function startFrames(
  frame: FrameScheduler,
  tick: () => void,
): () => void {
  let cancel: (() => void) | null = null
  let live = true
  const loop = (): void => {
    if (!live) return
    tick()
    if (live) cancel = frame(loop)
  }
  cancel = frame(loop)
  return () => {
    live = false
    cancel?.()
    cancel = null
  }
}

/** A beat clock on the drill's sound. */
export function createTuneClock(sound: InTimeSound) {
  return createBeatClock(sound.env)
}
export type TuneClock = ReturnType<typeof createTuneClock>

/** A tune playing: where it is, as heard, and how to stop it. */
export interface TunePlay {
  /** Beats from bar 1's first beat as heard at the last pump: below 0 in the lead; null before the first. */
  beat(): number | null
  /** Bar 1's first beat on the page's clock, ms; null until the clock has timed it. */
  bar1(): number | null
  /** True once it has played to its end, false when it was stopped. */
  readonly done: Promise<boolean>
  readonly running: boolean
  stop(): void
}

export interface PlayTuneOptions extends TuneBarsOptions {
  /** Beats after the tune's last bar that the clock keeps counting (the take's windows). */
  readonly tailBeats?: number
}

/**
 * Starts `tune` on `clock`: Merc's do and the count-in first where asked,
 * the tune's first sound struck in this call (a browser lets a page make
 * its first sound only inside a tap). The owner pumps the clock each frame.
 */
export function playTune(
  clock: TuneClock,
  sound: InTimeSound,
  tune: Tune,
  o: PlayTuneOptions,
): TunePlay {
  const offset = o.lead && o.tune ? LEAD_BEATS : 0
  let heard: number | null = null
  const list = tuneBars(tune, o)
  const run: Run = clock.start<InTimeHit>({
    bar: bars(list),
    bpm: () => tune.bpm,
    audible: sound.audible(),
    tail: (o.tailBeats ?? 0) * beatSeconds(tune),
    book: (hit, when, bus) => sound.book(hit, when, bus),
    onFrame: (spot: Spot) => {
      heard = spot.beats - offset
    },
  })
  return {
    beat: () => heard,
    bar1: () => run.pageTimeOfBeat(offset),
    done: run.done,
    get running() {
      return run.running
    },
    stop: () => run.stop(),
  }
}
