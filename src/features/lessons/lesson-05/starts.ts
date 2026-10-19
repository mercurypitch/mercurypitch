// ============================================================
// Lesson 5 three starts — how a note can begin, timed and synthesised
// ============================================================
//
// The three onsets of Step 4 (FACTS 34 to 37), each 1.6 s on A3, as the
// toy draws and plays them (FACTS 75). Synthesised illustrations, not
// recordings of a voice:
//
// - Air first: band-passed noise, the "h", for 0.35 s, with the note rising
//   under it from 0.25 s over 0.25 s, as the folds close into vibration.
// - A catch: the folds pressed shut, 0.15 s of silence, a 3 ms click, then
//   the note at full level within 10 ms.
// - Together: the note rising over 60 ms, no noise and no click, the folds
//   meeting the air just as it starts to flow.
//
// Pure timing and words here (starts.test.ts); toy-starts.ts draws the
// folds and the trace from them, and `playStart` sounds them.

import { smooth } from '@/features/lessons/kit/dom'
import { A3, hz } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { playNoise, Sound } from '@/features/lessons/kit/sound'

export type Start = 'air' | 'catch' | 'together'

export const STARTS: readonly Start[] = ['air', 'catch', 'together']

/** Seconds of each start, and of the trace strip across. */
export const START_SEC = 1.6

/** Air first: the "h" ends at 0.35 s; the note rises from 0.25 s over 0.25 s. */
export const AIR = { until: 0.35, noteAt: 0.25, rise: 0.25 } as const
/** A catch: silence until 0.15 s, a 3 ms click, then the note at full level within 10 ms. */
export const CATCH = { at: 0.15, click: 0.003, rise: 0.01 } as const
/** Together: the note rises over 60 ms from the start. */
export const TOGETHER_RISE = 0.06

/** The wave's height `t` seconds into a start: the note's level, 0 to 1. */
export function waveAt(s: Start, t: number): number {
  if (s === 'air') return smooth(AIR.noteAt, AIR.noteAt + AIR.rise, t)
  if (s === 'catch') {
    const from = CATCH.at + CATCH.click
    return smooth(from, from + CATCH.rise, t)
  }
  return smooth(0, TOGETHER_RISE, t)
}

/** Whether air with no note runs `t` seconds in: the fine dots, air first only. */
export const airAt = (s: Start, t: number): boolean =>
  s === 'air' && t >= 0 && t < AIR.until

/** The catch's mark, seconds in, or null for a start with none. */
export const markOf = (s: Start): number | null =>
  s === 'catch' ? CATCH.at : null

/** The gold tick where air and sound begin at once: together's start, or null. */
export const tickOf = (s: Start): number | null => (s === 'together' ? 0 : null)

/** The folds as the figure draws them. */
export interface FoldsPose {
  /** How far apart at the back: 1 apart for breathing, 0 together. */
  readonly open: number
  /** Vibrating: the note sounds. */
  readonly vibrating: boolean
  /** Pressed shut, with the heavier stroke: a catch before its click. */
  readonly pressed: boolean
  /** An arrow of air between them. */
  readonly air: boolean
}

const APART: FoldsPose = {
  open: 1,
  vibrating: false,
  pressed: false,
  air: false,
}

/** The folds `t` seconds into a start; apart, breathing, with none playing. */
export function foldsAt(s: Start | null, t: number): FoldsPose {
  if (s === null || t < 0) return APART
  if (s === 'air')
    return {
      open: 1 - smooth(AIR.noteAt, AIR.noteAt + AIR.rise, t),
      vibrating: t >= AIR.noteAt,
      pressed: false,
      air: t < AIR.until,
    }
  if (s === 'catch') {
    const shut = t < CATCH.at + CATCH.click
    return { open: 0, vibrating: !shut, pressed: shut, air: false }
  }
  // together: a slit as the air starts, closing as the note grows
  return {
    open: 0.12 * (1 - smooth(0, TOGETHER_RISE, t)),
    vibrating: true,
    pressed: false,
    air: false,
  }
}

/** Each start's words: its button's name, the polite line after it plays, and the trace's summary. */
export const START_WORDS: Readonly<
  Record<Start, { readonly name: string; readonly summary: string }>
> = {
  air: {
    name: 'Air first: a puff of air, then the note',
    summary:
      'Air first: fine dots of air with no note for about a third of a second, then the wave grows as the folds close',
  },
  catch: {
    name: 'A catch: the folds pressed shut, a click, then the note',
    summary:
      'A catch: a short silence with the folds pressed shut, a mark at the click, then the wave at full height at once',
  },
  together: {
    name: 'Together: the air and the note start at once',
    summary:
      'Together: the wave starts at once and grows smoothly, with a gold tick where the air and the sound begin together',
  },
}

/** The trace before any start: an empty strip. */
export const TRACE_IDLE =
  'The trace of a start: empty until you play one. The height of the wave is the level; fine dots are air with no note; a short mark is the catch'

/** Sounds a start on A3 (FACTS 75), silent unless `audible`; the note, to stop it early. */
export function playStart(s: Start, audible: boolean): Voice | null {
  if (!audible) return null
  const f = hz(A3)
  if (s === 'air') {
    // breath through an open mouth: an "h", then the note rising under it
    playNoise({
      dur: AIR.until,
      gain: 0.07,
      band: { hz: 1500, q: 0.7 },
      attack: 0.04,
      release: 0.1,
    })
    return Sound.voice(f, {
      kind: 'merc',
      at: AIR.noteAt,
      attack: AIR.rise,
      dur: START_SEC,
    })
  }
  if (s === 'catch') {
    playNoise({
      dur: CATCH.click,
      gain: 0.12,
      attack: 0.0005,
      release: 0.002,
      at: CATCH.at,
    })
    return Sound.voice(f, {
      kind: 'merc',
      at: CATCH.at + CATCH.click,
      attack: CATCH.rise,
      dur: START_SEC,
    })
  }
  return Sound.voice(f, { kind: 'merc', attack: TOGETHER_RISE, dur: START_SEC })
}
