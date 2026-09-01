// ============================================================
// Guitar room drum player — lazy kit selection behind one inert port
// ============================================================
//
// Guitar Night owns the preference, but Drum Night owns kit playback. This
// adapter keeps both the sample catalogue and Circuit graph out of first paint:
// the selected implementation is imported only from a user-owned Play path.

import type { DrumKitPlayerPort } from '@/features/drum-night/runtime/drum-runtime-types'
import type { GuitarNightDrumKitId } from '@/features/guitar-night/guitar-night-drum-sound'

export interface LazyGuitarRoomDrumPlayerOptions {
  readonly getAudioContext: () => AudioContext | null
  readonly getOutput: () => AudioNode | null
  readonly kitId: GuitarNightDrumKitId
}

function isSampleCatalogueKit(
  kitId: GuitarNightDrumKitId,
): kitId is Exclude<GuitarNightDrumKitId, 'circuit'> {
  return kitId !== 'circuit'
}

/**
 * Construct an inert port. `activate` is the first runtime import and the
 * selected kit is immutable for this port, which pins one sound for the run.
 */
export function createLazyGuitarRoomDrumPlayer(
  options: LazyGuitarRoomDrumPlayerOptions,
): DrumKitPlayerPort {
  let player: DrumKitPlayerPort | null = null
  let activation: Promise<boolean> | null = null
  let disposed = false

  const createSelectedPlayer = async (): Promise<DrumKitPlayerPort | null> => {
    if (options.kitId === 'circuit') {
      const module =
        await import('@/features/drum-night/audio/circuit-drum-synth')
      if (disposed) return null
      return module.createCircuitDrumSynth({
        getAudioContext: options.getAudioContext,
        getOutput: options.getOutput,
      })
    }
    if (!isSampleCatalogueKit(options.kitId)) return null
    const module = await import('@/features/drum-night/audio/drum-kit-player')
    if (disposed) return null
    return module.createDrumKitPlayer({
      getAudioContext: options.getAudioContext,
      getOutput: options.getOutput,
      initialKitId: options.kitId,
    })
  }

  return {
    async activate(): Promise<boolean> {
      if (disposed) return false
      if (activation !== null) return await activation
      if (player !== null) return await player.activate()
      const pendingActivation = (async () => {
        const created = await createSelectedPlayer()
        if (created === null) return false
        // Publish the created port before its own asynchronous activation so
        // a concurrent route disposal can await activation and retire it.
        player = created
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
    panic: (lane) => player?.panic(lane),
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      try {
        await activation
      } finally {
        await player?.dispose()
        player = null
      }
    },
  }
}
