// ============================================================
// Lesson 5 breath gauge toy — Fig. 2, one long note's breath, played
// ============================================================
//
// The gauge view of the breath toy (WEB-SPEC, Toys 3), drawn by
// breath-gauge.ts. Play the breath runs a cursor across the 10-second note
// while Merc's "ooh" holds A3 unchanged, because the point is that the note
// does not change while the balance does; the readout says "Now: holding
// back" or "Now: adding", and a polite line repeats it when it changes.
// Quiet and Loud (aria-pressed) move what the note needs, so the crossing
// falls at 7 s or 3 s. A scrub bar and Slow (half speed), as every
// animation has. Under reduced motion the cursor never runs: the gauge
// shows its end state with both phases listed under it, and Play the breath
// still sounds the note.
//
// Mounted twice: Step 2, and the Wrap's free play.

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, hz } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { rangeFill } from '@/features/lessons/kit/toy-helpers'
import type { NoteLevel } from './breath-gauge'
import { drawGauge, GAUGE_SEC, gaugeFrame, gaugePhases, gaugeSummary, nowWords, } from './breath-gauge'

/** The scrub bar's spoken value: "4.0 seconds of 10: holding back". */
export function gaugeValueText(n: NoteLevel, t: number): string {
  return `${t.toFixed(1)} seconds of ${GAUGE_SEC}: ${nowWords(n, t).replace('Now: ', '')}`
}

export interface GaugeOptions {
  /** When it draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Gauge {
  /** Stops the breath and its note now (the viewer left the step). */
  stop(): void
}

export function mountGauge(root: HTMLElement, opts: GaugeOptions = {}): Gauge {
  const canvas = q<HTMLCanvasElement>('.gauge-viz canvas', root)
  const cv = surface(canvas)
  const playBtn = q<HTMLButtonElement>('[data-gauge="play"]', root)
  const slowBtn = q<HTMLButtonElement>('[data-gauge="slow"]', root)
  const scrub = q<HTMLInputElement>('[data-gauge="scrub"]', root)
  const levels = qa<HTMLButtonElement>('[data-gauge-level]', root)
  const nowRo = q('[data-gauge-now]', root)
  const live = q('[data-gauge-live]', root)
  const phases = q<HTMLOListElement>('[data-gauge-phases]', root)
  let level: NoteLevel = 'quiet'
  let t = 0
  let playing = false
  let started = false
  let rate = 1
  let voice: Voice | null = null
  let said = ''

  function setPlaying(on: boolean): void {
    playing = on
    playBtn.setAttribute('aria-pressed', String(on))
    q('[data-gauge-play-label]', playBtn).textContent = on
      ? 'Pause'
      : 'Play the breath'
    q('use', playBtn).setAttribute('href', on ? '#i-pause' : '#i-play')
    if (!on) {
      voice?.stop()
      voice = null
    }
  }

  function readout(): void {
    const words = started ? nowWords(level, t) : 'Now: –'
    nowRo.textContent = words.replace('Now: ', '')
    if (started && words !== said) {
      said = words
      live.textContent = words
    }
    scrub.setAttribute('aria-valuetext', gaugeValueText(level, t))
  }

  function listPhases(): void {
    phases.textContent = ''
    for (const line of gaugePhases(level)) {
      const li = document.createElement('li')
      li.textContent = line
      phases.appendChild(li)
    }
  }

  function setLevel(n: NoteLevel): void {
    level = n
    levels.forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.gaugeLevel === n)),
    )
    canvas.setAttribute('aria-label', gaugeSummary(n))
    listPhases()
    said = ''
    readout()
  }

  playBtn.addEventListener('click', () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (t >= GAUGE_SEC) t = 0
    started = true
    setPlaying(true)
    // Merc's "ooh" holds A3 unchanged the whole way: the note never moves
    if (Sound.canPlay()) voice = Sound.voice(hz(A3), { kind: 'merc' })
  })
  slowBtn.addEventListener('click', () => {
    const on = slowBtn.getAttribute('aria-pressed') !== 'true'
    slowBtn.setAttribute('aria-pressed', String(on))
    rate = on ? 0.5 : 1
  })
  for (const b of levels)
    b.addEventListener('click', () => {
      const n = b.dataset.gaugeLevel
      if (n === 'quiet' || n === 'loud') setLevel(n)
    })
  scrub.addEventListener('input', () => {
    setPlaying(false)
    started = true
    t = (Number(scrub.value) / 1000) * GAUGE_SEC
    rangeFill(scrub)
    readout()
  })

  addDrawer({
    active: opts.active ?? watch(root),
    draw(_now, dt) {
      const calm = reducedMotion()
      phases.hidden = !calm
      if (playing) {
        t = clamp(t + dt * rate, 0, GAUGE_SEC)
        scrub.value = String(Math.round((t / GAUGE_SEC) * 1000))
        rangeFill(scrub)
        if (t >= GAUGE_SEC) setPlaying(false)
        readout()
      }
      const { ctx, w, h } = cv.fit()
      drawGauge(gaugeFrame(ctx, w, h), level, calm || !started ? null : t)
    },
  })

  setLevel('quiet')
  rangeFill(scrub)

  return {
    stop() {
      setPlaying(false)
    },
  }
}
