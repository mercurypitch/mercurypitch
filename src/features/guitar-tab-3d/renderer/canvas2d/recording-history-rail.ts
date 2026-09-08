// Recording rail labels distinguish captured history from a rehearsal hit line.
import { RECORDING_NOW_DEPTH } from '../recording-history'
import { TAB_FLOOR_DEPTH } from './highway-geometry'

interface HistoryRailGeometry {
  project(x: number, y: number, z: number): { x: number; y: number; w: number }
  laneX(x: number, depth: number): number
  left: number
  right: number
  floorY: number
}

export function drawRecordingHistoryRail(
  ctx: CanvasRenderingContext2D,
  geometry: HistoryRailGeometry,
): void {
  ctx.save()
  for (const depth of [RECORDING_NOW_DEPTH, 0]) {
    const left = geometry.project(
      geometry.laneX(geometry.left, depth),
      geometry.floorY,
      -depth * TAB_FLOOR_DEPTH,
    )
    const right = geometry.project(
      geometry.laneX(geometry.right, depth),
      geometry.floorY,
      -depth * TAB_FLOOR_DEPTH,
    )
    if (left.w <= 0.1 || right.w <= 0.1) continue
    const now = depth !== 0
    ctx.beginPath()
    ctx.moveTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.strokeStyle = now ? '#89cfc4' : 'rgba(137,207,196,0.18)'
    ctx.lineWidth = now ? 2 : 1
    ctx.stroke()
    ctx.font = `${now ? 600 : 400} ${now ? 12 : 11}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const label = now ? 'NOW · You played' : 'History'
    const y = (left.y + right.y) / 2 - 9
    const width = ctx.measureText(label).width
    // The tape deck occupies the lower-left corner on phones. Keep the
    // history caption on the opposite edge; NOW stays centred on the runway.
    const x = now
      ? (left.x + right.x) / 2
      : Math.max(left.x, right.x) - width / 2 - 7
    ctx.fillStyle = 'rgba(12,15,15,0.94)'
    ctx.fillRect(x - width / 2 - 7, y - 16, width + 14, 21)
    ctx.fillStyle = now ? '#a9e1d8' : '#cdc7bb'
    ctx.fillText(label, x, y)
  }
  ctx.restore()
}
