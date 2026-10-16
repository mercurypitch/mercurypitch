// ============================================================
// The rooms' output bus: one per context, at 1, metered only when asked,
// with each room's stage in front of it
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { openRoomStage, resetRoomOutputsForTests, ROOM_OUTPUT_GAIN, roomOutput, roomOutputReadings, roomStagesOn, } from './room-output'

interface FakeNode {
  kind: string
  outputs: unknown[]
  connect: (to: unknown) => unknown
  disconnect: () => void
}

function fakeContext(samples: number[] = []) {
  const made: FakeNode[] = []
  const node = <T extends object>(kind: string, extra: T): FakeNode & T => {
    const n = Object.assign(
      {
        kind,
        outputs: [] as unknown[],
        connect: (to: unknown) => {
          n.outputs.push(to)
          return to
        },
        disconnect: () => {
          n.outputs.length = 0
        },
      },
      extra,
    )
    made.push(n)
    return n
  }
  const ctx = {
    state: 'running' as AudioContextState,
    destination: { kind: 'destination' },
    createGain: () => node('gain', { gain: { value: 1 } }),
    createAnalyser: () =>
      node('analyser', {
        fftSize: 2048,
        getFloatTimeDomainData: (into: Float32Array) => {
          into.fill(0)
          into.set(samples.slice(0, into.length))
        },
      }),
  }
  return { ctx: ctx as unknown as BaseAudioContext, made, raw: ctx }
}

afterEach(() => resetRoomOutputsForTests())

describe('roomOutput', () => {
  it('is one bus per context, at 1, straight to the speakers', () => {
    const { ctx, made, raw } = fakeContext()
    const bus = roomOutput(ctx)
    expect(roomOutput(ctx)).toBe(bus)
    expect(made).toHaveLength(1)
    expect((bus as unknown as { gain: { value: number } }).gain.value).toBe(
      ROOM_OUTPUT_GAIN,
    )
    expect(ROOM_OUTPUT_GAIN).toBe(1)
    expect((bus as unknown as FakeNode).outputs).toEqual([raw.destination])
  })

  it('gives each context its own, and forgets a closed one', () => {
    const a = fakeContext()
    const b = fakeContext()
    expect(roomOutput(a.ctx)).not.toBe(roomOutput(b.ctx))
    expect(roomOutputReadings().map((r) => r.context)).toEqual([a.ctx, b.ctx])
    a.raw.state = 'closed'
    expect(roomOutputReadings().map((r) => r.context)).toEqual([b.ctx])
  })
})

describe('openRoomStage', () => {
  it("stands in front of the bus at 1, and takes the rooms' sound while it is open", () => {
    const { ctx } = fakeContext()
    const bus = roomOutput(ctx)
    openRoomStage(ctx)
    const stage = roomOutput(ctx) as unknown as FakeNode & {
      gain: { value: number }
    }

    expect(stage).not.toBe(bus)
    expect(stage.gain.value).toBe(ROOM_OUTPUT_GAIN)
    expect(stage.outputs).toEqual([bus])
    expect(roomStagesOn(ctx)).toEqual([stage])
  })

  it('once cut, is off the speakers and hands the sound to the stage before it, or to the bus', () => {
    const { ctx } = fakeContext()
    const bus = roomOutput(ctx)
    const left = openRoomStage(ctx)
    const leftNode = roomOutput(ctx) as unknown as FakeNode
    const next = openRoomStage(ctx)
    const nextNode = roomOutput(ctx)

    // The room left earlier ends its tail while the next one is open.
    left.cut()
    expect(leftNode.outputs).toEqual([])
    expect(roomOutput(ctx)).toBe(nextNode)

    next.cut()
    next.cut()
    expect(roomOutput(ctx)).toBe(bus)
    expect(roomStagesOn(ctx)).toEqual([])
  })
})

describe('roomOutputReadings', () => {
  it('meters nothing until a reading is asked for', () => {
    const { ctx, made } = fakeContext()
    roomOutput(ctx)
    expect(made.map((n) => n.kind)).toEqual(['gain'])
    roomOutputReadings()
    roomOutputReadings()
    expect(made.map((n) => n.kind)).toEqual(['gain', 'analyser'])
  })

  it('reads the gain, the peak and the RMS of what goes to the speakers', () => {
    // A square wave at half scale: peak and RMS both -6.02 dBFS.
    const square = Array.from({ length: 2048 }, (_, i) =>
      i % 2 === 0 ? 0.5 : -0.5,
    )
    const { ctx } = fakeContext(square)
    roomOutput(ctx)
    const [reading] = roomOutputReadings()
    expect(reading.gain).toBe(1)
    expect(reading.peakDb).toBeCloseTo(-6.02, 2)
    expect(reading.rmsDb).toBeCloseTo(-6.02, 2)
  })

  it('reads silence as no level at all', () => {
    const { ctx } = fakeContext()
    roomOutput(ctx)
    const [reading] = roomOutputReadings()
    expect(reading.peakDb).toBeNull()
    expect(reading.rmsDb).toBeNull()
  })
})
