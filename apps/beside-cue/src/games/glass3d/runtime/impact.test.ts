import { describe, expect, it } from 'vitest'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { ImpactConfig, Tap } from './impact'
import { burstAt, createImpactTrack, pixelRatioFor, presentTimeAt, shakeAt, tapsBetween, timeScaleAt, } from './impact'

const CFG: ImpactConfig = WORLD3D_CONFIG.impact

const shaking = (t: number): boolean => {
  const s = shakeAt(t, CFG)
  return s.yaw !== 0 || s.pitch !== 0 || s.roll !== 0
}

describe('the timeline, in order', () => {
  // §7.1 as P4 chose it, read back off the functions themselves at one
  // millisecond a step rather than off a list somebody could forget to
  // keep in step with them.
  it('runs crack, hitstop, slow motion, shake, full speed, burst, in that order', () => {
    const seen: [number, string][] = []
    const note = (t: number, what: string): void => {
      if (!seen.some(([, w]) => w === what)) seen.push([t, what])
    }
    let taps = 0
    for (let ms = 0; ms <= 1500; ms++) {
      const t = ms / 1000
      const prev = (ms - 1) / 1000
      if (timeScaleAt(t, CFG) > 0) note(t, 'hitstop ends')
      if (timeScaleAt(t, CFG) > CFG.slowScale) note(t, 'slow motion ends')
      if (timeScaleAt(t, CFG) === 1 && t > 0) note(t, 'full speed')
      if (!shaking(t) && t > 0) note(t, 'shake ends')
      if (!burstAt(t, CFG)) note(t, 'burst ends')
      // After the state, so a tap on the same millisecond lists second:
      // the first light tap lands on the hitstop's end and the last on
      // the ramp's, by design. The moments themselves are pinned below.
      for (const tap of tapsBetween(ms === 0 ? -1 : prev, t, CFG)) {
        taps += 1
        note(t, `${tap} ${taps}`)
      }
    }
    expect(seen.map(([, what]) => what)).toEqual([
      'heavy 1',
      'hitstop ends',
      'light 2',
      'light 3',
      'slow motion ends',
      'shake ends',
      'full speed',
      'light 4',
      'burst ends',
    ])
    const at = Object.fromEntries(seen.map(([t, what]) => [what, t]))
    expect(at['heavy 1']).toBe(0)
    expect(at['hitstop ends']).toBeCloseTo(0.1, 3)
    expect(at['light 2']).toBeCloseTo(0.1, 3)
    expect(at['light 3']).toBeCloseTo(0.3, 3)
    expect(at['shake ends']).toBeCloseTo(0.4, 3)
    expect(at['full speed']).toBeCloseTo(0.55, 3)
    expect(at['light 4']).toBeCloseTo(0.55, 3)
    expect(at['burst ends']).toBeCloseTo(1.2, 3)
  })

  it('holds the glass still through the hitstop and crawls at 0.35x after it', () => {
    expect(presentTimeAt(0.05, CFG)).toBe(0)
    expect(presentTimeAt(0.1, CFG)).toBe(0)
    expect(timeScaleAt(0.2, CFG)).toBeCloseTo(0.35, 10)
    expect(presentTimeAt(0.35, CFG)).toBeCloseTo(0.25 * 0.35, 10)
  })

  // What the timeline costs the shards: the flight finishes later by
  // exactly the time the timeline took away, and then runs at full speed.
  it('is back on full speed after the ramp, a fixed lag behind the wall', () => {
    const lag = 1 - presentTimeAt(1, CFG)
    expect(presentTimeAt(2, CFG)).toBeCloseTo(2 - lag, 10)
    // Hitstop, the slow stretch's shortfall, and half the ramp's.
    expect(lag).toBeCloseTo(0.1 + 0.25 * 0.65 + 0.2 * 0.65 * 0.5, 10)
  })

  it('never runs the shards backwards, even with the dials dragged out of order', () => {
    const tangled: ImpactConfig = {
      ...CFG,
      hitstopSeconds: 0.4,
      slowUntilSeconds: 0.2,
      rampUntilSeconds: 0.1,
    }
    let last = -1
    for (let ms = 0; ms <= 2000; ms += 5) {
      const seen = presentTimeAt(ms / 1000, tangled)
      expect(seen).toBeGreaterThanOrEqual(last)
      last = seen
    }
  })
})

describe('durations, not frames', () => {
  interface Played {
    /** Wall time each event was first seen at. */
    at: Record<string, number>
    /** Every tap, in the order felt. */
    taps: Tap[]
    /** Shard seconds at the wall time both clocks share. */
    shardsAt1s: number
  }

  /** Run a break on a clock of `fps`, the way a stage does: one `frame`
   * per rendered frame, times read off the wall. */
  const play = (fps: number): Played => {
    const track = createImpactTrack()
    const breakAt = 10
    track.start(breakAt)
    const at: Record<string, number> = {}
    const taps: Tap[] = []
    const first = (what: string, t: number): void => {
      if (at[what] === undefined) at[what] = t
    }
    let shardsAt1s = Number.NaN
    for (let k = 0; k <= fps * 2; k++) {
      const wall = breakAt + k / fps
      const f = track.frame(wall, CFG)!
      taps.push(...f.taps)
      f.taps.forEach((tap, i) => first(`${tap}@${taps.length - i}`, f.since))
      if (f.timeScale > 0) first('moving', f.since)
      if (f.timeScale === 1 && f.since > 0) first('full speed', f.since)
      if (!f.burst) first('burst over', f.since)
      if (f.shake.yaw === 0 && f.shake.roll === 0 && f.since > 0) {
        first('still', f.since)
      }
      if (Math.abs(f.since - 1) < 1e-9) shardsAt1s = f.shardSeconds
    }
    return { at, taps, shardsAt1s }
  }

  // The whole point, §7.1: iOS halves the frame rate in Low Power Mode,
  // and the break must take as long at 30 as at 60 -- not twice as long.
  it('plays at 30 fps for the same wall duration as at 60', () => {
    const sixty = play(60)
    const thirty = play(30)
    expect(thirty.taps).toEqual(sixty.taps)
    expect(Object.keys(thirty.at).sort()).toEqual(Object.keys(sixty.at).sort())
    for (const what of Object.keys(sixty.at)) {
      // Seen on the first frame at or after its moment: never more than
      // one 30 fps frame apart, never early.
      expect(Math.abs(thirty.at[what]! - sixty.at[what]!)).toBeLessThanOrEqual(
        1 / 30 + 1e-9,
      )
    }
    expect(thirty.at['burst over']).toBeCloseTo(1.2, 1)
    // And the shards are in the same place at the same wall time.
    expect(thirty.shardsAt1s).toBeCloseTo(sixty.shardsAt1s, 12)
  })

  it('feels every tap once, in order: one heavy and three light', () => {
    for (const fps of [24, 30, 60, 120]) {
      expect(play(fps).taps).toEqual(['heavy', 'light', 'light', 'light'])
    }
  })

  it('feels a tap once even when two frames straddle nothing', () => {
    const track = createImpactTrack()
    track.start(0)
    expect(track.frame(0, CFG)!.taps).toEqual(['heavy'])
    expect(track.frame(0, CFG)!.taps).toEqual([])
    expect(track.frame(0.05, CFG)!.taps).toEqual([])
    // A stalled frame that jumps past two moments feels both, in order.
    expect(track.frame(0.31, CFG)!.taps).toEqual(['light', 'light'])
  })

  it('answers nothing before the glass has broken', () => {
    expect(createImpactTrack().frame(5, CFG)).toBeNull()
  })

  it('starts over when a second pane breaks', () => {
    const track = createImpactTrack()
    track.start(0)
    track.frame(2, CFG)
    track.start(5)
    const f = track.frame(5, CFG)!
    expect(f.since).toBe(0)
    expect(f.taps).toEqual(['heavy'])
    expect(f.burst).toBe(true)
  })
})

describe('the shake', () => {
  it('is still before the crack and after its length', () => {
    expect(shaking(-0.01)).toBe(false)
    expect(shaking(CFG.shakeSeconds)).toBe(false)
    expect(shaking(1)).toBe(false)
  })

  it('stays inside its amplitude and dies away as trauma squared', () => {
    const peak = (from: number, to: number): number => {
      let m = 0
      for (let t = from; t < to; t += 0.001) {
        const s = shakeAt(t, CFG)
        m = Math.max(m, Math.abs(s.yaw), Math.abs(s.pitch))
      }
      return m
    }
    const limit = (CFG.shakeDegrees * Math.PI) / 180
    const early = peak(0, CFG.shakeSeconds / 4)
    const late = peak((CFG.shakeSeconds * 3) / 4, CFG.shakeSeconds)
    expect(early).toBeLessThanOrEqual(limit + 1e-12)
    expect(early).toBeGreaterThan(limit * 0.5)
    // The last quarter carries at most (1/4)^2 of the trauma.
    expect(late).toBeLessThanOrEqual(limit / 16 + 1e-12)
  })

  it('shakes the same way every time', () => {
    expect(shakeAt(0.123, CFG)).toEqual(shakeAt(0.123, CFG))
  })
})

describe('the pixel ratio', () => {
  it('drops a phone from the running cap to the burst ratio, and back', () => {
    expect(pixelRatioFor(3, false, CFG)).toBe(1.5)
    expect(pixelRatioFor(3, true, CFG)).toBe(1)
  })

  it('never raises a screen already below the burst ratio', () => {
    expect(pixelRatioFor(1, true, CFG)).toBe(1)
    expect(pixelRatioFor(0.75, true, CFG)).toBe(0.75)
  })

  it('survives a device ratio that is not a number', () => {
    expect(pixelRatioFor(Number.NaN, false, CFG)).toBe(1)
  })
})
