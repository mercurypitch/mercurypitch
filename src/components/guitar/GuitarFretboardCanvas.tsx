// ============================================================
// GuitarFretboardCanvas — Guitar Hero-style falling notes
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { GuitarHitResult } from '@/features/guitar-practice/useGuitarPracticeController'
import { STRING_LABELS } from '@/lib/guitar/constants'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteName, NOTE_COLORS } from '@/lib/note-utils'

export interface GuitarFretboardCanvasProps {
  fallingNotes: () => GuitarNote[]
  gameState: () => string
  playheadBeat: () => number
  hitResults: () => GuitarHitResult[]
  combo: () => number
  score: () => number
  visibleBeatWindow: () => number
  showNoteLabels: () => boolean
  songBpm?: () => number
  isActive?: () => boolean
  detectedMidi?: () => number | null
  detectedClarity?: () => number
  showUserNotes?: () => boolean
  onStrum?: (stringIndex: number) => void
}

// ── Constants ────────────────────────────────────────────────────

const STRING_COLORS = [
  '#c0392b',
  '#d35400',
  '#f39c12',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
]

const NOTE_BORDER_RADIUS = 8
const PLAYHEAD_X = 120
/** Matches GOOD_MS in useGuitarPracticeController — the hittable window */
const HIT_WINDOW_MS = 150

const TIMING_COLORS: Record<GuitarHitResult['timing'], string> = {
  perfect: '#ffd700',
  great: '#3fb950',
  good: '#58a6ff',
  miss: '#f85149',
}

const TIMING_LABELS: Record<GuitarHitResult['timing'], string> = {
  perfect: 'PERFECT',
  great: 'GREAT',
  good: 'GOOD',
  miss: 'MISS',
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

// ── Hit FX state ────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
}

interface JudgmentPopup {
  x: number
  y: number
  text: string
  color: string
  age: number
  life: number
}

interface HitRing {
  x: number
  y: number
  age: number
  life: number
  color: string
}

// ── Component ──────────────────────────────────────────────────

export const GuitarFretboardCanvas: Component<GuitarFretboardCanvasProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let lastFrameTime = 0
  let strumGlowAlpha = 0
  let strumStringIndex = -1
  let comboPulse = 0
  let lastCombo = 0
  let processedResultCount = 0
  let particles: Particle[] = []
  let popups: JudgmentPopup[] = []
  let rings: HitRing[] = []

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()

    const ro = new ResizeObserver(() => resizeCanvas())
    ro.observe(canvasRef.parentElement!)

    startLoop()

    // String interaction handlers (click + touch)
    const handleStrum = (clientX: number, clientY: number) => {
      const idx = hitTestString(clientX, clientY)
      if (idx >= 0) {
        strumStringIndex = idx
        strumGlowAlpha = 1
        props.onStrum?.(idx)
      }
    }
    const onClick = (e: MouseEvent) => handleStrum(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0]
        handleStrum(t.clientX, t.clientY)
      }
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

  // Pause the animation loop when the tab is not active
  createEffect(() => {
    if (props.isActive?.() === false) {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
      }
    } else if (animFrameId === null) {
      startLoop()
    }
  })

  // ── Layout helpers ────────────────────────────────────────────

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
  }

  const hitTestString = (_clientX: number, clientY: number): number => {
    if (!canvasRef) return -1
    const rect = canvasRef.getBoundingClientRect()
    const y = clientY - rect.top
    const h = canvasRef.clientHeight
    const laneH = h / 6
    const idx = Math.floor(y / laneH)
    return idx >= 0 && idx < 6 ? idx : -1
  }

  // ── Animation loop ────────────────────────────────────────────

  const startLoop = () => {
    lastFrameTime = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastFrameTime) / 1000)
      lastFrameTime = now
      updateEffects(dt)
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  const updateEffects = (dt: number) => {
    if (strumGlowAlpha > 0) {
      strumGlowAlpha = Math.max(0, strumGlowAlpha - dt * 2.5)
      if (strumGlowAlpha === 0) strumStringIndex = -1
    }
    if (comboPulse > 0) comboPulse = Math.max(0, comboPulse - dt * 4)

    for (const p of particles) {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 420 * dt // gravity
      p.vx *= 1 - 1.5 * dt // drag
    }
    particles = particles.filter((p) => p.age < p.life)

    for (const pop of popups) pop.age += dt
    popups = popups.filter((p) => p.age < p.life)

    for (const r of rings) r.age += dt
    rings = rings.filter((r) => r.age < r.life)
  }

  /** Spawn burst/popup/ring effects for hit results that appeared since last frame. */
  const spawnNewHitEffects = (
    results: GuitarHitResult[],
    laneH: number,
  ): void => {
    if (results.length < processedResultCount) {
      // Results were reset (new game)
      processedResultCount = 0
    }
    for (let i = processedResultCount; i < results.length; i++) {
      const r = results[i]
      const y = r.stringIndex * laneH + laneH / 2
      const color = TIMING_COLORS[r.timing]

      popups.push({
        x: PLAYHEAD_X + 36,
        y: y - laneH * 0.45,
        text: TIMING_LABELS[r.timing],
        color,
        age: 0,
        life: 0.8,
      })

      if (r.timing !== 'miss') {
        const burstColor = noteColor(r.midiNote)
        const count = r.timing === 'perfect' ? 16 : 12
        for (let p = 0; p < count; p++) {
          const angle = (p / count) * Math.PI * 2 + Math.random() * 0.5
          const speed = 90 + Math.random() * 200
          particles.push({
            x: PLAYHEAD_X,
            y,
            vx: Math.cos(angle) * speed + 40, // slight rightward bias with note flow
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.45 + Math.random() * 0.3,
            size: 2 + Math.random() * 3,
            color: Math.random() < 0.5 ? burstColor : color,
          })
        }
        rings.push({ x: PLAYHEAD_X, y, age: 0, life: 0.35, color })
      }
    }
    processedResultCount = results.length

    const comboVal = props.combo()
    if (comboVal > lastCombo) comboPulse = 1
    lastCombo = comboVal
  }

  // ── Draw ──────────────────────────────────────────────────────

  const draw = () => {
    if (!ctx || !canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight
    if (w <= 0 || h <= 0) return

    ctx.clearRect(0, 0, w, h)

    const laneH = h / 6

    // ── Background ────────────────────────────────────────────

    // Dark wood gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, 0)
    bgGrad.addColorStop(0, '#1a120b')
    bgGrad.addColorStop(0.5, '#241a10')
    bgGrad.addColorStop(1, '#1a120b')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // ── Beat lines (vertical) ─────────────────────────────────

    const visibleBeatWindow = props.visibleBeatWindow()
    const playheadBeat = props.playheadBeat()
    const bpm = props.songBpm?.() ?? 120
    const msPerBeat = 60000 / bpm

    // Side-scrolling layout
    const playheadX = PLAYHEAD_X
    const pixelPerBeat = (w - playheadX) / visibleBeatWindow
    const firstBeat = Math.floor(playheadBeat - playheadX / pixelPerBeat)
    const lastBeat = Math.ceil(playheadBeat + visibleBeatWindow)

    for (let b = firstBeat; b <= lastBeat; b++) {
      const x = playheadX + (b - playheadBeat) * pixelPerBeat
      if (x < 0 || x > w) continue

      ctx.strokeStyle =
        b % 4 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'
      ctx.lineWidth = b % 4 === 0 ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()

      // Beat number label
      if (b % 4 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`${b}`, x, 12)
      }
    }

    // Playhead line
    ctx.strokeStyle = 'rgba(147, 51, 234, 0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, h)
    ctx.stroke()

    // ── String lanes ──────────────────────────────────────────

    for (let s = 0; s < 6; s++) {
      const stringY = s * laneH
      const midY = stringY + laneH / 2

      // Lane background (alternating)
      ctx.fillStyle =
        s % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)'
      ctx.fillRect(0, stringY, w, laneH)

      // Strum glow on hit
      if (strumStringIndex === s && strumGlowAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${strumGlowAlpha * 0.15})`
        ctx.fillRect(0, stringY, w, laneH) // Light up the whole lane
      }

      // String line
      ctx.strokeStyle = STRING_COLORS[s]
      ctx.globalAlpha = 0.3
      ctx.lineWidth = s < 3 ? 1.5 : 1
      ctx.setLineDash([8, 24])
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // Hit Target Circle at playheadX
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.strokeStyle = STRING_COLORS[s]
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(playheadX, midY, 18, 0, Math.PI * 2)
      ctx.fill()
      if (strumStringIndex === s && strumGlowAlpha > 0) {
        ctx.fillStyle = STRING_COLORS[s]
        ctx.globalAlpha = strumGlowAlpha * 0.8
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.stroke()

      // Target Label (Key)
      ctx.fillStyle = '#fff'
      ctx.globalAlpha = 0.8
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const keyLabel = ['1/A', '2/S', '3/D', '4/F', '5/G', '6/H'][s]
      ctx.fillText(keyLabel, playheadX, midY)
      ctx.globalAlpha = 1

      // String label on the left
      ctx.fillStyle = STRING_COLORS[s]
      ctx.globalAlpha = 0.7
      ctx.font = 'bold 16px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(STRING_LABELS[s], 12, midY + 4)
    }

    // ── Falling notes ─────────────────────────────────────────

    const notes = props.fallingNotes()
    const showLabels = props.showNoteLabels()
    const results = props.hitResults()
    const judgedById = new Map<string, GuitarHitResult>()
    for (const r of results) judgedById.set(r.itemIndex, r)

    spawnNewHitEffects(results, laneH)

    for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
      const note = notes[noteIdx]
      // Calculate X position based on beat distance from playhead
      const beatsUntilHit = note.startBeat - playheadBeat
      const noteX = playheadX + beatsUntilHit * pixelPerBeat

      const durBeats = Math.max(0.125, note.duration || 0.25)
      const noteW = durBeats * pixelPerBeat

      // Only draw notes in the visible area + some overscan
      if (noteX + noteW < -40 || noteX > w + 40) continue

      const stringIdx = note.stringIndex
      const laneMidY = stringIdx * laneH + laneH / 2

      const judged = judgedById.get(note.id)
      const isHit = judged !== undefined && judged.timing !== 'miss'
      const isMiss = judged !== undefined && judged.timing === 'miss'

      const noteH = Math.max(14, laneH * 0.6)
      const renderW = Math.max(24, noteW)
      const noteRadius = Math.min(NOTE_BORDER_RADIUS, noteH / 2, renderW / 2)

      // Hit notes are "eaten" at the playhead: only the part that hasn't
      // crossed the line yet is drawn, so the note visibly shrinks into
      // the target as it plays (Guitar Hero sustain-burn style).
      let drawX = noteX
      let drawW = renderW
      if (isHit) {
        const rightEdge = noteX + renderW
        if (rightEdge <= playheadX + 2) continue // fully consumed
        drawX = Math.max(noteX, playheadX)
        drawW = rightEdge - drawX
      }

      let fillColor: string
      if (judged) {
        fillColor = TIMING_COLORS[judged.timing]
      } else {
        fillColor = noteColor(note.midi)
      }

      // Approaching-note telegraph: glow when inside the hittable window
      const deltaMs = beatsUntilHit * msPerBeat
      const inWindow =
        !judged &&
        deltaMs <= HIT_WINDOW_MS &&
        deltaMs >= -(note.duration * msPerBeat + HIT_WINDOW_MS)

      // Note shadow
      if (!isMiss && note.isBacking !== true) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.roundRect(
          drawX + 2,
          laneMidY - noteH / 2 + 2,
          drawW,
          noteH,
          noteRadius,
        )
        ctx.fill()
      }

      // Note pill with gradient
      const noteGrad = ctx.createLinearGradient(
        drawX,
        laneMidY - noteH / 2,
        drawX,
        laneMidY + noteH / 2,
      )
      if (isMiss) {
        // Missed notes turn ghostly gray and keep scrolling past
        noteGrad.addColorStop(0, '#6e7681')
        noteGrad.addColorStop(1, '#30363d')
        ctx.globalAlpha = 0.3
      } else if (note.isBacking === true) {
        // Backing notes are semi-transparent and don't glow
        noteGrad.addColorStop(0, fillColor)
        noteGrad.addColorStop(1, darkenColor(fillColor, 0.7))
        ctx.globalAlpha = 0.35
      } else {
        noteGrad.addColorStop(0, fillColor)
        noteGrad.addColorStop(1, darkenColor(fillColor, 0.7))
        ctx.globalAlpha = isHit ? 1 : 0.92
      }
      if (note.isBacking !== true && (inWindow || isHit)) {
        ctx.shadowColor = isHit ? fillColor : '#ffffff'
        ctx.shadowBlur = isHit ? 14 : 8
      }
      ctx.fillStyle = noteGrad
      ctx.beginPath()
      ctx.roundRect(drawX, laneMidY - noteH / 2, drawW, noteH, noteRadius)
      ctx.fill()
      ctx.shadowBlur = 0

      // Shine highlight on top half
      if (!isMiss) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(drawX, laneMidY - noteH / 2, drawW, noteH, noteRadius)
        ctx.clip()
        ctx.fillRect(drawX, laneMidY - noteH / 2, drawW, noteH * 0.45)
        ctx.restore()
      }
      ctx.globalAlpha = 1

      // Border
      ctx.strokeStyle = isMiss
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(drawX, laneMidY - noteH / 2, drawW, noteH, noteRadius)
      ctx.stroke()

      // Bright "burn" edge where a hit sustain meets the playhead
      if (isHit && noteX < playheadX) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const burnGrad = ctx.createLinearGradient(
          playheadX,
          0,
          playheadX + 26,
          0,
        )
        burnGrad.addColorStop(0, fillColor)
        burnGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = burnGrad
        ctx.globalAlpha = 0.7
        ctx.fillRect(playheadX, laneMidY - noteH / 2, 26, noteH)
        ctx.restore()
      }

      // Note label
      if (showLabels && drawW > 30 && !isMiss && note.isBacking !== true) {
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = 3
        ctx.fillText(note.noteName, drawX + drawW / 2, laneMidY)
        ctx.shadowBlur = 0
      }

      // Fret number badge on the left
      if (!isMiss && drawW > 18 && note.isBacking !== true) {
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 2
        const text =
          note.fret !== undefined ? `${note.fret}` : `${stringIdx + 1}`
        ctx.fillText(text, drawX + 6, laneMidY)
        ctx.shadowBlur = 0
      }
    }

    // ── Hit FX: rings, particles, judgment popups ─────────────

    if (rings.length > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const r of rings) {
        const t = r.age / r.life
        ctx.strokeStyle = r.color
        ctx.globalAlpha = (1 - t) * 0.9
        ctx.lineWidth = 3 * (1 - t) + 1
        ctx.beginPath()
        ctx.arc(r.x, r.y, 18 + t * 30, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    if (particles.length > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const p of particles) {
        const t = p.age / p.life
        ctx.globalAlpha = 1 - t
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    for (const pop of popups) {
      const t = pop.age / pop.life
      // Pop in (scale overshoot), float up, fade out at the end
      const scale =
        t < 0.15 ? 0.6 + (t / 0.15) * 0.55 : 1.15 - (t - 0.15) * 0.15
      const alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1
      ctx.save()
      ctx.translate(pop.x, pop.y - t * 28)
      ctx.scale(scale, scale)
      ctx.globalAlpha = alpha
      ctx.fillStyle = pop.color
      ctx.font = 'bold 16px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 4
      ctx.fillText(pop.text, 0, 0)
      ctx.restore()
    }

    // ── HUD overlay ───────────────────────────────────────────

    // Dark backdrop for HUD
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.roundRect(w - 100, 8, 88, 56, 8)
    ctx.fill()

    const comboVal = props.combo()
    if (comboVal > 1) {
      ctx.save()
      const pulseScale = 1 + comboPulse * 0.35
      ctx.translate(w - 18, 34)
      ctx.scale(pulseScale, pulseScale)
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 22px monospace'
      ctx.textAlign = 'right'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = 3
      ctx.fillText(`${comboVal}x`, 0, 0)
      ctx.restore()
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`${Math.floor(props.score())}`, w - 18, 54)

    // ── Detected note indicator (mic input) ──────────────────

    const dMidi = props.detectedMidi?.()
    const dClarity = props.detectedClarity?.()
    if (dMidi !== null && dMidi !== undefined) {
      const noteName = midiToNoteName(dMidi)
      const alpha = Math.min(1, (dClarity ?? 0) * 1.5)

      // Does the sung/played pitch match any hittable note right now?
      let matchesTarget = false
      let matchedLane = -1
      for (const note of notes) {
        if (judgedById.has(note.id)) continue
        const dMs = (note.startBeat - playheadBeat) * msPerBeat
        const endMs =
          (note.startBeat + note.duration - playheadBeat) * msPerBeat
        if (
          dMs <= HIT_WINDOW_MS &&
          endMs >= -HIT_WINDOW_MS &&
          dMidi % 12 === note.midi % 12
        ) {
          matchesTarget = true
          matchedLane = note.stringIndex
          break
        }
      }

      // Dark backdrop
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.45})`
      ctx.beginPath()
      ctx.roundRect(w - 100, 68, 88, 28, 8)
      ctx.fill()

      // Clarity bar background
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(w - 94, 82, 76, 3)

      // Clarity bar fill
      ctx.fillStyle =
        alpha > 0.7 ? '#3fb950' : alpha > 0.5 ? '#f39c12' : '#8b949e'
      ctx.fillRect(w - 94, 82, 76 * alpha, 3)

      // Note name text
      ctx.fillStyle = matchesTarget
        ? '#3fb950'
        : `rgba(255,255,255,${0.6 + alpha * 0.4})`
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(noteName, w - 18, 78)

      // Draw user note on the fretboard if toggle is on
      if (props.showUserNotes?.() === true) {
        // Snap the marker to the matched note's lane when on target,
        // otherwise approximate a lane from the detected pitch.
        let lane = matchedLane
        if (lane < 0) {
          const tunings = [64, 59, 55, 50, 45, 40] // E4 to E2
          lane = 5
          for (let i = 0; i < tunings.length; i++) {
            if (dMidi >= tunings[i]) {
              lane = i
              break
            }
          }
        }

        const laneMidY = lane * laneH + laneH / 2
        const noteH = Math.max(14, laneH * 0.6)
        const noteRadius = Math.min(NOTE_BORDER_RADIUS, noteH / 2)
        const nColor = matchesTarget ? '#3fb950' : noteColor(dMidi)

        ctx.save()
        if (matchesTarget) {
          ctx.shadowColor = '#3fb950'
          ctx.shadowBlur = 12
        }
        ctx.fillStyle = nColor
        ctx.globalAlpha = Math.max(0.2, alpha)
        ctx.beginPath()
        ctx.roundRect(
          playheadX - 16,
          laneMidY - noteH / 2,
          32,
          noteH,
          noteRadius,
        )
        ctx.fill()
        ctx.restore()

        // Label inside
        ctx.fillStyle = '#fff'
        ctx.globalAlpha = alpha > 0.5 ? 1 : 0.5
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(noteName, playheadX, laneMidY)
        ctx.globalAlpha = 1
      }
    }

    // ── Game state overlay ────────────────────────────────────

    const state = props.gameState()
    if (state === 'countdown' || state === 'paused' || state === 'finished') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, w, h)

      ctx.fillStyle = '#fff'
      const isNarrow = w < 480
      ctx.font = isNarrow ? 'bold 32px monospace' : 'bold 48px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (state === 'countdown') ctx.fillText('GET READY', w / 2, h / 2)
      else if (state === 'paused') ctx.fillText('PAUSED', w / 2, h / 2)
      else if (state === 'finished') {
        ctx.fillText('FINISHED', w / 2, h / 2)
        ctx.font = isNarrow ? '14px monospace' : '18px monospace'
        ctx.fillText(`Score: ${Math.floor(props.score())}`, w / 2, h / 2 + 40)
      }
    }
  }

  return (
    <div
      class="guitar-fretboard-container"
      style={{ width: '100%', height: '100%' }}
    >
      <canvas
        ref={canvasRef}
        class="guitar-fretboard-canvas"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
