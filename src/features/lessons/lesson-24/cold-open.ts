// ============================================================
// Lesson 24 cold open — a drone, a note just above it, and a slide into it
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the drone chart in its hero state, the two
// plays under it, then the predict (WEB-SPEC, Toys 1). Over a fixed window
// 10 seconds across, from 20 cents under A3 to 45 over it, with no cents
// ticks and no numbers, the drone is the amber band, 15 cents either side,
// named "drone · A3"; from the first paint the top note's line lies across
// the window as a still at 224 Hz, 31.2 cents up, thin and chrome, unnamed
// and with no glow, as Lesson 23's still draws it. It takes no taps.
//
// Play the drone and the top note works from the start: A3 and 224 Hz
// together for 3.0 s, the band and the line brightening and dimming
// together four times a second, a fine shimmer at the band's edges, under
// the luminance cap; it never reveals. Play the slide waits for a choice:
// 224 Hz held 1.5 s, gliding to 220 over 6 s, then 220 for 2.5 s, the two
// voices started on one audio time, so the top note ends 13° from in phase
// and the still pair sounds whole (FACTS 44). Its line redraws across the
// window as it sounds, a straight slope on the cents axis, and the
// brightness follows the difference, four beats a second down to none. The
// reveal waits for the slide heard to its end with sound on; a play cut
// short, by another sound, a step change of the deck or the hero off
// screen, is not heard and changes nothing. Merc and Tavi listen while
// either play sounds; at the reveal Tavi gives a quiet "oh", with no
// sparkles, and Step 1's text, which says the answer, shows with the
// reveal. The choice opens the steps' toy, Step 2's predict, free play, the
// Pure word's play and quick check 4's play (`onChoice`); on a first visit
// the welcome tour waits for it (kit/tour-gate.ts `holdTour`), since its
// steps' stop would carry a learner past the predict. Before the choice
// nothing the hero says names a beat, a rate or a stop (FACTS 1a).

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintDrone } from '@/features/lessons/kit/band-chart-drone'
import type { DroneScene } from '@/features/lessons/kit/band-chart-drone-scene'
import { levelStretch } from '@/features/lessons/kit/band-chart-drone-scene'
import { q, qa } from '@/features/lessons/kit/dom'
import { brightness } from '@/features/lessons/kit/drone-beats'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { droneOf, HERO_VIEW, START, stretchesOf } from './drone-picture'
import type { Play } from './sounds'
import { playFor, schedulesOf, startPlay } from './sounds'

/** The hero's window, seconds across (WEB-SPEC, Toys 1). */
export const HERO_WINDOW = 10

/** The predict's words (LESSON.md; WEB-SPEC, Toys 1); there is no `next` hint. */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play the slide.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play either of them again.',
  },
  guess: {
    stops: 'You said: it slows, then stops',
    faster: 'You said: it speeds up',
  },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the polite line says as each play starts: before a choice, nothing names a beat, a rate or a stop. */
export const HERO_SAID = {
  pair: 'The drone and the top note sound together, throbbing.',
  slide:
    "The top note sinks into the drone's band, and the throbbing slows until it stops.",
} as const

/** The hero's plays: the pair, free, and the slide, which answers the predict. */
type HeroPlay = 'pair' | 'slide'

/** One play on the hero: what it is, when it started, and where it reached once it ended. */
export interface HeroDrawing {
  readonly what: HeroPlay
  readonly play: Play
  readonly t0: number
  ended: number | null
}

/** The top note's still: 224 Hz across the whole window. */
const stillTop = () => ({
  stretches: [levelStretch(224, hz(HERO_VIEW.target), 0, HERO_WINDOW)],
  upTo: HERO_WINDOW,
})

/**
 * The hero's scene: the drone's band and the top note, the still's line at
 * rest and through the pair, the slide's as far as it has sounded (whole
 * under reduced motion), and the brightness while either sounds (held
 * still under reduced motion).
 */
export function heroScene(
  d: HeroDrawing | null,
  t: number,
  reduced: boolean,
): DroneScene {
  const base: DroneScene = {
    drone: droneOf(1, START, HERO_VIEW),
    band: null,
    ticks: [],
    beads: [],
    tops: [stillTop()],
    bright: null,
  }
  if (d === null) return base
  const sounding = d.ended === null
  const at = Math.min(d.ended ?? t, d.play.sec)
  const tops =
    d.what === 'slide'
      ? [
          {
            stretches: stretchesOf(d.play.notes[0], d.play.sec, HERO_VIEW),
            upTo: reduced ? d.play.sec : at,
          },
        ]
      : base.tops
  let bright: DroneScene['bright'] = null
  if (sounding)
    bright = reduced
      ? { slow: null, fast: null }
      : brightness(schedulesOf(d.play), at)
  return { ...base, tops, bright }
}

export interface ColdOpen {
  readonly chart: BandChart
  readonly predict: Predict
  stop(): void
}

export interface ColdOpenOptions {
  /** The choice: the steps' toy, Step 2's predict, free play, the Pure word's play and quick check 4's. */
  readonly onChoice: () => void
  /** The reveal: Step 1's held line goes. */
  readonly onReveal: () => void
}

const now = (): number => performance.now() / 1000

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
  const figure = q('#heroChart')
  const said = q('[data-hero-said]', figure)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  let drawing: HeroDrawing | null = null
  let run: Run | null = null

  // the play's clock runs before the chart's drawer, so a frame draws the moment it reaches
  addDrawer({
    active: watch(stage),
    wants: () => !reducedMotion() && drawing !== null && drawing.ended === null,
    draw: () => {
      paint()
    },
  })
  const chart = mountBandChart(figure, {
    target: HERO_VIEW.target,
    axis: { span: HERO_VIEW.span },
    window: HERO_WINDOW,
    ticks: [],
    centre: false,
    active: watch(stage),
    paintRungs: paintDrone,
  })

  function paint(): void {
    const d = drawing
    chart.scene.drone = heroScene(
      d,
      d === null ? 0 : now() - d.t0,
      reducedMotion(),
    )
  }

  function stop(): void {
    run?.stop()
  }

  /** Plays the pair or the slide; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    const key: HeroPlay = what === 'slide' ? 'slide' : 'pair'
    const p = playFor(key)
    const going = startPlay(p, audible)
    run = going
    const mine: HeroDrawing = { what: key, play: p, t0: now(), ended: null }
    drawing = mine
    const stopMine = (): void => {
      going.stop()
    }
    NowPlaying.claim(stopMine)
    // played tones, not Merc's voice: both listen
    mercListen('blue', true)
    mercListen('orange', true)
    said.textContent = HERO_SAID[key]
    paint()
    wake()
    return going.done.then((heard) => {
      NowPlaying.release(stopMine)
      if (run === going) {
        run = null
        mercListen('blue', false)
        mercListen('orange', false)
      }
      if (drawing === mine) {
        mine.ended = heard ? p.sec : Math.min(p.sec, now() - mine.t0)
        paint()
        wake()
      }
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
    revealOn: ['slide'],
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    onChoice: (c) => {
      chose(c)
      o.onChoice()
    },
    // the hero's reveal first, which the kit writes the "You said" line
    // into, then Step 1's text, which says the answer
    reveal: [q('#predict .reveal'), ...qa('[data-reveal1]')],
    onReveal: () => {
      // Tavi, quietly: the reveal calls no choice right
      mercCelebrate('orange', 1600)
      o.onReveal()
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  paint()

  return { chart, predict, stop }
}
