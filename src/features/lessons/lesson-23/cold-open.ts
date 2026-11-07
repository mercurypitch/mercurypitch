// ============================================================
// Lesson 23 cold open — the octave stood upright between Merc and Tavi, split two ways
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the hero's own pitch line, the three plays
// under it, then the predict (WEB-SPEC, Toys 2 and 3). The pitch line is
// Lesson 2's semitone ruler stood upright: C4 at its foot and C5 at its
// top, both named, and between them the words "an octave: 12 semitones".
// Nothing else is drawn before a choice: no lane, no note, no name between
// the two Cs (FACTS 1a, 40). It plays C4 to C5 for everyone, Tavi's
// register, since the voice choice comes later on the page (FACTS 8).
//
// Play C up to C works from the start: C4, then C5, then the two together,
// each lighting its end of the line as it sounds, 2.6 s; it never reveals.
// Play C, G, C and Play C, F♯, C wait for a choice: C4, the middle note and
// C5, one at a time, then C4 and the middle note together, 3.3 s (FACTS
// 44, 67). As the middle note sounds it lands at its height and is named,
// the thirteen lanes draw in (0.4 s), and the two leaps are counted beside
// the line, 7 and 5 for G, 6 and 6 for F♯; each play draws its own middle
// note, and the line keeps its lanes and the last split.
//
// The reveal waits for both splits heard to their end with sound on, in
// either order (the kit's predict, `revealAfter: 'all'`). A play cut short,
// by another sound, a step change of the deck or the hero off screen, is
// not heard and changes nothing. Merc and Tavi listen while any of the
// three plays, and Tavi celebrates once at the reveal. The choice tells
// the steps' staff toy that it may offer what it held back (steps.ts
// `unlock`), and on a first visit the welcome tour waits for it
// (kit/tour-gate.ts `holdTour`), since its steps' stop would answer it.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { Spelled } from '@/features/lessons/kit/notes'
import { isBlack, signName, wordName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { figureSize } from '@/features/lessons/kit/staff-draw'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { note } from './sounds'

const C4 = 60
const C5 = 72

/** Each split's middle note (FACTS 44). */
export const MIDDLE: Readonly<Record<'g' | 'fs', Spelled>> = {
  g: note('G'),
  fs: note('F', 1),
}

/** Play C up to C: C4, C5, then both, 2.6 s (FACTS 67). */
export const OCTAVE_NOTES: readonly RunNote[] = [
  { t: 0, midi: C4, dur: 0.6 },
  { t: 0.7, midi: C5, dur: 0.6 },
  { t: 1.4, midi: C4, dur: 1.2 },
  { t: 1.4, midi: C5, dur: 1.2 },
]

/** A split: C4, the middle note and C5, then C4 and the middle note together, 3.3 s (FACTS 67). */
export const splitNotes = (mid: Spelled): RunNote[] => [
  { t: 0, midi: C4, dur: 0.6 },
  { t: 0.7, midi: midiOf(mid), dur: 0.6 },
  { t: 1.4, midi: C5, dur: 0.6 },
  { t: 2.1, midi: C4, dur: 1.2 },
  { t: 2.1, midi: midiOf(mid), dur: 1.2 },
]

/** The predict's words (LESSON.md; WEB-SPEC, Toys 3); there is no `next` hint. */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both splits.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play any of them again.',
  },
  guess: { g: 'You said: G', fs: 'You said: F♯' },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the polite line says as each split's middle note sounds (WEB-SPEC, Toys 2). */
export const HERO_SAID = {
  octave: 'C4, then C5, an octave up, then the two together.',
  g: 'G: seven semitones up, five more to the top C.',
  fs: 'F sharp: six semitones up, six more to the top C.',
} as const

/** The figure's name before a split, and after one, in words. */
const HERO_LABEL = {
  ends: 'The pitch line, upright: C4 at its foot and C5 at its top, an octave of 12 semitones',
  split: (mid: Spelled): string =>
    `The pitch line, upright: thirteen lanes from C4 to C5, split at ${wordName(mid)}: ${midiOf(mid) - C4} semitones up, ${C5 - midiOf(mid)} more to C5`,
} as const

/** The black-key lanes and the rest draw in, ms (WEB-SPEC, Look). */
const LANES_MS = 400

export interface HeroScene {
  /** The lanes drawn in, 0 to 1; 0 before any split. */
  readonly lanes: number
  /** The split shown: its middle note, or none. */
  readonly mid: Spelled | null
  /** The notes sounding now, by MIDI. */
  readonly lit: readonly number[]
}

const r = (v: number): string => v.toFixed(2)

/** Draws the hero's line: its two named ends, then, once split, its thirteen lanes, the middle note and the two counts. */
export function drawHero(
  el: SVGSVGElement,
  s: HeroScene,
  size: { w: number; h: number },
): void {
  const { w, h } = size
  el.replaceChildren()
  el.setAttribute('viewBox', `0 0 ${r(w)} ${r(h)}`)
  const pad = 14
  const lh = (h - 2 * pad) / 13
  const laneW = Math.min(72, Math.max(44, w * 0.26))
  const cx = w / 2
  const x0 = cx - laneW / 2
  const x1 = cx + laneW / 2
  const yOf = (midi: number): number => pad + (C5 - midi + 0.5) * lh
  const lit = new Set(s.lit)
  const font = Math.min(16, Math.max(12, lh * 0.7))
  const g = svg('g', { class: 'hl-line' }, el)
  svg(
    'line',
    { x1: r(cx), x2: r(cx), y1: r(yOf(C5)), y2: r(yOf(C4)), class: 'hl-rail' },
    g,
  )
  for (let m = C4; m <= C5; m++) {
    const end = m === C4 || m === C5
    const shown = end ? 1 : s.lanes
    if (shown <= 0) continue
    const lw = laneW * shown
    svg(
      'rect',
      {
        x: r(cx - lw / 2),
        y: r(yOf(m) - lh / 2 + 0.5),
        width: r(lw),
        height: r(Math.max(0.5, lh - 1)),
        rx: 1,
        opacity: end ? undefined : r(shown),
        class: `hl-lane ${isBlack(m) ? 'is-black' : 'is-white'}${lit.has(m) ? ' is-lit' : ''}`,
      },
      g,
    )
  }
  const name = (n: Spelled): void => {
    svg(
      'text',
      {
        x: r(x1 + 8),
        y: r(yOf(midiOf(n)) + font * 0.36),
        'font-size': r(font),
        class: 'hl-name',
        text: signName(n),
      },
      g,
    )
  }
  name(note('C'))
  name(note('C', 0, 5))
  if (s.mid === null) {
    // the octave's size, and nothing that says where it splits
    const mid = (yOf(C4) + yOf(C5)) / 2
    for (const [i, line] of ['an octave:', '12 semitones'].entries())
      svg(
        'text',
        {
          x: r(x0 - 10),
          y: r(mid + (i - 0.5) * font * 1.3 + font * 0.36),
          'font-size': r(font * 0.92),
          'text-anchor': 'end',
          class: 'hl-octave',
          text: line,
        },
        g,
      )
    return
  }
  const m = midiOf(s.mid)
  name(s.mid)
  // the two leaps, counted beside the line: a bracket each, its semitones by it
  const bx = x0 - 8
  for (const [lo, hi] of [
    [C4, m],
    [m, C5],
  ]) {
    const y0 = yOf(lo)
    const y1 = yOf(hi)
    svg(
      'path',
      {
        d: `M${r(bx + 4)} ${r(y0)}H${r(bx)}V${r(y1)}H${r(bx + 4)}`,
        class: 'hl-leap',
      },
      g,
    )
    svg(
      'text',
      {
        x: r(bx - 6),
        y: r((y0 + y1) / 2 + font * 0.36),
        'font-size': r(font),
        'text-anchor': 'end',
        class: 'hl-count',
        text: String(hi - lo),
      },
      g,
    )
  }
}

export interface ColdOpen {
  readonly predict: Predict
  stop(): void
}

/**
 * Mounts the cold open on the hero; a step change of the steps' `deck`
 * ends its play, and the choice reaches `onChoice`. Call it after the
 * masthead's start, in the same task, so a first visit's tour waits for
 * the choice.
 */
export function initColdOpen(
  deck: Pick<StepDeck, 'subscribe'>,
  onChoice: () => void,
): ColdOpen {
  const stage = q('#heroStage')
  const figure = q('#heroLine')
  const el = q<SVGSVGElement>('[data-hero-svg]', figure)
  const said = q('[data-hero-said]', figure)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  let mid: Spelled | null = null
  let lanesAt: number | null = null
  let lanesIn = false
  let lit: number[] = []
  let run: Run | null = null
  let plays = 0
  // each lit note's return to rest, until its note ends: a play that ends,
  // heard or cut short, clears its own, so none fires after the play, or
  // after a page (or a test's document) has gone
  let timers: number[] = []

  function clearTimers(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
  }

  function lanes(now: number): number {
    if (!lanesIn) return 0
    if (lanesAt === null) return 1
    const u = Math.min(1, (now - lanesAt) / LANES_MS)
    if (u >= 1) lanesAt = null
    return u
  }

  function draw(now = performance.now()): void {
    drawHero(el, { lanes: lanes(now), mid, lit }, figureSize(el))
  }

  addDrawer({
    active: watch(stage),
    wants: () => lanesAt !== null,
    draw: (now) => draw(now),
  })
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(() => draw()).observe(el)

  function stop(): void {
    clearTimers()
    if (run === null) return
    plays += 1
    run.stop()
    run = null
    lit = []
    NowPlaying.release(stop)
    mercListen('blue', false)
    mercListen('orange', false)
    draw()
  }

  /** Plays the octave or a split; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    const split = what === 'g' || what === 'fs' ? MIDDLE[what] : null
    const notes = split === null ? OCTAVE_NOTES : splitNotes(split)
    mercListen('blue', true)
    mercListen('orange', true)
    if (split === null) said.textContent = HERO_SAID.octave
    const going = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (n) => {
        if (mine !== plays) return
        // the middle note lands at its height, named, and the lanes draw in
        if (split !== null && n.midi === midiOf(split) && n.t < 1) {
          mid = split
          if (!lanesIn) {
            lanesIn = true
            lanesAt = reducedMotion() ? null : performance.now()
            wake()
          }
          el.setAttribute('aria-label', HERO_LABEL.split(split))
          said.textContent = HERO_SAID[what === 'g' ? 'g' : 'fs']
        }
        lit = [...lit, n.midi]
        const rest = window.setTimeout(() => {
          timers = timers.filter((id) => id !== rest)
          if (mine !== plays) return
          lit = lit.filter((x) => x !== n.midi)
          draw()
        }, n.dur * 1000)
        timers.push(rest)
        draw()
      },
    })
    run = going
    draw()
    return going.done.then((heard) => {
      if (mine !== plays) return false
      run = null
      clearTimers()
      lit = []
      NowPlaying.release(stop)
      mercListen('blue', false)
      mercListen('orange', false)
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
    // the three plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['g', 'fs'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    onChoice: (c) => {
      chose(c)
      onChoice()
    },
    onReveal: () => mercCelebrate('orange', 1600),
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  el.setAttribute('aria-label', HERO_LABEL.ends)
  draw()

  return { predict, stop }
}
