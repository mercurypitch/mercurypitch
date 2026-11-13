// ============================================================
// Lesson 25 cold open — a tune on Lesson 10's minor staircase, and the chord before home
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of Lesson 10's minor staircase on A, A3 to A4,
// do re me fa so le te do with the house on do, its three plays under it,
// then the predict (WEB-SPEC, Toys 2 and 3). It is the steps' staircase
// alone: no staff, since the voice choice comes later, and A3 to A4 for
// everyone, Merc's register, so its stairs light in Merc's blue (FACTS 8).
//
// Play the tune, twice works from the start: four bars on Merc's "ooh",
// 8.0 s, a second of quiet, and again with G sharp 4 for G4 in the last
// bar, 17.0 s, each note lighting its stair. As the G sharp sounds, the te
// stair lifts a semitone and reads ti, and it settles back when the play
// ends (FACTS 30, 31, 59). No chord plays and none is drawn.
//
// Play ending 1, with chords and Play ending 2, with chords wait for a
// choice: bars 3 and 4 on "ooh" over A minor, the chord before home and A
// minor again, three soft voices at 0.05 each under the tune, 4.0 s (FACTS
// 34, 59). As the chord before home sounds, the chord column draws in at
// the staircase's right (0.4 s), its beads lit while it sounds; a column
// still drawn from ending 1 slides its middle bead up a row for ending 2.
// The column stands on the staircase's own rows, the chord's E on so's row
// and its G on te's, an octave over the chord the play sounds, so it names
// its letters with no octave. It stays until the next play: an ending
// redraws it, and the tune play, which draws no chord, takes it away
// (WEB-SPEC, Toys 2).
//
// The reveal waits for both endings heard to their end with sound on, in
// either order (the kit's predict, `revealAfter: 'all'`). A play cut short,
// by another sound, a step change of the deck or the hero off screen, is
// not heard and changes nothing; the column keeps what it last drew. Merc
// and Tavi listen while any play sounds, and Tavi celebrates once at the
// reveal. The choice enables the steps' and the free play's held controls
// (`unlocks`) and tells both toys (`onChoice`), and the reveal shows Step
// 1's paragraph on the chord on so as its second element, its held line
// put away (FACTS 36). On a first visit the welcome tour waits for the
// choice (kit/tour-gate.ts `holdTour`), since its steps' stop would answer
// it.

import type { ChordColumn } from '@/features/lessons/kit/chord-column'
import { chordColumn, COLUMN_W } from '@/features/lessons/kit/chord-column'
import { HARMONIC_MINOR_DEGREES, NATURAL_MINOR_DEGREES, TE_STAIR, } from '@/features/lessons/kit/chords'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { COLOR } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { UNDER_GAIN } from '@/features/lessons/kit/sound'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import type { StairsRoom } from '@/features/lessons/kit/stairs-geometry'
import type { NoteEvent } from '@/features/lessons/kit/stairs-plays'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { chordSaid, columnChord } from './minor-words'
import { rowsOf } from './sounds'

/** Do, A3, for everyone: Merc's register (FACTS 8). */
export const HERO_DO = 57

/** The last bar's G4, raised to G sharp 4 the second time and in ending 2. */
const G4 = 67

/**
 * The tune: A3 C4 E4 C4 | D4 C4 B3 | C4 B3 A3 | E4 G4 A4, a crotchet 0.5 s
 * and each bar's last note a minim, the first bar's four crotchets aside,
 * 8.0 s (FACTS 30).
 */
const BARS: readonly (readonly (readonly [midi: number, sec: number])[])[] = [
  [
    [57, 0.5],
    [60, 0.5],
    [64, 0.5],
    [60, 0.5],
  ],
  [
    [62, 0.5],
    [60, 0.5],
    [59, 1],
  ],
  [
    [60, 0.5],
    [59, 0.5],
    [57, 1],
  ],
  [
    [64, 0.5],
    [G4, 0.5],
    [69, 1],
  ],
]

/** One time through, and the quiet before the second, s (FACTS 31). */
const ONCE_SEC = 8
const BETWEEN_SEC = 1

/** The tune from bar `from` on, from `at` s; `raised` sings G sharp 4 for G4. */
function bars(from: number, raised: boolean, at = 0): RunNote[] {
  const notes: RunNote[] = []
  let t = at
  for (const bar of BARS.slice(from))
    for (const [midi, dur] of bar) {
      notes.push({ t, midi: raised && midi === G4 ? G4 + 1 : midi, dur })
      t += dur
    }
  return notes
}

/** Play the tune, twice: 8.0 s, 1.0 s of quiet, then again with G sharp 4, 17.0 s, no chord (FACTS 31, 59). */
export const TUNE_NOTES: readonly RunNote[] = [
  ...bars(0, false),
  ...bars(0, true, ONCE_SEC + BETWEEN_SEC),
]

/** A chord's three soft voices under the tune, 0.05 each (FACTS 58). */
const chord = (t: number, midis: readonly number[], dur: number): RunNote[] =>
  midis.map((midi) => ({ t, midi, dur, kind: 'soft', gain: UNDER_GAIN }))

/** The chord before home, and when it sounds in an ending, s (FACTS 34). */
export const BEFORE_HOME = { t: 2, dur: 1 } as const

/** The chord before home: E3 G3 B3, or with G raised E3 G sharp 3 B3 (FACTS 34). */
export const beforeHome = (raised: boolean): number[] => [
  52,
  raised ? 56 : 55,
  59,
]

/**
 * Play ending 1 or 2, with chords: bars 3 and 4 on "ooh" over A minor
 * (A2 C3 E3) for 2.0 s, the chord before home for 1.0 s and A minor (A3 C4
 * E4) for 1.0 s, 4.0 s (FACTS 34, 59).
 */
export const endingNotes = (raised: boolean): RunNote[] => [
  ...bars(2, raised),
  ...chord(0, [45, 48, 52], BEFORE_HOME.t),
  ...chord(BEFORE_HOME.t, beforeHome(raised), BEFORE_HOME.dur),
  ...chord(BEFORE_HOME.t + BEFORE_HOME.dur, [57, 60, 64], 1),
]

/** Each ending, by its play: the second raises G (FACTS 33). */
const ENDINGS: Readonly<Record<string, boolean>> = { end1: false, end2: true }

/** The predict's words (LESSON.md; WEB-SPEC, Toys 3); there is no `next` hint (FACTS 37). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both endings.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play any of them again.',
  },
  guess: {
    major: 'You said: it turns major',
    minor: 'You said: it stays minor',
  },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the polite line says as each play starts, and as G sharp lifts te (WEB-SPEC, Toys 2). */
export const HERO_SAID = {
  tune: 'The tune, twice, each note lighting its stair.',
  ti: 'The second time, G sharp: te lifts to ti.',
  end1: 'Ending 1, with its chords.',
  end2: 'Ending 2, with its chords.',
} as const

/** The figure's name, and with the column drawn beside it. */
export const HERO_LABEL = {
  rest: "Lesson 10's minor staircase on A, do to do, with the house on do",
  column: (raised: boolean): string =>
    `${HERO_LABEL.rest}, and beside it the chord before home: ${chordSaid(HERO_DO, raised)}`,
} as const

export interface ColdOpen {
  readonly predict: Predict
  readonly core: StairsCore
  readonly column: ChordColumn
  stop(): void
}

export interface ColdOpenOptions {
  /** Controls elsewhere that the choice enables too: Step 1's Raise te, the free play's held ones. */
  readonly unlocks: readonly HTMLButtonElement[]
  /** Hears the choice: the steps' toy and the free play draw their columns. */
  readonly onChoice: () => void
}

/** The tune's notes as the staircase lights them: G sharp on te's stair, which lifts to ti as it sounds. */
const eventsOf = (notes: readonly RunNote[]): NoteEvent[] =>
  notes
    .filter((n) => n.kind === undefined)
    .map((n) => ({
      midi: n.midi,
      at: n.t,
      dur: n.dur,
      stair: n.midi === G4 + 1 ? TE_STAIR : undefined,
    }))

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
  const box = q('#heroStairs')
  const canvas = q<HTMLCanvasElement>('[data-hero-canvas]', box)
  const said = q('[data-hero-said]', box)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  // The room the staircase keeps, read at every frame: the steps' treble
  // rows, A3 to C5, and at its right the part of Tavi's column the canvas
  // spans (a phone's, lesson-25.css), or, from the choice on, the column's
  // room, whichever is wider. So the stairs stand between Merc and Tavi,
  // narrow once as the choice unlocks the endings, and never move mid-play;
  // on a phone the column draws over Tavi's head.
  const tavi = q('#mercOrange')
  let spare = 0
  let choiceIn = false
  const room: StairsRoom = {
    get right() {
      return Math.max(spare, choiceIn ? COLUMN_W : 0)
    },
    rows: rowsOf('treble'),
  }
  // the column asks the staircase for frames once both exist
  let redraw = (): void => undefined
  const column = chordColumn(() => redraw())
  const core = mountStairs({
    canvas,
    compact: true,
    active: watch(stage),
    range: { lo: HERO_DO, hi: HERO_DO },
    degrees: NATURAL_MINOR_DEGREES,
    numbers: true,
    room,
    overlay: column,
  })
  redraw = () => core.redraw()
  core.set({ steps: true })

  function measure(): void {
    const over =
      box.getBoundingClientRect().right - tavi.getBoundingClientRect().left
    spare = Math.max(0, Math.ceil(over))
    core.redraw()
  }
  measure()
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(measure).observe(box)

  let run: Run | null = null
  let plays = 0

  /** Te back down, the lights out: the staircase at rest. */
  function settle(): void {
    core.stop()
    core.slideDegrees(NATURAL_MINOR_DEGREES)
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

  /** The chord before home sounds: the column draws in, or slides its middle bead, lit as it sounds. */
  function showChord(raised: boolean): void {
    column.set(columnChord(HERO_DO, raised, false))
    column.show(true)
    const t = performance.now() / 1000
    for (let i = 0; i < 3; i++) column.light(i, t, t + BEFORE_HOME.dur)
    canvas.setAttribute('aria-label', HERO_LABEL.column(raised))
    said.textContent = chordSaid(HERO_DO, raised)
  }

  /** Plays the tune or an ending; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    const raised = Object.hasOwn(ENDINGS, what) ? ENDINGS[what] : null
    const notes = raised === null ? TUNE_NOTES : endingNotes(raised)
    mercListen('blue', true)
    mercListen('orange', true)
    if (raised === null) {
      // the tune draws no chord: the column goes until an ending draws it
      column.show(false)
      canvas.setAttribute('aria-label', HERO_LABEL.rest)
      said.textContent = HERO_SAID.tune
    } else said.textContent = raised ? HERO_SAID.end2 : HERO_SAID.end1
    // the stairs light silently in Merc's blue; the run sounds
    void core.play(eventsOf(notes), false, { color: COLOR.blue })
    let chordShown = false
    const going = playNotes(notes, {
      audible,
      kind: 'merc',
      onNote: (n) => {
        if (mine !== plays) return
        if (n.midi === G4 + 1) {
          core.slideDegrees(HARMONIC_MINOR_DEGREES)
          if (raised === null) said.textContent = HERO_SAID.ti
        }
        if (
          raised !== null &&
          !chordShown &&
          n.kind !== undefined &&
          n.t === BEFORE_HOME.t
        ) {
          chordShown = true
          showChord(raised)
        }
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

  const predict = mountPredict(q('#predict'), {
    play,
    // the three plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['end1', 'end2'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    unlocks: o.unlocks,
    // the hero's own reveal first, where the kit writes "You said", then
    // Step 1's paragraph on the chord on so, which waited for it
    reveal: [q('#predict .reveal'), q('[data-chord-para]')],
    onChoice: (c) => {
      choiceIn = true
      core.redraw()
      chose(c)
      o.onChoice()
    },
    onReveal: () => {
      q('[data-held-line]').hidden = true
      mercCelebrate('orange', 1600)
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  canvas.setAttribute('aria-label', HERO_LABEL.rest)

  return { predict, core, column, stop }
}
