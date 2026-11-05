// ============================================================
// Lesson 15 steps — five steps, one staff toy
// ============================================================
//
// Every step shows the one staff toy (`toyFor: () => 1`; kit/staff.ts),
// each in its own state (WEB-SPEC, Toys 1; sounds.ts `STEP_STATE`): the
// treble staff's nine places, each letter kept as it plays; the same staff
// with the pitch-line switch to the fore; one note to move through the
// ledger lines; the clef switch, Treble · Bass; and the grand staff over
// the key strip. Each step's own plays are in the one toy, each marked
// with the steps it shows on (`data-part`; kit/step-parts.ts), so no two
// controls on the stage ever share a name. The figure's label, which parts
// show and the toy's state follow the step, through the deck's `onStep`,
// whatever the route (Next or Back, a swipe, the lesson menu, an address
// that names a step, the quiz's step links): opening a state stops what
// the toy plays, and the step showing shown again, as a layout switch
// shows it, stops nothing.
//
// Each play is one run on the toy (sounds.ts `STEP_PLAYS`), its button lit
// while it sounds (kit/play-lights.ts), as Lessons 10 and 12 light theirs.
// Every sound is the page's one (`NowPlaying`): a play anywhere stops it.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import { STEP_PLAYS, STEP_STATE } from './sounds'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The treble staff',
  2: '<span class="fig">Fig. 2</span> One letter, one place',
  3: '<span class="fig">Fig. 3</span> Ledger lines',
  4: '<span class="fig">Fig. 4</span> The treble and bass clefs',
  5: '<span class="fig">Fig. 5</span> The grand staff',
}

/** Each play button inside `root` plays its notes on `toy`, lit while they sound. */
export function bindStaffPlays(
  root: HTMLElement,
  toy: StaffToy,
  light: PlayLight = playLights(),
): void {
  for (const b of qa<HTMLButtonElement>('button[data-staff-play]', root)) {
    const play = STEP_PLAYS[b.dataset.staffPlay ?? '']
    if (play !== undefined)
      b.addEventListener('click', () => {
        light(b, toy.play(play))
      })
  }
}

/**
 * Mounts the stage's staff toy and follows the deck: called before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(): StaffToy {
  const root = q('#toyStaff')
  const label = q('[data-fig-label]', root)
  const toy = mountStaff(root, { state: STEP_STATE[1], owner: NowPlaying })
  bindStaffPlays(root, toy)
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it, and what sounds plays on
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      // the step left keeps nothing sounding, by any route: opening a state
      // stops the toy's play and every note of it still to come
      toy.setState(STEP_STATE[n] ?? STEP_STATE[1])
    },
  })
  return toy
}
