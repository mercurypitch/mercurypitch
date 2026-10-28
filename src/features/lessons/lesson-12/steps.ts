// ============================================================
// Lesson 12 steps — five steps, one ring of rooms
// ============================================================
//
// Every step shows the one ring-of-rooms toy (`toyFor: () => 1`), each in
// its own state (WEB-SPEC, Toys 1; rooms.ts): the seven chords of C major
// built one chip at a time; their numerals, with the key switch C · G; the
// corner that slides from I to vi, with the names switch; the loop of four,
// with its roots; and the tunes over the loop. The chord strip's seven
// chips serve every step, and play their chords; each step's own controls
// are in the one toy, each marked with the steps it shows on (`data-part`,
// a list of step numbers; kit/step-parts.ts), so no two controls on the
// stage ever share a name: Slow serves Steps 3, 4 and 5. The figure's
// label, which parts show and the ring's state follow the step, through
// the deck's `onStep`, whatever the route (Next or Back, a swipe, the
// lesson menu, an address that names a step, the quiz's step links): each
// step opens its state in C major, and leaving a step stops what the ring
// plays; the step showing shown again, as a layout switch shows it, stops
// nothing.
//
// The stage reads in one order for the eye, the keyboard and a screen
// reader: the figure, its slider first, then the step's own row of
// controls, then the chips from I to vii°. Step 2's key switch C · G
// (`aria-pressed`, from C) turns every room in silence, after stopping a
// play still sounding, and the ring says the key once in its polite line;
// a press while the rooms still turn does nothing. Step 3's Play I, then vi
// slides the corner on G to A; its names switch, Letters · Do-re-mi, is
// the page's one store (main.ts), so the choice holds on every step and in
// every copy of the ring, and a change stops what sounds first. Step 4's
// Play the loop and Play the roots are one round each. Each play's button
// is lit while it sounds (kit/play-lights.ts), as Lesson 10's are. Slow
// (`aria-pressed`) serves Steps 3, 4 and 5, and holds from step to step,
// from the next play. Step 5's tunes are wired with the tune toy; until
// then they do nothing.

import { q, qa } from '@/features/lessons/kit/dom'
import type { ModeStore } from '@/features/lessons/kit/names'
import { bindModeToggle } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { KeyName } from './music'
import { KEYS } from './music'
import type { Rooms, RoomsMode } from './rooms'
import { mountRooms } from './rooms'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> C major\'s seven chords',
  2: '<span class="fig">Fig. 2</span> The numerals, in two keys',
  3: '<span class="fig">Fig. 3</span> The chord on la',
  4: '<span class="fig">Fig. 4</span> The four-chord loop',
  5: '<span class="fig">Fig. 5</span> Two tunes over the loop',
}

/** Each step's state of the ring (WEB-SPEC, Toys 1). */
export const STEP_MODE: Readonly<Record<number, RoomsMode>> = {
  1: 'build',
  2: 'numerals',
  3: 'slide',
  4: 'loop',
  5: 'tunes',
}

/** Step 2's key switch: C · G, each button pressed while its key shows. */
function bindKey(root: HTMLElement, rooms: Rooms): () => void {
  const seg = q('[data-rooms-key]', root)
  const buttons = qa<HTMLButtonElement>('button[data-key]', seg)
  const keyOf = (b: HTMLElement): KeyName | undefined =>
    KEYS.find((k) => k === b.dataset.key)
  const show = (): void => {
    for (const b of buttons)
      b.setAttribute('aria-pressed', String(keyOf(b) === rooms.settings.key))
  }
  for (const b of buttons)
    b.addEventListener('click', () => {
      const key = keyOf(b)
      // a press while the rooms still turn changes nothing
      if (key !== undefined && rooms.setKey(key)) show()
    })
  return show
}

/** The steps' plays, each the ring's: Step 3's slide, Step 4's loop and roots. */
const PLAYS: Readonly<Record<string, (rooms: Rooms) => Promise<boolean>>> = {
  slide: (rooms) => rooms.playSlide(),
  loop: (rooms) => rooms.playLoop(),
  roots: (rooms) => rooms.playRoots(),
}

/** Each play button starts its play, lit while it sounds: the page's one sound, stopping the last. */
function bindPlays(root: HTMLElement, rooms: Rooms): void {
  const light = playLights()
  for (const b of qa<HTMLButtonElement>('button[data-rooms-play]', root)) {
    const play = PLAYS[b.dataset.roomsPlay ?? '']
    if (play !== undefined)
      b.addEventListener('click', () => {
        light(b, play(rooms))
      })
  }
}

/** Slow, a switch: pressed, every play from the next at twice its lengths. */
function bindSlow(root: HTMLElement, rooms: Rooms): void {
  const b = q<HTMLButtonElement>('button[data-rooms-slow]', root)
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true'
    b.setAttribute('aria-pressed', String(on))
    rooms.setSlow(on)
  })
}

/** The names switch, Letters · Do-re-mi: the page's one store, which the ring follows. */
function bindNames(
  root: HTMLElement,
  rooms: Rooms,
  names: ModeStore<LettersSolfegeMode>,
): void {
  bindModeToggle(root, names, 'data-names')
  names.subscribe((mode) => {
    rooms.setNames(mode)
  })
}

/**
 * Mounts the stage's ring of rooms and follows the deck: registered before
 * `deck.start()`, so an address that names a step opens it. `names` is the
 * page's names store, Letters or Do-re-mi.
 */
export function initSteps(
  deck: StepDeck,
  names: ModeStore<LettersSolfegeMode>,
): Rooms {
  const root = q('#toyRooms')
  const label = q('[data-fig-label]', root)
  const rooms = mountRooms(root, {
    mode: STEP_MODE[1],
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  const showKey = bindKey(root, rooms)
  bindPlays(root, rooms)
  bindSlow(root, rooms)
  bindNames(root, rooms, names)
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it, and what sounds plays on
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      // the step left keeps nothing sounding, by any route: opening a state
      // stops the ring's play and every note of it still to come
      rooms.setMode(STEP_MODE[n] ?? STEP_MODE[1])
      showKey()
    },
  })
  return rooms
}
