// Guitar Night band controller owns one cancellable, stale-safe guitar-removal pass.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
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
  /**
   * The split cannot run at all, and no job was started.
   *
   * Distinct from `error` because it is not a failure: nothing went wrong,
   * the prerequisites are simply not met, and the answer is a thing the
   * singer can go and do rather than a message to dismiss. Before this
   * existed the button started a split with nothing behind it and sat on
   * "Sending the instrumental" for ever.
   */
  | {
      kind: 'blocked'
      sessionId: string
      blocker: CloudSplitBlocker
    }

interface GuitarNightBandPreparationControllerOptions {
  loadPort?: () => Promise<GuitarNightBandPreparationPort>
  onPrepared?: (sessionId: string, signal: AbortSignal) => void | Promise<void>
  /**
   * Whether a cloud split can run right now. Returning a blocker stops the
   * pass before any billable work — the caller supplies it because the
   * facts (who is signed in, what credits remain) belong to the surface,
   * not to this controller.
   *
   * May be async: on a standalone page the account state is lazy, and
   * answering from data that has not loaded yet would refuse a signed-in
   * singer. Awaiting it costs a fraction of a second before an upload that
   * costs minutes.
   */
  checkPreflight?: (
    sessionId: string,
  ) => CloudSplitBlocker | null | Promise<CloudSplitBlocker | null>
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
      // Before the port, before any billable work: a split spends credits
      // and uploads a ~60-190 MB instrumental, and `fetch` cannot report
      // upload progress — so a pass with no account behind it used to sit
      // on "Sending the instrumental · 0%" with nothing coming.
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

  /** Surface a freshly checked prerequisite without loading the billable port. */
  const block = (sessionId: string, blocker: CloudSplitBlocker): void => {
    generation += 1
    activeAbort?.abort()
    activeAbort = null
    setState({ kind: 'blocked', sessionId, blocker })
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
    block,
    cancel,
    clear,
  }
}
