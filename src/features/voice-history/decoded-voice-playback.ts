// ============================================================
// Decoded Voice Playback — room-aware transport for saved WebM takes
// ============================================================

import { closeEnvelope, dipEnvelope, ENVELOPE_DEFAULTS, openEnvelope, } from '@/lib/preview-player'
import type { FxRack, FxSettings } from '@/lib/voice-fx-rack'
import { createFxRack } from '@/lib/voice-fx-rack'

const RELEASE_SLACK_MS = 60
const SEEK_TIMER_SLACK_MS = 5

interface PlaybackFrameScheduler {
  request: (callback: FrameRequestCallback) => number
  cancel: (id: number) => void
}

const browserFrameScheduler: PlaybackFrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
}

export interface DecodedVoicePlayback {
  readonly playing: boolean
  readonly progress: number
  play: () => Promise<boolean>
  pause: () => void
  seek: (progress: number) => void
  setSettings: (settings: FxSettings) => void
  dispose: () => void
}

export interface DecodedVoicePlaybackOptions {
  context: AudioContext
  buffer: AudioBuffer
  settings: FxSettings
  onProgress: (progress: number) => void
  onPlayingChange: (playing: boolean) => void
  onEnded: () => void
  onError?: () => void
  frameScheduler?: PlaybackFrameScheduler
  rackFactory?: (
    context: AudioContext,
  ) => Pick<FxRack, 'input' | 'setSettings' | 'dispose'>
}

export interface DecodedVoicePlaybackAttemptOptions {
  context: AudioContext | null
  blob: Blob
  persistedMimeType: string
  settings: FxSettings
  autoplay: boolean
  requestedProgress?: number
  isCurrent: () => boolean
  onPrepared: (playback: DecodedVoicePlayback) => void
  onDiscarded: (playback: DecodedVoicePlayback) => void
  onProgress: (playback: DecodedVoicePlayback, progress: number) => void
  onPlayingChange: (playback: DecodedVoicePlayback, playing: boolean) => void
  onEnded: (playback: DecodedVoicePlayback) => void
  onError: (playback: DecodedVoicePlayback) => void
  playbackFactory?: (
    options: DecodedVoicePlaybackOptions,
  ) => DecodedVoicePlayback
}

export type DecodedVoicePlaybackAttemptResult =
  | { status: 'native-fallback' }
  | { status: 'cancelled' }
  | {
      status: 'handled'
      playback: DecodedVoicePlayback
      /** `null` means the take was prepared for a paused scrub only. */
      started: boolean | null
    }

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

/**
 * WebKit can play a WebM/Opus media element while bypassing downstream Web
 * Audio processing. Decoding the same take into an AudioBuffer makes the room
 * graph deterministic on every platform without user-agent detection.
 */
export function shouldDecodeVoicePlayback(mimeType: string): boolean {
  return mimeType.trim().toLowerCase().split(';', 1)[0].endsWith('/webm')
}

/**
 * Decode and prepare one saved WebM take, returning native fallback when the
 * browser rejects any part of that path. UI state remains page-owned through
 * explicit callbacks, while this helper owns request gating and teardown.
 */
export async function attemptDecodedVoicePlayback(
  options: DecodedVoicePlaybackAttemptOptions,
): Promise<DecodedVoicePlaybackAttemptResult> {
  const context = options.context
  if (
    context === null ||
    context.state === 'closed' ||
    (!shouldDecodeVoicePlayback(options.blob.type) &&
      !shouldDecodeVoicePlayback(options.persistedMimeType))
  ) {
    return { status: 'native-fallback' }
  }

  let candidate: DecodedVoicePlayback | null = null
  let prepared = false
  const discardCandidate = (): void => {
    if (candidate === null) return
    if (prepared) {
      try {
        options.onDiscarded(candidate)
      } catch {
        // UI cleanup must not prevent graph cleanup or native fallback.
      }
    }
    try {
      candidate.dispose()
    } catch {
      // A partially failed graph must not block native-media fallback.
    }
  }

  try {
    const encoded = await options.blob.arrayBuffer()
    if (!options.isCurrent()) return { status: 'cancelled' }
    const decodedBuffer = await context.decodeAudioData(encoded)
    if (!options.isCurrent()) return { status: 'cancelled' }

    const playbackFactory =
      options.playbackFactory ?? createDecodedVoicePlayback
    candidate = playbackFactory({
      context,
      buffer: decodedBuffer,
      settings: options.settings,
      onProgress: (progress) => {
        if (candidate !== null) options.onProgress(candidate, progress)
      },
      onPlayingChange: (playing) => {
        if (candidate !== null) options.onPlayingChange(candidate, playing)
      },
      onEnded: () => {
        if (candidate !== null) options.onEnded(candidate)
      },
      onError: () => {
        if (candidate !== null) options.onError(candidate)
      },
    })
    if (!options.isCurrent()) {
      discardCandidate()
      return { status: 'cancelled' }
    }

    prepared = true
    options.onPrepared(candidate)
    if (options.requestedProgress !== undefined) {
      candidate.seek(options.requestedProgress)
    }
    if (!options.autoplay) {
      return { status: 'handled', playback: candidate, started: null }
    }

    const started = await candidate.play()
    if (!options.isCurrent()) {
      discardCandidate()
      return { status: 'cancelled' }
    }
    return { status: 'handled', playback: candidate, started }
  } catch {
    discardCandidate()
    return options.isCurrent()
      ? { status: 'native-fallback' }
      : { status: 'cancelled' }
  }
}

export function createDecodedVoicePlayback(
  options: DecodedVoicePlaybackOptions,
): DecodedVoicePlayback {
  const duration = options.buffer.duration
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Decoded voice playback requires a non-empty AudioBuffer')
  }

  const context = options.context
  const scheduler = options.frameScheduler ?? browserFrameScheduler
  const attackSeconds = ENVELOPE_DEFAULTS.attackMs / 1000
  const releaseSeconds = ENVELOPE_DEFAULTS.releaseMs / 1000
  const seekFadeSeconds = ENVELOPE_DEFAULTS.seekFadeMs / 1000
  const envelope = context.createGain()
  envelope.gain.value = 0
  let rack: Pick<FxRack, 'input' | 'setSettings' | 'dispose'> | null = null

  try {
    const rackFactory =
      options.rackFactory ??
      ((ctx: AudioContext) => createFxRack(ctx, { safetyLimiter: true }))
    rack = rackFactory(context)
    rack.setSettings(options.settings)
    envelope.connect(rack.input)
  } catch (error) {
    try {
      envelope.disconnect()
    } catch {
      // A partially constructed graph may not have connected the envelope.
    }
    rack?.dispose()
    throw error
  }

  let source: AudioBufferSourceNode | null = null
  let sourceOffsetSeconds = 0
  let sourceStartedAt = context.currentTime
  let positionSeconds = 0
  let pendingSeekSeconds: number | null = null
  let wantsPlayback = false
  let disposed = false
  let endedReported = false
  let frame: number | null = null
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let seekTimer: ReturnType<typeof setTimeout> | undefined

  const clearFrame = (): void => {
    if (frame !== null) scheduler.cancel(frame)
    frame = null
  }

  const clearReleaseTimer = (): void => {
    clearTimeout(releaseTimer)
    releaseTimer = undefined
  }

  const clearSeekTimer = (): void => {
    clearTimeout(seekTimer)
    seekTimer = undefined
  }

  const sourcePosition = (): number =>
    Math.max(
      0,
      Math.min(
        duration,
        sourceOffsetSeconds +
          Math.max(0, context.currentTime - sourceStartedAt),
      ),
    )

  const currentPosition = (): number => {
    if (pendingSeekSeconds !== null) return pendingSeekSeconds
    if (source !== null && wantsPlayback) return sourcePosition()
    return Math.max(0, Math.min(duration, positionSeconds))
  }

  const emitProgress = (seconds = currentPosition()): void => {
    options.onProgress(clamp01(seconds / duration))
  }

  const stopCurrentSource = (): void => {
    const current = source
    source = null
    if (current === null) return
    current.onended = null
    try {
      current.stop()
    } catch {
      // A naturally ended source has already stopped itself.
    }
    try {
      current.disconnect()
    } catch {
      // Teardown is intentionally idempotent.
    }
  }

  const silenceEnvelope = (): void => {
    envelope.gain.cancelScheduledValues(context.currentTime)
    envelope.gain.value = 0
  }

  const recoverFromTransportFailure = (notify: boolean): void => {
    positionSeconds = pendingSeekSeconds ?? positionSeconds
    pendingSeekSeconds = null
    wantsPlayback = false
    clearFrame()
    clearReleaseTimer()
    clearSeekTimer()
    stopCurrentSource()
    try {
      silenceEnvelope()
    } catch {
      // Preserve the transport error if the broken graph also rejects reset.
    }
    options.onPlayingChange(false)
    if (notify) options.onError?.()
  }

  const finishPlayback = (): void => {
    if (disposed) return
    clearFrame()
    clearReleaseTimer()
    clearSeekTimer()
    pendingSeekSeconds = null
    wantsPlayback = false
    positionSeconds = duration
    stopCurrentSource()
    silenceEnvelope()
    options.onPlayingChange(false)
    options.onProgress(1)
    if (!endedReported) {
      endedReported = true
      options.onEnded()
    }
  }

  const scheduleProgress = (): void => {
    clearFrame()
    const tick = (): void => {
      frame = null
      if (disposed || !wantsPlayback || pendingSeekSeconds !== null) return
      const seconds = sourcePosition()
      if (seconds >= duration) {
        // WebKit has historically delayed or omitted media end notifications.
        // The decoded clock is an independent terminal-state fallback.
        finishPlayback()
        return
      }
      positionSeconds = seconds
      emitProgress(seconds)
      frame = scheduler.request(tick)
    }
    frame = scheduler.request(tick)
  }

  const startSource = (offsetSeconds: number): void => {
    const offset = Math.max(0, Math.min(duration, offsetSeconds))
    if (offset >= duration) {
      finishPlayback()
      return
    }
    const nextSource = context.createBufferSource()
    nextSource.buffer = options.buffer
    nextSource.connect(envelope)
    source = nextSource
    sourceOffsetSeconds = offset
    sourceStartedAt = context.currentTime
    positionSeconds = offset
    nextSource.onended = () => {
      if (
        disposed ||
        source !== nextSource ||
        !wantsPlayback ||
        pendingSeekSeconds !== null
      ) {
        return
      }
      finishPlayback()
    }
    nextSource.start(0, offset)
  }

  const play = async (): Promise<boolean> => {
    if (disposed || context.state === 'closed') return false
    if (wantsPlayback) return true
    try {
      if (context.state !== 'running') await context.resume()
    } catch {
      return false
    }
    // Re-read after the async resume: the context may have been interrupted
    // or closed while the gesture was being serviced.
    if (disposed || context.state !== 'running') return false

    clearReleaseTimer()
    clearSeekTimer()
    if (positionSeconds >= duration) {
      positionSeconds = 0
      pendingSeekSeconds = null
      endedReported = false
      options.onProgress(0)
    }

    wantsPlayback = true
    options.onPlayingChange(true)

    try {
      if (source !== null && pendingSeekSeconds === null) {
        const actualPosition = sourcePosition()
        if (actualPosition < duration) {
          // A quick resume can reuse the source that is still completing its
          // release tail. Re-anchor the clock before opening the envelope.
          sourceOffsetSeconds = actualPosition
          sourceStartedAt = context.currentTime
          positionSeconds = actualPosition
          openEnvelope(envelope, context, attackSeconds)
          emitProgress(actualPosition)
          scheduleProgress()
          return true
        }
        stopCurrentSource()
        positionSeconds = 0
        endedReported = false
        options.onProgress(0)
      }

      const offset = pendingSeekSeconds ?? positionSeconds
      if (source !== null) {
        // The singer scrubbed while the old source was completing its pause
        // release. Finish a short seek dip before swapping sources so a rapid
        // pause -> scrub -> play sequence cannot leak two buffers or click.
        dipEnvelope(envelope, context, seekFadeSeconds, 0)
        seekTimer = setTimeout(() => {
          seekTimer = undefined
          if (disposed || !wantsPlayback) return
          try {
            stopCurrentSource()
            pendingSeekSeconds = null
            startSource(offset)
            if (!wantsPlayback) return
            dipEnvelope(envelope, context, seekFadeSeconds, 1)
            scheduleProgress()
          } catch {
            recoverFromTransportFailure(true)
          }
        }, ENVELOPE_DEFAULTS.seekFadeMs + SEEK_TIMER_SLACK_MS)
        return true
      }

      pendingSeekSeconds = null
      startSource(offset)
      if (!wantsPlayback) return true
      openEnvelope(envelope, context, attackSeconds)
      emitProgress(offset)
      scheduleProgress()
      return true
    } catch (error) {
      recoverFromTransportFailure(false)
      throw error
    }
  }

  const pause = (): void => {
    if (disposed || !wantsPlayback) return
    const pausedAt = currentPosition()
    positionSeconds = pausedAt
    wantsPlayback = false
    clearFrame()
    clearSeekTimer()
    emitProgress(pausedAt)
    options.onPlayingChange(false)

    if (source === null) return
    closeEnvelope(envelope, context, releaseSeconds)
    clearReleaseTimer()
    releaseTimer = setTimeout(() => {
      releaseTimer = undefined
      if (disposed || wantsPlayback) return
      stopCurrentSource()
      silenceEnvelope()
    }, ENVELOPE_DEFAULTS.releaseMs + RELEASE_SLACK_MS)
  }

  const seek = (progress: number): void => {
    if (disposed) return
    const targetSeconds = clamp01(progress) * duration
    positionSeconds = targetSeconds
    pendingSeekSeconds = targetSeconds
    endedReported = targetSeconds >= duration
    options.onProgress(clamp01(progress))

    if (!wantsPlayback) return
    clearFrame()
    clearSeekTimer()
    dipEnvelope(envelope, context, seekFadeSeconds, 0)
    seekTimer = setTimeout(() => {
      seekTimer = undefined
      if (disposed || !wantsPlayback) return
      try {
        stopCurrentSource()
        pendingSeekSeconds = null
        if (targetSeconds >= duration) {
          endedReported = false
          finishPlayback()
          return
        }
        endedReported = false
        startSource(targetSeconds)
        dipEnvelope(envelope, context, seekFadeSeconds, 1)
        scheduleProgress()
      } catch {
        recoverFromTransportFailure(true)
      }
    }, ENVELOPE_DEFAULTS.seekFadeMs + SEEK_TIMER_SLACK_MS)
  }

  return {
    get playing() {
      return wantsPlayback
    },
    get progress() {
      return clamp01(currentPosition() / duration)
    },
    play,
    pause,
    seek,
    setSettings: (settings) => {
      if (!disposed) rack?.setSettings(settings)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      wantsPlayback = false
      clearFrame()
      clearReleaseTimer()
      clearSeekTimer()
      stopCurrentSource()
      try {
        silenceEnvelope()
      } catch {
        // A broken AudioParam must not make controller cleanup throw.
      }
      try {
        envelope.disconnect()
      } catch {
        // The graph may already have been disconnected by the platform.
      }
      try {
        rack?.dispose()
      } catch {
        // The surrounding page must remain free to use native-media fallback.
      }
      rack = null
    },
  }
}
