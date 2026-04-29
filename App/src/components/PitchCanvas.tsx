// ============================================================
// PitchCanvas — Pitch trail and melody display canvas
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { appStore } from '@/stores'
import { flameMode } from '@/stores/settings-store'
import type { MelodyItem, PitchSample, ScaleDegree } from '@/types'

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

  const handleSeek = (e: MouseEvent) => {
    if (!canvasRef) return
    if (props.isPlaying() || props.isPaused()) {
      const rect = canvasRef.getBoundingClientRect()
      const x = e.clientX - rect.left
      const w = canvasRef.clientWidth
      const totalBeats = props.totalBeats()
      const seekBeat = (x / w) * totalBeats
      window.dispatchEvent(
        new CustomEvent('pitchperfect:seekToBeat', {
          detail: { beat: seekBeat },
        }),
      )
    }
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

    for (let j = 0; j < melody.length; j++) {
      const item = melody[j]
      const x1 = beatToX(item.startBeat, w)
      const x2 = beatToX(item.startBeat + item.duration, w)
      const bw = x2 - x1
      const y = freqToY(item.note.freq, h)
      const isActive =
        props.isPlaying() && j === props.currentNoteIndex() && !props.isPaused()

      // Whether this note has already been played in the current run.
      // The Yousician-style "played" state — slightly dimmed but still
      // clearly visible, so the user can see what they've completed.
      const isPlayed =
        props.isPlaying() && !props.isPaused() && j < props.currentNoteIndex()

      if (bw > 2) {
        const boxH = 22
        const boxHalf = boxH / 2
        ctx.beginPath()
        ctx.roundRect(x1, y - boxHalf, bw, boxH, 5)

        // Note bar fill — much more opaque than before so the bars are
        // clearly visible without playback running.
        if (isActive) {
          ctx.fillStyle = 'rgba(88,166,255,0.55)'
        } else if (isPlayed) {
          // Played notes use a softer green-ish tone to indicate completion
          ctx.fillStyle = 'rgba(63,185,80,0.32)'
        } else {
          ctx.fillStyle = 'rgba(88,166,255,0.28)'
        }
        ctx.fill()

        // Outline — clearer borders so notes don't blend into the background
        if (isActive) {
          ctx.strokeStyle = 'rgba(88,166,255,1)'
        } else if (isPlayed) {
          ctx.strokeStyle = 'rgba(63,185,80,0.7)'
        } else {
          ctx.strokeStyle = 'rgba(88,166,255,0.6)'
        }
        ctx.lineWidth = isActive ? 2 : 1.25
        ctx.stroke()

        // ── Flame mode: animated burning effect on the active note. ──
        // Triggered when the `flameMode` global signal is on (Settings
        // panel toggle). Renders as a stack of warped radial gradients
        // with jittered offsets so it flickers like real flame.
        if (isActive && flameMode()) {
          ctx.save()
          const time = performance.now() / 1000
          const flameLayers = 5
          for (let f = 0; f < flameLayers; f++) {
            const phase = time * (3 + f * 1.7)
            const jitterX = Math.sin(phase + j) * 4
            const jitterY = Math.cos(phase * 1.3 + f) * 3
            const fx = x1 + bw / 2 + jitterX
            const fy = y + jitterY
            const fr = boxH * (1.5 + f * 0.4) + Math.sin(phase * 2) * 4
            const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr)
            // Hottest at center: white-yellow → orange → red → transparent
            grad.addColorStop(0, `rgba(255,255,220,${0.28 - f * 0.04})`)
            grad.addColorStop(0.25, `rgba(255,180,40,${0.22 - f * 0.03})`)
            grad.addColorStop(0.6, `rgba(255,80,30,${0.16 - f * 0.025})`)
            grad.addColorStop(1, 'rgba(255,30,10,0)')
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(fx, fy, fr, 0, Math.PI * 2)
            ctx.fill()
          }
          // Bright glow stroke around the active note bar
          ctx.shadowColor = 'rgba(255,140,40,0.85)'
          ctx.shadowBlur = 18
          ctx.strokeStyle = 'rgba(255,200,80,0.95)'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.roundRect(x1, y - boxHalf, bw, boxH, 5)
          ctx.stroke()
          ctx.restore()
        }

        if (bw >= 12) {
          // Note name text — also more opaque, especially for played notes.
          if (isActive) {
            ctx.fillStyle = '#ffffff'
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
