// The reference controller owns the score axis: attach, track choice, and URL state.
// ============================================================

import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { GuitarNightReference, GuitarNightReferencePort, GuitarNightReferenceSummary, } from './reference-port'
import { readGuitarNightScore, withGuitarNightScore } from './session-link'

export type GuitarNightReferenceLibraryState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

export type GuitarNightReferenceState =
  | { kind: 'idle' }
  | { kind: 'ready'; reference: GuitarNightReference }
  | {
      kind: 'unavailable'
      songId: string
      reason: 'not-found' | 'no-playable-notes' | 'library-error'
    }

type HistoryMode = 'push' | 'replace' | 'none'

interface GuitarNightReferenceControllerOptions {
  loadReferencePort?: () => Promise<GuitarNightReferencePort>
}

export async function loadDefaultGuitarNightReferencePort(): Promise<GuitarNightReferencePort> {
  const module = await import('./saved-score-reference-port')
  return module.createSavedScoreGuitarNightReferencePort()
}

function writeScoreToHistory(
  songId: string | null,
  mode: Exclude<HistoryMode, 'none'>,
): void {
  const href = withGuitarNightScore(window.location.href, songId)
  if (mode === 'replace') window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
}

export function useGuitarNightReferenceController(
  options: GuitarNightReferenceControllerOptions = {},
) {
  const [port, setPort] = createSignal<GuitarNightReferencePort | null>(null)
  const [libraryState, setLibraryState] =
    createSignal<GuitarNightReferenceLibraryState>('idle')
  const [state, setState] = createSignal<GuitarNightReferenceState>({
    kind: 'idle',
  })
  const [importStatus, setImportStatus] = createSignal<string | null>(null)
  const [libraryVersion, setLibraryVersion] = createSignal(0)

  let disposed = false
  let attachGeneration = 0
  let portPromise: Promise<GuitarNightReferencePort> | null = null

  const references = createMemo<readonly GuitarNightReferenceSummary[]>(() => {
    libraryVersion()
    return port()?.listReferences() ?? []
  })

  const reference = createMemo(() => {
    const current = state()
    return current.kind === 'ready' ? current.reference : null
  })

  const ensurePort = async (): Promise<GuitarNightReferencePort | null> => {
    const current = port()
    if (current !== null) return current

    if (portPromise === null) {
      setLibraryState('loading')
      const load =
        options.loadReferencePort ?? loadDefaultGuitarNightReferencePort
      portPromise = Promise.resolve().then(load)
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

  const attach = async (
    songId: string,
    trackId?: string,
    historyMode: HistoryMode = 'push',
  ): Promise<void> => {
    const normalizedSongId = songId.trim()
    if (normalizedSongId === '') return
    const generation = ++attachGeneration

    const loadedPort = await ensurePort()
    if (disposed || generation !== attachGeneration) return
    if (loadedPort === null) {
      setState({
        kind: 'unavailable',
        songId: normalizedSongId,
        reason: 'library-error',
      })
      return
    }

    const result = loadedPort.openReference(normalizedSongId, trackId)
    if (disposed || generation !== attachGeneration) return

    if (result.ok) {
      // Remember the visible track so the same part returns next time, in
      // Guitar Night and in the legacy tab that shares this library.
      loadedPort.rememberTrack(normalizedSongId, result.reference.trackId)
      setState({ kind: 'ready', reference: result.reference })
    } else {
      setState({
        kind: 'unavailable',
        songId: normalizedSongId,
        reason: result.code,
      })
    }

    if (historyMode !== 'none') {
      writeScoreToHistory(normalizedSongId, historyMode)
    }
  }

  const selectTrack = async (trackId: string): Promise<void> => {
    const current = reference()
    if (current === null || current.trackId === trackId) return
    // Switching the visible part never re-routes: it is the same reference.
    await attach(current.songId, trackId, 'none')
  }

  const detach = (historyMode: HistoryMode = 'push'): void => {
    attachGeneration += 1
    const hadReference = state().kind !== 'idle'
    setState({ kind: 'idle' })
    if (historyMode !== 'none' && hadReference) {
      writeScoreToHistory(null, historyMode)
    }
  }

  const importFile = async (file: File): Promise<void> => {
    setImportStatus(null)
    const loadedPort = await ensurePort()
    if (disposed) return
    if (loadedPort === null) {
      setImportStatus('Your tab library could not be opened.')
      return
    }

    try {
      const summary = await loadedPort.importReference(file)
      if (disposed) return
      setLibraryVersion((version) => version + 1)
      setImportStatus(null)
      await attach(summary.songId, undefined, 'replace')
    } catch (caught) {
      if (disposed) return
      setImportStatus(
        caught instanceof Error
          ? caught.message
          : 'That file could not be read as a tab.',
      )
    }
  }

  onMount(() => {
    const initialSongId = readGuitarNightScore()
    if (initialSongId !== null) void attach(initialSongId, undefined, 'none')

    const handlePopState = () => {
      const nextSongId = readGuitarNightScore()
      if (nextSongId === null) {
        detach('none')
        return
      }
      void attach(nextSongId, undefined, 'none')
    }
    window.addEventListener('popstate', handlePopState)
    onCleanup(() => window.removeEventListener('popstate', handlePopState))
  })

  onCleanup(() => {
    disposed = true
    attachGeneration += 1
  })

  return {
    libraryState,
    state,
    reference,
    references,
    importStatus,
    initialize,
    attach,
    selectTrack,
    detach,
    importFile,
  }
}
