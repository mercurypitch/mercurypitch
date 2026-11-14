// ============================================================
// Lesson 27 steps — four steps on one toy, and Step 4's own predict
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 1): one toy in four states
// (ring-toy.ts), Lesson 12's ring of rooms beside the learner's staff.
// Step 1 holds I and V with Add the seventh; Step 2 I's and V's rooms with
// their sevenths; Step 3 V7's room with its diagonal, and I's; Step 4 I
// and V7 with Turn over and the bass mark. Each step's controls are marked
// with the steps they show on (`data-part`; kit/step-parts.ts), and each
// step's other plays sit in its text, where LESSON.md writes them, and
// play on the toy. The toy follows Sing it's voice choice at once.
//
// Step 4's predict (WEB-SPEC, Toys 3) waits for the cold open's: its
// choices and plays are disabled at first paint under "Choose an answer at
// the top first."; the cold open's choice (`enable4`) sets the line
// "Choose an answer to unlock the two comparisons.", enables the choices
// and only then mounts the predict, which keeps the hint it finds, as
// Lesson 22's page wires its second predict (FACTS 48). Its plays sound on
// the toy, and its reveal waits for both heard to their end, the text
// after it, with Try, Notice and the drawer, showing with it, not read
// out: the status line reads the reveal alone. Its choice opens Step 4's
// chips and Turn over, and free play's Turn over (`onChoice4`); its
// reveal names the positions (`onReveal4`).

import { q, qa } from '@/features/lessons/kit/dom'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { clefForVoice } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { RingState, RingToy } from './ring-toy'
import { mountRingToy, RING_STATES } from './ring-toy'
import type { PlayId } from './sounds'

/** The learner's clef: the bass for the lower voice, or none stored, and the treble for the higher. */
export const clefOf = (v: Voice | null): Clef =>
  v === null ? 'bass' : clefForVoice(v)

/** Step 4's predict's words (LESSON.md; WEB-SPEC, Toys 3); there is no `next` hint (FACTS 37, 48). */
export const STEP4_PREDICT = {
  open: 'Choose an answer to unlock the two comparisons.',
  hints: {
    chosen: 'Locked in. Play both.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play either again.',
  },
  guess: {
    still: 'You said: still C major',
    eminor: 'You said: E minor',
  },
} as const

const LOCK = '<svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>'

const isChoice4 = (c: string): c is keyof typeof STEP4_PREDICT.guess =>
  Object.hasOwn(STEP4_PREDICT.guess, c)

export interface Steps {
  readonly toy: RingToy
  /** The cold open's choice: the toy opens V, and Step 4's predict its choices. */
  unlock(): void
  /** Step 4's predict, once the cold open's choice has mounted it. */
  readonly predict4: Predict | null
}

export interface StepsOptions {
  /** Hears Step 4's choice: free play opens its Turn over. */
  readonly onChoice4?: () => void
  /** Hears Step 4's reveal: free play names its positions. */
  readonly onReveal4?: () => void
}

/**
 * Mounts the toy and follows the deck: called before `deck.start()`, so
 * an address that names a step opens it.
 */
export function initSteps(deck: StepDeck, o: StepsOptions = {}): Steps {
  const light = playLights()
  const root = q('#toyRing')
  const toy = mountRingToy(root, {
    active: deck.toyActive(1),
    clef: clefOf(VoiceChoice.voice),
    state: RING_STATES[1],
    light,
  })

  /**
   * On a wide page the next step's text shows before the deck reaches it:
   * a play there shows its own step first, so the toy draws that step's
   * state under that step's heading.
   */
  const showStep = (step: number): void => {
    if (step in RING_STATES && step !== deck.current) deck.show(step)
  }

  // each step's plays in its text play on the toy, which a phone brings
  // back into view from above the text, so what it lights is seen
  for (const b of qa<HTMLButtonElement>('[data-step-play]')) {
    const id = b.dataset.stepPlay as PlayId
    const step = Number(b.closest<HTMLElement>('[data-step]')?.dataset.step)
    b.addEventListener('click', () => {
      showStep(step)
      deck.showToy()
      light(b, toy.play(id))
    })
  }

  // the toy follows Sing it's voice choice at once
  VoiceChoice.subscribe((v) => toy.setClef(clefOf(v)))

  const STEP_STATES: Readonly<Record<number, RingState>> = RING_STATES
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts
      if (n === previous) return
      showParts(root, n)
      toy.setState(STEP_STATES[n] ?? RING_STATES[1])
    },
  })

  // Step 4's predict: disabled until the cold open's choice
  const box = q('#predict4')
  let predict4: Predict | null = null

  function mount4(): Predict {
    return mountPredict(box, {
      play: (what) => {
        showStep(4)
        deck.showToy()
        return toy.play(what === 'eminor' ? 'eminor' : 'turn')
      },
      revealOn: ['turn', 'eminor'],
      revealAfter: 'all',
      hints: STEP4_PREDICT.hints,
      guess: (c) => (isChoice4(c) ? STEP4_PREDICT.guess[c] : 'You said'),
      onChoice: () => {
        toy.unlock4()
        o.onChoice4?.()
      },
      onReveal: () => {
        q('[data-reveal4]').hidden = false
        toy.reveal4()
        o.onReveal4?.()
      },
    })
  }

  return {
    toy,
    get predict4() {
      return predict4
    },
    unlock() {
      toy.unlock()
      if (predict4 !== null) return
      // the line the predict keeps, then its choices, then the predict
      q('.lock-hint', box).innerHTML = `${LOCK}${STEP4_PREDICT.open}`
      for (const b of qa<HTMLButtonElement>('[data-choice]', box))
        b.disabled = false
      predict4 = mount4()
    },
  }
}
