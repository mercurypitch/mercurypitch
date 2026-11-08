// ============================================================
// Lesson 21 wrap — the practice card's rest line, and free play
// ============================================================
//
// The practice card is Compose, in Sheet Music, with Ear Lab's Home as its
// second drill, in every version, since neither asks for a voice
// (WEB-SPEC, Practice links; FACTS 58). After "Effortful", "Uncomfortable"
// or "Just listen today" it shows Lesson 8's rest line above its text,
// which puts off only this page's sung line. Sing it's ending is held in
// memory for the visit (kit/comfort.ts `VisitEnding`), never stored, so a
// new visit opens with no rest line.
//
// Free play (Toys 3) is the circle beside the learner's staff again, on a
// card of its own (circle-step.ts): the house anywhere from E flat round to
// A, three flats to three sharps, each move playing the new key's scale at
// the circle's pace, a note every 0.3 s, nothing locked, since the guided
// steps come first. The circle draws while its card is on screen. Its staff
// is the learner's and follows Sing it's voice choice, as the steps' staff
// does, beside a Clef switch of its own. Every move is the page's one
// sound, and the card off screen for 600 ms, or the page hidden, stops what
// it plays (kit/leave.ts).
//
// The tease still (Toys 9) is markup, in the next-lesson card's slot:
// Lesson 5's band with a pitch line waving across both its edges and no
// centre line, which plays nothing.

import { PARTS } from '@/features/lessons/kit/circle-geometry'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { CircleStep } from './circle-step'
import { mountCircleStep } from './circle-step'
import { PACE } from './sounds'
import { learnerClef } from './steps'

/** Mounts free play's circle and staff, nothing locked; hands them back. */
export function initFreePlay(): CircleStep {
  const root = q('#freePlay')
  const free = mountCircleStep(root, {
    active: watch(q('[data-circle-viz]', root)),
    part: PARTS.all,
    pace: PACE.circle,
    clef: learnerClef(),
  })
  // the staff follows Sing it's voice choice at once
  VoiceChoice.subscribe(() => {
    if (free.staff.clef !== learnerClef()) free.setClef(learnerClef())
  })
  onLeave(root, () => {
    free.stop()
  })
  return free
}

export function initWrap(): CircleStep {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
  return initFreePlay()
}
