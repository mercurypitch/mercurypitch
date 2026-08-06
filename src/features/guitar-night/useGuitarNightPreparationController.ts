// ============================================================
// Guitar Night preparation controller owns one cancellable, stale-safe local song run
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import { audioUploadValidationError, LOCAL_MAX_UPLOAD_BYTES, } from '@/lib/audio-upload-contract'
import type { GuitarNightPreparationPhase, GuitarNightPreparationPort, } from './preparation-port'

export type GuitarNightPreparationState =
  | { kind: 'idle' }
  | {
      kind: 'preparing'
      file: File
      phase: GuitarNightPreparationPhase | 'opening-separator' | 'opening-song'
      progress: number | null
      warning: string | null
    }
  | { kind: 'cancelled'; file: File }
  | {
      kind: 'error'
      file: File
      title: string
      message: string
      retryable: boolean
    }

interface GuitarNightPreparationControllerOptions {
  loadPreparationPort?: () => Promise<GuitarNightPreparationPort>
  onPrepared?: (sessionId: string, signal: AbortSignal) => void | Promise<void>
}

export async function loadDefaultGuitarNightPreparationPort(): Promise<GuitarNightPreparationPort> {
  const module = await import('./uvr-preparation-port')
  return module.createUvrGuitarNightPreparationPort()
}

export function guitarNightPreparationMessage(
  state: Extract<GuitarNightPreparationState, { kind: 'preparing' }>,
): string {
  if (state.phase === 'opening-separator') return 'Opening the separator…'
  if (state.phase === 'checking-library') {
    return 'Checking your local library…'
  }
  if (state.phase === 'saving-original') {
    return 'Keeping a local retry copy…'
  }
  if (state.phase === 'preparing') return 'Preparing the separator…'
  if (state.phase === 'separating') {
    return state.progress === null
      ? 'Separating vocals and accompaniment…'
      : `Separating vocals and accompaniment · ${Math.round(state.progress)}%`
  }
  if (state.phase === 'finalizing') return 'Saving stems on this device…'
  return 'Opening the prepared stems…'
}

export function useGuitarNightPreparationController(
  options: GuitarNightPreparationControllerOptions = {},
) {
  const [state, setState] = createSignal<GuitarNightPreparationState>({
    kind: 'idle',
  })

  let disposed = false
  let generation = 0
  let activeAbort: AbortController | null = null
  let portPromise: Promise<GuitarNightPreparationPort> | null = null

  const ensurePort = (): Promise<GuitarNightPreparationPort> => {
    if (portPromise === null) {
      const load =
        options.loadPreparationPort ?? loadDefaultGuitarNightPreparationPort
      portPromise = Promise.resolve()
        .then(load)
        .catch((error) => {
          portPromise = null
          throw error
        })
    }
    return portPromise
  }

  const execute = async (
    file: File,
    currentGeneration: number,
    abort: AbortController,
  ): Promise<void> => {
    let latestWarning: string | null = null
    let latestPhase: GuitarNightPreparationPhase = 'preparing'
    let latestProgress: number | null = null
    try {
      const port = await ensurePort()
      if (
        disposed ||
        currentGeneration !== generation ||
        abort.signal.aborted
      ) {
        return
      }

      const result = await port.prepare(file, {
        signal: abort.signal,
        onUpdate: (update) => {
          latestPhase = update.phase
          latestProgress = update.progress
          if (
            disposed ||
            currentGeneration !== generation ||
            abort.signal.aborted
          ) {
            return
          }
          setState({
            kind: 'preparing',
            file,
            phase: update.phase,
            progress: update.progress,
            warning: latestWarning,
          })
        },
        onWarning: (message) => {
          latestWarning = message
          if (
            disposed ||
            currentGeneration !== generation ||
            abort.signal.aborted
          ) {
            return
          }
          setState({
            kind: 'preparing',
            file,
            phase: latestPhase,
            progress: latestProgress,
            warning: latestWarning,
          })
        },
      })

      if (
        disposed ||
        currentGeneration !== generation ||
        abort.signal.aborted
      ) {
        return
      }
      if (result.status === 'cancelled') {
        activeAbort = null
        setState({ kind: 'cancelled', file })
        return
      }
      if (result.status === 'error') {
        activeAbort = null
        setState({
          kind: 'error',
          file,
          title: 'Couldn’t prepare this song',
          message: result.message,
          retryable: true,
        })
        return
      }
      if (result.status === 'in-flight') {
        activeAbort = null
        setState({
          kind: 'error',
          file,
          title: 'Song preparation already in progress',
          message:
            'This song is already being prepared. Try again in a moment to open it when it is ready.',
          retryable: true,
        })
        return
      }

      setState({
        kind: 'preparing',
        file,
        phase: 'opening-song',
        progress: 100,
        warning: latestWarning,
      })
      try {
        await options.onPrepared?.(result.sessionId, abort.signal)
      } catch {
        if (disposed || currentGeneration !== generation) return
        activeAbort = null
        setState({
          kind: 'error',
          file,
          title: 'Song saved on this device',
          message:
            'The stems were saved, but this room could not open them. Try the song in Prepared songs.',
          retryable: true,
        })
        return
      }
      if (disposed || currentGeneration !== generation) return
      activeAbort = null
      setState({ kind: 'idle' })
    } catch {
      if (
        disposed ||
        currentGeneration !== generation ||
        abort.signal.aborted
      ) {
        return
      }
      activeAbort = null
      setState({
        kind: 'error',
        file,
        title: 'Couldn’t open the separator',
        message:
          'The on-device separator could not be opened. Reload and try again.',
        retryable: true,
      })
    }
  }

  const start = (file: File): boolean => {
    const validationError = audioUploadValidationError(
      file,
      LOCAL_MAX_UPLOAD_BYTES,
      undefined,
      'on-device',
    )
    if (validationError !== null) {
      generation += 1
      activeAbort?.abort()
      activeAbort = null
      setState({
        kind: 'error',
        file,
        title: 'Choose another audio file',
        message: validationError,
        retryable: false,
      })
      return false
    }

    generation += 1
    const currentGeneration = generation
    activeAbort?.abort()
    const abort = new AbortController()
    activeAbort = abort
    setState({
      kind: 'preparing',
      file,
      phase: 'opening-separator',
      progress: null,
      warning: null,
    })
    void execute(file, currentGeneration, abort)
    return true
  }

  const cancel = (): void => {
    const current = state()
    if (current.kind !== 'preparing') return
    generation += 1
    activeAbort?.abort()
    activeAbort = null
    setState({ kind: 'cancelled', file: current.file })
  }

  const retry = (): void => {
    const current = state()
    if (
      current.kind !== 'cancelled' &&
      !(current.kind === 'error' && current.retryable)
    ) {
      return
    }
    start(current.file)
  }

  const clear = (): void => {
    generation += 1
    activeAbort?.abort()
    activeAbort = null
    setState({ kind: 'idle' })
  }

  const selectedFile = (): File | null => {
    const current = state()
    return current.kind === 'idle' ? null : current.file
  }

  const isPreparing = (): boolean => state().kind === 'preparing'

  onCleanup(() => {
    disposed = true
    generation += 1
    activeAbort?.abort()
    activeAbort = null
  })

  return {
    state,
    selectedFile,
    isPreparing,
    start,
    cancel,
    retry,
    clear,
  }
}
