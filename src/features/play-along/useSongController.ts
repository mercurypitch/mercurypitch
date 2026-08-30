// Shared song selection controller owns lazy catalogs, stale-safe staging, and leases.
// ============================================================

import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { PlayAlongBackingLease, PlayAlongReleasableBacking, PlayAlongSongCatalogPort, PlayAlongTargetStemKind, } from './song-port'

export type PlayAlongLibraryState = 'idle' | 'loading' | 'ready' | 'error'

export type PlayAlongSelectionState<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
  TBacking extends PlayAlongReleasableBacking = PlayAlongBackingLease<TTarget>,
> =
  | { kind: 'idle' }
  | { kind: 'loading'; sessionId: string }
  | { kind: 'ready'; lease: TBacking }
  | {
      kind: 'unavailable'
      sessionId: string
      reason:
        | 'not-found'
        | 'not-completed'
        | 'missing-local-audio'
        | 'encoded-budget'
        | 'library-error'
      /** Present only for `encoded-budget`, so a room can name the size. */
      requiredBytes?: number
      budgetBytes?: number
    }

export type PlayAlongSessionHistoryMode = 'push' | 'replace' | 'none'

export interface PlayAlongSongControllerOptions<
  TTarget extends PlayAlongTargetStemKind,
  TBacking extends PlayAlongReleasableBacking = PlayAlongBackingLease<TTarget>,
> {
  loadSongPort: () => Promise<PlayAlongSongCatalogPort<TBacking>>
  initialSessionId?: string | null
  writeSession?: (
    sessionId: string | null,
    mode: Exclude<PlayAlongSessionHistoryMode, 'none'>,
  ) => void
  onBackingWillRelease?: (lease: TBacking) => void
}

export function usePlayAlongSongController<
  TTarget extends PlayAlongTargetStemKind,
  TBacking extends PlayAlongReleasableBacking = PlayAlongBackingLease<TTarget>,
>(options: PlayAlongSongControllerOptions<TTarget, TBacking>) {
  const [port, setPort] =
    createSignal<PlayAlongSongCatalogPort<TBacking> | null>(null)
  const [libraryState, setLibraryState] =
    createSignal<PlayAlongLibraryState>('idle')
  const [selectionState, setSelectionState] = createSignal<
    PlayAlongSelectionState<TTarget, TBacking>
  >({ kind: 'idle' })
  const [routeSessionId, setRouteSessionId] = createSignal<string | null>(
    options.initialSessionId ?? null,
  )
  const [catalogVersion, setCatalogVersion] = createSignal(0)

  let disposed = false
  let requestGeneration = 0
  let catalogRequestGeneration = 0
  let activeAbort: AbortController | null = null
  let activeLease: TBacking | null = null
  let portPromise: Promise<PlayAlongSongCatalogPort<TBacking>> | null = null

  const songs = createMemo(() => {
    catalogVersion()
    return port()?.completedSongs() ?? []
  })

  const releaseSelection = (): void => {
    requestGeneration += 1
    activeAbort?.abort()
    activeAbort = null
    const lease = activeLease
    activeLease = null
    if (lease === null) return
    try {
      options.onBackingWillRelease?.(lease)
    } catch {
      // The selected-song authority is already detached. Continue releasing
      // its owned URLs even when an audio consumer fails to stand down.
    }
    try {
      lease.release()
    } catch {
      // A best-effort resource cleanup cannot leave route selection stale.
    }
  }

  const ensurePort =
    async (): Promise<PlayAlongSongCatalogPort<TBacking> | null> => {
      const current = port()
      if (current !== null) return current

      if (portPromise === null) {
        setLibraryState('loading')
        portPromise = Promise.resolve()
          .then(options.loadSongPort)
          .then(async (loaded) => {
            await loaded.initialize()
            return loaded
          })
      }

      try {
        const loaded = await portPromise
        if (disposed) return null
        setPort(loaded)
        setLibraryState('ready')
        return loaded
      } catch {
        portPromise = null
        if (!disposed) setLibraryState('error')
        return null
      }
    }

  const initialize = (): void => {
    void ensurePort()
  }

  const refreshLibrary = async (): Promise<boolean> => {
    const generation = ++catalogRequestGeneration
    const loadedPort = await ensurePort()
    if (
      loadedPort === null ||
      disposed ||
      generation !== catalogRequestGeneration
    ) {
      return false
    }
    try {
      await loadedPort.initialize()
    } catch {
      if (!disposed && generation === catalogRequestGeneration) {
        setLibraryState('error')
      }
      return false
    }
    if (disposed || generation !== catalogRequestGeneration) return false
    setCatalogVersion((version) => version + 1)
    setLibraryState('ready')
    return true
  }

  const stageSession = async (
    sessionId: string,
    historyMode: PlayAlongSessionHistoryMode = 'push',
    stageOptions: { force?: boolean } = {},
  ): Promise<void> => {
    const normalizedSessionId = sessionId.trim()
    if (normalizedSessionId === '') return
    const alreadyRouted = routeSessionId() === normalizedSessionId
    const currentSelection = selectionState()
    if (
      stageOptions.force !== true &&
      alreadyRouted &&
      (currentSelection.kind === 'loading' || currentSelection.kind === 'ready')
    ) {
      return
    }

    releaseSelection()
    const generation = requestGeneration
    const abort = new AbortController()
    activeAbort = abort
    setRouteSessionId(normalizedSessionId)
    setSelectionState({ kind: 'loading', sessionId: normalizedSessionId })
    if (historyMode !== 'none') {
      options.writeSession?.(
        normalizedSessionId,
        historyMode === 'push' && alreadyRouted ? 'replace' : historyMode,
      )
    }

    const loadedPort = await ensurePort()
    if (disposed || generation !== requestGeneration || abort.signal.aborted) {
      return
    }
    if (loadedPort === null) {
      setSelectionState({
        kind: 'unavailable',
        sessionId: normalizedSessionId,
        reason: 'library-error',
      })
      return
    }

    let result
    try {
      result = await loadedPort.openSession(normalizedSessionId, abort.signal)
    } catch {
      if (
        disposed ||
        generation !== requestGeneration ||
        abort.signal.aborted
      ) {
        return
      }
      setSelectionState({
        kind: 'unavailable',
        sessionId: normalizedSessionId,
        reason: 'library-error',
      })
      return
    }

    if (disposed || generation !== requestGeneration || abort.signal.aborted) {
      if (result.ok) result.lease.release()
      return
    }

    activeAbort = null
    if (result.ok) {
      activeLease = result.lease
      setSelectionState({ kind: 'ready', lease: result.lease })
      return
    }
    if (result.code === 'aborted') return
    setSelectionState({
      kind: 'unavailable',
      sessionId: normalizedSessionId,
      reason: result.code,
      ...(result.code === 'encoded-budget'
        ? {
            requiredBytes: result.requiredBytes,
            budgetBytes: result.budgetBytes,
          }
        : {}),
    })
  }

  const clearSession = (
    historyMode: PlayAlongSessionHistoryMode = 'push',
  ): void => {
    const hadRouteSession = routeSessionId() !== null
    releaseSelection()
    setRouteSessionId(null)
    setSelectionState({ kind: 'idle' })
    if (historyMode !== 'none' && hadRouteSession) {
      options.writeSession?.(null, historyMode)
    }
  }

  const retry = (): void => {
    const currentSessionId = routeSessionId()
    if (port() !== null) void refreshLibrary()
    else if (currentSessionId === null) initialize()
    if (currentSessionId !== null) void stageSession(currentSessionId, 'none')
  }

  onCleanup(() => {
    disposed = true
    catalogRequestGeneration += 1
    releaseSelection()
  })

  return {
    libraryState,
    selectionState,
    routeSessionId,
    songs,
    initialize,
    refreshLibrary,
    stageSession,
    clearSession,
    retry,
  }
}
