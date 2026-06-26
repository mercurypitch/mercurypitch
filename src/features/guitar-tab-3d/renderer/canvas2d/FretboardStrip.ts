// ============================================================
// FretboardStrip — flat fretboard reference panel (Canvas 2D)
// ============================================================
//
// The guitar equivalent of the piano keyboard under a falling-notes view: a
// flat neck shown below the 3D highway. Strings are stacked rows, frets are
// columns, every cell can show its note name, and the notes currently at the
// hit line light up on their (string, fret). Stays 2D regardless of the highway
// backend, so it survives the future WebGPU port as an overlay.

import { NOTE_NAMES } from '@/lib/note-utils'
import { colorForString, withAlpha } from './color'

const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE_MARKERS = [12, 24]

export function isFretMarker(fret: number): boolean {
  return SINGLE_MARKERS.includes(fret) || DOUBLE_MARKERS.includes(fret)
}

/** Note name (no octave) sounding at a given open-string MIDI + fret. */
export function cellNoteName(openMidi: number, fret: number): string {
  return NOTE_NAMES[(openMidi + fret) % 12]
}

/** Stable key for a (string, fret) cell. */
export function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`
}

export interface FretboardDrawOpts {
  width: number
  height: number
  stringCount: number
  /** Open-string MIDI per string index (0 = highest string). */
  openMidi: readonly number[]
  maxFret: number
  /** Active cells as `${stringIndex}:${fret}` (notes at the hit line). */
  activeCells: ReadonlySet<string>
  showNoteNames: boolean
  stringColors: readonly string[]
  leftHanded: boolean
}

export function drawFretboard(
  ctx: CanvasRenderingContext2D,
  o: FretboardDrawOpts,
): void {
  const { width, height, stringCount, maxFret } = o
  ctx.clearRect(0, 0, width, height)

  const leftPad = 30
  const rightPad = 10
  const topPad = 10
  const bottomPad = 16
  const nutX = leftPad
  const rightX = width - rightPad
  const colW = (rightX - nutX) / (maxFret + 1)
  const usableH = height - topPad - bottomPad
  const rowStep = stringCount > 1 ? usableH / (stringCount - 1) : usableH / 2
  const rowY = (i: number) =>
    stringCount > 1 ? topPad + i * rowStep : topPad + usableH / 2
  // Column index for a fret, mirrored for left-handed players.
  const colCenterX = (fret: number) => {
    const pos = o.leftHanded ? maxFret - fret : fret
    return nutX + (pos + 0.5) * colW
  }

  // Fret wires.
  for (let k = 0; k <= maxFret + 1; k++) {
    const x = nutX + k * colW
    const isNut = o.leftHanded ? k === maxFret + 1 : k === 0
    ctx.beginPath()
    ctx.moveTo(x, rowY(0))
    ctx.lineTo(x, rowY(stringCount - 1))
    ctx.strokeStyle = isNut ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)'
    ctx.lineWidth = isNut ? 3 : 1
    ctx.stroke()
  }

  // Inlay markers between the middle strings.
  const midY = (rowY(0) + rowY(stringCount - 1)) / 2
  for (let f = 1; f <= maxFret; f++) {
    if (!isFretMarker(f)) continue
    const cx = colCenterX(f)
    const dots = DOUBLE_MARKERS.includes(f) ? [-rowStep, rowStep] : [0]
    for (const dy of dots) {
      ctx.beginPath()
      ctx.arc(cx, midY + dy, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fill()
    }
  }

  // Strings (coloured horizontal lines) + open-string label.
  for (let i = 0; i < stringCount; i++) {
    const y = rowY(i)
    const color = colorForString(o.stringColors, i)
    ctx.beginPath()
    ctx.moveTo(nutX, y)
    ctx.lineTo(rightX, y)
    ctx.strokeStyle = withAlpha(color, 0.55)
    ctx.lineWidth = 1 + i * 0.25
    ctx.stroke()
    const open = o.openMidi[i] ?? 40
    ctx.fillStyle = withAlpha(color, 0.9)
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(NOTE_NAMES[open % 12], leftPad / 2, y)
  }

  // Per-cell note names.
  if (o.showNoteNames && colW >= 15) {
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < stringCount; i++) {
      const open = o.openMidi[i] ?? 40
      const y = rowY(i)
      for (let f = 0; f <= maxFret; f++) {
        if (o.activeCells.has(cellKey(i, f))) continue
        ctx.fillStyle = 'rgba(255,255,255,0.32)'
        ctx.fillText(cellNoteName(open, f), colCenterX(f), y)
      }
    }
  }

  // Active cells (notes at the hit line) — filled chip + note name.
  for (let i = 0; i < stringCount; i++) {
    const open = o.openMidi[i] ?? 40
    const y = rowY(i)
    const color = colorForString(o.stringColors, i)
    for (let f = 0; f <= maxFret; f++) {
      if (!o.activeCells.has(cellKey(i, f))) continue
      const cx = colCenterX(f)
      const w = Math.min(colW * 0.86, 22)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cx, y, Math.min(w / 2, rowStep / 2 + 2), 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(10,10,16,0.95)'
      ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(cellNoteName(open, f), cx, y)
    }
  }

  // Fret position numbers along the bottom.
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const numberY = height - bottomPad / 2
  for (let f = 0; f <= maxFret; f++) {
    if (f !== 0 && !isFretMarker(f)) continue
    ctx.fillText(String(f), colCenterX(f), numberY)
  }
}
