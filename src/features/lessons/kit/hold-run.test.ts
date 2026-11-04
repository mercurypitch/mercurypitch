// ============================================================
// Hold run tests — the Listen phase a page passes in, and the seconds sung
// ============================================================
//
// What the move into the kit added to Lesson 5's take (whose own test,
// lesson-05/sing-hold.test.ts, runs it on the page's frame loop): the
// page's demonstration is Merc's Listen phase, its seconds on the ring; one
// cut short ends the take before it opens, with the microphone never read
// and no sound held off; and `onSung` hears the seconds since the first
// voiced frame, on the frames' clock.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandChart } from './band-chart'
import type { HoldContext, HoldModule, ListenModule } from './hold-run'
import { holdOne } from './hold-run'
import type { HoldReading } from './hold-take'
import type { Listener, PitchFrame } from './listen'
import type * as MercDuo from './merc-duo'
import type { Ring } from './sing'
import { Sound } from './sound'

vi.mock('./merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: vi.fn(),
  mercListen: vi.fn(),
}))

const READING = { kind: 'read', share: 1 } as unknown as HoldReading

/** A take's context on doubles: a chart, a ring, and frames voiced from 5.0 s on the frames' clock. */
function context(over: Partial<HoldContext> = {}): {
  readonly c: HoldContext
  readonly takeFrames: ReturnType<typeof vi.fn>
  readonly ring: {
    run: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }
} {
  const frames: PitchFrame[] = [5, 5.5, 7.25].map((t) => ({
    t,
    f0: 220,
    conf: 0.9,
  })) as PitchFrame[]
  const takeFrames = vi.fn(
    async (
      _l: Listener,
      o: { onFrame?: (f: PitchFrame | null, v: number | null) => void },
    ) => {
      for (const f of frames) o.onFrame?.(f, 5)
      return frames
    },
  )
  const ring = { busy: false, run: vi.fn(async () => undefined), stop: vi.fn() }
  const chart = {
    setTarget: vi.fn(),
    setWindow: vi.fn(),
    scene: { line: [], head: null, lit: false, glow: 0 },
  } as unknown as BandChart
  const c: HoldContext = {
    mod: {
      takeFrames,
      foldCents: (c: number) => c,
      hzToCents: () => 5700,
    } as unknown as ListenModule,
    reader: {
      HOLD_WAIT_SEC: 6,
      HOLD_QUIET_SEC: 1,
      readHold: () => READING,
    } as unknown as HoldModule,
    listener: {} as Listener,
    view: { chart, ring: ring as unknown as Ring, now: vi.fn() },
    which: 'blue',
    midi: 57,
    length: 10,
    label: 'A3 · 220 Hz',
    listen: { sec: 10, play: async () => true },
    cancelled: () => false,
    onPhase: vi.fn(),
    ...over,
  }
  return { c, takeFrames, ring }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("a hold's Listen phase, passed in", () => {
  it('plays the demonstration with the sound decided at the tap, its seconds on the ring, then opens the take', async () => {
    // Arrange
    const play = vi.fn(async () => true)
    const { c, takeFrames, ring } = context({ listen: { sec: 10, play } })

    // Act
    const reading = holdOne(c)
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    expect(play).toHaveBeenCalledWith(true)
    expect(ring.run.mock.calls[0]?.[0]).toMatchObject({
      listen: 10,
      breathe: 2,
    })
    expect(await reading).toBe(READING)
    expect(takeFrames).toHaveBeenCalledOnce()
  })

  it('ends the take before it opens when the demonstration is cut short: no frames read, no sound held off, the ring stopped', async () => {
    // Arrange
    const hush = vi.spyOn(Sound, 'hush')
    const { c, takeFrames, ring } = context({
      listen: { sec: 10, play: async () => false },
    })

    // Act
    const reading = await holdOne(c)

    // Assert
    expect(reading).toBeNull()
    expect(takeFrames).not.toHaveBeenCalled()
    expect(hush).not.toHaveBeenCalled()
    expect(ring.stop).toHaveBeenCalledOnce()
    expect(c.onPhase).toHaveBeenCalledTimes(1)
  })
})

describe('the seconds sung', () => {
  it("hears each frame as seconds since the first voiced frame, on the frames' clock", async () => {
    // Arrange
    const sung: number[] = []
    const { c } = context({ onSung: (t) => sung.push(t) })

    // Act
    const reading = holdOne(c)
    await vi.advanceTimersByTimeAsync(1000)
    await reading

    // Assert
    expect(sung).toEqual([0, 0.5, 2.25])
  })
})
