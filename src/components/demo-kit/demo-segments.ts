// ============================================================
// A demo take in segments: Echo's and Long note's scripts
// ============================================================
//
// Echo's and Long note's demo scripts write each take as segments: a rest,
// or a stretch sung from one pitch and loudness to another, eased between
// (Echo's held notes and the glides between them; Long note's scoop, drift
// and breath). This plays such a script: what is sung at an engine time,
// the tracker's frame for it (demo-voice.ts) and the voice line the demo's
// sound sings.

import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { DemoEvent, DemoVoicePoint } from './demo-plan'
import type { DemoVibrato } from './demo-voice'
import { grainFor, silentFrame, vibratoCents, VOICE_STEP, voicedFrame, wanderFor, } from './demo-voice'

/** One stretch of a take: a rest, or sung. */
export type DemoSegment =
  | { readonly kind: 'rest'; readonly until: number }
  | {
      readonly kind: 'sing'
      readonly until: number
      /** Off the take's note, cents, from and to, eased between. */
      readonly cents: readonly [number, number]
      readonly level: readonly [number, number]
    }

const smooth = (k: number): number => k * k * (3 - 2 * k)

/** What a script sings at one time. */
export interface SegmentSung {
  /** Off the take's note, cents, before wander and vibrato. */
  readonly cents: number
  readonly level: number
  /** When this run of singing began; null in a rest. */
  readonly onset: number | null
}

/**
 * The script at one engine time. A stretch sung without an end stays at
 * its start.
 */
export function sampleSegments(
  segments: readonly DemoSegment[],
  t: number,
): SegmentSung {
  let from = 0
  let onset: number | null = null
  for (const segment of segments) {
    if (segment.kind === 'rest') onset = null
    else onset ??= from
    if (t < segment.until) {
      if (segment.kind === 'rest') return { cents: 0, level: 0, onset: null }
      const span = segment.until - from
      const k = Number.isFinite(span)
        ? smooth(Math.min(1, (t - from) / span))
        : 0
      return {
        cents: segment.cents[0] + (segment.cents[1] - segment.cents[0]) * k,
        level: segment.level[0] + (segment.level[1] - segment.level[0]) * k,
        onset,
      }
    }
    from = segment.until
  }
  return { cents: 0, level: 0, onset: null }
}

/**
 * A take's voice as the pitch tracker hears it: the frame at engine time
 * t of the script `segments`, on the take's own seeded wander and grain,
 * with `vibrato` on each run of singing. Called once a frame, in order:
 * the grain is a sequence.
 */
export function segmentTracker(
  note: number,
  seed: number,
  vibrato: DemoVibrato,
): (segments: readonly DemoSegment[], t: number) => PitchFrame {
  const wander = wanderFor(seed)
  const grain = grainFor(seed)
  return (segments, t) => {
    const sung = sampleSegments(segments, t)
    if (sung.onset === null || sung.level <= 0) return silentFrame(t)
    const jitter = grain()
    const cents =
      sung.cents + wander(t) + vibratoCents(vibrato, t, sung.onset) + jitter
    return voicedFrame(t, note, cents, sung.level)
  }
}

/**
 * The voice line the demo's sound sings (wall clock, to `length`), on the
 * take's own wander: `engineAt` reads the script's time at a wall time.
 */
export function segmentVoice(
  segments: readonly DemoSegment[],
  seed: number,
  length: number,
  engineAt: (wall: number) => number,
): DemoVoicePoint[] {
  const wander = wanderFor(seed)
  const points: DemoVoicePoint[] = []
  const count = Math.ceil(length / VOICE_STEP)
  for (let i = 0; i <= count; i++) {
    const w = i * VOICE_STEP
    const e = engineAt(w)
    const sung = sampleSegments(segments, e)
    const voiced = sung.onset !== null && sung.level > 0
    points.push({
      t: w,
      cents: voiced ? sung.cents + wander(e) : 0,
      level: voiced ? sung.level : 0,
    })
  }
  return points
}

/** When `type` first fired in a take: its script must reach it. */
export function eventAt<E extends string>(
  events: readonly DemoEvent<E>[],
  type: E,
  room: string,
): number {
  const event = events.find((e) => e.type === type)
  if (event === undefined) {
    throw new Error(`${room} demo: the script never reaches '${type}'`)
  }
  return event.at
}
