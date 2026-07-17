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

  // Wordmark.
  ctx.textAlign = 'center'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillStyle = CHROME
  const wordmarkY = format === 'story' ? 150 : 92
  ctx.fillText('M E R C U R Y P I T C H  ·  G L A S S', cx, wordmarkY)

  // The pane, frozen mid-burst (or intact when it held).
  const paneW = format === 'story' ? 620 : 480
  const paneH = format === 'story' ? 806 : 560
  const paneX = cx - paneW / 2
  const paneY = format === 'story' ? 260 : 170
  const shattered = input.shatterRep !== null
  drawFrozenPane(ctx, paneX, paneY, paneW, paneH, input.seed, shattered)

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
  ctx.fillText('mercurypitch.com/glass', cx, height - 60)

  return canvas
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
