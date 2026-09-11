import { describe, expect, it } from 'vitest'
import type { Tap } from '../runtime/impact'
import { WORLD3D_CONFIG } from '../world3d-config'
import { createStageImpact } from './stage-impact'

/** A stage on a phone reporting DPR 3, whose taps and refits are kept. */
const stage = (
  reduced = false,
): {
  impact: ReturnType<typeof createStageImpact>
  felt: Tap[]
  refits: { at: number; ratio: number }[]
  play(from: number, seconds: number, fps: number): void
} => {
  const felt: Tap[] = []
  const refits: { at: number; ratio: number }[] = []
  const impact = createStageImpact(() => WORLD3D_CONFIG.impact, {
    reduced: () => reduced,
    haptic: (t) => felt.push(t),
    screenRatio: () => 3,
  })
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

describe('under prefers-reduced-motion (P6)', () => {
  it('keeps every tap, at the same moments', () => {
    const full = stage()
    const calm = stage(true)
    full.impact.start(10)
    calm.impact.start(10)
    for (let k = 0; k <= 120; k++) {
      full.impact.frame(10 + k / 60)
      calm.impact.frame(10 + k / 60)
      expect(calm.felt).toEqual(full.felt)
    }
    expect(calm.felt).toEqual(['heavy', 'light', 'light', 'light'])
  })

  it('never steps the pixel ratio', () => {
    const s = stage(true)
    s.impact.start(10)
    s.play(10, 2, 60)
    expect(s.refits).toEqual([])
    expect(s.impact.pixelRatio()).toBe(1.5)
  })

  it('holds nothing still, shakes nothing, and flies the shards in half the time', () => {
    const s = stage(true)
    s.impact.start(10)
    const f = s.impact.frame(10.05)!
    // Inside what would have been the hitstop, and the shake's peak.
    expect(f.timeScale).toBe(1)
    expect(f.shake).toEqual({ yaw: 0, pitch: 0, roll: 0 })
    expect(f.shardSeconds).toBeCloseTo(0.1, 10)
  })

  // The setting can change with a world open; the break follows it on
  // the next frame, and a burst already begun is ended rather than kept.
  it('follows the setting when it changes mid-break', () => {
    let reduced = false
    const refits: number[] = []
    const impact = createStageImpact(() => WORLD3D_CONFIG.impact, {
      reduced: () => reduced,
      haptic: () => {},
      screenRatio: () => 3,
    })
    impact.onBurst(() => refits.push(impact.pixelRatio()))
    impact.start(0)
    expect(impact.frame(0.05)!.timeScale).toBe(0)
    reduced = true
    expect(impact.frame(0.06)!.timeScale).toBe(1)
    expect(refits).toEqual([1, 1.5])
  })

  // But not the shards. Their clock is the whole elapsed break played on
  // one config, so answering a switch with the other config would replay
  // the flight so far on it and move every shard in one frame. The break
  // they are in keeps the clock it started on; the next one flies by the
  // new setting.
  it('keeps the shards on the clock their break started on', () => {
    let reduced = false
    const impact = createStageImpact(() => WORLD3D_CONFIG.impact, {
      reduced: () => reduced,
      haptic: () => {},
      screenRatio: () => 3,
    })
    const frame = 1 / 60
    // Switched on half a second after the crack: 0.17 s of flight so far,
    // which the reduced clock would call a whole second.
    impact.start(0)
    const on = impact.frame(0.5)!.shardSeconds
    reduced = true
    const onNext = impact.frame(0.5 + frame)!.shardSeconds
    expect(onNext - on).toBeGreaterThanOrEqual(0)
    expect(onNext - on).toBeLessThanOrEqual(frame)
    // A reduced break switched off 3 s in: 6 s of flight, which the full
    // clock would call 2.7, and debris already settled would move again.
    impact.start(10)
    const off = impact.frame(13)!.shardSeconds
    expect(off).toBeCloseTo(6, 10)
    reduced = false
    const offNext = impact.frame(13 + frame)!.shardSeconds
    expect(offNext - off).toBeGreaterThanOrEqual(0)
    expect(offNext - off).toBeLessThanOrEqual(2 * frame + 1e-9)
  })
})
