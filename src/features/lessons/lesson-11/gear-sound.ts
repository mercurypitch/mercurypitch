// ============================================================
// Lesson 11 gear sound — a line in Merc's two gears, as one run
// ============================================================
//
// The gear model's sound (WEB-SPEC, Audio; FACTS 74): a line is two of the
// kit's contour voices on one pitch path, started in one task so their
// pitches and Merc's vibratos move together. The lower gear is Merc's "ooh";
// the upper gear is Merc's voice with the soft tone's partials, trimmed so
// the switch is heard as a change of colour, not of loudness. Both pass
// through Lesson 7's "ng" (kit/timbre.ts). A gear silent all the way is
// never built. The two are one run, so the page's one sound owner starts
// and stops them together, and the run is heard only when both are.

import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLine } from '@/features/lessons/kit/run'
import { NG } from '@/features/lessons/kit/timbre'
import type { GearLine } from './lines'
import { gearContours, sounds, UPPER_TRIM } from './lines'

/** The kit's level for Merc's "ooh" (kit/sound.ts), the lower gear's. */
export const LOWER_GAIN = 0.2

/** Sings `line` in its two gears; `audible` is decided once, at the tap. */
export function playGears(line: GearLine, audible: boolean): Run {
  const { lower, upper } = gearContours(line)
  const runs: Run[] = []
  if (sounds(lower))
    runs.push(
      playLine(lower, { audible, kind: 'merc', gain: LOWER_GAIN, timbre: NG }),
    )
  if (sounds(upper))
    runs.push(
      playLine(upper, {
        audible,
        kind: 'merc',
        wave: 'soft',
        gain: LOWER_GAIN * UPPER_TRIM,
        timbre: NG,
      }),
    )
  return allOf(runs)
}
