// ============================================================
// Ladder guide — Merc's ladder, and the guide lighting each note after him
// ============================================================
//
// What the kit's sung ladder card (ladder-sing.ts) plays with nothing
// listening. Play Merc's ladder sings the pressed ladder in the chosen
// voice, each note lighting on the chart as he sings it, his figure singing
// along (`mercLadder`). Two of Lesson 20's options add to it (its WEB-SPEC,
// Toys 6, states 8 and 9). With no microphone, on a plan with the sweep,
// Merc's ladder ends with the guide lighting each note in turn at the
// take's own pace, after the take's gap, so a learner can sing along. And
// the faster pass, Again, faster (`fasterPass`): Merc's ladder last sung at
// the plan's faster pace, the count-in on do (move-do.ts `COUNT_IN`), then
// the guide at that pace. The guide sounds nothing: it is a drawing of its
// own on the chart, a slot a note, each lit as its slot begins. A play run
// to its end ends the drawing showing, one stopped part way cancels it, and
// either way Merc rests.

import type { LadderId } from './ladder-flow'
import type { PhraseDrawing, SingChart } from './ladder-take'
import type { Which } from './merc-duo'
import { mercSing } from './merc-duo'
import { COUNT_IN, COUNT_IN_SEC } from './move-do'
import type { Run, RunNote } from './run'
import { allOf, playNotes } from './run'

/** The faster pass's pace: Merc's ladder at it, and the guide's slots after the count-in. */
export interface FasterPlan {
  /** Merc's ladder from do at the faster pace: a note a slot. */
  readonly mercNotes: (id: LadderId, doMidi: number) => RunNote[]
  /** Seconds of each of the guide's slots. */
  readonly slotSec: number
}

/** The quiet before the no-microphone sweep: the take's own gap after Merc (ladder-take.ts `TAKE`). */
export const SWEEP_GAP_SEC = 0.4

/**
 * The guide's sweep from `at` seconds: a slot a note of `notes`, each its
 * note's pitch for the drawing to light, silent.
 */
export const sweepNotes = (
  notes: readonly RunNote[],
  at: number,
  slotSec: number,
): RunNote[] =>
  notes.map((n, i) => ({ t: at + i * slotSec, midi: n.midi, dur: slotSec }))

/** Seconds from a run's start to the end of its last note. */
export const endOf = (notes: readonly RunNote[]): number =>
  notes.reduce((end, n) => Math.max(end, n.t + n.dur), 0)

/** What the plays need of the card's chart: do, and a phrase drawn on it. */
export type GuideChart = Pick<SingChart, 'doMidi' | 'play'>

/** Who sings, and whether it sounds: decided once, as a run is all sound or all silent. */
export interface PlayVoice {
  readonly which: Which
  readonly audible: boolean
}

/** A play on the card: Merc's ladder, and the guide after him. */
export interface GuidedPlay {
  /** Settles as it ends: true when it ran to its end, false when stopped. */
  readonly done: Promise<boolean>
  /** Stops it where it stands: its sound, the drawing showing, Merc at rest. */
  stop(): void
}

/** The guide after Merc: from `at` s, a slot of `slotSec` s a note. */
interface Guide {
  readonly at: number
  readonly slotSec: number
}

/** Merc's `notes` on `chart`, each lit as he sings it; then the count-in note and the guide's sweep, either or both. */
function guided(
  chart: GuideChart,
  notes: readonly RunNote[],
  v: PlayVoice,
  countIn: RunNote | null,
  guide: Guide | null,
): GuidedPlay {
  const drawing = chart.play({ notes })
  const sweep = guide === null ? [] : sweepNotes(notes, guide.at, guide.slotSec)
  let swept: PhraseDrawing | null = null
  let midi: number | null = null
  let sung = false
  let over = false

  function rest(): void {
    if (midi !== null) mercSing(v.which, midi, false)
    midi = null
  }

  /** Merc has finished: his drawing ends and he rests, before the count-in or the guide. */
  function mercDone(): void {
    if (sung) return
    sung = true
    drawing.end()
    rest()
  }

  const runs: Run[] = [
    playNotes(countIn === null ? notes : [...notes, countIn], {
      audible: v.audible,
      onNote: (n, i) => {
        if (over) return
        if (i >= notes.length) {
          // the count-in: Merc has finished
          mercDone()
          return
        }
        drawing.note(i)
        midi = n.midi
        mercSing(v.which, n.midi, true)
      },
    }),
  ]
  if (sweep.length > 0)
    runs.push(
      playNotes(sweep, {
        audible: false,
        onNote: (_n, i) => {
          if (over) return
          if (i === 0) {
            mercDone()
            swept = chart.play({ notes: sweep })
          }
          swept?.note(i)
        },
      }),
    )
  const run = runs.length === 1 ? runs[0] : allOf(runs)

  function finish(whole: boolean): void {
    if (over) return
    over = true
    // the guide's drawing once it began, else Merc's while he still sings
    const last = swept ?? (sung ? null : drawing)
    if (whole) last?.end()
    else last?.cancel()
    rest()
  }
  return {
    done: run.done.then((whole) => {
      finish(whole)
      return whole
    }),
    stop() {
      run.stop()
      finish(false)
    },
  }
}

/** Play Merc's ladder: `notes`, each lit as he sings it; with `sweepSlot`, the guide's sweep at that pace after the take's gap. */
export const mercLadder = (
  chart: GuideChart,
  notes: readonly RunNote[],
  v: PlayVoice,
  sweepSlot: number | null,
): GuidedPlay =>
  guided(
    chart,
    notes,
    v,
    null,
    sweepSlot === null
      ? null
      : { at: endOf(notes) + SWEEP_GAP_SEC, slotSec: sweepSlot },
  )

/** Again, faster: `ladder` from the chart's do at the plan's pace, the count-in on do, then the guide at that pace. */
export function fasterPass(
  chart: GuideChart,
  plan: FasterPlan,
  ladder: LadderId,
  v: PlayVoice,
): GuidedPlay {
  const doMidi = chart.doMidi
  const notes = plan.mercNotes(ladder, doMidi)
  const end = endOf(notes)
  const count: RunNote = {
    t: end,
    midi: doMidi,
    dur: COUNT_IN.note,
    kind: 'soft',
    gain: COUNT_IN.gain,
  }
  return guided(chart, notes, v, count, {
    at: end + COUNT_IN_SEC,
    slotSec: plan.slotSec,
  })
}
