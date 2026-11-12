// ============================================================
// Lesson 20 Sing it — Merc's run, sung back a bead at a time
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6) is the kit's sung ladder
// (kit/ladder-sing.ts, its take kit/ladder-take.ts), Lesson 9's, with the
// run in place of the ladder. This is Lesson 20's plan for it: its
// consumer id with the microphone's owner and its warm-up key; the run's
// beads in their live frame (sing-chart.ts); the run, do re mi so la so
// mi re do, or the smaller run, do re mi so mi re do, with their reading
// lines' labels (FACTS 50, 58); Merc, or Tavi, singing them a note every
// 0.75 s, each slot of the take as long, read with a 0.15 s attack and
// 0.45 s of steady voice, the lab's to tune (FACTS 56); Move do higher
// only, three semitones for the lower voice and four for the higher
// (FACTS 52); the faster pass at 0.45 s a note (FACTS 63); and, with no
// microphone, the guide's sweep after Merc's run (state 9). The card's
// lines and the Again buttons' names are run-flow.ts's. Its markup is
// Lesson 20's own.

import type { LadderId } from '@/features/lessons/kit/ladder-flow'
import type { LadderSing, LadderSingPlan, } from '@/features/lessons/kit/ladder-sing'
import { initLadderSing } from '@/features/lessons/kit/ladder-sing'
import { AGAIN_NAMES, RUN_LINES } from './run-flow'
import type { RunSingChart } from './sing-chart'
import { mountSingChart } from './sing-chart'
import { FASTER_SEC, runNotes, RUNS, SING_SLOT_SEC } from './sounds'

/** Each run's reading lines' labels, a note each (FACTS 58). */
export const RUN_LABELS: Readonly<Record<LadderId, readonly string[]>> = {
  full: [
    'Do',
    'Re',
    'Mi',
    'So',
    'La',
    'So again',
    'Mi again',
    'Re again',
    'Do again',
  ],
  smaller: ['Do', 'Re', 'Mi', 'So', 'Mi again', 'Re again', 'Do again'],
}

/** Lesson 20's plan for the kit's sung ladder. */
export const SING: LadderSingPlan<RunSingChart> = {
  consumer: 'lesson-20',
  warmupKey: 'fyp-l20-warmup',
  chart: (el) => mountSingChart(el),
  take: {
    notes: (id, doMidi) => RUNS[id].map((d) => doMidi + d),
    labels: RUN_LABELS,
    mercNotes: (id, doMidi) =>
      runNotes(doMidi, SING_SLOT_SEC, SING_SLOT_SEC, RUNS[id]),
    slotSec: SING_SLOT_SEC,
    read: { attackSec: 0.15, steadySec: 0.45 },
    noun: 'run',
  },
  lines: RUN_LINES,
  againNames: AGAIN_NAMES,
  reach: {
    lower: { lower: 0, higher: 3 },
    higher: { lower: 0, higher: 4 },
  },
  faster: {
    mercNotes: (id, doMidi) =>
      runNotes(doMidi, FASTER_SEC, FASTER_SEC, RUNS[id]),
    slotSec: FASTER_SEC,
  },
  sweep: true,
}

export const initSing = (): LadderSing<RunSingChart> => initLadderSing(SING)
