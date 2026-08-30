// ============================================================
// Drum stem play-along — UVR stems slaved to the Drum Night transport
// ============================================================
//
// The selected-song controller retains ownership of the real object-URL
// lease. This adapter borrows it, prepares a bounded Web Audio mix only after
// Play, and schedules that mix from Drum Night's existing transport windows.
// It never creates a transport, frame loop, AudioContext, or media element.

import type { PlayAlongBackingLease, PlayAlongBackingLoadResult, PlayAlongBackingSource, PlayAlongStemKind, } from '@/features/play-along/song-port'
import { defaultPlayAlongEncodedByteBudget } from '@/features/play-along/song-port'
import type { PlayAlongStemBus, PlayAlongStemFidelity, PlayAlongStemMixEngine, PlayAlongStemMixError, PlayAlongStemMixStatus, PlayAlongStemTrackState, } from '@/features/play-along/stem-mix-engine'
import { decodedAudioBudgetBytes } from '@/lib/audio-memory-budget'
import type { DrumAuthoredSchedulingWindow, DrumTransport, } from '../runtime/drum-transport'

/** Device-aware decoded-PCM ceiling; see `@/lib/audio-memory-budget`. */
export function defaultDrumStemMemoryBudgetBytes(): number {
  return decodedAudioBudgetBytes()
}
export const DEFAULT_DRUM_STEM_LOOKAHEAD_MS = 2_000
export const MAX_DRUM_STEM_LOOP_LEDGER = 256

const TIMELINE_EPSILON = 1e-7

export type DrumStemMixPreset = 'custom' | 'drum-focus' | 'full' | 'play-along'

export type DrumStemPlayAlongStatus =
  | 'idle'
  | 'configured'
  | 'loading'
  | 'ready'
  | 'queued'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'waiting-for-audio'
  | 'error'
  | 'disposed'

export interface DrumStemPlayAlongSnapshot {
  readonly status: DrumStemPlayAlongStatus
  readonly sourceId: string | null
  readonly title: string | null
  readonly mixKind: 'parts' | 'mixed-instrumental' | null
  readonly mixPreset: DrumStemMixPreset
  readonly hasIndependentDrums: boolean
  readonly durationSeconds: number
  readonly transportRevision: number
  readonly scheduledLoopCount: number
  readonly buses: Readonly<
    Record<
      PlayAlongStemBus,
      { readonly muted: boolean; readonly level: number }
    >
  >
  readonly tracks: readonly PlayAlongStemTrackState[]
  readonly engineStatus: PlayAlongStemMixStatus | null
  /**
   * Set when the mix only fitted this device's decode budget at a lower rate or
   * in mono. The room says so rather than pretending nothing changed.
   */
  readonly reducedFidelity: PlayAlongStemFidelity | null
  readonly error: PlayAlongStemMixError | null
}

export interface DrumStemPlayAlongOptions {
  readonly transport: DrumTransport
  readonly activeContext: () => AudioContext | null
  readonly activeOutput: () => AudioNode | null
  readonly performanceTimestampToContextTime: (
    timestampMs: number,
  ) => number | null
  readonly decodedMemoryBudgetBytes?: number
  readonly encodedByteBudgetBytes?: number
  readonly lookaheadMs?: number
  readonly createEngine?: () => Promise<PlayAlongStemMixEngine>
}

export interface DrumStemPlayAlongController {
  snapshot(): DrumStemPlayAlongSnapshot
  subscribe(listener: () => void): () => void
  /** Borrow a metadata-only source. Its real release remains with the caller. */
  configure(source: PlayAlongBackingSource<'drums'> | null): void
  /** Explicit Play-owned fetch/decode boundary. */
  load(): Promise<boolean>
  applyPreset(preset: Exclude<DrumStemMixPreset, 'custom'>): boolean
  setBusMuted(bus: PlayAlongStemBus, muted: boolean): void
  setBusLevel(bus: PlayAlongStemBus, level: number): void
  setTrackMuted(id: string, muted: boolean): void
  setTrackLevel(id: string, level: number): void
  dispose(): void
}

interface DesiredTrack {
  readonly id: string
  readonly kind: PlayAlongStemKind
  readonly label: string
  readonly bus: PlayAlongStemBus
  readonly url?: string
  readonly sizeBytes?: number
  readonly durationSeconds?: number
  muted: boolean
  level: number
}

interface BusMixState {
  muted: boolean
  level: number
}

function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function boundedLookahead(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DRUM_STEM_LOOKAHEAD_MS
  return Math.min(2_000, Math.max(0, value as number))
}

function stemLabel(kind: PlayAlongStemKind, separated = false): string {
  switch (kind) {
    case 'vocal':
      return 'Vocals'
    case 'instrumental':
      return separated ? 'Backing (drums removed)' : 'Backing (drums included)'
    case 'drums':
      return 'Drums'
    case 'bass':
      return 'Bass'
    case 'guitar':
      return 'Guitar'
    case 'piano':
      return 'Piano'
    case 'other':
      return 'Other instruments'
  }
}

function engineStatus(
  status: PlayAlongStemMixStatus | null,
  transportPhase: ReturnType<DrumTransport['state']>['phase'],
  queued: boolean,
): DrumStemPlayAlongStatus {
  if (status === null || status === 'idle') return 'idle'
  if (status === 'disposed') return 'disposed'
  if (status === 'error') return 'error'
  if (status === 'loading') return 'loading'
  if (queued && transportPhase === 'count-in') return 'queued'
  if (transportPhase === 'playing' && status === 'playing') return 'playing'
  if (transportPhase === 'paused') return 'paused'
  if (transportPhase === 'stopped' && status === 'stopped') return 'stopped'
  if (status === 'configured') return 'configured'
  return 'ready'
}

function authoredSourceSeconds(
  transport: DrumTransport,
  beat: number,
  speedScale: number,
): number {
  return Math.max(0, transport.secondsForBeat(beat) * speedScale)
}

function isLoopWrap(window: DrumAuthoredSchedulingWindow): boolean {
  return (
    window.endsAt === 'loop' &&
    window.loop !== null &&
    Math.abs(window.toPositionBeat - window.loop.endBeat) <= TIMELINE_EPSILON
  )
}

/**
 * Create the route bridge without importing the stem engine into first paint.
 * The default engine module is crossed only by explicit load().
 */
export function createDrumStemPlayAlongController(
  options: DrumStemPlayAlongOptions,
): DrumStemPlayAlongController {
  const listeners = new Set<() => void>()
  const lookaheadMs = boundedLookahead(options.lookaheadMs)
  const busMix: Record<PlayAlongStemBus, BusMixState> = {
    drums: { muted: false, level: 1 },
    backing: { muted: false, level: 1 },
  }
  const loopLedger = new Map<string, number>()
  let source: PlayAlongBackingSource<'drums'> | null = null
  let hydratedLease: PlayAlongBackingLease<'drums'> | null = null
  let desiredTracks: DesiredTrack[] = []
  let mixPreset: DrumStemMixPreset = 'full'
  let engine: PlayAlongStemMixEngine | null = null
  let engineLoaded = false
  let sourceLoading = false
  let loadAbort: AbortController | null = null
  let enginePromise: Promise<PlayAlongStemMixEngine> | null = null
  let unsubscribeEngine: (() => void) | null = null
  let configuredEngineSourceId: string | null = null
  let localError: PlayAlongStemMixError | null = null
  let currentTransportRevision = options.transport.scheduleRevision()
  let scheduledStartRevision: number | null = null
  let sourceGeneration = 0
  let disposed = false
  let lastSnapshotKey = ''

  const hasIndependentDrums = (): boolean =>
    desiredTracks.some((track) => track.bus === 'drums')

  const durationSeconds = (): number =>
    engine?.getDurationSeconds() ??
    source?.durationSeconds ??
    desiredTracks.reduce(
      (longest, track) =>
        Math.max(longest, Math.max(0, track.durationSeconds ?? 0)),
      0,
    )

  const trackSnapshot = (): readonly PlayAlongStemTrackState[] => {
    const loaded = engine?.getTrackStates()
    if (loaded !== undefined && loaded.length > 0) return loaded
    return Object.freeze(
      desiredTracks.map((track) =>
        Object.freeze({
          id: track.id,
          label: track.label,
          bus: track.bus,
          muted: track.muted,
          level: track.level,
          available: false,
        }),
      ),
    )
  }

  const snapshot = (): DrumStemPlayAlongSnapshot => {
    const activeEngineStatus = engine?.getStatus() ?? null
    const transport = options.transport.state()
    const queued =
      scheduledStartRevision === currentTransportRevision &&
      transport.phase === 'count-in'
    return Object.freeze({
      status:
        source === null
          ? disposed
            ? 'disposed'
            : 'idle'
          : localError !== null
            ? 'error'
            : sourceLoading
              ? 'loading'
              : engineStatus(
                  activeEngineStatus ?? 'configured',
                  transport.phase,
                  queued,
                ),
      sourceId: source?.sessionId ?? null,
      title: source?.title ?? null,
      mixKind:
        hydratedLease?.defaultMix.kind ?? source?.plannedMix.kind ?? null,
      mixPreset,
      hasIndependentDrums: hasIndependentDrums(),
      durationSeconds: durationSeconds(),
      transportRevision: currentTransportRevision,
      scheduledLoopCount: loopLedger.size,
      buses: Object.freeze({
        drums: Object.freeze({ ...busMix.drums }),
        backing: Object.freeze({ ...busMix.backing }),
      }),
      tracks: trackSnapshot(),
      engineStatus: activeEngineStatus,
      reducedFidelity: engine?.getReducedFidelity() ?? null,
      error: engine?.getError() ?? localError,
    })
  }

  const snapshotKey = (): string => JSON.stringify(snapshot())

  const emitIfChanged = (force = false): void => {
    const next = snapshotKey()
    if (!force && next === lastSnapshotKey) return
    lastSnapshotKey = next
    for (const listener of listeners) listener()
  }

  const currentContextTime = (): number | null => {
    try {
      const context = options.activeContext()
      return context !== null && context.state !== 'closed'
        ? context.currentTime
        : null
    } catch {
      return null
    }
  }

  const stopEngineNow = (kind: 'pause' | 'stop'): void => {
    const at = currentContextTime()
    if (engine === null || at === null) return
    if (kind === 'pause') engine.pause(at)
    else engine.stop(at)
  }

  const makeEngineLease = (selected: PlayAlongBackingLease<'drums'>) => {
    const separated = selected.defaultMix.kind === 'parts'
    const drumIndex = selected.stems.findIndex((stem) => stem.kind === 'drums')
    const drumId =
      drumIndex < 0
        ? null
        : (desiredTracks[drumIndex]?.id ??
          `${selected.sessionId}:drums:${drumIndex}`)
    return {
      id: selected.sessionId,
      stems: selected.stems.map((stem, index) => {
        const track = desiredTracks[index]
        const bus: PlayAlongStemBus =
          stem.kind === 'drums' ? 'drums' : 'backing'
        return {
          id: track?.id ?? `${selected.sessionId}:${stem.kind}:${index}`,
          label: track?.label ?? stemLabel(stem.kind, separated),
          bus,
          url: stem.url,
          sizeBytes: stem.sizeBytes,
          durationSeconds: stem.durationSeconds,
          muted: track?.muted ?? false,
          level: track?.level ?? 1,
          ...(separated && stem.kind === 'instrumental' && drumId !== null
            ? { subtractAssetId: drumId }
            : {}),
        }
      }),
      // The source controller owns the object URLs and calls configure(null)
      // before releasing them. The engine only owns this no-op adapter lease.
      release: () => undefined,
    }
  }

  const configureEngine = (): void => {
    if (engine === null) return
    if (hydratedLease === null) {
      engine.configure(null)
      configuredEngineSourceId = null
      return
    }
    engine.configure(makeEngineLease(hydratedLease))
    configuredEngineSourceId = hydratedLease.sessionId
    engine.setBusMuted('drums', busMix.drums.muted)
    engine.setBusLevel('drums', busMix.drums.level)
    engine.setBusMuted('backing', busMix.backing.muted)
    engine.setBusLevel('backing', busMix.backing.level)
  }

  const ensureEngine = async (): Promise<PlayAlongStemMixEngine | null> => {
    if (disposed) return null
    if (engine !== null) return engine
    if (enginePromise === null) {
      enginePromise = (
        options.createEngine?.() ??
        import('@/features/play-along/stem-mix-engine').then(
          ({ createPlayAlongStemMixEngine }) =>
            createPlayAlongStemMixEngine({
              getAudioContext: options.activeContext,
              getOutput: () => options.activeOutput(),
              decodedMemoryBudgetBytes:
                options.decodedMemoryBudgetBytes ??
                defaultDrumStemMemoryBudgetBytes(),
            }),
        )
      ).catch(() => {
        enginePromise = null
        throw new Error('The prepared-song audio engine could not load.')
      })
    }
    try {
      const created = await enginePromise
      if (disposed) {
        created.dispose()
        return null
      }
      engine = created
      unsubscribeEngine = created.subscribe(() => emitIfChanged())
      configureEngine()
      return created
    } catch {
      localError = {
        code: 'audio-unavailable',
        message: 'The prepared-song audio engine could not load.',
      }
      emitIfChanged()
      return null
    }
  }

  const mapContextTime = (timestampMs: number): number | null => {
    try {
      const mapped = options.performanceTimestampToContextTime(timestampMs)
      return mapped !== null && Number.isFinite(mapped) && mapped >= 0
        ? mapped
        : null
    } catch {
      return null
    }
  }

  const pruneLoopLedger = (
    windows: readonly DrumAuthoredSchedulingWindow[],
  ) => {
    const firstTimelineBeat = windows[0]?.fromTimelineBeat
    if (firstTimelineBeat === undefined) return
    for (const [key, timelineBeat] of loopLedger) {
      if (timelineBeat < firstTimelineBeat - TIMELINE_EPSILON) {
        loopLedger.delete(key)
      }
    }
  }

  const reconcile = (): void => {
    if (disposed || source === null || engine === null) return
    const transport = options.transport.state()
    const nextRevision = options.transport.scheduleRevision()
    if (nextRevision !== currentTransportRevision) {
      currentTransportRevision = nextRevision
      scheduledStartRevision = null
      loopLedger.clear()
      stopEngineNow(
        transport.phase === 'paused' || transport.phase === 'count-in'
          ? 'pause'
          : 'stop',
      )
    }

    if (transport.phase === 'paused') {
      stopEngineNow('pause')
      emitIfChanged()
      return
    }
    if (transport.phase === 'stopped') {
      stopEngineNow('stop')
      emitIfChanged()
      return
    }
    if (!engineLoaded) {
      emitIfChanged()
      return
    }

    const windows = options.transport.schedulingWindows(lookaheadMs)
    const first = windows[0]
    if (first === undefined) {
      emitIfChanged()
      return
    }
    pruneLoopLedger(windows)

    if (scheduledStartRevision !== currentTransportRevision) {
      const atContextTime = mapContextTime(first.fromTimestampMs)
      if (atContextTime === null) {
        emitIfChanged()
        return
      }
      const started = engine.start({
        atContextTime,
        sourceOffsetSeconds: authoredSourceSeconds(
          options.transport,
          first.fromPositionBeat,
          first.speedScale,
        ),
        playbackRate: first.speedScale,
      })
      if (!started) {
        emitIfChanged()
        return
      }
      scheduledStartRevision = currentTransportRevision
    }

    for (const window of windows) {
      if (!isLoopWrap(window) || window.loop === null) continue
      const key = `${currentTransportRevision}:${window.loopIteration}:${window.toTimelineBeat}`
      if (loopLedger.has(key)) continue
      if (loopLedger.size >= MAX_DRUM_STEM_LOOP_LEDGER) break
      const atContextTime = mapContextTime(window.toTimestampMs)
      if (atContextTime === null) break
      const scheduled = engine.seek({
        atContextTime,
        sourceOffsetSeconds: authoredSourceSeconds(
          options.transport,
          window.loop.startBeat,
          window.speedScale,
        ),
        playbackRate: window.speedScale,
      })
      if (!scheduled) break
      loopLedger.set(key, window.toTimelineBeat)
    }
    emitIfChanged()
  }

  const unsubscribeTransport = options.transport.subscribe(reconcile)
  lastSnapshotKey = snapshotKey()

  const updatePresetTruth = (): void => {
    if (!hasIndependentDrums()) {
      mixPreset = 'full'
      return
    }
    if (!busMix.drums.muted && !busMix.backing.muted) mixPreset = 'full'
    else if (!busMix.drums.muted && busMix.backing.muted) {
      mixPreset = 'drum-focus'
    } else if (busMix.drums.muted && !busMix.backing.muted) {
      mixPreset = 'play-along'
    } else mixPreset = 'custom'
  }

  return {
    snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    configure(nextSource) {
      if (disposed) return
      sourceGeneration += 1
      loadAbort?.abort()
      loadAbort = null
      scheduledStartRevision = null
      loopLedger.clear()
      stopEngineNow('stop')
      source = nextSource
      hydratedLease = null
      engineLoaded = false
      sourceLoading = false
      localError = null
      const mutedKinds = new Set<PlayAlongStemKind>(
        nextSource?.plannedMix.muted ?? [],
      )
      desiredTracks =
        nextSource?.stemKinds.map((kind, index) => {
          const bus: PlayAlongStemBus = kind === 'drums' ? 'drums' : 'backing'
          return {
            id: `${nextSource.sessionId}:${kind}:${index}`,
            kind,
            label: stemLabel(kind, nextSource.plannedMix.kind === 'parts'),
            bus,
            muted: mutedKinds.has(kind),
            level: 1,
          }
        }) ?? []
      busMix.drums = { muted: false, level: 1 }
      busMix.backing = { muted: false, level: 1 }
      mixPreset = 'full'
      configureEngine()
      currentTransportRevision = options.transport.scheduleRevision()
      emitIfChanged(true)
    },
    async load() {
      const selected = source
      if (disposed || selected === null) return false
      if (
        engineLoaded &&
        hydratedLease?.sessionId === selected.sessionId &&
        engine?.getStatus() !== 'error'
      ) {
        return true
      }
      localError = null
      const generation = sourceGeneration
      loadAbort?.abort()
      const currentLoadAbort = new AbortController()
      loadAbort = currentLoadAbort
      sourceLoading = true
      emitIfChanged(true)
      let loadResult: PlayAlongBackingLoadResult<'drums'>
      try {
        loadResult = await selected.load({
          signal: currentLoadAbort.signal,
          encodedByteBudget:
            options.encodedByteBudgetBytes ??
            defaultPlayAlongEncodedByteBudget(),
        })
      } catch {
        if (
          !disposed &&
          generation === sourceGeneration &&
          source === selected &&
          !currentLoadAbort.signal.aborted
        ) {
          localError = {
            code: 'fetch-failed',
            message: 'The prepared audio could not be read from this device.',
          }
        }
        sourceLoading = false
        if (loadAbort === currentLoadAbort) loadAbort = null
        emitIfChanged(true)
        return false
      }
      if (
        disposed ||
        generation !== sourceGeneration ||
        source !== selected ||
        currentLoadAbort.signal.aborted ||
        !loadResult.ok
      ) {
        if (
          !disposed &&
          generation === sourceGeneration &&
          source === selected &&
          !currentLoadAbort.signal.aborted &&
          !loadResult.ok &&
          loadResult.code !== 'aborted'
        ) {
          localError =
            loadResult.code === 'encoded-budget'
              ? {
                  code: 'encoded-budget',
                  message:
                    'This prepared song is too large to load safely in Drum Night.',
                  requiredBytes: loadResult.requiredBytes,
                  budgetBytes: loadResult.budgetBytes,
                }
              : {
                  code: 'fetch-failed',
                  message:
                    'The prepared audio is no longer available on this device.',
                }
        }
        sourceLoading = false
        if (loadAbort === currentLoadAbort) loadAbort = null
        emitIfChanged(true)
        return false
      }
      const selectedLease = loadResult.lease
      hydratedLease = selectedLease
      const mutedKinds = new Set<PlayAlongStemKind>(
        selectedLease.defaultMix.muted,
      )
      const unmatchedDesiredTracks = new Set(desiredTracks)
      desiredTracks = selectedLease.stems.map((stem, index) => {
        const id = `${selectedLease.sessionId}:${stem.kind}:${index}`
        const priorTrack =
          [...unmatchedDesiredTracks].find((track) => track.id === id) ??
          [...unmatchedDesiredTracks].find((track) => track.kind === stem.kind)
        if (priorTrack !== undefined) unmatchedDesiredTracks.delete(priorTrack)
        return {
          id,
          kind: stem.kind,
          label: stemLabel(
            stem.kind,
            selectedLease.defaultMix.kind === 'parts',
          ),
          bus: stem.kind === 'drums' ? 'drums' : 'backing',
          url: stem.url,
          sizeBytes: stem.sizeBytes,
          durationSeconds: stem.durationSeconds,
          muted: priorTrack?.muted ?? mutedKinds.has(stem.kind),
          level: priorTrack?.level ?? 1,
        }
      })
      sourceLoading = false
      if (loadAbort === currentLoadAbort) loadAbort = null
      const activeEngine = await ensureEngine()
      if (
        activeEngine === null ||
        disposed ||
        generation !== sourceGeneration ||
        source !== selected
      ) {
        return false
      }
      if (configuredEngineSourceId !== selected.sessionId) configureEngine()
      emitIfChanged()
      const loaded = await activeEngine.load()
      if (
        !loaded ||
        disposed ||
        generation !== sourceGeneration ||
        source !== selected
      ) {
        return false
      }
      engineLoaded = true
      emitIfChanged(true)
      reconcile()
      return true
    },
    applyPreset(nextPreset) {
      if (disposed || source === null) return false
      if (nextPreset !== 'full' && !hasIndependentDrums()) return false
      busMix.drums.muted = nextPreset === 'play-along'
      busMix.backing.muted = nextPreset === 'drum-focus'
      mixPreset = nextPreset
      engine?.setBusMuted('drums', busMix.drums.muted)
      engine?.setBusMuted('backing', busMix.backing.muted)
      emitIfChanged(true)
      return true
    },
    setBusMuted(bus, muted) {
      if (disposed) return
      busMix[bus].muted = muted
      engine?.setBusMuted(bus, muted)
      updatePresetTruth()
      emitIfChanged(true)
    },
    setBusLevel(bus, level) {
      if (disposed) return
      busMix[bus].level = clampLevel(level)
      engine?.setBusLevel(bus, busMix[bus].level)
      emitIfChanged(true)
    },
    setTrackMuted(id, muted) {
      if (disposed) return
      const track = desiredTracks.find((candidate) => candidate.id === id)
      if (track === undefined) return
      track.muted = muted
      engine?.setTrackMuted(id, muted)
      mixPreset = 'custom'
      emitIfChanged(true)
    },
    setTrackLevel(id, level) {
      if (disposed) return
      const track = desiredTracks.find((candidate) => candidate.id === id)
      if (track === undefined) return
      track.level = clampLevel(level)
      engine?.setTrackLevel(id, track.level)
      mixPreset = 'custom'
      emitIfChanged(true)
    },
    dispose() {
      if (disposed) return
      disposed = true
      sourceGeneration += 1
      loadAbort?.abort()
      loadAbort = null
      unsubscribeTransport()
      unsubscribeEngine?.()
      unsubscribeEngine = null
      stopEngineNow('stop')
      engine?.dispose()
      engine = null
      engineLoaded = false
      source = null
      hydratedLease = null
      desiredTracks = []
      loopLedger.clear()
      emitIfChanged(true)
      listeners.clear()
    },
  }
}
