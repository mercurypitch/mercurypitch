// ============================================================
// Lesson 10 steps — five steps, one chord-beads toy
// ============================================================
//
// Every step shows the one chord-beads toy (`toyFor: () => 1`), each in its
// own state (WEB-SPEC, Toys 1): a third; a third stacked on it; the third
// moved, and the root slid; the chord's pattern; the chord spread into its
// scale. Each step's controls are in the one toy, each marked with the steps
// it shows on (`data-part`, a list of step numbers), so no two controls on
// the stage ever share a name: Slow serves Steps 1, 2, 3 and 5, Step 4 has
// Slow · Fast, and Step 5 has a Major · Minor of its own, which waits for
// its predict. The figure's label, which parts show and the chord beads'
// state follow the step, through the deck's `onStep`, whatever the route
// (Next or Back, a swipe, the lesson menu, an address that names a step, the
// quiz's step links): each step opens its state on C4, in major, and
// leaving a step stops the beads' sound and its game.
//
// Step 1: Play the third plays its two notes, 0.6 s each, then together for
// 1.0 s, as its gap button does; Major · Minor slides the top bead a row,
// to E♭4, and back. Step 2 opens on Step 1's two beads in C major: Stack a
// third drops G4 in and gives its place, and the focus, to Play the triad,
// which plays the three at 0.55 s each, then together for 1.2 s (FACTS
// 75), and the middle bead turns gold. Slow (`aria-pressed`) doubles every
// length of the stage's plays, the gap buttons' too. Every play is the
// beads' own, the page's one sound (kit/now-playing.ts): its button is lit
// while it sounds, a press stops the sound before it, and a newer one
// stops it. Major · Minor and Stack a third stop the stage's sound first,
// and the toy says each change once in its polite line. The game on thirds
// sits in Step 1's text (games.ts). Root lower and Root higher, the
// pattern, Chord · Scale, Step 5's own Major · Minor and the names switch
// do nothing until they are wired.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RunNote } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { BeadsSettings, ChordBeads } from './chord-beads'
import { mountChordBeads } from './chord-beads'
import type { BeadState } from './chord-layout'
import type { Quality } from './chords'
import { QUALITIES } from './chords'
import { initGames } from './games'
import { slow, thirdSound, triadSound } from './sounds'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> Two beads, a third',
  2: '<span class="fig">Fig. 2</span> Three beads, two thirds',
  3: '<span class="fig">Fig. 3</span> Move the third',
  4: '<span class="fig">Fig. 4</span> The chord\'s pattern',
  5: '<span class="fig">Fig. 5</span> The chord in its scale',
}

/** Each step's state of the chord beads (WEB-SPEC, Toys 1). */
export const STEP_STATE: Readonly<Record<number, BeadState>> = {
  1: 'thirds',
  2: 'stack',
  3: 'slide',
  4: 'pattern',
  5: 'scale',
}

/** The steps a part shows on, from its `data-part` list ("1 3 4"). */
export const partSteps = (el: Element): readonly number[] =>
  (el.getAttribute('data-part') ?? '')
    .split(/\s+/)
    .filter((word) => word !== '')
    .map(Number)

/** Shows the parts of `root` that step `n` uses, and hides the rest. */
export function showParts(root: ParentNode, n: number): void {
  for (const el of qa<HTMLElement>('[data-part]', root))
    el.hidden = !partSteps(el).includes(n)
}

// -------------------------------------------------------------- the plays

/** The stage's plays of a list of notes (`data-chord-play`): Step 1's third, and the triad of Steps 2 and 3. */
export type NotesPlay = 'third' | 'triad'

const NOTES_PLAYS: readonly NotesPlay[] = ['third', 'triad']

/** What play `id` sounds on what the beads show: at twice its lengths under Slow (FACTS 75). */
export function stageNotes(id: NotesPlay, s: BeadsSettings): RunNote[] {
  const notes =
    id === 'third'
      ? thirdSound(s.root, s.quality)
      : triadSound(s.root, s.quality)
  return s.slow ? slow(notes) : notes
}

const PRESSED = 'aria-pressed'

/** Shows `value` pressed on a segmented switch: the button whose `attr` names it, and no other. */
export function pressOn(seg: ParentNode, attr: string, value: string): void {
  for (const b of qa<HTMLButtonElement>(`button[${attr}]`, seg))
    b.setAttribute(PRESSED, String(b.getAttribute(attr) === value))
}

/**
 * Wires a segmented switch: a press on a button whose `attr` names one of
 * `values` picks it, and the switch shows it pressed.
 */
export function bindSwitch<V extends string>(
  seg: ParentNode,
  attr: string,
  values: readonly V[],
  pick: (value: V) => void,
): void {
  for (const b of qa<HTMLButtonElement>(`button[${attr}]`, seg)) {
    const value = values.find((v) => v === b.getAttribute(attr))
    if (value === undefined) continue
    b.addEventListener('click', () => {
      pick(value)
      pressOn(seg, attr, value)
    })
  }
}

/** Lights a play's button while its sound, `done`, plays. */
type PlayLight = (btn: HTMLButtonElement, done: Promise<boolean>) => void

/**
 * Lights a play's button while its sound plays, and puts it out when the
 * sound ends, by itself or cut short; a newer play puts out the one before.
 */
export function playLights(): PlayLight {
  let lit: { readonly btn: HTMLButtonElement } | null = null
  return (btn, done) => {
    lit?.btn.classList.remove('is-on')
    const mine = { btn }
    lit = mine
    btn.classList.add('is-on')
    void done.then(() => {
      if (lit !== mine) return
      lit = null
      btn.classList.remove('is-on')
    })
  }
}

// -------------------------------------------------------------- the stage

/** The stage's controls, as each step opens. */
interface Stage {
  /** Step `n` has opened its state: its controls show what the beads show. */
  opened(n: number): void
}

/** Wires Steps 1 and 2's controls on the stage. */
function bindStage(root: HTMLElement, beads: ChordBeads): Stage {
  const quality = q('[data-chord-quality]', root)
  const slowBtn = q<HTMLButtonElement>('[data-chord-slow]', root)
  const stackBtn = q<HTMLButtonElement>('[data-chord-stack]', root)
  const triadBtn = q<HTMLButtonElement>('[data-chord-play="triad"]', root)
  const light = playLights()

  for (const id of NOTES_PLAYS) {
    const btn = q<HTMLButtonElement>(`[data-chord-play="${id}"]`, root)
    btn.addEventListener('click', () => {
      light(btn, beads.play(stageNotes(id, beads.settings), Sound.canPlay()))
    })
  }
  bindSwitch<Quality>(quality, 'data-quality', QUALITIES, (qy) => {
    beads.setQuality(qy)
  })
  slowBtn.addEventListener('click', () => {
    const on = slowBtn.getAttribute(PRESSED) !== 'true'
    slowBtn.setAttribute(PRESSED, String(on))
    beads.setSlow(on)
  })
  // the fifth drops in, and Play the triad takes Stack a third's place
  stackBtn.addEventListener('click', () => {
    beads.stack()
    stackBtn.hidden = true
    triadBtn.hidden = false
    triadBtn.focus()
  })

  return {
    opened(n) {
      pressOn(quality, 'data-quality', beads.settings.quality)
      // Step 2 opens unstacked: Stack a third first, Play the triad after
      if (n === 2) triadBtn.hidden = !beads.settings.stacked
    },
  }
}

/**
 * Mounts the stage's chord beads and the steps' games, and follows the
 * deck: registered before `deck.start()`, so an address that names a step
 * opens it.
 */
export function initSteps(deck: StepDeck): ChordBeads {
  const root = q('#toyChord')
  const label = q('[data-fig-label]', root)
  const beads = mountChordBeads(root, {
    state: STEP_STATE[1],
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  const stage = bindStage(root, beads)
  const games = initGames()
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it, and what sounds plays on
      if (n === previous) return
      // a step left behind keeps nothing sounding: its game's round, and a
      // miss's replay still to come; the beads stop as their state changes
      games.stop()
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      beads.setState(STEP_STATE[n] ?? STEP_STATE[1])
      stage.opened(n)
    },
  })
  return beads
}
