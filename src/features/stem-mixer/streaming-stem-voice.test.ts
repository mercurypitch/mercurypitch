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
import { createStreamingStemVoice, PICK_UP_LEAD_SECONDS, STREAM_REOPEN_ATTEMPTS, WINDOW_FADE_IN_SECONDS, } from './streaming-stem-voice'

const RATE = 48_000

interface FakeGain {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  gain: {
    value: number
    setValueAtTime: ReturnType<typeof vi.fn>
    linearRampToValueAtTime: ReturnType<typeof vi.fn>
  }
}

interface StartedSource {
  when: number
  offset: number | undefined
  duration: number | undefined
  frames: number
  /** What the window plays into: the envelope, or a fade on its way there. */
  into: unknown
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
  const gains: FakeGain[] = []
  const context = {
    currentTime: 0,
    sampleRate: RATE,
    createGain: (): FakeGain => {
      const gain: FakeGain = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
      }
      gains.push(gain)
      return gain
    },
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
            into: source.connect.mock.calls[0]?.[0],
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
  return {
    context: context as unknown as BaseAudioContext,
    started,
    gains,
    /** The clock moving on, as the audio thread moves it. */
    setTime: (seconds: number) => {
      context.currentTime = seconds
    },
  }
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

  it('starts a late window now, part way in, rather than behind the beat', async () => {
    const { context, started, setTime } = fakeContext()
    setTime(5)
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

    // The first window (0 to 2 s, due at 2 to 4) is all behind the clock and
    // is not played at all: no single frame of it, which a stream catching
    // up used to fire in a buzzing run. The second (due at 4 to 6) starts
    // now, a second in.
    expect(started).toHaveLength(1)
    expect(started[0].when).toBe(5)
    expect(started[0].offset).toBeCloseTo(1, 9)
    expect(started[0].duration).toBeUndefined()
  })
})

describe('fading in', () => {
  it('fades in only a window that does not carry on from the last', async () => {
    const { context, started, gains } = fakeContext()
    const envelope = { connect: vi.fn() }
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 30 })

    const voice = createStreamingStemVoice({
      context,
      destination: envelope as unknown as AudioNode,
      open: stem.open,
      atContextTime: 10,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 2,
      lookaheadWindows: 3,
    })
    await settle()

    // The first window starts from silence; the next two are seamless.
    const envelopeNode: unknown = voice.envelope
    const fade = gains.find((gain) => gain !== envelopeNode)
    expect(started[0].into).toBe(fade)
    expect(fade?.gain.setValueAtTime).toHaveBeenCalledWith(0, 10)
    expect(fade?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1,
      10 + WINDOW_FADE_IN_SECONDS,
    )
    expect(started[1].into).toBe(voice.envelope)
    expect(started[2].into).toBe(voice.envelope)
  })

  it('fades in a late window, which starts mid-sound', async () => {
    const { context, started, setTime } = fakeContext()
    setTime(3)
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 30 })

    const voice = createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 2,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 2,
      lookaheadWindows: 2,
    })
    await settle()

    expect(started[0].when).toBe(3)
    expect(started[0].into).not.toBe(voice.envelope)
    // The one after it is on time and carries straight on.
    expect(started[1].when).toBe(4)
    expect(started[1].into).toBe(voice.envelope)
  })
})

describe('a stream that stalls', () => {
  it('picks up at the clock instead of decoding the seconds it missed', async () => {
    const { context, started, setTime } = fakeContext()
    const opened: number[] = []
    const stem = chunkedStem({ chunkSeconds: 0.5, totalSeconds: 600 })
    const onSkip = vi.fn()

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: (from) => {
        opened.push(from)
        return stem.open(from)
      },
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 1,
      lookaheadWindows: 1,
      onSkip,
    })
    await settle()
    expect(started).toHaveLength(1)
    const pulledBeforeStall = stem.state.pulled

    // The page was not run for twenty seconds; the first window's end is
    // delivered only now.
    setTime(20)
    started[0].end()
    await settle()

    expect(onSkip).toHaveBeenCalledOnce()
    expect(opened).toEqual([0, 20 + PICK_UP_LEAD_SECONDS])
    expect(started[1].when).toBeCloseTo(20 + PICK_UP_LEAD_SECONDS, 9)
    // A chunk to notice, then one window from the clock: not the forty
    // half-second chunks between, each played as a click.
    expect(stem.state.pulled - pulledBeforeStall).toBe(3)
  })

  it('never skips a stream that has not played yet, however slow', async () => {
    const { context, started, setTime } = fakeContext()
    setTime(30)
    const onSkip = vi.fn()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 60 })

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open: stem.open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 2,
      lookaheadWindows: 2,
      onSkip,
    })
    await settle()

    expect(onSkip).not.toHaveBeenCalled()
    expect(started[0].when).toBe(30)
  })
})

describe('a decoder that fails', () => {
  it('reopens where the sound runs out, and carries on seamlessly', async () => {
    const { context, started } = fakeContext()
    const opened: number[] = []
    const onRetry = vi.fn()
    const onError = vi.fn()
    const stem = chunkedStem({ chunkSeconds: 1, totalSeconds: 6 })
    let failed = false
    const open = async function* (
      from: number,
    ): AsyncGenerator<StemStreamChunk> {
      opened.push(from)
      for await (const chunk of stem.open(from)) {
        if (!failed && chunk.timestamp >= 2) {
          failed = true
          throw new Error('codec reclaimed')
        }
        yield chunk
      }
    }

    const voice = createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 1,
      lookaheadWindows: 10,
      onRetry,
      onError,
    })
    await settle()

    expect(onRetry).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
    expect(opened).toEqual([0, 2])
    expect(started.map((s) => s.when)).toEqual([0, 1, 2, 3, 4, 5])
    expect(started[2].into).toBe(voice.envelope)
  })

  it('reports it once reopening has not helped', async () => {
    const { context } = fakeContext()
    const onRetry = vi.fn()
    const onError = vi.fn()
    const open = async function* (): AsyncGenerator<StemStreamChunk> {
      yield { buffer: fakeAudioBuffer(1), timestamp: 0 }
      throw new Error('decoder gave up')
    }

    createStreamingStemVoice({
      context,
      destination: context.createGain(),
      open,
      atContextTime: 0,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
      windowSeconds: 10,
      lookaheadWindows: 2,
      onRetry,
      onError,
    })
    await settle()

    expect(onRetry).toHaveBeenCalledTimes(STREAM_REOPEN_ATTEMPTS)
    expect(onError).toHaveBeenCalledOnce()
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
