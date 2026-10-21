// ============================================================
// Lesson 6 steps — five steps, one tune line, and Step 4's predict
// ============================================================
//
// Every step shows the one tune line (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): the contour on C; both lines with their gaps;
// the slide with the names switch; Swap sizes; the named intervals. The
// games and the anchor board sit in their steps' text, and stop when the
// viewer leaves the step. Step 4's predict sits in the step text: a guess
// unlocks Play the first line and Play the swapped version, and Swap sizes
// on the stage, which plays the answer too. The reveal waits until both
// have been heard, so it describes what was played, and it never calls a
// guess wrong; the mix-up card, the Try and the Notice, which answer the
// predict as well, come with it.

import { q, qa } from '@/features/lessons/kit/dom'
import type { ModeStore } from '@/features/lessons/kit/names'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { initAnchors } from './anchors'
import { initGames } from './games'
import type { TuneStep, TuneToy } from './tune-toy'
import { mountTuneToy } from './tune-toy'
import type { NamesMode } from './tune-words'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The shape of a tune',
  2: '<span class="fig">Fig. 2</span> Both lines, every gap',
  3: '<span class="fig">Fig. 3</span> Slide the whole tune',
  4: '<span class="fig">Fig. 4</span> Two sizes swapped',
  5: '<span class="fig">Fig. 5</span> The named intervals',
}

export const SWAP_GUESS: Readonly<Record<string, string>> = {
  same: 'You said: yes, most notes are the same',
  changes: 'You said: no, it changes',
}

function initPredict(toy: TuneToy, stage: HTMLElement): void {
  const step = q('#step-4')
  const predict = q('#predictSwap', step)
  mountPredict(predict, {
    play: (what, audible) =>
      what === 'swapped' ? toy.playSwapped(audible) : toy.playLine(audible),
    revealOn: ['line', 'swapped'],
    revealAfter: 'all',
    unlocks: [q<HTMLButtonElement>('[data-tune-swap]', stage)],
    // the predict's own reveal first: its "You said" line is written there
    reveal: [q('.reveal', predict), ...qa('[data-swap-reveal]', step)],
    hints: {
      chosen: 'Locked in. Play both, and watch the line.',
      next: 'Now play the other one.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear them, then press Play the swapped version.',
      again:
        'Play them again, or press Swap sizes: the swapped version stays on the line.',
    },
    guess: (choice) => SWAP_GUESS[choice] ?? 'You said',
  })
}

export function initSteps(
  deck: StepDeck,
  names: ModeStore<NamesMode>,
): TuneToy {
  const root = q('#toyTune')
  const toy = mountTuneToy(root, { active: deck.toyActive(1), names })
  const label = q('[data-fig-label]', root)
  const games = initGames()
  const anchors = initAnchors()
  registerToy({
    onStep(n) {
      toy.setStep(n as TuneStep)
      label.innerHTML = FIG[n] ?? FIG[1]
      if (n !== 2 && n !== 5) games.stop()
      if (n !== 5) anchors.stop()
    },
  })
  initPredict(toy, root)
  return toy
}
