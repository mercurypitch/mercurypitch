// ============================================================
// Lesson 16 steps — five steps on two toys: the staircase, then the staff
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 2 and 3): Step 1's staircase over the
// staff it turns into (stairs-step.ts), then the staff toy for Steps 2 to
// 5, the five notes do to so with the house on do and the syllables under
// them, each step in its own state with its own plays (sounds.ts): Play do
// in Step 2, where a tap on any note checks it; Hear it inside and Play do
// to so in Step 3; the triad and its turn in Step 4; Names on · off with
// do to so and the triad in Step 5. Each step's controls are in the toy,
// marked with the steps they show on (`data-part`; kit/step-parts.ts), so
// no two controls on the stage share a name.
//
// Every staff is in the learner's clef: the bass for the lower voice, or
// none stored, and the treble for the higher (FACTS 8). Either toy's Clef
// switch changes it on every staff for the visit, and Sing it's voice
// choice sets it from there on. Hear it inside is one switch for the visit,
// in memory, across the steps and free play (`HearInside`): on, each run
// lights each note a beat before it sounds. Names holds its choice for the
// visit too. Every sound is the page's one (`NowPlaying`), and the step
// left keeps nothing sounding, by any route.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { clefForVoice } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { StepPlay } from './sounds'
import { staffState, stepPlay } from './sounds'
import type { StairsStep } from './stairs-step'
import { mountStairsStep } from './stairs-step'

/** Five steps on two toys: the staircase, then the staff. */
export const TOYS: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
}

/** The learner's clef: the bass for the lower voice, or none stored, and the treble for the higher. */
export const learnerClef = (): Clef =>
  VoiceChoice.voice === null ? 'bass' : clefForVoice(VoiceChoice.voice)

/** The staff toy's figure label in each of its steps. */
export const FIG: Readonly<Record<number, string>> = {
  2: '<span class="fig">Fig. 2</span> Your staff, the house on do.',
  3: '<span class="fig">Fig. 3</span> Hear each note inside.',
  4: '<span class="fig">Fig. 4</span> Do, mi and so.',
  5: '<span class="fig">Fig. 5</span> Names on or off.',
}

/** Hear it inside: off at first, then the learner's for the visit, in memory. */
export const HearInside = (() => {
  let on = false
  const listeners = new Set<(on: boolean) => void>()
  return {
    get on(): boolean {
      return on
    },
    set(next: boolean): void {
      if (next === on) return
      on = next
      listeners.forEach((fn) => fn(on))
    },
    /** Calls `fn` after every change; returns the unsubscribe. */
    subscribe(fn: (on: boolean) => void): () => void {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
})()

/** Every Hear it inside switch under `root` shows the one choice and changes it. */
export function bindHearInside(root: ParentNode = document): void {
  const switches = qa<HTMLButtonElement>('button[data-hear-inside]', root)
  const show = (): void =>
    switches.forEach((b) =>
      b.setAttribute('aria-pressed', String(HearInside.on)),
    )
  for (const b of switches)
    b.addEventListener('click', () => HearInside.set(!HearInside.on))
  HearInside.subscribe(show)
  show()
}

export interface Steps {
  readonly stairs: StairsStep
  readonly staff: StaffToy
  /** The clef every staff shows. */
  readonly clef: Clef
}

/**
 * Mounts the two toys and follows the deck: called before `deck.start()`,
 * so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): Steps {
  const light = playLights()
  const staffRoot = q('#toyStaff')
  const label = q('[data-fig-label]', staffRoot)
  let clef = learnerClef()
  // the staff toy's step: Step 2 until the deck says otherwise
  let step = 2
  // Names on · off, Step 5's, kept for the visit
  let names = true

  const stateOf = (n: number) => staffState(clef, n === 5 ? names : true)

  /** Every staff to `c`, from a Clef switch or the voice choice. */
  function setClef(c: Clef): void {
    clef = c
    stairs.setClef(c)
    staff.setState(stateOf(step))
    staff.say(c === 'treble' ? 'Treble clef.' : 'Bass clef.')
  }

  const stairs = mountStairsStep(q('#toyStairs'), {
    active: deck.toyActive(1),
    clef,
    onClef: (c) => setClef(c),
    light,
  })
  const staff = mountStaff(staffRoot, {
    state: stateOf(step),
    owner: NowPlaying,
    onClef: (c) => setClef(c),
  })

  for (const b of qa<HTMLButtonElement>('button[data-staff-play]', staffRoot)) {
    const name = b.dataset.staffPlay as StepPlay
    b.addEventListener('click', () =>
      light(b, staff.play(stepPlay(name, clef, HearInside.on))),
    )
  }
  // the toy shows the names as a button says; the page keeps the choice
  for (const b of qa<HTMLButtonElement>(
    '[data-staff-names] button[data-names]',
    staffRoot,
  ))
    b.addEventListener('click', () => {
      names = staff.names
    })
  bindHearInside()

  // every staff follows Sing it's voice choice at once
  VoiceChoice.subscribe(() => {
    const c = learnerClef()
    if (c !== clef) setClef(c)
  })

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it, and what sounds plays on
      if (n === previous) return
      // the step left keeps nothing sounding, by any route
      stairs.stop()
      if (n < 2) {
        staff.stop()
        return
      }
      step = n
      showParts(staffRoot, n)
      label.innerHTML = FIG[n] ?? FIG[2]
      staff.setState(stateOf(n))
    },
  })
  return {
    stairs,
    staff,
    get clef() {
      return clef
    },
  }
}
