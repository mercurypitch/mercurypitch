// ============================================================
// Lesson 22 band chart toy — Lesson 5's band, zoomed until a held note's wave shows
// ============================================================
//
// The steps' toy and free play's (WEB-SPEC, Toys 2): Lesson 5's band chart
// on Merc's A3, with its level strip under the plot, no line at the band's
// centre, no cents ticks and no note name, in four states. Merc's line is
// his amber, drawn from the play's own schedule as it sounds (sounds.ts,
// vib-picture.ts): a level line, a wave and a swell; a one-second sweep
// with a counter that pulses at each swing's top and a ruler from the
// middle to a swing's top; the wave with its middle dashed, Rate and Drift;
// the sung wave beside the app's ribbon (ribbon.ts, a chunk of its own
// after first paint). Each state's controls are marked with the state they
// show on (`data-part`; kit/step-parts.ts).
//
// Until the cold open's choice every control is disabled under the lock
// line and the chart draws only its band (`unlock`); then each state shows
// its still. Step 3's Rate, Play at this rate and Drift, and free play's
// Play: two a second, wait for Step 3's choice too (`unlockHeld`, the
// controls marked `data-held`). A slider moved during a play changes the
// sound within 50 ms and the line from that moment (`retune`); Drift
// switched during a play stops it, and the next play takes it. One sound
// plays at a time across the page (`NowPlaying`): every play claims the
// owner with its own stop, so the owner can stop one play for another. A
// play cut short leaves the line as it last drew. Under reduced motion a
// line lands whole as its play starts, the counter does not pulse and the
// sweep shows the second it is in whole.

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintWave } from '@/features/lessons/kit/band-chart-wave'
import type { WaveStretch } from '@/features/lessons/kit/band-chart-wave-scene'
import { q, qa } from '@/features/lessons/kit/dom'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { LineRun } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { showParts } from '@/features/lessons/kit/step-parts'
import type * as RibbonKit from './ribbon'
import type { Play, PlayKey } from './sounds'
import { A3, contourOfPlay, lineOf, playFor, retune, WIDE } from './sounds'
import type { Picture, Settings, VibState } from './vib-picture'
import { BLANK, pictureOf, PLAY_STATE, stillOf, WINDOW } from './vib-picture'
import { countLine, DRIFT_LINE, FIG, playWords, ribbonLabel, shownCents, spokenCents, stillWords, stretchLine, } from './vib-words'

/** The axis's reach, cents either side of Merc's note: Drift's rising middle plus its swing stays on the chart. */
export const AXIS_RANGE = 120

/** Seconds the counter shows a swing's top. */
const PEAK_SEC = 0.12

export interface VibToyOptions {
  /** When the chart draws and its plays move: a deck's `toyActive(1)`, or while it is on screen. */
  readonly active: () => boolean
  /** The page's one sound (kit/now-playing.ts). */
  readonly owner: SoundOwner
}

export interface VibToy {
  readonly chart: BandChart
  readonly state: VibState
  /** Opens a state: its controls, its window and its still; what the toy plays stops. The state showing asks nothing. */
  setState(n: VibState): void
  /** Plays a play in its own state, with the sound the caller decided (a predict's); false if cut short. */
  play(key: PlayKey, audible?: boolean): Promise<boolean>
  /** The cold open's choice: every control but the held ones, and each state's still. */
  unlock(): void
  /** Step 3's choice: the held controls too. */
  unlockHeld(): void
  /** Stops what the toy plays, the line left as it last drew. */
  stop(): void
}

/** One play on the chart: its schedule, its line as the sliders have moved it, its run, and where it reached once it ended. */
interface Drawing {
  readonly key: PlayKey
  readonly play: Play
  readonly state: VibState
  readonly t0: number
  readonly run: LineRun
  line: WaveStretch[]
  ended: number | null
}

const now = (): number => performance.now() / 1000

/** The slider's number. */
const valueOf = (input: HTMLInputElement): number => Number(input.value)

/** Mounts the toy on `root`, locked until the cold open's choice, in Step 1's state. */
export function mountVibToy(root: HTMLElement, o: VibToyOptions): VibToy {
  const label = root.querySelector<HTMLElement>('[data-fig-label]')
  const panels = q('[data-vib-panels]', root)
  const said = q('[data-vib-said]', root)
  const lock = q('[data-vib-lock]', root)
  // free play's line for what waits on Step 3's choice; the steps' toy has
  // Step 3's predict beside it instead
  const lock3 = root.querySelector<HTMLElement>('[data-vib-lock3]')
  const count = q('[data-vib-count]', root)
  const ruler = q('[data-vib-ruler]', root)
  const ribbon = q<SVGSVGElement>('[data-vib-ribbon] svg', root)
  const rate2 = q<HTMLInputElement>('[data-part="2"] [data-vib-rate]', root)
  const extent2 = q<HTMLInputElement>('[data-vib-extent]', root)
  const rate3 = q<HTMLInputElement>('[data-part="3"] [data-vib-rate]', root)
  const drift = q<HTMLButtonElement>('[data-vib-drift]', root)
  const stretch = q<HTMLInputElement>('[data-vib-stretch]', root)
  const light = playLights()

  let state: VibState = 1
  let open = false
  let held = true
  let drawing: Drawing | null = null
  let peaks = 0
  let peakAt = -Infinity

  const settings = (): Settings & { readonly drift: boolean } => ({
    rate2: valueOf(rate2),
    extent2: valueOf(extent2),
    rate3: valueOf(rate3),
    drift: drift.getAttribute('aria-pressed') === 'true',
  })

  // the play's clock runs before the chart's drawer, so a frame draws the moment it reaches
  addDrawer({
    active: o.active,
    wants: () =>
      drawing !== null &&
      drawing.ended === null &&
      (drawing.state === 2 || !reducedMotion()),
    draw: () => {
      paint()
    },
  })
  const chart = mountBandChart(q('[data-vib-viz]', root), {
    target: A3,
    axis: { range: AXIS_RANGE },
    window: WINDOW[1],
    ticks: [],
    strip: true,
    centre: false,
    active: o.active,
    paintOver: paintWave,
  })

  /** What the chart shows now: the play in this state as far as it has gone, else the state's still. */
  function picture(): Picture {
    const d = drawing
    if (d === null) return open ? stillOf(state, settings()) : BLANK
    const el = d.ended ?? Math.min(d.play.sec, now() - d.t0)
    return pictureOf(state, d.play, d.line, el, reducedMotion())
  }

  /** Writes the picture into the chart's scene, and Step 2's readings beside it. */
  function paint(): void {
    const pic = picture()
    const s = chart.scene
    s.wave = pic.wave
    s.middle = pic.middle
    s.ruler = pic.ruler
    s.level = pic.level
    if (pic.rate !== null) count.textContent = countLine(pic.rate)
    if (pic.extent !== null)
      ruler.innerHTML = shownCents(Math.round(pic.extent))
    // the counter lights at each swing's top while the play sounds
    const sounding = drawing !== null && drawing.ended === null
    if (sounding && pic.peaks > peaks && !reducedMotion()) peakAt = now()
    peaks = pic.peaks
    count.classList.toggle('is-peak', sounding && now() - peakAt < PEAK_SEC)
  }

  // the app's ribbon function comes with the app's other effects, so its
  // module is a chunk of its own, loaded as the toy mounts, after first paint
  let ribbonKit: typeof RibbonKit | null = null

  /** The ribbon at Stretch's width, and its words. */
  function drawRibbon(): void {
    const w = valueOf(stretch)
    q('[data-vib-stretch-out]', root).textContent = `${w} px`
    if (ribbonKit === null) return
    const swings = ribbonKit.ribbonSwings(w)
    const { VIEW } = ribbonKit
    ribbon.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`)
    ribbon.setAttribute('aria-label', ribbonLabel(swings))
    ribbon.innerHTML = `<path class="vib-mark" d="${ribbonKit.ribbonPath(w)}"/>`
    stretch.setAttribute('aria-valuetext', `${w} pixels wide, ${swings} swings`)
  }

  /** A slider's readout and value text, as it moves. */
  function readout(input: HTMLInputElement): void {
    const row = input.closest('.slider-row') ?? root
    const v = valueOf(input)
    if (input.hasAttribute('data-vib-extent')) {
      q('[data-vib-extent-out]', row).innerHTML = shownCents(v)
      input.setAttribute('aria-valuetext', spokenCents(v))
    } else {
      q('[data-vib-rate-out]', row).textContent = `${v} a second`
      input.setAttribute('aria-valuetext', countLine(v))
    }
  }

  /** Free play's line for the held controls: on Step 3's state, between the two choices. */
  const showLock3 = (): void => {
    if (lock3 !== null) lock3.hidden = !(open && held && state === 3)
  }

  /** The canvas's words for the state's still, or the band alone before the choice. */
  const describeStill = (): void => {
    chart.describe(
      open ? stillWords(state, settings()) : stillWords(1, settings()),
    )
  }

  function stop(): void {
    drawing?.run.stop()
  }

  function play(key: PlayKey, audible = Sound.canPlay()): Promise<boolean> {
    const n = PLAY_STATE[key]
    // a predict's play in Step 3's text draws on Step 3's chart
    if (n !== state) setState(n)
    stop()
    const v = settings()
    const p = playFor(key, v)
    const run = playLine(contourOfPlay(p), { audible, vibrato: p.vibrato })
    const mine: Drawing = {
      key,
      play: p,
      state: n,
      t0: now(),
      run,
      line: lineOf(p),
      ended: null,
    }
    drawing = mine
    peaks = 0
    const stopMine = (): void => {
      run.stop()
    }
    o.owner.claim(stopMine)
    const words = playWords(key, v)
    said.textContent = words.said
    chart.describe(words.drawn)
    paint()
    wake()
    void run.done.then((heard) => {
      o.owner.release(stopMine)
      if (drawing !== mine) return
      mine.ended = heard ? p.sec : Math.min(p.sec, now() - mine.t0)
      paint()
      wake()
      if (heard && (p.rise ?? 0) > 0) said.textContent = DRIFT_LINE
    })
    return run.done
  }

  function setState(n: VibState): void {
    if (n === state) return
    stop()
    // each state opens on its still
    drawing = null
    state = n
    showParts(root, n)
    if (label !== null) label.innerHTML = FIG[n]
    panels.classList.toggle('two', n === 4)
    chart.setWindow(WINDOW[n])
    showLock3()
    describeStill()
    paint()
  }

  /**
   * A slider moved: during its own play the voice glides there and the line
   * goes on from that moment; during another play (Merc's "ooh", a
   * predict's wave) nothing changes; with nothing sounding, the state's
   * still follows the slider.
   */
  function moved(key: PlayKey, to: { rate: number; extent: number }): void {
    const d = drawing
    if (d !== null && d.ended === null) {
      if (d.key !== key) return
      d.run.setVibrato(to)
      d.line = retune(d.line, now() - d.t0, to)
    } else {
      drawing = null
      describeStill()
    }
    paint()
  }

  // ---------------------------------------------------------------- the controls
  for (const b of qa<HTMLButtonElement>('button[data-vib-play]', root)) {
    const key = b.dataset.vibPlay as PlayKey
    b.addEventListener('click', () => {
      if (b.disabled) return
      light(b, play(key))
    })
  }
  for (const input of [rate2, extent2])
    input.addEventListener('input', () => {
      readout(input)
      moved('measure', { rate: valueOf(rate2), extent: valueOf(extent2) })
    })
  rate3.addEventListener('input', () => {
    readout(rate3)
    moved('at-rate', { rate: valueOf(rate3), extent: WIDE })
  })
  drift.addEventListener('click', () => {
    if (drift.disabled) return
    const on = drift.getAttribute('aria-pressed') !== 'true'
    drift.setAttribute('aria-pressed', String(on))
    // switched during a play, Drift stops it; the next play takes it
    stop()
  })
  stretch.addEventListener('input', drawRibbon)
  stretch.addEventListener('change', () => {
    if (ribbonKit !== null)
      said.textContent = stretchLine(ribbonKit.ribbonSwings(valueOf(stretch)))
  })

  void import('./ribbon').then(
    (kit) => {
      ribbonKit = kit
      drawRibbon()
    },
    () => undefined,
  )
  showParts(root, 1)
  describeStill()

  /** Enables the toy's controls, the held ones only once Step 3's choice is in. */
  function enable(): void {
    for (const el of qa<HTMLButtonElement | HTMLInputElement>(
      'button[disabled], input[disabled]',
      root,
    ))
      if (held === false || !el.hasAttribute('data-held')) el.disabled = false
  }

  return {
    chart,
    get state() {
      return state
    },
    setState,
    play,
    unlock() {
      if (open) return
      open = true
      lock.hidden = true
      enable()
      showLock3()
      describeStill()
      paint()
      wake()
    },
    unlockHeld() {
      held = false
      if (open) enable()
      showLock3()
    },
    stop,
  }
}
