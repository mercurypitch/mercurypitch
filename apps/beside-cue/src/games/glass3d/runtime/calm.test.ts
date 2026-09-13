import { describe, expect, it } from 'vitest'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { Activity, CalmConfig, CalmState } from './calm'
import { createCalmState, stepCalm } from './calm'

const CFG: CalmConfig = { afterSeconds: 3, fps: 30 }
const STILL: Activity = { input: false, voiced: false, moving: false }

/** A little deterministic jitter, up to 0.8 ms either way: rAF frames are
 * never exactly on their spacing, and a rule that only works on a perfect
 * clock is a rule that hitches on a phone. */
const jitter = (k: number): number => (((k * 7919) % 5) - 2) * 0.0004

interface Run {
  drawn: boolean[]
  times: number[]
}

/** `seconds` of frames at `hz`, starting at `from`, asking `activityAt`
 * what happened on each. */
const run = (
  state: CalmState,
  from: number,
  seconds: number,
  hz: number,
  activityAt: (t: number) => Activity = () => STILL,
): Run => {
  const drawn: boolean[] = []
  const times: number[] = []
  const frames = Math.round(seconds * hz)
  for (let k = 0; k < frames; k++) {
    const t = from + k / hz + jitter(k)
    times.push(t)
    drawn.push(stepCalm(state, t, activityAt(t), CFG))
  }
  return { drawn, times }
}

const drawnPerSecond = (r: Run): number =>
  r.drawn.filter(Boolean).length /
  (r.times[r.times.length - 1]! - r.times[0]! + 1e-9)

describe('calm', () => {
  it('draws every frame while something is happening', () => {
    const state = createCalmState(0)
    const r = run(state, 0, 10, 60, () => ({ ...STILL, moving: true }))
    expect(r.drawn.every(Boolean)).toBe(true)
    expect(state.calm).toBe(false)
  })

  it('waits the configured stillness before calming, then halves a 60 Hz screen', () => {
    const state = createCalmState(0)
    const before = run(state, 0, CFG.afterSeconds - 0.05, 60)
    expect(before.drawn.every(Boolean)).toBe(true)
    expect(state.calm).toBe(false)

    const after = run(state, CFG.afterSeconds + 0.05, 4, 60)
    expect(state.calm).toBe(true)
    // Every second frame, and never two skipped in a row: a pattern that
    // skipped two would be 20 fps and a visible hitch.
    expect(drawnPerSecond(after)).toBeGreaterThan(29)
    expect(drawnPerSecond(after)).toBeLessThan(31)
    for (let k = 1; k < after.drawn.length; k++) {
      expect(after.drawn[k] || after.drawn[k - 1]).toBe(true)
    }
  })

  // Calm is a rate, not a ratio. A 120 Hz screen calms to 30, not 60, and
  // a phone that Low Power Mode already holds at 30 is left alone rather
  // than halved to 15.
  it.each([
    [90, 30],
    [120, 30],
    [30, 30],
  ])('calms a %i Hz screen to %i fps', (hz, fps) => {
    const state = createCalmState(0)
    run(state, 0, CFG.afterSeconds + 0.1, hz)
    const calm = run(state, CFG.afterSeconds + 0.2, 4, hz)
    expect(state.calm).toBe(true)
    expect(drawnPerSecond(calm)).toBeGreaterThan(fps - 1.5)
    expect(drawnPerSecond(calm)).toBeLessThan(fps + 1.5)
  })

  it.each([
    ['a touch or a key', { ...STILL, input: true }],
    ['a voiced frame', { ...STILL, voiced: true }],
  ] as const)('answers %s on the frame it arrives', (_what, poke) => {
    const state = createCalmState(0)
    run(state, 0, CFG.afterSeconds + 1, 60)
    expect(state.calm).toBe(true)

    // Find a frame calm would have skipped, and poke on exactly that one.
    let t = CFG.afterSeconds + 1
    while (stepCalm({ ...state }, t, STILL, CFG)) t += 1 / 60
    expect(stepCalm(state, t, poke, CFG)).toBe(true)
    expect(state.calm).toBe(false)

    // And full rate holds for the whole wait that follows it.
    const held = run(state, t + 1 / 60, CFG.afterSeconds - 0.1, 60)
    expect(held.drawn.every(Boolean)).toBe(true)
  })

  it('never calms while something moves, however long it goes on', () => {
    const state = createCalmState(0)
    const r = run(state, 0, 60, 60, () => ({ ...STILL, moving: true }))
    expect(r.drawn.every(Boolean)).toBe(true)
  })

  it('draws, and does not stall, when the clock jumps backwards', () => {
    const state = createCalmState(100)
    run(state, 100, CFG.afterSeconds + 1, 60)
    expect(state.calm).toBe(true)
    // A tab restored or a device waking can hand back an earlier time.
    // Skipping until the clock caught up with the last drawn frame would
    // freeze the screen for however long the jump was.
    expect(stepCalm(state, 50, STILL, CFG)).toBe(true)
    const next = run(state, 50 + 1 / 60, 1, 60)
    expect(next.drawn.every(Boolean)).toBe(true)
  })

  it('draws on a clock that is not a number', () => {
    const state = createCalmState(0)
    run(state, 0, CFG.afterSeconds + 1, 60)
    expect(stepCalm(state, Number.NaN, STILL, CFG)).toBe(true)
    expect(Number.isFinite(state.activeAt)).toBe(true)
  })

  // P3 as answered: three seconds of nothing, then half of 60.
  it('ships at three seconds and 30 fps', () => {
    expect(WORLD3D_CONFIG.calm).toEqual({ afterSeconds: 3, fps: 30 })
  })
})
