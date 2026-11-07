// ============================================================
// Lesson 24 four words — drone, harmonic, pure and equal-tempered, each drawn as it sounds
// ============================================================
//
// Lesson 5's word tickets, with the page's sound owner (kit/words-strip.ts
// `bindWordPlays`; WEB-SPEC, Toys 4; FACTS 68): each stub is a small figure
// that draws its word's play as it sounds, from the play's own schedule
// (sounds.ts `WORDS`), so the drawing and the sound share one clock. Drone:
// a small drone chart, A3's band drawing across from the left as A3 sounds,
// 3.0 s; empty before its first press, it then stays as it last drew, one
// cut short by another sound included. Harmonic: six rungs, A3's harmonics
// from 220 to 1,320 Hz, spaced by frequency, each lighting while its plain
// tone sounds, 0.9 s each (word-rungs.ts). Pure: the drone's band at A3 and
// a chrome line at 330 Hz, both still, glowing steadily while the pure fifth
// sounds, since it does not beat. Equal-tempered: thirteen rungs, A3 up to
// A4 in semitones, each lighting as it sounds, 0.3 s each and the last 0.6
// s. Under reduced motion the Drone's band lands whole as its play starts
// and nothing glows; a rung still lights in its turn, a step and no
// movement. The words are the page's one sound (kit/now-playing.ts): a
// press stops any sound before it, anywhere on the page, and a newer one
// stops the word. No word sets two close notes together; Pure's pure fifth
// rings still, which says what in tune sounds like, so its play waits for
// the cold open's choice under its lock line (`unlockPure`; FACTS 46, 71).

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintDrone } from '@/features/lessons/kit/band-chart-drone'
import type { DroneScene } from '@/features/lessons/kit/band-chart-drone-scene'
import { levelStretch } from '@/features/lessons/kit/band-chart-drone-scene'
import { q, qa } from '@/features/lessons/kit/dom'
import type { Brightness } from '@/features/lessons/kit/drone-beats'
import { brightness } from '@/features/lessons/kit/drone-beats'
import { addDrawer, surface, wake, watch, } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import type { Play, WordId, WordSound } from './sounds'
import { A3, PURE, schedulesOf, startWord, WORD_DRONE, WORD_PURE, WORDS, } from './sounds'
import type { RungsPicture } from './word-rungs'
import { paintWordRungs } from './word-rungs'

/** Drone's chart: 40 cents either side of A3, room for its name above the band. */
export const DRONE_SPAN = [-40, 40] as const
/** Pure's chart: from under A3 to over E4, the band at its foot and 330 Hz near its top. */
export const PURE_SPAN = [-60, 760] as const

/** The rung figures' names for their lowest rung and their highest. */
const ENDS: Readonly<
  Record<'harmonic' | 'tempered', readonly [string, string]>
> = {
  harmonic: ['220 Hz', '1,320 Hz'],
  tempered: ['A3', 'A4'],
}

/** One play on a figure: when it started, and where it reached once it ended. */
interface Sounding {
  readonly t0: number
  ended: number | null
}

/** A figure's run, for its stop, and its latest play, for its drawing. */
interface Hold {
  run: Run | null
  sounding: Sounding | null
}

/** One word's figure: its play and its stop. */
interface Figure {
  /** Plays the word, drawing as it sounds; resolves when it ends. */
  play(audible: boolean): Promise<void>
  stop(): void
}

export interface Words {
  /** Drone's chart and Pure's. */
  readonly charts: Readonly<Record<'drone' | 'pure', BandChart>>
  /** What Harmonic's rungs and Equal-tempered's show now. */
  readonly rungs: Readonly<Record<'harmonic' | 'tempered', () => RungsPicture>>
  /** The cold open's choice: Pure's play sounds from now on, and its lock line goes. */
  unlockPure(): void
}

const now = (): number => performance.now() / 1000

const isWord = (w: string): w is WordId => Object.hasOwn(WORDS, w)

/** Seconds a play has sounded at `t`: to its end once it has ended. */
const sounded = (s: Sounding, sec: number, t: number): number =>
  s.ended ?? Math.min(sec, t - s.t0)

/** Plays `word` for `figure`'s drawing: `paint` as it starts and as it ends, and the run kept for a stop. */
function playing(
  word: WordSound,
  audible: boolean,
  hold: Hold,
  paint: () => void,
): Promise<void> {
  const going = startWord(word, audible)
  hold.run = going
  const mine: Sounding = { t0: now(), ended: null }
  hold.sounding = mine
  paint()
  wake()
  return going.done.then((heard) => {
    if (hold.run === going) hold.run = null
    mine.ended = heard ? word.sec : Math.min(word.sec, now() - mine.t0)
    paint()
    wake()
  })
}

/** The brightness of `p` at `t` while it sounds, held still under reduced motion; null at rest. */
function glowOf(p: Play, s: Sounding | null, t: number): Brightness | null {
  if (s === null || s.ended !== null) return null
  if (reducedMotion()) return { slow: null, fast: null }
  return brightness(schedulesOf(p), Math.min(p.sec, t - s.t0))
}

/** A small drone chart on a word's stub, A3 at its foot or its middle, no ticks and no line at its centre. */
function wordChart(
  stub: HTMLElement,
  span: readonly [number, number],
  sec: number,
): BandChart {
  return mountBandChart(stub, {
    target: A3,
    axis: { span },
    window: sec,
    ticks: [],
    centre: false,
    active: watch(stub),
    paintRungs: paintDrone,
  })
}

/** Drone's figure: A3's band drawing across as A3 sounds, from its first press. */
function mountDrone(stub: HTMLElement): Figure & { chart: BandChart } {
  const word = WORDS.drone
  const hold: Hold = { run: null, sounding: null }
  // the play's clock runs before the chart's drawer, so a frame draws the moment it reaches
  addDrawer({
    active: watch(stub),
    wants: () => !reducedMotion() && hold.sounding?.ended === null,
    draw: () => {
      paint()
    },
  })
  const chart = wordChart(stub, DRONE_SPAN, word.sec)

  function paint(): void {
    const s = hold.sounding
    const t = now()
    const upTo =
      s === null ? 0 : reducedMotion() ? word.sec : sounded(s, word.sec, t)
    const scene: DroneScene = {
      drone: { c: 0, as: 'band', label: 'drone · A3', upTo },
      band: null,
      ticks: [],
      beads: [],
      tops: [],
      bright: glowOf(WORD_DRONE, s, t),
    }
    chart.scene.drone = scene
  }
  paint()
  return {
    chart,
    play: (audible) => playing(word, audible, hold, paint),
    stop() {
      hold.run?.stop()
    },
  }
}

/** Pure's figure: the drone's band and a chrome line at 330 Hz, both still, glowing steadily as the pure fifth sounds. */
function mountPure(stub: HTMLElement): Figure & { chart: BandChart } {
  const word = WORDS.pure
  const hold: Hold = { run: null, sounding: null }
  addDrawer({
    active: watch(stub),
    wants: () => !reducedMotion() && hold.sounding?.ended === null,
    draw: () => {
      paint()
    },
  })
  const chart = wordChart(stub, PURE_SPAN, word.sec)

  function paint(): void {
    chart.scene.drone = {
      drone: { c: 0, as: 'band', label: 'drone · A3' },
      band: null,
      ticks: [],
      beads: [],
      tops: [
        {
          stretches: [levelStretch(PURE.so, hz(A3), 0, word.sec)],
          upTo: word.sec,
        },
      ],
      bright: glowOf(WORD_PURE, hold.sounding, now()),
    }
  }
  paint()
  return {
    chart,
    play: (audible) => playing(word, audible, hold, paint),
    stop() {
      hold.run?.stop()
    },
  }
}

/** The rung sounding `t` seconds into `word`: the last whose tone has started, while the play lasts. */
export function rungAt(word: WordSound, t: number): number | null {
  if (t < 0 || t >= word.sec) return null
  const i = word.lines.findLastIndex((l) => l.t <= t)
  return i < 0 ? null : i
}

/** Harmonic's rungs or Equal-tempered's, each lighting as its tone sounds. */
function mountRungs(
  id: 'harmonic' | 'tempered',
  stub: HTMLElement,
): Figure & { picture: () => RungsPicture } {
  const word = WORDS[id]
  const canvas = q<HTMLCanvasElement>('canvas', stub)
  const cv = surface(canvas)
  const hold: Hold = { run: null, sounding: null }
  const picture = (): RungsPicture => {
    const s = hold.sounding
    return {
      n: word.lines.length,
      lit: s === null || s.ended !== null ? null : rungAt(word, now() - s.t0),
      ends: ENDS[id],
    }
  }
  // what the figure shows now, and what its last frame drew, as one string each
  let drawn = ''
  const showing = (): string =>
    JSON.stringify([
      picture(),
      canvas.clientWidth,
      canvas.clientHeight,
      globalThis.devicePixelRatio,
    ])
  addDrawer({
    active: watch(stub),
    // while it sounds the next rung's turn is due: the loop keeps asking
    wants: () => hold.sounding?.ended === null || showing() !== drawn,
    draw: () => {
      const shown = showing()
      if (shown === drawn) return
      drawn = shown
      const { ctx, w, h } = cv.fit()
      paintWordRungs(ctx, w, h, picture())
    },
  })
  new ResizeObserver(wake).observe(canvas)
  return {
    picture,
    play: (audible) => playing(word, audible, hold, () => undefined),
    stop() {
      hold.run?.stop()
    },
  }
}

/** Mounts the four words' figures, binds their plays to the page's one sound, and holds Pure's until the cold open's choice. */
export function initWords(): Words {
  const root = q('#words')
  const stub = (w: WordId): HTMLElement =>
    q(`[data-word="${w}"] .stub > *`, root)
  const drone = mountDrone(stub('drone'))
  const pure = mountPure(stub('pure'))
  const harmonic = mountRungs('harmonic', stub('harmonic'))
  const tempered = mountRungs('tempered', stub('tempered'))
  const figures: Readonly<Record<WordId, Figure>> = {
    drone,
    harmonic,
    pure,
    tempered,
  }
  const figure = (w: string): Figure => {
    if (!isWord(w)) throw new Error(`no word ${w}`)
    return figures[w]
  }
  bindWordPlays(root, (w, audible) => figure(w).play(audible), {
    owner: NowPlaying,
    stop: (w) => {
      figure(w).stop()
    },
  })
  return {
    charts: { drone: drone.chart, pure: pure.chart },
    rungs: { harmonic: harmonic.picture, tempered: tempered.picture },
    unlockPure() {
      q<HTMLButtonElement>('[data-word-play="pure"]', root).disabled = false
      for (const line of qa('[data-word-lock]', root)) line.hidden = true
    },
  }
}
