// Shared band preparation controller owns preflight, cancellation, progress, and restaging.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { PlayAlongBandPreparationPhase, PlayAlongBandPreparationPort, } from './band-preparation-port'
import type { PlayAlongTargetPolicy, PlayAlongTargetStemKind, } from './song-port'

export type PlayAlongBandPreparationState =
  | { kind: 'idle' }
  | {
      kind: 'preparing'
      sessionId: string
      phase: PlayAlongBandPreparationPhase
      progress: number | null
      detail: string | null
    }
  | {
      kind: 'error'
      sessionId: string
      message: string
    }
  | {
      kind: 'blocked'
      sessionId: string
      blocker: CloudSplitBlocker
    }

export interface PlayAlongBandPreparationCopy {
  opening: string
  uploading(progress: number): string
  processing(progress: number): string
  saving(progress: number, detail: string | null): string
  openingSong: string
  failure: string
}

export interface PlayAlongBandPreparationControllerOptions {
  loadPort?: () => Promise<PlayAlongBandPreparationPort>
  onPrepared?: (sessionId: string, signal: AbortSignal) => void | Promise<void>
  /** Resolve billing/account prerequisites before loading any billable path. */
  checkPreflight?: (
    sessionId: string,
  ) => CloudSplitBlocker | null | Promise<CloudSplitBlocker | null>
  failureMessage?: string
}

export async function loadDefaultPlayAlongBandPreparationPort(): Promise<PlayAlongBandPreparationPort> {
  const module = await import('./uvr-band-preparation-port')
  return module.createUvrPlayAlongBandPreparationPort()
}

/** Load a target-aware split adapter without crossing persistence on first paint. */
export async function loadPlayAlongBandPreparationPort<
  TTarget extends PlayAlongTargetStemKind,
>(
  policy: PlayAlongTargetPolicy<TTarget>,
): Promise<PlayAlongBandPreparationPort> {
  const module = await import('./uvr-band-preparation-port')
  return module.createUvrPlayAlongBandPreparationPort(policy)
}

export function playAlongBandPreparationMessage(
  state: Extract<PlayAlongBandPreparationState, { kind: 'preparing' }>,
  copy: PlayAlongBandPreparationCopy,
): string {
  if (state.phase === 'opening') return copy.opening
  if (state.phase === 'uploading') {
    return copy.uploading(Math.round(state.progress ?? 0))
  }
  if (state.phase === 'processing') {
    return copy.processing(Math.round(state.progress ?? 0))
  }
  if (state.phase === 'saving') {
    return copy.saving(Math.round(state.progress ?? 0), state.detail)
  }
  return copy.openingSong
}

export function usePlayAlongBandPreparationController(
  options: PlayAlongBandPreparationControllerOptions = {},
) {
  const [state, setState] = createSignal<PlayAlongBandPreparationState>({
    kind: 'idle',
  })
  let generation = 0
  let disposed = false
  let activeAbort: AbortController | null = null
  let portPromise: Promise<PlayAlongBandPreparationPort> | null = null

  const ensurePort = (): Promise<PlayAlongBandPreparationPort> => {
    if (portPromise === null) {
      const load = options.loadPort ?? loadDefaultPlayAlongBandPreparationPort
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

      const reused =
        (await port.reusePreparedBand?.(sessionId, {
          signal: abort.signal,
        })) ?? null
      if (
        disposed ||
        abort.signal.aborted ||
        currentGeneration !== generation
      ) {
        return
      }
      if (reused !== null) {
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
        return
      }

      const blocker = (await options.checkPreflight?.(sessionId)) ?? null
      if (
        disposed ||
        abort.signal.aborted ||
        currentGeneration !== generation
      ) {
        return
      }
      if (blocker !== null) {
        activeAbort = null
        setState({ kind: 'blocked', sessionId, blocker })
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
            : (options.failureMessage ??
              'The band could not be separated. Your current mix is still ready.'),
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

  const clear = (): void => cancel()

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
