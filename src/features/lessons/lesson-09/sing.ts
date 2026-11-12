// ============================================================
// Lesson 9 Sing it — do-mi-so-do, sung back to Merc a rung at a time
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 4) is the kit's sung ladder
// (kit/ladder-sing.ts, its take kit/ladder-take.ts), which began as this
// page's and moved into the kit with a plan for Lesson 20's run. This is
// Lesson 9's plan for it: its consumer id with the microphone's owner and
// its warm-up key; the ladder chart in its live frame (ladder-chart.ts);
// the two ladders, their notes and their reading lines' labels from the
// ladder data (ladder-data.ts); Merc singing them a rung every 1.5 s
// (sounds.ts), each slot of the take as long, so the reader keeps its own
// attack and steady voice; the card's lines and the Again buttons' names
// (ladder-flow.ts). Its markup is Lesson 9's own.

import type { LadderSing, LadderSingPlan, } from '@/features/lessons/kit/ladder-sing'
import { initLadderSing } from '@/features/lessons/kit/ladder-sing'
import type { LadderChart } from './ladder-chart'
import { mountLadderChart } from './ladder-chart'
import { ladderNotes, LADDERS } from './ladder-data'
import { AGAIN_NAMES, LADDER_LINES } from './ladder-flow'
import { LADDER_NOTE_SEC, mercLadderNotes } from './sounds'

/** Lesson 9's plan for the kit's sung ladder. */
export const SING: LadderSingPlan<LadderChart> = {
  consumer: 'lesson-09',
  warmupKey: 'fyp-l09-warmup',
  chart: (el) => mountLadderChart(el, { state: 'ladder' }),
  take: {
    notes: ladderNotes,
    labels: {
      full: LADDERS.full.map((n) => n.label),
      smaller: LADDERS.smaller.map((n) => n.label),
    },
    mercNotes: mercLadderNotes,
    slotSec: LADDER_NOTE_SEC,
    noun: 'ladder',
  },
  lines: LADDER_LINES,
  againNames: AGAIN_NAMES,
}

export const initSing = (): LadderSing<LadderChart> => initLadderSing(SING)
