// ============================================================
// Lesson 17 tap take — the two written bars, read from the page and tapped
// ============================================================
//
// The checkpoint's first part (WEB-SPEC, Toys 7, part 1; The checkpoint).
// The card holds the two written bars on one line, drawn from the start,
// since reading them is the task, their strip empty until they are heard.
// Start runs the take on the beat clock: a 0.6 s lead; one bar counted in
// on the woodblock's click, beat 1 higher; two bars of the click alone,
// tapped on every beat, each pad lighting; then the two written bars, the
// click going on under them and each note lighting as its start passes;
// then 0.35 s: 20 beats at 60 BPM, 20.95 s in all (FACTS 36). The click is
// all it plays. Each tap is timed at its event's own timestamp on the
// page's clock (kit/tap-pad.ts) and sounds a clap at once, at 0.7 (FACTS
// 69); each beat's time is where the audio clock put it, mapped onto the
// page's clock by the beat clock. The judge (take-judge.ts) lines the
// taps up from the bars of every beat and says one line in the status, and
// the strip under the written bars draws where each lined-up tap fell,
// gold where it met its note. The page can't hear claps, only taps: it
// never opens the microphone.
//
// Start becomes Stop while the take runs and moves the focus to the pad.
// Stop, the card off screen for 600 ms, a hidden page or another sound
// ends a take with no line. The take cannot run silently: with sound off,
// Start shows the kit's toast for a play that needs sound and runs nothing,
// and the status says why; with no Web Audio at all, Start is
// `aria-disabled` and the status says so. Again runs the whole take again,
// lining-up included, and stays on offer after any answer in the sung
// part, since the taps use no voice; nothing about a take is stored. Hear
// the bars, offered once a take has been heard to its end, plays the two
// bars on the stored voice's A after a bar's count-in, the click under
// them, each note lit as it sounds and the ticks left in place.

import type { Bar, Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { q } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar, WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { figureWords } from '@/features/lessons/kit/rhythm-words'
import { Sound } from '@/features/lessons/kit/sound'
import type { Bus } from '@/features/lessons/kit/sound-ahead'
import { openBus } from '@/features/lessons/kit/sound-ahead'
import { bindTapPad } from '@/features/lessons/kit/tap-pad'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bookWood } from '@/features/lessons/kit/woodblock'
import { triggerDrumVoice } from '@/lib/drum-voices'
import { TAKE_BARS } from './rhythm-views'
import { judgeBars, TAKE, TAKE_BPM, TAKE_ONSETS } from './take-judge'

/** The take's status lines, each written only when its words change (WEB-SPEC, Toys 7). */
export const TAKE_STATUS = {
  ready: "Press Start when you're ready to tap.",
  countIn: 'Counting in: one bar.',
  pulse: (bar: number): string => `Tap every beat: bar ${bar} of 2`,
  written: (bar: number): string => `Now the written bars: bar ${bar} of 2`,
  stopped: 'Stopped. Press Start to tap again.',
  soundOff:
    "Sound is off, so the take didn't start. Turn sound on, then press Start.",
  noAudio: "This browser can't play the page's sounds, so the take can't run.",
} as const

/** The take's shape in seconds: the lead before the first click and the tail after the last bar (FACTS 36). */
export const TAKE_LEAD = 0.6
export const TAKE_TAIL = 0.35

/** A tap's clap, at 0.7 of the drum voice's level (FACTS 69). */
export const CLAP_LEVEL = 0.7

/** The status for the bar that has just begun, from 0, the bar counted in. */
export function barStatus(bar: number): string {
  if (bar === 0) return TAKE_STATUS.countIn
  if (bar <= 2) return TAKE_STATUS.pulse(bar)
  return TAKE_STATUS.written(bar - 2)
}

/** What a take's hit is: a knock, or the moment a written note starts, which only lights it. */
export type TakeHit =
  | { readonly k: 'click'; readonly high: boolean }
  | { readonly k: 'note'; readonly i: number }

/** The take's five bars: a knock on every beat, beat 1 of each higher, and in the written two each note's start. */
export function takeBars(): Bar<TakeHit>[] {
  return Array.from({ length: TAKE.beats / 4 }, (_, b) => ({
    beats: 4,
    hits: [
      ...[0, 1, 2, 3].map((beat) => ({
        beat,
        data: { k: 'click', high: beat === 0 } as TakeHit,
      })),
      ...TAKE_ONSETS.flatMap((at, i) => {
        const beat = TAKE.judgedFrom + at - b * 4
        return beat >= 0 && beat < 4
          ? [{ beat, data: { k: 'note', i } as TakeHit }]
          : []
      }),
    ],
  }))
}

/** The pad a beat lights: the beat bars' on the written bars' pads, one bar each, and the written bars' own. */
export function padOf(spot: Spot): number | null {
  if (spot.bar === 1 || spot.bar === 2) return (spot.bar - 1) * 4 + spot.beat
  if (spot.bar === 3 || spot.bar === 4) return (spot.bar - 3) * 4 + spot.beat
  return null
}

/** The written bars as the take's figure shows them: on one line, every beat's pad lit in turn. */
export function takeView(): RhythmView {
  return {
    scene: { staff: 'line', rows: [{ bars: TAKE_BARS, bpm: TAKE_BPM }] },
    label: figureWords(TAKE_BARS, 'line'),
    pads: null,
  }
}

/** Whether this browser has Web Audio at all. */
const hasAudio = (): boolean =>
  typeof window.AudioContext === 'function' ||
  typeof (window as unknown as { webkitAudioContext?: unknown })
    .webkitAudioContext === 'function'

export interface Take {
  readonly bar: RhythmBar
  /** Ends the take, or Hear the bars, with no line. */
  stop(): void
}

function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

/** A button's label and icon for running or still. */
function setOn(b: HTMLButtonElement, on: boolean, idle: string): void {
  say(q('[data-label]', b), on ? 'Stop' : idle)
  b.classList.toggle('is-on', on)
  q('use', b).setAttribute(
    'href',
    on ? '#i-pause' : (b.dataset.icon ?? '#i-play'),
  )
}

export function initTake(card: HTMLElement): Take {
  const startBtn = q<HTMLButtonElement>('[data-take-start]', card)
  const againBtn = q<HTMLButtonElement>('[data-take-again]', card)
  const hearBtn = q<HTMLButtonElement>('[data-take-hear]', card)
  const pad = q<HTMLButtonElement>('[data-take-pad]', card)
  const status = q('#takeStatus', card)
  startBtn.dataset.icon = q('use', startBtn).getAttribute('href') ?? '#i-tap'
  hearBtn.dataset.icon = q('use', hearBtn).getAttribute('href') ?? '#i-play'
  const startLabel = q('[data-label]', startBtn).textContent ?? ''
  const hearLabel = q('[data-label]', hearBtn).textContent ?? ''

  const midi = (): number => (VoiceChoice.voice === 'higher' ? A4 : A3)
  const bar = mountRhythmBar({
    figure: q('[data-take-bars]', card),
    pads: null,
    said: status,
    freq: () => hz(midi()),
    voice: () => (midi() === A4 ? 'tavi' : 'merc'),
    owner: NowPlaying,
  })
  const view = takeView()
  // the bars are drawn from the start, their strip empty until heard
  bar.show(view, () => true, { readings: false })

  let take: Run | null = null
  let tapBus: Bus | null = null
  let taps: number[] = []

  function stopTake(): void {
    if (take === null) return
    const r = take
    take = null
    r.stop()
    tapBus?.close(0.3)
    tapBus = null
    bar.light({ pad: null, sounding: null })
    setOn(startBtn, false, startLabel)
    say(status, TAKE_STATUS.stopped)
    NowPlaying.release(stopTake)
  }

  function finish(r: Run): void {
    take = null
    tapBus?.close(0.3)
    tapBus = null
    bar.light({ pad: null, sounding: null })
    setOn(startBtn, false, startLabel)
    NowPlaying.release(stopTake)
    const beat0 = r.pageTimeOfBeat(0)
    againBtn.hidden = false
    hearBtn.hidden = false
    if (beat0 === null) return
    const result = judgeBars(taps, beat0)
    bar.ticks(result.ticks)
    say(status, result.line)
  }

  function start(): void {
    if (take !== null) {
      stopTake()
      return
    }
    if (!hasAudio()) return
    if (!Sound.canPlay({ needsSound: true })) {
      say(status, TAKE_STATUS.soundOff)
      return
    }
    // the page's one sound: the claim stops Hear the bars, or any other
    NowPlaying.claim(stopTake)
    taps = []
    bar.ticks(null)
    tapBus = openBus()
    let sounding: number | null = null
    const r = BeatClock.start<TakeHit>({
      bar: bars(takeBars()),
      bpm: () => TAKE_BPM,
      audible: true,
      lead: TAKE_LEAD,
      tail: TAKE_TAIL,
      book: (h, when, bus) => {
        if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
      },
      onBeat: (spot: Spot) => {
        if (spot.beat === 0) say(status, barStatus(spot.bar))
        bar.light({ pad: padOf(spot), sounding })
      },
      // each written note lights as its start passes, until the next
      onHit: (h, spot) => {
        if (h.k !== 'note') return
        sounding = h.i
        bar.light({ pad: padOf(spot), sounding })
      },
    })
    take = r
    setOn(startBtn, true, startLabel)
    say(status, TAKE_STATUS.countIn)
    pad.focus()
    void r.done.then((finished) => {
      // a stopped take is no longer the take
      if (take !== r) return
      if (finished) finish(r)
      else stopTake()
    })
  }

  function hear(): void {
    if (bar.playing) {
      bar.stop()
      return
    }
    if (!hasAudio()) return
    setOn(hearBtn, true, hearLabel)
    // the bar claims the page's owner, so a take running stops
    void bar
      .play([{ view: bar.view ?? view, bpm: () => TAKE_BPM, countIn: 4 }])
      .then(() => {
        if (!bar.playing) setOn(hearBtn, false, hearLabel)
      })
  }

  bindTapPad(pad, (at) => {
    if (take === null) return
    taps.push(at)
    // each tap sounds a clap at once, at the take's level
    const b = tapBus
    if (b !== null && b.open)
      triggerDrumVoice(
        'clap',
        b.context,
        b.context.currentTime,
        CLAP_LEVEL,
        b.node,
      )
  })
  startBtn.addEventListener('click', start)
  // Again starts the take afresh, one running included
  againBtn.addEventListener('click', () => {
    stopTake()
    start()
  })
  hearBtn.addEventListener('click', hear)

  // leaving the card ends what it plays, with no line
  const stop = (): void => {
    stopTake()
    bar.stop()
  }
  onLeave(card, stop)

  if (!hasAudio()) {
    startBtn.setAttribute('aria-disabled', 'true')
    say(status, TAKE_STATUS.noAudio)
  }

  return { bar, stop }
}
