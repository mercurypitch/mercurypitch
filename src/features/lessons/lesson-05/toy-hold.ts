// ============================================================
// Lesson 5 hold demo — Fig. 5, a held note settling into the band
// ============================================================
//
// The signature (WEB-SPEC, Toys 5): the band chart in its fixed-frame hold
// mode, 0 to 10 s across, the first hold's length, ±150 cents up the side,
// Merc's band with his amber line steady at its centre. Play, Slow (half
// speed) and a scrub bar, with sound: the violet line of lines.ts scoops up
// from 60 cents low, wavers, enters the band and stays, with the small,
// regular wave of a vibrato, and Merc's "ooh" follows its rise, his own
// vibrato carrying the wave. A "settled" marker appears where it stays in
// the band, once it has stayed there half a second.
//
// The readouts, when it settled and how long it sat in the band out of 10
// seconds, are never set by hand: the checkpoint's own reader
// (kit/hold-take.ts) reads frames of this very line, so the demo shows
// exactly what a take would read. The reader reaches Voice Mirror's scorer,
// which first paint must not load, so it arrives as its own chunk once the
// step is first shown; until then the readouts wait. Under reduced motion
// the figure lands in its end state with its readouts beside it, and Play
// still sounds the note.

import type { BandChart, TracePoint } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { HIT_TOLERANCE_CENTS } from '@/features/lessons/kit/band-words'
import { q } from '@/features/lessons/kit/dom'
import { addDrawer, watch } from '@/features/lessons/kit/frame-loop'
import type * as HoldKit from '@/features/lessons/kit/hold-take'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, hz } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { rangeFill } from '@/features/lessons/kit/toy-helpers'
import { DEMO_SEC, demoCents, demoFrames, demoRise } from './lines'

/** What the reader makes of the demo: the whole hold, and the time in the band up to each tenth of a second. */
export interface DemoReading {
  readonly whole: HoldReading
  /** `upTo[k]`: seconds in the band over the first k tenths, as the reader counts them. */
  readonly upTo: readonly number[]
}

/** Reads the demo with the checkpoint's reader: the whole, and every tenth of a second on the way. */
export function readDemo(kit: typeof HoldKit): DemoReading {
  const frames = demoFrames(A3)
  const whole = kit.readHold(frames, A3, DEMO_SEC)
  const upTo: number[] = []
  for (let k = 0; k <= DEMO_SEC * 10; k++) {
    const part = frames.filter((f) => f.t <= k / 10 + 1e-9)
    const r = kit.readHold(part, A3, DEMO_SEC)
    upTo.push(r.kind === 'read' ? r.inBand : 0)
  }
  return { whole, upTo }
}

/** Where the line is against the band at `t`: the words a slider value ends with. */
export function bandAt(
  t: number,
): 'in the band' | 'below the band' | 'above the band' {
  const c = demoCents(t)
  if (Math.abs(c) <= HIT_TOLERANCE_CENTS) return 'in the band'
  return c < 0 ? 'below the band' : 'above the band'
}

/** The scrub bar's spoken value: "1.2 seconds of 10: in the band". */
export const holdValueText = (t: number): string =>
  `${t.toFixed(1)} seconds of ${DEMO_SEC}: ${bandAt(t)}`

/** The line up to `u` seconds, a point every 20 ms. */
function lineTo(u: number): TracePoint[] {
  const points: TracePoint[] = []
  for (let s = 0; s < u; s += 0.02) points.push({ t: s, c: demoCents(s) })
  points.push({ t: u, c: demoCents(u) })
  return points
}

const fmt = (s: number): string => {
  const r = Math.round(s * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export interface HoldDemoOptions {
  /** When it draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface HoldDemo {
  /** Loads the reader, once: the step is on its way. */
  prepare(): void
  /** Stops the note now (the viewer left the step). */
  stop(): void
}

export function mountHoldDemo(
  root: HTMLElement,
  opts: HoldDemoOptions = {},
): HoldDemo {
  const chart: BandChart = mountBandChart(q('.hold-viz', root), {
    target: A3,
    window: DEMO_SEC,
    timeTicks: true,
    active: opts.active,
  })
  const playBtn = q<HTMLButtonElement>('[data-hold="play"]', root)
  const slowBtn = q<HTMLButtonElement>('[data-hold="slow"]', root)
  const scrub = q<HTMLInputElement>('[data-hold="scrub"]', root)
  const settledRo = q('[data-hold-ro="settled"]', root)
  const bandRo = q('[data-hold-ro="band"]', root)
  const words = q('[data-hold-words]', root)
  const live = q('[data-hold-live]', root)
  let reading: DemoReading | null = null
  let loading = false
  let t = 0
  let playing = false
  let rate = 1
  let voice: Voice | null = null
  let shown = ''

  function prepare(): void {
    if (reading !== null || loading) return
    loading = true
    void import('@/features/lessons/kit/hold-take')
      .then((kit) => {
        reading = readDemo(kit)
      })
      .catch(() => {
        // the readouts stay empty; the line still draws
      })
      .finally(() => {
        loading = false
      })
  }

  const toneHz = (s: number): number => hz(A3) * 2 ** (demoRise(s) / 1200)

  function setPlaying(on: boolean): void {
    playing = on
    playBtn.setAttribute('aria-pressed', String(on))
    q('[data-hold-play-label]', playBtn).textContent = on ? 'Pause' : 'Play'
    q('use', playBtn).setAttribute('href', on ? '#i-pause' : '#i-play')
    if (!on) {
      voice?.stop()
      voice = null
    }
  }

  function end(): void {
    setPlaying(false)
    const r = reading?.whole
    if (r === undefined) return
    const settled =
      r.settled === null
        ? ''
        : `It settled after about ${fmt(r.settled)} seconds; `
    live.textContent = `${settled}in the band for ${fmt(r.inBand)} of the ${DEMO_SEC} seconds.`
  }

  playBtn.addEventListener('click', () => {
    if (playing) {
      setPlaying(false)
      return
    }
    prepare()
    if (t >= DEMO_SEC) t = 0
    setPlaying(true)
    // Merc's "ooh" follows the rise; its own vibrato is the line's small wave
    if (Sound.canPlay()) voice = Sound.voice(toneHz(t), { kind: 'merc' })
  })
  slowBtn.addEventListener('click', () => {
    const on = slowBtn.getAttribute('aria-pressed') !== 'true'
    slowBtn.setAttribute('aria-pressed', String(on))
    rate = on ? 0.5 : 1
  })
  scrub.addEventListener('input', () => {
    setPlaying(false)
    prepare()
    t = (Number(scrub.value) / 1000) * DEMO_SEC
    rangeFill(scrub)
    scrub.setAttribute('aria-valuetext', holdValueText(t))
  })

  /** The readouts at `u` seconds: the reader's settled time once it has stayed, and its count so far. */
  function readouts(u: number, started: boolean): void {
    const r = reading
    let settled = '–'
    let band = '–'
    if (r !== null && started) {
      const s = r.whole.settled
      if (s !== null && u >= s + 0.5) settled = `${fmt(s)}<small>s</small>`
      band = `${fmt(r.upTo[Math.min(r.upTo.length - 1, Math.floor(u * 10 + 1e-6))] ?? 0)}<small>of ${DEMO_SEC} s</small>`
    }
    const status = started
      ? `Now: ${bandAt(u)}`
      : 'Press Play, then Slow, and watch the first second'
    const text = `${settled}|${band}|${status}`
    if (text === shown) return
    shown = text
    settledRo.innerHTML = settled
    bandRo.innerHTML = band
    words.textContent = status
  }

  function paint(u: number, started: boolean): void {
    const s = chart.scene
    s.line = started ? lineTo(u) : []
    const head = s.line[s.line.length - 1]
    s.head =
      head === undefined || head.c === null ? null : { t: head.t, c: head.c }
    s.playhead = playing && !reducedMotion() ? u : null
    s.lit = started && bandAt(u) === 'in the band'
    const settled = reading?.whole.settled ?? null
    s.marks =
      started && settled !== null && u >= settled + 0.5
        ? [{ t: settled, label: 'settled' }]
        : []
    readouts(u, started)
  }

  addDrawer({
    active: opts.active ?? watch(root),
    draw(_now, dt) {
      if (playing) {
        t = Math.min(DEMO_SEC, t + dt * rate)
        voice?.setFreq(toneHz(t), 0.03)
        scrub.value = String(Math.round((t / DEMO_SEC) * 1000))
        rangeFill(scrub)
        scrub.setAttribute('aria-valuetext', holdValueText(t))
        if (t >= DEMO_SEC) end()
      }
      const calm = reducedMotion()
      if (calm) prepare()
      paint(calm ? DEMO_SEC : t, calm || t > 0)
    },
  })

  scrub.setAttribute('aria-valuetext', holdValueText(0))
  rangeFill(scrub)
  chart.describe(
    "Merc's note A3 as a band, 35 cents either side, on a 10-second frame; a held note's line scoops up from 60 cents low, wavers, then settles into the band with a small, even wave",
  )

  return {
    prepare,
    stop() {
      setPlaying(false)
    },
  }
}
