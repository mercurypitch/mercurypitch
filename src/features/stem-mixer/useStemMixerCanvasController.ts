// ============================================================
// StemMixer Canvas Controller — canvas refs, drawing, handlers, observer
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import type { MergedNote, MidiNoteEvent, PitchDetection, } from '@/lib/midi-generator'
import { DEFAULT_BPM, mergeConsecutiveNotes, TICKS_PER_BEAT, } from '@/lib/midi-generator'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { freqToMidi, midiToNote } from '@/lib/scale-data'
import type { PitchNote } from './types'

// ── Types ──────────────────────────────────────────────────────

interface StemTrackView {
  label: string
  color: string
  buffer: AudioBuffer | null
  analyserNode: AnalyserNode | null
}

export interface StemMixerCanvasDeps {
  duration: Accessor<number>
  elapsed: Accessor<number>
  windowStart: Accessor<number>
  windowDuration: Accessor<number>
  tracks: Accessor<StemTrackView[]>
  vocal: Accessor<{ buffer: AudioBuffer | null }>
  getPitchHistory: () => PitchNote[]
  getMicPitchHistory: () => PitchNote[]
  micActive: Accessor<boolean>
  currentPitch: Accessor<DetectedPitch | null>
  midiNotes: Accessor<MidiNoteEvent[]>
  seekTo: (time: number) => void
  setWindowStart: Setter<number>
  setWindowDuration: Setter<number>
  PITCH_WINDOW_FILL_RATIO: number
}

export interface StemMixerCanvasController {
  setCanvasRef: (id: string) => (el: HTMLCanvasElement) => void
  formatTime: (secs: number) => string
  syncCanvasSizes: () => void
  drawWaveformOverview: () => void
  drawLiveWaveform: () => void
  drawPitchCanvas: () => void
  drawMidiCanvas: () => void
  redrawAll: () => void
  queueCanvasRedraw: () => void
  handleWaveformClick: (e: MouseEvent) => void
  handleCanvasWheel: (e: WheelEvent) => void
  initObserver: () => ResizeObserver
  reconnectObserver: () => void
  disconnectObserver: () => void
}

// ── Controller ─────────────────────────────────────────────────

export const useStemMixerCanvasController = (
  deps: StemMixerCanvasDeps,
): StemMixerCanvasController => {
  // ── Unified canvas ref map ───────────────────────────────────
  // Single source of truth — SolidJS ref callbacks update the
  // correct entry regardless of which Show block renders them.
  const canvasRefs: Record<string, HTMLCanvasElement | undefined> = {
    overview: undefined,
    live: undefined,
    pitch: undefined,
    midi: undefined,
  }

  const setCanvasRef = (id: string) => (el: HTMLCanvasElement) => {
    canvasRefs[id] = el
  }

  // ── Sizing ───────────────────────────────────────────────────
  const syncCanvasSizes = () => {
    const dpr = window.devicePixelRatio || 1
    for (const ref of Object.values(canvasRefs)) {
      if (!ref) continue
      const rect = ref.getBoundingClientRect()
      const cssW = Math.round(rect.width)
      const cssH = Math.round(rect.height)
      const w = cssW * dpr
      const h = cssH * dpr
      if (ref.width !== w || ref.height !== h) {
        ref.style.width = `${cssW}px`
        ref.style.height = `${cssH}px`
        ref.width = w
        ref.height = h
      }
    }
  }

  // ── Drawing helpers ──────────────────────────────────────────

  const drawWaveformOverview = () => {
    const canvas = canvasRefs.overview
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    const activeTracks = deps.tracks().filter((t) => t.buffer)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length
    const totalDur = deps.duration() || 1
    const winStart = deps.windowStart()
    const winEnd = winStart + deps.windowDuration()

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const buffer = track.buffer!
      const data = buffer.getChannelData(0)
      const totalSamples = data.length

      const visibleStart = Math.floor((winStart / totalDur) * totalSamples)
      const visibleEnd = Math.min(
        totalSamples,
        Math.floor((winEnd / totalDur) * totalSamples),
      )
      const visibleSamples = visibleEnd - visibleStart
      const step = Math.max(1, Math.floor(visibleSamples / w))
      const yOff = ti * trackHeight

      // Center line
      const midY = yOff + trackHeight / 2
      ctx.strokeStyle = `${track.color}40`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()

      // Waveform
      ctx.strokeStyle = track.color
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const start = visibleStart + Math.floor(x * step)
        let min = 1,
          max = -1
        const end = Math.min(Math.floor(start + step), visibleEnd)
        for (let s = start; s < end; s++) {
          const v = data[s]
          if (v < min) min = v
          if (v > max) max = v
        }
        const amp = trackHeight * 0.35
        ctx.moveTo(x, midY + min * amp)
        ctx.lineTo(x, midY + max * amp)
      }
      ctx.stroke()

      // Playhead
      const elapsed = deps.elapsed()
      if (elapsed >= winStart && elapsed <= winEnd) {
        const px = ((elapsed - winStart) / deps.windowDuration()) * w
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px, yOff)
        ctx.lineTo(px, yOff + trackHeight)
        ctx.stroke()
      }

      // Label
      ctx.fillStyle = track.color
      ctx.font = '10px monospace'
      ctx.fillText(track.label, 6, yOff + 14)
    }
  }

  const drawLiveWaveform = () => {
    const canvas = canvasRefs.live
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const activeTracks = deps.tracks().filter((t) => t.analyserNode)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const analyser = track.analyserNode!
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      const yOff = ti * trackHeight
      const midY = yOff + trackHeight / 2

      ctx.strokeStyle = track.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w
        const y = midY + (data[i] / 128 - 1) * (trackHeight * 0.4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.fillStyle = `${track.color}80`
      ctx.font = '9px monospace'
      ctx.fillText(track.label, 4, yOff + 12)
    }
  }

  const drawPitchCanvas = () => {
    const canvas = canvasRefs.pitch
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    if (!deps.vocal().buffer) {
      ctx.fillStyle = '#484f58'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No vocal stem — pitch display unavailable', w / 2, h / 2)
      ctx.textAlign = 'start'
      return
    }

    const notes = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]
    const rowH = h / 13
    ctx.strokeStyle = '#21262d'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 13; i++) {
      const y = i * rowH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#484f58'
    ctx.font = '9px monospace'
    for (let i = 0; i < 12; i++) {
      const note = notes[11 - i]
      ctx.fillText(note, 3, i * rowH + rowH * 0.65 + rowH)
    }

    const winStart = deps.windowStart()
    const winEnd = winStart + deps.windowDuration()
    const winDur = deps.windowDuration()

    const toDetections = (history: PitchNote[]): PitchDetection[] =>
      history.map((p) => ({
        midi: freqToMidi(p.frequency),
        noteName: p.noteName,
        timeSec: p.time,
      }))

    const drawPill = (
      x1: number,
      x2: number,
      y: number,
      pillH: number,
      r: number,
    ) => {
      const pillW = Math.max(x2 - x1, 3)
      ctx.beginPath()
      ctx.moveTo(x1 + r, y)
      ctx.lineTo(x1 + pillW - r, y)
      ctx.arcTo(x1 + pillW, y, x1 + pillW, y + r, r)
      ctx.lineTo(x1 + pillW, y + pillH - r)
      ctx.arcTo(x1 + pillW, y + pillH, x1 + pillW - r, y + pillH, r)
      ctx.lineTo(x1 + r, y + pillH)
      ctx.arcTo(x1, y + pillH, x1, y + pillH - r, r)
      ctx.lineTo(x1, y + r)
      ctx.arcTo(x1, y, x1 + r, y, r)
      ctx.closePath()
    }

    const drawMergedNotes = (
      merged: MergedNote[],
      fillStyle: string,
      strokeStyle?: string,
    ) => {
      for (const n of merged) {
        if (n.endSec < winStart || n.startSec > winEnd) continue
        const noteIdx = notes.indexOf(n.noteName.replace(/\d/g, ''))
        if (noteIdx < 0) continue
        const x1 = Math.max(0, ((n.startSec - winStart) / winDur) * w)
        const x2 = Math.min(w, ((n.endSec - winStart) / winDur) * w)
        const y = (11 - noteIdx) * rowH + rowH * 0.16
        const pillH = rowH * 0.68
        const r = Math.min(pillH / 2, 3)
        drawPill(x1, x2, y, pillH, r)
        ctx.fillStyle = fillStyle
        ctx.fill()
        if (strokeStyle !== undefined) {
          ctx.strokeStyle = strokeStyle
          ctx.lineWidth = 1.5
          ctx.setLineDash([3, 3])
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    }

    const vocalPills = mergeConsecutiveNotes(
      toDetections(deps.getPitchHistory()),
    )
    drawMergedNotes(vocalPills, 'rgba(245, 158, 11, 0.5)')

    const micHistory = deps.getMicPitchHistory()
    if (deps.micActive() && micHistory.length > 0) {
      const micPills = mergeConsecutiveNotes(toDetections(micHistory))
      drawMergedNotes(micPills, 'transparent', '#ff6b8a')
    }

    // Diff bars
    const pitchHistory = deps.getPitchHistory()
    const TOLERANCE_CENTS = 50
    if (deps.micActive() && pitchHistory.length > 0 && micHistory.length > 0) {
      let vi = 0
      let mi = 0
      let lastDiffX = -999
      while (vi < pitchHistory.length && mi < micHistory.length) {
        const vt = pitchHistory[vi].time
        const mt = micHistory[mi].time

        if (Math.abs(vt - mt) < 0.06) {
          const vocalNoteIdx = notes.indexOf(
            pitchHistory[vi].noteName.replace(/\d/g, ''),
          )
          const micNoteIdx = notes.indexOf(
            micHistory[mi].noteName.replace(/\d/g, ''),
          )
          if (
            vocalNoteIdx >= 0 &&
            micNoteIdx >= 0 &&
            vt >= winStart &&
            vt <= winEnd
          ) {
            const x = ((vt - winStart) / winDur) * w
            if (x - lastDiffX > 3) {
              lastDiffX = x
              const vocalY = (11 - vocalNoteIdx) * rowH + rowH * 0.5
              const micY = (11 - micNoteIdx) * rowH + rowH * 0.5
              const centsOff =
                1200 *
                Math.log2(micHistory[mi].frequency / pitchHistory[vi].frequency)
              const absOff = Math.abs(centsOff)

              ctx.strokeStyle =
                absOff <= TOLERANCE_CENTS
                  ? 'rgba(96, 208, 128, 0.55)'
                  : absOff <= TOLERANCE_CENTS * 2
                    ? 'rgba(224, 192, 80, 0.5)'
                    : 'rgba(248, 81, 73, 0.45)'
              ctx.lineWidth = 1.2
              ctx.beginPath()
              ctx.moveTo(x, Math.min(vocalY, micY))
              ctx.lineTo(x, Math.max(vocalY, micY))
              ctx.stroke()
            }
          }
          vi++
          mi++
        } else if (vt < mt) {
          vi++
        } else {
          mi++
        }
      }
    }

    // Current pitch highlight
    const cp = deps.currentPitch()
    if (cp && cp.frequency > 0) {
      const elapsedTime = deps.elapsed()
      const noteIdx = notes.indexOf(cp.noteName.replace(/\d/g, ''))
      if (noteIdx >= 0 && elapsedTime >= winStart && elapsedTime <= winEnd) {
        const x = ((elapsedTime - winStart) / winDur) * w
        const y = (11 - noteIdx) * rowH + rowH * 0.5

        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = 12
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px monospace'
        ctx.fillText(
          `${cp.noteName}${cp.octave}`,
          Math.min(x + 10, w - 40),
          y + 4,
        )
      }
    }

    // Playhead
    const elapsedTime = deps.elapsed()
    if (elapsedTime >= winStart && elapsedTime <= winEnd) {
      const px = ((elapsedTime - winStart) / winDur) * w
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  const drawMidiCanvas = () => {
    const canvas = canvasRefs.midi
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const notes = deps.midiNotes()
    if (notes.length === 0) {
      ctx.fillStyle = '#484f58'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('MIDI notes will appear here', w / 2, h / 2)
      ctx.textAlign = 'start'
      return
    }

    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]
    const rowH = h / 13
    ctx.strokeStyle = '#21262d'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 13; i++) {
      const y = i * rowH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#484f58'
    ctx.font = '9px monospace'
    for (let i = 0; i < 12; i++) {
      const note = noteNames[11 - i]
      ctx.fillText(note, 3, i * rowH + rowH * 0.65 + rowH)
    }

    const midiMin = 38
    const midiMax = 96
    const midiRange = midiMax - midiMin

    const midiToY = (midi: number): number => {
      const t = (midi - midiMin) / midiRange
      return (1 - t) * (h - rowH) + rowH * 0.5
    }

    const dur = deps.duration()
    if (dur <= 0) return

    const winStart = deps.windowStart()
    const winEnd = winStart + deps.windowDuration()
    const winDur = deps.windowDuration()

    type Pill = { midi: number; startSec: number; endSec: number }
    const pills: Pill[] = []
    if (notes.length > 0) {
      const ticksPerSec = TICKS_PER_BEAT * (DEFAULT_BPM / 60)
      let cur: Pill = {
        midi: notes[0].midi,
        startSec: notes[0].tickOn / ticksPerSec,
        endSec: notes[0].tickOff / ticksPerSec,
      }
      for (let i = 1; i < notes.length; i++) {
        const s = notes[i].tickOn / ticksPerSec
        const e = notes[i].tickOff / ticksPerSec
        if (notes[i].midi === cur.midi && s - cur.endSec < 0.02) {
          cur.endSec = e
        } else {
          pills.push({ ...cur })
          cur = { midi: notes[i].midi, startSec: s, endSec: e }
        }
      }
      pills.push({ ...cur })
    }

    for (const p of pills) {
      if (p.endSec < winStart || p.startSec > winEnd) continue
      const x1 = Math.max(0, ((p.startSec - winStart) / winDur) * w)
      const x2 = Math.min(w, ((p.endSec - winStart) / winDur) * w)
      const pillW = Math.max(x2 - x1, 3)
      const y = midiToY(p.midi) - rowH * 0.34
      const pillH = rowH * 0.68
      const r = Math.min(pillH / 2, 3)

      ctx.beginPath()
      ctx.moveTo(x1 + r, y)
      ctx.lineTo(x1 + pillW - r, y)
      ctx.arcTo(x1 + pillW, y, x1 + pillW, y + r, r)
      ctx.lineTo(x1 + pillW, y + pillH - r)
      ctx.arcTo(x1 + pillW, y + pillH, x1 + pillW - r, y + pillH, r)
      ctx.lineTo(x1 + r, y + pillH)
      ctx.arcTo(x1, y + pillH, x1, y + pillH - r, r)
      ctx.lineTo(x1, y + r)
      ctx.arcTo(x1, y, x1 + r, y, r)
      ctx.closePath()
      ctx.fillStyle = 'rgba(139, 92, 246, 0.55)'
      ctx.fill()

      if (pillW > 24) {
        const noteInfo = midiToNote(p.midi)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        const label = `${noteInfo.name}${noteInfo.octave}`
        ctx.fillText(label, x1 + pillW / 2, y + pillH / 2 + 3)
        ctx.textAlign = 'start'
      }
    }

    // Playhead
    const elapsedTime = deps.elapsed()
    if (elapsedTime >= winStart && elapsedTime <= winEnd) {
      const px = ((elapsedTime - winStart) / winDur) * w
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // ── Public draw orchestration ─────────────────────────────────

  const redrawAll = () => {
    syncCanvasSizes()
    drawWaveformOverview()
    drawLiveWaveform()
    drawPitchCanvas()
    drawMidiCanvas()
  }

  const queueCanvasRedraw = () => {
    requestAnimationFrame(redrawAll)
  }

  // ── Interaction handlers ──────────────────────────────────────

  const handleWaveformClick = (e: MouseEvent) => {
    const canvas = canvasRefs.overview
    if (!canvas || !deps.duration()) return
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const winStart = deps.windowStart()
    const newTime = winStart + ratio * deps.windowDuration()
    deps.seekTo(newTime)
    deps.setWindowStart(
      Math.max(
        0,
        newTime - deps.windowDuration() * deps.PITCH_WINDOW_FILL_RATIO,
      ),
    )
  }

  const handleCanvasWheel = (e: WheelEvent) => {
    e.preventDefault()
    const canvas = e.currentTarget as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const mouseX = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    )
    const mouseTime = deps.windowStart() + mouseX * deps.windowDuration()
    const delta = e.deltaY > 0 ? 5 : -5
    const newDuration = Math.max(
      10,
      Math.min(150, deps.windowDuration() + delta),
    )
    if (newDuration === deps.windowDuration()) return
    const newStart = Math.max(0, mouseTime - mouseX * newDuration)
    deps.setWindowDuration(newDuration)
    deps.setWindowStart(newStart)
    redrawAll()
  }

  // ── Formatting ────────────────────────────────────────────────

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── ResizeObserver lifecycle ──────────────────────────────────

  let observer: ResizeObserver | null = null

  const initObserver = (): ResizeObserver => {
    observer = new ResizeObserver(redrawAll)
    for (const ref of Object.values(canvasRefs)) {
      if (ref) observer.observe(ref)
    }
    return observer
  }

  const reconnectObserver = () => {
    if (!observer) return
    observer.disconnect()
    // Double-rAF ensures the browser has completed layout and
    // SolidJS ref callbacks have fired before we measure and redraw.
    const obs = observer
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const ref of Object.values(canvasRefs)) {
          if (ref) obs.observe(ref)
        }
        redrawAll()
      })
    })
  }

  const disconnectObserver = () => {
    observer?.disconnect()
    observer = null
  }

  return {
    setCanvasRef,
    formatTime,
    syncCanvasSizes,
    drawWaveformOverview,
    drawLiveWaveform,
    drawPitchCanvas,
    drawMidiCanvas,
    redrawAll,
    queueCanvasRedraw,
    handleWaveformClick,
    handleCanvasWheel,
    initObserver,
    reconnectObserver,
    disconnectObserver,
  }
}
