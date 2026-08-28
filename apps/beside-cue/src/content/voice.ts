// ============================================================
// Character voice — caption-authoritative, asset-optional playback
// ============================================================

import type { AudioSourceVariant } from './audio-manifest'
import { findDialogueAudioAssetForLine } from './audio-manifest'
import type { ContentPack, Line } from './pack'
import { findLine } from './pack'

export type VoiceSilentReason =
  | 'not-recorded'
  | 'muted'
  | 'unavailable'
  | 'playback-failed'
  | 'cancelled'
  | 'disposed'

export type VoiceStopReason =
  | 'replaced'
  | 'user'
  | 'muted'
  | 'hidden'
  | 'route-exit'
  | 'disposed'

export type VoiceStartResult =
  | { readonly kind: 'started' }
  | { readonly kind: 'silent'; readonly reason: VoiceSilentReason }

export type VoiceFinishResult =
  | { readonly kind: 'ended' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'silent'; readonly reason: VoiceSilentReason }
  | { readonly kind: 'stopped'; readonly reason: VoiceStopReason }

export type VoicePlaybackStatus =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'starting' | 'playing' | 'played' | 'failed'
      readonly lineId: string
      readonly requestId: number
    }

export type VoiceAudioFinish = 'ended' | 'failed' | 'stopped'

/** One exact platform playback. Stopping it cannot affect a newer handle. */
export interface VoiceAudioHandle {
  readonly started: Promise<void>
  readonly finished: Promise<VoiceAudioFinish>
  stop: () => void
}

/** App-scoped port. Content and screens never receive an audio URL. */
export interface VoiceAudioPort {
  supportsMimeType: (mimeType: string) => boolean
  play: (source: AudioSourceVariant) => VoiceAudioHandle
  dispose: () => void
}

export interface VoiceCue {
  readonly requestId: number
  readonly line: Line
  /** Always rendered, regardless of the playback result. */
  readonly caption: string
  readonly recordingAvailable: boolean
  readonly started: Promise<VoiceStartResult>
  readonly finished: Promise<VoiceFinishResult>
}

export interface VoicePlayerOptions {
  readonly pack: ContentPack
  /** Omitted where no local output exists, such as a server render. */
  readonly audio?: VoiceAudioPort
  /** Muting suppresses sound, never the caption. */
  readonly muted?: () => boolean
  readonly onStatusChange?: (status: VoicePlaybackStatus) => void
}

export interface VoicePlayer {
  playLine: (lineId: string) => VoiceCue
  /** True when the pack declares an exact caption-bound recording. */
  hasRecording: (lineId: string) => boolean
  /** True only when this runtime can attempt at least one declared source. */
  canPlayLine: (lineId: string) => boolean
  stop: (reason?: VoiceStopReason) => void
  dispose: () => void
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

interface ActiveVoice {
  readonly requestId: number
  readonly lineId: string
  readonly handle: VoiceAudioHandle
  readonly finished: Deferred<VoiceFinishResult>
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function resolvedCue(
  line: Line,
  requestId: number,
  reason: VoiceSilentReason,
): VoiceCue {
  const result = { kind: 'silent', reason } as const
  return {
    requestId,
    line,
    caption: line.text,
    recordingAvailable: false,
    started: Promise.resolve(result),
    finished: Promise.resolve(result),
  }
}

function dialogueForLine(pack: ContentPack, line: Line) {
  if (line.captionSha256 === undefined) return undefined
  return findDialogueAudioAssetForLine(pack.audio, {
    lineId: line.id,
    captionSha256: line.captionSha256,
  })
}

export function createVoicePlayer(options: VoicePlayerOptions): VoicePlayer {
  let nextRequestId = 0
  let active: ActiveVoice | undefined
  let disposed = false

  const emit = (status: VoicePlaybackStatus): void => {
    options.onStatusChange?.(status)
  }

  const stopActive = (reason: VoiceStopReason): void => {
    const previous = active
    active = undefined
    if (previous !== undefined) {
      previous.handle.stop()
      previous.finished.resolve({ kind: 'stopped', reason })
    }
    emit({ phase: 'idle' })
  }

  const stop = (reason: VoiceStopReason = 'user'): void => {
    nextRequestId += 1
    stopActive(reason)
  }

  const hasRecording = (lineId: string): boolean => {
    const line = findLine(options.pack, lineId)
    return (
      line !== undefined && dialogueForLine(options.pack, line) !== undefined
    )
  }

  const canPlayLine = (lineId: string): boolean => {
    const line = findLine(options.pack, lineId)
    const dialogue =
      line === undefined ? undefined : dialogueForLine(options.pack, line)
    const audio = options.audio
    return (
      dialogue !== undefined &&
      audio !== undefined &&
      dialogue.sources.some(
        (source) => audio.supportsMimeType(source.mimeType) === true,
      )
    )
  }

  const playLine = (lineId: string): VoiceCue => {
    const line = findLine(options.pack, lineId)
    if (line === undefined) {
      throw new Error(
        `No line "${lineId}" in content pack "${options.pack.id}".`,
      )
    }

    const requestId = (nextRequestId += 1)
    stopActive('replaced')

    if (disposed) return resolvedCue(line, requestId, 'disposed')

    const dialogue = dialogueForLine(options.pack, line)
    if (dialogue === undefined) {
      return resolvedCue(line, requestId, 'not-recorded')
    }
    if (options.muted?.() === true) {
      return {
        ...resolvedCue(line, requestId, 'muted'),
        recordingAvailable: true,
      }
    }
    const audio = options.audio
    if (audio === undefined) {
      return {
        ...resolvedCue(line, requestId, 'unavailable'),
        recordingAvailable: true,
      }
    }

    const supportedSources = dialogue.sources.filter(
      (source) => audio.supportsMimeType(source.mimeType) === true,
    )
    if (supportedSources.length === 0) {
      return {
        ...resolvedCue(line, requestId, 'unavailable'),
        recordingAvailable: true,
      }
    }

    const finished = deferred<VoiceFinishResult>()
    emit({ phase: 'starting', lineId, requestId })

    const start = async (): Promise<VoiceStartResult> => {
      for (const source of supportedSources) {
        if (disposed || requestId !== nextRequestId) {
          const result = {
            kind: 'silent',
            reason: disposed ? 'disposed' : 'cancelled',
          } as const
          finished.resolve(result)
          return result
        }

        let handle: VoiceAudioHandle
        try {
          handle = audio.play(source)
        } catch {
          continue
        }

        active = { requestId, lineId, handle, finished }
        try {
          await handle.started
        } catch {
          handle.stop()
          if (active?.requestId === requestId) active = undefined
          continue
        }

        if (disposed || requestId !== nextRequestId) {
          handle.stop()
          const result = {
            kind: 'silent',
            reason: disposed ? 'disposed' : 'cancelled',
          } as const
          finished.resolve(result)
          return result
        }

        emit({ phase: 'playing', lineId, requestId })
        void handle.finished.then((result) => {
          if (active?.requestId !== requestId) return
          active = undefined
          if (result === 'ended') {
            emit({ phase: 'played', lineId, requestId })
            finished.resolve({ kind: 'ended' })
          } else if (result === 'failed') {
            emit({ phase: 'failed', lineId, requestId })
            finished.resolve({ kind: 'failed' })
          } else {
            emit({ phase: 'idle' })
            finished.resolve({ kind: 'stopped', reason: 'user' })
          }
        })
        return { kind: 'started' }
      }

      if (requestId === nextRequestId) {
        emit({ phase: 'failed', lineId, requestId })
      }
      const result: VoiceStartResult = {
        kind: 'silent',
        reason:
          disposed || requestId !== nextRequestId
            ? ('cancelled' as const)
            : ('playback-failed' as const),
      }
      finished.resolve(result)
      return result
    }

    return {
      requestId,
      line,
      caption: line.text,
      recordingAvailable: true,
      started: start(),
      finished: finished.promise,
    }
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    nextRequestId += 1
    stopActive('disposed')
    options.audio?.dispose()
  }

  return { playLine, hasRecording, canPlayLine, stop, dispose }
}

function packagedAudioUrl(src: string): string {
  const relative = src.replace(/^\.?\//u, '')
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${relative}`
}

/** Wraps one HTMLAudioElement per handle so stale stops stay handle-local. */
export function createElementAudioPort(): VoiceAudioPort | undefined {
  if (typeof Audio === 'undefined') return undefined

  const handles = new Set<VoiceAudioHandle>()
  let disposed = false
  let probe: HTMLAudioElement | undefined

  const supportsMimeType = (mimeType: string): boolean => {
    try {
      probe ??= new Audio()
      return probe.canPlayType(mimeType) !== ''
    } catch {
      return false
    }
  }

  const play = (source: AudioSourceVariant): VoiceAudioHandle => {
    if (disposed) throw new Error('Voice audio port is disposed.')

    const element = new Audio(packagedAudioUrl(source.src))
    const completion = deferred<VoiceAudioFinish>()
    let settled = false

    const cleanup = (): void => {
      element.removeEventListener('ended', handleEnded)
      element.removeEventListener('error', handleError)
    }
    const settle = (result: VoiceAudioFinish): void => {
      if (settled) return
      settled = true
      cleanup()
      completion.resolve(result)
    }
    const handleEnded = (): void => settle('ended')
    const handleError = (): void => settle('failed')
    element.addEventListener('ended', handleEnded)
    element.addEventListener('error', handleError)

    const handle: VoiceAudioHandle = {
      started: Promise.resolve()
        .then(() => element.play())
        .then(() => undefined)
        .catch((error: unknown) => {
          settle('failed')
          throw error
        }),
      finished: completion.promise,
      stop: () => {
        element.pause()
        settle('stopped')
      },
    }
    handles.add(handle)
    void completion.promise.then(() => handles.delete(handle))
    return handle
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    for (const handle of handles) handle.stop()
    handles.clear()
    probe = undefined
  }

  return { supportsMimeType, play, dispose }
}
