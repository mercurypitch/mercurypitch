// ============================================================
// PitchCanvas — Pitch trail and melody display canvas
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type {ArcState} from '@/lib/arc-physics';
import {
  BALL_RADIUS,
  buildPlayable,
  computeArcCy,
  computeArcEndBeat,
  computeBallPos,
  computeInitialArc,
  isBackwardsSeek,
  shouldAdvanceArc
} from '@/lib/arc-physics'
import { appStore, bpm, focusMode } from '@/stores'
import { colorCodeNotes, flameMode, showAccuracyPercent, showFocusBall, showPlaybackBall, } from '@/stores/settings-store'
import type { MelodyItem, NoteResult, PitchSample, ScaleDegree } from '@/types'

interface PitchCanvasProps {
  melody: () => MelodyItem[]
  scale: () => ScaleDegree[]
  totalBeats: () => number
  currentBeat: () => number
  pitchHistory: () => PitchSample[]
  currentNoteIndex: () => number
  isPlaying: () => boolean
  isPaused: () => boolean
  isScrolling: () => boolean
  targetPitch?: () => number | null
  noteAccuracyMap?: () => Map<number, number>
  isRecording?: () => boolean
  getWaveform?: () => Float32Array | null
  /** Per-played-note results, in playback order. Used to color-code
   *  played notes by accuracy rating (when colorCodeNotes setting is on). */
  noteResults?: () => NoteResult[]
}

/** Map a per-note rating to (fill, stroke, text) triple for the
 *  played-note state. Palette intentionally matches the existing
 *  score-stat-* and accuracy-band tints (see app.css) so the practice
 *  canvas feels consistent with the rest of the UI.  */
function ratingColors(rating: NoteResult['rating']): {
  fillTop: string
  fillBottom: string
  stroke: string
  text: string
  badgeBg: string
} {
  switch (rating) {
    case 'perfect':
      return {
        fillTop: 'rgba(63,185,80,0.85)',
        fillBottom: 'rgba(40,130,55,0.7)',
        stroke: 'rgba(63,185,80,0.95)',
        text: '#b8f0c4',
        badgeBg: 'rgba(63,185,80,0.45)',
      }
    case 'excellent':
      return {
        fillTop: 'rgba(45,212,191,0.8)',
        fillBottom: 'rgba(30,150,135,0.65)',
        stroke: 'rgba(45,212,191,0.95)',
        text: '#b0f5ea',
        badgeBg: 'rgba(45,212,191,0.45)',
      }
    case 'good':
      return {
        fillTop: 'rgba(141,203,65,0.8)',
        fillBottom: 'rgba(100,150,40,0.65)',
        stroke: 'rgba(141,203,65,0.9)',
        text: '#c4ec9a',
        badgeBg: 'rgba(141,203,65,0.4)',
      }
    case 'okay':
      return {
        fillTop: 'rgba(210,153,34,0.82)',
        fillBottom: 'rgba(160,110,20,0.68)',
        stroke: 'rgba(210,153,34,0.9)',
        text: '#f0d078',
        badgeBg: 'rgba(210,153,34,0.45)',
      }
    case 'off':
    default:
      return {
        fillTop: 'rgba(248,81,73,0.82)',
        fillBottom: 'rgba(180,50,45,0.68)',
        stroke: 'rgba(248,81,73,0.95)',
        text: '#ffb0aa',
        badgeBg: 'rgba(248,81,73,0.45)',
      }
  }
}

const GLOW_RADIUS = 20

// Extended arc state with render-only fields
interface RenderArcState extends ArcState {
  trail: { x: number; y: number; alpha: number; time: number }[]
  ballX: number
  ballY: number
}

export const PitchCanvas: Component<PitchCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let isSeeking = false

  // Yousician jumping-ball arc state
  const arcState: RenderArcState = {
    sx: 0,
    sy: 0,
    ex: 0,
    ey: 0,
    cy: 0,
    startBeat: 0,
    endBeat: 0,
    trail: [],
    noteIndex: -1,
    ballX: 0,
    ballY: 0,
    initialized: false,
  }
  let _prevBeat = -1

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()

    // Mouse handlers for dragging the playhead
    canvasRef.addEventListener('mousedown', (e) => {
      isSeeking = true
      handleSeek(e)
    })
    document.addEventListener('mousemove', (e) => {
      if (isSeeking) handleSeek(e)
    })
    document.addEventListener('mouseup', () => {
      isSeeking = false
    })

    const ro = new ResizeObserver(() => {
      resizeCanvas()
    })
    ro.observe(canvasRef.parentElement!)

    startLoop()

    onCleanup(() => {
      ro.disconnect()
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
    })
  })

  /**
   * Click-to-seek inside the practice canvas.
   *
   * Behavior decisions (per user feedback):
   *   - SEEK IS DISABLED while playback is actively running.
   *     Reason: clicking during a live run made the playhead jump and
   *     fight with the playback timer (RAF kept advancing the runtime's
   *     internal clock while the seek snapped to a different beat),
   *     producing a visible 50-ish-px lurch. For now the simplest UX
   *     is "no seek while playing"; a smooth scrub will be re-added
   *     later as a follow-up.
   *   - SEEK IS ALLOWED while paused or stopped.
   *
   * Coordinate math: e.clientX - canvas.getBoundingClientRect().left
   * gives pixel position relative to the canvas's top-left corner.
   * Divided by canvasRef.clientWidth produces a normalized 0..1 value
   * which we multiply by totalBeats. There is no padding on
   * #canvas-container or the canvas itself, so this maps 1:1 to the
   * playhead overlay's `left: percentage%` positioning.
   */
  const handleSeek = (e: MouseEvent) => {
    if (!canvasRef) return
    // Allow seek while either playing OR paused — the PlaybackRuntime's
    // seekTo is now state-aware (rebases playStartTime instead of
    // restarting from beat 0), so the visible jump from the old
    // implementation is gone. While stopped we still do nothing
    // (no playhead to drag).
    if (!props.isPlaying() && !props.isPaused()) return

    const rect = canvasRef.getBoundingClientRect()

    const x = e.clientX - rect.left
    const w = canvasRef.clientWidth
    if (w <= 0) return
    const totalBeats = props.totalBeats()
    const seekBeat = Math.max(0, Math.min(totalBeats, (x / w) * totalBeats))
    window.dispatchEvent(
      new CustomEvent('pitchperfect:seekToBeat', {
        detail: { beat: seekBeat },
      }),
    )
  }

  const resizeCanvas = () => {
    if (!canvasRef) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.parentElement!.clientWidth
    const h = canvasRef.parentElement!.clientHeight
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = `${w}px`
    canvasRef.style.height = `${h}px`
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const startLoop = () => {
    const loop = (ts: number) => {
      updateArc(ts)
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  // Quadratic Bezier arc physics — call once per RAF frame
  const updateArc = (now: number) => {
    const melody = props.melody()
    const beat = props.currentBeat()
    if (!props.isPlaying?.() || props.isPaused?.()) return
    if (!canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight
    const boxHalf = 11

    const playable = buildPlayable(melody)
    if (playable.length === 0) return

    // ---- Initial arc: find correct note for current beat ----------
    if (!arcState.initialized) {
      // Find which playable note covers the current beat position.
      // Walk backwards so we pick the note whose startBeat <= beat.
      let startIdx = 0
      for (let i = playable.length - 1; i >= 0; i--) {
        if (beat >= playable[i].item.startBeat) {
          startIdx = i
          break
        }
      }
      const first = playable[startIdx].item
      const topY = freqToY(first.note.freq, h) - boxHalf
      const startX = beatToX(first.startBeat, w)
      const rightX = beatToX(first.startBeat + first.duration, w)
      const init = computeInitialArc(
        { startBeat: first.startBeat, duration: first.duration },
        startX,
        rightX,
        topY,
      )
      Object.assign(arcState, init, { trail: [], initialized: true, noteIndex: startIdx })
      _prevBeat = beat
      return
    }

    // ---- Backwards seek: detect when playhead jumps backwards -------
    if (isBackwardsSeek(beat, _prevBeat)) {
      arcState.initialized = false
      _prevBeat = beat
      return
    }
    _prevBeat = beat

    // ---- Guard: ensure current note index is valid ------------------
    const curItem = playable[arcState.noteIndex]?.item
    if (curItem === undefined) {
      arcState.initialized = false
      return
    }
    const cur: { startBeat: number; duration: number } = {
      startBeat: curItem.startBeat,
      duration: curItem.duration,
    }

    // ---- Advance at most 1 note per frame to never skip ------------
    const nextIdx = arcState.noteIndex + 1
    if (nextIdx < playable.length) {
      const nextItem = playable[nextIdx].item
      const next: { startBeat: number; duration: number } = {
        startBeat: nextItem.startBeat,
        duration: nextItem.duration,
      }

      if (shouldAdvanceArc(cur, next, beat)) {
        const src = computeBallPos(beat, arcState)
        const targetY = freqToY(nextItem.note.freq, h) - boxHalf
        const targetX = beatToX(nextItem.startBeat + nextItem.duration, w)

        arcState.noteIndex = nextIdx
        arcState.sx = src.x
        arcState.sy = src.y
        arcState.ex = targetX
        arcState.ey = targetY
        arcState.cy = computeArcCy(src.y, targetY, bpm())
        arcState.startBeat = beat
        arcState.endBeat = computeArcEndBeat(next)

        if (arcState.endBeat <= arcState.startBeat) {
          arcState.endBeat = arcState.startBeat + 0.5
        }

        arcState.trail = []
      }
    }

    // ---- Trail buffer -----------------------------------------------
    if (arcState.startBeat < arcState.endBeat) {
      const t = Math.max(0, Math.min(1,
        (beat - arcState.startBeat) / (arcState.endBeat - arcState.startBeat)))
      if (t > 0 && t < 1) {
        const pos = computeBallPos(beat, arcState)
        arcState.trail.push({ x: pos.x, y: pos.y, alpha: 0.6, time: now })
      }
      arcState.trail = arcState.trail.filter((pt) => now - pt.time < 80)
    }
  }

  const freqToY = (freq: number, h: number): number => {
    if (!Number.isFinite(freq) || freq <= 0) return h / 2
    const scale = props.scale()
    const allFreqs = scale.map((n) => n.freq)
    if (allFreqs.length === 0) return h / 2
    const minFreq = Math.min(...allFreqs) * 0.82
    const maxFreq = Math.max(...allFreqs) * 1.22
    const logMin = Math.log2(minFreq)
    const logMax = Math.log2(maxFreq)
    const pct = (Math.log2(freq) - logMin) / (logMax - logMin)
    const y = h - pct * (h - 40) - 20
    return Number.isFinite(y) ? y : h / 2
  }

  const beatToX = (beat: number, w: number): number => {
    if (!Number.isFinite(beat) || !Number.isFinite(w)) return 0
    const x = (beat / Math.max(1, props.totalBeats())) * w
    return Number.isFinite(x) ? x : 0
  }

  const drawAccuracyHeatmap = (h: number) => {
    const accuracyMap = props.noteAccuracyMap?.()
    if (!accuracyMap || accuracyMap.size === 0) return

    const scale = props.scale()
    for (const note of scale) {
      const acc = accuracyMap.get(note.midi)
      if (acc === undefined) continue
      const y = freqToY(note.freq, h)

      let color: string
      if (acc >= 90) color = 'rgba(63,185,80,0.12)'
      else if (acc >= 75) color = 'rgba(141,203,65,0.10)'
      else if (acc >= 60) color = 'rgba(219,175,0,0.10)'
      else if (acc >= 40) color = 'rgba(219,120,0,0.10)'
      else color = 'rgba(219,50,50,0.10)'

      ctx!.fillStyle = color
      ctx!.fillRect(0, y - 16, ctx!.canvas.clientWidth, 32)
    }
  }

  const drawTargetPitch = (h: number) => {
    const target = props.targetPitch?.()
    if (target === null || target === undefined || target <= 0) return
    const ty = freqToY(target, h)

    const centsBand = 0.1
    const freqLow = target / Math.pow(2, centsBand / 1200)
    const freqHigh = target * Math.pow(2, centsBand / 1200)
    const yLow = freqToY(freqLow, h)
    const yHigh = freqToY(freqHigh, h)

    ctx!.fillStyle = 'rgba(88,166,255,0.08)'
    ctx!.fillRect(0, yHigh, ctx!.canvas.clientWidth, yLow - yHigh)

    ctx!.strokeStyle = 'rgba(88,166,255,0.5)'
    ctx!.lineWidth = 2
    ctx!.setLineDash([6, 4])
    ctx!.beginPath()
    ctx!.moveTo(0, ty)
    ctx!.lineTo(ctx!.canvas.clientWidth, ty)
    ctx!.stroke()
    ctx!.setLineDash([])

    ctx!.fillStyle = '#58a6ff'
    ctx!.font = 'bold 10px sans-serif'
    ctx!.textAlign = 'left'
    ctx!.textBaseline = 'middle'
    const label = `♪ ${Math.round(target)} Hz`
    ctx!.fillText(label, 8, ty)
  }

  const draw = () => {
    if (!ctx || !canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(
      -props.isScrolling()
        ? props.currentBeat() * (w / Math.max(1, props.totalBeats())) * 0.3
        : 0,
      0,
    )

    if (props.getWaveform) {
      if (appStore.micWaveVisible()) {
        const waveform = props.getWaveform()
        if (waveform && waveform.length > 0) {
          ctx.save()
          ctx.strokeStyle = 'rgba(219,112,219,0.6)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          const step = Math.max(1, Math.floor(waveform.length / w))
          for (let i = 0; i < w; i++) {
            const sampleIdx = i * step
            const sample = waveform[sampleIdx] ?? 0
            const y = h / 2 + sample * (h / 2) * 0.8
            if (i === 0) ctx.moveTo(i, y)
            else ctx.lineTo(i, y)
          }
          ctx.stroke()

          ctx.fillStyle = 'rgba(219,112,219,0.08)'
          ctx.beginPath()
          for (let i = 0; i < w; i++) {
            const sampleIdx = i * step
            const sample = waveform[sampleIdx] ?? 0
            const y = h / 2 + sample * (h / 2) * 0.8
            if (i === 0) ctx.moveTo(i, h / 2)
            else ctx.lineTo(i, y)
          }
          for (let i = w - 1; i >= 0; i--) {
            const sampleIdx = i * step
            const sample = waveform[sampleIdx] ?? 0
            const y = h / 2 - sample * (h / 2) * 0.8
            ctx.lineTo(i, y)
          }
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
    }

    const scale = props.scale()
    const melody = props.melody()

    for (const note of scale) {
      const y = freqToY(note.freq, h)
      ctx.strokeStyle = 'rgba(48,54,61,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()

      ctx.fillStyle = '#484f58'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(note.name + note.octave, w - 6, y - 3)
    }

    drawAccuracyHeatmap(h)
    drawTargetPitch(h)

    let playableResultIndex = 0
    for (let j = 0; j < melody.length; j++) {
      const item = melody[j]
      const x1 = beatToX(item.startBeat, w)
      const x2 = beatToX(item.startBeat + item.duration, w)
      const bw = x2 - x1
      const y = freqToY(item.note.freq, h)
      if (item.isRest === true) {
        if (bw > 2) {
          const boxH = 18
          ctx.beginPath()
          ctx.roundRect(x1, h / 2 - boxH / 2, bw, boxH, 6)
          ctx.fillStyle = 'rgba(139,148,158,0.18)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(139,148,158,0.55)'
          ctx.setLineDash([5, 4])
          ctx.lineWidth = 1.25
          ctx.stroke()
          ctx.setLineDash([])
          if (bw >= 22) {
            ctx.fillStyle = 'rgba(201,209,217,0.75)'
            ctx.font = 'bold 11px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('𝄽 rest', x1 + bw / 2, h / 2)
            ctx.textBaseline = 'alphabetic'
          }
        }
        continue
      }
      const resultIndex = playableResultIndex++
      const isActive =
        props.isPlaying() && j === props.currentNoteIndex() && !props.isPaused()

      // Whether this note has already been played in the current run.
      //
      // v3 decision: "played" is determined by the existence of a
      // noteResults entry at index j, NOT by isPlaying(). This way the
      // color-coded review of a finished run persists after Stop or
      // Once-mode complete — the user can see their colored history
      // until they hit Play again (which clears noteResults at the
      // start of a fresh run).
      //
      // We still gate by `j !== currentNoteIndex` so the active note
      // (the one currently being sung) keeps its blue "active" tint
      // instead of immediately snapping to the played-state color.
      const playedRecord = props.noteResults?.()[resultIndex]
      const isPlayed =
        playedRecord !== undefined && playedRecord !== null && !isActive

      if (bw > 2) {
        const boxH = 22
        const boxHalf = boxH / 2
        ctx.beginPath()
        ctx.roundRect(x1, y - boxHalf, bw, boxH, 5)

        // Played-note rating lookup. noteResults accumulates in
        // playback order, so the j-th played note's rating is at
        // noteResults[j]. Only used when colorCodeNotes is on.
        const playedRating: NoteResult['rating'] | null =
          isPlayed && colorCodeNotes() ? (playedRecord.rating ?? null) : null
        const playedPalette = playedRating ? ratingColors(playedRating) : null

        // Default palette
        let palette = {
          fillTop: 'rgba(60,110,190,0.75)',
          fillBottom: 'rgba(35,70,130,0.6)',
          stroke: 'rgba(88,166,255,0.65)',
          text: 'rgba(220,235,255,0.92)',
          badgeBg: 'rgba(88,166,255,0.3)',
        }
        if (isActive) {
          palette = {
            fillTop: 'rgba(88,166,255,0.9)',
            fillBottom: 'rgba(50,110,200,0.75)',
            stroke: 'rgba(120,190,255,1)',
            text: '#ffffff',
            badgeBg: 'rgba(88,166,255,0.5)',
          }
        } else if (isPlayed && playedPalette) {
          palette = playedPalette
        } else if (isPlayed) {
          palette = {
            fillTop: 'rgba(63,185,80,0.8)',
            fillBottom: 'rgba(40,130,55,0.65)',
            stroke: 'rgba(63,185,80,0.8)',
            text: '#b8f0c4',
            badgeBg: 'rgba(63,185,80,0.4)',
          }
        }

        const r = 6 // corner radius

        // Solid dark base so grid lines never bleed through
        ctx.beginPath()
        ctx.roundRect(x1, y - boxHalf, bw, boxH, r)
        ctx.fillStyle = 'rgba(13,17,23,0.92)'
        ctx.fill()

        // Fill with gradient on top of the opaque base
        ctx.beginPath()
        ctx.roundRect(x1, y - boxHalf, bw, boxH, r)
        const fillGrad = ctx.createLinearGradient(
          0,
          y - boxHalf,
          0,
          y + boxHalf,
        )
        fillGrad.addColorStop(0, palette.fillTop)
        fillGrad.addColorStop(1, palette.fillBottom)
        ctx.fillStyle = fillGrad
        ctx.fill()

        // Inner highlight — a thin inset rounded rect that follows the
        // corners properly, drawn inside the top half only to create a
        // subtle "glass lip" without the straight-line artifact.
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x1, y - boxHalf, bw, boxH, r)
        ctx.clip()
        const inset = 1.5
        const hlGrad = ctx.createLinearGradient(
          0,
          y - boxHalf,
          0,
          y - boxHalf + boxH * 0.45,
        )
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)')
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.beginPath()
        ctx.roundRect(
          x1 + inset,
          y - boxHalf + inset,
          bw - inset * 2,
          boxH * 0.45,
          Math.max(1, r - inset),
        )
        ctx.fillStyle = hlGrad
        ctx.fill()
        ctx.restore()

        // Outline
        ctx.beginPath()
        ctx.roundRect(x1, y - boxHalf, bw, boxH, r)
        ctx.strokeStyle = palette.stroke
        ctx.lineWidth = isActive ? 1.5 : 1
        ctx.stroke()

        // ── Flame mode: progressive left→right burning fill. ──
        // The fire fills the note's rectangle in lockstep with playback
        // position: at the start of the note bar there's a small flame
        // ember, mid-note the bar is half-engulfed, and as the playhead
        // approaches the right edge the entire bar is burning. The fire
        // front (bright vertical glow) sits exactly at the playhead's
        // x-position within the bar. After the note ends, isPlayed
        // takes over and renders the "completed" green tint.
        if (isActive && flameMode()) {
          // Progress inside this note: 0 at note start, 1 at note end.
          const progress = Math.max(
            0,
            Math.min(1, (props.currentBeat() - item.startBeat) / item.duration),
          )
          const burnX = x1 + bw * progress // playhead-relative x
          const time = performance.now() / 1000

          ctx.save()
          // Clip everything below to the note's rounded rectangle so the
          // fire never bleeds outside the bar.
          ctx.beginPath()
          ctx.roundRect(x1, y - boxHalf, bw, boxH, 6)
          ctx.clip()

          // 1) Burned-zone background gradient (the part already burning).
          //    Goes from a dark-red ember tail on the LEFT to a bright
          //    yellow-white at the burn front on the RIGHT.
          const fillGradFire = ctx.createLinearGradient(x1, 0, burnX, 0)
          fillGradFire.addColorStop(0, 'rgba(120,20,10,0.55)')
          fillGradFire.addColorStop(0.4, 'rgba(220,80,20,0.6)')
          fillGradFire.addColorStop(0.75, 'rgba(255,160,40,0.7)')
          fillGradFire.addColorStop(1, 'rgba(255,255,200,0.8)')
          ctx.fillStyle = fillGradFire
          ctx.fillRect(x1, y - boxHalf, bw * progress, boxH)

          // 2) Flickering flame "tongues" rising from the burned zone.
          //    Six gradients spaced across the burned region with
          //    sin/cos-driven jitter so they shimmer organically.
          const tongues = 6
          for (let t = 0; t < tongues; t++) {
            const px = x1 + bw * progress * ((t + 0.5) / tongues)
            const phase = time * (4 + t * 1.3) + t
            const jitterX = Math.sin(phase) * 3
            const jitterY = Math.cos(phase * 1.4) * 2
            const radius = boxH * (0.7 + 0.3 * Math.abs(Math.sin(phase * 0.7)))
            const grad = ctx.createRadialGradient(
              px + jitterX,
              y + jitterY,
              0,
              px + jitterX,
              y + jitterY,
              radius,
            )
            grad.addColorStop(0, 'rgba(255,250,200,0.55)')
            grad.addColorStop(0.4, 'rgba(255,160,30,0.4)')
            grad.addColorStop(0.8, 'rgba(220,40,10,0.18)')
            grad.addColorStop(1, 'rgba(180,10,0,0)')
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(px + jitterX, y + jitterY, radius, 0, Math.PI * 2)
            ctx.fill()
          }

          // 3) The "burn front" — a bright vertical streak at the
          //    playhead position inside the note. This is the leading
          //    edge of the fire, where the unburned bar meets the burnt.
          if (progress > 0 && progress < 1) {
            const frontGrad = ctx.createLinearGradient(
              burnX - 8,
              0,
              burnX + 8,
              0,
            )
            frontGrad.addColorStop(0, 'rgba(255,200,60,0)')
            frontGrad.addColorStop(0.5, 'rgba(255,255,230,0.95)')
            frontGrad.addColorStop(1, 'rgba(255,140,40,0)')
            ctx.fillStyle = frontGrad
            ctx.fillRect(burnX - 8, y - boxHalf, 16, boxH)
          }
          ctx.restore() // end clip

          // 4) Outer glow stroke — only the burned portion of the bar's
          //    border is "on fire". Use shadowBlur for an outward halo.
          ctx.save()
          ctx.shadowColor = 'rgba(255,140,40,0.85)'
          ctx.shadowBlur = 16
          ctx.strokeStyle = 'rgba(255,200,80,0.95)'
          ctx.lineWidth = 2
          // Draw three horizontal stroke segments forming the burned-portion
          // outline (top, bottom, and left cap) — leaving the right edge
          // open so it doesn't draw a hard line at the burn front.
          ctx.beginPath()
          ctx.moveTo(x1 + 6, y - boxHalf) // skip left round corner
          ctx.lineTo(x1 + bw * progress, y - boxHalf) // top
          ctx.moveTo(x1 + bw * progress, y + boxHalf)
          ctx.lineTo(x1 + 6, y + boxHalf) // bottom
          // Left cap (rounded) — only on first half so it eases in
          if (progress > 0.05) {
            ctx.moveTo(x1, y - boxHalf + 6)
            ctx.lineTo(x1, y + boxHalf - 6)
          }
          ctx.stroke()
          ctx.restore()
        }

        // Text and badges
        const hasBadge =
          showAccuracyPercent() && isPlayed && playedRecord !== null && bw > 65
        const centerName = bw >= 12 && !hasBadge

        if (hasBadge) {
          // Note name left aligned
          ctx.fillStyle = palette.text
          ctx.font = `bold ${isActive ? 13 : 11}px sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(item.note.name, x1 + 10, y + 0.5)

          // Accuracy badge right aligned
          let pct = 0
          if (playedRecord.rating !== 'off') {
            pct = Math.round(Math.max(0, 100 - playedRecord.avgCents * 2))
          }
          const textStr = `${pct}%`
          ctx.font = `bold 10px ui-monospace, monospace`
          const tw = ctx.measureText(textStr).width
          const padX = 6
          const badgeW = tw + padX * 2
          const badgeH = 16
          const badgeX = x1 + bw - badgeW - 4
          const badgeY = y - badgeH / 2

          // Draw badge pill
          ctx.beginPath()
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2)
          ctx.fillStyle = palette.badgeBg
          ctx.fill()

          // Badge outline
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.lineWidth = 1
          ctx.stroke()

          // Badge text
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(textStr, badgeX + badgeW / 2, y + 0.5)
          ctx.textBaseline = 'alphabetic'
        } else if (centerName) {
          ctx.fillStyle = palette.text
          ctx.font = `bold ${isActive ? 13 : 11}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(item.note.name, x1 + bw / 2, y + 0.5)
          ctx.textBaseline = 'alphabetic'
        }
      }

      ctx.strokeStyle = 'rgba(48,54,61,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x1, 0)
      ctx.lineTo(x1, h)
      ctx.stroke()
    }

    const history = props.pitchHistory()
    if (history.length > 1) {
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(63,185,80,0.75)'
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      let started = false
      for (const pt of history) {
        if (
          pt.freq === null ||
          pt.freq === undefined ||
          pt.freq === 0 ||
          pt.cents === undefined
        ) {
          started = false
          continue
        }
        const beat = pt.time
        const px = beatToX(beat, w)
        const py = freqToY(pt.freq, h)
        if (!started) {
          ctx.moveTo(px, py)
          started = true
        } else ctx.lineTo(px, py)
      }
      ctx.stroke()

      const last = history[history.length - 1]
      if (
        last.cents !== undefined &&
        last.freq !== null &&
        last.freq !== undefined &&
        last.freq > 0
      ) {
        const ly = freqToY(last.freq, h)
        const lx = beatToX(last.time, w)
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12)
        grad.addColorStop(0, 'rgba(63,185,80,0.55)')
        grad.addColorStop(1, 'rgba(63,185,80,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(lx, ly, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#3fb950'
        ctx.beginPath()
        ctx.arc(lx, ly, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(lx, ly, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Yousician-style jumping ball — quadratic Bezier arcs between notes
    const ballToggle = focusMode() ? showFocusBall() : showPlaybackBall()
    if (ballToggle && (props.isPlaying() || props.isPaused()) && arcState.noteIndex >= 0) {
      const beat = props.currentBeat()
      const pos = computeBallPos(beat, arcState)
      const ballX = pos.x
      const ballY = pos.y

      // Store position for next frame's continuous chaining
      arcState.ballX = ballX
      arcState.ballY = ballY

      if (!Number.isFinite(ballX) || !Number.isFinite(ballY)) {
        ctx.restore()
        return
      }

      // Arc trail: draw fading ghosts along the path
      for (const pt of arcState.trail) {
        const age = (performance.now() - pt.time) / 80
        const alpha = Math.max(0, 0.3 * (1 - age))
        if (alpha > 0.01) {
          if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 12)
          grad.addColorStop(0, `rgba(200,220,255,${alpha})`)
          grad.addColorStop(1, 'rgba(200,220,255,0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Outer glow (white with subtle blue tint)
      const glowGrad = ctx.createRadialGradient(
        ballX, ballY, 0,
        ballX, ballY, GLOW_RADIUS,
      )
      glowGrad.addColorStop(0, 'rgba(200,220,255,0.45)')
      glowGrad.addColorStop(0.5, 'rgba(150,180,230,0.15)')
      glowGrad.addColorStop(1, 'rgba(100,140,220,0)')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(ballX, ballY, GLOW_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Shadow/depth ring beneath the ball
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.arc(ballX, ballY + 2, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Ball body (white gradient for 3D sphere look)
      const ballGrad = ctx.createRadialGradient(
        ballX - 2, ballY - 3, 0,
        ballX, ballY, BALL_RADIUS,
      )
      ballGrad.addColorStop(0, '#ffffff')
      ballGrad.addColorStop(0.7, '#e8ecf0')
      ballGrad.addColorStop(1, '#c0c8d4')
      ctx.fillStyle = ballGrad
      ctx.beginPath()
      ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Specular highlight (upper-left reflection shine)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(ballX - 2.5, ballY - 2.5, 3, 0, Math.PI * 2)
      ctx.fill()
    } else if (!props.isPlaying() && !props.isPaused()) {
      // Reset arc state when stopped
      arcState.sx = 0
      arcState.sy = 0
      arcState.ex = 0
      arcState.ey = 0
      arcState.cy = 0
      arcState.startBeat = 0
      arcState.endBeat = 0
      arcState.trail = []
      arcState.noteIndex = -1
      arcState.initialized = false
    }

    ctx.restore()
  }

  createEffect(() => {
    draw()
  })

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
