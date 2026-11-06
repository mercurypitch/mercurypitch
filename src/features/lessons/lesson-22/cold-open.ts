// ============================================================
// Lesson 22 cold open — Merc's wave across the band, and which straight note matches it
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of Lesson 5's band in its hero state, the three
// plays under it, then the predict (WEB-SPEC, Toys 1). The band reaches 35
// cents either side of Merc's note with no line at its centre, no cents
// ticks and no note named, 4.5 s across. From the first paint Merc's line
// lies across it as a still: the cold open's wave as it will sound, six
// swings a second at ±50 cents, past both edges of the band swing after
// swing, so Tavi's bubble speaks of a line the learner can see.
//
// Play Merc's note works from the start: A3 for 3.0 s, for every learner,
// its line redrawn across the band as it sounds; it never reveals. Play:
// top and Play: middle wait for a choice: the wave for 2.0 s, 0.3 s of
// quiet, then a straight note for 2.0 s, the top 50 cents up or A3 itself,
// its level line drawn at its height (sounds.ts `answerOf`). The reveal
// waits for both straight notes heard to their end with sound on (the
// kit's predict, `revealAfter: 'all'`); a play cut short, by another sound,
// a step change of the deck or the hero off screen, is not heard and
// changes nothing. Merc sings and Tavi listens while any play sounds; at
// the reveal Tavi celebrates once, quietly, and a dashed amber line draws
// itself through the wave's middle over 0.6 s, labelled "middle", at once
// under reduced motion, and stays for every later play. The choice opens
// the steps' toy and free play, and Step 3's predict (`onChoice`); on a
// first visit the welcome tour waits for it (kit/tour-gate.ts `holdTour`),
// since its steps' stop would carry a learner past the predict.

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintWave } from '@/features/lessons/kit/band-chart-wave'
import type { WaveStretch } from '@/features/lessons/kit/band-chart-wave-scene'
import { middleOf } from '@/features/lessons/kit/band-chart-wave-scene'
import { q, qa } from '@/features/lessons/kit/dom'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { playLine, playLines } from '@/features/lessons/kit/run'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { A3, answerOf, COLD, contourOfPlay, lineOf, STRAIGHT_AT, } from './sounds'
import type { Drawn } from './vib-picture'
import { drawnTo } from './vib-picture'

/** The hero's axis, cents either side of Merc's note: the wave and the top's straight note, with room above. */
export const HERO_RANGE = 80

/** The hero's window, seconds across (WEB-SPEC, Toys 1). */
export const HERO_WINDOW = 4.5

/** Seconds the middle line takes to draw itself at the reveal (FACTS 42). */
export const MIDDLE_SEC = 0.6

/** The predict's words (LESSON.md; WEB-SPEC, Toys 1); there is no `next` hint. */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both straight notes.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play any of them again.',
  },
  guess: { top: 'You said: the top', middle: 'You said: the middle' },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** What the polite line says as each play starts, and at the reveal: before a choice, nothing names a note or a middle. */
export const HERO_SAID = {
  wave: "Merc's line swings past both edges of the band, swing after swing.",
  top: "Merc's line swings past both edges of the band, then the straight note sits 50 cents up, above the band.",
  middle:
    "Merc's line swings past both edges of the band, then the straight note sits at the middle of the swing, inside the band.",
  reveal: 'The dashed line marks the middle of the swing.',
} as const

/** One play on the hero's chart: its line, its seconds, when it started, and where it reached once it ended. */
interface Drawing extends Drawn {
  readonly line: readonly WaveStretch[]
}

export interface ColdOpen {
  readonly chart: BandChart
  readonly predict: Predict
  stop(): void
}

const now = (): number => performance.now() / 1000

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
  const figure = q('#heroChart')
  const said = q('[data-hero-said]', figure)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  // the still: the cold open's wave as it will sound, whole
  let drawing: Drawing = {
    line: lineOf(COLD),
    sec: COLD.sec,
    t0: 0,
    ended: COLD.sec,
  }
  let run: Run | null = null
  let revealedAt: number | null = null

  /** How much of the middle line has drawn itself: none before the reveal, all of it once 0.6 s have passed. */
  const middleShare = (): number => {
    if (revealedAt === null) return 0
    if (reducedMotion()) return 1
    return Math.min(1, (now() - revealedAt) / MIDDLE_SEC)
  }

  // the play's clock runs before the chart's drawer, so a frame draws the moment it reaches
  addDrawer({
    active: watch(stage),
    wants: () =>
      !reducedMotion() &&
      (drawing.ended === null || (revealedAt !== null && middleShare() < 1)),
    draw: () => {
      paint()
    },
  })
  const chart = mountBandChart(figure, {
    target: A3,
    axis: { range: HERO_RANGE },
    window: HERO_WINDOW,
    ticks: [],
    centre: false,
    active: watch(stage),
    paintOver: paintWave,
  })

  function paint(): void {
    const wave = {
      stretches: drawing.line,
      upTo: drawnTo(drawing, now(), reducedMotion()),
    }
    chart.scene.wave = wave
    const share = middleShare()
    chart.scene.middle =
      share > 0 ? { points: middleOf(wave), tone: 'merc', share } : null
  }

  function stop(): void {
    run?.stop()
  }

  /** Plays Merc's note or an answering play; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    const answer =
      what === 'top' || what === 'middle' ? answerOf(STRAIGHT_AT[what]) : null
    const going =
      answer === null
        ? playLine(contourOfPlay(COLD), { audible, vibrato: COLD.vibrato })
        : playLines(answer.lines, { audible })
    run = going
    const mine: Drawing = {
      line: answer?.line ?? lineOf(COLD),
      sec: answer?.sec ?? COLD.sec,
      t0: now(),
      ended: null,
    }
    drawing = mine
    const stopMine = (): void => {
      going.stop()
    }
    NowPlaying.claim(stopMine)
    mercSing('blue', A3, true)
    mercListen('orange', true)
    said.textContent =
      what === 'top' || what === 'middle' ? HERO_SAID[what] : HERO_SAID.wave
    paint()
    wake()
    return going.done.then((heard) => {
      NowPlaying.release(stopMine)
      if (run === going) {
        run = null
        mercSing('blue', A3, false)
        mercListen('orange', false)
      }
      if (drawing === mine) {
        mine.ended = heard ? mine.sec : Math.min(mine.sec, now() - mine.t0)
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
    // the three plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['top', 'middle'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    onChoice: (c) => {
      chose(c)
      onChoice()
    },
    onReveal: () => {
      // Tavi, quietly: the reveal calls no choice right
      mercCelebrate('orange', 1600)
      revealedAt = now()
      said.textContent = HERO_SAID.reveal
      paint()
      wake()
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)
  paint()

  return { chart, predict, stop }
}
