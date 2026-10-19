// ============================================================
// Lesson 5 Push toy — Fig. 1, one slider moves a note's loudness and pitch
// ============================================================
//
// The band chart (Merc's band at A3) with its level strip, and a held note
// drawn violet (WEB-SPEC, Toys 2). One slider, Push, 0 to 100 from 50,
// moves the voice's level and pitch together, as air pressure does (FACTS
// 7, 8): 0.12 dB and 1.2 cents a step, so ±6 dB and ±60 cents at the ends,
// the centre leaving the 35-cent band below 21 and above 79 (FACTS 73).
// The line draws in a scrolling 4-second window while the note sounds.
//
// The note sounds while a pointer holds the slider, or for 0.7 s after the
// last arrow key (`holdToPlay`), which handles no Space or Enter; so Hold
// the note, a real button with aria-pressed, sounds it until it is pressed
// again, for at most 20 s, and while it sounds the slider's keys move the
// voice without stopping it. The slider takes arrows in fives and Page Up
// and Page Down in twenties, and says its value in words; a polite line
// says when the note leaves the band and when it comes back. Under reduced
// motion the window never scrolls: a flat line at the note's height, which
// moves only with the slider.

import type { BandChart, LevelPoint, TracePoint, } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { HIT_TOLERANCE_CENTS } from '@/features/lessons/kit/band-words'
import { clamp, q } from '@/features/lessons/kit/dom'
import { addDrawer, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, hz } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { holdToPlay, rangeFill } from '@/features/lessons/kit/toy-helpers'
import { BASE_LEVEL } from './lines'

/** Seconds across the chart. */
const WINDOW = 4
/** Hold the note stops itself after this long. */
export const HOLD_MAX_SEC = 20
/** Merc's "ooh" at Push 50; 6 dB more doubles it. */
const GAIN = 0.14

export const pushCents = (p: number): number => (p - 50) * 1.2
export const pushDb = (p: number): number => (p - 50) * 0.12
/** The level, as a share of the strip's height: 0.5 at Push 50, 6 dB either way at the ends. */
export const pushLevel = (p: number): number =>
  BASE_LEVEL * 10 ** (pushDb(p) / 20)
/** The voice at Push `p`: its pitch, Hz, around A3, and its gain. */
export const pushHz = (p: number): number => hz(A3) * 2 ** (pushCents(p) / 1200)
export const pushGain = (p: number): number => GAIN * 10 ** (pushDb(p) / 20)

export type Side = 'in' | 'above' | 'below'

export const sideOf = (cents: number): Side => {
  if (Math.abs(cents) <= HIT_TOLERANCE_CENTS) return 'in'
  return cents > 0 ? 'above' : 'below'
}

const SIDE_WORDS: Readonly<Record<Side, string>> = {
  in: 'in the band',
  above: 'above the band',
  below: 'below the band',
}

/** Louder or quieter than the start, against 50. */
export function loudWord(p: number): string {
  if (p > 50) return 'louder'
  return p < 50 ? 'quieter' : 'as it started'
}

/** The readout under the chart: "louder · in the band". */
export const pushWords = (p: number): string =>
  `${loudWord(p)} · ${SIDE_WORDS[sideOf(pushCents(p))]}`

/** The slider's spoken value: "Push 70 percent: louder; the note above the middle, still in the band". */
export function pushValueText(p: number): string {
  const c = pushCents(p)
  const side = sideOf(c)
  let where = 'the note in the middle of the band'
  if (side !== 'in') where = `the note ${SIDE_WORDS[side]}`
  else if (c > 0) where = 'the note above the middle, still in the band'
  else if (c < 0) where = 'the note below the middle, still in the band'
  return `Push ${p} percent: ${loudWord(p)}; ${where}`
}

/** What the live line says when the note crosses the band's edge, or null when it stays on its side. */
export function crossingWords(from: Side, to: Side): string | null {
  if (from === to) return null
  if (to === 'in') return 'The note is back in the band.'
  return `The note left the band: ${to === 'above' ? 'above' : 'below'} it.`
}

/** The keys the slider takes: arrows in fives, Page Up and Page Down in twenties, Home and End the ends. */
export function nextPush(p: number, key: string): number | null {
  const step: Readonly<Record<string, number>> = {
    ArrowUp: 5,
    ArrowRight: 5,
    ArrowDown: -5,
    ArrowLeft: -5,
    PageUp: 20,
    PageDown: -20,
  }
  if (key === 'Home') return 0
  if (key === 'End') return 100
  const d = step[key]
  return d === undefined ? null : clamp(p + d, 0, 100)
}

export interface PushOptions {
  /** When it draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Push {
  /** Stops the note now (the viewer left the step). */
  stop(): void
}

interface Sample {
  /** performance.now(), ms. */
  readonly at: number
  readonly c: number
  readonly level: number
}

/** The line and the level of a scrolling window that ends at `ref` (ms). */
function scrolled(
  history: readonly Sample[],
  ref: number,
): { line: TracePoint[]; level: LevelPoint[] } {
  const line: TracePoint[] = []
  const level: LevelPoint[] = []
  for (const s of history) {
    const t = WINDOW - (ref - s.at) / 1000
    if (t < 0) continue
    line.push({ t, c: s.c })
    level.push({ t, level: s.level })
  }
  return { line, level }
}

/** The still line: flat at the note's height and level, across the window. */
function flat(p: number): { line: TracePoint[]; level: LevelPoint[] } {
  const c = pushCents(p)
  const l = pushLevel(p)
  return {
    line: [
      { t: 0, c },
      { t: WINDOW, c },
    ],
    level: [
      { t: 0, level: l },
      { t: WINDOW, level: l },
    ],
  }
}

export function mountPush(root: HTMLElement, opts: PushOptions = {}): Push {
  const chart: BandChart = mountBandChart(q('.push-viz', root), {
    target: A3,
    strip: true,
    active: opts.active,
  })
  const slider = q<HTMLInputElement>('[data-push="slider"]', root)
  const holdBtn = q<HTMLButtonElement>('[data-push="hold"]', root)
  const ro = q('[data-push-ro]', root)
  const valueEl = q('[data-push-value]', root)
  const words = q('[data-push-words]', root)
  const live = q('[data-push-live]', root)
  let p = Number(slider.value)
  let held = false
  let toggled = false
  let toggleTimer = 0
  let voice: Voice | null = null
  let side: Side = sideOf(pushCents(p))
  let history: Sample[] = []
  let frozen: number | null = null
  let moved = true

  const sounding = (): boolean => held || toggled
  const freq = (): number => pushHz(p)
  const gain = (): number => pushGain(p)

  function readouts(): void {
    ro.innerHTML = `${p}<small>%</small>`
    valueEl.textContent = `${p}%`
    words.textContent = pushWords(p)
    slider.setAttribute('aria-valuetext', pushValueText(p))
    rangeFill(slider)
  }

  /** Starts the note when something holds it, stops it when nothing does; the line freezes where it ended. */
  function sync(): void {
    if (sounding() && frozen !== null) {
      // a fresh line for a fresh note
      history = []
      frozen = null
      if (Sound.canPlay())
        voice = Sound.voice(freq(), { kind: 'merc', gain: gain() })
    } else if (!sounding() && frozen === null) {
      frozen = performance.now()
      voice?.stop()
      voice = null
    }
  }

  function setPush(next: number): void {
    p = next
    const now = sideOf(pushCents(p))
    const said = crossingWords(side, now)
    if (said !== null) live.textContent = said
    side = now
    moved = true
    voice?.setFreq(freq(), 0.03)
    voice?.setGain(gain(), 0.04)
    readouts()
  }

  function setToggled(on: boolean): void {
    toggled = on
    holdBtn.setAttribute('aria-pressed', String(on))
    window.clearTimeout(toggleTimer)
    if (on)
      toggleTimer = window.setTimeout(() => {
        setToggled(false)
        live.textContent = `The note stopped after ${HOLD_MAX_SEC} seconds.`
      }, HOLD_MAX_SEC * 1000)
    sync()
  }

  slider.addEventListener('input', () => setPush(Number(slider.value)))
  slider.addEventListener('keydown', (e) => {
    const next = nextPush(p, e.key)
    if (next === null) return
    e.preventDefault()
    slider.value = String(next)
    setPush(next)
  })
  holdToPlay(slider, {
    start() {
      held = true
      sync()
    },
    stop() {
      held = false
      sync()
    },
  })
  holdBtn.addEventListener('click', () => setToggled(!toggled))

  addDrawer({
    active: opts.active ?? watch(root),
    draw(now) {
      const s = chart.scene
      if (sounding() && !reducedMotion()) {
        history.push({ at: now, c: pushCents(p), level: pushLevel(p) })
        while (
          history.length > 0 &&
          (now - history[0].at) / 1000 > WINDOW + 0.2
        )
          history.shift()
        moved = false
      }
      const still = reducedMotion() || (frozen !== null && moved)
      const { line, level } = still ? flat(p) : scrolled(history, frozen ?? now)
      s.line = line
      s.level = level
      const head = line[line.length - 1]
      s.head =
        head === undefined || head.c === null ? null : { t: head.t, c: head.c }
      s.lit = sideOf(pushCents(p)) === 'in'
    },
  })

  // nothing sounds before a tap; the readouts say where Push starts
  frozen = performance.now()
  readouts()
  chart.describe(
    "Merc's note A3 as a band; a held note's line on it, with its loudness in the strip under it",
  )

  return {
    stop() {
      held = false
      setToggled(false)
    },
  }
}
