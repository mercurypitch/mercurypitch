// ============================================================
// Lesson 15 cold open — the pitch line between Merc and Tavi, folded into five lines
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the hero's own pitch line, the two plays
// under it, then the predict (WEB-SPEC, Toys 2 and 3). The pitch line is
// Season 1's picture of pitch as height: a lane for every semitone from D4
// to G5, the white-key lanes chrome and the black-key lanes fainter.
// Nothing else is drawn before a choice: no line, space, clef or letter,
// since any of them would count the places for the learner (FACTS 1a).
//
// Play the climb works from the start: E4 up to F5, one white key every
// 0.6 s, each lighting its lane as it sounds, which answers nothing. Once a
// choice locks, Play it on the five lines folds the pitch line into a
// staff over 0.8 s: the black-key lanes narrow to nothing, the white-key
// lanes slide together, every other one becoming a line and the rest the
// spaces between, and a treble clef fades in; then the same climb lands
// note by note on its line or space, bottom line to top, on the one run's
// clock, so the fold ends as the first note sounds. With motion reduced
// the pitch line and the staff cross-fade instead. The staff stays, and
// the pitch line comes back beside it, so both plays light a lane and a
// place from then on.
//
// The reveal waits for the climb on the five lines heard to its end with
// sound on (the kit's predict). A play cut short, by another sound, a step
// change of the deck or the hero off screen, is not heard and changes
// nothing. Merc and Tavi listen while either plays, and Tavi celebrates at
// the reveal. On a first visit the welcome tour waits for the choice
// (kit/tour-gate.ts `holdTour`), since its steps' stop counts the places.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { isBlack } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { PlayNote } from '@/features/lessons/kit/staff'
import type { Mark, Scene } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene, engraveClef, figureSize, layoutScene, } from '@/features/lessons/kit/staff-draw'
import { midiOf, placeOf, writtenOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { CLIMB, evenly } from './sounds'

/** The hero's pitch line, D4 to G5 (FACTS 33). */
export const HERO_LANES = { lo: 62, hi: 79 } as const

/** The places the hero's staff makes room for: D4 to G5, just past each edge line. */
const ROOM: readonly [number, number] = [-1, 9]

/** How long the fold takes, s (FACTS 62). */
export const FOLD_SEC = 0.8

/** The climb, E4 to F5, 0.5 s notes with onsets 0.6 s apart (FACTS 62). */
export const CLIMB_NOTES: readonly PlayNote[] = evenly(CLIMB, 0.5, 0.6)

/** The climb on the five lines: the fold, then the climb, 6.1 s. */
export const LINES_NOTES: readonly PlayNote[] = CLIMB_NOTES.map((n) => ({
  ...n,
  t: Math.round((n.t + FOLD_SEC) * 1000) / 1000,
}))

/** The predict's words (LESSON.md; WEB-SPEC, Toys 3). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Now play the climb on the five lines.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play the climb again, on the pitch line or on the five lines.',
  },
  guess: { five: 'You said: five', nine: 'You said: nine' },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the hero's figure says while each play sounds; neither counts the places. */
export const HERO_SAID = {
  climb: 'The climb: E4 up to F5, one white key at a time.',
  lines:
    'The climb on the five lines: E4 on the bottom line, up to F5 on the top line.',
} as const

const HERO_LABEL = {
  lanes: 'The pitch line: a lane for every semitone from D4 to G5',
  staff: 'The treble staff, with the pitch line beside it',
} as const

export interface ColdOpen {
  readonly predict: Predict
  /** Whether the pitch line has folded into the staff. */
  readonly folded: boolean
  stop(): void
}

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u
const ease = (u: number): number => 1 - (1 - u) ** 3

/** The line weight the staff's lines are drawn at, px (lesson-staff.css `--staff-weight`). */
const WEIGHT = 1.3

/**
 * The pitch line, `u` of the way through its fold into the staff: each
 * white-key lane slides to its place, a line's lane thinning to a line and
 * a space's fading, each black-key lane narrowing to nothing, and the
 * clef fading in.
 */
function drawFold(
  el: SVGSVGElement,
  lit: ReadonlySet<number>,
  u: number,
): void {
  const size = figureSize(el)
  const L = layoutScene(size.w, size.h, emptyScene('treble', ROOM))
  el.replaceChildren()
  el.setAttribute('viewBox', `0 0 ${size.w.toFixed(2)} ${size.h.toFixed(2)}`)
  const pad = 12
  const n = HERO_LANES.hi - HERO_LANES.lo + 1
  const band = (size.h - 2 * pad) / n
  const k = ease(u)
  const g = svg('g', { class: 'st-lanes' }, el)
  for (let m = HERO_LANES.lo; m <= HERO_LANES.hi; m++) {
    const black = isBlack(m)
    const top = pad + (HERO_LANES.hi - m) * band
    const place = black ? null : placeOf(writtenOf(m), 'treble')
    const line = place !== null && place >= 0 && place <= 8 && place % 2 === 0
    const cy = lerp(
      top + band / 2,
      place === null ? top + band / 2 : L.yOf(place),
      k,
    )
    const h = lerp(band - 1, line ? WEIGHT : 0, k)
    const x0 = lerp(pad, L.x0, k)
    const x1 = lerp(size.w - pad, L.x1, k)
    svg(
      'rect',
      {
        x: x0.toFixed(2),
        y: (cy - h / 2).toFixed(2),
        width: Math.max(0, x1 - x0).toFixed(2),
        height: Math.max(0, h).toFixed(2),
        rx: 1,
        opacity: line ? 1 : (1 - k).toFixed(3),
        class: `st-lane ${black ? 'is-black' : 'is-white'}${lit.has(m) ? ' is-lit' : ''}`,
      },
      g,
    )
  }
  if (k <= 0) return
  engraveClef(
    'treble',
    L.x0 + L.space * 0.3,
    L.yOf(0),
    L.space,
    el,
  ).setAttribute('opacity', k.toFixed(3))
}

/**
 * Mounts the cold open on the hero; a step change of the steps' `deck`
 * ends its play. Call it after the masthead's start, in the same task, so
 * a first visit's tour waits for the choice.
 */
export function initColdOpen(deck: Pick<StepDeck, 'subscribe'>): ColdOpen {
  const stage = q('#heroStage')
  const figure = q('#heroStaff')
  const el = q<SVGSVGElement>('[data-hero-svg]', figure)
  const said = q('[data-hero-said]', figure)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  let folded = false
  // the fold under way: when it started, by the frame loop's clock
  let foldFrom: number | null = null
  let marks: Mark[] = []
  let run: Run | null = null
  let plays = 0

  function scene(): Scene {
    return {
      ...emptyScene('treble', ROOM),
      // a note not yet sounded leaves its column empty
      marks: marks.filter((m) => m !== undefined),
      cols: CLIMB.length,
      lanes: { ...HERO_LANES },
    }
  }

  const lit = (): Set<number> =>
    new Set(marks.filter((m) => m.tone !== 'rest').map((m) => midiOf(m.note)))

  function draw(now = performance.now()): void {
    if (folded) {
      drawScene(el, scene())
      return
    }
    if (foldFrom === null) {
      drawFold(el, lit(), 0)
      return
    }
    const u = Math.min(1, (now - foldFrom) / (FOLD_SEC * 1000))
    if (!reducedMotion()) {
      drawFold(el, lit(), u)
      return
    }
    // reduced motion: the pitch line and the staff cross-fade
    drawFold(el, lit(), 0)
    const g = el.querySelector('.st-lanes')
    g?.setAttribute('opacity', (1 - u).toFixed(3))
    const staff = svg('svg', { class: 'hero-fade', opacity: u.toFixed(3) }, el)
    drawScene(staff, { ...emptyScene('treble', ROOM) }, figureSize(el))
  }

  addDrawer({
    active: watch(stage),
    wants: () => foldFrom !== null && !folded,
    draw: (now) => draw(now),
  })
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(() => draw()).observe(el)

  /** The fold has ended: the staff stays, with the pitch line beside it. */
  function settle(): void {
    if (folded) return
    folded = true
    foldFrom = null
    el.setAttribute('aria-label', HERO_LABEL.staff)
  }

  function stop(): void {
    if (run === null) return
    plays += 1
    run.stop()
    run = null
    if (foldFrom !== null) settle()
    marks = marks.map((m) => ({ ...m, tone: 'rest' }))
    NowPlaying.release(stop)
    mercListen('blue', false)
    mercListen('orange', false)
    draw()
  }

  /** Plays the climb, on the pitch line or on the five lines; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    const lines = what === 'lines'
    const notes = lines && !folded ? LINES_NOTES : CLIMB_NOTES
    marks = []
    if (lines && !folded) {
      foldFrom = performance.now()
      wake()
    }
    mercListen('blue', true)
    mercListen('orange', true)
    said.textContent = lines ? HERO_SAID.lines : HERO_SAID.climb
    const r = playNotes(
      notes.map((n) => ({ t: n.t, midi: midiOf(n.note), dur: n.dur })),
      {
        audible,
        kind: 'soft',
        onNote: (_n, i) => {
          if (mine !== plays) return
          // the fold ends as the first note sounds, on the run's own clock
          if (foldFrom !== null) settle()
          const at = notes[i]
          const next = marks.slice()
          // on the staff each note keeps its column; on the pitch line only
          // the lane lights, until the staff has been drawn
          next[i] = { note: at.note, col: i, tone: 'lit' }
          marks = next
          draw()
          window.setTimeout(() => {
            if (mine !== plays) return
            const back = marks.slice()
            if (back[i] !== undefined) back[i] = { ...back[i], tone: 'rest' }
            marks = back
            draw()
          }, at.dur * 1000)
        },
      },
    )
    run = r
    draw()
    return r.done.then((heard) => {
      if (mine !== plays) return false
      run = null
      NowPlaying.release(stop)
      mercListen('blue', false)
      mercListen('orange', false)
      // every note has ended with the run: before the fold the lanes keep
      // no note, and on the staff the climb stays, at rest
      marks = folded ? marks.map((m) => ({ ...m, tone: 'rest' })) : []
      draw()
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
    // the two plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['lines'],
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    onChoice: (c) => chose(c),
    onReveal: () => mercCelebrate('orange', 1600),
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  el.setAttribute('aria-label', HERO_LABEL.lanes)
  draw()

  return {
    predict,
    get folded() {
      return folded
    },
    stop,
  }
}
