import { describe, expect, it } from 'vitest'
import { WORLD3D_CONFIG } from '../world3d-config'
import { createLoopState, runLoop } from './loop'

const L = WORLD3D_CONFIG.loop

/** Collect the dt of every step the loop runs. */
const record = () => {
  const dts: number[] = []
  return { dts, step: (dt: number) => dts.push(dt) }
}

describe('the fixed-step loop', () => {
  it('always steps by exactly the configured amount', () => {
    const state = createLoopState()
    const { dts, step } = record()
    // Three wildly different frame times.
    runLoop(state, 1 / 60, L, step)
    runLoop(state, 1 / 30, L, step)
    runLoop(state, 0.007, L, step)
    expect(dts.length).toBeGreaterThan(0)
    for (const dt of dts) expect(dt).toBe(L.stepSeconds)
  })

  it('gives a slow frame more steps than a fast one', () => {
    const fast = createLoopState()
    const slow = createLoopState()
    const a = record()
    const b = record()
    runLoop(fast, 1 / 120, L, a.step)
    runLoop(slow, 1 / 30, L, b.step)
    expect(b.dts.length).toBeGreaterThan(a.dts.length)
  })

  it('banks leftover time instead of losing it', () => {
    const state = createLoopState()
    const { dts, step } = record()
    // Two-thirds of a step each; the second frame should complete one.
    const two3 = L.stepSeconds * (2 / 3)
    runLoop(state, two3, L, step)
    expect(dts).toHaveLength(0)
    runLoop(state, two3, L, step)
    expect(dts).toHaveLength(1)
  })

  it('keeps simulation time in step with what it simulated', () => {
    const state = createLoopState()
    const { dts, step } = record()
    for (let i = 0; i < 20; i++) runLoop(state, 1 / 60, L, step)
    expect(state.simTime).toBeCloseTo(dts.length * L.stepSeconds, 10)
  })

  it('drops time rather than spiralling after a long stall', () => {
    const state = createLoopState()
    const { dts, step } = record()
    // A two-second hitch: a queue would owe 240 steps at 120 Hz.
    const result = runLoop(state, 2, L, step)

    expect(result.steps).toBe(L.maxStepsPerFrame)
    expect(dts).toHaveLength(L.maxStepsPerFrame)
    expect(state.droppedSteps).toBeGreaterThan(0)
    // And the debt does not survive into the next frame.
    expect(state.accumulator).toBeLessThan(L.stepSeconds)
  })

  it('reports how far past the last step the renderer should draw', () => {
    const state = createLoopState()
    const { step } = record()
    const result = runLoop(state, L.stepSeconds * 1.5, L, step)
    expect(result.alpha).toBeGreaterThanOrEqual(0)
    expect(result.alpha).toBeLessThan(1)
    expect(result.alpha).toBeCloseTo(0.5, 6)
  })

  it('never runs the simulation backwards', () => {
    const state = createLoopState()
    const { dts, step } = record()
    // A clock that jumps back — a restored tab, a device waking.
    runLoop(state, -5, L, step)
    expect(dts).toHaveLength(0)
    expect(state.simTime).toBe(0)
    expect(state.accumulator).toBe(0)
  })

  it('survives a NaN frame time', () => {
    const state = createLoopState()
    const { dts, step } = record()
    runLoop(state, Number.NaN, L, step)
    expect(dts).toHaveLength(0)
    expect(Number.isFinite(state.accumulator)).toBe(true)
  })

  it('hands the step its own simulation time', () => {
    const state = createLoopState()
    const times: number[] = []
    runLoop(state, L.stepSeconds * 3, L, (_dt, simTime) => times.push(simTime))
    expect(times).toEqual([0, L.stepSeconds, L.stepSeconds * 2])
  })

  // The spiral guard has a frame rate written into it, and nothing else
  // in the codebase says the number out loud. These two pin it, because
  // HallwayStage's comment cites it as the reason the shatter is played
  // back on wall time instead of on this clock -- and a comment citing a
  // number that a config change has quietly moved is worse than no
  // comment at all.
  const SLOWEST_REAL_TIME_FPS = 1 / (L.stepSeconds * L.maxStepsPerFrame)

  it('keeps up with real time down to 24fps and no further', () => {
    expect(SLOWEST_REAL_TIME_FPS).toBeCloseTo(24, 5)

    const state = createLoopState()
    const frame = 1 / SLOWEST_REAL_TIME_FPS
    for (let i = 0; i < 60; i++) runLoop(state, frame, L, () => {})

    // Sixty frames of real time, and the simulation has spent all of it.
    expect(state.simTime).toBeCloseTo(frame * 60, 5)
    expect(state.droppedSteps).toBe(0)
  })

  it('runs in slow motion below that, and says so', () => {
    const state = createLoopState()
    const fps = 15
    const frame = 1 / fps
    for (let i = 0; i < 60; i++) runLoop(state, frame, L, () => {})

    // Four seconds of wall time bought 2.5 seconds of simulation: at
    // 15fps the world moves at 62% of the speed it was tuned at.
    const wall = frame * 60
    expect(state.simTime).toBeCloseTo(2.5, 5)
    expect(state.simTime / wall).toBeCloseTo(0.625, 3)
    expect(state.droppedSteps).toBeGreaterThan(0)
  })
})
