// ============================================================
// Lesson 16 cold open — five plain notes, and Tavi's two tries at them
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (WEB-SPEC, Sections;
// Toys 1): Merc and Tavi either side of a treble staff, the staff toy's
// drawing in a fixed state (kit/staff-draw.ts), with its clef and five
// plain noteheads, G4, A4, B4, A4 and G4: no stems, no names, no house,
// nothing lit, and no taps (FACTS 32). The kit's predict asks what Tavi
// will sing with no note to start from, and its two tries unlock with the
// choice (FACTS 33, 66):
//
// - Tavi sings, no note first: F4, G4, A4, G4, F4 on "ooh", 0.6 s a note,
//   3.0 s; as each sounds an orange notehead appears where she sang it,
//   one place under its written note, just to its right so both read.
// - One note first, then Tavi sings: G4 in the soft tone for 1.0 s,
//   lighting the first written note, 0.4 s of quiet, then Tavi's G4, A4,
//   B4, A4, G4, each orange notehead landing on its written note, 4.4 s.
//
// Tavi's notes stay until the next try; only the one sounding keeps its
// halo. Her line is one voice along a contour, each note held, then
// glided to the next. While she sings her Merc sings and Merc listens; a
// polite line says what each try drew once it is heard to its end. The
// reveal waits until both tries have been heard to their end with sound on
// (`revealAfter: 'all'`). A try cut short, by another sound, a step change
// of the deck or the hero off screen, is not heard. Tavi gives a quiet
// "oh" at the reveal, with no sparkles: it calls no choice right. On a
// first visit the welcome tour waits for the choice (kit/tour-gate.ts
// `holdTour`): Step 2's text answers it.

import { q, qa } from '@/features/lessons/kit/dom'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercSing, } from '@/features/lessons/kit/merc-duo'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLines, playNotes } from '@/features/lessons/kit/run'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { contourOf } from '@/features/lessons/kit/sound'
import { scoreAcross } from '@/features/lessons/kit/staff'
import type { Mark, Scene } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene } from '@/features/lessons/kit/staff-draw'
import { midiOf, placeRange } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'

/** Tavi's two tries, each its button's `data-play`. */
export type Try = 'alone' | 'note'

/** Natural notes in the fourth octave, the treble staff's. */
const line = (letters: readonly Letter[]): Spelled[] =>
  letters.map((letter) => ({ letter, alter: 0, octave: 4 }))

/** The written line, the hero's five notes (FACTS 32). */
export const WRITTEN: readonly Spelled[] = line(['G', 'A', 'B', 'A', 'G'])

/** What Tavi sings in each try: a tone under each written note, then on them (FACTS 33). */
export const SUNG: Readonly<Record<Try, readonly Spelled[]>> = {
  alone: line(['F', 'G', 'A', 'G', 'F']),
  note: WRITTEN,
}

/** A sung note, s, of which the last tenth glides to the next. */
export const NOTE_SEC = 0.6
const GLIDE_SEC = 0.1
/** The note first, G4 in the soft tone, and the quiet after it, s. */
export const START_SEC = 1
export const QUIET_SEC = 0.4
/** When Tavi's line begins in each try, s. */
export const LINE_AT: Readonly<Record<Try, number>> = {
  alone: 0,
  note: START_SEC + QUIET_SEC,
}
/** How long each try lasts, s: 3.0 and 4.4 (FACTS 66). */
export const TRY_SEC: Readonly<Record<Try, number>> = {
  alone: LINE_AT.alone + 5 * NOTE_SEC,
  note: LINE_AT.note + 5 * NOTE_SEC,
}

/** Tavi's line as one voice: each note held, then glided to the next, 0.6 s apart. */
export function taviLine(notes: readonly Spelled[]): ContourPoint[] {
  const midis = notes.map(midiOf)
  return contourOf(
    hz(midis[0]),
    midis.flatMap((_m, i) =>
      i < midis.length - 1
        ? [
            { hold: NOTE_SEC - GLIDE_SEC },
            { glide: GLIDE_SEC, to: hz(midis[i + 1]) },
          ]
        : [{ hold: NOTE_SEC }],
    ),
  )
}

/** The predict's words (LESSON.md; WEB-SPEC, Toys 1; FACTS 35). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both tries.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play either try again.',
  },
  guess: { jumble: 'You said: a jumble', tune: 'You said: the tune' },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the figure says each try drew, once heard to its end. */
export const TRY_SAID: Readonly<Record<Try, string>> = {
  alone: 'Tavi sang F, G, A, G, F: each a step under the written note.',
  note: 'Tavi sang G, A, B, A, G: each on its written note.',
}

// ---------------------------------------------------------------- the picture

/** What the staff shows at one moment. */
export interface HeroView {
  /** The try whose notes are drawn, or none. */
  readonly what: Try | null
  /** How many of Tavi's notes are drawn. */
  readonly sung: number
  /** Her note sounding, its halo kept; null between notes. */
  readonly sounding: number | null
  /** The note first sounding: the first written note lit. */
  readonly start: boolean
}

/** At first paint: the five plain notes, nothing lit. */
export const REST_VIEW: HeroView = {
  what: null,
  sung: 0,
  sounding: null,
  start: false,
}

/** How far right of its written note a note sung under it sits, in columns. */
const BESIDE = 0.3

/** The written notes, then Tavi's sung so far, each in orange. */
export function heroMarks(v: HeroView): Mark[] {
  const written: Mark[] = WRITTEN.map((note, i) => ({
    note,
    col: i,
    tone: v.start && i === 0 ? 'lit' : 'rest',
  }))
  if (v.what === null) return written
  const sung = SUNG[v.what].slice(0, v.sung).map(
    (note, i): Mark => ({
      note,
      col: midiOf(note) === midiOf(WRITTEN[i]) ? i : i + BESIDE,
      tone: 'orange',
    }),
  )
  return [...written, ...sung]
}

/** The hero's staff for `v`: the treble staff, as roomy as the staff toy's. */
export const heroScene = (v: HeroView): Scene => ({
  ...emptyScene('treble', placeRange('treble')),
  marks: heroMarks(v),
  cols: WRITTEN.length,
  across: scoreAcross(WRITTEN.length),
})

/** Draws `v` on `el`: only the note sounding keeps its halo. */
export function drawHero(el: SVGSVGElement, v: HeroView): void {
  drawScene(el, heroScene(v))
  qa('.st-mark', el).forEach((g, i) => {
    const sungAt = i - WRITTEN.length
    if (sungAt >= 0 && sungAt !== v.sounding)
      g.querySelector('.st-halo')?.remove()
  })
}

// ---------------------------------------------------------------- the hero

export interface ColdOpenOptions {
  /** Hears the choice the moment it locks. */
  readonly onChoice?: (choice: string) => void
}

export interface ColdOpen {
  readonly predict: Predict
  /** What the staff shows. */
  readonly view: HeroView
  /** Ends what the hero plays. */
  stop(): void
}

/**
 * Mounts the cold open on the hero; a step change of the steps' `deck`
 * ends its try. Call it after the masthead's start, in the same task, so
 * a first visit's tour waits for the choice.
 */
export function initColdOpen(
  deck: Pick<StepDeck, 'subscribe'>,
  o: ColdOpenOptions = {},
): ColdOpen {
  const stage = q('#heroStage')
  const el = q<SVGSVGElement>('[data-hero-staff]', stage)
  const said = q('[data-hero-said]', stage)
  stillSky(stage)
  let view = REST_VIEW
  let run: Run | null = null
  let timers: number[] = []
  let dirty = true
  let drawnAt = ''

  const sizes = (): string => {
    const r = el.getBoundingClientRect()
    return `${Math.round(r.width)}x${Math.round(r.height)}`
  }
  const show = (next: HeroView): void => {
    view = next
    dirty = true
    wake()
  }

  addDrawer({
    active: watch(stage),
    wants: () => dirty || sizes() !== drawnAt,
    draw: () => {
      drawHero(el, view)
      drawnAt = sizes()
      dirty = false
    },
  })

  const clearTimers = (): void => {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
  }
  const at = (sec: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, sec * 1000))
  }

  function stop(): void {
    run?.stop()
  }

  /** Plays one try; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    const which: Try = what === 'note' ? 'note' : 'alone'
    const notes = SUNG[which]
    const parts: Run[] = []
    if (which === 'note')
      parts.push(
        playNotes([{ t: 0, midi: midiOf(WRITTEN[0]), dur: START_SEC }], {
          audible,
          kind: 'soft',
        }),
      )
    parts.push(
      playLines([{ t: LINE_AT[which], points: taviLine(notes) }], {
        audible,
        kind: 'merc',
      }),
    )
    const going = allOf(parts)
    run = going
    const stopMine = (): void => {
      going.stop()
    }
    NowPlaying.claim(stopMine)
    clearTimers()
    said.textContent = ''
    // Tavi's notes from before go as a try starts
    show({ what: which, sung: 0, sounding: null, start: which === 'note' })
    if (which === 'note') at(START_SEC, () => show({ ...view, start: false }))
    notes.forEach((n, i) =>
      at(LINE_AT[which] + i * NOTE_SEC, () => {
        mercSing('orange', midiOf(n), true)
        show({ ...view, sung: i + 1, sounding: i })
      }),
    )
    mercListen('blue', true)
    return going.done.then((heard) => {
      NowPlaying.release(stopMine)
      if (run !== going) return heard
      run = null
      clearTimers()
      mercSing('orange', midiOf(notes[notes.length - 1]), false)
      mercListen('blue', false)
      show({
        ...view,
        sung: heard ? notes.length : view.sung,
        sounding: null,
        start: false,
      })
      if (heard) said.textContent = TRY_SAID[which]
      return heard
    })
  }

  // the welcome tour waits for the choice, which Step 2's text answers
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const predict = mountPredict(q('#predict'), {
    play,
    // the two tries sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['alone', 'note'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    onChoice: (c) => {
      chose(c)
      o.onChoice?.(c)
    },
    // Tavi, quietly: the reveal calls no choice right
    onReveal: () => mercCelebrate('orange', 1600),
  })

  // leaving the hero ends its try: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  wake()

  return {
    predict,
    get view() {
      return view
    },
    stop,
  }
}
