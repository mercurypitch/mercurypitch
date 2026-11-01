// Studio transport count-in — a Play asked to wait for a count-in is heard on the count-in's last frame, built fresh or kept, and says where it sits on the clock.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes } from '../memory-budget'
import { FIRST_HEARD, transportFixture } from './transport.test-fixtures'

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

/** How many frames of the fixture's 44.1 kHz clock two times are apart. */
const framesApart = (a: number, b: number) => Math.abs(a - b) * 44100

describe('Studio transport count-in', () => {
  it('holds a fresh Play from silence until the count-in ends', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const countInEnds = 2.5

    await f.transport.play(f.project, [f.asset], 0, countInEnds)

    const anchor = f.transport.anchor()
    expect(anchor?.frame).toBe(0)
    // On a whole frame at or a hair after the count-in's end, never before.
    expect(anchor!.time).toBeGreaterThanOrEqual(countInEnds - 1e-9)
    expect(framesApart(anchor!.time, countInEnds)).toBeLessThan(1)
    f.transport.dispose()
  })

  it('starts a kept graph on the count-in end, not at the soonest frame', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await vi.advanceTimersByTimeAsync(33)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    const countInEnds = f.ctx.currentTime + 2

    await f.transport.play(f.project, [f.asset], 24000, countInEnds)

    expect(f.buildGraph).toHaveBeenCalledOnce()
    const [, epoch] = f.graph.resume.mock.calls[0]
    const anchor = f.transport.anchor()
    expect(anchor?.frame).toBe(24000)
    expect(framesApart(anchor!.time, countInEnds)).toBeLessThan(1)
    // The graph's own epoch leads what is heard by its latency.
    expect(anchor!.time - epoch).toBeGreaterThan(0)
    f.transport.dispose()
  })

  it('plays as soon as it can when the count-in has already gone by', async () => {
    vi.useFakeTimers()
    const f = transportFixture()

    await f.transport.play(f.project, [f.asset], 0, 0.001)

    // Built at 0 on the fake clock: heard once its compressors settle.
    expect(f.transport.anchor()!.time).toBeCloseTo(FIRST_HEARD, 3)
    f.transport.dispose()
  })

  it('has no place on the clock while the song is silent', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    expect(f.transport.anchor()).toBeNull()
    await f.transport.play(f.project, [f.asset], 0)
    expect(f.transport.anchor()).not.toBeNull()

    f.transport.pause()

    expect(f.transport.anchor()).toBeNull()
    f.transport.dispose()
  })
})
