// ============================================================
// CrackField — permanent damage, shared by BOTH backends.
//
// The physics decides WHEN cracks appear (crackStep thresholds);
// this module owns their geometry (seeded, normalized pane space)
// and their Canvas2D painting — the TypeGPU backend draws them on
// its transparent overlay, the lite backend directly. One field
// per glass: a new session builds a new renderer, hence new glass.
// ============================================================

/** Deterministic PRNG so crack layouts are stable per glass. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Crack {
  /** Polyline in pane-normalized coordinates (0..1 × 0..1). */
  points: Array<[number, number]>
  bornAt: number
}

export class CrackField {
  private cracks: Crack[] = []
  private rng = mulberry32(1234)
  private spawned = 0

  /** Spawn cracks until the visual count matches the physics' crackStep. */
  sync(crackStep: number): void {
    while (this.spawned < crackStep) {
      this.spawn()
      this.spawned++
    }
  }

  /** Paint all cracks (grow-in over ~0.4 s) into pane-pixel space. */
  draw(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
  ): void {
    if (this.cracks.length === 0) return
    c.lineWidth = 0.9
    c.shadowColor = 'rgba(180, 210, 255, 0.7)'
    c.shadowBlur = 3
    c.strokeStyle = 'rgba(226, 238, 255, 0.5)'
    for (const crack of this.cracks) {
      const growth = Math.min(1, (t - crack.bornAt) / 0.4)
      const count = Math.max(2, Math.ceil(crack.points.length * growth))
      c.beginPath()
      c.moveTo(crack.points[0][0] * width, crack.points[0][1] * height)
      for (let i = 1; i < count; i++) {
        c.lineTo(crack.points[i][0] * width, crack.points[i][1] * height)
      }
      c.stroke()
    }
    c.shadowBlur = 0
  }

  private spawn(): void {
    const rng = this.rng
    const fromRim = rng() < 0.6
    let x: number
    let y: number
    let angle: number
    if (fromRim) {
      const side = Math.floor(rng() * 4)
      if (side === 0) {
        x = rng()
        y = 0
        angle = Math.PI / 2
      } else if (side === 1) {
        x = rng()
        y = 1
        angle = -Math.PI / 2
      } else if (side === 2) {
        x = 0
        y = rng()
        angle = 0
      } else {
        x = 1
        y = rng()
        angle = Math.PI
      }
    } else {
      x = 0.3 + rng() * 0.4
      y = 0.5 + (rng() - 0.5) * 0.2 // near the target line
      angle = rng() * Math.PI * 2
    }
    const points: Array<[number, number]> = [[x, y]]
    let steps = 5 + Math.floor(rng() * 5)
    while (steps-- > 0) {
      angle += (rng() - 0.5) * 1.15
      const len = 0.04 + rng() * 0.08
      x = Math.max(0.01, Math.min(0.99, x + Math.cos(angle) * len))
      y = Math.max(0.01, Math.min(0.99, y + Math.sin(angle) * len))
      points.push([x, y])
    }
    this.cracks.push({ points, bornAt: performance.now() / 1000 })
    if (rng() < 0.5 && points.length > 3) {
      const branchFrom = points[1 + Math.floor(rng() * (points.length - 2))]
      let [bx, by] = branchFrom
      let branchAngle = angle + (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.6)
      const branch: Array<[number, number]> = [[bx, by]]
      for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
        branchAngle += (rng() - 0.5) * 1.0
        bx = Math.max(
          0.01,
          Math.min(0.99, bx + Math.cos(branchAngle) * (0.03 + rng() * 0.06)),
        )
        by = Math.max(
          0.01,
          Math.min(0.99, by + Math.sin(branchAngle) * (0.03 + rng() * 0.06)),
        )
        branch.push([bx, by])
      }
      this.cracks.push({ points: branch, bornAt: performance.now() / 1000 })
    }
  }
}
