// ============================================================
// Stage paint — the keyboard strip and the falling note glyphs
// ============================================================
//
// Canvas drawing for the mic check's stage below and around the ribbon.
// Separate from the stage component so the component is lifecycle only, and
// from note-rain.ts so the physics stays free of a canvas.

import { midiToNoteName } from '@/lib/frequency-to-note'
import { noteColor } from '@/lib/note-utils'
import type { KeyRect } from './keyboard-strip'
import type { RainNote, RainSpark } from './note-rain'
import { sparkStrength } from './note-rain'

export interface StageInk {
  /** White keys at rest. */
  keyLight: string
  /** Black keys at rest. */
  keyDark: string
  /** Seams between white keys. */
  keySeam: string
  /** Note names on the strip and beside onset glyphs. */
  text: string
}

export const DARK_STAGE_INK: StageInk = {
  keyLight: 'rgba(255, 255, 255, 0.16)',
  keyDark: 'rgba(0, 0, 0, 0.55)',
  keySeam: 'rgba(0, 0, 0, 0.45)',
  text: 'rgba(255, 255, 255, 0.92)',
}

export const LIGHT_STAGE_INK: StageInk = {
  keyLight: 'rgba(255, 255, 255, 0.95)',
  keyDark: 'rgba(30, 35, 42, 0.82)',
  keySeam: 'rgba(30, 35, 42, 0.18)',
  text: 'rgba(20, 24, 30, 0.9)',
}

/** How long a key glows after a note lands on it, in seconds. */
export const KEY_FLASH_S = 0.35

export interface KeyLight {
  /** The held note's key, lit steadily. */
  held: number | null
  /** Keys a note landed on recently, with how much glow they have left (0..1). */
  flashes: ReadonlyMap<number, number>
}

/** Mix a #rrggbb colour with an alpha, for fills over the strip. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  if (hex.length !== 7 || Number.isNaN(value)) return hex
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

/** How lit a key is: 1 for the held note, else what its last landing left. */
const keyGlow = (midi: number, light: KeyLight): number =>
  midi === light.held ? 1 : (light.flashes.get(midi) ?? 0)

/** Name the Cs, so the strip reads as octaves at a glance. */
function drawOctaveNames(
  ctx: CanvasRenderingContext2D,
  keys: readonly KeyRect[],
  top: number,
  height: number,
): void {
  const fontSize = Math.max(8, Math.min(11, height * 0.3))
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = withAlpha('#808890', 0.9)
  const named = keys.filter(
    (key) => !key.black && key.midi % 12 === 0 && key.width >= fontSize * 1.4,
  )
  for (const key of named) {
    ctx.fillText(
      midiToNoteName(key.midi),
      key.x + key.width / 2,
      top + height - 2,
    )
  }
}

export function drawKeys(
  ctx: CanvasRenderingContext2D,
  keys: readonly KeyRect[],
  top: number,
  height: number,
  light: KeyLight,
  ink: StageInk,
): void {
  for (const key of keys) {
    const keyHeight = key.black ? height * 0.62 : height
    ctx.fillStyle = key.black ? ink.keyDark : ink.keyLight
    ctx.fillRect(key.x, top, key.width, keyHeight)
    const glow = keyGlow(key.midi, light)
    if (glow > 0) {
      ctx.fillStyle = withAlpha(noteColor(key.midi), 0.35 + glow * 0.55)
      ctx.fillRect(key.x, top, key.width, keyHeight)
    }
    if (!key.black) {
      ctx.fillStyle = ink.keySeam
      ctx.fillRect(key.x + key.width - 0.5, top, 1, height)
    }
  }
  drawOctaveNames(ctx, keys, top, height)
}

/**
 * One falling note: an eighth note — a tilted head, a stem and a flag —
 * in its pitch's colour, with the note's name beside the glyph that marked
 * the onset.
 */
export function drawRainNote(
  ctx: CanvasRenderingContext2D,
  note: RainNote,
  ink: StageInk,
): void {
  const size = note.size
  const colour = noteColor(note.midi)
  ctx.save()
  ctx.translate(note.x, note.y)
  ctx.rotate(note.angle)

  const headRx = size * 0.3
  const headRy = size * 0.21
  const headY = size * 0.28
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.ellipse(0, headY, headRx, headRy, -0.35, 0, Math.PI * 2)
  ctx.fill()

  const stemX = headRx * 0.86
  const stemTop = headY - size * 0.82
  ctx.strokeStyle = colour
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1.5, size * 0.09)
  ctx.beginPath()
  ctx.moveTo(stemX, headY - headRy * 0.4)
  ctx.lineTo(stemX, stemTop)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(stemX, stemTop)
  ctx.bezierCurveTo(
    stemX + size * 0.42,
    stemTop + size * 0.18,
    stemX + size * 0.36,
    stemTop + size * 0.44,
    stemX + size * 0.16,
    stemTop + size * 0.56,
  )
  ctx.stroke()

  if (note.label !== null) {
    ctx.rotate(-note.angle)
    ctx.font = `700 ${Math.round(size * 0.62)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ink.text
    ctx.fillText(note.label, stemX + size * 0.5, 0)
  }
  ctx.restore()
}

export function drawSparks(
  ctx: CanvasRenderingContext2D,
  sparks: readonly RainSpark[],
): void {
  for (const spark of sparks) {
    const strength = sparkStrength(spark)
    ctx.fillStyle = withAlpha(noteColor(spark.midi), strength)
    ctx.beginPath()
    ctx.arc(spark.x, spark.y, 1 + strength * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}
