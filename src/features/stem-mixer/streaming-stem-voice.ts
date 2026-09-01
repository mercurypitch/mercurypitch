// ============================================================
// Streaming stem voice — plays a compressed stem without decoding all of it
// ============================================================
//
// `decodeAudioData` hands back every sample of a song at once. For a 4-minute
// stereo stem at 48 kHz that is 90 MB, and karaoke holds two of them, and iOS
// kills the tab for it — see `.dev-logs/run3-ios-kill-180mb.log.keep`, where
// the last line before a fresh document is "180MB resident".
//
// This voice does the same job with a few seconds resident instead. It pulls
// decoded chunks from a stream in presentation order, gathers them into
// windows of a few seconds, and schedules each window as its own
// AudioBufferSourceNode at the exact context time where the previous one ends.
// Consecutive sources started at exact times on one clock are gapless, so the
// seams are inaudible — and because every stem schedules against that same
// AudioContext clock, the vocal and the instrumental stay sample-locked. Two
// `<audio>` elements cannot do that; they have two clocks and they drift.
//
// The engine treats one of these like a single source: it connects `envelope`
// where it would connect a buffer source, calls `stop(at)`, and gets `onEnded`
// when the last window finishes.
//
// The chunk source is injected rather than imported, so this module knows
// nothing about demuxers and the tests can drive it with plain arrays. The
// mediabunny-backed implementation is in `stem-stream-source.ts`.
//
// Sibling: `play-along/windowed-stem-voice.ts`, which does the same thing for
// stored WAV blobs, where byte offsets already map to sample positions. This
// one exists because karaoke stems are m4a and mp3, which cannot be sliced.

import { STREAMED_LOOKAHEAD_WINDOWS, STREAMED_WINDOW_SECONDS, } from './stem-memory'

/** One decoded run of samples, positioned on the song's timeline. */
export interface StemStreamChunk {
  readonly buffer: AudioBuffer
  /** Song time of this chunk's first sample, in seconds. */
  readonly timestamp: number
}

export interface StreamingStemVoiceOptions {
  readonly context: BaseAudioContext
  readonly destination: AudioNode
  /**
   * Opens the stem at a song position and yields decoded chunks in
   * presentation order. Iteration is driven by this voice, one window at a
   * time, so a generator that decodes lazily is what bounds the memory.
   */
  readonly open: (fromSeconds: number) => AsyncIterable<StemStreamChunk>
  /** Shared Web Audio clock time the first window starts at. */
  readonly atContextTime: number
  /** Song position of the first frame played. */
  readonly sourceOffsetSeconds: number
  readonly playbackRate: number
  readonly windowSeconds?: number
  /** Windows allowed to be scheduled but not yet finished. */
  readonly lookaheadWindows?: number
  readonly onEnded?: () => void
  /** A decode that failed mid-song, for the caller to surface or ignore. */
  readonly onError?: (error: unknown) => void
  /**
   * Each window's samples as it is scheduled, so the waveform can be drawn
   * from audio that had to be decoded anyway. Decoding a song to draw it was
   * what killed the phone this exists for.
   */
  readonly onWindow?: (
    atSeconds: number,
    samples: Float32Array,
    sampleRate: number,
  ) => void
}

export interface StreamingStemVoice {
  /** The mixer's fade target; the window chain feeds it. */
  readonly envelope: GainNode
  /** True once the stream ran out and its last window ended, or after stop. */
  readonly ended: boolean
  /** Stop every scheduled window at the given context time. */
  stop(atContextTime: number): void
  dispose(): void
}

const MINIMUM_RATE = 0.03125
/** Below this a chunk's timestamp is contiguous with the last one. */
const GAP_TOLERANCE_SECONDS = 0.001

export function createStreamingStemVoice(
  options: StreamingStemVoiceOptions,
): StreamingStemVoice {
  const { context, destination, atContextTime, sourceOffsetSeconds } = options
  const rate = Math.max(MINIMUM_RATE, options.playbackRate)
  const windowSeconds = Math.max(
    0.05,
    options.windowSeconds ?? STREAMED_WINDOW_SECONDS,
  )
  const lookahead = Math.max(
    1,
    options.lookaheadWindows ?? STREAMED_LOOKAHEAD_WINDOWS,
  )

  const envelope = context.createGain()
  envelope.connect(destination)

  const activeSources = new Set<AudioBufferSourceNode>()
  let scheduledWindows = 0
  let finishedWindows = 0
  let sourceExhausted = false
  let stopped = false
  let ended = false
  /** Resolved by a window ending, when the pump is waiting for room. */
  let releaseRoom: (() => void) | null = null

  const finish = (): void => {
    if (ended) return
    ended = true
    options.onEnded?.()
  }

  const settleIfDone = (): void => {
    if (sourceExhausted && finishedWindows >= scheduledWindows) finish()
  }

  // ── The window under construction ────────────────────────────
  //
  // Chunks arrive at whatever granularity the decoder emits — one AAC packet
  // is about 21 ms — and are gathered here until they are worth a source node.
  let pending: Float32Array[][] = []
  let pendingFrames = 0
  let pendingStart = sourceOffsetSeconds
  let pendingChannels = 0
  let pendingRate = 0

  const resetPending = (startSeconds: number): void => {
    pending = []
    pendingFrames = 0
    pendingStart = startSeconds
  }

  /** Where on the shared clock a window covering `songTime` belongs. */
  const contextTimeFor = (songTime: number): number =>
    atContextTime + (songTime - sourceOffsetSeconds) / rate

  const scheduleWindow = (): void => {
    if (pendingFrames === 0 || pendingChannels === 0) return

    const buffer = context.createBuffer(
      pendingChannels,
      pendingFrames,
      pendingRate,
    )
    for (let channel = 0; channel < pendingChannels; channel++) {
      let offset = 0
      for (const chunk of pending) {
        // A chunk with fewer channels than the window (a mono packet in a
        // stereo track) repeats its last channel rather than leaving silence.
        const data = chunk[Math.min(channel, chunk.length - 1)]
        buffer.copyToChannel(data as Float32Array<ArrayBuffer>, channel, offset)
        offset += data.length
      }
    }

    options.onWindow?.(pendingStart, buffer.getChannelData(0), pendingRate)

    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    source.connect(envelope)
    activeSources.add(source)
    scheduledWindows += 1
    source.onended = () => {
      activeSources.delete(source)
      try {
        source.disconnect()
      } catch {
        // Already disconnected by dispose.
      }
      finishedWindows += 1
      const release = releaseRoom
      releaseRoom = null
      release?.()
      settleIfDone()
    }

    const when = contextTimeFor(pendingStart)
    const now = context.currentTime
    if (when >= now) {
      source.start(when)
    } else {
      // A slow decode left this window late: start now, skipping the part the
      // clock already passed rather than playing it behind the beat.
      const missedSourceSeconds = (now - when) * rate
      const windowLength = pendingFrames / pendingRate
      if (missedSourceSeconds >= windowLength) {
        // Entirely in the past. Start a single frame so `onended` still runs
        // and the bookkeeping that ends the voice cannot stall.
        source.start(now, 0, 1 / pendingRate)
      } else {
        source.start(now, missedSourceSeconds)
      }
    }

    resetPending(pendingStart + pendingFrames / pendingRate)
  }

  /** Blocks the pump — and therefore the decoder — until a window ends. */
  const waitForRoom = (): Promise<void> => {
    if (stopped || scheduledWindows - finishedWindows < lookahead) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      releaseRoom = resolve
    })
  }

  const pump = async (): Promise<void> => {
    try {
      for await (const chunk of options.open(sourceOffsetSeconds)) {
        if (stopped) return

        const { buffer, timestamp } = chunk
        if (pendingChannels === 0) {
          pendingChannels = buffer.numberOfChannels
          pendingRate = buffer.sampleRate
        }

        // The stream may open on the packet *containing* the requested
        // position rather than at it. Drop the frames before the seek so the
        // first sample heard is the one asked for.
        let skipFrames = 0
        if (pendingFrames === 0 && timestamp < pendingStart) {
          skipFrames = Math.min(
            buffer.length,
            Math.round((pendingStart - timestamp) * buffer.sampleRate),
          )
        }
        if (skipFrames >= buffer.length) continue

        // A hole in the timeline — a dropped packet, or a stream that skips
        // silence. Close the window here so the next one is scheduled at its
        // own timestamp instead of being spliced early. (WebCodecs decoders do
        // not track timestamps across gaps; carrying our own is the fix.)
        const pendingEnd = pendingStart + pendingFrames / (pendingRate || 1)
        if (
          pendingFrames > 0 &&
          Math.abs(timestamp - pendingEnd) > GAP_TOLERANCE_SECONDS
        ) {
          scheduleWindow()
          resetPending(timestamp)
          await waitForRoom()
          if (stopped) return
        }

        const frames = buffer.length - skipFrames
        const channels: Float32Array[] = []
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          // A copy, not a view: `getChannelData` returns the live backing
          // store, and the decoder is free to recycle its buffers once the
          // iterator moves on.
          channels.push(buffer.getChannelData(c).slice(skipFrames))
        }
        pending.push(channels)
        pendingFrames += frames

        if (pendingFrames >= windowSeconds * pendingRate) {
          scheduleWindow()
          await waitForRoom()
          if (stopped) return
        }
      }

      if (stopped) return
      scheduleWindow()
    } catch (error) {
      if (!stopped) options.onError?.(error)
    } finally {
      sourceExhausted = true
      settleIfDone()
    }
  }
  void pump()

  return {
    envelope,
    get ended() {
      return ended
    },
    stop(stopAtContextTime: number) {
      if (stopped) return
      stopped = true
      const release = releaseRoom
      releaseRoom = null
      release?.()
      const at = Math.max(context.currentTime, stopAtContextTime)
      for (const source of activeSources) {
        try {
          source.onended = null
          source.stop(at)
        } catch {
          // Not started yet or already stopped; either way it is inert.
        }
      }
      finish()
    },
    dispose() {
      stopped = true
      const release = releaseRoom
      releaseRoom = null
      release?.()
      for (const source of activeSources) {
        try {
          source.onended = null
          source.stop()
        } catch {
          // Already stopped.
        }
        try {
          source.disconnect()
        } catch {
          // Already disconnected.
        }
      }
      activeSources.clear()
      pending = []
      pendingFrames = 0
      try {
        envelope.disconnect()
      } catch {
        // Already disconnected.
      }
      finish()
    },
  }
}
