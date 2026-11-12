// ============================================================
// Lesson 20 Sing it chart — the run's beads over the take's 0.75 s slots
// ============================================================
//
// Sing it's chart (WEB-SPEC, Toys 6, state 2): the run chart
// (run-chart.ts) in `#singChart`, the pressed run's beads, nine or seven,
// over 0.75 s slots, faint until Merc sings, each named by its syllable
// while it glows; its window from a semitone under do to a semitone over
// the run's top, 11 semitones or 9. It is the kit's sung chart
// (kit/ladder-take.ts `SingChart`): the take draws the live line on its
// band chart and lights each landed bead's edge; Merc's run, the faster
// pass and the guide's sweep light the beads through `play`, and a play
// keeps the edges the last take lit, its line gone (state 8). Do is the
// voice's, D3 or Tavi's D4, moved by Move do, and the chart follows a
// voice chosen anywhere; its summary says where do is ("Do is D3").

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { LadderId } from '@/features/lessons/kit/ladder-flow'
import type { PhraseDrawing, SingChart, } from '@/features/lessons/kit/ladder-take'
import { majorScale } from '@/features/lessons/kit/major-scale'
import { wordName } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { RunChart } from './run-chart'
import { mountRunChart } from './run-chart'
import { runDo, RUNS, SING_SLOT_SEC } from './sounds'

/** The live frame's summary: where do is, in the key's spelling. */
export const liveSaid = (doMidi: number): string =>
  `Do is ${wordName(majorScale(doMidi)[0])}`

export interface RunSingChart extends SingChart {
  /** The run chart under it, for the page's tests. */
  readonly run: RunChart
  /** The run the chart shows. */
  readonly ladder: LadderId
}

export function mountSingChart(root: HTMLElement): RunSingChart {
  let voice: Voice = VoiceChoice.voice ?? 'lower'
  let shift = 0
  let ladder: LadderId = 'full'
  const run = mountRunChart(root, {
    active: watch(q('canvas', root)),
    doMidi: runDo(voice) + shift,
    names: false,
    faint: true,
  })
  run.setTempo(SING_SLOT_SEC)

  /** The live frame: the run's beads at rest, no line, no lit edge, the summary. */
  function live(): void {
    run.keep(null)
    run.follow(null)
    run.rest()
    run.chart.scene.head = null
    run.describe(liveSaid(run.doMidi))
  }

  function follow(): void {
    run.setDo(runDo(voice) + shift)
    live()
  }

  VoiceChoice.subscribe((v) => {
    const next = v ?? 'lower'
    if (next === voice) return
    voice = next
    follow()
  })
  live()

  return {
    run,
    get chart() {
      return run.chart
    },
    get doMidi() {
      return run.doMidi
    },
    get ladder() {
      return ladder
    },
    showLive(id) {
      ladder = id
      run.setDegrees(RUNS[id])
      live()
    },
    move(next) {
      shift = next
      follow()
    },
    play(phrase): PhraseDrawing {
      // the edges the last take lit stay through the play's own repaints,
      // and its line goes: a play draws none, nothing listening (state 8)
      run.keep((run.chart.scene.rungs ?? []).map((r) => r.lit === true))
      run.follow(null)
      let playing = true
      return {
        note(i) {
          const n = phrase.notes[i]
          if (playing && n !== undefined) run.glow(i, n.dur)
        },
        end() {
          playing = false
        },
        cancel() {
          if (!playing) return
          playing = false
          run.rest()
        },
      }
    },
  }
}
