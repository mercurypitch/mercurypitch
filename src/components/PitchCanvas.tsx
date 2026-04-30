// ============================================================
// PitchCanvas — Pitch trail and melody display canvas
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { appStore } from '@/stores'
import { colorCodeNotes, flameMode, showAccuracyPercent } from '@/stores/settings-store'
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
  fill: string
  stroke: string
  text: string
} {
  switch (rating) {
    case 'perfect':
      return {
        fill: 'rgba(63,185,80,0.45)', // green
        stroke: 'rgba(63,185,80,0.9)',
        text: '#6cd680',
      }
    case 'excellent':
      return {
        fill: 'rgba(45,212,191,0.4)', // teal-green
        stroke: 'rgba(45,212,191,0.85)',
        text: '#56e1cb',
      }
    case 'good':
      return {
        fill: 'rgba(141,203,65,0.4)', // lime
        stroke: 'rgba(141,203,65,0.85)',
        text: '#a6dd6e',
      }
    case 'okay':
      return {
        fill: 'rgba(210,153,34,0.42)', // amber
        stroke: 'rgba(210,153,34,0.9)',
        text: '#e1b144',
      }
    case 'off':
    default:
      return {
        fill: 'rgba(248,81,73,0.42)', // red
        stroke: 'rgba(248,81,73,0.9)',
        text: '#ff7a72',
      }
  }
}

// Spring-physics state for Yousician-style bouncing dot animation
interface DotState {
  freq: number
  targetFreq: number
  velocity: number
  prevNoteIndex: number
  noteStartTime: number
  trail: { freq: number; alpha: number; time: number }[]
}

const SPRING_STIFFNESS = 280
const SPRING_DAMPING = 14
const DOT_RADIUS = 7
const GLOW_RADIUS = 18

export const PitchCanvas: Component<PitchCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let isSeeking = false

  // Yousician spring-bounce state
  const dotState: DotState = {
    freq: 0,
    targetFreq: 0,
    velocity: 0,
    prevNoteIndex: -1,
    noteStartTime: 0,
    trail: [],
  }
  let _lastRafTime = 0

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
      updateSpring(ts)
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    _lastRafTime = 0
    animFrameId = requestAnimationFrame(loop)
  }

  // Spring physics tick — call once per RAF frame
  const updateSpring = (now: number) => {
    const _melody = props.melody()
    const noteIndex = props.currentNoteIndex()
    const _beat = props.currentBeat()

    // Detect note change → snap target and trigger jump
    if (noteIndex !== dotState.prevNoteIndex) {
      dotState.prevNoteIndex = noteIndex
      dotState.noteStartTime = now

      if (noteIndex >= 0) {
        const note = _melody[noteIndex]
        if (note !== null && note !== undefined) {
          dotState.targetFreq = note.note.freq
          if (!Number.isFinite(dotState.freq) || dotState.freq <= 0) {
            dotState.freq = note.note.freq
          }
        }
      }
    }

    // Always track melody head with linear x-position
    // Spring only handles Y (frequency = pitch)
    const springT = SPRING_STIFFNESS * (dotState.targetFreq - dotState.freq)
    const dampT = SPRING_DAMPING * dotState.velocity
    dotState.velocity += (springT - dampT) * 0.001
    dotState.freq += dotState.velocity * 0.016
    if (!Number.isFinite(dotState.freq) || dotState.freq <= 0) {
      dotState.freq = dotState.targetFreq > 0 ? dotState.targetFreq : 0
      dotState.velocity = 0
    }

    // Add trail points for glow fade
    if (props.isPlaying?.() && !props.isPaused?.()) {
      dotState.trail.push({
        freq: dotState.freq,
        alpha: 0.6,
        time: now,
      })
      // Fade and prune trail (keep last 80ms)
      dotState.trail = dotState.trail.filter((pt) => now - pt.time < 80)
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

        // Note bar fill — much more opaque than before so the bars are
        // clearly visible without playback running.
        if (isActive) {
          ctx.fillStyle = 'rgba(88,166,255,0.55)'
        } else if (isPlayed && playedPalette) {
          ctx.fillStyle = playedPalette.fill
        } else if (isPlayed) {
          // Color-code disabled — fall back to neutral green tint.
          ctx.fillStyle = 'rgba(63,185,80,0.32)'
        } else {
          ctx.fillStyle = 'rgba(88,166,255,0.28)'
        }
        ctx.fill()

        // Outline — clearer borders so notes don't blend into the background
        if (isActive) {
          ctx.strokeStyle = 'rgba(88,166,255,1)'
        } else if (isPlayed && playedPalette) {
          ctx.strokeStyle = playedPalette.stroke
        } else if (isPlayed) {
          ctx.strokeStyle = 'rgba(63,185,80,0.7)'
        } else {
          ctx.strokeStyle = 'rgba(88,166,255,0.6)'
        }
        ctx.lineWidth = isActive ? 2 : 1.25
        ctx.stroke()

        // Draw accuracy percentage on played notes
        if (showAccuracyPercent() && isPlayed && playedRecord !== null && bw > 20) {
          const pct = Math.round(Math.max(0, 100 - playedRecord.avgCents * 2))
          const fontSize = Math.max(9, Math.min(12, boxH * 0.45))
          ctx.font = `bold ${fontSize}px ui-monospace, monospace`
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`${pct}%`, x1 + bw / 2, y)
        }

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
          ctx.roundRect(x1, y - boxHalf, bw, boxH, 5)
          ctx.clip()

          // 1) Burned-zone background gradient (the part already burning).
          //    Goes from a dark-red ember tail on the LEFT to a bright
          //    yellow-white at the burn front on the RIGHT.
          const fillGrad = ctx.createLinearGradient(x1, 0, burnX, 0)
          fillGrad.addColorStop(0, 'rgba(120,20,10,0.55)')
          fillGrad.addColorStop(0.4, 'rgba(220,80,20,0.6)')
          fillGrad.addColorStop(0.75, 'rgba(255,160,40,0.7)')
          fillGrad.addColorStop(1, 'rgba(255,255,200,0.8)')
          ctx.fillStyle = fillGrad
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
          ctx.moveTo(x1 + 4, y - boxHalf) // skip left round corner
          ctx.lineTo(x1 + bw * progress, y - boxHalf) // top
          ctx.moveTo(x1 + bw * progress, y + boxHalf)
          ctx.lineTo(x1 + 4, y + boxHalf) // bottom
          // Left cap (rounded) — only on first half so it eases in
          if (progress > 0.05) {
            ctx.moveTo(x1, y - boxHalf + 4)
            ctx.lineTo(x1, y + boxHalf - 4)
          }
          ctx.stroke()
          ctx.restore()
        }

        if (bw >= 12) {
          // Note name text — also more opaque, especially for played notes.
          if (isActive) {
            ctx.fillStyle = '#ffffff'
          } else if (isPlayed && playedPalette) {
            ctx.fillStyle = playedPalette.text
          } else if (isPlayed) {
            ctx.fillStyle = '#3fb950'
          } else {
            ctx.fillStyle = 'rgba(220,235,255,0.95)'
          }
          ctx.font = `${(isActive ? 'bold ' : '') + (isActive ? 13 : 11)}px sans-serif`
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

    // Yousician-style animated dot — uses spring physics for Y, linear for X
    // Drawn on top of the melody static bars (which come from melody items)
    if (props.isPlaying() && !props.isPaused()) {
      const _melody = props.melody()
      const beat = props.currentBeat()
      const tx = beatToX(beat, w)

      if (dotState.targetFreq > 0) {
        const ty = freqToY(dotState.freq, h)
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
          ctx.restore()
          return
        }

        // Spring overshoot trail: draw fading ghosts from trail buffer
        for (const pt of dotState.trail) {
          const age = (performance.now() - pt.time) / 80
          const alpha = Math.max(0, 0.35 * (1 - age))
          if (alpha > 0.01) {
            const trailY = freqToY(pt.freq, h)
            if (!Number.isFinite(trailY)) continue
            const grad = ctx.createRadialGradient(tx, trailY, 0, tx, trailY, 12)
            grad.addColorStop(0, `rgba(88,166,255,${alpha})`)
            grad.addColorStop(1, `rgba(88,166,255,0)`)
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(tx, trailY, 12, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // Outer glow
        const grad2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, GLOW_RADIUS)
        grad2.addColorStop(0, 'rgba(88,166,255,0.5)')
        grad2.addColorStop(1, 'rgba(88,166,255,0)')
        ctx.fillStyle = grad2
        ctx.beginPath()
        ctx.arc(tx, ty, GLOW_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        // Dot body
        ctx.fillStyle = '#58a6ff'
        ctx.beginPath()
        ctx.arc(tx, ty, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(tx - 2, ty - 2, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (!props.isPlaying() && !props.isPaused()) {
      // Reset spring when stopped
      dotState.freq = 0
      dotState.targetFreq = 0
      dotState.velocity = 0
      dotState.trail = []
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
