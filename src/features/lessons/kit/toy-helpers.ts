// ============================================================
// Lesson toy helpers — sliders that sound while held, and the pitch rail
// ============================================================

import { TAU } from './dom'
import { COLOR, logPos } from './notes'

/** Paints a range input's filled part (the CSS reads --p and --fill). */
export function rangeFill(input: HTMLInputElement, color?: string): void {
  const min = Number(input.min)
  const max = Number(input.max)
  const p = ((Number(input.value) - min) / (max - min)) * 100
  input.style.setProperty('--p', `${p}%`)
  if (color !== undefined) input.style.setProperty('--fill', color)
}

/**
 * A slider that sounds while it is held: pointer down to up, or a run of
 * arrow keys (the note ends 0.7 s after the last key).
 */
export function holdToPlay(
  input: HTMLInputElement,
  handlers: { start: () => void; stop: () => void },
): void {
  let holding = false
  let keyTimer = 0
  const end = (): void => {
    if (!holding) return
    holding = false
    handlers.stop()
  }
  input.addEventListener('pointerdown', () => {
    if (holding) return
    holding = true
    handlers.start()
  })
  for (const ev of [
    'pointerup',
    'pointercancel',
    'lostpointercapture',
    'blur',
  ]) {
    input.addEventListener(ev, end)
  }
  window.addEventListener('pointerup', end)
  const keys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
  ]
  input.addEventListener('keydown', (e) => {
    if (!keys.includes(e.key)) return
    if (!holding) {
      holding = true
      handlers.start()
    }
    window.clearTimeout(keyTimer)
    keyTimer = window.setTimeout(end, 700)
  })
}

export interface RailSpec {
  x: number
  top: number
  bot: number
  /** The bead's frequency, Hz, on a 110 to 880 Hz log scale. */
  f: number
  glow?: number
  label?: boolean
}

/** A vertical pitch rail (110 to 880 Hz, octaves equally spaced) with a chrome bead; returns the bead's y. */
export function drawRail(
  ctx: CanvasRenderingContext2D,
  spec: RailSpec,
): number {
  const { x, top, bot, f } = spec
  const glow = spec.glow ?? 0
  const label = spec.label ?? true
  const yOf = (fr: number): number => bot - logPos(fr) * (bot - top)
  ctx.strokeStyle = 'rgba(195,204,214,.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, top - 6)
  ctx.lineTo(x, bot + 6)
  ctx.stroke()
  for (let s = 0; s <= 36; s++) {
    const octave = s % 12 === 0
    const y = yOf(110 * 2 ** (s / 12))
    const len = octave ? 8 : 3.5
    ctx.strokeStyle = octave ? 'rgba(195,204,214,.55)' : 'rgba(195,204,214,.22)'
    ctx.beginPath()
    ctx.moveTo(x - len, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
    if (octave && label) {
      ctx.fillStyle = COLOR.ink3
      ctx.font = '500 12px "JetBrains Mono", monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(110 * 2 ** (s / 12)), x - 13, y)
    }
  }
  const y = yOf(f)
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 22 + glow * 14)
  halo.addColorStop(0, `rgba(195,204,214,${0.35 + glow * 0.3})`)
  halo.addColorStop(1, 'rgba(195,204,214,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y, 22 + glow * 14, 0, TAU)
  ctx.fill()
  const bead = ctx.createRadialGradient(x - 2.5, y - 2.5, 1, x, y, 8)
  bead.addColorStop(0, '#ffffff')
  bead.addColorStop(0.5, COLOR.chrome)
  bead.addColorStop(1, '#5b6b7b')
  ctx.fillStyle = bead
  ctx.beginPath()
  ctx.arc(x, y, 7.5, 0, TAU)
  ctx.fill()
  return y
}

/** Strokes the current path twice: a wide faint glow, then the line itself. */
export function glowStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  alpha = 1,
): void {
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.12 * alpha
  ctx.lineWidth = width * 5
  ctx.stroke()
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.stroke()
  ctx.globalAlpha = 1
}
