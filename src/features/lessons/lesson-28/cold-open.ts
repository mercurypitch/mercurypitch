// ============================================================
// Lesson 28 cold open — a song that sounds as if it ends, then keeps going
// ============================================================
//
// The hero is the cold open (CURIOSITY-MOMENTS § 3.1): Merc and Tavi
// either side of the song strip, ten numbered boxes a row, Tavi's orange
// row above Merc's blue, each labelled, with no note and no staff, taking
// no taps (WEB-SPEC, Toys 1; FACTS 40). Play the song is free: the way the
// song kept going, ten bars, both parts on "ooh", 33.33 s, each bar's two
// boxes lighting as it sounds, bar 8 on vi and bars 9 and 10 starting A
// again; it never sounds G4 over G3, so the learner hears one way and
// predicts the other, and it never reveals (FACTS 33). Play the ending and
// Play it going on wait for a choice: bars 7 and 8, 6.67 s each, G3 or E3
// in Merc's part at bar 8. As each starts, the strip's bars 7 and 8 open
// into a pair of staffs of its own under the hero (kit/score.ts), the
// ending's pair above the other way's, each note written as it sounds,
// lighting. The reveal waits for both heard to their end with sound on
// (`revealAfter: 'all'`), and shows the hero's reveal and Step 2's held
// words, the kit reading them in order; it rings bar 8's note in Merc's
// part on both pairs, G3 and E3, with V and I, V and vi, under the bars,
// and Tavi gives a quiet "oh", with no sparkles (FACTS 43).
//
// The choice tells the page (`onChoice`): the steps' staffs, free play,
// Sing it and quick check 4 open. On a first visit the welcome tour waits
// for the choice (kit/tour-gate.ts `holdTour`), with no time limit, since
// its steps' stop would answer it (FACTS 46). A play cut short, by another
// sound, a step change of the deck or the hero off screen, is not heard.

import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playNotes } from '@/features/lessons/kit/run'
import type { Score } from '@/features/lessons/kit/score'
import { mountScore } from '@/features/lessons/kit/score'
import type { ScoreScene } from '@/features/lessons/kit/score-layout'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import type { Section } from './song'
import { A, barAt, barsOf, BEAT_SEC, bothNotes, GOING, sceneOf, secondsOf, } from './song'

/** The predict's words (LESSON.md; WEB-SPEC, Toys 1); there is no `next` hint. */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both ways.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play either again.',
  },
  guess: {
    tavi: "You said: Tavi's part",
    merc: "You said: Merc's part",
  },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** The hero's words: at first, after Play the song, after each answering play (WEB-SPEC, Toys 1). */
export const HERO_SAID = {
  rest: "The song in two parts, ten bars: Tavi's part above, Merc's below.",
  song: 'The song as it kept going: bars 1 to 8, then bars 1 and 2 again.',
  ending:
    "Bars 7 and 8, the ending: Tavi's part A 4, F sharp 4, then G 4; Merc's D 3, D 3, then G 3.",
  going:
    "Bars 7 and 8, going on: Tavi's part A 4, F sharp 4, then G 4; Merc's D 3, D 3, then E 3.",
} as const

export type Way = 'ending' | 'going'
export type HeroPlay = 'song' | Way

const isWay = (p: string): p is Way => p === 'ending' || p === 'going'

/** Each answering play's two bars: the ending, G3 under G4 at bar 8, and the way it kept going, E3 (FACTS 33, 34). */
export const PAIRS: Readonly<Record<Way, Section>> = {
  ending: barsOf(A, 7, 8),
  going: barsOf(GOING, 7, 8),
}

/** The numerals each pair takes at the reveal: V and I, V and vi (FACTS 32). */
const PAIR_NUMERALS: Readonly<Record<Way, readonly [string, string]>> = {
  ending: ['V', 'I'],
  going: ['V', 'vi'],
}

/** Each pair's words on its figure. */
export const PAIR_SAID: Readonly<Record<Way, string>> = {
  ending: 'Bars 7 and 8, the ending, on two staffs.',
  going: 'Bars 7 and 8, going on, on two staffs.',
}

/** A pair's scene: bars 7 and 8, room kept for its numerals; at the reveal, its numerals and bar 8's note in Merc's part ringed. */
export function pairScene(way: Way, revealed: boolean): ScoreScene {
  return sceneOf(PAIRS[way], 7, {
    numerals: revealed
      ? PAIR_NUMERALS[way].map((text, bar) => ({ bar, text }))
      : [],
    rings: revealed ? [{ staff: 1, note: 2 }] : [],
  })
}

/** A play's two parts, from bar 1 of what it sounds. */
export const heroSection = (id: HeroPlay): Section =>
  id === 'song' ? GOING : PAIRS[id]

export interface ColdOpen {
  readonly predict: Predict
  stop(): void
}

export interface ColdOpenOptions {
  /** Hears the choice: the steps' staffs, free play, Sing it and quick check 4 open. */
  readonly onChoice: () => void
  /** Hears the reveal: Step 2's held line goes. */
  readonly onReveal: () => void
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
  const figure = q('#heroStrip')
  const strip = q('[data-hero-strip]', figure)
  const said = q('[data-hero-said]', figure)
  const boxes = qa<HTMLElement>('.strip-bars li', strip)
  const staffs = q('[data-hero-staffs]')
  const pairs = new Map<Way, Score>()
  let revealed = false
  let run: Run | null = null
  let plays = 0
  stillSky(stage)
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  /** Lights a bar's two boxes, or none. */
  function lightBar(bar: number | null): void {
    for (const b of boxes)
      b.classList.toggle('is-lit', Number(b.dataset.bar) === bar)
  }

  /** A way's pair of staffs, made as its first play starts: the ending's above the other's. */
  function pairOf(way: Way): Score {
    const made = pairs.get(way)
    if (made !== undefined) return made
    const fig = document.createElement('div')
    fig.className = 'score-fig l28-pair'
    fig.dataset.pair = way
    fig.setAttribute('role', 'img')
    fig.setAttribute('aria-label', PAIR_SAID[way])
    if (way === 'ending') staffs.prepend(fig)
    else staffs.append(fig)
    staffs.hidden = false
    strip.classList.add('is-open')
    const score = mountScore(fig)
    pairs.set(way, score)
    return score
  }

  function listen(on: boolean): void {
    mercListen('blue', on)
    mercListen('orange', on)
  }

  function stop(): void {
    if (run === null) return
    plays += 1
    run.stop()
    run = null
    lightBar(null)
    NowPlaying.release(stop)
    listen(false)
  }

  /** Plays the song as it kept going, or a way's two bars; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    const id: HeroPlay = isWay(what) ? what : 'song'
    const section = heroSection(id)
    listen(true)
    const sound = playNotes(bothNotes(section), {
      audible,
      onNote: (n) => {
        if (mine === plays && id === 'song') lightBar(barAt(n.t))
      },
    })
    const runs: Run[] = [sound]
    if (isWay(id)) {
      // the pair writes its notes as they sound, from none
      const score = pairOf(id)
      score.show(pairScene(id, revealed), 0)
      runs.push(
        score.play({
          seconds: secondsOf(section),
          beatSec: BEAT_SEC,
          write: true,
        }),
      )
    }
    const going = allOf(runs)
    run = going
    return going.done.then((heard) => {
      if (mine !== plays) return false
      run = null
      lightBar(null)
      if (heard) {
        said.textContent = HERO_SAID[id]
        strip.setAttribute('aria-label', HERO_SAID[id])
      }
      NowPlaying.release(stop)
      listen(false)
      return heard
    })
  }

  // the welcome tour waits for the choice, which its steps' stop would answer
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const box = q('#predict')
  const predict = mountPredict(box, {
    play,
    // the three plays sit under the hero, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['ending', 'going'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    // the hero's reveal, then Step 2's held words, read in order
    reveal: [q('.reveal', box), q('.held-body[data-held="2"]')],
    onChoice: (c) => {
      // the choice ends Play the song: the predict moves the focus to the
      // first answering play
      stop()
      chose(c)
      o.onChoice()
    },
    onReveal: () => {
      revealed = true
      for (const [way, score] of pairs) score.show(pairScene(way, true))
      o.onReveal()
      // Tavi's quiet "oh", with no sparkles
      mercCelebrate('orange', 1600)
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage.closest<HTMLElement>('section') ?? stage, stop)

  return { predict, stop }
}
