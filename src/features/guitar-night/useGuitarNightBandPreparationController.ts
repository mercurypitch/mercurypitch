// Guitar Night band preparation preserves its copy and API over the shared controller.
// ============================================================

import { createSignal } from 'solid-js'
import type { PlayAlongBandPreparationControllerOptions, PlayAlongBandPreparationCopy, PlayAlongBandPreparationState, } from '@/features/play-along/useBandPreparationController'
import { loadDefaultPlayAlongBandPreparationPort, playAlongBandPreparationMessage, usePlayAlongBandPreparationController, } from '@/features/play-along/useBandPreparationController'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'

export type GuitarNightBandPreparationState = PlayAlongBandPreparationState

type GuitarNightBandPreparationControllerOptions =
  PlayAlongBandPreparationControllerOptions

const GUITAR_NIGHT_BAND_PREPARATION_COPY: PlayAlongBandPreparationCopy = {
  opening: 'Opening full-band separation…',
  uploading: (progress) => `Sending the instrumental · ${progress}%`,
  processing: (progress) => `Separating drums, bass, and guitar · ${progress}%`,
  saving: (progress, detail) => detail ?? `Saving band parts · ${progress}%`,
  openingSong: 'Opening the guitar-free band…',
  failure: 'The band could not be separated. Your two-stem mix is still ready.',
}

export async function loadDefaultGuitarNightBandPreparationPort(): Promise<GuitarNightBandPreparationPort> {
  return loadDefaultPlayAlongBandPreparationPort()
}

export function guitarNightBandPreparationMessage(
  state: Extract<GuitarNightBandPreparationState, { kind: 'preparing' }>,
): string {
  return playAlongBandPreparationMessage(
    state,
    GUITAR_NIGHT_BAND_PREPARATION_COPY,
  )
}

export function useGuitarNightBandPreparationController(
  options: GuitarNightBandPreparationControllerOptions = {},
) {
  const controller = usePlayAlongBandPreparationController({
    ...options,
    failureMessage:
      options.failureMessage ?? GUITAR_NIGHT_BAND_PREPARATION_COPY.failure,
  })
  const [blockedState, setBlockedState] = createSignal<Extract<
    GuitarNightBandPreparationState,
    { kind: 'blocked' }
  > | null>(null)
  const state = (): GuitarNightBandPreparationState =>
    blockedState() ?? controller.state()

  const start = (sessionId: string): void => {
    setBlockedState(null)
    controller.start(sessionId)
  }

  /** Surface a freshly checked prerequisite without entering billable work. */
  const block = (sessionId: string, blocker: CloudSplitBlocker): void => {
    controller.cancel()
    setBlockedState({ kind: 'blocked', sessionId, blocker })
  }

  const cancel = (): void => {
    setBlockedState(null)
    controller.cancel()
  }

  return {
    state,
    isPreparing: () => state().kind === 'preparing',
    start,
    block,
    cancel,
    clear: cancel,
  }
}
