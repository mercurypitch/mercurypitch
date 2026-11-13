// ============================================================
// Lesson 27 cold open — V going home, and the note that makes it pull harder
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of Lesson 12's ring of rooms, seen from above
// and held still, its three plays under it, then the predict (WEB-SPEC,
// Toys 2 and 3). It is the steps' ring alone: no staff, since the voice
// choice comes later, and for everyone in Merc's register (FACTS 8, 74).
// Two rooms: V's, lit, and I's, faint, the centre reading "V · G major";
// IV's is never drawn (FACTS 33).
//
// Play V, then I works from the start: G3, B3 and D4, then C4, E4 and G4,
// 1.5 s each, each lighting its room and naming it in the centre (FACTS
// 32). Play it with F and Play it with F♯ wait for a choice: V with its
// fourth note, 1.5 s, then I, 1.5 s; as the fourth note sounds its bead
// lights and V's room grows its fourth corner there, and the centre names
// the four letters, no chord's name, until the reveal, after which the F
// play's centre reads "V7" (FACTS 37, 38).
//
// The reveal waits for both answering plays heard to their end with sound
// on, in either order (the kit's predict, `revealAfter: 'all'`); there is
// no `next` hint, so "Locked in. Play both." stays until then (FACTS 37).
// A play cut short, by another sound, a step change of the deck or the
// hero off screen, is not heard. Its reveal is four elements: the reveal
// under the predict, Step 1's paragraph on so with its play, and Steps 2
// and 3's text, each held line put away as they show, none announced but
// the first (FACTS 39, 40). The choice tells the page (`onChoice`): the
// toys open their V controls and Step 4's predict its choices. On a first
// visit the welcome tour waits for the choice (kit/tour-gate.ts
// `holdTour`), since its steps' stop would answer it.

import { q, qa } from '@/features/lessons/kit/dom'
import { wake, watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { signsHtml } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import { mountRing } from '@/features/lessons/kit/ring-rooms'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Spiral } from '@/features/lessons/kit/spiral'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { figureSaid, lettersSaid } from './chord-words'
import type { RingView } from './ring-view'
import { drawRingFrame, EMPTY_VIEW, ringMoving } from './ring-view'
import type { Figure, HeroPlay } from './sounds'
import { CHORDS, gainOf, heroPlay } from './sounds'

/** The predict's words (LESSON.md; WEB-SPEC, Toys 3); there is no `next` hint (FACTS 37). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play any of them again.',
  },
  guess: { f: 'You said: F', fsharp: 'You said: F♯' },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** The figure's name at rest (learn/27.html). */
export const HERO_LABEL =
  "Lesson 12's ring of rooms: V's room lit, G, B and D, and I's room faint, C, E and G"

export interface ColdOpen {
  readonly predict: Predict
  readonly spiral: Spiral
  stop(): void
}

export interface ColdOpenOptions {
  /** Hears the choice: the toys open their V controls, and Step 4's predict its choices. */
  readonly onChoice: () => void
}

/** The rooms at rest: V's lit, I's faint. */
const REST: RingView = {
  ...EMPTY_VIEW,
  rooms: [
    { chord: CHORDS.V, lit: true },
    { chord: CHORDS.I, lit: false },
  ],
  centre: CHORDS.V.centre,
}

/**
 * Mounts the cold open on the hero; a step change of the steps' `deck`
 * ends its play. Call it after the masthead's start, in the same task, so
 * a first visit's tour waits for the choice.
 */
export function initColdOpen(
  deck: Pick<StepDeck, 'subscribe'>,
  o: ColdOpenOptions,
): ColdOpen {
  const stage = q('#heroStage')
  const box = q('#heroRing')
  const canvas = q<HTMLCanvasElement>('canvas', box)
  const said = q('[data-ring-said]', box)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  let view: RingView = REST
  let dirty = true
  let revealed = false
  const spiral = mountRing(box, {
    active: watch(stage),
    inert: true,
    // a frame drawn while the corner grows asks for the next, so the one
    // after it lands is drawn too
    overlay: (f) => {
      dirty = drawRingFrame(f, { ...view, still: Motion.paused })
    },
    overlayWants: () =>
      dirty || ringMoving({ ...view, still: Motion.paused }, performance.now()),
  })
  canvas.setAttribute('aria-label', HERO_LABEL)

  function setView(next: RingView): void {
    view = next
    dirty = true
    wake()
  }

  let run: Run | null = null
  let plays = 0

  function settle(): void {
    setView(REST)
    canvas.setAttribute('aria-label', HERO_LABEL)
  }

  function stop(): void {
    if (run === null) return
    plays += 1
    run.stop()
    run = null
    settle()
    NowPlaying.release(stop)
    mercListen('blue', false)
    mercListen('orange', false)
  }

  /** The ring as a figure sounds: its room lit and its beads glowing, a fourth corner growing out. */
  function show(f: Figure, what: HeroPlay): void {
    const chord =
      revealed && what === 'f' && f.notes.length === 4 ? CHORDS.V7 : f.chord
    if (chord === undefined) return
    const four = f.notes.length === 4
    const named = chord.id === 'V' || chord.id === 'I' || chord.id === 'V7'
    setView({
      ...EMPTY_VIEW,
      rooms: [
        { chord, lit: true },
        ...(chord.id === 'I'
          ? [{ chord: CHORDS.V, lit: false }]
          : [{ chord: CHORDS.I, lit: false }]),
      ],
      growing: four ? { id: chord.id, since: performance.now() } : null,
      sounding: f.notes.map((n) => midiOf(n)),
      centre: chord.centre,
    })
    const line = named ? figureSaid(chord, f.notes) : lettersSaid(f.notes)
    said.textContent = line
    canvas.setAttribute('aria-label', `Lesson 12's ring of rooms: ${line}`)
  }

  /** Plays V then I, or with a fourth note; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    const id: HeroPlay = what === 'f' || what === 'fsharp' ? what : 'vi'
    const figures = heroPlay(id)
    const notes: RunNote[] = figures.flatMap((f) =>
      f.notes.map((n) => ({
        t: f.at,
        midi: midiOf(n),
        dur: f.dur,
        gain: gainOf(f.notes.length),
      })),
    )
    mercListen('blue', true)
    mercListen('orange', true)
    let shown = -1
    const going = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (n) => {
        if (mine !== plays) return
        const i = figures.findIndex((f) => f.at === n.t)
        if (i <= shown) return
        shown = i
        show(figures[i], id)
      },
    })
    run = going
    return going.done.then((heard) => {
      if (mine !== plays) return false
      run = null
      settle()
      NowPlaying.release(stop)
      mercListen('blue', false)
      mercListen('orange', false)
      return heard
    })
  }

  // the welcome tour waits for the choice, which its steps' stop would answer
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const heldLines = qa(
    '[data-held-line="1"], [data-held-line="2"], [data-held-line="3"]',
  )
  const predict = mountPredict(q('#predict'), {
    play,
    // the three plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['f', 'fsharp'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    // the hero's own reveal first, where the kit writes "You said", then
    // Step 1's paragraph on so and Steps 2 and 3's text, which waited for it
    reveal: [
      q('#predict .reveal'),
      q('[data-held="1"]'),
      q('[data-held="2"]'),
      q('[data-held="3"]'),
    ],
    onChoice: (c) => {
      // the choice ends Play V, then I: the predict moves focus to the
      // answering plays
      stop()
      chose(c)
      o.onChoice()
    },
    onReveal: () => {
      revealed = true
      heldLines.forEach((l) => {
        l.hidden = true
      })
      // the guess line's sharp, said as a word
      const line = q('#predict .reveal .mono')
      line.innerHTML = signsHtml(line.textContent ?? '')
      mercCelebrate('orange', 1600)
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)

  return { predict, spiral, stop }
}
