// ============================================================
// ShardBurst — the shatter compositor, shared by both backends.
//
// Takes a snapshot of the pane's final pixels, fractures it with
// the deterministic geometry (src/lib/glass/fracture), and
// animates the shards with the prototype's affine-projected 3D
// tumble: slow-mo per the performance-scaled timeline, glassy
// body tint, facing-dependent brightness, edge glints, dust and
// the white flash. Runs on a Canvas2D context — the Canvas
// backend draws it on its main canvas; the TypeGPU backend on
// its transparent overlay above a snapshot of the GPU pane.
// ============================================================

import type { Point, ShardBody, ShatterTimeline } from '@/lib/glass/fracture'
import { buildShardBodies, computeShatterTimeline, generateFracture, stepShardBodies, } from '@/lib/glass/fracture'
import { mulberry32 } from '@/lib/glass/fracture'

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

export interface ShardBurstOptions {
  epicness: number
  seed: number
  /** Impact point in pane CSS-pixel space. */
  impact: Point
  reduceMotion: boolean
}

export class ShardBurst {
  readonly timeline: ShatterTimeline
  private snapshot: HTMLCanvasElement
  private bodies: ShardBody[]
  private dust: Dust[]
  private width: number
  private height: number
  private startedAt: number | null = null
  private lastFrameAt: number | null = null
  private elapsed = 0
  private reduceMotion: boolean

  /**
   * `snapshot` must already contain the pane's final pixels at device
   * resolution; `width`/`height` are the pane's CSS-pixel size.
   */
  constructor(
    snapshot: HTMLCanvasElement,
    width: number,
    height: number,
    options: ShardBurstOptions,
  ) {
    this.snapshot = snapshot
    this.width = width
    this.height = height
    this.reduceMotion = options.reduceMotion
    this.timeline = computeShatterTimeline(options.epicness, undefined, {
      reduceMotion: options.reduceMotion,
    })
    const polygons = generateFracture(
      width,
      height,
      options.impact,
      options.seed,
      {
        maxShards: options.reduceMotion ? 48 : undefined,
      },
    )
    this.bodies = buildShardBodies(
      polygons,
      options.impact,
      height,
      options.seed,
      {
        reduceMotion: options.reduceMotion,
      },
    )
    const rng = mulberry32(options.seed ^ 0x9e3779b9)
    const dustCount = options.reduceMotion ? 14 : 46
    this.dust = Array.from({ length: dustCount }, () => ({
      x: options.impact[0] + (rng() - 0.5) * width * 0.4,
      y: options.impact[1] + (rng() - 0.5) * 60,
      vx: (rng() - 0.5) * 500,
      vy: -rng() * 320,
      size: 1 + rng() * 1.6,
      alpha: 0.9,
    }))
  }

  /** Seconds since the burst began (0 before the first draw). */
  age(): number {
    return this.elapsed
  }

  /**
   * Draw one frame onto `ctx` (already transformed to CSS pixels).
   * Returns false once the burst has fully settled/faded.
   */
  draw(ctx: CanvasRenderingContext2D, nowSeconds: number): boolean {
    if (this.startedAt === null) {
      this.startedAt = nowSeconds
      this.lastFrameAt = nowSeconds
    }
    const rawDt = Math.min(0.05, nowSeconds - (this.lastFrameAt ?? nowSeconds))
    this.lastFrameAt = nowSeconds
    this.elapsed = nowSeconds - this.startedAt
    const scale = this.timeline.timeScaleAt(this.elapsed)
    const dt = rawDt * scale

    stepShardBodies(this.bodies, dt)

    const focal = 900
    let visible = false
    for (const body of this.bodies) {
      const perspective = focal / Math.max(220, focal + body.z)
      const ca = Math.cos(body.axisAngle)
      const sa = Math.sin(body.axisAngle)
      const cr = Math.cos(body.rot)
      // Affine approximation of the 3D rotation about the in-plane axis.
      const a = (ca * ca + sa * sa * cr) * perspective
      const b = ca * sa * (1 - cr) * perspective
      const c = ca * sa * (1 - cr) * perspective
      const d = (sa * sa + ca * ca * cr) * perspective
      const facing = Math.abs(cr) * 0.85 + 0.15
      const alpha = Math.max(0, Math.min(1, 1.15 - this.elapsed * 0.28))
      if (alpha <= 0.01 || body.y > this.height * 2.2) continue
      visible = true

      ctx.save()
      ctx.transform(a, b, c, d, body.x, body.y)
      const path = new Path2D()
      path.moveTo(body.local[0][0], body.local[0][1])
      for (let i = 1; i < body.local.length; i++) {
        path.lineTo(body.local[i][0], body.local[i][1])
      }
      path.closePath()
      ctx.clip(path)
      // Glassy body tint so shards read against the void…
      ctx.globalAlpha = alpha
      ctx.fillStyle = `rgba(182, 198, 216, ${0.12 * facing})`
      ctx.fill(path)
      // …then the pane's actual pixels.
      ctx.globalAlpha = alpha * facing
      ctx.drawImage(
        this.snapshot,
        -body.snapX,
        -body.snapY,
        this.width,
        this.height,
      )
      // Edge glint.
      ctx.globalAlpha =
        Math.max(0, Math.min(1, 1 - this.elapsed * 0.3)) * (0.5 + facing * 0.5)
      ctx.strokeStyle = 'rgba(230, 240, 255, 0.85)'
      ctx.lineWidth = 0.8 / Math.max(0.3, perspective)
      ctx.stroke(path)
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // Glint dust.
    for (const grain of this.dust) {
      grain.vy += 700 * dt
      grain.x += grain.vx * dt
      grain.y += grain.vy * dt
      grain.alpha -= dt * 0.7
      if (grain.alpha <= 0) continue
      visible = true
      ctx.globalAlpha = grain.alpha
      ctx.fillStyle = '#eaf3ff'
      ctx.fillRect(grain.x, grain.y, grain.size, grain.size * 2.4)
    }
    ctx.globalAlpha = 1

    // The white flash at impact.
    if (!this.reduceMotion && this.elapsed < this.timeline.flashSeconds) {
      const flash = (1 - this.elapsed / this.timeline.flashSeconds) * 0.5
      ctx.fillStyle = `rgba(244, 248, 253, ${flash})`
      ctx.fillRect(-40, -40, this.width + 80, this.height + 80)
    }

    return visible
  }
}
