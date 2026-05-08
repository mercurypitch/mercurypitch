// ============================================================
// FallingNotesCanvas — Synthesia-style falling notes visualization
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { FallingNote, NoteJudgment } from '@/stores/falling-notes-store'
import { setVisibleBeatWindow, showNoteLabels } from '@/stores/falling-notes-store'

interface FallingNotesCanvasProps {
  songNotes: () => FallingNote[]
  gameState: () => string
  playheadBeat: () => number
  hitResults: () => NoteJudgment[]
  combo: () => number
  score: () => number
  totalNotes: () => number
  notesMissed: () => number
  currentPitch: () => { frequency: number; noteName: string; octave: number; cents: number } | null
  isMicActive: () => boolean
  inputMode?: () => 'mic' | 'midi'
  visibleBeatWindow?: () => number
  midiHeldNotes?: () => { midi: number; velocity: number }[]
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  color: string
  size: number
  life: number
  maxLife: number
}

const JUDGMENT_LINE_RATIO = 0.82
const KEYBOARD_START_RATIO = 0.85
const BLACK_KEY_HEIGHT_RATIO = 0.6
const BLACK_KEY_WIDTH_RATIO = 0.58
const MIN_WHITE_KEYS_VISIBLE = 15
const NOTE_BORDER_RADIUS = 8
const PARTICLE_BURST_COUNT = 24

const WHITE_KEY_OFFSETS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const IS_BLACK_KEY = [false, true, false, true, false, false, true, false, true, false, true, false]

const NOTE_COLORS: Record<string, string> = {
  C: '#e74c3c',
  'C#': '#e67e22',
  D: '#f1c40f',
  'D#': '#2ecc71',
  E: '#1abc9c',
  F: '#3498db',
  'F#': '#9b59b6',
  G: '#e91e63',
  'G#': '#ff6f00',
  A: '#00bcd4',
  'A#': '#4caf50',
  B: '#8bc34a',
}

function midiToWhiteIndex(midi: number): number {
  return Math.floor(midi / 12) * 7 + WHITE_KEY_OFFSETS[midi % 12]
}

function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return names[midi % 12]
}

function noteColor(midi: number): string {
  return NOTE_COLORS[midiToNoteName(midi)] ?? '#8b949e'
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.floor(amount * 255))
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.floor(amount * 255))
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.floor(amount * 255))
  return `rgb(${r},${g},${b})`
}

export const FallingNotesCanvas: Component<FallingNotesCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  const particles: Particle[] = []

  let lastHitCount = 0

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()

    const ro = new ResizeObserver(() => resizeCanvas())
    ro.observe(canvasRef.parentElement!)

    startLoop()

    // Ctrl+scroll zoom
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const step = e.deltaY < 0 ? -1 : 1
      const current = props.visibleBeatWindow?.() ?? 8
      const next = Math.max(2, Math.min(24, current + step))
      if (next !== current) {
        setVisibleBeatWindow(next)
      }
    }

    // Touch pinch-to-zoom
    let pinchStartDist = 0
    let pinchStartWindow = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        pinchStartWindow = props.visibleBeatWindow?.() ?? 8
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchStartDist === 0) return
      e.preventDefault()
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      const scale = pinchStartDist / dist
      const next = Math.max(2, Math.min(24, Math.round(pinchStartWindow * scale)))
      setVisibleBeatWindow(next)
    }
    const onTouchEnd = () => {
      pinchStartDist = 0
    }

    canvasRef.addEventListener('wheel', onWheel, { passive: false })
    canvasRef.addEventListener('touchstart', onTouchStart, { passive: true })
    canvasRef.addEventListener('touchmove', onTouchMove, { passive: false })
    canvasRef.addEventListener('touchend', onTouchEnd)

    onCleanup(() => {
      ro.disconnect()
      canvasRef?.removeEventListener('wheel', onWheel)
      canvasRef?.removeEventListener('touchstart', onTouchStart)
      canvasRef?.removeEventListener('touchmove', onTouchMove)
      canvasRef?.removeEventListener('touchend', onTouchEnd)
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
    })
  })

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
    const loop = () => {
      spawnHitParticles()
      updateParticles()
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  // ── Particle System ──────────────────────────────────────────

  const spawnHitParticles = () => {
    const results = props.hitResults()
    if (results.length === lastHitCount) return

    for (let i = lastHitCount; i < results.length; i++) {
      const r = results[i]
      if (!ctx || !canvasRef) continue
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight
      const jLineY = h * JUDGMENT_LINE_RATIO
      const col = midiToWhiteIndex(r.midiNote)

      const activeNotes = props.songNotes()
      if (activeNotes.length === 0) continue
      const pMinMidi = Math.min(...activeNotes.map((n) => n.midi))
      const pMaxMidi = Math.max(...activeNotes.map((n) => n.midi))
      const pMinWhite = midiToWhiteIndex(pMinMidi)
      const pMaxWhite = midiToWhiteIndex(pMaxMidi)
      const pRange = pMaxWhite - pMinWhite + 1
      const pDisplay = Math.max(pRange, MIN_WHITE_KEYS_VISIBLE)
      const pPad = Math.floor((pDisplay - pRange) / 2)
      const pDisplayMin = pMinWhite - pPad
      const pColWidth = w / pDisplay
      const x = (col - pDisplayMin) * pColWidth + pColWidth / 2

      const isMiss = r.timing === 'miss'
      const isPerfect = r.timing === 'perfect'
      const color = isMiss ? '#f85149' : isPerfect ? '#ffd700' : '#3fb950'
      const burstCount = isPerfect ? PARTICLE_BURST_COUNT + 6 : PARTICLE_BURST_COUNT

      for (let p = 0; p < burstCount; p++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 60 + Math.random() * 200
        particles.push({
          x,
          y: jLineY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 80,
          alpha: 1,
          color,
          size: 1.5 + Math.random() * 3,
          life: 0,
          maxLife: 0.35 + Math.random() * 0.5,
        })
      }
    }
    lastHitCount = results.length
  }

  const updateParticles = () => {
    const dt = 1 / 60
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 140 * dt
      p.life += dt
      p.alpha = Math.max(0, 1 - p.life / p.maxLife)
      if (p.alpha <= 0) particles.splice(i, 1)
    }
  }

  const drawParticles = () => {
    if (!ctx) return
    for (const p of particles) {
      ctx.globalAlpha = p.alpha
      // Trail effect — draw smaller fading dot behind
      if (p.alpha > 0.3) {
        const trailAlpha = p.alpha * 0.4
        ctx.globalAlpha = trailAlpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x - p.vx * 0.015, p.y - p.vy * 0.015, p.size * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ── Main Draw ────────────────────────────────────────────────

  const draw = () => {
    if (!ctx || !canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight
    if (w <= 0 || h <= 0) return

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const notes = props.songNotes()
    if (notes.length === 0) {
      drawEmptyState(w, h)
      return
    }

    const jLineY = h * JUDGMENT_LINE_RATIO
    const kbTop = h * KEYBOARD_START_RATIO
    const kbHeight = h - kbTop
    const noteAreaH = jLineY

    // Compute column layout with minimum visible range for good scaling
    const minMidi = Math.min(...notes.map((n) => n.midi))
    const maxMidi = Math.max(...notes.map((n) => n.midi))
    const minWhite = midiToWhiteIndex(minMidi)
    const maxWhite = midiToWhiteIndex(maxMidi)
    const rangeWhite = maxWhite - minWhite + 1
    const displayRange = Math.max(rangeWhite, MIN_WHITE_KEYS_VISIBLE)
    const padding = Math.floor((displayRange - rangeWhite) / 2)
    const displayMinWhite = minWhite - padding
    const colWidth = w / displayRange

    const currentBeat = props.playheadBeat()
    const visibleBeats = props.visibleBeatWindow?.() ?? 8
    const bps = noteAreaH / visibleBeats

    const beatToY = (beat: number) => jLineY - (beat - currentBeat) * bps

    // Draw grid guide lines
    drawGridLines(w, noteAreaH, currentBeat, bps, jLineY)

    // Clip notes so they are consumed by the piano keyboard
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, kbTop)
    ctx.clip()

    // Draw notes
    for (const note of notes) {
      const endBeat = note.startBeat + note.duration
      const y = beatToY(endBeat)
      const noteH = Math.max(note.duration * bps, 8)
      if (y + noteH < 0 || y > jLineY) continue // off-screen or past piano

      const col = midiToWhiteIndex(note.midi)
      const x = (col - displayMinWhite) * colWidth
      const isBlack = IS_BLACK_KEY[note.midi % 12]
      const wNote = isBlack ? colWidth * 0.52 : colWidth * 0.82
      const xOffset = (colWidth - wNote) / 2

      // Determine if note has been judged
      const results = props.hitResults()
      const judgment = results.find(
        (r) => r.itemIndex === note.id,
      )
      const isJudged = judgment !== undefined
      const wasMiss = judgment?.timing === 'miss'
      const wasHit = isJudged && !wasMiss

      // Color and gradient
      let fillColor: string
      let useGradient = false
      if (wasMiss) {
        fillColor = '#f8514966'
      } else if (wasHit) {
        fillColor = '#3fb95066'
      } else if (note.startBeat <= currentBeat && currentBeat <= endBeat) {
        fillColor = '#f0f6fc'
      } else {
        const base = noteColor(note.midi)
        fillColor = base
        useGradient = true
      }

      // Border
      let strokeColor = 'transparent'
      if (wasMiss) strokeColor = '#f85149'
      else if (wasHit) strokeColor = '#3fb950'
      else if (note.startBeat <= currentBeat && currentBeat <= endBeat)
        strokeColor = '#ffffff'

      // Shadow beneath note
      if (useGradient)
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2

      // Draw note rectangle with gradient or flat fill
      if (useGradient) {
        const grad = ctx.createLinearGradient(x + xOffset, y, x + xOffset, y + noteH)
        grad.addColorStop(0, lightenColor(fillColor, 0.35))
        grad.addColorStop(0.3, fillColor)
        grad.addColorStop(0.7, darkenColor(fillColor, 0.85))
        grad.addColorStop(1, darkenColor(fillColor, 0.65))
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = fillColor
      }

      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeColor !== 'transparent' ? 2.5 : 0
      ctx.beginPath()
      const r = Math.min(NOTE_BORDER_RADIUS, noteH / 2)
      ctx.moveTo(x + xOffset + r, y)
      ctx.lineTo(x + xOffset + wNote - r, y)
      ctx.arcTo(x + xOffset + wNote, y, x + xOffset + wNote, y + r, r)
      ctx.lineTo(x + xOffset + wNote, y + noteH - r)
      ctx.arcTo(x + xOffset + wNote, y + noteH, x + xOffset + wNote - r, y + noteH, r)
      ctx.lineTo(x + xOffset + r, y + noteH)
      ctx.arcTo(x + xOffset, y + noteH, x + xOffset, y + noteH - r, r)
      ctx.lineTo(x + xOffset, y + r)
      ctx.arcTo(x + xOffset, y, x + xOffset + r, y, r)
      ctx.closePath()
      ctx.fill()
      if (strokeColor !== 'transparent') ctx.stroke()

      if (useGradient) ctx.restore()

      // Note name label — always visible when showNoteLabels is on
      if (showNoteLabels()) {
        const noteName = midiToNoteName(note.midi)
        const octave = Math.floor(note.midi / 12) - 1
        const labelFontSize = Math.max(9, Math.min(noteH * 0.5, 13))
        ctx.fillStyle = wasMiss ? '#f85149' : wasHit ? '#3fb950' : isJudged ? '#8b949e' : '#ffffff'
        ctx.font = `bold ${labelFontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${noteName}${octave}`, x + xOffset + wNote / 2, y + noteH / 2)
      }
    }

    ctx.restore()

    // Draw judgment line
    drawJudgmentLine(w, jLineY, currentBeat)

    // Draw keyboard
    drawKeyboard(w, kbTop, kbHeight, displayMinWhite, displayRange, colWidth, currentBeat, notes, jLineY)

    // Draw pitch indicator on keyboard
    drawPitchIndicator(w, kbTop, kbHeight, displayMinWhite, displayRange, colWidth)

    // Draw particles on top
    drawParticles()

    // Draw HUD overlay
    drawHUD(w, h)
  }

  // ── Judgment Line ────────────────────────────────────────────

  const drawJudgmentLine = (w: number, y: number, _beat: number) => {
    if (!ctx) return
    // Animated shimmer
    const shimmerAlpha = 0.3 + 0.15 * Math.sin(performance.now() / 600)
    // Wide glow
    const glow = ctx.createLinearGradient(0, y - 14, 0, y + 14)
    glow.addColorStop(0, 'rgba(120,200,255,0)')
    glow.addColorStop(0.3, `rgba(120,200,255,${shimmerAlpha * 0.5})`)
    glow.addColorStop(0.5, `rgba(120,200,255,${shimmerAlpha})`)
    glow.addColorStop(0.7, `rgba(120,200,255,${shimmerAlpha * 0.5})`)
    glow.addColorStop(1, 'rgba(120,200,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, y - 14, w, 28)

    // Line
    ctx.strokeStyle = `rgba(120,200,255,${0.6 + shimmerAlpha * 0.3})`
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()

    // Larger center diamond
    const dSize = 8
    ctx.fillStyle = `rgba(120,200,255,${0.8 + shimmerAlpha * 0.2})`
    ctx.beginPath()
    ctx.moveTo(w / 2, y - dSize)
    ctx.lineTo(w / 2 + dSize, y)
    ctx.lineTo(w / 2, y + dSize)
    ctx.lineTo(w / 2 - dSize, y)
    ctx.closePath()
    ctx.fill()
  }

  // ── Grid Lines ────────────────────────────────────────────────

  const drawGridLines = (
    w: number,
    noteAreaH: number,
    currentBeat: number,
    bps: number,
    jLineY: number,
  ) => {
    if (!ctx) return
    const visibleBeats = props.visibleBeatWindow?.() ?? 8
    const startBeat = currentBeat
    const endBeat = currentBeat + visibleBeats

    ctx.strokeStyle = 'rgba(60,66,76,0.3)'
    ctx.lineWidth = 0.5

    for (let b = Math.floor(startBeat); b <= Math.ceil(endBeat); b++) {
      const y = jLineY - (b - currentBeat) * bps
      if (y < 0 || y > noteAreaH) continue

      const isBar = b % 4 === 0
      if (isBar) {
        ctx.strokeStyle = 'rgba(80,86,96,0.28)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
      } else {
        ctx.strokeStyle = 'rgba(60,66,76,0.18)'
        ctx.lineWidth = 0.5
        ctx.setLineDash([])
      }

      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()

      if (isBar) {
        const barNum = Math.floor(b / 4) + 1
        ctx.fillStyle = 'rgba(139,148,158,0.4)'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(`Bar ${barNum}`, 6, y - 4)
      }
    }
    ctx.setLineDash([])
  }

  // ── Virtual Keyboard ─────────────────────────────────────────

  const drawKeyboard = (
    w: number,
    kbTop: number,
    kbHeight: number,
    minWhite: number,
    rangeWhite: number,
    colWidth: number,
    _currentBeat: number,
    _notes: FallingNote[],
    _jLineY: number,
  ) => {
    if (!ctx) return

    // Keyboard background with subtle gradient
    const bgGrad = ctx.createLinearGradient(0, kbTop, 0, kbTop + kbHeight)
    bgGrad.addColorStop(0, '#1a1f2b')
    bgGrad.addColorStop(1, '#0f131a')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, kbTop, w, kbHeight)

    // Top border
    ctx.strokeStyle = '#3a4050'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, kbTop)
    ctx.lineTo(w, kbTop)
    ctx.stroke()

    const blackKeyH = kbHeight * BLACK_KEY_HEIGHT_RATIO
    const keyRadius = Math.min(colWidth * 0.12, 4)

    // Draw white keys first with 3D ivory gradient
    for (let wi = 0; wi < rangeWhite; wi++) {
      const x = wi * colWidth
      const midi = whiteIndexToMidi(minWhite + wi)

      // 3D ivory gradient
      const wGrad = ctx.createLinearGradient(x, kbTop, x, kbTop + kbHeight)
      wGrad.addColorStop(0, '#fafbfc')
      wGrad.addColorStop(0.15, '#e8ecf0')
      wGrad.addColorStop(0.5, '#d4d8de')
      wGrad.addColorStop(0.85, '#c4c9d1')
      wGrad.addColorStop(1, '#b0b5bd')
      ctx.fillStyle = wGrad

      // Rounded bottom corners
      ctx.beginPath()
      ctx.moveTo(x + 1, kbTop + 1)
      ctx.lineTo(x + colWidth - 1, kbTop + 1)
      ctx.lineTo(x + colWidth - 1, kbTop + kbHeight - keyRadius)
      ctx.arcTo(x + colWidth - 1, kbTop + kbHeight - 1, x + colWidth - keyRadius, kbTop + kbHeight - 1, keyRadius)
      ctx.lineTo(x + 1 + keyRadius, kbTop + kbHeight - 1)
      ctx.arcTo(x + 1, kbTop + kbHeight - 1, x + 1, kbTop + kbHeight - keyRadius, keyRadius)
      ctx.closePath()
      ctx.fill()

      // Subtle inner shadow edge at key bottom
      ctx.strokeStyle = '#9da3ad'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Key separator
      ctx.strokeStyle = '#0d1117'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, kbTop)
      ctx.lineTo(x, kbTop + kbHeight)
      ctx.stroke()

      // Note label
      const noteName = midiToNoteName(midi)
      const octave = Math.floor(midi / 12) - 1
      ctx.fillStyle = '#1a1f2b'
      ctx.font = `${Math.max(8, Math.min(colWidth * 0.65, 11))}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${noteName}${octave}`, x + colWidth / 2, kbTop + kbHeight - 5)
    }

    // Draw black keys with 3D dark gradient
    for (let wi = 0; wi < rangeWhite; wi++) {
      const midi = whiteIndexToMidi(minWhite + wi)
      const nextMidi = midi + 1
      if (nextMidi % 12 !== 0 && nextMidi % 12 !== 5) {
        const nextIsBlack = IS_BLACK_KEY[nextMidi % 12]
        if (nextIsBlack) {
          const bw = colWidth * BLACK_KEY_WIDTH_RATIO
          const bx = (wi * colWidth + colWidth * 0.7) - bw / 2

          // 3D dark gradient
          const bGrad = ctx.createLinearGradient(bx, kbTop, bx + bw, kbTop + blackKeyH)
          bGrad.addColorStop(0, '#3a3e45')
          bGrad.addColorStop(0.3, '#1a1c22')
          bGrad.addColorStop(0.7, '#0d0e14')
          bGrad.addColorStop(1, '#1f2128')
          ctx.fillStyle = bGrad

          const bRadius = Math.min(bw * 0.15, 3)
          ctx.beginPath()
          ctx.moveTo(bx, kbTop + 1)
          ctx.lineTo(bx + bw, kbTop + 1)
          ctx.lineTo(bx + bw, kbTop + blackKeyH - bRadius)
          ctx.arcTo(bx + bw, kbTop + blackKeyH, bx + bw - bRadius, kbTop + blackKeyH, bRadius)
          ctx.lineTo(bx + bRadius, kbTop + blackKeyH)
          ctx.arcTo(bx, kbTop + blackKeyH, bx, kbTop + blackKeyH - bRadius, bRadius)
          ctx.closePath()
          ctx.fill()

          // Subtle highlight on black key top
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    // Highlight keys for notes at judgment line
    for (const note of _notes) {
      const endBeat = note.startBeat + note.duration
      const atLine = note.startBeat <= _currentBeat && _currentBeat <= endBeat
      if (!atLine) continue

      const col = midiToWhiteIndex(note.midi)
      const wi = col - minWhite
      if (wi < 0 || wi >= rangeWhite) continue
      const x = wi * colWidth

      const hlGrad = ctx.createLinearGradient(x, kbTop, x, kbTop + kbHeight)
      hlGrad.addColorStop(0, 'rgba(56,139,253,0.45)')
      hlGrad.addColorStop(1, 'rgba(56,139,253,0.25)')
      ctx.fillStyle = hlGrad
      ctx.fillRect(x + 1, kbTop + 1, colWidth - 2, kbHeight - 2)
    }

    // Highlight keys being pressed via MIDI input
    const held = props.midiHeldNotes?.()
    if (held && held.length > 0) {
      for (const e of held) {
        const col = midiToWhiteIndex(e.midi)
        const wi = col - minWhite
        if (wi < 0 || wi >= rangeWhite) continue
        const x = wi * colWidth
        const opacity = 0.25 + (e.velocity / 127) * 0.45

        const midiGrad = ctx.createLinearGradient(x, kbTop, x, kbTop + kbHeight)
        midiGrad.addColorStop(0, `rgba(56,180,255,${opacity})`)
        midiGrad.addColorStop(1, `rgba(56,180,255,${opacity * 0.6})`)
        ctx.fillStyle = midiGrad
        ctx.fillRect(x + 1, kbTop + 1, colWidth - 2, kbHeight - 2)

        ctx.strokeStyle = `rgba(56,200,255,${opacity * 0.8})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + 1, kbTop + 1)
        ctx.lineTo(x + colWidth - 1, kbTop + 1)
        ctx.stroke()
      }
    }
  }

  // ── Pitch Indicator ───────────────────────────────────────────

  const noteNameToMidi = (noteName: string, octave: number): number => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const semitone = names.indexOf(noteName)
    if (semitone < 0) return 60
    return (octave + 1) * 12 + semitone
  }

  const drawPitchIndicator = (
    w: number,
    kbTop: number,
    kbHeight: number,
    minWhite: number,
    rangeWhite: number,
    colWidth: number,
  ) => {
    if (!ctx) return
    const pitch = props.currentPitch()
    const isMidi = props.inputMode?.() === 'midi'
    if (!pitch || (!props.isMicActive() && !isMidi)) return

    const midi = noteNameToMidi(pitch.noteName, pitch.octave)
    const col = midiToWhiteIndex(midi)
    const wi = col - minWhite
    if (wi < -0.5 || wi > rangeWhite + 0.5) return

    const x = wi * colWidth + colWidth / 2
    const y = kbTop + kbHeight * 0.25

    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, colWidth * 0.7)
    glow.addColorStop(0, 'rgba(56,200,120,0.7)')
    glow.addColorStop(0.5, 'rgba(56,200,120,0.25)')
    glow.addColorStop(1, 'rgba(56,200,120,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - colWidth * 0.7, y - colWidth * 0.7, colWidth * 1.4, colWidth * 1.4)

    // Dot
    ctx.fillStyle = '#3fb950'
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f0f6fc'
    ctx.lineWidth = 2
    ctx.stroke()

    // Label
    const labelY = kbTop - 8
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    const labelW = ctx.measureText(`${pitch.noteName}${pitch.octave}`).width + 12
    ctx.fillRect(x - labelW / 2, labelY - 14, labelW, 18)

    ctx.fillStyle = '#3fb950'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${pitch.noteName}${pitch.octave}`, x, labelY - 5)

    // Cents deviation
    if (pitch.cents !== 0) {
      const centsStr = pitch.cents > 0 ? `+${Math.round(pitch.cents)}¢` : `${Math.round(pitch.cents)}¢`
      ctx.fillStyle = Math.abs(pitch.cents) < 15 ? '#3fb950' : Math.abs(pitch.cents) < 30 ? '#f1c40f' : '#f85149'
      ctx.font = '9px sans-serif'
      ctx.fillText(centsStr, x, labelY - 28)
    }
  }

  // ── HUD Overlay ──────────────────────────────────────────────

  const drawHUD = (w: number, _h: number) => {
    if (!ctx) return
    const gs = props.gameState()
    if (gs === 'idle') return

    const s = props.score()
    const c = props.combo()
    const t = props.totalNotes()
    const m = props.notesMissed()

    // Glass-morphism overlay
    const glassGrad = ctx.createLinearGradient(0, 0, 0, 48)
    glassGrad.addColorStop(0, 'rgba(13,17,23,0.85)')
    glassGrad.addColorStop(0.6, 'rgba(13,17,23,0.75)')
    glassGrad.addColorStop(1, 'rgba(13,17,23,0.45)')
    ctx.fillStyle = glassGrad
    ctx.fillRect(0, 0, w, 48)

    // Subtle bottom border
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 48)
    ctx.lineTo(w, 48)
    ctx.stroke()

    // Score — left
    ctx.fillStyle = '#f0f6fc'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`Score: ${s}`, 14, 30)

    // Combo — center
    ctx.textAlign = 'center'
    if (c > 1) {
      ctx.fillStyle = '#3fb950'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`${c}x Combo!`, w / 2, 30)
    }

    // Hit/miss — right
    ctx.fillStyle = '#8b949e'
    ctx.textAlign = 'right'
    ctx.font = '13px sans-serif'
    const hit = t - m
    ctx.fillText(`${hit}/${t}  Miss: ${m}`, w - 14, 18)

    // State text
    if (gs === 'countdown' || gs === 'paused') {
      ctx.fillStyle = gs === 'countdown' ? '#f1c40f' : '#8b949e'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(
        gs === 'countdown' ? 'Get Ready...' : 'Paused',
        w - 14,
        36,
      )
    }
  }

  // ── Empty State ──────────────────────────────────────────────

  const drawEmptyState = (w: number, h: number) => {
    if (!ctx) return
    ctx.fillStyle = '#8b949e'
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Select a song to start practicing', w / 2, h / 2)
  }

  // ── Helper: white index → MIDI ───────────────────────────────

  function whiteIndexToMidi(whiteIdx: number): number {
    const octave = Math.floor(whiteIdx / 7)
    const noteInOctave = whiteIdx % 7
    const whiteToChromatic = [0, 2, 4, 5, 7, 9, 11]
    return (octave + 1) * 12 + whiteToChromatic[noteInOctave]
  }

  return (
    <canvas
      ref={canvasRef}
      id="falling-notes-canvas"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        'border-radius': '6px',
      }}
    />
  )
}
