// ============================================================
// Lesson 10 pattern — Step 4's chord broken into quavers, one at a time
// ============================================================
//
// Step 4's Play the pattern (WEB-SPEC, Toys 1, Pattern): root, fifth,
// third, fifth, four times over in quavers, each sounding nine tenths of
// its length, then the chord together for 1.0 s: 7.857 s at Slow's 70
// crotchets a minute, 4.0 s at Fast's 160 (FACTS 42, 76). A change of Slow
// · Fast or Major · Minor while it plays takes effect from the next quaver,
// so the player books one quaver at a time: each starts as one of the
// kit's runs on what is set as it starts, and books the next one quaver of
// its own tempo later. Every quaver is timed from the press, so late timers
// never drift the pattern. sounds.ts gives each quaver's note and the chord
// (`patternSound`, from the quaver it plays), so every note, length and
// level is FACTS 76's and 81's.
//
// The player is itself a run (kit/run.ts): `done` is true once the chord
// has ended by itself and false when it was stopped, and an audible one
// stops when every sound stops (the Sound switch, the hush, a hidden page),
// between two quavers as well as during one. A silent one plays on, its
// visuals with it, as the kit's silent runs do.

import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { onStopAll } from '@/features/lessons/kit/sound'
import type { Quality } from './chords'
import type { Tempo } from './sounds'
import { PATTERN, patternSound, QUAVER } from './sounds'

/** What the pattern plays: read as each quaver starts. */
export interface PatternSet {
  readonly root: number
  readonly quality: Quality
  readonly tempo: Tempo
}

export interface PatternOptions {
  /** Decided once, at the press, so the pattern is all sound or all silent. */
  readonly audible: boolean
  /** What is set now. */
  readonly set: () => PatternSet
  /** Hears each note as it starts. */
  readonly onNote?: (n: RunNote) => void
}

// The audible patterns in flight, each stopped when every sound stops. One
// listener serves them all, as in kit/run.ts: `onStopAll` keeps every
// listener it is given.
const sounding = new Set<Run>()
onStopAll(() => {
  sounding.forEach((r) => r.stop())
})

/** Quaver `i`'s note (0 to 15), or the chord after the last (16), on what is set. */
export function patternPart(s: PatternSet, i: number): RunNote[] {
  const rest = patternSound(s.root, s.quality, s.tempo, i)
  return i < PATTERN.length ? rest.slice(0, 1) : rest
}

/** Plays the pattern from its first quaver, each quaver on what is set as it starts. */
export function playPattern(o: PatternOptions): Run {
  const start = performance.now()
  let part: Run | null = null
  let timer = 0
  let over = false
  // when the next quaver starts, seconds from the press
  let next = 0
  let settle: (heard: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })

  function end(heard: boolean): void {
    if (over) return
    over = true
    sounding.delete(run)
    window.clearTimeout(timer)
    settle(heard)
  }

  function play(i: number): void {
    const s = o.set()
    const r = playNotes(patternPart(s, i), {
      audible: o.audible,
      kind: 'soft',
      onNote: (n) => o.onNote?.(n),
    })
    part = r
    if (i === PATTERN.length) {
      void r.done.then((heard) => {
        if (part === r) end(heard)
      })
      return
    }
    next += QUAVER[s.tempo]
    timer = window.setTimeout(
      () => play(i + 1),
      Math.max(0, start + next * 1000 - performance.now()),
    )
  }

  const run: Run = {
    done,
    stop() {
      if (over) return
      part?.stop()
      end(false)
    },
  }
  if (o.audible) sounding.add(run)
  play(0)
  return run
}
