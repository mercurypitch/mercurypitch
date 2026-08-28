// ============================================================
// Decoded Voice Playback — room-aware transport for saved voice takes
// ============================================================

import type { AudioBufferPlayback, AudioBufferPlaybackFrameScheduler, } from '@/lib/audio-buffer-playback'
import { createAudioBufferPlayback } from '@/lib/audio-buffer-playback'
import type { FxRack, FxSettings } from '@/lib/voice-fx-rack'
import { createFxRack } from '@/lib/voice-fx-rack'

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
  frameScheduler?: AudioBufferPlaybackFrameScheduler
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

/**
 * App-owned recorded containers are decoded before replay. This avoids
 * WebKit's choppy MediaElementAudioSource path and makes room processing
 * deterministic without user-agent detection.
 */
export function shouldDecodeVoicePlayback(mimeType: string): boolean {
  const container = mimeType.trim().toLowerCase().split(';', 1)[0]
  return (
    container === 'audio/webm' ||
    container === 'video/webm' ||
    container === 'audio/mp4' ||
    container === 'video/mp4' ||
    container === 'audio/m4a' ||
    container === 'audio/x-m4a'
  )
}

/**
 * Decode and prepare one saved take, returning native fallback when the browser
 * rejects any part of that path. UI state remains page-owned through explicit
 * callbacks, while this helper owns request gating and teardown.
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
  const context = options.context
  let rack: Pick<FxRack, 'input' | 'setSettings' | 'dispose'> | null = null
  let playback: AudioBufferPlayback | null = null

  try {
    const rackFactory =
      options.rackFactory ??
      ((ctx: AudioContext) => createFxRack(ctx, { safetyLimiter: true }))
    rack = rackFactory(context)
    rack.setSettings(options.settings)
    playback = createAudioBufferPlayback({
      context,
      buffer: options.buffer,
      output: rack.input,
      onProgress: options.onProgress,
      onPlayingChange: options.onPlayingChange,
      onEnded: options.onEnded,
      onError: options.onError,
      frameScheduler: options.frameScheduler,
    })
  } catch (error) {
    rack?.dispose()
    throw error
  }

  let disposed = false
  return {
    get playing() {
      return playback.playing
    },
    get progress() {
      return playback.progress
    },
    play: playback.play,
    pause: playback.pause,
    seek: playback.seek,
    setSettings: (settings) => {
      if (!disposed) rack?.setSettings(settings)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      try {
        playback.dispose()
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
