// ============================================================
// Windowed stem voice — plays a stored WAV Blob in scheduled windows
// ============================================================
//
// Instead of decoding a whole stem into one AudioBuffer, this voice reads
// consecutive windows of frames off the Blob (lazy slices — see
// wav-blob-window.ts) and schedules each as its own AudioBufferSourceNode at
// the exact context time where the previous window ends. Sample positions
// are byte-exact in WAV, and consecutive sources started at exact times on
// one clock are gapless, so the seams are inaudible. Resident audio memory
// is bounded by the lookahead (a few windows), not the song length.
//
// The engine treats one of these like a single voice: it applies its fades
// to `envelope`, calls `stop(at)` where it would stop a source, and gets
// `onEnded` when the final window finishes.

import type { WavBlobFormat } from '@/lib/wav-blob-window'
import { readWavBlobWindow } from '@/lib/wav-blob-window'

export interface WindowedStemVoiceOptions {
  readonly context: BaseAudioContext
  readonly destination: AudioNode
  readonly blob: Blob
  readonly format: WavBlobFormat
  /** Shared Web Audio clock time the first window starts at. */
  readonly atContextTime: number
  /** Song position of the first frame played. */
  readonly sourceOffsetSeconds: number
  readonly playbackRate: number
  /** Cap on played source duration (subtraction pairs match their parent). */
  readonly maxDurationSeconds?: number
  readonly windowSeconds?: number
  /** Windows kept scheduled ahead of the playhead. */
  readonly lookaheadWindows?: number
  readonly onEnded?: () => void
  /** Injectable for tests. */
  readonly readWindow?: typeof readWavBlobWindow
}

export interface WindowedStemVoice {
  /** The engine's fade target; the window chain feeds it. */
  readonly envelope: GainNode
  /** True once the final window has ended, or every window a stop left
   *  live has reached its stop time. */
  readonly ended: boolean
  /** Stop every scheduled window at the given context time. The voice
   *  reports its end when the last of them gets there, not before, so
   *  the engine's release on `envelope` plays out. Calling it again with
   *  an earlier time pulls the stop forward. */
  stop(atContextTime: number): void
  dispose(): void
}

const DEFAULT_WINDOW_SECONDS = 12
const DEFAULT_LOOKAHEAD_WINDOWS = 2
const MINIMUM_RATE = 0.03125

export function createWindowedStemVoice(
  options: WindowedStemVoiceOptions,
): WindowedStemVoice {
  const {
    context,
    destination,
    blob,
    format,
    atContextTime,
    sourceOffsetSeconds,
  } = options
  const readWindow = options.readWindow ?? readWavBlobWindow
  const rate = Math.max(MINIMUM_RATE, options.playbackRate)
  const windowFrames = Math.max(
    1,
    Math.round(
      (options.windowSeconds ?? DEFAULT_WINDOW_SECONDS) * format.sampleRate,
    ),
  )
  const lookahead = Math.max(
    1,
    options.lookaheadWindows ?? DEFAULT_LOOKAHEAD_WINDOWS,
  )

  const startFrame = Math.min(
    format.frameCount,
    Math.max(0, Math.round(sourceOffsetSeconds * format.sampleRate)),
  )
  const cappedFrames =
    options.maxDurationSeconds === undefined
      ? format.frameCount - startFrame
      : Math.min(
          format.frameCount - startFrame,
          Math.max(
            0,
            Math.round(options.maxDurationSeconds * format.sampleRate),
          ),
        )
  const endFrame = startFrame + cappedFrames
  const totalWindows = Math.ceil(cappedFrames / windowFrames)

  const envelope = context.createGain()
  envelope.connect(destination)

  const activeSources = new Set<AudioBufferSourceNode>()
  let scheduledWindows = 0
  let finishedWindows = 0
  let stopped = false
  /** Where the live windows were told to stop, once they were. */
  let stopAt: number | null = null
  let ended = false
  let scheduling = false

  const disconnectSource = (source: AudioBufferSourceNode): void => {
    try {
      source.disconnect()
    } catch {
      // Already disconnected by dispose.
    }
  }

  const finish = (): void => {
    if (ended) return
    ended = true
    options.onEnded?.()
  }
  if (totalWindows === 0) queueMicrotask(finish)

  const windowStartTime = (index: number): number =>
    atContextTime + (index * windowFrames) / format.sampleRate / rate

  const scheduleNext = async (): Promise<void> => {
    if (scheduling) return
    scheduling = true
    try {
      while (
        !stopped &&
        scheduledWindows < totalWindows &&
        scheduledWindows - finishedWindows < lookahead
      ) {
        const index = scheduledWindows
        scheduledWindows += 1
        const first = startFrame + index * windowFrames
        const frames = Math.min(windowFrames, endFrame - first)
        const channels = await readWindow(blob, format, first, frames)
        if (stopped) return

        const buffer = context.createBuffer(
          format.channelCount,
          frames,
          format.sampleRate,
        )
        for (let channel = 0; channel < channels.length; channel++) {
          buffer.copyToChannel(
            channels[channel] as Float32Array<ArrayBuffer>,
            channel,
          )
        }

        const source = context.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = rate
        source.connect(envelope)
        activeSources.add(source)
        source.onended = () => {
          activeSources.delete(source)
          disconnectSource(source)
          finishedWindows += 1
          if (stopped) {
            // A stopped voice ends with its last live window. Ending it at
            // stop() instead had the engine tear the envelope down while
            // the release it had just scheduled was still sounding.
            if (activeSources.size === 0) finish()
            return
          }
          if (finishedWindows >= totalWindows) {
            finish()
            return
          }
          void scheduleNext()
        }

        const when = windowStartTime(index)
        const now = context.currentTime
        if (when >= now) {
          source.start(when)
        } else {
          // A slow read left this window late: start immediately, skipping
          // the part of the window the clock already passed.
          const missedSourceSeconds = (now - when) * rate
          if (missedSourceSeconds >= frames / format.sampleRate) {
            // The whole window is in the past; let onended bookkeeping run.
            source.start(now, 0, 1 / format.sampleRate)
          } else {
            source.start(now, missedSourceSeconds)
          }
        }
      }
    } finally {
      scheduling = false
    }
  }
  void scheduleNext()

  return {
    envelope,
    get ended() {
      return ended
    },
    stop(stopAtContextTime: number) {
      const at = Math.max(context.currentTime, stopAtContextTime)
      if (stopped && (stopAt === null || at >= stopAt)) return
      stopped = true
      stopAt = at
      for (const source of activeSources) {
        try {
          // The handler stays: it is what ends the voice.
          source.stop(at)
        } catch {
          // Never started, so it will never end on its own: it is inert,
          // and it must not keep the voice waiting.
          activeSources.delete(source)
          disconnectSource(source)
        }
      }
      if (activeSources.size === 0) finish()
    },
    dispose() {
      stopped = true
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
      try {
        envelope.disconnect()
      } catch {
        // Already disconnected.
      }
      finish()
    },
  }
}
