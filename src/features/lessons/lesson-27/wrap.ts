// ============================================================
// Lesson 27 wrap — the practice card's rest version, and free play
// ============================================================
//
// The practice card is Lesson 12's form (WEB-SPEC, Practice links; FACTS
// 69, 70): Chord Stacker, the drill that asks for the voice, with Lesson
// 12's care lines, then Stack, which asks for none. After "Effortful",
// "Uncomfortable" or "Just listen today" Lesson 12's rest version takes
// Chord Stacker's place, naming it, and Stack stays. Sing it's ending is
// held in memory for the visit (kit/comfort.ts `VisitEnding`), never
// stored, so a new visit opens on the full card.
//
// Free play (Toys 1, Free play) is the steps' toy again, on a card of its
// own, in its free state: chips I and V, Add the seventh, Turn over with
// the bass mark and the position's name, the diagonal while V7 is lit, the
// Clef switch and every play from the four steps (ring-toy.ts
// `RING_STATES.free`). A learner can scroll here before either choice, so
// it holds back the V chip, V's seventh, the diagonal and V7's plays under
// the steps' lock line until the cold open's choice (`unlock`), and Turn
// over under "Choose an answer in Step 4 to unlock this." until Step 4's
// (`unlock4`); a new visit holds them again (FACTS 1a, 1b, 39). Its staff
// is the learner's and follows Sing it's voice choice, as the steps' staff
// does. Every play is the page's one sound, and the card off screen for
// 600 ms, or the page hidden, stops what it plays (kit/leave.ts).
//
// The tease still (Toys 8) is markup, in the next-lesson card's slot:
// Lesson 28's opening, its two lines of ten bars, which plays nothing.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { RingToy } from './ring-toy'
import { mountRingToy, RING_STATES } from './ring-toy'
import { clefOf } from './steps'

/** Mounts free play's toy, its held controls waiting for the choices; hands back the toy. */
export function initFreePlay(): RingToy {
  const root = q('#freePlay')
  const toy = mountRingToy(root, {
    active: watch(q('[data-ring-canvas]', root)),
    clef: clefOf(VoiceChoice.voice),
    state: RING_STATES.free,
  })
  // the toy follows Sing it's voice choice at once
  VoiceChoice.subscribe((v) => toy.setClef(clefOf(v)))
  onLeave(root, () => {
    toy.stop()
  })
  // a play pressed with the figures scrolled away above the screen brings
  // them back into view, so what it lights is seen as it sounds: on a
  // phone the card's plays run on for more than a screen under them
  const figs = q('[data-ring-figs]', root)
  for (const b of qa<HTMLButtonElement>('[data-ring-play]', root))
    b.addEventListener('click', () => {
      if (figs.getBoundingClientRect().top < 0)
        figs.scrollIntoView({
          behavior: reducedMotion() ? 'instant' : 'smooth',
          block: 'start',
        })
    })
  return toy
}

/** The practice card in the version Sing it's ending picks, and free play. */
export function initWrap(): { readonly free: RingToy } {
  const card = q('#practiseCard')
  const rest = q('[data-ending="rest"]', card)
  const practise = q('[data-ending="practise"]', card)
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
    practise.hidden = ending === 'rest'
  })
  return { free: initFreePlay() }
}
