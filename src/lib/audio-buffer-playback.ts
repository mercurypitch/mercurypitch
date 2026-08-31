// ============================================================
// Audio Buffer Playback — shared pop-free decoded-audio transport
// ============================================================
//
// Owns one AudioBufferSourceNode at a time and puts the mandatory house
// envelope between it and a caller-owned output. Saved takes can therefore
// add a room rack, while temporary dry replays connect straight to destination.

import { closeEnvelope, dipEnvelope, ENVELOPE_DEFAULTS, openEnvelope, } from '@/lib/preview-player'

const RELEASE_SLACK_MS = 60
const SEEK_TIMER_SLACK_MS = 5

export interface AudioBufferPlaybackFrameScheduler {
  request: (callback: FrameRequestCallback) => number
  cancel: (id: number) => void
}

const browserFrameScheduler: AudioBufferPlaybackFrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
}

export interface AudioBufferPlayback {
  readonly playing: boolean
  readonly progress: number
  play: () => Promise<boolean>
  pause: () => void
  seek: (progress: number) => void
  dispose: () => void
}

export interface AudioBufferPlaybackOptions {
  context: AudioContext
  buffer: AudioBuffer
  output: AudioNode
  onProgress: (progress: number) => void
  onPlayingChange: (playing: boolean) => void
  onEnded: () => void
  onError?: () => void
  frameScheduler?: AudioBufferPlaybackFrameScheduler
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

/**
 * Play a decoded buffer through a caller-owned output with attack, release,
 * and seek envelopes. Disposal remains an immediate emergency teardown.
 */
export function createAudioBufferPlayback(
  options: AudioBufferPlaybackOptions,
): AudioBufferPlayback {
  const duration = options.buffer.duration
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Audio buffer playback requires a non-empty AudioBuffer')
  }

  const context = options.context
  const scheduler = options.frameScheduler ?? browserFrameScheduler
  const attackSeconds = ENVELOPE_DEFAULTS.attackMs / 1000
  const releaseSeconds = ENVELOPE_DEFAULTS.releaseMs / 1000
  const seekFadeSeconds = ENVELOPE_DEFAULTS.seekFadeMs / 1000
  const envelope = context.createGain()
  envelope.gain.value = 0

  try {
    envelope.connect(options.output)
  } catch (error) {
    try {
      envelope.disconnect()
    } catch {
      // A partially constructed graph may not have connected the envelope.
    }
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
        // The decoded clock is an independent terminal-state fallback for
        // engines that delay or omit a source's natural end notification.
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
        // A paused scrub can race the old source's release. Dip before swapping
        // so a fast pause -> scrub -> play cannot leak two buffers or click.
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
    },
  }
}
