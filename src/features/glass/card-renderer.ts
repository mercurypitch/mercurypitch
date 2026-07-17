// ============================================================
// Glass — the shareable shatter card (plan §10, P5).
//
// A canvas PNG in square (1:1, feeds) or story (9:16) format:
// the fractured pane frozen mid-burst as line art — drawn from
// the SAME deterministic fracture geometry as the live burst, so
// the card is literally this run's break — plus the honest data
// row and the campaign URL. Share/copy/download plumbing is
// reused from the mirror's card renderer.
// ============================================================

import type { CardFormat } from '@/features/mirror/card-renderer'
import { generateFracture, mulberry32, polyCentroid, } from '@/lib/glass/fracture'

export interface ShatterCardInput {
  targetLabel: string
  /** null → the glass held. */
  shatterRep: number | null
  reps: number
  bestLockSec: number
  precisionCents: number | null
  peakResonance: number
  /** Cross-visit delta line, if any. */
  sinceLine: string | null
  /** The run's burst seed — the card shows THIS break. */
  seed: number
}

const GOLD = '#ffe9a8'
const GOLD_DEEP = '#d4af6a'
const STARLIGHT = '#f4f8fd'
const CHROME = '#8a97a6'

export function renderShatterCard(
  input: ShatterCardInput,
  format: CardFormat,
): HTMLCanvasElement {
  const width = 1080
  const height = format === 'story' ? 1920 : 1080
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const cx = width / 2

  // Cosmic ground.
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, '#0b1026')
  bg.addColorStop(0.6, '#0a0a1e')
  bg.addColorStop(1, '#090714')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  const rng = mulberry32(input.seed ^ 0x51ca)
  for (let i = 0; i < 170; i++) {
    ctx.globalAlpha = 0.2 + rng() * 0.55
    ctx.fillStyle = '#dfe8ff'
    const r = 0.6 + rng() * 1.5
    ctx.beginPath()
    ctx.arc(rng() * width, rng() * height, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Wordmark in the brand logo colors: "Mercury" chrome-white, "Pitch" in
  // the spectrum gradient, "GLASS" as the quiet chrome tail.
  const wordmarkY = format === 'story' ? 150 : 86
  ctx.font = '600 42px system-ui, sans-serif'
  const wMercury = ctx.measureText('Mercury').width
  const wPitch = ctx.measureText('Pitch').width
  ctx.font = '600 26px system-ui, sans-serif'
  const wTail = ctx.measureText('  GLASS').width
  const total = wMercury + wPitch + wTail
  let penX = cx - total / 2
  ctx.textAlign = 'left'
  ctx.font = '600 42px system-ui, sans-serif'
  ctx.fillStyle = '#e6edf3'
  ctx.fillText('Mercury', penX, wordmarkY)
  penX += wMercury
  const spectrum = ctx.createLinearGradient(penX, 0, penX + wPitch, 0)
  spectrum.addColorStop(0, '#58a6ff')
  spectrum.addColorStop(0.5, '#2dd4bf')
  spectrum.addColorStop(1, '#bc8cff')
  ctx.fillStyle = spectrum
  ctx.fillText('Pitch', penX, wordmarkY)
  penX += wPitch
  ctx.font = '600 26px system-ui, sans-serif'
  ctx.fillStyle = CHROME
  ctx.fillText('  GLASS', penX, wordmarkY)
  ctx.textAlign = 'center'

  // The pane, frozen mid-burst (or intact when it held).
  const paneW = format === 'story' ? 620 : 460
  const paneH = format === 'story' ? 806 : 520
  const paneX = cx - paneW / 2
  const paneY = format === 'story' ? 260 : 150
  const shattered = input.shatterRep !== null
  drawFrozenPane(ctx, paneX, paneY, paneW, paneH, input.seed, shattered)
  drawRibbonAccent(ctx, paneX, paneY, paneW, paneH, input.seed, shattered)

  // Gold target line + note.
  const targetY = paneY + paneH / 2
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.8)'
  ctx.lineWidth = 3
  ctx.setLineDash([16, 18])
  ctx.beginPath()
  ctx.moveTo(paneX - 36, targetY)
  ctx.lineTo(paneX + paneW + 36, targetY)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillStyle = GOLD
  ctx.textAlign = 'left'
  ctx.fillText(input.targetLabel, paneX + paneW + 48, targetY + 12)
  ctx.textAlign = 'center'

  // Headline + data.
  const textTop = paneY + paneH + (format === 'story' ? 110 : 84)
  ctx.font = '700 72px system-ui, sans-serif'
  ctx.fillStyle = STARLIGHT
  ctx.fillText(
    shattered
      ? input.shatterRep === 1
        ? 'SHATTERED — FIRST TRY'
        : `SHATTERED ON REP ${input.shatterRep}`
      : 'THE GLASS HELD — THIS TIME',
    cx,
    textTop,
  )
  ctx.font = '600 40px system-ui, sans-serif'
  ctx.fillStyle = GOLD
  ctx.fillText(`at ${input.targetLabel}`, cx, textTop + 58)

  const stats: string[] = []
  stats.push(`${input.reps} rep${input.reps === 1 ? '' : 's'}`)
  if (input.bestLockSec >= 0.05)
    stats.push(`lock ${input.bestLockSec.toFixed(1)}s`)
  if (input.precisionCents !== null) stats.push(`±${input.precisionCents}¢`)
  stats.push(
    `resonance ${Math.round(Math.max(0, Math.min(1, input.peakResonance)) * 100)}%`,
  )
  ctx.font = '500 38px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(244, 248, 253, 0.82)'
  ctx.fillText(stats.join('  ·  '), cx, textTop + 128)

  if (input.sinceLine !== null) {
    ctx.font = '500 32px system-ui, sans-serif'
    ctx.fillStyle = GOLD_DEEP
    ctx.fillText(input.sinceLine, cx, textTop + 184)
  }

  ctx.font = '500 32px system-ui, sans-serif'
  ctx.fillStyle = '#8a86a8'
  ctx.fillText('mercurypitch.com/glass', cx, height - 76)

  return canvas
}

/** The living aqua ribbon (and its head) crossing the pane — locked onto
 *  the gold line when the glass broke, reaching for it when it held. */
function drawRibbonAccent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  shattered: boolean,
): void {
  const rng = mulberry32(seed ^ 0x7e11)
  const phase = rng() * Math.PI * 2
  const midY = y + h / 2
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 20)
  ctx.clip()
  const path = new Path2D()
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x + 14 + (w - 28) * t
    const settle = shattered ? Math.min(1, t * 1.6) : Math.min(1, t * 1.15)
    const wander =
      Math.sin(t * 5.2 + phase) * 0.5 + Math.sin(t * 11.4 + phase * 2) * 0.22
    const amp = (1 - settle) * h * 0.3 + (shattered ? 3 : 22)
    const py = midY + wander * amp + (shattered ? 0 : -h * 0.06 * (1 - t))
    if (i === 0) path.moveTo(px, py)
    else path.lineTo(px, py)
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#2dd4bf'
  ctx.shadowColor = '#2dd4bf'
  ctx.shadowBlur = 18
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 9
  ctx.stroke(path)
  ctx.globalAlpha = 0.95
  ctx.lineWidth = 3.2
  ctx.shadowBlur = 10
  ctx.stroke(path)
  ctx.shadowBlur = 0
  // The head, resting on (or near) the gold line.
  ctx.beginPath()
  ctx.arc(x + w - 14, shattered ? midY : midY - h * 0.0, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#2dd4bf'
  ctx.shadowColor = '#2dd4bf'
  ctx.shadowBlur = 14
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

/** The pane as chrome-lit line art: this run's exact fracture, each shard
 *  nudged outward from the impact when shattered; hairline-only when held. */
function drawFrozenPane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  shattered: boolean,
): void {
  // Glass body.
  const body = ctx.createLinearGradient(x, y, x + w, y + h)
  body.addColorStop(0, 'rgba(27, 36, 48, 0.5)')
  body.addColorStop(1, 'rgba(9, 7, 20, 0.55)')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 22)
  ctx.fill()

  // Fracture line art from the run's actual geometry.
  const impact: [number, number] = [w / 2, h / 2]
  const polygons = generateFracture(w, h, impact, seed, { maxShards: 90 })
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x - 60, y - 60, w + 120, h + 120, 22)
  ctx.clip()
  for (const poly of polygons) {
    const { cx: pcx, cy: pcy } = polyCentroid(poly)
    let dx = 0
    let dy = 0
    if (shattered) {
      const ddx = pcx - impact[0]
      const ddy = pcy - impact[1]
      const dist = Math.hypot(ddx, ddy) || 1
      const push = 10 + (1 - Math.min(1, dist / (h * 0.7))) * 26
      dx = (ddx / dist) * push
      dy = (ddy / dist) * push
    }
    ctx.beginPath()
    ctx.moveTo(x + poly[0][0] + dx, y + poly[0][1] + dy)
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(x + poly[i][0] + dx, y + poly[i][1] + dy)
    }
    ctx.closePath()
    ctx.strokeStyle = shattered
      ? 'rgba(226, 238, 255, 0.34)'
      : 'rgba(226, 238, 255, 0.16)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()

  // Chrome bevel frame.
  const frame = ctx.createLinearGradient(x, y, x + w, y + h)
  frame.addColorStop(0, '#c3ccd6')
  frame.addColorStop(0.4, '#5b6b7b')
  frame.addColorStop(0.7, '#8a97a6')
  frame.addColorStop(1, '#1b2430')
  ctx.strokeStyle = frame
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 22)
  ctx.stroke()
}
