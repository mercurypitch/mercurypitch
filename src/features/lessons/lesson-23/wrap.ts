// ============================================================
// Lesson 23 wrap — the practice card's rest line, and free play
// ============================================================
//
// The practice card is Ear Lab's Leap in every version, since Leap asks
// for no voice (WEB-SPEC, Practice links; Toys 5). After "Effortful",
// "Uncomfortable" or "Just listen today" it shows Lesson 8's rest line
// above its text, which puts off only this page's sung line. Sing it's
// ending is held in memory for the visit (kit/comfort.ts `VisitEnding`),
// never stored, so a new visit opens with no rest line.
//
// Free play (Toys 1, state 5) is the staff toy again in its interval
// state, on a card of its own (sounds.ts `FREE_STATE`): every control from
// the start, Sharp and Flat, Fold and Curl into a ring among them, and all
// thirteen lanes drawn, whether or not the cold open's choice was made, with
// no reveal or quiz attached. Its staff is the learner's and follows Sing
// it's voice choice, as the steps' staff does, beside a Clef switch of its
// own; the pitch-line switch is the page's one switch. Every move is the
// page's one sound, and the card off screen for 600 ms, or the page
// hidden, stops what it plays (kit/leave.ts).
//
// The tease still (Toys 8) is markup, in the next-lesson card's slot:
// Lesson 24's stage, a drone band and a thin line above it, which plays
// nothing.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { IntervalToy } from '@/features/lessons/kit/staff-interval'
import { mountIntervalStaff } from '@/features/lessons/kit/staff-interval'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { FREE_STATE } from './sounds'
import { learnerClef } from './steps'

/** Mounts free play's staff toy, nothing held back; hands back the toy. */
export function initFreePlay(): IntervalToy {
  const root = q('#freePlay')
  const toy = mountIntervalStaff(root, {
    state: FREE_STATE,
    owner: NowPlaying,
    clef: learnerClef(),
  })
  // the staff follows Sing it's voice choice at once
  VoiceChoice.subscribe(() => {
    if (toy.clef !== learnerClef()) toy.setClef(learnerClef())
  })
  onLeave(root, () => {
    toy.stop()
  })
  return toy
}

export function initWrap(): void {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
  initFreePlay()
}
