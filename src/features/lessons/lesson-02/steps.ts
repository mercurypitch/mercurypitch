// ============================================================
// Lesson 2 steps — six steps, one object, each toy on the stage
// ============================================================
//
// The kit's step deck with Lesson 2's toys, one per step (steps 1 and 2
// share the spiral): the spiral (Climb and Look down join it in step 2), the
// keyboard (Unroll and Straighten), the tile row (Lift out the five), the
// tile row with its names (Sharp, Flat, Play both ways, the rare ones) and
// the semitone ruler. The step text carries the rest: step 3's predict and
// its examples, which play on step 3's keyboard; step 4's tone split, which
// plays on its tiles, and the ear game; step 5's predict, inside mix-up
// card 2, whose choice unlocks the stage's Sharp, Flat and Show the rare
// ones, and whose Play E to F sends the arrow that writes E♯ on F.

import { q, qa } from '@/features/lessons/kit/dom'
import { mountPredict } from '@/features/lessons/kit/predict'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { mountEarGame } from './ear-game'
import type { NoteEvent } from './examples'
import { B_TO_C, C_TO_D, E_TO_F, NEIGHBOURS, TONE_SPLIT } from './examples'
import type { KeysToy } from './keys-toy'
import { mountKeysToy } from './keys-toy'
import { arrowFrom } from './names-arrows'
import { mountRuler } from './ruler'
import { mountSpiralCopy } from './spiral-copy'

/** A3 to A4 as semitones from A2; on a phone step 5 closes up on B3 to F4. */
const OCTAVE = [12, 24] as const
const CLOSE_UP = [14, 20] as const

const FIG = {
  1: '<span class="fig">Fig. 1</span> The pitch spiral',
  2: '<span class="fig">Fig. 2</span> Twelve steps, one turn',
} as const

/** Steps 1 and 2: one spiral copy; step 2 adds Climb and Look down. */
function initSpiral(deck: StepDeck): void {
  const root = q('#toySpiral')
  const copy = mountSpiralCopy(root, { active: deck.toyActive(1) })
  const climb = q<HTMLButtonElement>('[data-climb]', root)
  const look = q<HTMLButtonElement>('[data-look-down]', root)
  const label = q('[data-fig-label]', root)
  let two: boolean | null = null
  registerToy({
    onStep(n) {
      const isTwo = n === 2
      if (isTwo === two) return
      two = isTwo
      climb.hidden = !isTwo
      look.hidden = !isTwo
      label.innerHTML = isTwo ? FIG[2] : FIG[1]
      if (!isTwo && copy.lookingDown) copy.setLookDown(false)
    },
  })
}

/** A play button in the step text: one press at a time, lit while it sounds. */
function bindPlay(
  button: HTMLButtonElement,
  run: (audible: boolean) => Promise<void>,
): void {
  let busy = false
  button.addEventListener('click', () => {
    if (busy) return
    busy = true
    button.classList.add('is-on')
    void run(Sound.canPlay()).then(() => {
      busy = false
      button.classList.remove('is-on')
    })
  })
}

const GUESS_BC: Readonly<Record<string, string>> = {
  bc: 'You said: B to C',
  same: 'You said: the same',
  cd: 'You said: C to D',
}

const GUESS_E: Readonly<Record<string, string>> = {
  black: 'You said: a black key',
  white: 'You said: a white key',
}

/** Step 3: the predict, its two plays and the examples, all on the step's keyboard. */
function initStep3(keys: KeysToy): void {
  const onKeys =
    (
      events: readonly NoteEvent[],
      bars: readonly (readonly [number, number])[],
    ) =>
    (audible: boolean): Promise<void> =>
      keys.play(events, { audible, bars, keys: true })
  const plays: Readonly<Record<string, (audible: boolean) => Promise<void>>> = {
    bc: onKeys(B_TO_C, [[59, 60]]),
    cd: onKeys(C_TO_D, [[60, 62]]),
  }
  mountPredict(q('#predictBC'), {
    play: (what, audible) => plays[what]?.(audible) ?? Promise.resolve(),
    revealOn: ['bc', 'cd'],
    revealAfter: 'all',
    hints: {
      chosen: 'Locked in. Play both steps and watch the keys.',
      next: 'Now play the other step.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear the two steps.',
      again: 'Play them again, or tap any two keys on the keyboard.',
    },
    guess: (choice) => GUESS_BC[choice] ?? 'You said',
  })
  const step = q('#step-3')
  bindPlay(q('[data-example="ef"]', step), onKeys(E_TO_F, [[64, 65]]))
  bindPlay(
    q('[data-example="neighbours"]', step),
    onKeys(NEIGHBOURS, [
      [60, 61],
      [59, 60],
    ]),
  )
}

/** Step 5: the predict inside mix-up card 2; its choice unlocks the stage's arrows. */
function initStep5(names: KeysToy): void {
  const card = q('#mixupNames')
  const fromE = arrowFrom(64, 'sharp')
  mountPredict(q('#predictE', card), {
    play: (_what, audible) =>
      names.play(E_TO_F, {
        audible,
        arrows: fromE === null ? [] : [{ step: fromE, at: 0 }],
      }),
    revealOn: ['ef'],
    hints: {
      chosen: 'Locked in. Play E to F, and watch where the arrow lands.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear E to F, then press Play E to F.',
      again: 'Play it again, or try Sharp and Flat on the stage.',
    },
    guess: (choice) => GUESS_E[choice] ?? 'You said',
    onChoice: () => names.unlock(),
    reveal: qa('[data-e-reveal]', card),
  })
}

export function initSteps(deck: StepDeck): void {
  initSpiral(deck)
  const keys = mountKeysToy(q('#toyKeys'), {
    tiles: OCTAVE,
    phoneTiles: OCTAVE,
    pairs: true,
    opens: 'spiral',
    active: deck.toyActive(3),
  })
  const tiles = mountKeysToy(q('#toyTiles'), {
    tiles: OCTAVE,
    phoneTiles: OCTAVE,
    pairs: true,
    opens: 'tiles',
    active: deck.toyActive(4),
  })
  const names = mountKeysToy(q('#toyNames'), {
    tiles: OCTAVE,
    phoneTiles: CLOSE_UP,
    pairs: false,
    opens: 'tiles',
    active: deck.toyActive(5),
  })
  const ruler = mountRuler(q('#toyRuler'), { active: deck.toyActive(6) })

  initStep3(keys)
  bindPlay(q('[data-example="tone-split"]'), (audible) =>
    tiles.play(TONE_SPLIT, { audible }),
  )
  mountEarGame(q('#earGame'))
  initStep5(names)

  // step 5 opens on the film's signature: C♯ above D♭ on one key, under one gold ring
  let signed = false
  registerToy({
    onStep(n) {
      if (n !== 6) ruler.stop()
      if (n === 5 && !signed) {
        signed = true
        names.signature()
      }
    },
  })
}
