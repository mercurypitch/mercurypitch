import { describe, expect, it } from 'vitest'
import { createOneEuro } from './one-euro'

const DT = 0.01 // 100 fps

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
}

describe('createOneEuro', () => {
  it('passes a constant signal through unchanged', () => {
    const f = createOneEuro()
    let t = 0
    let out = 0
    for (let i = 0; i < 50; i++) {
      out = f.filter(60, t)
      t += DT
    }
    expect(out).toBeCloseTo(60, 6)
  })

  it('reduces jitter variance', () => {
    const f = createOneEuro({ minCutoff: 1.0, beta: 0.01 })
    let t = 0
    const noisy: number[] = []
    const smooth: number[] = []
    // Deterministic pseudo-noise around 57.
    for (let i = 0; i < 200; i++) {
      const n = 57 + 0.5 * Math.sin(i * 12.9898) * Math.cos(i * 3.233)
      noisy.push(n)
      smooth.push(f.filter(n, t))
      t += DT
    }
    // Compare steady-state (drop warmup).
    expect(variance(smooth.slice(50))).toBeLessThan(variance(noisy.slice(50)))
  })

  it('converges toward a stepped target', () => {
    const f = createOneEuro({ minCutoff: 1.0, beta: 0.05 })
    let t = 0
    f.filter(48, t)
    t += DT
    let out = 48
    for (let i = 0; i < 40; i++) {
      out = f.filter(60, t)
      t += DT
    }
    expect(out).toBeGreaterThan(59.5)
  })

  it('guards against zero/non-monotonic dt without throwing', () => {
    const f = createOneEuro()
    expect(f.filter(60, 1)).toBe(60)
    expect(Number.isFinite(f.filter(61, 1))).toBe(true) // same timestamp
  })
})
