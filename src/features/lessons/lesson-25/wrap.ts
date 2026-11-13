// ============================================================
// Lesson 25 wrap — the practice card's rest line, and free play
// ============================================================
//
// The practice card is Ear Lab's Gravity in every version, since Gravity
// asks for no voice (WEB-SPEC, Practice links; Toys 5). After "Effortful",
// "Uncomfortable" or "Just listen today" Lesson 12's rest line takes the
// second drill's place, putting off only Sight-Singing, the sung drill.
// Sing it's ending is held in memory for the visit (kit/comfort.ts
// `VisitEnding`), never stored, so a new visit opens on the full card.
//
// Free play (Toys 1, Free play) is the steps' toy again, on a card of its
// own, in its free state: Raise te and Raise le, the chord column, the
// outline, the signature, the Clef switch and every play from the four
// steps (minor-toy.ts `MINOR_STATES.free`). A learner can scroll here
// before the cold open's choice, so it holds back Raise te, Raise le, the
// column and the chord's play under the steps' lock line until the choice
// (`unlock`), and a new visit holds them again (FACTS 36). Its staff is the
// learner's and follows Sing it's voice choice, as the steps' staff does.
// Every play is the page's one sound, and the card off screen for 600 ms,
// or the page hidden, stops what it plays (kit/leave.ts).
//
// The tease still (Toys 8) is markup, in the next-lesson card's slot:
// Lesson 26's opening, "Twinkle"'s two lines in C, which plays nothing.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { MinorToy } from './minor-toy'
import { MINOR_STATES, mountMinorToy } from './minor-toy'
import { clefOf } from './steps'

/** Mounts free play's toy, its held controls waiting for the choice; hands back the toy. */
export function initFreePlay(): MinorToy {
  const root = q('#freePlay')
  const toy = mountMinorToy(root, {
    active: watch(q('[data-beads-canvas]', root)),
    clef: clefOf(VoiceChoice.voice),
    state: MINOR_STATES.free,
  })
  // the toy follows Sing it's voice choice at once
  VoiceChoice.subscribe((v) => toy.setClef(clefOf(v)))
  onLeave(root, () => {
    toy.stop()
  })
  // a play pressed with the figures scrolled away above the screen brings
  // them back into view, so what it lights is seen as it sounds: on a
  // phone the card's plays run on for more than a screen under them
  const figs = q('.minor-figs', root)
  for (const b of qa<HTMLButtonElement>('[data-minor-play]', root))
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
export function initWrap(): { readonly free: MinorToy } {
  const card = q('#practiseCard')
  const rest = q('[data-ending="rest"]', card)
  const practise = q('[data-ending="practise"]', card)
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
    practise.hidden = ending === 'rest'
  })
  return { free: initFreePlay() }
}
