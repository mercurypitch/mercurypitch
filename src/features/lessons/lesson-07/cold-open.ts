// ============================================================
// Lesson 7 cold open — "Twinkle" on a column two octaves tall
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// the bubbles over Merc and Tavi either side of the compact range chart,
// Play "Twinkle" under the stage, then the predict card. The chart shows the
// column alone, two octaves with its middle half lit (FACTS 35), and nothing
// on it says how high the tune goes: Play "Twinkle" works from the start and
// sounds the tune's first two lines with its beads hidden (FACTS 83). Play
// "Twinkle" on the column waits for a guess, then lights each of the tune's
// fourteen notes on the column as Merc sings it. The reveal follows once
// that play has been heard to its end, as kit/predict.ts has every lesson's
// (the curiosity plan's rule, which overrides the WEB-SPEC's "the choice is
// the reveal"): the gold bracket joins the tune's lowest note to its
// highest, the live line names its span, and Tavi celebrates once. A
// play that sound off kept silent, or that another sound cut short, takes
// its beads away again, so only a heard play leaves the answer on the chart.
// Each play is the page's one sound (kit/now-playing.ts). The chart takes no
// taps, so its drawing is hidden from a screen reader and a polite live
// region speaks for it, naming no note before the reveal.

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { mercCelebrate, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { RangeChart } from '@/features/lessons/kit/range-chart'
import { mountRangeChart } from '@/features/lessons/kit/range-chart'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { ChartVoice } from './range-data'
import { columnOf, twinkle, TWINKLE_SEC, TWINKLE_SPAN, twinkleDo, } from './range-data'
import { HERO_BEFORE, heroAfter } from './range-words'

/** The reveal's first line, by the choice: never "right" or "wrong". */
export const GUESS: Readonly<Record<string, string>> = {
  most: 'You said: most of it',
  less: 'You said: less than half',
}

export const HINTS = {
  chosen:
    'Locked in. Play “Twinkle” on the column: each note lights as Merc sings it.',
  silent: 'Sound is off, so nothing played. Turn sound on to hear it.',
  again: 'Play “Twinkle” again, and watch where the slice sits.',
} as const

/** The hero's chart: the voice's column filling the plot, nothing named. */
export function mountHeroChart(
  box: HTMLElement,
  voice: ChartVoice,
  active: () => boolean,
): RangeChart {
  const col = columnOf(voice)
  const chart = mountRangeChart(box, {
    window: { lo: col.lo, hi: col.hi },
    form: 'wide',
    names: false,
    seconds: TWINKLE_SEC,
    active,
  })
  chart.scene.column = { lo: col.lo, hi: col.hi, lit: col.lit }
  chart.changed()
  return chart
}

/** Mounts the cold open; returns the hero's chart, for its tests to read the scene. */
export function initColdOpen(): RangeChart {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const box = q('#heroRange')
  const said = q('[data-hero-said]', box)
  const active = watch(stage)
  // the voice stored from Lesson 3 picks the column and the Merc who sings
  let voice: ChartVoice = VoiceChoice.voice ?? 'lower'
  const chart = mountHeroChart(box, voice, active)
  let run: Run | null = null
  let revealed = false

  const say = (text: string): void => {
    if (said.textContent !== text) said.textContent = text
  }

  /** The tune's beads, one of them lit, or none drawn at all. */
  function beads(lit: number | null, shown: number): void {
    chart.scene.beads = twinkle(twinkleDo(voice))
      .slice(0, shown)
      .map((n, i) => ({ t: n.t, midi: n.midi, lit: i === lit }))
    chart.changed()
  }

  function bracket(): void {
    const d = twinkleDo(voice)
    chart.scene.bracket = {
      lo: d + TWINKLE_SPAN.low,
      hi: d + TWINKLE_SPAN.high,
    }
    chart.changed()
  }

  /** Stops the hero's play where it stands; Merc falls quiet. */
  function stop(): void {
    run?.stop()
    run = null
    mercSing(mercOf(voice), twinkleDo(voice), false)
    NowPlaying.release(stop)
  }

  /** Plays "Twinkle"; resolves false if another sound cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    NowPlaying.claim(stop)
    const onColumn = what === 'column' || revealed
    const notes = twinkle(twinkleDo(voice))
    const who = mercOf(voice)
    say(revealed ? heroAfter(voice) : HERO_BEFORE)
    // under reduced motion the beads stand in place from the start, lit in turn
    if (onColumn) beads(null, reducedMotion() ? notes.length : 0)
    const r = playNotes(notes, {
      audible,
      onNote: (n, i) => {
        if (run !== r) return
        mercSing(who, n.midi, true)
        if (onColumn) beads(i, reducedMotion() ? notes.length : i + 1)
      },
    })
    run = r
    const heard = await r.done
    if (run === r) {
      run = null
      mercSing(who, twinkleDo(voice), false)
      NowPlaying.release(stop)
    }
    // the play predict.ts reveals on: heard to its end with the sound on
    const reveals =
      what === 'column' && heard && audible && Sound.state === 'on'
    if (onColumn) beads(null, revealed || reveals ? notes.length : 0)
    return heard
  }

  mountPredict(q('#predict'), {
    play,
    // Play "Twinkle" sits under the stage, so it is on the first screen
    plays: [
      q<HTMLButtonElement>('#heroPlay'),
      q<HTMLButtonElement>('#predict [data-play="column"]'),
    ],
    revealOn: ['column'],
    hints: HINTS,
    guess: (choice) => GUESS[choice] ?? 'You said',
    onReveal: () => {
      revealed = true
      beads(null, twinkle(twinkleDo(voice)).length)
      bracket()
      say(heroAfter(voice))
      mercCelebrate('orange', 1600)
    },
  })

  // a voice chosen in Sing it moves the column and the tune an octave, quietly
  VoiceChoice.subscribe((v) => {
    if (v === null || v === voice) return
    stop()
    voice = v
    const col = columnOf(v)
    chart.setWindow({ lo: col.lo, hi: col.hi })
    chart.scene.column = { lo: col.lo, hi: col.hi, lit: col.lit }
    beads(null, revealed ? twinkle(twinkleDo(v)).length : 0)
    if (revealed) bracket()
  })
  return chart
}
