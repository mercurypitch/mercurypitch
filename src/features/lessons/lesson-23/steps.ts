// ============================================================
// Lesson 23 steps — four steps, one staff toy in its interval state
// ============================================================
//
// Every step shows the one staff toy (`toyFor: () => 1`), the kit's in its
// interval state (kit/staff-interval.ts), each step in its own state
// (WEB-SPEC, Toys 1; sounds.ts `STEP_STATE`): the learner's staff and the
// pitch line side by side, C at the foot, the top note to move; Fold from
// Step 3, and in Step 4 the B lane below the foot and Curl into a ring. The
// staff is the learner's, the bass clef for the lower voice or none
// stored, the treble for the higher, and it follows Sing it's voice choice
// at once. Each step's own plays are in the one toy, each marked with the
// steps it shows on (`data-part`; kit/step-parts.ts), so no two controls on
// the stage share a name. The figure's label, which parts show and the
// toy's state follow the step, through the deck's `onStep`, whatever the
// route: opening a state stops what the toy plays.
//
// Until the cold open's choice the toy holds back what would answer it
// (its own Sharp, Flat, Fold and Curl, and the black-key lanes), and so do
// the plays of Steps 2 to 4, which would sound F♯ and G♭ and fold the
// fifth into 7 and 5; Step 1's two plays answer nothing and stay open
// (FACTS 1a). The choice reaches the toy through `unlockSteps`, which the
// cold open's predict calls (`onChoice`). Each play is one run on the toy,
// its button lit while it sounds (kit/play-lights.ts); every sound is the
// page's one (`NowPlaying`).

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { IntervalToy } from '@/features/lessons/kit/staff-interval'
import { mountIntervalStaff } from '@/features/lessons/kit/staff-interval'
import { clefForVoice } from '@/features/lessons/kit/staff-places'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { HELD_PLAYS, STEP_PLAYS, STEP_STATE } from './sounds'

/** Each step's figure label: none names a note, a size or the tritone (FACTS 1a). */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> An interval\'s two names',
  2: '<span class="fig">Fig. 2</span> Perfect intervals',
  3: '<span class="fig">Fig. 3</span> An interval upside down',
  4: '<span class="fig">Fig. 4</span> The ring of twelve',
}

/** The learner's clef: the bass for the lower voice, or none stored, and the treble for the higher. */
export const learnerClef = () =>
  VoiceChoice.voice === null ? 'bass' : clefForVoice(VoiceChoice.voice)

export interface Steps {
  readonly toy: IntervalToy
  /** The cold open's choice is in: the toy and the held plays are offered. */
  unlock(): void
}

/** Each play button inside `root` plays its pairs on `toy`, lit while they sound; a held one waits. */
export function bindIntervalPlays(
  root: HTMLElement,
  toy: IntervalToy,
  light: PlayLight = playLights(),
): void {
  for (const b of qa<HTMLButtonElement>('button[data-iv-play]', root)) {
    const play = STEP_PLAYS[b.dataset.ivPlay ?? '']
    if (play !== undefined)
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return
        light(b, toy.play(play))
      })
  }
}

/**
 * Mounts the stage's staff toy, held back until the choice, and follows the
 * deck: called before `deck.start()`, so an address that names a step
 * opens it.
 */
export function initSteps(): Steps {
  const root = q('#toyStaff')
  const label = q('[data-fig-label]', root)
  const toy = mountIntervalStaff(root, {
    state: STEP_STATE[1],
    owner: NowPlaying,
    clef: learnerClef(),
    locked: true,
  })
  bindIntervalPlays(root, toy)
  // the staff follows Sing it's voice choice at once
  VoiceChoice.subscribe(() => toy.setClef(learnerClef()))
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      toy.setState(STEP_STATE[n] ?? STEP_STATE[1])
    },
  })
  return {
    toy,
    unlock() {
      toy.unlock()
      for (const key of HELD_PLAYS)
        for (const b of qa<HTMLButtonElement>(`[data-iv-play="${key}"]`, root))
          b.removeAttribute('aria-disabled')
    },
  }
}
