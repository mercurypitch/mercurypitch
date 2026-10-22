// ============================================================
// Lesson 8 tap take — the backbeat, tapped under a groove
// ============================================================
//
// Sing it's first part (WEB-SPEC, Toys 6, part 1; The checkpoint). Play
// the groove plays four bars of a kick on 1 and 3 and the hi-hat on every
// eighth, for clapping aloud; nothing is measured. Start runs the take on
// the beat clock: 0.6 s, a bar counted in on the click, two bars of the
// groove with the click (tap every beat), four without (tap 2 and 4), then
// 0.35 s. Each tap is timed at its event's own timestamp on the page's
// clock (kit/tap-pad.ts) and sounds a clap at once; each beat's time is
// where the audio clock put it, mapped onto the page's clock by the beat
// clock. The judge (take-judge.ts) lines the taps up from the bars of
// every beat and says one line about the last four bars. The page can't
// hear claps, only taps: it never opens the microphone.
//
// Start becomes Stop while the take runs and moves the focus to the pad.
// Stop, leaving the card or the page, or another sound ends a take with no
// line. Neither the take nor the groove can run silently: with sound off,
// Start and Play the groove show the kit's toast for a play that needs
// sound and run nothing, and the status says why; with no Web Audio at
// all, both are `aria-disabled`, and the status says so. Again runs the
// whole take again, lining-up included, after any answer in the sung part,
// since the taps use no voice; nothing about a take is stored.

import type { Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { bookHit } from '@/features/lessons/kit/beat-machine'
import type { MachineHit } from '@/features/lessons/kit/beat-patterns'
import type { BeatStrip } from '@/features/lessons/kit/beat-strip'
import { emptyRow, mountBeatStrip } from '@/features/lessons/kit/beat-strip'
import { q } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Bus } from '@/features/lessons/kit/sound-ahead'
import { openBus } from '@/features/lessons/kit/sound-ahead'
import { bindTapPad } from '@/features/lessons/kit/tap-pad'
import { triggerDrumVoice } from '@/lib/drum-voices'
import { BPM, CLAP_LEVEL, grooveBars, takeBars } from './patterns'
import { judgeBackbeat } from './take-judge'

/** The take's status lines, each written only when its words change. */
export const TAKE_STATUS = {
  ready: "Press Start when you're ready to tap.",
  countIn: 'Counting in: one bar.',
  pulse: (bar: number): string => `Tap every beat: bar ${bar} of 2`,
  backbeat: (bar: number): string => `Now 2 and 4: bar ${bar} of 4`,
  stopped: 'Stopped. Press Start to tap again.',
  soundOff:
    "Sound is off, so the take didn't start. Turn sound on, then press Start.",
  grooveSoundOff:
    "Sound is off, so the groove didn't play. Turn sound on, then press Play the groove.",
  noAudio: "This browser can't play the page's sounds, so the take can't run.",
} as const

/** The take's shape in seconds: the lead before the first click and the tail after the last bar (FACTS 43). */
export const TAKE_LEAD = 0.6
export const TAKE_TAIL = 0.35

/** The status for the bar that has just begun, from 0, the bar counted in. */
export function barStatus(bar: number): string {
  if (bar === 0) return TAKE_STATUS.countIn
  if (bar <= 2) return TAKE_STATUS.pulse(bar)
  return TAKE_STATUS.backbeat(bar - 2)
}

/** Whether this browser has Web Audio at all. */
const hasAudio = (): boolean =>
  typeof window.AudioContext === 'function' ||
  typeof (window as unknown as { webkitAudioContext?: unknown })
    .webkitAudioContext === 'function'

export interface Take {
  /** Ends the take, or the groove, with no line. */
  stop(): void
}

function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

/** A button's label and icon for playing or still. */
function setOn(b: HTMLButtonElement, on: boolean, idle: string): void {
  say(q('[data-label]', b), on ? 'Stop' : idle)
  b.classList.toggle('is-on', on)
  q('use', b).setAttribute(
    'href',
    on ? '#i-pause' : (b.dataset.icon ?? '#i-play'),
  )
}

/** The take strip: one bar of four, 2 and 4 marked, then the four bars it timed. */
function resetStrip(strip: BeatStrip): void {
  strip.setRows([emptyRow(4)])
  strip.outline([])
}

export function initTake(card: HTMLElement): Take {
  const grooveBtn = q<HTMLButtonElement>('[data-take-groove]', card)
  const startBtn = q<HTMLButtonElement>('[data-take-start]', card)
  const againBtn = q<HTMLButtonElement>('[data-take-again]', card)
  const pad = q<HTMLButtonElement>('[data-take-pad]', card)
  const status = q('#takeStatus', card)
  const strip = mountBeatStrip(q('#takeStrip', card), {
    rows: [emptyRow(4)],
    beatsPerBar: 4,
  })
  strip.marks({ accent: true, backbeat: true })
  startBtn.dataset.icon = q('use', startBtn).getAttribute('href') ?? '#i-play'
  const startLabel = q('[data-label]', startBtn).textContent ?? ''
  const grooveLabel = q('[data-label]', grooveBtn).textContent ?? ''

  let take: Run | null = null
  let groove: Run | null = null
  let tapBus: Bus | null = null
  let taps: number[] = []
  // the stops so far: a take that finds them changed was ended by a stop
  let stops = 0

  function stopGroove(): void {
    const r = groove
    groove = null
    r?.stop()
    setOn(grooveBtn, false, grooveLabel)
    NowPlaying.release(stopGroove)
  }

  function stopTake(): void {
    if (take === null) return
    stops += 1
    const r = take
    take = null
    r.stop()
    tapBus?.close(0.3)
    tapBus = null
    strip.light(null)
    setOn(startBtn, false, startLabel)
    say(status, TAKE_STATUS.stopped)
    NowPlaying.release(stopTake)
  }

  function finish(r: Run): void {
    take = null
    tapBus?.close(0.3)
    tapBus = null
    strip.light(null)
    setOn(startBtn, false, startLabel)
    NowPlaying.release(stopTake)
    const beat0 = r.pageTimeOfBeat(0)
    const result =
      beat0 === null ? null : judgeBackbeat(taps, beat0, 60000 / BPM)
    againBtn.hidden = false
    if (result === null) return
    if (result.latencyMs !== null) {
      strip.setRows([emptyRow(4), emptyRow(4), emptyRow(4), emptyRow(4)])
      strip.outline([1, 3])
      result.ticks.forEach((row, i) => strip.ticks(i, row))
    }
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
    NowPlaying.claim(stopTake)
    const mine = stops
    taps = []
    resetStrip(strip)
    tapBus = openBus()
    const r = BeatClock.start<MachineHit>({
      bar: bars(takeBars()),
      bpm: () => BPM,
      audible: true,
      lead: TAKE_LEAD,
      tail: TAKE_TAIL,
      book: bookHit,
      onBeat: (spot: Spot) => {
        if (spot.beat !== 0) return
        say(status, barStatus(spot.bar))
        if (spot.bar === 3) strip.outline([1, 3])
      },
      onFrame: (spot: Spot) => strip.light(spot.beat),
    })
    take = r
    setOn(startBtn, true, startLabel)
    pad.focus()
    void r.done.then((finished) => {
      if (mine !== stops || take !== r) return
      if (finished) finish(r)
      else stopTake()
    })
  }

  function toggleGroove(): void {
    if (groove !== null) {
      stopGroove()
      return
    }
    if (!hasAudio()) return
    // a silent groove has nothing on screen to follow, so it does not run
    if (!Sound.canPlay({ needsSound: true })) {
      say(status, TAKE_STATUS.grooveSoundOff)
      return
    }
    NowPlaying.claim(stopGroove)
    const r = BeatClock.start<MachineHit>({
      bar: bars(grooveBars()),
      bpm: () => BPM,
      audible: true,
      book: bookHit,
    })
    groove = r
    // the line that said it didn't play is no longer true
    if (status.textContent === TAKE_STATUS.grooveSoundOff)
      say(status, TAKE_STATUS.ready)
    setOn(grooveBtn, true, grooveLabel)
    void r.done.then(() => {
      if (groove === r) stopGroove()
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
  againBtn.addEventListener('click', start)
  grooveBtn.addEventListener('click', toggleGroove)

  if (!hasAudio()) {
    for (const b of [startBtn, grooveBtn])
      b.setAttribute('aria-disabled', 'true')
    say(status, TAKE_STATUS.noAudio)
  }

  return {
    stop() {
      stopGroove()
      stopTake()
    },
  }
}
