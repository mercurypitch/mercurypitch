// ============================================================
// Warm-up — Merc's sigh and slide, the voice lessons' optional minute
// ============================================================
//
// Lesson 3's warm-up, which every voice lesson shares (Lesson 3 FACTS 37
// and 46a; Lesson 5 FACTS 53 and 77): three sighs, a quiet "hoo" sliding
// down, then, if the viewer likes, lip trills, a hum or a soft "oo". Merc
// shows the shape in the chosen voice: the sigh glides down a fifth to the
// voice's A (E4 to A3, or E5 to A4), the slide goes up to that E and back.
// The page says "Follow the shape, not Merc's notes": E4 is the top of the
// app's bass preset. Nothing listens and nothing is scored (REQ-GVC-074,
// REQ-GVC-075). Promoted from Lesson 3's checkpoint, which plays it
// unchanged.

import { hz } from './notes'
import type { ContourPoint } from './sound'
import { contourOf } from './sound'
import type { Voice } from './voice-choice'
import { homeOf } from './voice-choice'

export type WarmUp = 'sigh' | 'slide'

/** The warm-up's demonstration in a voice, as one sung line. */
export function warmUpContour(kind: WarmUp, v: Voice): ContourPoint[] {
  const a = homeOf(v)
  const e = a + 7
  if (kind === 'sigh')
    return contourOf(hz(e), [{ glide: 1.5, to: hz(a), level: 0.7 }])
  return contourOf(hz(a), [
    { hold: 0.3 },
    { glide: 1, to: hz(e) },
    { hold: 0.3 },
    { glide: 1, to: hz(a) },
    { hold: 0.3 },
  ])
}
