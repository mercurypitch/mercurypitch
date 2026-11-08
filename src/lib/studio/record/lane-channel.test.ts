// Studio lane channel — what a lane takes of its input by the count the capture reports: its own pick where the input has it, else the default (both sides of a stereo input, input 1 of any other), saying which pick was missing; and nothing taken where the count is not known; and an arm tapped for meters on its own split.
import { describe, expect, it, vi } from 'vitest'
import type { ChannelSplit } from '@/lib/audio-input/input-channels'
import { reportedChannels, studioInputTap, studioLaneRoute, } from './lane-channel'

const single = (channel: number) => ({ channel, pair: false })
const pair = (channel: number) => ({ channel, pair: true })

describe('studioLaneRoute', () => {
  it('takes, with no choice, input 1 of one channel, both of two, and input 1 of three to eight', () => {
    const table = [1, 2, 3, 4, 5, 6, 7, 8].map((count) => [
      count,
      studioLaneRoute(null, count).taken,
    ])

    expect(table).toEqual([
      [1, single(0)],
      [2, pair(0)],
      [3, single(0)],
      [4, single(0)],
      [5, single(0)],
      [6, single(0)],
      [7, single(0)],
      [8, single(0)],
    ])
  })

  it('takes a pick the input has, input or aligned pair', () => {
    expect(studioLaneRoute(single(3), 4)).toEqual({
      taken: single(3),
      missing: null,
    })
    expect(studioLaneRoute(pair(2), 4)).toEqual({
      taken: pair(2),
      missing: null,
    })
  })

  it('takes the default in place of a pick past the count, and names the one that was missing', () => {
    expect(studioLaneRoute(single(2), 2)).toEqual({
      taken: pair(0),
      missing: single(2),
    })
    expect(studioLaneRoute(pair(2), 3)).toEqual({
      taken: single(0),
      missing: pair(2),
    })
    expect(studioLaneRoute(pair(0), 1)).toEqual({
      taken: single(0),
      missing: pair(0),
    })
  })

  it('takes nothing where the count is not known, and names a pick it could not take', () => {
    expect(studioLaneRoute(null, null)).toEqual({ taken: null, missing: null })
    expect(studioLaneRoute(single(1), null)).toEqual({
      taken: null,
      missing: single(1),
    })
  })
})

describe('reportedChannels', () => {
  const stream = (settings: object) =>
    ({
      getAudioTracks: () => [{ getSettings: () => settings }],
    }) as unknown as MediaStream

  it("reads the track's count, clamped to what a split addresses, and null where it says none", () => {
    expect(reportedChannels(stream({ channelCount: 2 }))).toBe(2)
    expect(reportedChannels(stream({ channelCount: 64 }))).toBe(32)
    expect(reportedChannels(stream({}))).toBeNull()
    expect(reportedChannels(stream({ channelCount: 0 }))).toBeNull()
  })
})

describe('studioInputTap', () => {
  const track = { id: 'track' } as unknown as MediaStreamTrack
  const armedOn = (split: ChannelSplit | null, channels: number | null) => {
    const source = { connect: vi.fn(), disconnect: vi.fn() }
    const armed = {
      context: {} as BaseAudioContext,
      source: source as unknown as AudioNode,
      stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
      lane: {
        split,
        input: source as unknown as AudioNode,
        channels,
        pick: null,
        missing: null,
      },
    }
    return { armed, source }
  }

  it("meters beside the take on the arm's own split, and names the input by its track", () => {
    const split = { send: vi.fn(), unsend: vi.fn() } as unknown as ChannelSplit
    const { armed, source } = armedOn(split, 2)
    const meter = {} as AudioNode

    const tap = studioInputTap(armed)
    tap.send(1, meter)
    tap.unsend(1, meter)

    expect(split.send).toHaveBeenCalledExactlyOnceWith(1, meter)
    expect(split.unsend).toHaveBeenCalledExactlyOnceWith(1, meter)
    expect(source.connect).not.toHaveBeenCalled()
    expect(tap).toMatchObject({ channels: 2, track })
  })

  it('meters the input as it is where one channel left nothing to split', () => {
    const { armed, source } = armedOn(null, 1)
    const meter = {} as AudioNode

    const tap = studioInputTap(armed)
    tap.send(0, meter)
    tap.unsend(0, meter)

    expect(source.connect).toHaveBeenCalledExactlyOnceWith(meter)
    expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(meter)
  })
})
