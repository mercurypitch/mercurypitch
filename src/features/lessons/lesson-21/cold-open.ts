// ============================================================
// Lesson 21 cold open — Lesson 2's ring over Lesson 1's keyboard, and A major's third sharp
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (WEB-SPEC, Sections 2 to
// 5; Toys 3 and 5): Merc and Tavi either side of Lesson 2's ring of twelve
// beads, a bead a semitone, with Lesson 1's keyboard under it from D4 to
// A5. At first paint D major's seven beads and keys are lit and its two
// black keys, F sharp and C sharp, glow with their names; there is no
// staff, and no degree is named (FACTS 33). Three plays sit under the
// stage, in the soft tone, a note every 0.4 s, each 0.35 s long, 3.15 s a
// scale (FACTS 61). Play D major, D4 to D5, works from the start and
// answers nothing. Play A with D sharp and Play A with G sharp, A4 to A5,
// unlock with the choice, and each draws a small staircase under its own
// button as it plays, a stair a note, each riser as tall as its step
// (FACTS 37). As any scale plays each note lights its bead and key, and a
// thread joins each bead to the one before; a play's picture stays until
// the next.
//
// The reveal waits until both A major plays have been heard to their end
// with sound on (the kit's predict, `revealAfter: 'all'`; FACTS 36). A play
// cut short, by another sound, a step change of the deck or the hero off
// screen, is not heard. Merc and Tavi listen while a play sounds, and Tavi
// gives a quiet "oh" at the reveal, with no sparkles: it calls no choice
// right. On a first visit the welcome tour waits for the choice
// (kit/tour-gate.ts `holdTour`), since the steps' stages name the answer.

import type { BeadView, CircleScene } from '@/features/lessons/kit/circle-draw'
import { circleSize, drawCircle } from '@/features/lessons/kit/circle-draw'
import { angleOf } from '@/features/lessons/kit/circle-geometry'
import { q, qa, svg } from '@/features/lessons/kit/dom'
import { addDrawer, surface, wake, watch, } from '@/features/lessons/kit/frame-loop'
import { drawStrip, stripLayout } from '@/features/lessons/kit/key-strip'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { Spelled } from '@/features/lessons/kit/notes'
import { signName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { note, PACE, runLength } from './sounds'

/** The hero's three plays (FACTS 61). */
export type HeroPlay = 'd-major' | 'with-d-sharp' | 'with-g-sharp'

const scale = (names: string): Spelled[] => names.split(' ').map(note)

/** Each play's scale, spelled as the play names it (FACTS 37, 61). */
export const HERO_SCALES: Readonly<Record<HeroPlay, readonly Spelled[]>> = {
  'd-major': scale('D4 E4 F♯4 G4 A4 B4 C♯5 D5'),
  'with-d-sharp': scale('A4 B4 C♯5 D♯5 E5 F♯5 G5 A5'),
  'with-g-sharp': scale('A4 B4 C♯5 D5 E5 F♯5 G♯5 A5'),
}

/** The keyboard under the ring, D4 to A5 (FACTS 33). */
export const HERO_KEYS = { lo: 62, hi: 81 } as const

/** A play's notes, in the soft tone, at the steps' pace (FACTS 61). */
export const heroRun = (what: HeroPlay) =>
  HERO_SCALES[what].map((n, i) => ({
    t: Math.round(i * PACE.step.every * 1000) / 1000,
    midi: midiOf(n),
    dur: PACE.step.dur,
  }))

/** How long each play lasts, s: 3.15. */
export const HERO_SEC = runLength(
  HERO_SCALES['d-major'].map((n, i) => ({
    t: i * PACE.step.every,
    dur: PACE.step.dur,
    note: n,
  })),
)

/** The predict's words (LESSON.md; WEB-SPEC, Toys 5). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play A major both ways.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play any of them again.',
  },
  guess: { 'd-sharp': 'You said: D♯', 'g-sharp': 'You said: G♯' },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the ring says as each play starts; none names a degree. */
export const HERO_SAID: Readonly<Record<HeroPlay, string>> = {
  'd-major': 'D major, D4 up to D5.',
  'with-d-sharp': 'A major with D sharp, A4 up to A5.',
  'with-g-sharp': 'A major with G sharp, A4 up to A5.',
}

/** The A major plays, each with its small staircase. */
const MINI: readonly HeroPlay[] = ['with-d-sharp', 'with-g-sharp']

// ---------------------------------------------------------------- the picture

/** What the hero shows at one moment: the notes lit, the thread, the note sounding. */
export interface HeroView {
  /** The notes lit, in the order they sounded. */
  readonly lit: readonly Spelled[]
  /** The note sounding, and how far through its sound, 0 to 1; null between notes. */
  readonly sounding: { readonly note: Spelled; readonly u: number } | null
  /** A thread joins each lit bead to the one before. */
  readonly thread: boolean
}

/** At first paint: D major lit on both, no thread. */
export const REST_VIEW: HeroView = {
  lit: HERO_SCALES['d-major'],
  sounding: null,
  thread: false,
}

/** A play `t` s in: the notes sounded so far, the one sounding, the thread. */
export function playView(what: HeroPlay, t: number): HeroView {
  const notes = HERO_SCALES[what]
  const every = PACE.step.every
  const at = Math.min(notes.length - 1, Math.floor(t / every + 1e-9))
  const into = t - at * every
  return {
    lit: notes.slice(0, at + 1),
    sounding:
      into < PACE.step.dur
        ? { note: notes[at], u: into / PACE.step.dur }
        : null,
    thread: true,
  }
}

const pcOf = (n: Spelled): number => midiOf(n) % 12
const isBlackPc = (pc: number): boolean => [1, 3, 6, 8, 10].includes(pc)
const LETTER: Readonly<Record<number, string>> = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
}

/**
 * The ring as `v` has it: a white key's bead large and named, a black
 * key's small and unnamed unless lit, then large, ringed and named with
 * its sign; the lit beads threaded in the order they sounded.
 */
export function heroScene(v: HeroView): CircleScene {
  const named = new Map(v.lit.map((n) => [pcOf(n), n]))
  const beads: BeadView[] = Array.from({ length: 12 }, (_, pc) => {
    const lit = named.get(pc)
    const black = isBlackPc(pc)
    return {
      pc,
      angle: angleOf(pc),
      look: lit === undefined ? 'rest' : black ? 'key' : 'lit',
      names: black
        ? lit === undefined
          ? []
          : [signName(lit, { octave: false })]
        : [LETTER[pc]],
      big: !black || lit !== undefined,
    }
  })
  return {
    beads,
    fifths: false,
    house: null,
    thread: v.thread ? v.lit.map(pcOf) : [],
    gap: null,
  }
}

/** The small staircase of `scale`'s first `shown` notes: a stair a note, each as high as its semitones above do. */
export function drawMini(
  el: SVGSVGElement,
  notes: readonly Spelled[],
  shown: number,
): void {
  const W = 132
  const H = 44
  el.setAttribute('viewBox', `0 0 ${W} ${H}`)
  el.replaceChildren()
  if (shown <= 0) return
  const lo = midiOf(notes[0])
  const unit = (H - 1) / 13
  const step = W / notes.length
  for (let i = 0; i < Math.min(shown, notes.length); i++) {
    const above = midiOf(notes[i]) - lo
    const top = H - (above + 1) * unit
    const semi = i > 0 && midiOf(notes[i]) - midiOf(notes[i - 1]) === 1
    svg(
      'rect',
      {
        x: (i * step + 1).toFixed(2),
        y: top.toFixed(2),
        width: (step - 2).toFixed(2),
        height: (H - top).toFixed(2),
        rx: 1.5,
        class: semi ? 'mini-stair is-semi' : 'mini-stair',
      },
      el,
    )
  }
}

// ---------------------------------------------------------------- the toy

export interface ColdOpenOptions {
  /** Hears the choice the moment it locks. */
  readonly onChoice?: (choice: string) => void
}

export interface ColdOpen {
  readonly predict: Predict
  /** Ends what the hero plays. */
  stop(): void
}

const now = (): number => performance.now() / 1000

/**
 * Mounts the cold open on the hero; a step change of the steps' `deck`
 * ends its play. Call it after the masthead's start, in the same task, so
 * a first visit's tour waits for the choice.
 */
export function initColdOpen(
  deck: Pick<StepDeck, 'subscribe'>,
  o: ColdOpenOptions = {},
): ColdOpen {
  const stage = q('#heroStage')
  const ringEl = q<SVGSVGElement>('[data-ring-svg]', stage)
  const keys = surface(q<HTMLCanvasElement>('[data-ring-keys]', stage))
  const said = q('[data-ring-said]', stage)
  const minis = new Map(
    MINI.map((w) => [w, q<SVGSVGElement>(`[data-mini-stairs="${w}"]`)]),
  )
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  let playing: { what: HeroPlay; t0: number; ended: number | null } | null =
    null
  let run: Run | null = null
  let dirty = true
  // the sizes the last frame drew at: a resize draws again
  let drawnAt = ''
  const sizes = (): string => {
    const k = keys.canvas.getBoundingClientRect()
    const r = circleSize(ringEl)
    return `${Math.round(k.width)}x${Math.round(k.height)} ${Math.round(r.w)}x${Math.round(r.h)}`
  }

  const view = (): HeroView => {
    const p = playing
    if (p === null) return REST_VIEW
    const t = p.ended ?? now() - p.t0
    return playView(p.what, Math.min(t, HERO_SEC))
  }

  function draw(): void {
    const v = view()
    drawCircle(ringEl, heroScene(v), circleSize(ringEl))
    const { ctx, w, h } = keys.fit()
    const lit = new Set(v.lit.map(midiOf))
    const names = new Map(v.lit.map((n) => [midiOf(n), n]))
    const sounding = v.sounding === null ? null : midiOf(v.sounding.note)
    const pulse = v.sounding === null ? 0 : 1 - v.sounding.u
    // a keyboard with no room yet (laid out later) waits for its first frame with some
    if (w > 10 && h > 10)
      drawStrip(
        ctx,
        stripLayout({ ...HERO_KEYS, x0: 1, x1: w - 1, top: 1, height: h - 2 }),
        {
          lit: (m) => lit.has(m),
          // the key's own black keys carry their sign, in ink
          label: (m) => {
            const n = names.get(m)
            return n !== undefined && n.alter !== 0 ? n : null
          },
          pulse: (m) =>
            m === sounding ? (reducedMotion() ? 1 : Math.max(0, pulse)) : 0,
        },
      )
    const p = playing
    if (p !== null) {
      const mini = minis.get(p.what)
      if (mini !== undefined) drawMini(mini, HERO_SCALES[p.what], v.lit.length)
    }
    drawnAt = sizes()
    dirty = false
  }

  addDrawer({
    active: watch(stage),
    wants: () =>
      dirty ||
      (playing !== null && playing.ended === null) ||
      sizes() !== drawnAt,
    draw,
  })

  function stop(): void {
    run?.stop()
  }

  /** Plays one of the three; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    const which: HeroPlay =
      what === 'with-d-sharp' || what === 'with-g-sharp' ? what : 'd-major'
    const going = playNotes(heroRun(which), { audible, kind: 'soft' })
    run = going
    const mine = { what: which, t0: now(), ended: null as number | null }
    playing = mine
    const stopMine = (): void => {
      going.stop()
    }
    NowPlaying.claim(stopMine)
    // played tones, not Merc's voice: both listen
    mercListen('blue', true)
    mercListen('orange', true)
    said.textContent = HERO_SAID[which]
    // a play draws its staircase afresh
    const mini = minis.get(which)
    if (mini !== undefined) drawMini(mini, HERO_SCALES[which], 0)
    dirty = true
    wake()
    return going.done.then((heard) => {
      NowPlaying.release(stopMine)
      if (run === going) {
        run = null
        mercListen('blue', false)
        mercListen('orange', false)
      }
      if (playing === mine) {
        mine.ended = heard ? HERO_SEC : Math.min(HERO_SEC, now() - mine.t0)
        dirty = true
        wake()
      }
      return heard
    })
  }

  // the welcome tour waits for the choice, which the steps' stages answer
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const predict = mountPredict(q('#predict'), {
    play,
    // the three plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: MINI,
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

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  wake()

  return { predict, stop }
}
