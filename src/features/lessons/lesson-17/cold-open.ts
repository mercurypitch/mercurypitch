// ============================================================
// Lesson 17 cold open — one written bar between Merc and Tavi, at 60 and 120 BPM
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Tavi's and Merc's bubbles over them, Lesson 8's compact pads between them
// cut to one bar of four, with the small metronome at their left, the line
// above them and an empty stopwatch strip under them; the two plays under
// the stage; then the predict (WEB-SPEC, Toys 2 and 3). Before a play
// nothing is written and no length shows.
//
// Play the bar at 60 BPM works from the start: four quarter notes on the
// woodblock's click, the 4/4 written with the first note and each note as
// it sounds, its cell reading "1 s" as it ends. Once a choice locks, Play
// the bar at 120 BPM plays the same written bar twice as fast: the notes
// stay as they are, the strip's readings go, and each cell reads "0.5 s"
// as its note ends (kit/rhythm-bar.ts `retempo`). The drawing is hidden
// from a screen reader and a polite region speaks for it: the 60 BPM
// play's lengths as it ends, the 120 BPM play's only with the reveal, which
// waits for that play heard to its end with sound on (the kit's predict).
// A play cut short, by another sound, a step change of the deck or the
// hero off screen, is not heard and changes nothing. Merc and Tavi look at
// the pads while a play runs and hop on nothing: the beat is the click's.

import { q, qa } from '@/features/lessons/kit/dom'
import { metronomeSVG } from '@/features/lessons/kit/explorer-figures'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercListen, mercsReady } from '@/features/lessons/kit/merc-duo'
import { angleAtBeats } from '@/features/lessons/kit/metronome-arm'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import type { Bar } from '@/features/lessons/kit/rhythm-model'
import { FOUR_QUARTERS, writeGrid } from '@/features/lessons/kit/rhythm-model'
import { lengthsWords } from '@/features/lessons/kit/rhythm-words'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'

/** The hero's bar: four quarter notes. */
export const HERO_BAR: Bar = writeGrid(FOUR_QUARTERS)

/** The predict's words (WEB-SPEC, Toys 3). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play the bar at 120 BPM, and watch the stopwatch.',
    silent:
      'Sound is off, so nothing played. Turn sound on, then play it again.',
    again: 'Play either bar again.',
  },
  guess: {
    same: 'You said: one second, the same',
    half: 'You said: half a second',
  },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** The figure's caption once its bar has been heard: the page's says nothing is written yet. */
export const HERO_WRITTEN =
  "Lesson 8's four beat pads, numbered 1 to 4, with four quarter notes written on the line above them and their lengths in the stopwatch strip under them."

/** How long the metronome's lamp stays lit after a beat, s. */
const LAMP_SEC = 0.12

/** The hero's figure: the bar on one line, compact, its pads lit and never pressed. */
export function heroView(bpm: number): RhythmView {
  return {
    scene: { staff: 'line', rows: [{ bars: [HERO_BAR], bpm }], compact: true },
    label: 'One bar of 4/4: four quarter notes, on one line',
    pads: null,
  }
}

export interface ColdOpen {
  readonly predict: Predict
  readonly bar: RhythmBar
  stop(): void
}

export function initColdOpen(deck: StepDeck): ColdOpen {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const fig = q('#heroFig')
  const holder = q('#heroPads', fig)
  holder.innerHTML = `<div class="l17-metro" aria-hidden="true">${metronomeSVG('mt-hero')}<i class="l17-lamp"></i></div><div class="rb hero-rb" aria-hidden="true"></div>`
  const caption = q('[data-hero-caption]', fig)
  const arm = holder.querySelector<SVGGElement>('.arm')
  const lamp = q('.l17-lamp', holder)
  let bpm = 60
  let revealed = false

  /** The small metronome as heard: its arm by the beats since the first, and its lamp. */
  function swing(beats: number | null): void {
    if (arm !== null)
      arm.style.transform =
        beats === null || Motion.paused
          ? ''
          : `rotate(${angleAtBeats(beats)}deg)`
    const into = beats === null ? Infinity : (beats % 1) * (60 / bpm)
    lamp.classList.toggle('is-lit', into < LAMP_SEC)
  }

  const midi = (): number => (VoiceChoice.voice === 'higher' ? A4 : A3)
  const bar = mountRhythmBar({
    figure: q('.hero-rb', holder),
    pads: null,
    said: q('[data-hero-said]', fig),
    freq: () => hz(midi()),
    voice: () => (midi() === A4 ? 'tavi' : 'merc'),
    owner: NowPlaying,
    onFrame: swing,
  })
  bar.show(heroView(bpm))

  /** Plays the bar at a tempo; resolves false when cut short. */
  function play(what: string): Promise<boolean> {
    const next = what === '120' ? 120 : 60
    // the same written bar: at a new tempo only the readings go
    if (next !== bpm) {
      bpm = next
      bar.retempo(next)
    }
    const view = bar.view ?? heroView(next)
    mercListen('blue', true)
    mercListen('orange', true)
    const line =
      next === 120 && !revealed ? undefined : lengthsWords([HERO_BAR], next)
    return bar.play([{ view, bpm: () => next }], { line }).then((heard) => {
      mercListen('blue', false)
      mercListen('orange', false)
      if (heard) caption.textContent = HERO_WRITTEN
      return heard
    })
  }

  const predict = mountPredict(q('#predict'), {
    play,
    // the two plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    // the 120 BPM play's lengths are spoken with the reveal
    onReveal: () => {
      revealed = true
      bar.say(lengthsWords([HERO_BAR], 120))
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  const stop = (): void => bar.stop()
  deck.subscribe(stop)
  onLeave(stage, stop)
  return { predict, bar, stop }
}
