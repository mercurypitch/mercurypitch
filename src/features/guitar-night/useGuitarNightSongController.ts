// Guitar Night song controller owns lazy library loading, URL state, and backing leases.
// ============================================================

import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { readGuitarNightSession, withGuitarNightSession } from './session-link'
import type { GuitarNightBackingLease, GuitarNightSongPort } from './song-port'

export type GuitarNightLibraryState = 'idle' | 'loading' | 'ready' | 'error'

export type GuitarNightSelectionState =
  | { kind: 'idle' }
  | { kind: 'loading'; sessionId: string }
  | { kind: 'ready'; lease: GuitarNightBackingLease }
  | {
      kind: 'unavailable'
      sessionId: string
      reason:
        | 'not-found'
        | 'not-completed'
        | 'missing-local-audio'
        | 'library-error'
    }

interface GuitarNightSongControllerOptions {
  loadSongPort?: () => Promise<GuitarNightSongPort>
  onRouteSession?: (sessionId: string) => void
  onBackingWillRelease?: (lease: GuitarNightBackingLease) => void
}

type HistoryMode = 'push' | 'replace' | 'none'

export async function loadDefaultGuitarNightSongPort(): Promise<GuitarNightSongPort> {
  const module = await import('./uvr-song-port')
  return module.createUvrGuitarNightSongPort()
}

function writeSessionToHistory(
  sessionId: string | null,
  mode: Exclude<HistoryMode, 'none'>,
): void {
  const href = withGuitarNightSession(window.location.href, sessionId)
  if (mode === 'replace') window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
}

export function useGuitarNightSongController(
  options: GuitarNightSongControllerOptions = {},
) {
  const [port, setPort] = createSignal<GuitarNightSongPort | null>(null)
  const [libraryState, setLibraryState] =
    createSignal<GuitarNightLibraryState>('idle')
  const [selectionState, setSelectionState] =
    createSignal<GuitarNightSelectionState>({ kind: 'idle' })
  const [routeSessionId, setRouteSessionId] = createSignal<string | null>(
    readGuitarNightSession(),
  )
  const [catalogVersion, setCatalogVersion] = createSignal(0)

  let disposed = false
  let requestGeneration = 0
  let catalogRequestGeneration = 0
  let activeAbort: AbortController | null = null
  let activeLease: GuitarNightBackingLease | null = null
  let portPromise: Promise<GuitarNightSongPort> | null = null

  const songs = createMemo(() => {
    catalogVersion()
    return port()?.completedSongs() ?? []
  })

  const releaseSelection = (): void => {
    requestGeneration += 1
    activeAbort?.abort()
    activeAbort = null
    if (activeLease !== null) options.onBackingWillRelease?.(activeLease)
    activeLease?.release()
    activeLease = null
  }

  const ensurePort = async (): Promise<GuitarNightSongPort | null> => {
    const current = port()
    if (current !== null) return current

    if (portPromise === null) {
      setLibraryState('loading')
      const load = options.loadSongPort ?? loadDefaultGuitarNightSongPort
      portPromise = Promise.resolve()
        .then(load)
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
    historyMode: HistoryMode = 'push',
    stageOptions: { force?: boolean } = {},
  ): Promise<void> => {
    const normalizedSessionId = sessionId.trim()
    if (normalizedSessionId === '') return
    const alreadyRouted = routeSessionId() === normalizedSessionId
    const currentSelection = selectionState()
    // force bypasses the same-session no-op guard for callers that changed
    // what the session contains (the full-band upgrade restages the same id
    // to swap the two-stem lease for the freshly saved parts).
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
      // Re-staging the already routed session must not grow history — Back
      // should still leave the song in one press.
      writeSessionToHistory(
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
    })
  }

  const clearSession = (historyMode: HistoryMode = 'push'): void => {
    const hadRouteSession = routeSessionId() !== null
    releaseSelection()
    setRouteSessionId(null)
    setSelectionState({ kind: 'idle' })
    if (historyMode !== 'none' && hadRouteSession) {
      writeSessionToHistory(null, historyMode)
    }
  }

  const retry = (): void => {
    const currentSessionId = routeSessionId()
    // A loaded port can still sit in a failed library state (a transient
    // refresh failure) — initialize() would short-circuit on the loaded
    // port, so recover the list with a real refresh instead.
    if (port() !== null) void refreshLibrary()
    else if (currentSessionId === null) initialize()
    if (currentSessionId !== null) void stageSession(currentSessionId, 'none')
  }

  onMount(() => {
    const initialSessionId = routeSessionId()
    if (initialSessionId !== null) {
      options.onRouteSession?.(initialSessionId)
      void stageSession(initialSessionId, 'none')
    }

    const handlePopState = () => {
      const nextSessionId = readGuitarNightSession()
      if (nextSessionId === null) {
        clearSession('none')
        return
      }
      options.onRouteSession?.(nextSessionId)
      void stageSession(nextSessionId, 'none')
    }
    window.addEventListener('popstate', handlePopState)
    onCleanup(() => window.removeEventListener('popstate', handlePopState))
  })

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
