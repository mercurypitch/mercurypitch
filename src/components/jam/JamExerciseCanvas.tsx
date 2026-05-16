// ── JamExerciseCanvas ─────────────────────────────────────────────────
// Piano-roll canvas for shared exercise. Shows melody notes as filled
// rectangles with peer pitch dots overlaid and a playhead line.

import type { Component } from 'solid-js'
import { createMemo, onCleanup, onMount } from 'solid-js'
import { jamExerciseBeat, jamExerciseMelody, jamExercisePlaying, jamExerciseTotalBeats, jamPitchHistory, } from '@/stores/jam-store'

const PEER_COLORS = [
  '#58a6ff',
  '#f0883e',
  '#3fb950',
  '#d2a8ff',
  '#f778ba',
  '#ffa657',
  '#7ee787',
  '#a5d6ff',
]

const MARGIN_LEFT = 40
const MARGIN_RIGHT = 20
const MARGIN_TOP = 16
const MARGIN_BOTTOM = 20
const DOT_RADIUS = 2.5
const GLOW_RADIUS = 14

interface JamExerciseCanvasProps {
  myPeerId: () => string | null
}

export const JamExerciseCanvas: Component<JamExerciseCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const peerColorMap = createMemo(() => {
    const history = jamPitchHistory()
    const peerIds = Object.keys(history)
    const map: Record<string, string> = {}
    peerIds.forEach((id, i) => {
      map[id] = PEER_COLORS[i % PEER_COLORS.length]!
    })
    return map
  })

  const melodyNotes = createMemo(() => {
    const melody = jamExerciseMelody()
    if (!melody) return []
    return melody.items
      .filter((item) => item.isRest !== true)
      .map((item) => ({
        startBeat: item.startBeat,
        endBeat: item.startBeat + item.duration,
        midi: item.note.midi,
        noteName: item.note.name,
        octave: item.note.octave,
        id: item.id,
      }))
  })

  // MIDI range for display — find min/max from melody, pad by one octave
  const midiRange = createMemo(() => {
    const notes = melodyNotes()
    const totalBeats = jamExerciseTotalBeats()
    if (notes.length === 0)
      return { min: 48, max: 72, totalBeats: Math.max(totalBeats, 16) }
    const min = Math.min(...notes.map((n) => n.midi))
    const max = Math.max(...notes.map((n) => n.midi))
    return {
      min: Math.max(24, min - 6),
      max: Math.min(108, max + 6),
      totalBeats: Math.max(totalBeats, 16),
    }
  })

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()
    startDrawLoop()

    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvasRef.parentElement!)

    onCleanup(() => {
      resizeObserver?.disconnect()
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
    })
  })

  const resizeCanvas = () => {
    if (!canvasRef || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.parentElement!.clientWidth
    const h = canvasRef.parentElement!.clientHeight
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = `${w}px`
    canvasRef.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const midiToY = (
    midi: number,
    h: number,
    minMidi: number,
    maxMidi: number,
  ) => {
    const range = maxMidi - minMidi
    const pct = (midi - minMidi) / range
    return h - MARGIN_BOTTOM - pct * (h - MARGIN_TOP - MARGIN_BOTTOM)
  }

  const beatToX = (beat: number, w: number, totalBeats: number) => {
    const x =
      MARGIN_LEFT + (beat / totalBeats) * (w - MARGIN_LEFT - MARGIN_RIGHT)
    return x
  }

  const startDrawLoop = () => {
    const draw = () => {
      if (!ctx || !canvasRef) return
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)

      const { min, max, totalBeats } = midiRange()

      drawGrid(w, h, min, max)
      drawMelodyNotes(w, h, min, max, totalBeats)
      drawPlayhead(w, h, min, max, totalBeats)
      drawPeerPitchDots(w, h, min, max, totalBeats)
      drawPrecount(w, h)

      animFrameId = requestAnimationFrame(draw)
    }
    animFrameId = requestAnimationFrame(draw)
  }

  const drawGrid = (w: number, h: number, minMidi: number, maxMidi: number) => {
    if (!ctx) return

    // MIDI grid lines (every 2 semitones)
    ctx.strokeStyle = 'rgba(48,54,61,0.5)'
    ctx.lineWidth = 0.5
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const y = midiToY(midi, h, minMidi, maxMidi)
      ctx.beginPath()
      ctx.moveTo(MARGIN_LEFT, y)
      ctx.lineTo(w - MARGIN_RIGHT, y)
      ctx.stroke()
    }

    // MIDI labels (every octave)
    const midiNames = [
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
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      if (midi % 12 !== 0) continue
      const y = midiToY(midi, h, minMidi, maxMidi)
      const name = midiNames[midi % 12]!
      const octave = Math.floor(midi / 12) - 1
      ctx.fillStyle = '#484f58'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${name}${octave}`, MARGIN_LEFT - 4, y)
    }
  }

  const drawMelodyNotes = (
    w: number,
    h: number,
    minMidi: number,
    maxMidi: number,
    totalBeats: number,
  ) => {
    if (!ctx) return
    const notes = melodyNotes()
    if (notes.length === 0) return

    const noteHeight =
      ((h - MARGIN_TOP - MARGIN_BOTTOM) / (maxMidi - minMidi)) * 0.7

    for (const note of notes) {
      const x = beatToX(note.startBeat, w, totalBeats)
      const width = Math.max(
        2,
        ((note.endBeat - note.startBeat) / totalBeats) *
          (w - MARGIN_LEFT - MARGIN_RIGHT),
      )
      const boxH = Math.max(16, noteHeight)
      const boxHalf = boxH / 2
      const r = 5 // corner radius
      const yy = midiToY(note.midi + 0.5, h, minMidi, maxMidi) - boxHalf

      // Solid dark base
      ctx.beginPath()
      ctx.roundRect(x, yy, width, boxH, r)
      ctx.fillStyle = 'rgba(13,17,23,0.92)'
      ctx.fill()

      // Gradient fill
      const fillGrad = ctx.createLinearGradient(0, yy, 0, yy + boxH)
      fillGrad.addColorStop(0, 'rgba(60,110,190,0.75)')
      fillGrad.addColorStop(1, 'rgba(35,70,130,0.6)')
      ctx.fillStyle = fillGrad
      ctx.fill()

      // Outer stroke
      ctx.strokeStyle = 'rgba(88,166,255,0.65)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Note label if space permits
      if (width >= 24) {
        ctx.fillStyle = 'rgba(220,235,255,0.92)'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const label = `${note.noteName}${note.octave}`
        ctx.fillText(label, x + 6, yy + boxHalf + 0.5)
        ctx.textBaseline = 'alphabetic'
      }
    }
  }

  const drawPlayhead = (
    w: number,
    h: number,
    _minMidi: number,
    _maxMidi: number,
    totalBeats: number,
  ) => {
    if (!ctx) return
    const beat = jamExerciseBeat()
    const playing = jamExercisePlaying()
    if (beat === 0 && !playing) return

    const x = beatToX(beat, w, totalBeats)
    if (x < MARGIN_LEFT || x > w - MARGIN_RIGHT) return

    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, MARGIN_TOP)
    ctx.lineTo(x, h - MARGIN_BOTTOM)
    ctx.stroke()
    ctx.setLineDash([])

    // Beat label
    ctx.fillStyle = '#e6edf3'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${beat.toFixed(1)}`, x, h - 4)
  }

  const drawPeerPitchDots = (
    w: number,
    h: number,
    minMidi: number,
    maxMidi: number,
    totalBeats: number,
  ) => {
    if (!ctx) return

    const history = jamPitchHistory()
    const colors = peerColorMap()
    const myId = props.myPeerId()
    const now = Date.now()
    const playheadX = beatToX(jamExerciseBeat(), w, totalBeats)

    for (const [peerId, samples] of Object.entries(history)) {
      const color = colors[peerId] ?? PEER_COLORS[0]!
      const isOwn = peerId === myId

      if (isOwn) {
        drawOwnPitchTrail(
          w,
          h,
          minMidi,
          maxMidi,
          samples,
          color,
          now,
          playheadX,
        )
      } else {
        // Remote peers: small dots near playhead
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i]!
          if (now - s.timestamp > 2000) continue
          if (s.frequency <= 0 || s.midi <= 0) continue

          const age = (now - s.timestamp) / 2000
          const dotX = playheadX - age * 30
          const y = midiToY(s.midi, h, minMidi, maxMidi)

          if (dotX < MARGIN_LEFT || y < MARGIN_TOP || y > h - MARGIN_BOTTOM)
            continue

          const alpha = 0.12 + s.clarity * 0.4
          ctx.fillStyle = hexToRgba(color, alpha)
          ctx.beginPath()
          ctx.arc(dotX, y, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  const drawOwnPitchTrail = (
    w: number,
    h: number,
    minMidi: number,
    maxMidi: number,
    samples: Array<{
      frequency: number
      midi: number
      cents: number
      clarity: number
      noteName: string
      timestamp: number
    }>,
    color: string,
    now: number,
    playheadX: number,
  ) => {
    if (!ctx) return

    // Filter recent valid samples (last 2 seconds)
    const recent = samples.filter(
      (s) => now - s.timestamp <= 2000 && s.frequency > 0 && s.midi > 0,
    )
    if (recent.length === 0) return

    // ── Pitch trail line ──
    ctx.lineWidth = 2
    ctx.strokeStyle = hexToRgba(color, 0.55)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    let started = false
    for (let i = 0; i < recent.length - 1; i++) {
      const s = recent[i]!
      const age = (now - s.timestamp) / 2000
      const x = playheadX - age * 30
      const y = midiToY(s.midi, h, minMidi, maxMidi)
      if (x < MARGIN_LEFT || y < MARGIN_TOP || y > h - MARGIN_BOTTOM) {
        started = false
        continue
      }
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    // ── Latest point: glow + dot + note pill ──
    const latest = recent[recent.length - 1]!
    const ly = midiToY(latest.midi, h, minMidi, maxMidi)
    // Latest point always at playhead
    const lx = playheadX

    if (lx < MARGIN_LEFT || ly < MARGIN_TOP || ly > h - MARGIN_BOTTOM) return

    // Glow
    const glowAlpha = 0.2 + latest.clarity * 0.3
    const glowGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, GLOW_RADIUS)
    glowGrad.addColorStop(0, hexToRgba(color, glowAlpha))
    glowGrad.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(lx, ly, GLOW_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Inner dot
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(lx, ly, DOT_RADIUS + 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(lx, ly, DOT_RADIUS - 1, 0, Math.PI * 2)
    ctx.fill()

    // Note name pill
    const label = `${latest.noteName}`
    ctx.font = 'bold 11px sans-serif'
    const tw = ctx.measureText(label).width
    const pillPad = 5
    const pillW = tw + pillPad * 2
    const pillH = 18
    const pillX = lx + 10
    const pillY = ly - pillH / 2

    // Keep pill in bounds
    let adjPillX = pillX
    if (adjPillX + pillW > w - MARGIN_RIGHT) adjPillX = lx - pillW - 10

    ctx.beginPath()
    ctx.roundRect(adjPillX, pillY, pillW, pillH, pillH / 2)
    ctx.fillStyle = hexToRgba(color, 0.6)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(color, 0.85)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, adjPillX + pillW / 2, pillY + pillH / 2 + 0.5)
    ctx.textBaseline = 'alphabetic'
  }

  const drawPrecount = (w: number, h: number) => {
    if (!ctx) return
    const beat = jamExerciseBeat()
    if (beat >= 0) return

    const num = Math.ceil(Math.abs(beat))
    if (num <= 0) return

    ctx.fillStyle = 'rgba(13, 17, 23, 0.6)'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Pulse animation based on fractional beat
    const fract = Math.abs(beat) % 1
    const scale = 1 + (1 - fract) * 0.2

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(scale, scale)
    ctx.fillText(num.toString(), 0, 0)
    ctx.restore()
  }

  return <canvas ref={canvasRef} />
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
