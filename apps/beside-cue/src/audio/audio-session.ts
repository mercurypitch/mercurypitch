// ============================================================
// Audio session — one app-scoped owner for Beside Cue sound
// ============================================================
//
// Content selects semantic asset ids. This session owns lane replacement,
// cancellation generations and dialogue ducking; platform output owns bytes,
// decoding and the Web Audio graph.

import type { AudioAsset, AudioAssetManifest, AudioLane, AudioPlayback, AudioSourceVariant, } from '../content/audio-manifest'
import { findAudioAsset } from '../content/audio-manifest'

export type AudioSessionSilentReason =
  | 'asset-missing'
  | 'output-unavailable'
  | 'muted'
  | 'backgrounded'
  | 'unsupported'
  | 'load-failed'
  | 'cancelled'
  | 'scope-disposed'
  | 'session-disposed'

export type AudioSessionStopReason =
  | 'user'
  | 'replaced'
  | 'lane-stopped'
  | 'scope-stopped'
  | 'muted'
  | 'backgrounded'
  | 'scope-disposed'
  | 'session-disposed'

export type AudioSessionStartResult =
  | { readonly kind: 'started' }
  | { readonly kind: 'silent'; readonly reason: AudioSessionSilentReason }

export type AudioSessionFinishResult =
  | { readonly kind: 'ended' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'silent'; readonly reason: AudioSessionSilentReason }
  | { readonly kind: 'stopped'; readonly reason: AudioSessionStopReason }

export type AudioOutputStartResult = 'started' | 'failed' | 'stopped'
export type AudioOutputFinishResult = 'ended' | 'failed' | 'stopped'

export interface AudioOutputPlayback {
  readonly started: Promise<AudioOutputStartResult>
  readonly finished: Promise<AudioOutputFinishResult>
  /** Pop-safe live gain, used for dialogue ducking. */
  setGain(gain: number): void
  stop(): void
}

export interface AudioOutputPlayRequest {
  readonly source: AudioSourceVariant
  readonly playback: AudioPlayback
  readonly initialGain: number
}

/** Browser/native byte and playback seam. It never chooses product content. */
export interface AudioSessionOutput {
  supportsMimeType(mimeType: string): boolean
  unlock(): Promise<boolean>
  play(request: AudioOutputPlayRequest): AudioOutputPlayback
  dispose(): void
}

export interface AudioSessionCue {
  readonly requestId: number
  readonly assetId: string
  readonly lane?: AudioLane
  readonly started: Promise<AudioSessionStartResult>
  readonly finished: Promise<AudioSessionFinishResult>
  /** Returns false after the cue has already settled or stopped. */
  stop(reason?: AudioSessionStopReason): boolean
}

export interface AudioSessionScope {
  readonly owner: string
  play(assetId: string): AudioSessionCue
  stopLane(lane: AudioLane, reason?: AudioSessionStopReason): void
  stopAll(reason?: AudioSessionStopReason): void
  dispose(): void
}

export interface AudioSession {
  createScope(owner: string): AudioSessionScope
  /** Call directly from the gesture that permits subsequent playback. */
  unlock(): Promise<boolean>
  /** Muting cancels current and pending sound; unmuting never resumes it. */
  setMuted(muted: boolean): void
  /** Leaving the foreground cancels sound; returning never resumes it. */
  setForeground(foreground: boolean): void
  dispose(): void
}

export interface AudioSessionOptions {
  readonly manifest: AudioAssetManifest
  readonly output?: AudioSessionOutput
  readonly muted?: boolean
  readonly foreground?: boolean
  /** Linear amplitude applied to score and hold-bed while dialogue is active. */
  readonly dialogueDuckGain?: number
}

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly settled: () => boolean
  resolve(value: T): boolean
}

interface ScopeState {
  readonly id: number
  readonly owner: string
  generation: number
  disposed: boolean
}

interface ActiveRequest {
  readonly requestId: number
  readonly asset: AudioAsset
  readonly scope: ScopeState
  readonly sessionGeneration: number
  readonly scopeGeneration: number
  readonly laneGeneration: number
  readonly started: Deferred<AudioSessionStartResult>
  readonly finished: Deferred<AudioSessionFinishResult>
  outputPlayback?: AudioOutputPlayback
  didStart: boolean
}

const DEFAULT_DIALOGUE_DUCK_GAIN = 0.35

function deferred<T>(): Deferred<T> {
  let didSettle = false
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    settled: () => didSettle,
    resolve(value) {
      if (didSettle) return false
      didSettle = true
      resolvePromise(value)
      return true
    },
  }
}

function clampGain(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0.0001, Math.min(1, value))
    : DEFAULT_DIALOGUE_DUCK_GAIN
}

function resolvedCue(
  requestId: number,
  assetId: string,
  reason: AudioSessionSilentReason,
  lane?: AudioLane,
): AudioSessionCue {
  const result = { kind: 'silent', reason } as const
  return {
    requestId,
    assetId,
    ...(lane === undefined ? {} : { lane }),
    started: Promise.resolve(result),
    finished: Promise.resolve(result),
    stop: () => false,
  }
}

/**
 * Creates one session for the app lifetime. Scopes describe feature ownership,
 * while lane ownership remains global so two routes cannot layer the same lane.
 */
export function createAudioSession(options: AudioSessionOptions): AudioSession {
  const output = options.output
  const duckGain = clampGain(options.dialogueDuckGain)
  const scopes = new Map<number, ScopeState>()
  const activeByLane = new Map<AudioLane, ActiveRequest>()
  const laneGenerations = new Map<AudioLane, number>()

  let nextScopeId = 0
  let nextRequestId = 0
  let sessionGeneration = 0
  let muted = options.muted === true
  let foreground = options.foreground !== false
  let disposed = false
  let dialogueOwnerRequestId: number | undefined
  let dialogueDuckActive = false

  function nextLaneGeneration(lane: AudioLane): number {
    const generation = (laneGenerations.get(lane) ?? 0) + 1
    laneGenerations.set(lane, generation)
    return generation
  }

  function isCurrent(request: ActiveRequest): boolean {
    return (
      !disposed &&
      !request.scope.disposed &&
      request.sessionGeneration === sessionGeneration &&
      request.scopeGeneration === request.scope.generation &&
      request.laneGeneration === laneGenerations.get(request.asset.lane) &&
      activeByLane.get(request.asset.lane) === request
    )
  }

  function setMusicGain(gain: number): void {
    for (const lane of ['score', 'hold-bed'] as const) {
      const request = activeByLane.get(lane)
      if (request?.didStart === true) request.outputPlayback?.setGain(gain)
    }
  }

  function beginDialogueDuck(request: ActiveRequest): void {
    if (
      request.asset.lane !== 'dialogue' ||
      dialogueOwnerRequestId !== request.requestId ||
      !isCurrent(request)
    ) {
      return
    }
    if (!dialogueDuckActive) {
      dialogueDuckActive = true
      setMusicGain(duckGain)
    }
  }

  function restoreDialogueDuck(requestId: number): void {
    if (dialogueOwnerRequestId !== requestId) return
    dialogueOwnerRequestId = undefined
    if (!dialogueDuckActive) return
    dialogueDuckActive = false
    setMusicGain(1)
  }

  function removeCurrent(request: ActiveRequest): void {
    if (activeByLane.get(request.asset.lane) === request) {
      activeByLane.delete(request.asset.lane)
    }
  }

  function stopRequest(
    request: ActiveRequest,
    reason: AudioSessionStopReason,
  ): boolean {
    if (request.finished.settled()) return false

    if (activeByLane.get(request.asset.lane) === request) {
      activeByLane.delete(request.asset.lane)
      nextLaneGeneration(request.asset.lane)
    }
    request.outputPlayback?.stop()
    if (!request.didStart) {
      request.started.resolve({ kind: 'silent', reason: 'cancelled' })
    }
    request.finished.resolve({ kind: 'stopped', reason })
    if (request.asset.lane === 'dialogue') {
      restoreDialogueDuck(request.requestId)
    }
    return true
  }

  function stopMatching(
    predicate: (request: ActiveRequest) => boolean,
    reason: AudioSessionStopReason,
  ): void {
    for (const request of [...activeByLane.values()]) {
      if (predicate(request)) stopRequest(request, reason)
    }
  }

  function failCurrent(
    request: ActiveRequest,
    reason: AudioSessionSilentReason,
  ): void {
    if (!isCurrent(request)) return
    removeCurrent(request)
    request.started.resolve({ kind: 'silent', reason })
    request.finished.resolve({ kind: 'silent', reason })
    if (request.asset.lane === 'dialogue') {
      restoreDialogueDuck(request.requestId)
    }
  }

  function finishCurrent(
    request: ActiveRequest,
    result: AudioOutputFinishResult,
  ): void {
    if (!isCurrent(request) || request.finished.settled()) return
    removeCurrent(request)
    if (result === 'ended') {
      request.finished.resolve({ kind: 'ended' })
    } else if (result === 'failed') {
      request.finished.resolve({ kind: 'failed' })
    } else {
      request.finished.resolve({ kind: 'stopped', reason: 'user' })
    }
    if (request.asset.lane === 'dialogue') {
      restoreDialogueDuck(request.requestId)
    }
  }

  function supportedSources(asset: AudioAsset): readonly AudioSourceVariant[] {
    if (output === undefined) return []
    return asset.sources.filter((source) => {
      try {
        return output.supportsMimeType(source.mimeType)
      } catch {
        return false
      }
    })
  }

  function startRequest(request: ActiveRequest): void {
    const sources = supportedSources(request.asset)
    if (sources.length === 0) {
      failCurrent(request, 'unsupported')
      return
    }

    void (async () => {
      for (const source of sources) {
        if (!isCurrent(request)) return

        let playback: AudioOutputPlayback
        try {
          playback = output!.play({
            source,
            playback: request.asset.playback,
            initialGain:
              dialogueDuckActive &&
              (request.asset.lane === 'score' ||
                request.asset.lane === 'hold-bed')
                ? duckGain
                : 1,
          })
        } catch {
          continue
        }
        request.outputPlayback = playback
        void playback.finished.catch(() => undefined)

        let startResult: AudioOutputStartResult
        try {
          startResult = await playback.started
        } catch {
          startResult = 'failed'
        }

        if (!isCurrent(request)) {
          playback.stop()
          return
        }
        if (startResult !== 'started') {
          playback.stop()
          if (startResult === 'stopped') {
            failCurrent(request, 'cancelled')
            return
          }
          request.outputPlayback = undefined
          continue
        }

        request.didStart = true
        request.started.resolve({ kind: 'started' })
        beginDialogueDuck(request)
        void playback.finished
          .then((result) => finishCurrent(request, result))
          .catch(() => finishCurrent(request, 'failed'))
        return
      }

      failCurrent(request, 'load-failed')
    })()
  }

  function play(scope: ScopeState, assetId: string): AudioSessionCue {
    const requestId = (nextRequestId += 1)
    const asset = findAudioAsset(options.manifest, assetId)
    if (asset === undefined) {
      return resolvedCue(requestId, assetId, 'asset-missing')
    }
    if (disposed) {
      return resolvedCue(requestId, assetId, 'session-disposed', asset.lane)
    }
    if (scope.disposed) {
      return resolvedCue(requestId, assetId, 'scope-disposed', asset.lane)
    }
    if (muted) return resolvedCue(requestId, assetId, 'muted', asset.lane)
    if (!foreground) {
      return resolvedCue(requestId, assetId, 'backgrounded', asset.lane)
    }
    if (output === undefined) {
      return resolvedCue(requestId, assetId, 'output-unavailable', asset.lane)
    }

    if (asset.lane === 'dialogue') dialogueOwnerRequestId = requestId
    const previous = activeByLane.get(asset.lane)
    if (previous !== undefined) stopRequest(previous, 'replaced')
    const laneGeneration = nextLaneGeneration(asset.lane)
    const started = deferred<AudioSessionStartResult>()
    const finished = deferred<AudioSessionFinishResult>()
    const request: ActiveRequest = {
      requestId,
      asset,
      scope,
      sessionGeneration,
      scopeGeneration: scope.generation,
      laneGeneration,
      started,
      finished,
      didStart: false,
    }
    activeByLane.set(asset.lane, request)

    startRequest(request)

    return {
      requestId,
      assetId,
      lane: asset.lane,
      started: started.promise,
      finished: finished.promise,
      stop: (reason = 'user') => stopRequest(request, reason),
    }
  }

  function stopSession(reason: AudioSessionStopReason): void {
    sessionGeneration += 1
    dialogueOwnerRequestId = undefined
    dialogueDuckActive = false
    stopMatching(() => true, reason)
  }

  return {
    createScope(owner) {
      const scope: ScopeState = {
        id: (nextScopeId += 1),
        owner,
        generation: 0,
        disposed: false,
      }
      scopes.set(scope.id, scope)
      return {
        owner,
        play: (assetId) => play(scope, assetId),
        stopLane(lane, reason = 'lane-stopped') {
          const request = activeByLane.get(lane)
          if (request?.scope === scope) stopRequest(request, reason)
        },
        stopAll(reason = 'scope-stopped') {
          if (scope.disposed) return
          scope.generation += 1
          stopMatching((request) => request.scope === scope, reason)
        },
        dispose() {
          if (scope.disposed) return
          scope.disposed = true
          scope.generation += 1
          stopMatching((request) => request.scope === scope, 'scope-disposed')
          scopes.delete(scope.id)
        },
      }
    },

    async unlock() {
      if (disposed || muted || !foreground || output === undefined) return false
      const expectedGeneration = sessionGeneration
      try {
        const ready = await output.unlock()
        return (
          ready &&
          !disposed &&
          !muted &&
          foreground &&
          expectedGeneration === sessionGeneration
        )
      } catch {
        return false
      }
    },

    setMuted(nextMuted) {
      if (muted === nextMuted) return
      muted = nextMuted
      if (muted) stopSession('muted')
    },

    setForeground(nextForeground) {
      if (foreground === nextForeground) return
      foreground = nextForeground
      if (!foreground) stopSession('backgrounded')
    },

    dispose() {
      if (disposed) return
      stopSession('session-disposed')
      disposed = true
      for (const scope of scopes.values()) scope.disposed = true
      scopes.clear()
      output?.dispose()
    },
  }
}
