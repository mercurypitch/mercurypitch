import { describe, expect, it } from 'vitest'
import type { Tap } from '../runtime/impact'
import { WORLD3D_CONFIG } from '../world3d-config'
import { createStageImpact } from './stage-impact'

/** A stage on a phone reporting DPR 3, whose taps and refits are kept. */
const stage = (): {
  impact: ReturnType<typeof createStageImpact>
  felt: Tap[]
  refits: { at: number; ratio: number }[]
  play(from: number, seconds: number, fps: number): void
} => {
  const felt: Tap[] = []
  const refits: { at: number; ratio: number }[] = []
  const impact = createStageImpact(
    () => WORLD3D_CONFIG.impact,
    (t) => felt.push(t),
    () => 3,
  )
  let now = 0
  impact.onBurst(() => refits.push({ at: now, ratio: impact.pixelRatio() }))
  return {
    impact,
    felt,
    refits,
    play(from, seconds, fps) {
      for (let k = 0; k <= seconds * fps; k++) {
        now = from + k / fps
        impact.frame(now)
      }
    },
  }
}

describe('a stage playing the break', () => {
  it('says nothing, and draws at the running cap, before any glass breaks', () => {
    const s = stage()
    expect(s.impact.frame(4)).toBeNull()
    expect(s.felt).toEqual([])
    expect(s.impact.pixelRatio()).toBe(1.5)
  })

  it('sends one heavy tap and three light ones, in order, at 30 fps', () => {
    const s = stage()
    s.impact.start(10)
    s.play(10, 2, 30)
    expect(s.felt).toEqual(['heavy', 'light', 'light', 'light'])
  })

  // §7.1: the ratio drops at the crack and comes back when the burst is
  // over, as two scripted steps -- not a controller settling over frames.
  it('drops the pixel ratio for the burst and restores it, refitting twice', () => {
    const s = stage()
    s.impact.start(10)
    s.play(10, 2, 60)
    expect(s.refits.map((r) => r.ratio)).toEqual([1, 1.5])
    expect(s.refits[0]!.at).toBe(10)
    expect(s.refits[1]!.at - 10).toBeCloseTo(1.2, 1)
  })

  it('starts the burst and the taps over when another pane breaks', () => {
    const s = stage()
    s.impact.start(0)
    s.play(0, 2, 60)
    s.impact.start(5)
    s.play(5, 2, 60)
    expect(s.felt.filter((t) => t === 'heavy')).toHaveLength(2)
    expect(s.refits.map((r) => r.ratio)).toEqual([1, 1.5, 1, 1.5])
  })
})
