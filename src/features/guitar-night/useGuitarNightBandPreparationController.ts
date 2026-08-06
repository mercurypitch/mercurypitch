// Guitar Night band controller owns one cancellable, stale-safe guitar-removal pass.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import type { GuitarNightBandPreparationPhase, GuitarNightBandPreparationPort, } from './band-preparation-port'

export type GuitarNightBandPreparationState =
  | { kind: 'idle' }
  | {
      kind: 'preparing'
      sessionId: string
      phase: GuitarNightBandPreparationPhase
      progress: number | null
      detail: string | null
    }
  | {
      kind: 'error'
      sessionId: string
      message: string
    }

interface GuitarNightBandPreparationControllerOptions {
  loadPort?: () => Promise<GuitarNightBandPreparationPort>
  onPrepared?: (sessionId: string, signal: AbortSignal) => void | Promise<void>
}

export async function loadDefaultGuitarNightBandPreparationPort(): Promise<GuitarNightBandPreparationPort> {
  const module = await import('./uvr-band-preparation-port')
  return module.createUvrGuitarNightBandPreparationPort()
}

export function guitarNightBandPreparationMessage(
  state: Extract<GuitarNightBandPreparationState, { kind: 'preparing' }>,
): string {
  if (state.phase === 'opening') return 'Opening full-band separation…'
  if (state.phase === 'uploading') {
    return `Sending the instrumental · ${Math.round(state.progress ?? 0)}%`
  }
  if (state.phase === 'processing') {
    return `Separating drums, bass, and guitar · ${Math.round(state.progress ?? 0)}%`
  }
  if (state.phase === 'saving') {
    return (
      state.detail ?? `Saving band parts · ${Math.round(state.progress ?? 0)}%`
    )
  }
  return 'Opening the guitar-free band…'
}

export function useGuitarNightBandPreparationController(
  options: GuitarNightBandPreparationControllerOptions = {},
) {
  const [state, setState] = createSignal<GuitarNightBandPreparationState>({
    kind: 'idle',
  })
  let generation = 0
  let disposed = false
  let activeAbort: AbortController | null = null
  let portPromise: Promise<GuitarNightBandPreparationPort> | null = null

  const ensurePort = (): Promise<GuitarNightBandPreparationPort> => {
    if (portPromise === null) {
      const load = options.loadPort ?? loadDefaultGuitarNightBandPreparationPort
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
    sessionId: string,
    currentGeneration: number,
    abort: AbortController,
  ): Promise<void> => {
    try {
      const port = await ensurePort()
      if (
        disposed ||
        abort.signal.aborted ||
        currentGeneration !== generation
      ) {
        return
      }
      await port.prepareBand(sessionId, {
        signal: abort.signal,
        onUpdate: (update) => {
          if (
            disposed ||
            abort.signal.aborted ||
            currentGeneration !== generation
          ) {
            return
          }
          setState({
            kind: 'preparing',
            sessionId,
            phase: update.phase,
            progress: update.progress,
            detail: update.detail ?? null,
          })
        },
      })
      if (
        disposed ||
        abort.signal.aborted ||
        currentGeneration !== generation
      ) {
        return
      }
      setState({
        kind: 'preparing',
        sessionId,
        phase: 'opening-song',
        progress: 100,
        detail: null,
      })
      await options.onPrepared?.(sessionId, abort.signal)
      if (
        disposed ||
        abort.signal.aborted ||
        currentGeneration !== generation
      ) {
        return
      }
      activeAbort = null
      setState({ kind: 'idle' })
    } catch (error) {
      if (
        disposed ||
        abort.signal.aborted ||
        currentGeneration !== generation
      ) {
        return
      }
      activeAbort = null
      setState({
        kind: 'error',
        sessionId,
        message:
          error instanceof Error && error.message.trim() !== ''
            ? error.message
            : 'The band could not be separated. Your two-stem mix is still ready.',
      })
    }
  }

  const start = (sessionId: string): void => {
    generation += 1
    const currentGeneration = generation
    activeAbort?.abort()
    const abort = new AbortController()
    activeAbort = abort
    setState({
      kind: 'preparing',
      sessionId,
      phase: 'opening',
      progress: null,
      detail: null,
    })
    void execute(sessionId, currentGeneration, abort)
  }

  const cancel = (): void => {
    generation += 1
    activeAbort?.abort()
    activeAbort = null
    setState({ kind: 'idle' })
  }

  const clear = (): void => {
    cancel()
  }

  onCleanup(() => {
    disposed = true
    generation += 1
    activeAbort?.abort()
    activeAbort = null
  })

  return {
    state,
    isPreparing: () => state().kind === 'preparing',
    start,
    cancel,
    clear,
  }
}
