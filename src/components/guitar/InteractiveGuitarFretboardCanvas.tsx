// ============================================================
// InteractiveGuitarFretboardCanvas — GarageBand-style fretboard
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { FretNote } from '@/lib/guitar/caged-shapes'
import { getChordToneRole } from '@/lib/guitar/chord-utils'
import { DOUBLE_FRET_MARKER, FRET_MARKERS, MAX_FRET, OPEN_MIDI, STRING_LABELS, } from '@/lib/guitar/constants'
import { midiToNoteName, NOTE_COLORS, NOTE_NAMES } from '@/lib/note-utils'
import type { FretboardMode } from './GuitarFretboardModeTabs'

export interface InteractiveGuitarFretboardCanvasProps {
  selectedKey: () => string
  selectedScale: () => string
  highlightedNotes: () => Set<number>
  isActive: () => boolean
  lastPlayedNote: () => {
    midi: number
    stringIndex: number
    fret: number
  } | null
  onNotePlayed: (midi: number, stringIndex: number, fret: number) => void
  // Chord tone highlighting
  selectedChord: () => string | null
  chordToneMidis: () => Set<number>
  // Mode context for quiz / ear training overlays
  mode: () => FretboardMode
  quizFoundMidis: () => Set<number>
  earTargetMidi: () => number | null
  earFeedback: () => 'correct' | 'wrong' | null
  // Transcription step results
  transcriptionResults: () => Array<'correct' | 'wrong' | 'pending'>
  transcriptionPhase: () => string
  // CAGED position trainer
  cagedHighlight?: () => FretNote[]
  viewFretRange?: () => [number, number]
  // Sing-to-Fretboard target highlight
  singTargetMidi?: () => number | null
}

// ── Constants ────────────────────────────────────────────────────

// Uses shared FRET_MARKERS constant
// Uses shared DOUBLE_FRET_MARKER constant
const NOTE_RADIUS = 13
const ROOT_NOTE_RADIUS = 16
const GLOW_DECAY = 0.04

// ── Component ──────────────────────────────────────────────────

export const InteractiveGuitarFretboardCanvas: Component<
  InteractiveGuitarFretboardCanvasProps
> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let glowAlpha = 0
  let playedStringIdx = -1
  let playedFret = -1
  let earFlashAlpha = 0
  let earFlashResult: 'correct' | 'wrong' | null = null
  let layout = { w: 0, h: 0, nutX: 0, fretW: 0, stringYs: [] as number[] }

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()

    const ro = new ResizeObserver(() => resizeCanvas())
    ro.observe(canvasRef.parentElement!)

    startLoop()

    const onClick = (e: MouseEvent) => handleInteraction(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0)
        handleInteraction(e.touches[0].clientX, e.touches[0].clientY)
    }
    canvasRef.addEventListener('click', onClick)
    canvasRef.addEventListener('touchstart', onTouch, { passive: true })

    onCleanup(() => {
      ro.disconnect()
      canvasRef?.removeEventListener('click', onClick)
      canvasRef?.removeEventListener('touchstart', onTouch)
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
    })
  })

  createEffect(() => {
    if (props.isActive() === false) {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
      }
    } else if (animFrameId === null) {
      startLoop()
    }
  })

  // ── Layout ─────────────────────────────────────────────────────
  // Cached — recomputed only on resize, not on every click/frame.

  let layoutValid = false

  const resizeCanvas = () => {
    if (!canvasRef) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.parentElement!.clientWidth
    const h = canvasRef.parentElement!.clientHeight
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = '100%'
    canvasRef.style.height = '100%'
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    layoutValid = false // invalidate cached layout
  }

  const computeLayout = () => {
    if (layoutValid) return // cached from previous frame
    if (!canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight
    if (w <= 0 || h <= 0) return

    const padLeft = 56
    const padRight = 16
    const padTop = 24
    const padBottom = 20
    const nutX = padLeft
    const bridgeX = w - padRight
    const fretAreaWidth = bridgeX - nutX
    const stringHeight = (h - padTop - padBottom) / 6

    const stringYs: number[] = []
    for (let s = 0; s < 6; s++) {
      stringYs.push(padTop + s * stringHeight + stringHeight / 2)
    }

    layout = { w, h, nutX, fretW: fretAreaWidth, stringYs }
    layoutValid = true
  }

  // ── Fret position helper ──────────────────────────────────────

  const fretX = (fret: number): number => {
    const rawPos = 1 - Math.pow(2, -fret / 12)
    const maxPos = 1 - Math.pow(2, -MAX_FRET / 12)
    return layout.nutX + (layout.fretW * rawPos) / maxPos
  }

  // ── Hit testing ───────────────────────────────────────────────

  const handleInteraction = (clientX: number, clientY: number) => {
    if (!canvasRef) return
    computeLayout()
    const rect = canvasRef.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    // Find nearest string
    let bestString = 0
    let bestStringDist = Infinity
    for (let s = 0; s < 6; s++) {
      const dist = Math.abs(y - layout.stringYs[s])
      if (dist < bestStringDist) {
        bestStringDist = dist
        bestString = s
      }
    }

    // Find nearest fret
    let bestFret = 0
    let bestFretDist = Infinity
    for (let f = 0; f <= MAX_FRET; f++) {
      const fx = fretX(f)
      const dist = Math.abs(x - fx)
      if (dist < bestFretDist) {
        bestFretDist = dist
        bestFret = f
      }
    }

    const midi = OPEN_MIDI[bestString] + bestFret
    playedStringIdx = bestString
    playedFret = bestFret
    glowAlpha = 1
    props.onNotePlayed(midi, bestString, bestFret)
  }

  // ── Animation loop ────────────────────────────────────────────

  const startLoop = () => {
    const loop = () => {
      if (glowAlpha > 0) {
        glowAlpha -= GLOW_DECAY
        if (glowAlpha <= 0) {
          glowAlpha = 0
          playedStringIdx = -1
          playedFret = -1
        }
      }
      if (earFlashAlpha > 0) {
        earFlashAlpha -= GLOW_DECAY * 2
        if (earFlashAlpha <= 0) {
          earFlashAlpha = 0
          earFlashResult = null
        }
      }
      // Check ear feedback signal for a new flash trigger
      const fb = props.earFeedback()
      if (fb !== null && fb !== earFlashResult && earFlashAlpha <= 0) {
        earFlashResult = fb
        earFlashAlpha = 1
      }
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  // ── Draw ──────────────────────────────────────────────────────

  const draw = () => {
    if (!ctx || !canvasRef) return
    computeLayout()
    const { w, h, nutX, fretW, stringYs } = layout
    if (w <= 0 || h <= 0) return

    ctx.clearRect(0, 0, w, h)

    // ── Background: dark wood ────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
    bgGrad.addColorStop(0, '#1a120b')
    bgGrad.addColorStop(0.5, '#241a10')
    bgGrad.addColorStop(1, '#1a120b')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // ── Nut line ────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(nutX, stringYs[0] - 14)
    ctx.lineTo(nutX, stringYs[5] + 14)
    ctx.stroke()

    // ── Fret lines ──────────────────────────────────────────────
    for (let f = 0; f <= MAX_FRET; f++) {
      const x = fretX(f)
      ctx.strokeStyle =
        f === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'
      ctx.lineWidth = f === 0 ? 0.5 : 1
      ctx.beginPath()
      ctx.moveTo(x, stringYs[0] - 10)
      ctx.lineTo(x, stringYs[5] + 10)
      ctx.stroke()
    }

    // ── Strings ─────────────────────────────────────────────────
    for (let s = 0; s < 6; s++) {
      // Subtle lane
      ctx.fillStyle =
        s % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'rgba(0,0,0,0.03)'
      const laneH = stringYs[1] - stringYs[0]
      ctx.fillRect(nutX, stringYs[s] - laneH / 2, fretW, laneH)

      // String line
      ctx.strokeStyle = `rgba(200,180,160,${s < 3 ? 0.3 : 0.2})`
      ctx.lineWidth = s < 3 ? 1.8 : 1.2
      ctx.beginPath()
      ctx.moveTo(nutX, stringYs[s])
      ctx.lineTo(nutX + fretW, stringYs[s])
      ctx.stroke()

      // Label on the left
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(STRING_LABELS[s], nutX - 10, stringYs[s])
    }

    // ── Fret marker dots (bottom edge) ──────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    for (const fret of FRET_MARKERS) {
      const x = fretX(fret)
      // Between the two middle strings
      const dotY = (stringYs[2] + stringYs[3]) / 2
      if (fret === DOUBLE_FRET_MARKER) {
        ctx.beginPath()
        ctx.arc(x - 10, dotY, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + 10, dotY, 5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(x, dotY, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── Open string notes (left of nut) ─────────────────────────
    const openNotes = [40, 45, 50, 55, 59, 64]
    const openNames = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
    for (let s = 0; s < 6; s++) {
      const midi = openNotes[s]
      const noteName = midiToNoteName(midi)
      const color = NOTE_COLORS[noteName] ?? '#8b949e'
      const cx = nutX - 28
      const cy = stringYs[s]

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cx, cy, NOTE_RADIUS - 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(openNames[s], cx, cy)
    }

    // ── Scale note markers ──────────────────────────────────────
    const highlighted = props.highlightedNotes()
    const key = props.selectedKey()
    const keyOffset = NOTE_NAMES.indexOf(key)
    const rootMidiClass = keyOffset >= 0 ? keyOffset : 0

    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= MAX_FRET; f++) {
        const midi = OPEN_MIDI[s] + f
        if (!highlighted.has(midi)) continue

        const noteName = midiToNoteName(midi)
        const color = NOTE_COLORS[noteName] ?? '#8b949e'
        const isRoot = midi % 12 === rootMidiClass
        const radius = isRoot ? ROOT_NOTE_RADIUS : NOTE_RADIUS
        const cx = fretX(f)
        const cy = stringYs[s]

        // Root ring
        if (isRoot) {
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Note circle
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()

        // Note name
        ctx.fillStyle = '#fff'
        ctx.font = isRoot ? 'bold 9px monospace' : '8px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(noteName, cx, cy)
      }
    }

    // ── Chord tone role markers ──────────────────────────────────
    const chordTones = props.chordToneMidis()
    const chord = props.selectedChord()
    if (chord !== null && chordTones.size > 0) {
      const keyOff = NOTE_NAMES.indexOf(key)
      const rootMidi = keyOff >= 0 ? keyOff + 60 : 60
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= MAX_FRET; f++) {
          const midi = OPEN_MIDI[s] + f
          if (!chordTones.has(midi)) continue
          const role = getChordToneRole(midi, rootMidi, chord)
          if (role === null) continue
          const cx = fretX(f)
          const cy = stringYs[s]

          if (role === 'root') {
            // White ring (already handled by scale root rendering, so add no extra)
          } else if (
            role === 'third' ||
            role === 'second' ||
            role === 'fourth'
          ) {
            // Diamond marker (sus2/sus4 replace the third with a 2nd/4th
            // at this same chord-tone slot, sharing its visual)
            ctx.fillStyle = 'rgba(255,255,255,0.8)'
            ctx.beginPath()
            const r = 5
            ctx.moveTo(cx, cy - r)
            ctx.lineTo(cx + r, cy)
            ctx.lineTo(cx, cy + r)
            ctx.lineTo(cx - r, cy)
            ctx.closePath()
            ctx.fill()
          } else if (role === 'fifth') {
            // Bold border ring
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(cx, cy, NOTE_RADIUS + 2, 0, Math.PI * 2)
            ctx.stroke()
          } else if (role === 'seventh') {
            // Dashed inner ring
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([3, 2])
            ctx.beginPath()
            ctx.arc(cx, cy, NOTE_RADIUS - 2, 0, Math.PI * 2)
            ctx.stroke()
            ctx.setLineDash([])
          }
        }
      }
    }

    // ── Quiz found notes overlay ──────────────────────────────────
    const foundMidis = props.quizFoundMidis()
    if (foundMidis.size > 0) {
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= MAX_FRET; f++) {
          const midi = OPEN_MIDI[s] + f
          if (!foundMidis.has(midi)) continue
          const cx = fretX(f)
          const cy = stringYs[s]

          // Green check circle
          ctx.fillStyle = 'rgba(63,185,80,0.35)'
          ctx.beginPath()
          ctx.arc(cx, cy, NOTE_RADIUS + 4, 0, Math.PI * 2)
          ctx.fill()

          // Checkmark
          ctx.strokeStyle = '#3fb950'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(cx - 5, cy)
          ctx.lineTo(cx - 2, cy + 3)
          ctx.lineTo(cx + 5, cy - 3)
          ctx.stroke()
        }
      }
    }

    // ── Transcription step markers ──────────────────────────────
    const txResults = props.transcriptionResults()
    const txPhase = props.transcriptionPhase()
    if (txResults.length > 0 && txPhase !== 'idle') {
      const barW = txResults.length * 28 + 16
      const barX = (layout.w - barW) / 2
      const barY = 10

      ctx.fillStyle = 'rgba(13,17,23,0.85)'
      ctx.strokeStyle = 'rgba(48,54,61,0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(barX, barY, barW, 28, 6)
      ctx.fill()
      ctx.stroke()

      for (let i = 0; i < txResults.length; i++) {
        const dotX = barX + 14 + i * 28
        const dotY = barY + 14
        let color: string
        if (txResults[i] === 'correct') color = '#3fb950'
        else if (txResults[i] === 'wrong') color = '#ff4444'
        else color = 'rgba(139,148,158,0.4)'

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2)
        ctx.fill()

        if (txPhase === 'playing' && i === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(dotX, dotY, 9, 0, Math.PI * 2)
          ctx.stroke()
          ctx.lineWidth = 1
        }
      }
    }

    // ── CAGED position highlight ──────────────────────────────────
    const cagedNotes = props.cagedHighlight?.()
    const fretRange = props.viewFretRange?.()
    if (cagedNotes && cagedNotes.length > 0 && fretRange) {
      const [rangeStart, rangeEnd] = fretRange
      // Position box background
      const boxX1 = fretX(rangeStart) - 8
      const boxX2 = fretX(rangeEnd) + 8
      const boxW = boxX2 - boxX1
      ctx.fillStyle = 'rgba(88,166,255,0.06)'
      ctx.fillRect(
        boxX1,
        stringYs[0] - 18,
        boxW,
        stringYs[5] - stringYs[0] + 36,
      )

      // Position box border
      ctx.strokeStyle = 'rgba(88,166,255,0.3)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.roundRect(
        boxX1,
        stringYs[0] - 18,
        boxW,
        stringYs[5] - stringYs[0] + 36,
        6,
      )
      ctx.stroke()
      ctx.setLineDash([])

      // Shape frets with role-colored dots
      for (const note of cagedNotes) {
        const cx = fretX(note.fret)
        const cy = stringYs[note.stringIndex]
        let color: string
        if (note.role === 'root') color = '#ff6b6b'
        else if (note.role === '3rd') color = '#6bb5ff'
        else color = '#ffd93d'

        // Outer ring
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, NOTE_RADIUS + 2, 0, Math.PI * 2)
        ctx.fill()

        // Inner dot
        ctx.fillStyle = 'rgba(13,17,23,0.9)'
        ctx.beginPath()
        ctx.arc(cx, cy, NOTE_RADIUS - 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── Ear training flash ────────────────────────────────────────
    if (earFlashAlpha > 0 && earFlashResult) {
      const targetMidi = props.earTargetMidi()
      if (targetMidi !== null) {
        // Find one position for the target MIDI to flash
        for (let s = 0; s < 6; s++) {
          for (let f = 0; f <= MAX_FRET; f++) {
            if (OPEN_MIDI[s] + f !== targetMidi) continue
            const cx = fretX(f)
            const cy = stringYs[s]
            const isCorrect = earFlashResult === 'correct'
            const color = isCorrect ? 'rgba(63,185,80,' : 'rgba(255,68,68,'
            const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 36)
            glow.addColorStop(0, `${color}${earFlashAlpha * 0.6})`)
            glow.addColorStop(1, `${color}0)`)
            ctx.fillStyle = glow
            ctx.beginPath()
            ctx.arc(cx, cy, 36, 0, Math.PI * 2)
            ctx.fill()
            break
          }
        }
      }
    }

    // ── Sing-to-Fretboard target glow ───────────────────────────
    const singTarget = props.singTargetMidi?.()
    if (singTarget !== null && singTarget !== undefined) {
      const targetClass = singTarget % 12
      // Pulse based on time
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400)
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= MAX_FRET; f++) {
          const midi = OPEN_MIDI[s] + f
          if (midi % 12 !== targetClass) continue
          const cx = fretX(f)
          const cy = stringYs[s]
          const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 32)
          glow.addColorStop(0, `rgba(63,185,80,${0.25 + pulse * 0.35})`)
          glow.addColorStop(1, 'rgba(63,185,80,0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(cx, cy, 32, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // ── Last played glow ────────────────────────────────────────
    if (glowAlpha > 0 && playedStringIdx >= 0) {
      const cx = fretX(playedFret)
      const cy = stringYs[playedStringIdx]

      // Outer glow
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        ROOT_NOTE_RADIUS,
        cx,
        cy,
        40,
      )
      glow.addColorStop(0, `rgba(255,255,255,${glowAlpha * 0.4})`)
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, 40, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return (
    <div style="width:100%;height:100%;overflow:hidden;">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
