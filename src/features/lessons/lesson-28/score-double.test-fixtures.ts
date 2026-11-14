// ============================================================
// Lesson 28 score double — every score the page mounts, its scenes and its clocks, moved by the test
// ============================================================
//
// A test that drives Lesson 28's staffs swaps the kit's score (kit/score.ts)
// for this double, so it sees each scene the page shows and how much of it
// is written, what is lit, the view, and each play's clock, which the test
// moves (`beat`, a frame at that beat) and ends (`end`). Nothing is drawn
// and nothing is timed; a new play ends the one before, as the kit's does.
// The kit's own tests draw the score (kit/score.test.ts). The test file
// names the swap itself, since a mock is the test file's own:
//
//   vi.mock('@/features/lessons/kit/score', async () =>
//     (await import('./score-double.test-fixtures')).scoreDouble,
//   )
//
// Only types come from kit/score.ts, so the swap's factory can load this
// file before the module it replaces.

import type { Run } from '@/features/lessons/kit/run'
import type { Score, ScoreOptions, ScorePlay, ScoreView, } from '@/features/lessons/kit/score'
import type { ScoreScene } from '@/features/lessons/kit/score-layout'

/** A scene the page showed, and how many beats of it were written. */
export interface ShownScene {
  readonly scene: ScoreScene
  readonly written: number
}

/** A play's clock on a score: what the page asked for, and the test's controls. */
export interface ClockDouble {
  readonly p: ScorePlay
  /** True once it has ended either way. */
  over: boolean
  /** True once the page stopped it, or the test ended it unheard. */
  stopped: boolean
  /** A frame at `beat`, from the scene's start, as the score's clock hears it. */
  beat(beat: number): void
  /** Ends it as the kit's clock does: run to its end (true), or cut short (false). */
  end(heard: boolean): void
}

export interface ScoreDouble extends Score {
  readonly figure: HTMLElement
  readonly options: ScoreOptions
  /** Every scene shown, in order. */
  readonly shown: ShownScene[]
  /** Every beat the page lit by hand (`at`), in order. */
  readonly lit: (number | null)[]
  readonly clocks: ClockDouble[]
  /** The scene showing now. */
  readonly last: ShownScene | undefined
}

/** Every score mounted since the last `resetScores`, in order. */
export const scores: ScoreDouble[] = []

export const resetScores = (): void => {
  scores.length = 0
}

function mountScore(
  figure: HTMLElement,
  options: ScoreOptions = {},
): ScoreDouble {
  figure.classList.add('sc')
  const shown: ShownScene[] = []
  const lit: (number | null)[] = []
  const clocks: ClockDouble[] = []
  let view: ScoreView = 'staffs'
  const score: ScoreDouble = {
    figure,
    options,
    shown,
    lit,
    clocks,
    get last() {
      return shown[shown.length - 1]
    },
    show(scene, written = Number.POSITIVE_INFINITY) {
      shown.push({ scene, written })
    },
    write: () => undefined,
    at(beat) {
      lit.push(beat)
    },
    setView(next) {
      view = next
    },
    play(p): Run {
      for (const c of clocks) c.end(false)
      let settle: (heard: boolean) => void = () => undefined
      const done = new Promise<boolean>((resolve) => {
        settle = resolve
      })
      const clock: ClockDouble = {
        p,
        over: false,
        stopped: false,
        beat(b) {
          p.onBeat?.(b)
        },
        end(heard) {
          if (clock.over) return
          clock.over = true
          if (!heard) clock.stopped = true
          settle(heard)
        },
      }
      clocks.push(clock)
      return {
        done,
        stop: () => {
          clock.end(false)
        },
      }
    },
    get view() {
      return view
    },
    get scene() {
      return shown[shown.length - 1]?.scene ?? null
    },
    get drawing() {
      return null
    },
  }
  scores.push(score)
  return score
}

/** The kit's score mount, as a double: the factory of a `vi.mock` of kit/score.ts. */
export const scoreDouble = { mountScore }
