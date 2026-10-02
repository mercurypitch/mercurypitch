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
//
// LATE, STALLED, FAILED. Every start is late: the first window of a play or
// a seek is decoded after the clock time it belongs at. A late window starts
// now, part way in, and anything that does not carry straight on from the
// window before it fades in over a few milliseconds, so it cannot click. A
// window the clock has passed altogether is not played at all. It used to
// play one frame so that its end ran the bookkeeping, so a stream catching
// up after a stall played a fast run of single-frame clicks: the likeliest
// source of the loud buzz an iPhone made on coming back to the app (owner,
// 2 Oct). A stream that falls more than a window behind after it has played
// (the OS paused the page, or the decoder) picks up at the clock instead of
// decoding seconds nobody will hear, and a decode that fails is reopened
// where the sound runs out, a couple of times, before it is reported.

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
  /**
   * A decode that failed mid-song and kept failing when reopened: the voice
   * has stopped pulling, and will end once what it scheduled has played.
   */
  readonly onError?: (error: unknown) => void
  /** A decode that failed and was reopened: the `attempt`th in a row. */
  readonly onRetry?: (error: unknown, attempt: number) => void
  /** The stream fell `behindSeconds` of song behind the clock and skipped ahead. */
  readonly onSkip?: (behindSeconds: number) => void
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
/** Two windows this close on the clock are one continuous sound. */
const SEAM_TOLERANCE_SECONDS = 0.001
/** A window that does not carry straight on from the last fades in over this. */
export const WINDOW_FADE_IN_SECONDS = 0.015
/**
 * How far past the clock a reopened stream picks up, in clock seconds, so
 * its first window has a moment to be decoded in.
 */
export const PICK_UP_LEAD_SECONDS = 0.25
/** Failed decodes in a row the voice reopens before it reports one. */
export const STREAM_REOPEN_ATTEMPTS = 2

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
  /** The fade a window starts through, when it does not carry on from the last. */
  const fades = new Map<AudioBufferSourceNode, GainNode>()
  let scheduledWindows = 0
  let finishedWindows = 0
  let sourceExhausted = false
  let stopped = false
  let ended = false
  /** Resolved by a window ending, when the pump is waiting for room. */
  let releaseRoom: (() => void) | null = null
  /** Clock time the last window scheduled runs out at; null before the first. */
  let lastEnd: number | null = null
  /** Song time the last window scheduled runs out at. */
  let scheduledUntil = sourceOffsetSeconds
  /** Failed decodes since a window was last scheduled. */
  let failures = 0

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

  /** The song time the clock is at now. */
  const songTimeNow = (): number =>
    sourceOffsetSeconds + (context.currentTime - atContextTime) * rate

  /**
   * Where a reopened stream picks up: where the sound already scheduled
   * runs out, or a moment past the clock if that has gone by.
   */
  const pickUpPoint = (): number =>
    Math.max(scheduledUntil, songTimeNow() + PICK_UP_LEAD_SECONDS * rate)

  /**
   * Schedules the window under construction; false when the clock has
   * already passed all of it, and nothing was scheduled.
   */
  const scheduleWindow = (): boolean => {
    if (pendingFrames === 0 || pendingChannels === 0) return false

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

    const windowStart = pendingStart
    const windowLength = pendingFrames / pendingRate
    resetPending(windowStart + windowLength)

    const when = contextTimeFor(windowStart)
    const now = context.currentTime
    // The part of the window the clock has already passed, in song seconds:
    // a late window starts now, that far in, rather than behind the beat.
    const missed = when >= now ? 0 : (now - when) * rate
    // Passed altogether. Nothing is scheduled, so nothing waits on it.
    if (missed >= windowLength) return false

    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const startAt = Math.max(when, now)
    const carriesOn =
      missed === 0 &&
      lastEnd !== null &&
      Math.abs(when - lastEnd) <= SEAM_TOLERANCE_SECONDS
    if (carriesOn) {
      source.connect(envelope)
    } else {
      const fade = context.createGain()
      fade.gain.setValueAtTime(0, startAt)
      fade.gain.linearRampToValueAtTime(1, startAt + WINDOW_FADE_IN_SECONDS)
      fade.connect(envelope)
      source.connect(fade)
      fades.set(source, fade)
    }
    activeSources.add(source)
    scheduledWindows += 1
    source.onended = () => {
      activeSources.delete(source)
      const fade = fades.get(source)
      fades.delete(source)
      try {
        source.disconnect()
        fade?.disconnect()
      } catch {
        // Already disconnected by dispose.
      }
      finishedWindows += 1
      const release = releaseRoom
      releaseRoom = null
      release?.()
      settleIfDone()
    }

    if (missed > 0) source.start(startAt, missed)
    else source.start(when)
    lastEnd = startAt + (windowLength - missed) / rate
    scheduledUntil = windowStart + windowLength
    failures = 0
    return true
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

  /**
   * Plays the stream from song time `from`. Null once it ran out or the voice
   * stopped; otherwise the song time to pick up at, because the stream fell
   * so far behind the clock that going on would decode what nobody hears.
   */
  const pumpFrom = async (from: number): Promise<number | null> => {
    resetPending(from)
    let scheduledHere = 0
    const schedule = (): void => {
      if (scheduleWindow()) scheduledHere += 1
    }

    for await (const chunk of options.open(from)) {
      if (stopped) return null

      const { buffer, timestamp } = chunk
      if (pendingChannels === 0) {
        pendingChannels = buffer.numberOfChannels
        pendingRate = buffer.sampleRate
      }

      // More than a window behind, after this stream has played: the page
      // or the decoder was paused. A stream that is slow from its first
      // window never skips, or a phone that decodes slowly would skip for
      // ever and play nothing.
      const behind =
        songTimeNow() - (timestamp + buffer.length / buffer.sampleRate)
      if (scheduledHere > 0 && behind > windowSeconds) {
        options.onSkip?.(behind)
        return pickUpPoint()
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
        schedule()
        resetPending(timestamp)
        await waitForRoom()
        if (stopped) return null
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
        schedule()
        await waitForRoom()
        if (stopped) return null
      }
    }

    if (stopped) return null
    schedule()
    return null
  }

  const pump = async (): Promise<void> => {
    let from = sourceOffsetSeconds
    try {
      while (!stopped) {
        let pickUpAt: number | null
        try {
          pickUpAt = await pumpFrom(from)
        } catch (error) {
          if (stopped) return
          failures += 1
          if (failures > STREAM_REOPEN_ATTEMPTS) throw error
          options.onRetry?.(error, failures)
          pickUpAt = pickUpPoint()
        }
        if (pickUpAt === null) return
        from = pickUpAt
      }
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
      for (const fade of fades.values()) {
        try {
          fade.disconnect()
        } catch {
          // Already disconnected.
        }
      }
      fades.clear()
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
