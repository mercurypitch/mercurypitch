// ============================================================
// Lesson 3 band toy — Fig. 5, a line chases Merc's band, then yours
// ============================================================
//
// The signature figure (WEB-SPEC, Toys 6) on the kit's band chart. The
// chase is the matching loop with readings set by hand, not data (FACTS,
// Illustrations): Merc's A3, then a line that starts 80 cents low ("try"),
// passes a "compare" mark, adjusts to 40 low, then to 12 low, inside the
// band, where the edge lights mint beside "in the band". Play, Pause, a
// scrub bar and Slow (half speed), with sound: Merc's "ooh", then a tone
// that follows the line. After the chase, a handle on the line's head drags
// it anywhere from −150 to +150 cents, and the readouts say the gap, the band
// by Voice Mirror's edges and the nearest note. Under reduced motion the
// chase lands in its end state with its three readings listed, and Play
// still sounds it.
//
// Mounted twice: Step 5 with the chase, and free play in drag mode alone.

import type { BandChart, TracePoint } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { BAND_WORDS, bandOf, bandValueText, gapWords, inBand, nearestNote, signedCents, } from '@/features/lessons/kit/band-words'
import { bindCentsSlider } from '@/features/lessons/kit/cents-slider'
import { easeInOut, q } from '@/features/lessons/kit/dom'
import { addDrawer, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, hz, nameHtml } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { holdToPlay, rangeFill } from '@/features/lessons/kit/toy-helpers'

/** Merc's A3 before the line, and the line across the chart's 4-second window. */
export const MERC_SEC = 1.5
export const LINE_SEC = 4
export const CHASE_SEC = MERC_SEC + LINE_SEC
/** Where the dragged head sits: just short of the window's end, so its handle stays on the chart. */
const HEAD_T = LINE_SEC - 0.3
/** The chase's three readings, cents from Merc's note. */
export const CHASE_READINGS = [-80, -40, -12] as const
const MARKS = [
  { t: 0.12, label: 'try' },
  { t: 1, label: 'compare' },
]
const REACH = 150

const glide = (a: number, b: number, u: number): number =>
  a + (b - a) * easeInOut(Math.min(Math.max(u, 0), 1))

/** The chased line at `u` seconds into its window: −80, then −40, then −12. */
export function chaseCents(u: number): number {
  const [try1, adjust, settle] = CHASE_READINGS
  if (u < 1) return try1
  if (u < 1.5) return glide(try1, adjust, (u - 1) / 0.5)
  if (u < 2.2) return adjust
  if (u < 2.7) return glide(adjust, settle, (u - 2.2) / 0.5)
  return settle
}

/** The line up to `u`; in drag mode its last stretch glides to the dragged value instead. */
function lineTo(u: number, drag: number | null): TracePoint[] {
  const at = (s: number): number =>
    drag === null || s < 2.7
      ? chaseCents(s)
      : glide(chaseCents(2.7), drag, (s - 2.7) / 0.3)
  const points: TracePoint[] = []
  for (let s = 0; s < u; s += 0.04) points.push({ t: s, c: at(s) })
  points.push({ t: u, c: at(u) })
  return points
}

/** A chase reading as the reduced-motion list says it: "80 cents below Merc's note: outside the band". */
export const readingWords = (c: number): string =>
  `${gapWords(c)}: ${BAND_WORDS[bandOf(c)]}`

export interface BandToyOptions {
  readonly active?: () => boolean
  /** Step 5's chase first; free play starts in drag mode. */
  readonly chase: boolean
}

export interface BandToy {
  stop(): void
}

export function mountBandToy(root: HTMLElement, opts: BandToyOptions): BandToy {
  const chart: BandChart = mountBandChart(q('.band-viz', root), {
    target: A3,
    active: opts.active,
  })
  const handle = q('[data-band-handle]', root)
  const gapRo = q('[data-band-ro="gap"]', root)
  const wordsRo = q('[data-band-ro="words"]', root)
  const live = q('[data-band-live]', root)
  const playBtn = root.querySelector<HTMLButtonElement>('[data-band="play"]')
  const slowBtn = root.querySelector<HTMLButtonElement>('[data-band="slow"]')
  const scrub = root.querySelector<HTMLInputElement>('[data-band="scrub"]')
  const readings = root.querySelector<HTMLOListElement>('[data-band-readings]')
  let t = 0
  let playing = false
  let rate = 1
  let audible = false
  let drag: number | null = opts.chase ? null : -40
  let merc: Voice | null = null
  let follow: Voice | null = null
  let held: Voice | null = null
  let shown = ''

  const toneHz = (c: number): number => hz(A3) * 2 ** (c / 1200)
  const calm = (): boolean => opts.chase && reducedMotion()

  const slider = bindCentsSlider(handle, {
    min: -REACH,
    max: REACH,
    value: () => drag ?? CHASE_READINGS[2],
    set(c) {
      drag = c
      held?.setFreq(toneHz(c), 0.015)
    },
    valueAt: (clientY) => chart.centsAt(clientY),
    valueText: (c) => bandValueText(A3, c),
  })
  holdToPlay(handle, {
    start() {
      if (Sound.canPlay()) held = Sound.voice(toneHz(drag ?? CHASE_READINGS[2]))
    },
    stop() {
      held?.stop()
      held = null
    },
  })

  function setDrag(on: boolean): void {
    handle.hidden = !on
    slider.setEnabled(on)
    chart.scene.handle = on
  }

  function stopVoices(): void {
    merc?.stop()
    follow?.stop()
    merc = null
    follow = null
  }

  // Merc's "ooh" while his part runs, then a tone on the line
  function syncSound(): void {
    if (!playing || !audible) {
      stopVoices()
      return
    }
    if (t < MERC_SEC) {
      follow?.stop()
      follow = null
      merc ??= Sound.voice(hz(A3), { kind: 'merc' })
      return
    }
    merc?.stop()
    merc = null
    const f = toneHz(chaseCents(t - MERC_SEC))
    if (follow === null) follow = Sound.voice(f)
    else follow.setFreq(f, 0.03)
  }

  function setPlaying(on: boolean): void {
    playing = on
    if (playBtn === null) return
    playBtn.setAttribute('aria-pressed', String(on))
    q('[data-band-play-label]', playBtn).textContent = on ? 'Pause' : 'Play'
    q('use', playBtn).setAttribute('href', on ? '#i-pause' : '#i-play')
  }

  function end(): void {
    setPlaying(false)
    stopVoices()
    if (drag === null) {
      drag = CHASE_READINGS[2]
      live.textContent = bandValueText(A3, drag)
    }
    setDrag(true)
  }

  playBtn?.addEventListener('click', () => {
    if (playing) {
      setPlaying(false)
      stopVoices()
      return
    }
    if (t >= CHASE_SEC) {
      t = 0
      if (!calm()) {
        drag = null
        setDrag(false)
      }
    }
    audible = Sound.canPlay()
    setPlaying(true)
  })
  slowBtn?.addEventListener('click', () => {
    const on = slowBtn.getAttribute('aria-pressed') !== 'true'
    slowBtn.setAttribute('aria-pressed', String(on))
    rate = on ? 0.5 : 1
  })
  scrub?.addEventListener('input', () => {
    t = (Number(scrub.value) / 1000) * CHASE_SEC
    rangeFill(scrub)
    stopVoices()
    if (t >= CHASE_SEC) end()
  })

  /** The value the readouts show now: the dragged one, the chased one, or none before the line. */
  function current(): number | null {
    if (drag !== null && (calm() || t >= CHASE_SEC || !opts.chase)) return drag
    return t > MERC_SEC ? chaseCents(t - MERC_SEC) : null
  }

  function words(c: number | null): string {
    if (c !== null)
      return `${BAND_WORDS[bandOf(c)]} · nearest note ${nameHtml(nearestNote(A3, c))}`
    return playing
      ? "Merc's A3: the band reaches 35 cents either side"
      : 'Press Play to watch a line chase the band'
  }

  function readouts(c: number | null): void {
    const text = words(c)
    const gap = c === null ? '\u2013' : signedCents(c)
    if (text + gap === shown) return
    shown = text + gap
    wordsRo.innerHTML = text
    gapRo.innerHTML = `${gap}<small>cents</small>`
  }

  /** The line this frame: the chase so far, its end dragged, or free play's line where it is dragged. */
  function lineNow(done: boolean, u: number): TracePoint[] {
    if (!opts.chase && drag !== null)
      return [
        { t: 0, c: drag },
        { t: HEAD_T, c: drag },
      ]
    return u > 0 ? lineTo(u, done ? drag : null) : []
  }

  function paint(): void {
    const s = chart.scene
    const done = drag !== null && (calm() || t >= CHASE_SEC || !opts.chase)
    const u = done ? HEAD_T : Math.max(0, t - MERC_SEC)
    s.glow = !done && t < MERC_SEC && playing ? 1 : 0
    s.marks = opts.chase ? MARKS.filter((m) => m.t <= u) : []
    s.line = lineNow(done, u)
    const head = s.line[s.line.length - 1]
    s.head =
      head === undefined || head.c === null ? null : { t: head.t, c: head.c }
    s.playhead = playing && !calm() ? u : null
    const c = current()
    s.lit = c !== null && inBand(c)
    readouts(c)
    if (done) {
      const p = chart.pointOf(HEAD_T, drag ?? 0)
      handle.style.left = `${p.x}px`
      handle.style.top = `${p.y}px`
    }
    if (scrub !== null && playing) {
      scrub.value = String(Math.round((t / CHASE_SEC) * 1000))
      rangeFill(scrub)
    }
  }

  function showReadings(on: boolean): void {
    if (readings === null || readings.hidden === !on) return
    readings.hidden = !on
    if (on && readings.childElementCount === 0) {
      for (const c of CHASE_READINGS) {
        const li = document.createElement('li')
        li.textContent = readingWords(c)
        readings.appendChild(li)
      }
    }
  }

  addDrawer({
    active: opts.active ?? watch(root),
    draw(_now, dt) {
      if (playing) {
        t = Math.min(CHASE_SEC, t + dt * rate)
        syncSound()
        if (t >= CHASE_SEC) end()
      }
      if (calm() && drag === null) {
        drag = CHASE_READINGS[2]
        setDrag(true)
      }
      showReadings(calm())
      paint()
    },
  })

  setDrag(!opts.chase)
  scrub?.setAttribute('aria-valuetext', '0.0 seconds')
  if (scrub !== null) rangeFill(scrub)
  scrub?.addEventListener('input', () =>
    scrub.setAttribute('aria-valuetext', `${t.toFixed(1)} seconds`),
  )

  return {
    stop() {
      setPlaying(false)
      stopVoices()
      held?.stop()
      held = null
    },
  }
}
