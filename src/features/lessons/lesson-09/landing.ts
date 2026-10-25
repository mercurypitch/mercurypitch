// ============================================================
// Lesson 9 landing — Step 5's illustrated leap, with Play, Pause, Slow and scrub
// ============================================================
//
// Step 5's figure (WEB-SPEC, Toys 1, "Landing"): an illustrated singer's
// leap, drawn as a violet line over do's slot and so's, that lands 80
// cents under so, holds, slides up into the band and settles 25 cents
// under (FACTS 94), while so's band glows amber. It is an illustration,
// never either Merc (FACTS 99), so it sounds in the soft tone: do, then
// one voice that glides (the kit's `playLine`). The kit's runs have no
// start time, so the slide waits here for do's end, and a stop silences
// both.
//
// The readout follows the line in the band chart's words (`bandValueText`,
// through lines.ts), from the moment the leap lands (none during do's
// first second), and so's edge lights "IN THE BAND" while the line sits
// inside it. Play turns to Pause while it sounds; Pause leaves the line
// where it stands and Play carries on from there, as Lesson 7's siren
// does, and starts again from the beginning once the line has ended.
// Slow stretches the landing to 6.0 s: its sound is twice as long and its
// clock runs at half speed, since the line, the readout and the scrub bar
// all count seconds at speed (0 to 3). Slow pressed mid-landing carries on
// from where the line stands, at the new speed.
//
// The scrub bar is the kit's native range (`input.range`), as Lesson 3's
// chase scrubs its band chart: the browser gives it the arrow keys a tenth
// of a second at a time, Home and End, touch and a screen reader's
// slider, and its words are `scrubText`'s ("1.4 seconds of 3: 80 cents
// below Merc's note, outside the band"). Scrubbing pauses the sound and
// draws the line to that moment, silently. While the landing plays the
// bar follows it.
//
// The landing is one of the page's sounds (kit/now-playing.ts): a newer
// sound anywhere pauses it, and so does leaving Step 5 (steps.ts). Under
// reduced motion Play draws the whole line at once while the sound plays
// (WEB-SPEC, Toys 1). The chart asks for frames only while the line moves.

import { inBand } from '@/features/lessons/kit/band-words'
import { q } from '@/features/lessons/kit/dom'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLine, playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { rangeFill } from '@/features/lessons/kit/toy-helpers'
import type { LadderChart } from './ladder-chart'
import { RUNGS } from './ladder-data'
import { landingReadout, scrubText } from './lines'
import { LANDING_SEC, landingAt, landingSoundFrom, landingTrace, SLOW, } from './sounds'

/** Within this of the end, Play starts the landing again from its start, as Lesson 7's siren does. */
const END_SLACK = 0.05

/** So's band, cents from do, the chart's target. */
const SO_CENTS = RUNGS.so.step * 100

/** A run started `seconds` from now, unless stopped first: the slide, which starts as do ends. */
function later(seconds: number, start: () => Run): Run {
  let inner: Run | null = null
  let settle: (heard: boolean) => void
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })
  const timer = window.setTimeout(() => {
    inner = start()
    void inner.done.then((heard) => settle(heard))
  }, seconds * 1000)
  return {
    done,
    stop() {
      window.clearTimeout(timer)
      if (inner === null) settle(false)
      else inner.stop()
    },
  }
}

/**
 * Step 5's sound from `from` seconds in, at speed, in the soft tone: what
 * is left of do, then the slide from where the line stands; `slow` 2 under
 * Slow. Heard to its end only if both are; a stop silences both.
 */
export function landingRun(
  doMidi: number,
  from: number,
  slow: number,
  audible: boolean,
): Run {
  const { first, slide } = landingSoundFrom(doMidi, from, slow)
  const o = { audible, kind: 'soft' } as const
  const line = later(slide.at, () => playLine(slide.points, o))
  return allOf(first === null ? [line] : [playNotes([first], o), line])
}

export interface LandingOptions {
  /** The steps' toy, holding Play, the scrub bar and the readout. */
  readonly root: HTMLElement
  readonly ladder: LadderChart
  /** When the line may move: Step 5 showing on a stage on screen. */
  readonly active: () => boolean
  /** Whether Slow is pressed. */
  readonly slow: () => boolean
}

export interface Landing {
  /** Where the line stands, seconds into the landing at speed. */
  readonly t: number
  readonly playing: boolean
  /** Stops the sound and leaves the line where it stands: Pause, a newer sound, a step left. */
  stop(): void
  /** Slow pressed or released: a landing in flight carries on from where it stands, at the new speed. */
  slowChanged(): void
  /** The line, the lit band and the readout on the chart again, as the chart shows Step 5. */
  draw(): void
}

export function mountLanding(o: LandingOptions): Landing {
  const btn = q<HTMLButtonElement>('[data-ladder-play="landing"]', o.root)
  const scrub = q<HTMLInputElement>('[data-landing-scrub]', o.root)
  const readout = q('[data-ladder-readout]', o.root)
  let t = 0
  let run: Run | null = null
  // the landing in flight: where it started, at speed; when, ms; how slowly
  let clock = { from: 0, at: 0, slow: 1 }

  /** Where the line stands now: on the clock while it moves, where it was left otherwise. */
  function now(): number {
    if (run === null || reducedMotion()) return t
    const ran = (performance.now() - clock.at) / 1000 / clock.slow
    return Math.min(LANDING_SEC, clock.from + ran)
  }

  function playWord(on: boolean): void {
    q('use', btn).setAttribute('href', on ? '#i-pause' : '#i-play')
    q('[data-play-word]', btn).textContent = on ? 'Pause' : 'Play'
    btn.classList.toggle('is-on', on)
  }

  /** The scrub bar where the line stands, a tenth of a second at a time, and its words with it. */
  function syncScrub(): void {
    const tenth = Math.round(t * 10) / 10
    if (Number(scrub.value) !== tenth) scrub.value = String(tenth)
    rangeFill(scrub)
    const text = scrubText(tenth)
    if (scrub.getAttribute('aria-valuetext') !== text)
      scrub.setAttribute('aria-valuetext', text)
  }

  /** The line to where it stands, so's band glowing, its edge lit while the line sits inside it; the readout and the bar with it. */
  function paint(): void {
    const s = o.ladder.chart.scene
    const line = t > 0 ? o.ladder.lineOf(landingTrace(t)) : []
    const head = line[line.length - 1]
    s.line = line
    s.head = head?.c == null ? null : { t: head.t, c: head.c }
    const at = landingAt(t)
    const lit = at.rung === 'so' && inBand(at.cents)
    const glow = t > 0 || run !== null ? 1 : 0
    s.rungs = (s.rungs ?? []).map((r) =>
      r.c === SO_CENTS ? { ...r, glow, lit } : r,
    )
    const said = landingReadout(o.ladder.doMidi, t) ?? ''
    if (readout.textContent !== said) readout.textContent = said
    syncScrub()
    wake()
  }

  /** The landing's sound from `from` seconds in, and its clock. */
  function start(from: number): void {
    NowPlaying.claim(stop)
    const slow = o.slow() ? SLOW : 1
    const r = landingRun(o.ladder.doMidi, from, slow, Sound.canPlay())
    run = r
    clock = { from, at: performance.now(), slow }
    t = reducedMotion() ? LANDING_SEC : from
    playWord(true)
    paint()
    void r.done.then((heard) => {
      if (run !== r) return
      // heard to its end; or cut short as every sound stopped (the Sound
      // switch, a hidden page), the line where the sound left it
      t = heard ? LANDING_SEC : now()
      run = null
      playWord(false)
      NowPlaying.release(stop)
      paint()
    })
  }

  function stop(): void {
    const r = run
    if (r === null) return
    t = now()
    run = null
    r.stop()
    playWord(false)
    NowPlaying.release(stop)
    paint()
  }

  btn.addEventListener('click', () => {
    if (run !== null) stop()
    else start(t >= LANDING_SEC - END_SLACK ? 0 : t)
  })
  scrub.addEventListener('input', () => {
    // read before the pause, which sets the bar to where the line stood
    const at = Math.min(Math.max(Number(scrub.value), 0), LANDING_SEC)
    stop()
    t = at
    paint()
  })
  syncScrub()

  addDrawer({
    active: o.active,
    wants: () => run !== null && !reducedMotion(),
    draw() {
      t = now()
      paint()
    },
  })

  return {
    get t() {
      return t
    },
    get playing() {
      return run !== null
    },
    stop,
    slowChanged() {
      const r = run
      if (r === null) return
      const from = now()
      run = null
      r.stop()
      start(from)
    },
    draw: paint,
  }
}
