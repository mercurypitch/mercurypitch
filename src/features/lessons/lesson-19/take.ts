// ============================================================
// Lesson 19 tap take — each tune's beat, with the click and then on your own
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 7; The checkpoint: how it takes input).
// Two Starts, "Start: the 6/8 tune" and "Start: the 3/4 tune", each run its
// take on the beat clock: a 0.6 s lead; one bar counted in on the
// woodblock's click, beat 1 higher, two clicks 1 s apart for the 6/8 tune
// and three 0.67 s apart for the 3/4; the tune with the click on every
// beat, 8 s; the tune again with the click stopped, 8 s; then 0.35 s, 18.95
// s for either (FACTS 36). The tune is Step 2's, on the stored voice's
// clef, from C3 for the lower voice and C4 for the higher, each note at its
// own pitch, held for its length less the gap. Each tap is timed at its
// event's own timestamp on the page's clock (kit/tap-pad.ts) and sounds the
// app's clap at once, at 0.7 (FACTS 31); each beat's time is where the
// audio clock put it, mapped onto the page's clock by the beat clock. The
// judge (take-judge.ts) lines the taps up from the first time through and
// judges the second, and says one line in the status. The figure is the
// second time through's beats, four bars of numbered pads over the strip,
// a tick on the strip where each lined-up tap fell, gold where it met its
// beat. Nothing on it lights while a take runs: the second time through is
// the beat held, and a lit pad would be a click to follow. The page can't
// hear claps, only taps: it never opens the microphone.
//
// The Start pressed becomes Stop while its take runs and moves the focus to
// the pad; the other Start stops it and starts its own, and either runs its
// take again at any time. Stop, the card off screen for 600 ms, a hidden
// page or another sound ends a take with no line. The take cannot run
// silently: with sound off, a Start shows the kit's toast for a play that
// needs sound and runs nothing, and the status says why; with no Web Audio
// at all, both Starts are `aria-disabled` and the status says so. Nothing
// about a take is stored.

import type { Bar, Hit, Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { A3, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar, WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { placeRow } from '@/features/lessons/kit/rhythm-layout'
import type { Bar as WrittenBar, Written, } from '@/features/lessons/kit/rhythm-model'
import { barQuarters, beatQuarters, heldSeconds, soundsOf, } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import type { Bus } from '@/features/lessons/kit/sound-ahead'
import { bookNote, openBus } from '@/features/lessons/kit/sound-ahead'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { bindTapPad } from '@/features/lessons/kit/tap-pad'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bookWood } from '@/features/lessons/kit/woodblock'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { MetreKey } from './rhythm-views'
import { METRES, SIX_BPM, tuneNotes, TUNES } from './rhythm-views'
import { judgeBeats, PASS_BARS } from './take-judge'

/** The take's status lines, each written only when its words change (WEB-SPEC, Toys 7; FACTS 37). */
export const TAKE_STATUS = {
  ready: "Press a Start button when you're ready to tap.",
  countIn: 'Counting in: one bar.',
  withClick: (bar: number): string => `Tap with the click: bar ${bar} of 4`,
  onYourOwn: (bar: number): string => `Now on your own: bar ${bar} of 4`,
  stopped: 'Stopped. Press a Start button to tap again.',
  soundOff:
    "Sound is off, so the take didn't start. Turn sound on, then press a Start button.",
  noAudio: "This browser can't play the page's sounds, so the take can't run.",
} as const

/** The take's shape in seconds: the lead before the first click and the tail after the last bar (FACTS 36). */
export const TAKE_LEAD = 0.6
export const TAKE_TAIL = 0.35

/** A tap's clap, at 0.7 of the drum voice's level (FACTS 31). */
export const CLAP_LEVEL = 0.7

/** The status for the bar that has just begun, from 0, the bar counted in. */
export function barStatus(bar: number): string {
  if (bar === 0) return TAKE_STATUS.countIn
  if (bar <= PASS_BARS) return TAKE_STATUS.withClick(bar)
  return TAKE_STATUS.onYourOwn(bar - PASS_BARS)
}

/** What a take's hit is: a knock, or one of the tune's notes, at its pitch for its length. */
export type TakeHit =
  | { readonly k: 'click'; readonly high: boolean }
  | { readonly k: 'note'; readonly freq: number; readonly beats: number }

const isKey = (k: string | undefined): k is MetreKey =>
  k === '6-8' || k === '3-4'

/** The voice's clef: the treble for the higher voice, the bass otherwise (FACTS 10). */
const clefOf = (): Clef => (VoiceChoice.voice === 'higher' ? 'treble' : 'bass')

/**
 * A take's nine bars, each three quarter notes at 90 BPM: one counted in,
 * the tune with the click on every beat of its metre, and the tune again
 * with the click stopped (FACTS 36).
 */
export function takeBars(key: MetreKey, clef: Clef): Bar<TakeHit>[] {
  const metre = METRES[key]
  const bar = barQuarters(metre)
  const unit = beatQuarters(metre)
  const clicks: Hit<TakeHit>[] = Array.from(
    { length: Math.round(bar / unit) },
    (_, k) => ({ beat: k * unit, data: { k: 'click', high: k === 0 } }),
  )
  const notes = tuneNotes(key, clef)
  const sounds = soundsOf(
    placeRow({ bars: TUNES[key].bars, bpm: SIX_BPM, metre }),
  )
  const tune = Array.from({ length: PASS_BARS }, (_, b) =>
    sounds.flatMap((s, i): Hit<TakeHit>[] =>
      Math.floor(s.at / bar + 1e-9) === b
        ? [
            {
              beat: s.at - b * bar,
              data: { k: 'note', freq: hz(midiOf(notes[i])), beats: s.beats },
            },
          ]
        : [],
    ),
  )
  return [
    { beats: bar, hits: clicks },
    ...tune.map((hits) => ({ beats: bar, hits: [...clicks, ...hits] })),
    ...tune.map((hits) => ({ beats: bar, hits })),
  ]
}

const beatNote = (unit: number): Written =>
  unit === 1.5
    ? { kind: 'note', value: 1, dotted: true }
    : { kind: 'note', value: 1 }

/** The figure: the second time through's beats, four bars of numbered pads over the strip, nothing written. */
export function takeView(key: MetreKey): RhythmView {
  const metre = METRES[key]
  const unit = beatQuarters(metre)
  const perBar = Math.round(barQuarters(metre) / unit)
  const bar: WrittenBar = Array.from({ length: perBar }, () => beatNote(unit))
  return {
    scene: {
      staff: 'line',
      rows: [
        {
          bars: Array.from({ length: PASS_BARS }, () => bar),
          bpm: SIX_BPM,
          metre,
        },
      ],
      notation: false,
      padEvery: unit,
      compact: true,
    },
    label: `The ${key === '6-8' ? '6/8' : '3/4'} tune's beats, four bars of ${perBar}, with a tick where each tap fell`,
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
  /** Ends a take running, with no line. */
  stop(): void
}

function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

/** A Start's label and icon for running or still. */
function setOn(b: HTMLButtonElement, on: boolean): void {
  say(q('[data-label]', b), on ? 'Stop' : (b.dataset.label ?? ''))
  b.classList.toggle('is-on', on)
  q('use', b).setAttribute(
    'href',
    on ? '#i-pause' : (b.dataset.icon ?? '#i-tap'),
  )
}

interface Running {
  readonly run: Run
  readonly key: MetreKey
  readonly button: HTMLButtonElement
}

export function initTake(card: HTMLElement): Take {
  const starts = qa<HTMLButtonElement>('[data-take-start]', card)
  const pad = q<HTMLButtonElement>('[data-take-pad]', card)
  const status = q('#takeStatus', card)
  for (const b of starts) {
    b.dataset.icon = q('use', b).getAttribute('href') ?? '#i-tap'
    b.dataset.label = q('[data-label]', b).textContent ?? ''
  }

  // the figure is drawn, never played: its bar sounds nothing
  const bar = mountRhythmBar({
    figure: q('[data-take-strip]', card),
    pads: null,
    said: status,
    freq: () => hz(A3),
    voice: () => 'merc',
    owner: NowPlaying,
  })
  let shown: MetreKey = '6-8'
  const draw = (): void =>
    bar.show(takeView(shown), () => true, { readings: false })
  draw()

  let take: Running | null = null
  let tapBus: Bus | null = null
  let taps: number[] = []

  /** What every ending does: the bus closed, the Start still, the page's one sound let go. */
  function end(t: Running): void {
    take = null
    tapBus?.close(0.3)
    tapBus = null
    setOn(t.button, false)
    NowPlaying.release(stopTake)
  }

  function stopTake(): void {
    if (take === null) return
    const t = take
    end(t)
    t.run.stop()
    say(status, TAKE_STATUS.stopped)
  }

  function finish(t: Running): void {
    end(t)
    const beat0 = t.run.pageTimeOfBeat(0)
    if (beat0 === null) return
    const result = judgeBeats(t.key, taps, beat0)
    bar.ticks(result.ticks)
    say(status, result.line)
  }

  function start(button: HTMLButtonElement): void {
    const key = button.dataset.takeStart
    if (!isKey(key)) return
    // a Start pressed again is its Stop; the other Start's take gives way
    const again = take?.button === button
    stopTake()
    if (again || !hasAudio()) return
    if (!Sound.canPlay({ needsSound: true })) {
      say(status, TAKE_STATUS.soundOff)
      return
    }
    // the page's one sound: the claim stops any other play
    NowPlaying.claim(stopTake)
    taps = []
    if (shown !== key) {
      shown = key
      draw()
    }
    bar.ticks(null)
    tapBus = openBus()
    const r = BeatClock.start<TakeHit>({
      bar: bars(takeBars(key, clefOf())),
      bpm: () => SIX_BPM,
      audible: true,
      lead: TAKE_LEAD,
      tail: TAKE_TAIL,
      book: (h, when, bus) => {
        if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
        else
          bookNote(h.freq, {
            when,
            dur: heldSeconds(h.beats, SIX_BPM),
            kind: 'soft',
            to: bus.node,
          })
      },
      onBeat: (spot: Spot) => {
        if (spot.beat === 0) say(status, barStatus(spot.bar))
      },
    })
    const t: Running = { run: r, key, button }
    take = t
    setOn(button, true)
    say(status, TAKE_STATUS.countIn)
    pad.focus()
    void r.done.then((finished) => {
      // a stopped take is no longer the take
      if (take !== t) return
      if (finished) finish(t)
      else stopTake()
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
  for (const b of starts) b.addEventListener('click', () => start(b))

  // leaving the card ends a take, with no line
  onLeave(card, stopTake)

  if (!hasAudio()) {
    for (const b of starts) b.setAttribute('aria-disabled', 'true')
    say(status, TAKE_STATUS.noAudio)
  }

  return { bar, stop: stopTake }
}
