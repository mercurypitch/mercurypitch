// ============================================================
// Lesson sound run tests — a sung line with breaths, one voice a breath
// ============================================================
//
// `playLines` sings a line as Lesson 14's phrases are sung (its WEB-SPEC,
// Audio): each breath's worth one voice, started on its own timer, nothing
// sounding between them, the run lasting to its last voice's end or to the
// breath it ends on. Its voices are built for real on the fake AudioContext
// the sound tests use (sound-doubles.test-fixtures.ts) and read from what
// that context holds, as kit/run.test.ts reads `playLine`'s.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { outcome, SHORT_RELEASE, soundOn } from './run.test-fixtures'
import { contourOf } from './sound'

/** A line with one breath: A3 for 1.2 s, a 0.3 s breath, then A3 again for 0.5 s. */
const BREATHED = [
  { t: 0, points: contourOf(220, [{ hold: 1.2 }]) },
  { t: 1.5, points: contourOf(220, [{ hold: 0.5 }]) },
]

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('playLines', () => {
  it('starts one voice for each breath, at its own time, and none before it', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, ctx } = await soundOn()

    // Act
    runs.playLines(BREATHED, { audible: true })
    await vi.advanceTimersByTimeAsync(10)
    const first = ctx.oscillators.length
    await vi.advanceTimersByTimeAsync(1480)
    const beforeBreath = ctx.oscillators.length
    await vi.advanceTimersByTimeAsync(20)

    // Assert: each Merc voice is a tone and its vibrato
    expect(first).toBe(2)
    expect(beforeBreath).toBe(2)
    expect(ctx.oscillators).toHaveLength(4)
  })

  it('lasts until its last voice ends, or to the breath it ends on', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs } = await soundOn()
    const plain = outcome(runs.playLines(BREATHED, { audible: false }))
    const breathEnd = outcome(
      runs.playLines(BREATHED, { audible: false, length: 2.3 }),
    )

    // Act
    await vi.advanceTimersByTimeAsync(2001)
    const atTwo = [plain.heard, breathEnd.heard]
    await vi.advanceTimersByTimeAsync(300)

    // Assert
    expect(atTwo).toEqual([true, undefined])
    expect(breathEnd.heard).toBe(true)
  })

  it("releases the voice that sounds with the kit's short release, and starts none still to come, when stopped", async () => {
    // Arrange: stopped in the first breath's worth, 1 s in on the fake clock
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, ctx } = await soundOn()
    const run = runs.playLines(BREATHED, { audible: true })
    const seen = outcome(run)
    await vi.advanceTimersByTimeAsync(1000)
    ctx.currentTime = 1

    // Act
    run.stop()
    await vi.advanceTimersByTimeAsync(2000)

    // Assert
    const releases = ctx.gains
      .flatMap((g) => g.gain.events)
      .filter(([method, , at]) => method === 'setTargetAtTime' && at === 1)
    expect(releases).toEqual([['setTargetAtTime', 0, 1, SHORT_RELEASE / 5]])
    expect(ctx.oscillators).toHaveLength(2)
    expect(seen.heard).toBe(false)
  })

  it('builds no voice when silent, and still resolves true at its end', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, ctx } = await soundOn()
    const seen = outcome(runs.playLines(BREATHED, { audible: false }))

    // Act
    await vi.advanceTimersByTimeAsync(2000)

    // Assert
    expect(ctx.oscillators).toEqual([])
    expect(seen.heard).toBe(true)
  })
})
