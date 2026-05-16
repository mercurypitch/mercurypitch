// ── JamExerciseCanvas ─────────────────────────────────────────────────
// Piano-roll canvas for shared exercise. Shows melody notes as filled
// rectangles with peer pitch dots overlaid and a playhead line.

import type { Component } from 'solid-js'
import { createMemo, onCleanup, onMount } from 'solid-js'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamExerciseBeat, jamExerciseMelody, jamExercisePlaying, jamExerciseTotalBeats, jamPeers, jamPitchHistory, } from '@/stores/jam-store'

const MARGIN_LEFT = 40
const MARGIN_RIGHT = 20
const MARGIN_TOP = 16
const MARGIN_BOTTOM = 20
const DOT_RADIUS = 2.5
const GLOW_RADIUS = 14
// Playhead pinned at this fraction of the drawable width
const PLAYHEAD_PCT = 0.6

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
    return buildPeerColorMap(peerIds)
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

  // MIDI range for display — find min/max from melody, pad by one full octave
  // so pitch trails are never clipped when singing slightly off the target notes.
  const midiRange = createMemo(() => {
    const notes = melodyNotes()
    const totalBeats = jamExerciseTotalBeats()
    if (notes.length === 0)
      return { min: 48, max: 84, totalBeats: Math.max(totalBeats, 16) }
    const min = Math.min(...notes.map((n) => n.midi))
    const max = Math.max(...notes.map((n) => n.midi))
    return {
      min: Math.max(24, min - 12),
      max: Math.min(108, max + 12),
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

  const beatToX = (
    beat: number,
    w: number,
    totalBeats: number,
    currentBeat: number,
  ) => {
    const drawW = w - MARGIN_LEFT - MARGIN_RIGHT
    const playheadX = MARGIN_LEFT + drawW * PLAYHEAD_PCT
    const pxPerBeat = drawW / Math.max(totalBeats, 16)
    return playheadX + (beat - currentBeat) * pxPerBeat
  }

  const startDrawLoop = () => {
    const draw = () => {
      if (!ctx || !canvasRef) return
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)

      // Read all signals once per frame (rAF runs outside reactive graph)
      const { min, max, totalBeats } = midiRange()
      const currentBeat = jamExerciseBeat()

      drawGrid(w, h, min, max, totalBeats, currentBeat)
      drawMelodyNotes(w, h, min, max, totalBeats, currentBeat)
      drawAllPeerPitchTrails(w, h, min, max, totalBeats, currentBeat)
      drawPlayhead(w, h, min, max, totalBeats, currentBeat)
      drawScoreboard(w, h, min, max, totalBeats, currentBeat)
      drawPeerLegend(w, h)
      drawPrecount(w, h, currentBeat)

      animFrameId = requestAnimationFrame(draw)
    }
    animFrameId = requestAnimationFrame(draw)
  }

  const drawGrid = (
    w: number,
    h: number,
    minMidi: number,
    maxMidi: number,
    _totalBeats: number,
    _currentBeat: number,
  ) => {
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
    currentBeat: number,
  ) => {
    if (!ctx) return
    const notes = melodyNotes()
    if (notes.length === 0) return

    const noteHeight =
      ((h - MARGIN_TOP - MARGIN_BOTTOM) / (maxMidi - minMidi)) * 0.7

    for (const note of notes) {
      const x = beatToX(note.startBeat, w, totalBeats, currentBeat)
      const width = Math.max(
        2,
        ((note.endBeat - note.startBeat) * (w - MARGIN_LEFT - MARGIN_RIGHT)) /
          Math.max(totalBeats, 16),
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
    currentBeat: number,
  ) => {
    if (!ctx) return
    const playing = jamExercisePlaying()
    if (currentBeat === 0 && !playing) return

    const x = beatToX(currentBeat, w, totalBeats, currentBeat)
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
    ctx.fillText(`${currentBeat.toFixed(1)}`, x, h - 4)
  }

  // ── Draw pitch trails for ALL peers (own + remote) ──────────────────
  const drawAllPeerPitchTrails = (
    w: number,
    h: number,
    minMidi: number,
    maxMidi: number,
    totalBeats: number,
    currentBeat: number,
  ) => {
    if (!ctx) return

    const history = jamPitchHistory()
    const colors = peerColorMap()
    const myId = props.myPeerId()
    const now = Date.now()
    const melody = jamExerciseMelody()
    const bpm = melody?.bpm ?? 120

    // Draw remote peers first so own pitch renders on top
    for (const [peerId, samples] of Object.entries(history)) {
      if (peerId === myId) continue
      const color = colors[peerId] ?? '#58a6ff'
      drawPitchTrail(
        w,
        h,
        minMidi,
        maxMidi,
        samples,
        color,
        now,
        currentBeat,
        bpm,
        totalBeats,
        false,
      )
    }

    // Draw own pitch on top
    if (myId !== null && myId in history) {
      const color = colors[myId] ?? '#58a6ff'
      drawPitchTrail(
        w,
        h,
        minMidi,
        maxMidi,
        history[myId]!,
        color,
        now,
        currentBeat,
        bpm,
        totalBeats,
        true,
      )
    }
  }

  // ── Pitch trail for any peer ──────────────────────────────────────
  const drawPitchTrail = (
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
    currentBeat: number,
    bpm: number,
    totalBeats: number,
    isOwn: boolean,
  ) => {
    if (!ctx) return

    // Keep last 4 seconds of samples
    const windowMs = 4000
    const recent = samples.filter(
      (s) => now - s.timestamp <= windowMs && s.frequency > 0 && s.midi > 0,
    )
    if (recent.length === 0) return

    // If the newest sample is older than 600 ms the mic is silent — skip
    // drawing entirely so no ghost trail remains on screen.
    const latest = recent[recent.length - 1]!
    const latestAgeMs = now - latest.timestamp
    if (latestAgeMs > 600) return

    // Convert timestamp → beat position on canvas
    // A sample taken T ms ago was at beat (currentBeat - T/1000 * bpm/60)
    const beatsPerMs = bpm / 60 / 1000
    const sampleToX = (s: { timestamp: number }) => {
      const ageMs = now - s.timestamp
      const beatPos = currentBeat - ageMs * beatsPerMs
      return beatToX(beatPos, w, totalBeats, currentBeat)
    }

    // ── Trail line ──
    ctx.lineWidth = isOwn ? 2.5 : 1.8
    ctx.strokeStyle = hexToRgba(color, isOwn ? 0.75 : 0.5)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    let started = false
    for (let i = 0; i < recent.length; i++) {
      const s = recent[i]!
      const x = sampleToX(s)
      const y = midiToY(s.midi, h, minMidi, maxMidi)
      if (
        x < MARGIN_LEFT ||
        x > w - MARGIN_RIGHT ||
        y < MARGIN_TOP ||
        y > h - MARGIN_BOTTOM
      ) {
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

    // ── Latest dot + glow at playhead position ──

    const lx = beatToX(currentBeat, w, totalBeats, currentBeat)
    const ly = midiToY(latest.midi, h, minMidi, maxMidi)

    if (lx < MARGIN_LEFT || ly < MARGIN_TOP || ly > h - MARGIN_BOTTOM) return

    // Glow
    const glowR = isOwn ? GLOW_RADIUS : GLOW_RADIUS * 0.7
    const glowAlpha = (isOwn ? 0.28 : 0.18) + latest.clarity * 0.22
    const glowGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, glowR)
    glowGrad.addColorStop(0, hexToRgba(color, glowAlpha))
    glowGrad.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(lx, ly, glowR, 0, Math.PI * 2)
    ctx.fill()

    // Dot
    const dotSize = isOwn ? DOT_RADIUS + 2 : DOT_RADIUS + 1
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(lx, ly, dotSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = isOwn ? '#fff' : hexToRgba('#ffffff', 0.75)
    ctx.beginPath()
    ctx.arc(lx, ly, dotSize - 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Note pill
    if (isOwn || latest.clarity > 0.6) {
      const label = `${latest.noteName}`
      ctx.font = `${isOwn ? 'bold' : ''} 11px sans-serif`
      const tw = ctx.measureText(label).width
      const pillPad = 5
      const pillW = tw + pillPad * 2
      const pillH = 18
      const pillX = lx + 10
      const pillY = ly - pillH / 2

      let adjPillX = pillX
      if (adjPillX + pillW > w - MARGIN_RIGHT) adjPillX = lx - pillW - 10

      ctx.beginPath()
      ctx.roundRect(adjPillX, pillY, pillW, pillH, pillH / 2)
      ctx.fillStyle = hexToRgba(color, isOwn ? 0.75 : 0.55)
      ctx.fill()
      ctx.strokeStyle = hexToRgba(color, 0.9)
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, adjPillX + pillW / 2, pillY + pillH / 2 + 0.5)
      ctx.textBaseline = 'alphabetic'
    }
  }

  // ── Peer legend ──────────────────────────────────────────────────────
  const drawPeerLegend = (w: number, _h: number) => {
    if (!ctx) return
    const history = jamPitchHistory()
    const colors = peerColorMap()
    const myId = props.myPeerId()
    const peers = jamPeers()
    const ids = Object.keys(history)
    if (ids.length === 0) return

    const dotR = 5
    const rowH = 18
    const padX = 8
    const padY = 6
    const startY = MARGIN_TOP + padY

    ctx.font = '10px sans-serif'

    let offsetX = MARGIN_LEFT + padX

    for (const id of ids) {
      const color = colors[id] ?? '#58a6ff'
      const isOwn = id === myId
      const name = isOwn
        ? 'You'
        : (peers.find((p) => p.id === id)?.displayName ?? id.slice(0, 6))

      // Dot
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(offsetX + dotR, startY + rowH / 2, dotR, 0, Math.PI * 2)
      ctx.fill()

      // Name
      const labelX = offsetX + dotR * 2 + 4
      const nameW = ctx.measureText(name).width

      // Background pill
      ctx.fillStyle = 'rgba(13,17,23,0.7)'
      ctx.beginPath()
      ctx.roundRect(labelX - 2, startY + 2, nameW + 4, rowH - 4, 3)
      ctx.fill()

      ctx.fillStyle = isOwn ? color : 'rgba(200,210,220,0.85)'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, labelX, startY + rowH / 2)

      offsetX += dotR * 2 + nameW + 16
      if (offsetX > w - MARGIN_RIGHT - 40) break // avoid overflow
    }
    ctx.textBaseline = 'alphabetic'
  }

  // ── Per-peer scoring overlay ──────────────────────────────────────────
  // Computes how accurately each peer hit the target notes.
  // A pitch sample is counted as a "hit" if it is within 50 cents of the
  // note that was active at that timestamp.
  const drawScoreboard = (
    w: number,
    _h: number,
    _minMidi: number,
    _maxMidi: number,
    totalBeats: number,
    currentBeat: number,
  ) => {
    if (!ctx) return
    const c = ctx
    const playing = jamExercisePlaying()
    if (!playing && currentBeat === 0) return // idle

    const history = jamPitchHistory()
    const colors = peerColorMap()
    const myId = props.myPeerId()
    const peers = jamPeers()
    const notes = melodyNotes()
    const melody = jamExerciseMelody()
    const bpm = melody?.bpm ?? 120
    const ids = Object.keys(history)
    if (ids.length === 0 || notes.length === 0) return

    // Build a sorted note array for fast lookup
    const sortedNotes = [...notes].sort((a, b) => a.startBeat - b.startBeat)

    const getNoteAtBeat = (beat: number) => {
      for (const note of sortedNotes) {
        if (beat >= note.startBeat && beat < note.endBeat) return note
      }
      return null
    }

    const beatsPerMs = bpm / 60 / 1000

    interface Score {
      name: string
      hits: number
      total: number
      color: string
    }

    const scores: Score[] = []

    for (const id of ids) {
      const samples = history[id] ?? []
      const color = colors[id] ?? '#58a6ff'
      const isOwn = id === myId
      const name = isOwn
        ? 'You'
        : (peers.find((p) => p.id === id)?.displayName ?? id.slice(0, 6))

      let hits = 0
      let total = 0

      for (const s of samples) {
        if (s.frequency <= 0 || s.midi <= 0) continue
        // Estimate what beat this sample corresponds to
        const ageMs = Date.now() - s.timestamp
        const sampleBeat = currentBeat - ageMs * beatsPerMs
        if (sampleBeat < 0 || sampleBeat > totalBeats) continue

        const note = getNoteAtBeat(sampleBeat)
        if (!note) continue

        total++
        const centsDiff = Math.abs((s.midi - note.midi) * 100 + s.cents)
        if (centsDiff <= 50) hits++
      }

      scores.push({ name, hits, total, color })
    }

    if (scores.length === 0) return

    // Sort by accuracy descending
    scores.sort((a, b) => {
      const aRate = a.total === 0 ? 0 : a.hits / a.total
      const bRate = b.total === 0 ? 0 : b.hits / b.total
      return bRate - aRate
    })

    // Draw scoreboard panel — right edge of canvas
    const rowH = 22
    const panelW = 130
    const panelPad = 8
    const panelX = w - MARGIN_RIGHT - panelW
    const panelY = MARGIN_TOP + 2
    const panelH = scores.length * rowH + panelPad * 2

    // Panel background
    ctx.fillStyle = 'rgba(13,17,23,0.78)'
    ctx.beginPath()
    ctx.roundRect(panelX, panelY, panelW, panelH, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    c.font = '10px sans-serif'

    scores.forEach((score, i) => {
      const rowY = panelY + panelPad + i * rowH
      const accuracy = score.total === 0 ? 0 : score.hits / score.total
      const pct = Math.round(accuracy * 100)

      // Color dot
      const dotR = 4
      c.fillStyle = score.color
      c.beginPath()
      c.arc(panelX + panelPad + dotR, rowY + rowH / 2, dotR, 0, Math.PI * 2)
      c.fill()

      // Name
      c.fillStyle = 'rgba(200,210,220,0.85)'
      c.textAlign = 'left'
      c.textBaseline = 'middle'
      const maxNameW = 52
      let name = score.name
      if (c.measureText(name).width > maxNameW) {
        while (
          c.measureText(`${name}\u2026`).width > maxNameW &&
          name.length > 0
        ) {
          name = name.slice(0, -1)
        }
        name += '\u2026'
      }
      c.fillText(name, panelX + panelPad + dotR * 2 + 4, rowY + rowH / 2)

      // Bar background
      const barX = panelX + panelPad + dotR * 2 + 4 + maxNameW + 2
      const barW = panelW - panelPad - (barX - panelX) - panelPad
      const barH = 6
      const barY = rowY + rowH / 2 - barH / 2

      c.fillStyle = 'rgba(255,255,255,0.08)'
      c.beginPath()
      c.roundRect(barX, barY, barW, barH, 3)
      c.fill()

      // Bar fill — green > 80%, amber > 50%, red below
      const fillColor =
        pct >= 80 ? '#3fb950' : pct >= 50 ? '#e3a221' : '#f85149'
      c.fillStyle = hexToRgba(fillColor, 0.85)
      c.beginPath()
      c.roundRect(barX, barY, Math.max(4, barW * accuracy), barH, 3)
      c.fill()

      // Pct text
      c.fillStyle = 'rgba(200,210,220,0.7)'
      c.font = 'bold 9px sans-serif'
      c.textAlign = 'right'
      c.fillText(`${pct}%`, panelX + panelW - panelPad, rowY + rowH / 2)
      c.font = '10px sans-serif'
    })

    ctx.textBaseline = 'alphabetic'
  }

  const drawPrecount = (w: number, h: number, currentBeat: number) => {
    if (!ctx) return
    if (currentBeat >= 0) return

    const num = Math.ceil(Math.abs(currentBeat))
    if (num <= 0) return

    ctx.fillStyle = 'rgba(13, 17, 23, 0.6)'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Pulse animation based on fractional beat
    const fract = Math.abs(currentBeat) % 1
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
