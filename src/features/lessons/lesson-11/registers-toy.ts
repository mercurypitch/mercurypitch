// ============================================================
// Lesson 11 registers toy — the steps' range chart in its five states, and free play's
// ============================================================
//
// One range chart (kit/range-chart.ts) under its own rows of controls, in
// the state a step asks for (WEB-SPEC, Toys 1): one note in each gear,
// drawn side by side; Merc's slide with the stretch gauge, Play (Pause while
// playing), Slow and a scrub bar; three model slides in three slots; five
// slides across a narrowing seam, in turn or one at a time; and a figure
// flipped on purpose or with the switch hidden. Merc's line is drawn in his
// two gears, thick in the lower and thin in the upper, as it sounds, and
// stays drawn; each slot's seam comes with its slide. Free play mounts the
// same toy with every state under one switch and a voice switch of its own,
// which changes the chart's voice for the visit and stores nothing; the
// steps' chart follows the stored voice, so a choice made in Sing it moves
// its lines. Each state keeps its settings for the visit (Slow, what is
// drawn), whatever the voice.
//
// Every sound is the page's one sound (kit/now-playing.ts): a new press
// anywhere stops the last, the same press again stops it, and leaving the
// step stops the toy (steps.ts). Slow doubles every length of the state's
// lines and never changes a pitch; pressed during a play, the play carries on
// from where it stands at the new speed. A sound decides once, at the tap,
// whether it is heard: with sound off each play draws in silence. Under
// reduced motion a line is drawn whole at once, with no glowing head, and
// the gauge shows its end; the sound still plays. The canvas is a picture:
// the chart's group carries its summary, and a polite live line speaks for
// each play in spoken names, from the viewer's first press on and only when
// its words change.

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { LinePoint, RangeLine, RangeScene, RangeSeam, } from '@/features/lessons/kit/range-chart'
import { mountRangeChart, RANGE_COLOR, } from '@/features/lessons/kit/range-chart'
import type { Run } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { playGears } from './gear-sound'
import type { GearLine } from './lines'
import { drawn, FIGURE_SEC, figureDrawn, figureLine, flipFrom, gearNote, JUMP, JUMP_SEC, lineAt, lineFrom, lineLength, shifted, SIREN_RATE, SIREN_UP, sirenFloor, SLIDE_GAP, SLIDE_SEC, smootherRun, smootherSeam, smootherSlide, smootherStart, STEPS_WINDOW, stretched, threeSlides, upHalf, } from './lines'
import type { Gear, ToyState } from './registers-words'
import { fiveSaid, gearLabel, gearSaid, scrubWords, slideSaid, STATES, stepOf, styleSaid, summaryOf, threeSaid, } from './registers-words'

/** Step 1's time area, and where each gear's note sits in it: the left half and the right. */
export const GEARS_SEC = 6
export const GEAR_AT: Readonly<Record<Gear, number>> = {
  lower: 0.5,
  upper: 3.5,
}
/** Step 3's slots, one slide's 4.0 s each. */
export const THREE_SLOT = SIREN_UP
/** Step 4's slots, one slide and its quiet each, a slide centred in its slot. */
export const FIVE_SLOT = SLIDE_SEC + SLIDE_GAP
const FIVE_PAD = SLIDE_GAP / 2
/** The scrub bar's arrow keys move this far, seconds. */
const SCRUB_STEP = 0.1
/** The chart's caption, in every state. */
export const CAPTION = "Merc's model"
/** A full-width seam's label (Steps 2 and 5). */
export const SWITCH_LABEL = 'the switch'

/** When the slide's jump runs, and between which notes: the scrub bar names it. */
export function slideJump(v: Voice): {
  t0: number
  t1: number
  lo: number
  hi: number
} {
  const t0 = 3 / SIREN_RATE
  return { t0, t1: t0 + JUMP_SEC, lo: flipFrom(v), hi: flipFrom(v) + JUMP }
}

/** Step 2's gauge: a tenth full at the slide's start, full at its end, evenly between. */
export const gaugeFill = (t: number): number =>
  0.1 + 0.9 * clamp(t / SIREN_UP, 0, 1)

export interface RegistersToyOptions {
  /** When the chart draws: the deck's `toyActive(1)`, or free play's own watch. */
  readonly active?: () => boolean
}

export interface RegistersToy {
  readonly state: ToyState
  setState(s: ToyState): void
  /** Stops what the toy is sounding, its drawing where it stands. */
  stop(): void
  readonly voice: Voice
  /** What the chart shows now. */
  readonly scene: RangeScene
}

/** What a play is: what pressed it, its line in its own time, and how it is drawn. */
interface Start {
  readonly key: string
  readonly line: GearLine
  readonly from?: number
  readonly button: HTMLButtonElement | null
  /** Draws the line to `t` seconds of its own time. */
  readonly draw: (t: number) => void
  /** Once it is heard to its end. */
  readonly heard?: () => void
  /** Live lines on the way, at seconds of the line's own time. */
  readonly cues?: readonly (readonly [number, string])[]
}

/** A sound in flight: its play, the state and speed it began in, and its run. */
interface Playing {
  readonly o: Start
  readonly state: ToyState
  readonly from: number
  readonly speed: number
  readonly startedAt: number
  readonly run: Run
}

type Slowed = Exclude<ToyState, 'gears'>

export function mountRegistersToy(
  root: HTMLElement,
  opts: RegistersToyOptions = {},
): RegistersToy {
  const viz = q('[data-range-viz]', root)
  const chart = mountRangeChart(viz, {
    window: STEPS_WINDOW,
    active: opts.active,
  })
  const said = q('[data-range-said]', root)
  const fill = q('[data-stretch-fill]', root)
  const scrub = q('[data-slide-scrub]', root)
  const slideBtn = q<HTMLButtonElement>('[data-slide-play]', root)
  const gearBtns = qa<HTMLButtonElement>('[data-gear-play]', root)
  const threeBtns = qa<HTMLButtonElement>('[data-slide-n]', root)
  const fiveBtn = q<HTMLButtonElement>('[data-five-play]', root)
  const oneBtns = qa<HTMLButtonElement>('[data-one]', root)
  const styleBtns = qa<HTMLButtonElement>('[data-style]', root)
  const slowBtns = qa<HTMLButtonElement>('[data-slow]', root)
  const stateBtns = qa<HTMLButtonElement>('[data-free-state]', root)
  const voiceBtns = qa<HTMLButtonElement>('[data-chart-voice]', root)
  viz.setAttribute('role', 'group')

  let state: ToyState = 'gears'
  let voice: Voice = VoiceChoice.voice ?? 'lower'
  // free play's voice switch, once pressed, holds the voice for the visit
  let ownVoice = false
  const slow: Record<Slowed, boolean> = {
    slide: slowBtns.some(
      (b) =>
        b.dataset.slow === 'slide' && b.getAttribute('aria-pressed') === 'true',
    ),
    three: false,
    smoother: false,
    styles: false,
  }
  // how far each line is drawn, seconds of its own time
  const gearT: Record<Gear, number> = { lower: 0, upper: 0 }
  let slideT = 0
  const threeT = [0, 0, 0]
  const fiveT = [0, 0, 0, 0, 0]
  let style: 'flip' | 'hide' | null = null
  let styleT = 0
  let now: Playing | null = null
  let timers: number[] = []
  // the live line speaks for what the viewer did, not for the page loading
  let speaking = false

  function say(text: string): void {
    if (speaking && said.textContent !== text) said.textContent = text
  }

  // ------------------------------------------------------------ the scene

  /** A line drawn to `upTo`, with its glowing head while it sounds. */
  function lineOf(points: LinePoint[], sounding: boolean): RangeLine {
    const last = points[points.length - 1]
    const head =
      sounding && !reducedMotion() && last !== undefined && last.midi !== null
        ? { t: last.t, midi: last.midi, glow: 1 }
        : null
    return { points, color: RANGE_COLOR.target, head }
  }

  const sounding = (key: string): boolean => now !== null && now.o.key === key

  /** Step 1: each gear's note, in its half, as far as it has sounded. */
  function gearsScene(s: RangeScene): void {
    chart.setSeconds(GEARS_SEC)
    for (const g of ['lower', 'upper'] as const) {
      if (gearT[g] <= 0) continue
      const line = shifted(gearNote(voice, g === 'lower' ? 1 : 0), GEAR_AT[g])
      s.lines.push(lineOf(drawn(line, GEAR_AT[g] + gearT[g]), sounding(g)))
    }
  }

  /** Step 2: the slide across the full seam. */
  function slideScene(s: RangeScene, full: RangeSeam): void {
    chart.setSeconds(SIREN_UP)
    s.seams = [full]
    if (slideT > 0)
      s.lines.push(lineOf(drawn(upHalf(voice), slideT), sounding('slide')))
  }

  /** Step 3: three slides in three slots, the first two with their seams. */
  function threeScene(s: RangeScene, full: RangeSeam): void {
    chart.setSeconds(THREE_SLOT * 3)
    s.slots = 3
    const lines = threeSlides(voice)
    lines.forEach((line, k) => {
      if (threeT[k] <= 0) return
      const at = THREE_SLOT * k
      if (k === 0)
        s.seams.push({
          lo: full.lo,
          hi: full.hi,
          t0: at,
          t1: at + THREE_SLOT,
        })
      if (k === 1) {
        const lo = sirenFloor(voice) + 5
        s.seams.push({ lo, hi: lo + JUMP, t0: at, t1: at + THREE_SLOT })
      }
      s.lines.push(
        lineOf(drawn(shifted(line, at), at + threeT[k]), sounding(`three${k}`)),
      )
    })
  }

  /** Step 4: five slides, each in its slot over its narrower seam. */
  function smootherScene(s: RangeScene): void {
    chart.setSeconds(FIVE_SLOT * 5)
    s.slots = 5
    fiveT.forEach((t, k) => {
      if (t <= 0) return
      const at = FIVE_SLOT * k
      s.seams.push({ ...smootherSeam(voice, k), t0: at, t1: at + FIVE_SLOT })
      const line = shifted(smootherSlide(voice, k), at + FIVE_PAD)
      s.lines.push(
        lineOf(
          drawn(line, at + FIVE_PAD + t),
          (sounding('five') && t < SLIDE_SEC) || sounding(`one${k}`),
        ),
      )
    })
  }

  /** Step 5: the figure, the way last played, across the full seam. */
  function stylesScene(s: RangeScene, full: RangeSeam): void {
    chart.setSeconds(FIGURE_SEC)
    s.seams = [full]
    if (style === null || styleT <= 0) return
    const points = figureDrawn(voice, style, styleT)
    s.lines.push({ points, color: RANGE_COLOR.target, head: null })
  }

  const scenes: Readonly<
    Record<ToyState, (s: RangeScene, full: RangeSeam) => void>
  > = {
    gears: gearsScene,
    slide: slideScene,
    three: threeScene,
    smoother: smootherScene,
    styles: stylesScene,
  }

  function build(): void {
    const s = chart.scene
    s.caption = CAPTION
    s.lines = []
    s.seams = []
    s.slots = 0
    const full: RangeSeam = {
      lo: flipFrom(voice),
      hi: flipFrom(voice) + JUMP,
      label: SWITCH_LABEL,
    }
    scenes[state](s, full)
    syncGauge()
    syncScrub()
    viz.setAttribute('aria-label', summaryOf(state, voice))
  }

  function draw(): void {
    build()
    chart.changed()
  }

  function syncGauge(): void {
    fill.style.width = `${(gaugeFill(slideT) * 100).toFixed(1)}%`
  }

  /** The scrub bar follows the slide: its thumb, its value and its words when they change. */
  function syncScrub(): void {
    scrub.style.setProperty('--u', String(slideT / SIREN_UP))
    const value = slideT.toFixed(1)
    if (scrub.getAttribute('aria-valuenow') !== value)
      scrub.setAttribute('aria-valuenow', value)
    const words = scrubWords(upHalf(voice), slideT, slideJump(voice))
    if (scrub.getAttribute('aria-valuetext') !== words)
      scrub.setAttribute('aria-valuetext', words)
  }

  // ------------------------------------------------------------ playing

  function mark(button: HTMLButtonElement | null, on: boolean): void {
    if (button === null) return
    if (button === slideBtn) {
      q('use', slideBtn).setAttribute('href', on ? '#i-pause' : '#i-play')
      q('[data-play-word]', slideBtn).textContent = on ? 'Pause' : 'Play'
    }
    button.classList.toggle('is-on', on)
  }

  function clearTimers(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
  }

  /** Ends the sound in flight, where it stands: its drawing, its button and its Merc. */
  function settle(): void {
    const p = now
    if (p === null) return
    now = null
    clearTimers()
    chart.animate(null)
    mark(p.o.button, false)
    mercSing(mercOf(voice), lineAt(p.o.line, 0).midi, false)
    NowPlaying.release(stop)
    draw()
  }

  /** Stops whatever sounds, where it stands. */
  function stop(): void {
    const p = now
    if (p === null) return
    // the drawing stands where the sound stopped; under reduced motion it
    // was drawn whole at the press, and stays so
    if (!reducedMotion()) p.o.draw(position(p))
    p.run.stop()
    settle()
  }

  /** Where a play stands, seconds of its own line. */
  const position = (p: Playing): number =>
    Math.min(
      lineLength(p.o.line),
      p.from + ((performance.now() - p.startedAt) / 1000) * p.speed,
    )

  /**
   * Takes the page's one sound and plays `o.line` from `o.from`, at the
   * state's speed, drawing it as it sounds (at once under reduced motion).
   */
  function start(o: Start): void {
    stop()
    const from = o.from ?? 0
    const speed = state !== 'gears' && slow[state] ? 0.5 : 1
    const rest = lineFrom(o.line, from)
    const run = playGears(
      speed === 1 ? rest : stretched(rest, 1 / speed),
      Sound.canPlay(),
    )
    NowPlaying.claim(stop)
    const p: Playing = {
      o,
      state,
      from,
      speed,
      startedAt: performance.now(),
      run,
    }
    now = p
    mark(o.button, true)
    mercSing(mercOf(voice), lineAt(o.line, from).midi, true)
    for (const [t, words] of o.cues ?? []) {
      if (t < from) continue
      timers.push(
        window.setTimeout(() => say(words), ((t - from) / speed) * 1000),
      )
    }
    const end = lineLength(o.line)
    if (reducedMotion()) {
      o.draw(end)
      draw()
    } else {
      o.draw(from)
      draw()
      chart.animate(() => {
        if (now !== p) return false
        const t = position(p)
        o.draw(t)
        build()
        return t < end
      })
    }
    void run.done.then((heard) => {
      if (now !== p) return
      if (heard) {
        o.draw(end)
        o.heard?.()
      }
      settle()
    })
  }

  /** A press of the button that sounds stops it; any other starts. */
  function press(key: string, go: () => void): void {
    if (sounding(key)) stop()
    else go()
  }

  // Step 1: one note in each gear, side by side
  for (const b of gearBtns) {
    const g = b.dataset.gearPlay
    if (g !== 'lower' && g !== 'upper') continue
    b.addEventListener('click', () =>
      press(g, () => {
        start({
          key: g,
          line: gearNote(voice, g === 'lower' ? 1 : 0),
          button: b,
          draw: (t) => {
            gearT[g] = t
          },
        })
        say(gearSaid(voice, g))
      }),
    )
  }

  // Step 2: the slide, and its scrub bar
  slideBtn.addEventListener('click', () =>
    press('slide', () => {
      start({
        key: 'slide',
        line: upHalf(voice),
        from: slideT >= SIREN_UP - 0.05 ? 0 : slideT,
        button: slideBtn,
        draw: (t) => {
          slideT = t
        },
        heard: () => say(slideSaid(voice)),
      })
    }),
  )

  /** The scrub bar: the line and the gauge drawn to that moment, without sound. */
  function scrubTo(t: number): void {
    if (sounding('slide')) stop()
    slideT = clamp(t, 0, SIREN_UP)
    draw()
  }
  scrub.addEventListener('keydown', (e) => {
    const steps: Record<string, number> = {
      ArrowRight: SCRUB_STEP,
      ArrowUp: SCRUB_STEP,
      ArrowLeft: -SCRUB_STEP,
      ArrowDown: -SCRUB_STEP,
    }
    if (e.key === 'Home') scrubTo(0)
    else if (e.key === 'End') scrubTo(SIREN_UP)
    else if (e.key in steps)
      scrubTo(Math.round((slideT + steps[e.key]) * 10) / 10)
    else return
    e.preventDefault()
  })
  const scrubAt = (e: PointerEvent): void => {
    const track = q('.scrub-track', scrub).getBoundingClientRect()
    const u = clamp((e.clientX - track.left) / Math.max(1, track.width), 0, 1)
    scrubTo(Math.round(u * SIREN_UP * 10) / 10)
  }
  scrub.addEventListener('pointerdown', (e) => {
    scrub.setPointerCapture(e.pointerId)
    scrubAt(e)
  })
  scrub.addEventListener('pointermove', (e) => {
    if (scrub.hasPointerCapture(e.pointerId)) scrubAt(e)
  })

  // Step 3: three slides, each in its slot
  for (const b of threeBtns) {
    const k = Number(b.dataset.slideN)
    b.addEventListener('click', () =>
      press(`three${k}`, () => {
        start({
          key: `three${k}`,
          line: threeSlides(voice)[k],
          button: b,
          draw: (t) => {
            threeT[k] = t
          },
        })
        say(threeSaid(voice, k))
      }),
    )
  }

  // Step 4: the five slides in turn, or one alone
  fiveBtn.addEventListener('click', () =>
    press('five', () => {
      // a new run draws each slot afresh as it comes
      fiveT.fill(0)
      start({
        key: 'five',
        line: smootherRun(voice),
        button: fiveBtn,
        draw: (t) => {
          fiveT.forEach((_, k) => {
            const into = t - smootherStart(k)
            if (into > 0)
              fiveT[k] = Math.max(fiveT[k], Math.min(SLIDE_SEC, into))
          })
        },
        cues: fiveT.map((_, k) => [smootherStart(k), fiveSaid(k)] as const),
      })
    }),
  )
  for (const b of oneBtns) {
    const k = Number(b.dataset.one)
    b.addEventListener('click', () =>
      press(`one${k}`, () => {
        fiveT[k] = 0
        start({
          key: `one${k}`,
          line: smootherSlide(voice, k),
          button: b,
          draw: (t) => {
            fiveT[k] = t
          },
        })
        say(fiveSaid(k))
      }),
    )
  }

  /** Step 5: one figure, two ways, a button each. */
  function bindStyle(b: HTMLButtonElement): void {
    const way = b.dataset.style
    if (way !== 'flip' && way !== 'hide') return
    b.addEventListener('click', () =>
      press(way, () => {
        style = way
        styleT = 0
        start({
          key: way,
          line: figureLine(voice, way),
          button: b,
          draw: (t) => {
            styleT = t
          },
        })
        say(styleSaid(voice, way))
      }),
    )
  }
  styleBtns.forEach(bindStyle)

  /** Slow, one a state: a play of that state carries on at the new speed. */
  function bindSlow(b: HTMLButtonElement): void {
    const s = STATES.find((x) => x === b.dataset.slow)
    if (s === undefined || s === 'gears') return
    b.addEventListener('click', () => {
      slow[s] = !slow[s]
      b.setAttribute('aria-pressed', String(slow[s]))
      const p = now
      if (p === null || p.state !== s) return
      const t = position(p)
      stop()
      if (t < lineLength(p.o.line)) start({ ...p.o, from: t })
    })
  }
  slowBtns.forEach(bindSlow)

  // ------------------------------------------------------------ the voice

  function setVoice(v: Voice): void {
    if (v !== voice) stop()
    voice = v
    for (const b of gearBtns) {
      const g = b.dataset.gearPlay
      if (g === 'lower' || g === 'upper')
        b.setAttribute('aria-label', gearLabel(v, g))
    }
    for (const b of voiceBtns)
      b.setAttribute('aria-pressed', String(b.dataset.chartVoice === v))
    draw()
  }

  for (const b of voiceBtns)
    b.addEventListener('click', () => {
      const v = b.dataset.chartVoice
      if (v !== 'lower' && v !== 'higher') return
      ownVoice = true
      setVoice(v)
    })
  VoiceChoice.subscribe((v) => {
    if (!ownVoice) setVoice(v ?? 'lower')
  })

  // ------------------------------------------------------------ the state

  function setState(s: ToyState): void {
    if (s !== state) {
      stop()
      // the last state's words go, and the new state speaks at the next press
      said.textContent = ''
    }
    state = s
    root.dataset.state = s
    showParts(root, stepOf(s))
    for (const b of stateBtns)
      b.setAttribute('aria-pressed', String(b.dataset.freeState === s))
    draw()
  }

  for (const b of stateBtns)
    b.addEventListener('click', () => {
      const s = STATES.find((x) => x === b.dataset.freeState)
      if (s !== undefined) setState(s)
    })
  // from the viewer's first press on, the live line speaks
  for (const type of ['click', 'keydown'] as const)
    root.addEventListener(
      type,
      () => {
        speaking = true
      },
      { capture: true },
    )

  setState('gears')

  return {
    get state() {
      return state
    },
    setState,
    stop,
    get voice() {
      return voice
    },
    get scene() {
      return chart.scene
    },
  }
}
