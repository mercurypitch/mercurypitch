// ============================================================
// Guitar room drum player — lazy live kit selection behind one inert port
// ============================================================
//
// Guitar Night owns the preference, but Drum Night owns kit playback. This
// adapter keeps the five-kit catalogue and graph out of first paint: desired
// kit changes remain identity-only until a user-owned Play path imports the
// concrete player. After activation, the same port switches live while the
// concrete player keeps missing samples behind its synth fallback.

import type { DrumKitPlayerSnapshot } from '@/features/drum-night/audio/drum-kit-player'
import type { DrumKitChoke, DrumKitChokeOutcome, DrumKitPlayerPort, DrumKitPrewarmHit, } from '@/features/drum-night/runtime/drum-runtime-types'
import type { GuitarNightDrumKitId } from '@/features/guitar-night/guitar-night-drum-sound'

export interface LazyGuitarRoomDrumPlayerOptions {
  readonly getAudioContext: () => AudioContext | null
  readonly getOutput: () => AudioNode | null
  readonly kitId: GuitarNightDrumKitId
}

/** Guitar's stable host contract over Drum Night's asynchronous kit player. */
export interface GuitarRoomDrumPlayerPort extends DrumKitPlayerPort {
  /**
   * Select immediately without making the room clock wait for sample warm-up.
   * Before activation this only records identity and performs no import or I/O.
   */
  setKit(kitId: GuitarNightDrumKitId): void
  choke?(request: DrumKitChoke): DrumKitChokeOutcome | undefined
  prewarm?(hits: readonly DrumKitPrewarmHit[]): Promise<void>
  snapshot?(): GuitarRoomDrumPlayerSnapshot
  subscribe?(listener: () => void): () => void
}

interface SwitchableDrumKitPlayer extends DrumKitPlayerPort {
  selectKit(kitId: GuitarNightDrumKitId): Promise<void>
  prewarm?(hits: readonly DrumKitPrewarmHit[]): Promise<void>
  snapshot?(): DrumKitPlayerSnapshot
  subscribe?(listener: () => void): () => void
}

export type GuitarRoomDrumPlayerSnapshot = Pick<
  DrumKitPlayerSnapshot,
  | 'selectedKitId'
  | 'status'
  | 'fallbackReady'
  | 'sampledReady'
  | 'preparedSamples'
  | 'plannedSamples'
  | 'selectedFormat'
  | 'error'
> & {
  /** Null before lazy activation, when Guitar has not imported the catalogue. */
  readonly sampleStatus: DrumKitPlayerSnapshot['sampleStatus'] | null
}

/**
 * Construct an inert port. `activate` is the first runtime import; later kit
 * intent delegates to the concrete player's stale-safe asynchronous switch.
 */
export function createLazyGuitarRoomDrumPlayer(
  options: LazyGuitarRoomDrumPlayerOptions,
): GuitarRoomDrumPlayerPort {
  let desiredKitId = options.kitId
  let player: SwitchableDrumKitPlayer | null = null
  let activation: Promise<boolean> | null = null
  let disposed = false
  let unsubscribePlayer: (() => void) | null = null
  const listeners = new Set<() => void>()

  const emit = (): void => {
    if (disposed) return
    for (const listener of listeners) listener()
  }

  const inertSnapshot = (): GuitarRoomDrumPlayerSnapshot => ({
    selectedKitId: desiredKitId,
    sampleStatus: null,
    status: 'idle',
    fallbackReady: false,
    sampledReady: false,
    preparedSamples: 0,
    plannedSamples: 0,
    selectedFormat: null,
    error: null,
  })

  const createSelectedPlayer = async (): Promise<{
    readonly initialKitId: GuitarNightDrumKitId
    readonly player: SwitchableDrumKitPlayer
  } | null> => {
    const module = await import('@/features/drum-night/audio/drum-kit-player')
    if (disposed) return null
    const initialKitId = desiredKitId
    return {
      initialKitId,
      player: module.createDrumKitPlayer({
        getAudioContext: options.getAudioContext,
        getOutput: options.getOutput,
        initialKitId,
      }),
    }
  }

  const applyKit = (
    currentPlayer: SwitchableDrumKitPlayer,
    kitId: GuitarNightDrumKitId,
  ): void => {
    // Selection identity changes synchronously inside the concrete player;
    // baseline sample warming deliberately stays off the transport promise.
    void currentPlayer.selectKit(kitId).catch(() => {
      // Disposal and a newer selection abort older preparation. Real loading
      // failures remain audible through the concrete player's synth fallback.
    })
  }

  return {
    setKit(kitId): void {
      if (disposed) return
      desiredKitId = kitId
      emit()
      const currentPlayer = player
      if (currentPlayer !== null) applyKit(currentPlayer, kitId)
    },
    async activate(): Promise<boolean> {
      if (disposed) return false
      if (activation !== null) return await activation
      if (player !== null) return await player.activate()
      const pendingActivation = (async () => {
        const createdSelection = await createSelectedPlayer()
        if (createdSelection === null) return false
        const created = createdSelection.player
        // Publish the created port before its own asynchronous activation so
        // a concurrent route disposal can await activation and retire it.
        player = created
        unsubscribePlayer = created.subscribe?.(emit) ?? null
        // `setKit` can run in the microtask between constructing this lazy
        // player and publishing it above. Reconcile that narrow activation
        // race so the user's latest visible selection always wins.
        if (desiredKitId !== createdSelection.initialKitId) {
          applyKit(created, desiredKitId)
        }
        return await created.activate()
      })()
      activation = pendingActivation
      try {
        return await pendingActivation
      } finally {
        if (activation === pendingActivation) activation = null
      }
    },
    trigger: (hit) => player?.trigger(hit) ?? 'dropped',
    choke: (request) => player?.choke?.(request) ?? 'dropped',
    async prewarm(hits): Promise<void> {
      await player?.prewarm?.(hits)
    },
    snapshot: () => player?.snapshot?.() ?? inertSnapshot(),
    subscribe(listener): () => void {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    panic: (lane) => player?.panic(lane),
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      unsubscribePlayer?.()
      unsubscribePlayer = null
      listeners.clear()
      try {
        await activation
      } finally {
        await player?.dispose()
        player = null
      }
    },
  }
}
