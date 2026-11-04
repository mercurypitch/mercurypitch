// ============================================================
// Lesson 5 one hold — Listen · Breathe · Sing, then the reading
// ============================================================
//
// One take of a hold (WEB-SPEC, Toys 6, state 6), on the kit's hold run
// (kit/hold-run.ts). Listen: Merc sings the note for 2.0 s, the singing
// Merc in `sing`, the other listening. Breathe: the ring breathes once over
// 2 s from the end of his note, and nothing counts down. Sing: the ring
// turns and closes over the hold while the violet line draws on a fixed
// 10- or 15-second frame, folded into Merc's octave, and Merc and Tavi both
// listen.
//
// The take opens 0.4 s after Merc's note ends, once his "ooh" and its
// release have died away, during the Breathe ring (FACTS 56, 65). It waits
// up to 6 s from opening for the first voiced frame, then runs exactly the
// hold's length from it, timed on the frames' own clock; it ends sooner
// only if the voice stops for more than a second. Nothing on the page
// extends it, and nothing plays while it is open (`Sound.hush`). The
// reading comes from the kit's hold reader (kit/hold-take.ts), loaded with
// the listener after Start.

import type { HoldModule } from '@/features/lessons/kit/hold-run'
import type { HoldContext as KitContext } from '@/features/lessons/kit/hold-run'
import { holdOne as runHold } from '@/features/lessons/kit/hold-run'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import { hz, sharpOf, wordName } from '@/features/lessons/kit/notes'
import { playTone } from '@/features/lessons/kit/sound'
import type { SingView } from './sing-view'

export type { HoldModule, ListenModule } from '@/features/lessons/kit/hold-run'
export {
  bandWords,
  BREATHE_SEC,
  GAP_SEC,
} from '@/features/lessons/kit/hold-run'

/** Seconds of Merc's note. */
export const MERC_SEC = 2

/** One take on Lesson 5's card: the kit's, with Merc's note as its Listen phase. */
export type HoldContext = Omit<KitContext, 'view' | 'listen'> & {
  readonly view: SingView
}

/** One take of a hold: the reading, or null if the take was cancelled. */
export function holdOne(c: HoldContext): Promise<HoldReading | null> {
  return runHold({
    ...c,
    listen: {
      sec: MERC_SEC,
      play: async (audible) => {
        await playTone(hz(c.midi), MERC_SEC, { kind: 'merc', audible })
        return true
      },
    },
  })
}

/** The chart's words after a hold: "Merc's note A3; your line in the band for 8.4 of 10 seconds, ...". */
export function holdSummaryFor(
  reader: HoldModule,
  midi: number,
  r: HoldReading,
): string {
  return reader.holdChartWords(wordName(sharpOf(midi)), r)
}
