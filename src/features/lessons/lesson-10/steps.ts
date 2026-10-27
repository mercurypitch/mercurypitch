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
// leaving a step, by any of them, stops the beads' sound and both games;
// the step showing shown again, as a layout switch shows it, stops nothing.
//
// Step 1: Play the third plays its two notes, 0.6 s each, then together for
// 1.0 s, as its gap button does; Major · Minor slides the top bead a row,
// to E♭4, and back. Step 2 opens on Step 1's two beads in C major: Stack a
// third drops G4 in and gives its place, and the focus, to Play the triad,
// which plays the three at 0.55 s each, then together for 1.2 s (FACTS
// 75), and the middle bead turns gold. Step 3: Major · Minor moves the
// middle bead, and Root lower and Root higher slide the whole chord,
// silently, to the next white-key root between C4 and B4, its names
// respelled; at either end the button is `aria-disabled`, keeps the focus,
// and a press does nothing, not even stop what sounds. Step 4: Play the
// pattern (pattern.ts) breaks the chord into quavers, each bead lit as it
// sounds, and Major · Minor and Slow · Fast act from the next quaver, so
// the pattern plays on through them; the figure's readout says what is set
// (FACTS 76). Step 5: Chord · Scale spreads the chord into its staircase
// and folds it back. Its predict's Play C major and Play C minor spread it
// first if it is folded, show their scale on it and light each stair as it
// sounds (FACTS 77); the reveal, and the step's Notice and drawer with it,
// waits until both have been heard to their end, so a scale cut short by
// another sound, a stage control or leaving the step is not heard
// (kit/predict.ts). Step 5's own Major · Minor waits for the predict's
// choice, which unlocks it, and the toy keeps that choice, so it stays
// enabled when the viewer comes back (WEB-SPEC, Edge cases). The names
// switch, Letters · Do-re-mi, writes the page's one names store (main.ts),
// and the stairs follow it: do re me fa so le te do under Minor (FACTS 8,
// 26). Slow (`aria-pressed`) doubles every length of the other steps'
// plays, the gap buttons' and the scales' too. Every play is the beads'
// own, the page's one sound (kit/now-playing.ts): its button is lit while
// it sounds, a press stops the sound before it, and a newer one stops it.
// Major · Minor (but in Step 4), a slide, Stack a third, Chord · Scale and
// the names switch stop the stage's sound first, and the toy says each
// change once in its polite line. The games sit in Steps 1 and 3's text
// (games.ts).

import { q, qa } from '@/features/lessons/kit/dom'
import type { ModeStore } from '@/features/lessons/kit/names'
import { bindModeToggle } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { RunNote } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { BeadsSettings, ChordBeads } from './chord-beads'
import { mountChordBeads } from './chord-beads'
import type { BeadState } from './chord-layout'
import type { Quality } from './chords'
import { nextRoot, QUALITIES } from './chords'
import { initGames } from './games'
import type { ScaleChoice } from './lines'
import { SCALE_PREDICT } from './lines'
import { playPattern } from './pattern'
import type { Tempo } from './sounds'
import { scaleSound, slow, thirdSound, triadSound } from './sounds'

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

/** A Major · Minor switch: its buttons name their quality. */
const QUALITY = 'data-quality'

/** Wires a Major · Minor switch to the beads; returns what shows their quality pressed on it. */
export function bindQuality(seg: ParentNode, beads: ChordBeads): () => void {
  bindSwitch<Quality>(seg, QUALITY, QUALITIES, (qy) => {
    beads.setQuality(qy)
  })
  return () => {
    pressOn(seg, QUALITY, beads.settings.quality)
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

/** Step 4's tempos, as its switch offers them. */
const TEMPOS: readonly Tempo[] = ['slow', 'fast']

/** The stage's controls, as each step opens. */
interface Stage {
  /** Step `n` has opened its state: its controls show what the beads show. */
  opened(n: number): void
}

/** The stage's plays: Play the third, Play the triad and Play the pattern. */
function bindPlays(root: HTMLElement, beads: ChordBeads): void {
  const light = playLights()
  for (const id of NOTES_PLAYS) {
    const btn = q<HTMLButtonElement>(`[data-chord-play="${id}"]`, root)
    btn.addEventListener('click', () => {
      light(btn, beads.play(stageNotes(id, beads.settings), Sound.canPlay()))
    })
  }
  // each quaver reads what is set as it starts (pattern.ts)
  const pattern = q<HTMLButtonElement>('[data-chord-play="pattern"]', root)
  pattern.addEventListener('click', () => {
    const audible = Sound.canPlay()
    light(
      pattern,
      beads.playRun((onNote) =>
        playPattern({ audible, set: () => beads.settings, onNote }),
      ),
    )
  })
}

/** Step 2's Stack a third, which gives its place to Play the triad. */
function bindStack(root: HTMLElement, beads: ChordBeads): Stage {
  const stackBtn = q<HTMLButtonElement>('[data-chord-stack]', root)
  const triadBtn = q<HTMLButtonElement>('[data-chord-play="triad"]', root)
  stackBtn.addEventListener('click', () => {
    beads.stack()
    stackBtn.hidden = true
    triadBtn.hidden = false
    triadBtn.focus()
  })
  return {
    opened(n) {
      // Step 2 opens unstacked: Stack a third first, Play the triad after
      if (n === 2) triadBtn.hidden = !beads.settings.stacked
    },
  }
}

/** Step 3's Root lower and Root higher, each `aria-disabled` where no white key lies past the root. */
export function bindRoots(root: HTMLElement, beads: ChordBeads): Stage {
  const buttons = qa<HTMLButtonElement>('[data-chord-root]', root)
  const dirOf = (b: HTMLElement): -1 | 1 =>
    Number(b.dataset.chordRoot) < 0 ? -1 : 1
  const markEnds = (): void => {
    for (const b of buttons)
      b.setAttribute(
        'aria-disabled',
        String(nextRoot(beads.settings.root, dirOf(b)) === null),
      )
  }
  for (const b of buttons)
    b.addEventListener('click', () => {
      // at its end a press neither moves the chord nor stops what sounds,
      // and the button keeps the focus (WEB-SPEC, Edge cases)
      if (b.getAttribute('aria-disabled') === 'true') return
      beads.slideRoot(dirOf(b))
      markEnds()
    })
  return { opened: markEnds }
}

/** Slow: every length of Steps 1, 2, 3 and 5's plays twice as long. */
function bindSlow(root: HTMLElement, beads: ChordBeads): void {
  const slowBtn = q<HTMLButtonElement>('[data-chord-slow]', root)
  slowBtn.addEventListener('click', () => {
    const on = slowBtn.getAttribute(PRESSED) !== 'true'
    slowBtn.setAttribute(PRESSED, String(on))
    beads.setSlow(on)
  })
}

// -------------------------------------------------------------- Step 5

/** Chord · Scale: the chord, or the chord spread into its scale. */
type ScaleView = 'chord' | 'scale'

const VIEWS: readonly ScaleView[] = ['chord', 'scale']

/** Step 5's predict's plays (`data-play`), each the scale it plays. */
export const SCALE_PLAYS: Readonly<Record<string, Quality>> = {
  'scale-major': 'major',
  'scale-minor': 'minor',
}

const SCALE_CHOICES: readonly ScaleChoice[] = ['one', 'three']

const isScaleChoice = (choice: string): choice is ScaleChoice =>
  (SCALE_CHOICES as readonly string[]).includes(choice)

/** Step 5's scale in `quality` on what the beads show: at twice its lengths under Slow (FACTS 77). */
export function scaleNotes(quality: Quality, s: BeadsSettings): RunNote[] {
  const notes = scaleSound(s.root, quality)
  return s.slow ? slow(notes) : notes
}

/** Step 5: Chord · Scale, its own Major · Minor, and its predict, whose two plays sound on the staircase. */
function bindScale(root: HTMLElement, beads: ChordBeads): Stage {
  const view = q('[data-chord-view]', root)
  const quality = q('[data-scale-quality]', root)
  const qualityBtns = qa<HTMLButtonElement>(`button[${QUALITY}]`, quality)
  const showQuality = bindQuality(quality, beads)
  const showSet = (): void => {
    pressOn(view, 'data-view', beads.settings.spread ? 'scale' : 'chord')
    showQuality()
  }
  // the predict's choice, kept for the viewer's return (WEB-SPEC, Edge cases)
  let chosen = false
  bindSwitch<ScaleView>(view, 'data-view', VIEWS, (v) => {
    beads.setSpread(v === 'scale')
  })
  const step = q('#step-5')
  const predict = q('#predictScale', step)
  mountPredict(predict, {
    // a scale plays on the staircase, which shows the scale it plays; a
    // spread or a change of quality stops what sounded first
    play: (what, audible) => {
      const qy = SCALE_PLAYS[what] ?? 'major'
      beads.setSpread(true)
      beads.setQuality(qy)
      showSet()
      return beads.play(scaleNotes(qy, beads.settings), audible)
    },
    revealOn: Object.keys(SCALE_PLAYS),
    revealAfter: 'all',
    hints: SCALE_PREDICT.hints,
    guess: (choice) =>
      isScaleChoice(choice) ? SCALE_PREDICT.guess[choice] : 'You said',
    unlocks: qualityBtns,
    onChoice: () => {
      chosen = true
    },
    // the predict's own reveal first: its "You said" line is written there
    reveal: [
      q('.reveal', predict),
      ...qa<HTMLElement>('[data-scale-reveal]', step),
    ],
  })
  return {
    opened(n) {
      showSet()
      // Step 5's Major · Minor waits for the choice, and keeps it once made
      if (n === 5) for (const b of qualityBtns) b.disabled = !chosen
    },
  }
}

/** The names switch, Letters · Do-re-mi: the page's one store, which the stairs follow. */
export function bindNames(
  root: HTMLElement,
  beads: ChordBeads,
  names: ModeStore<LettersSolfegeMode>,
): void {
  bindModeToggle(root, names, 'data-names')
  names.subscribe((mode) => {
    beads.setNames(mode)
  })
}

/** Wires the stage's controls for every step. */
function bindStage(
  root: HTMLElement,
  beads: ChordBeads,
  names: ModeStore<LettersSolfegeMode>,
): Stage {
  const tempo = q('[data-chord-tempo]', root)
  bindPlays(root, beads)
  const showQuality = bindQuality(q('[data-chord-quality]', root), beads)
  bindSwitch<Tempo>(tempo, 'data-tempo', TEMPOS, (t) => {
    beads.setTempo(t)
  })
  bindSlow(root, beads)
  bindNames(root, beads, names)
  const parts = [
    bindStack(root, beads),
    bindRoots(root, beads),
    bindScale(root, beads),
  ]
  return {
    opened(n) {
      showQuality()
      pressOn(tempo, 'data-tempo', beads.settings.tempo)
      for (const part of parts) part.opened(n)
    },
  }
}

/**
 * Mounts the stage's chord beads, the steps' games and Step 5's predict,
 * and follows the deck: registered before `deck.start()`, so an address
 * that names a step opens it. `names` is the page's names store, Letters
 * or Do-re-mi.
 */
export function initSteps(
  deck: StepDeck,
  names: ModeStore<LettersSolfegeMode>,
): ChordBeads {
  const root = q('#toyChord')
  const label = q('[data-fig-label]', root)
  const beads = mountChordBeads(root, {
    state: STEP_STATE[1],
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  const stage = bindStage(root, beads, names)
  const games = initGames()
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it, and what sounds plays on
      if (n === previous) return
      // a step left behind keeps nothing sounding, by any route: each
      // game's round, and a miss's replay still to come; the beads' play,
      // Step 4's pattern and Step 5's scale among them, stops as the
      // beads' state changes
      games.stop()
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      beads.setState(STEP_STATE[n] ?? STEP_STATE[1])
      stage.opened(n)
    },
  })
  return beads
}
