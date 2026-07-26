// ============================================================
// ZenPitchRibbon — live pitch coach strip for the zen stage
// ============================================================
//
// A slim glass ribbon under the zen header: the target notes of the
// next few seconds flow left through a fixed "now" marker, and the
// singer's live pitch rides it as a glowing dot with a short comet
// trail. Green while the note is held (same octave-agnostic 50-cent
// judgement as the score), warm rose when off the pitch, a soft violet
// while singing between targets, and a dim ghost when silent — red
// means wrong, never resting.
//
// One small DPR-aware canvas, drawn by its own rAF loop only while the
// ribbon is visible; the trail advances only during playback. Sizing
// follows the container via ResizeObserver (never pin canvas width).

import type { Component } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'
import type { RibbonNote, SingerState, } from '@/features/stem-mixer/zen-pitch-ribbon'
import { judgeSinger, midiToRibbonY, notesInWindow, RIBBON_AHEAD_SEC, RIBBON_BEHIND_SEC, RIBBON_NOW_RATIO, ribbonBand, targetNoteAt, timeToX, } from '@/features/stem-mixer/zen-pitch-ribbon'
import type { DetectedPitch } from '@/lib/pitch-detector'
import styles from './ZenPitchRibbon.module.css'

interface ZenPitchRibbonProps {
  playing: () => boolean
  elapsed: () => number
  notes: () => RibbonNote[]
  micPitch: () => DetectedPitch | null
}

const DOT_COLOR: Record<SingerState, string> = {
  hit: '#6ee7b7',
  off: '#fb7185',
  free: 'rgba(196, 181, 253, 0.85)',
  silent: 'rgba(238, 228, 255, 0.22)',
}

const DOT_GLOW: Record<SingerState, number> = {
  hit: 14,
  off: 9,
  free: 7,
  silent: 0,
}

interface TrailSample {
  t: number
  midi: number
  state: SingerState
}

const TRAIL_SEC = 1.2

export const ZenPitchRibbon: Component<ZenPitchRibbonProps> = (props) => {
  let wrapRef: HTMLDivElement | undefined
  let canvasRef: HTMLCanvasElement | undefined
  let rafId = 0
  let trail: TrailSample[] = []
  // The band eases toward the visible notes so phrase changes glide
  // instead of snapping; kept across empty (instrumental) windows.
  let bandMin = 55
  let bandMax = 79

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const syncCanvasSize = (): void => {
    if (!wrapRef || !canvasRef) return
    const dpr = window.devicePixelRatio || 1
    const { clientWidth, clientHeight } = wrapRef
    const w = Math.round(clientWidth * dpr)
    const h = Math.round(clientHeight * dpr)
    if (canvasRef.width !== w || canvasRef.height !== h) {
      canvasRef.width = w
      canvasRef.height = h
    }
  }

  const draw = (): void => {
    const canvas = canvasRef
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (w <= 0 || h <= 0) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const now = props.elapsed()
    const winStart = now - RIBBON_BEHIND_SEC
    const winEnd = now + RIBBON_AHEAD_SEC
    const visible = notesInWindow(props.notes(), winStart, winEnd)

    const band = ribbonBand(visible)
    if (band) {
      // Ease ~10%/frame toward the target band (snap under reduced motion).
      const ease = reducedMotion ? 1 : 0.1
      bandMin += (band.minMidi - bandMin) * ease
      bandMax += (band.maxMidi - bandMax) * ease
    }
    const easedBand = { minMidi: bandMin, maxMidi: bandMax }

    const target = targetNoteAt(visible, now)
    const mic = props.micPitch()
    // The mic pipeline only runs during playback — while paused the last
    // detection is stale, so show the honest ghost instead of a frozen
    // verdict.
    const reading = props.playing()
      ? judgeSinger(mic?.frequency ?? 0, target)
      : judgeSinger(0, target)

    // Target pills. The one under the now marker fills green while held.
    for (const note of visible) {
      const x1 = Math.max(0, timeToX(note.startBeat, winStart, winEnd, w))
      const x2 = Math.min(w, timeToX(note.endBeat, winStart, winEnd, w))
      const y = midiToRibbonY(note.midi, easedBand, h)
      const pillW = Math.max(3, x2 - x1)
      const pillH = 5
      const held = note === target && reading.state === 'hit'
      ctx.save()
      if (held) {
        ctx.shadowColor = DOT_COLOR.hit
        ctx.shadowBlur = 10
        ctx.fillStyle = 'rgba(110, 231, 183, 0.34)'
        ctx.strokeStyle = 'rgba(110, 231, 183, 0.7)'
      } else {
        ctx.fillStyle = 'rgba(238, 228, 255, 0.13)'
        ctx.strokeStyle = 'rgba(238, 228, 255, 0.22)'
      }
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x1, y - pillH / 2, pillW, pillH, pillH / 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // Now marker — a quiet hairline.
    const nowX = RIBBON_NOW_RATIO * w
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(nowX, 3)
    ctx.lineTo(nowX, h - 3)
    ctx.stroke()

    // Comet trail (skipped under reduced motion; advances only while
    // playing so pausing freezes the picture instead of smearing it).
    if (props.playing() && reading.displayMidi !== null) {
      trail.push({ t: now, midi: reading.displayMidi, state: reading.state })
    }
    trail = trail.filter((s) => now - s.t <= TRAIL_SEC && s.t <= now)
    if (!reducedMotion && trail.length > 1) {
      for (let k = 1; k < trail.length; k++) {
        const a = trail[k - 1]
        const b = trail[k]
        if (b.t - a.t > 0.2) continue
        const age = (now - b.t) / TRAIL_SEC
        ctx.strokeStyle = DOT_COLOR[b.state]
        ctx.globalAlpha = 0.35 * (1 - age)
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(
          timeToX(a.t, winStart, winEnd, w),
          midiToRibbonY(a.midi, easedBand, h),
        )
        ctx.lineTo(
          timeToX(b.t, winStart, winEnd, w),
          midiToRibbonY(b.midi, easedBand, h),
        )
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // The singer's dot at the now marker.
    if (reading.displayMidi !== null || reading.state === 'silent') {
      const y =
        reading.displayMidi === null
          ? h / 2
          : midiToRibbonY(reading.displayMidi, easedBand, h)
      const radius = reading.state === 'hit' ? 5 : 3.5
      ctx.save()
      if (!reducedMotion && DOT_GLOW[reading.state] > 0) {
        ctx.shadowColor = DOT_COLOR[reading.state]
        ctx.shadowBlur = DOT_GLOW[reading.state]
      }
      ctx.fillStyle = DOT_COLOR[reading.state]
      ctx.beginPath()
      ctx.arc(nowX, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  createEffect(() => {
    // Rebuild the loop when the note set identity changes is unnecessary —
    // the loop reads signals each frame. The effect exists only to own the
    // rAF lifecycle alongside the component.
    const tick = (): void => {
      draw()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(rafId))
  })

  const observer =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => syncCanvasSize())
      : null
  onCleanup(() => observer?.disconnect())

  return (
    <div
      ref={(el) => {
        wrapRef = el
        observer?.observe(el)
        queueMicrotask(syncCanvasSize)
      }}
      class={styles.ribbon}
      aria-label="Live pitch — green means you are on the note"
      role="img"
    >
      <canvas ref={canvasRef} class={styles.canvas} />
    </div>
  )
}
