// ============================================================
// Merc's hop held in place: the curve against the real simulation
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { HOP_MS } from '@/components/room-kit/merc-moves'
import type { MercState } from '@/lib/merc/constants'
import { Sim, STEP } from '@/lib/merc/sim'
import { canvasShare, holdHopInPlace, HOP_DRIFT_MS, hopDriftAt, hopDriftKeyframes, } from './hop-drift'

/**
 * His root across a path hop, units, every simulation step: standing, then
 * 'hop' for HOP_MS, then `after`, as path-motion.ts plays it.
 */
function rootThroughHop(after: MercState): { ms: number; x: number }[] {
  const sim = new Sim('idle')
  for (let i = 0; i < Math.round(0.5 / STEP); i += 1) sim.step(STEP)
  sim.setState('hop')
  const out: { ms: number; x: number }[] = [{ ms: 0, x: sim.rootX }]
  const hop = Math.round(HOP_MS / 1000 / STEP)
  const steps = Math.round(HOP_DRIFT_MS / 1000 / STEP) + 120
  for (let i = 1; i <= steps; i += 1) {
    if (i === hop + 1) sim.setState(after)
    sim.step(STEP)
    out.push({ ms: i * STEP * 1000, x: sim.rootX })
  }
  return out
}

describe("the hop's drift", () => {
  it.each<MercState>(['idle', 'celebrate'])(
    'follows the simulation through a hop and %s, within 0.006 units',
    (after) => {
      const root = rootThroughHop(after)
      const worst = Math.max(
        ...root.map(({ ms, x }) => Math.abs(hopDriftAt(ms) - x)),
      )
      // 0.006 units is 0.6 px on a 390 px phone's 233 px canvas.
      expect(worst).toBeLessThan(0.006)
      // He does drift: 0.38 units, 17% of his canvas, at its height.
      expect(Math.max(...root.map(({ x }) => x))).toBeCloseTo(0.38, 3)
      expect(canvasShare(0.38)).toBeCloseTo(0.1688, 4)
    },
  )

  it('slides his canvas left by that share of its width, and home again', () => {
    const frames = hopDriftKeyframes()
    expect(frames[0]).toEqual({ offset: 0, transform: 'translateX(0.000%)' })
    expect(frames.at(-1)).toEqual({
      offset: 1,
      transform: 'translateX(0.000%)',
    })
    const held = frames.find((frame) => frame.offset === HOP_MS / HOP_DRIFT_MS)
    expect(held?.transform).toBe('translateX(-16.883%)')
  })

  it('animates his canvas from the hop, and nothing without a canvas', () => {
    const canvas = document.createElement('canvas')
    const animation = {} as Animation
    const animate = vi.fn(() => animation)
    canvas.animate = animate

    expect(holdHopInPlace(canvas)).toBe(animation)
    expect(animate).toHaveBeenCalledWith(hopDriftKeyframes(), {
      duration: HOP_DRIFT_MS,
      easing: 'linear',
    })
    expect(holdHopInPlace(null)).toBeNull()
  })
})
