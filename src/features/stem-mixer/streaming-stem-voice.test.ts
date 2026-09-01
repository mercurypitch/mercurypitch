// ============================================================
// A streamed stem holds seconds, not the song
// ============================================================
//
// The bug this exists for is not audible, it is fatal: two decoded stems were
// 180 MB and iOS killed the tab. So the assertion that matters most here is
// the boring one — that the voice stops pulling from the decoder once it is a
// couple of windows ahead, and only resumes when a window has finished
// playing. A voice that drained its source would be `decodeAudioData` with
// extra steps.
//
// The rest is what makes it sound like one continuous stem: windows placed on
// the shared clock end to end, a seek landing on the sample asked for rather
// than on the packet containing it, and a hole in the timeline becoming a
// scheduling offset instead of a splice.

import { describe, expect, it, vi } from 'vitest'
import type { StemStreamChunk } from './streaming-stem-voice'
import { createStreamingStemVoice } from './streaming-stem-voice'

const RATE = 48_000

interface StartedSource {
  when: number
  offset: number | undefined
  duration: number | undefined
  frames: number
  end: () => void
  stopped: number[]
}

function fakeAudioBuffer(
  seconds: number,
  channels = 1,
  sampleRate = RATE,
  fill = 0,
): AudioBuffer {
  const length = Math.round(seconds * sampleRate)
  const data = Array.from({ length: channels }, () =>
    new Float32Array(length).fill(fill),
  )
  return {
    duration: seconds,
    length,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: (channel: number) => data[channel],
  } as unknown as AudioBuffer
}

function fakeContext() {
  const started: StartedSource[] = []
  const context = {
    currentTime: 0,
    sampleRate: RATE,
    createGain: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1 },
    }),
    createBuffer: (channels: number, frames: number, sampleRate: number) => {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(frames),
      )
      return {
        numberOfChannels: channels,
        length: frames,
        sampleRate,
        duration: frames / sampleRate,
        getChannelData: (c: number) => data[c],
        copyToChannel: (src: Float32Array, c: number, offset = 0) => {
          data[c].set(src, offset)
        },
      } as unknown as AudioBuffer
    },
    createBufferSource: () => {
      const source = {
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null as null | (() => void),
        start: (when: number, offset?: number, duration?: number) => {
          started.push({
            when,
            offset,
            duration,
            frames: source.buffer?.length ?? 0,
            end: () => source.onended?.(),
            stopped: record,
          })
        },
        stop: (at?: number) => {
          record.push(at ?? -1)
        },
      }
      const record: number[] = []
      return source
    },
  }
  return { context: context as unknown as BaseAudioContext, started }
}

/** A stem that yields fixed-length chunks, counting what was asked of it. */
function chunkedStem(options: {
  chunkSeconds: number
  totalSeconds: number
  channels?: number
}) {
  const state = { pulled: 0 }
  const open = async function* (
    fromSeconds: number,
  ): AsyncGenerator<StemStreamChunk> {
    for (
      let t = fromSeconds;
      t < options.totalSeconds - 1e-9;
      t += options.chunkSeconds
    ) {
      state.pulled++
      yield {
        buffer: fakeAudioBuffer(
          Math.min(options.chunkSeconds, options.totalSeconds - t),
          options.channels ?? 1,
        ),
        timestamp: t,
      }
    }
  }
  return { open, state }
}

/**
 * Lets the pump's awaits run without pretending to know how many there are.
 * A macrotask drains every pending microtask, and the pump is a chain of
 * them — one per chunk, and a long song is a lot of chunks.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('what a streamed voice holds', () => {
  it('stops pulling once the lookahead is full, and resumes on a window end', async () => {
    const { context, started } = fakeContext()
    const stem = chunkedStem({ chunkSeconds: 0.5, totalSeconds: 60 })

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 10,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 1,
      lookaheadWindows: 2,
    })
    await settle()

    // Two windows scheduled, four half-second chunks pulled — and then it
    // stops, sixty seconds of song still untouched. This is the whole point.
    expect(started).toHaveLength(2)
    expect(stem.state.pulled).toBe(4)

    started[0].end()
    await settle()

    expect(started).toHaveLength(3)
    expect(stem.state.pulled).toBe(6)
  })

  it('never lets the decoder run away, however long the song', async () => {
    const { context, started } = fakeContext()
    const stem = chunkedStem({ chunkSeconds: 0.25, totalSeconds: 600 })

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 2,
      lookaheadWindows: 2,
    })
    await settle()

    // Ten minutes of stereo at 48 kHz would be 220 MB decoded whole.
    const heldSeconds = stem.state.pulled * 0.25
    expect(heldSeconds).toBeLessThanOrEqual(4)
    expect(started).toHaveLength(2)
  })
})

describe('where the windows land on the clock', () => {
  it('places them end to end from the start time it was given', async () => {
    const { context, started } = fakeContext()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 30 })

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 10,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 2,
      lookaheadWindows: 3,
    })
    await settle()

    expect(started.map((s) => s.when)).toEqual([10, 12, 14])
    expect(started[0].frames).toBe(2 * RATE)
  })

  it('accounts for playback speed, so a half-speed stem still meets itself', async () => {
    const { context, started } = fakeContext()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 30 })

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 0.5,
      windowSeconds: 2,
      lookaheadWindows: 2,
    })
    await settle()

    // Two seconds of audio at half speed occupies four seconds of clock.
    expect(started.map((s) => s.when)).toEqual([0, 4])
  })

  it('starts a late window now rather than behind the beat', async () => {
    const { context, started } = fakeContext()
    ;(context as unknown as { currentTime: number }).currentTime = 5
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 30 })

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      // Already three seconds in the past when the first window is ready.
      atContextTime: 2,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 2,
      lookaheadWindows: 1,
    })
    await settle()

    expect(started[0].when).toBe(5)
    // Two seconds of window, three seconds late: the whole thing is behind, so
    // it plays a single frame to keep the bookkeeping moving.
    expect(started[0].duration).toBeCloseTo(1 / RATE, 9)
  })
})

describe('seeking into the middle of a stem', () => {
  it('drops the part of the opening packet before the seek', async () => {
    const { context, started } = fakeContext()
    // A decoder opens on the packet containing 5s, which began at 4.9s.
    const open = async function* (): AsyncGenerator<StemStreamChunk> {
      yield { buffer: fakeAudioBuffer(1), timestamp: 4.9 }
      yield { buffer: fakeAudioBuffer(1), timestamp: 5.9 }
    }

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open,
      atContextTime: 0,
      sourceOffsetSeconds: 5,
      playbackRate: 1,
      windowSeconds: 0.5,
      lookaheadWindows: 4,
    })
    await settle()

    // The stream handed over 4.9s–6.9s; only 5.0s–6.9s may be heard, so the
    // 0.9s of the opening packet that precedes the seek is dropped.
    expect(started[0].when).toBe(0)
    const total = started.reduce((sum, s) => sum + s.frames, 0)
    expect(total).toBe(Math.round(1.9 * RATE))
  })
})

describe('a hole in the timeline', () => {
  it('starts the next window at its own timestamp instead of splicing', async () => {
    const { context, started } = fakeContext()
    const open = async function* (): AsyncGenerator<StemStreamChunk> {
      yield { buffer: fakeAudioBuffer(1), timestamp: 0 }
      // Two seconds missing — a dropped packet, or skipped silence.
      yield { buffer: fakeAudioBuffer(1), timestamp: 3 }
    }

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 10,
      lookaheadWindows: 4,
    })
    await settle()

    // Not one two-second window: one at 0 and one at 3, so the second half
    // stays where it belongs rather than arriving two seconds early.
    expect(started.map((s) => s.when)).toEqual([0, 3])
  })
})

describe('ending and stopping', () => {
  it('reports ended only once the last window has played', async () => {
    const { context, started } = fakeContext()
    const onEnded = vi.fn()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 3 })

    const voice = createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 1,
      lookaheadWindows: 4,
      onEnded,
    })
    await settle()

    expect(started).toHaveLength(3)
    expect(voice.ended).toBe(false)

    started[0].end()
    started[1].end()
    await settle()
    expect(voice.ended).toBe(false)

    started[2].end()
    await settle()
    expect(voice.ended).toBe(true)
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it('stops every scheduled window at the time it was given', async () => {
    const { context, started } = fakeContext()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 30 })

    const voice = createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 1,
      lookaheadWindows: 3,
    })
    await settle()

    voice.stop(2.5)
    expect(started.every((s) => s.stopped.includes(2.5))).toBe(true)
    expect(voice.ended).toBe(true)
  })

  it('releases the decoder when stopped mid-stream', async () => {
    const { context } = fakeContext()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 600 })

    const voice = createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 1,
      lookaheadWindows: 2,
    })
    await settle()

    const pulledWhenStopped = stem.state.pulled
    voice.stop(0)
    await settle()

    // A stop that left the pump waiting on a window that will never end would
    // hold the decoder — and its memory — for the life of the page.
    expect(stem.state.pulled).toBe(pulledWhenStopped)
  })

  it('surfaces a decode that fails mid-song rather than swallowing it', async () => {
    const { context } = fakeContext()
    const onError = vi.fn()
    const open = async function* (): AsyncGenerator<StemStreamChunk> {
      yield { buffer: fakeAudioBuffer(1), timestamp: 0 }
      throw new Error('decoder gave up')
    }

    const voice = createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 10,
      lookaheadWindows: 2,
      onError,
    })
    await settle()

    expect(onError).toHaveBeenCalledOnce()
    expect(voice.ended).toBe(true)
  })
})
