// ============================================================
// A premium room's demo: its two takes, its tooltips and its clock
// ============================================================
//
// "How it works" for an exercise is a seeded script of frames that Merc
// sings through the room's own engine, twice: take 1 the way not to (the
// "Not like this" pill), take 2 the way to (the "Like this" pill). Each
// tooltip waits for the engine event it explains, the first time that event
// fires (useExerciseDemo.ts keys them).
//
// Two clocks. A take's frames are dated on the ENGINE clock, the one the
// exercise's engine ticks on (frame.t). The screen and the sound run on the
// WALL clock. They agree except in a take's fast-forwards, where the engine
// runs ahead of the wall; `engineAt` and `wallAt` convert between the two.
//
// `planDemo` lays a cue table out on the takes' own replay: when each take
// starts, when each tooltip shows and when the end card comes. The progress
// bar runs on it, and an exercise's tests check its tooltips against it.

import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** Take 1, the way not to sing it, and take 2, the way to. */
export type DemoTakeId = 'off' | 'on'

/** One moment of the sung line, for the voice synth (wall clock). */
export interface DemoVoicePoint {
  /** Seconds since the take started. */
  readonly t: number
  /** Off the note, cents; vibrato comes on top. */
  readonly cents: number
  /** Loudness 0..1; 0 is silence. */
  readonly level: number
}

/** One of the engine's events for a take's frames. */
export interface DemoEvent<E extends string> {
  readonly type: E
  /** Engine seconds. */
  readonly at: number
}

/** A stretch of a take played fast, engine seconds. */
export interface FastStretch {
  readonly from: number
  readonly to: number
}

/** What the kit needs of a take; an exercise's own takes add their rules. */
export interface DemoTakeShape<E extends string> {
  readonly id: DemoTakeId
  readonly frames: readonly PitchFrame[]
  /** The engine's events for these frames, in order. */
  readonly events: readonly DemoEvent<E>[]
  /** The take's fast-forwards, in order; empty for one sung at its own speed. */
  readonly fast: readonly FastStretch[]
  /** Engine seconds at a wall time since the take started. */
  engineAt: (wall: number) => number
  /** Wall seconds since the take started at an engine time. */
  wallAt: (engine: number) => number
  /** The voice to synthesise, wall clock. */
  readonly voice: readonly DemoVoicePoint[]
  /** Wall seconds from the take's start to the end of its note. */
  readonly length: number
}

/**
 * A take's two clocks through its fast stretches, each played `rate` engine
 * seconds to the wall second; between them the clocks run together.
 */
export function stretchClocks(
  fast: readonly FastStretch[],
  rate: number,
): Pick<DemoTakeShape<string>, 'engineAt' | 'wallAt'> {
  const saves = (stretch: FastStretch): number =>
    (stretch.to - stretch.from) * (1 - 1 / rate)
  return {
    engineAt: (w) => {
      let saved = 0
      for (const stretch of fast) {
        const starts = stretch.from - saved
        if (w <= starts) break
        const ends = starts + (stretch.to - stretch.from) / rate
        if (w <= ends) return stretch.from + (w - starts) * rate
        saved += saves(stretch)
      }
      return w + saved
    },
    wallAt: (e) => {
      let saved = 0
      for (const stretch of fast) {
        if (e <= stretch.from) break
        if (e < stretch.to)
          return stretch.from - saved + (e - stretch.from) / rate
        saved += saves(stretch)
      }
      return e - saved
    },
  }
}

/**
 * A take's engine event, or `fast` and `slow`: one of its fast-forwards
 * beginning and ending.
 */
export type DemoMark<E extends string> = E | 'fast' | 'slow'

export type DemoTrigger<E extends string> =
  | { readonly take: 'intro' }
  | { readonly take: DemoTakeId; readonly mark: DemoMark<E> }

/** One tooltip: what it explains, when, and what it points at. */
export interface DemoCue<C extends string, E extends string, T extends string> {
  readonly id: C
  readonly trigger: DemoTrigger<E>
  /** Wall seconds after the trigger. */
  readonly delay: number
  readonly target: T
}

/** The beats between the takes, wall seconds. */
export interface DemoBeats {
  /** The room's note, before take 1. */
  readonly intro: number
  /** From a take's start to its clock's zero: the sound's head start. */
  readonly lead: number
  /** Take 1's end to the reset. */
  readonly afterOff: number
  /** The room empties and the pill turns. */
  readonly reset: number
  /** Take 2's end (the result) to the end card. */
  readonly afterOn: number
}

/**
 * When a take's mark first happens, engine seconds; null if it never does.
 */
export function demoMarkAt<E extends string>(
  take: DemoTakeShape<E>,
  mark: DemoMark<E>,
): number | null {
  if (mark === 'fast') return take.fast[0]?.from ?? null
  if (mark === 'slow') return take.fast[0]?.to ?? null
  return take.events.find((event) => event.type === mark)?.at ?? null
}

export interface PlannedCue<C extends string> {
  readonly id: C
  /** When its trigger happens, wall seconds from the demo's start. */
  readonly trigger: number
  /** When it shows. */
  readonly at: number
}

export interface DemoTimeline<C extends string, Take> {
  readonly takes: Readonly<Record<DemoTakeId, Take>>
  /** When each take's clock reads zero, wall seconds from the start. */
  readonly takeStart: Readonly<Record<DemoTakeId, number>>
  readonly cues: readonly PlannedCue<C>[]
  /** When the end card shows. */
  readonly total: number
}

/**
 * The whole demo on one wall clock, as the room plays it. `name` names the
 * exercise when a cue waits for a mark its take never has.
 */
export function planDemo<
  C extends string,
  E extends string,
  T extends string,
  Take extends DemoTakeShape<E>,
>(
  name: string,
  takes: Readonly<Record<DemoTakeId, Take>>,
  cues: readonly DemoCue<C, E, T>[],
  beats: DemoBeats,
): DemoTimeline<C, Take> {
  const offStart = beats.intro + beats.lead
  const offEnd = offStart + takes.off.length
  const onStart = offEnd + beats.afterOff + beats.reset + beats.lead
  const onEnd = onStart + takes.on.length
  const takeStart = { off: offStart, on: onStart }

  const planned = cues.map((cue): PlannedCue<C> => {
    let trigger = 0
    if (cue.trigger.take !== 'intro') {
      const take = takes[cue.trigger.take]
      const engine = demoMarkAt(take, cue.trigger.mark)
      if (engine === null) {
        throw new Error(`${name} demo: no '${cue.trigger.mark}' in a take`)
      }
      trigger = takeStart[cue.trigger.take] + take.wallAt(engine)
    }
    return { id: cue.id, trigger, at: trigger + cue.delay }
  })
  return { takes, takeStart, cues: planned, total: onEnd + beats.afterOn }
}

/** A take as the room plays it: its frames released on its own clock. */
export interface TakeClock<E extends string> {
  /** When the take's clock reads zero, performance.now() ms. */
  readonly startsAt: number
  /** The take's clock: engine seconds since it started. */
  now: () => number
  /** The frames released so far, oldest first, on the take's own clock. */
  frames: () => readonly PitchFrame[]
  /** Every engine event, as it fires. */
  onEvent: (event: E) => void
}

/**
 * The clock for one take that starts at `startsAt` (performance.now() ms):
 * each call to `frames` releases what the clock has passed, and marks each
 * fast-forward's start and end as it goes by.
 */
export function takeClock<E extends string>(
  take: DemoTakeShape<E>,
  startsAt: number,
  onMark: (mark: DemoMark<E>) => void,
): TakeClock<E> {
  const released: PitchFrame[] = []
  // Each fast-forward's start and end, in order, marked as the clock
  // passes them.
  const turns = take.fast.flatMap((stretch) => [
    { at: stretch.from, mark: 'fast' as const },
    { at: stretch.to, mark: 'slow' as const },
  ])
  let turned = 0
  const clock = (): number =>
    Math.max(0, take.engineAt((performance.now() - startsAt) / 1000))
  return {
    startsAt,
    now: clock,
    frames: () => {
      const t = clock()
      const all = take.frames
      while (released.length < all.length && all[released.length].t <= t) {
        released.push(all[released.length])
      }
      while (turned < turns.length && t >= turns[turned].at) {
        onMark(turns[turned].mark)
        turned += 1
      }
      return released
    },
    onEvent: onMark,
  }
}
