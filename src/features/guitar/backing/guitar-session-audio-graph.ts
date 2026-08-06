// Guitar session audio graph gives every room source one reusable, route-owned output path.
// ============================================================

import { sliderToGain } from '@/lib/volume-curve'

export type GuitarSessionAudioBus =
  | 'guide'
  | 'drums'
  | 'bass'
  | 'stems'
  | 'monitor'

export interface GuitarSessionAudioGraph {
  readonly context: AudioContext
  readonly buses: Readonly<Record<GuitarSessionAudioBus, GainNode>>
  readonly master: GainNode
  readonly limiter: DynamicsCompressorNode
  setBusLevel(bus: GuitarSessionAudioBus, position: number): void
  setMasterLevel(position: number): void
  dispose(): void
}

interface GuitarSessionAudioGraphOptions {
  destination?: AudioNode
  masterLevel?: number
  busLevels?: Partial<Record<GuitarSessionAudioBus, number>>
}

const DEFAULT_BUS_LEVELS: Record<GuitarSessionAudioBus, number> = {
  guide: 0.72,
  drums: 0.78,
  bass: 0.68,
  stems: 1,
  monitor: 0.74,
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Build the shared room graph without activating its context. The caller owns
 * the AudioContext lifetime; this graph owns only the nodes it creates.
 */
export function createGuitarSessionAudioGraph(
  context: AudioContext,
  options: GuitarSessionAudioGraphOptions = {},
): GuitarSessionAudioGraph {
  const master = context.createGain()
  const limiter = context.createDynamicsCompressor()
  const buses = {
    guide: context.createGain(),
    drums: context.createGain(),
    bass: context.createGain(),
    stems: context.createGain(),
    monitor: context.createGain(),
  } satisfies Record<GuitarSessionAudioBus, GainNode>

  for (const bus of Object.keys(buses) as GuitarSessionAudioBus[]) {
    const level = options.busLevels?.[bus] ?? DEFAULT_BUS_LEVELS[bus]
    buses[bus].gain.value = sliderToGain(clamp(level))
    buses[bus].connect(master)
  }

  master.gain.value = sliderToGain(clamp(options.masterLevel ?? 0.78))
  limiter.threshold.value = -7
  limiter.knee.value = 5
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.18
  master.connect(limiter)
  limiter.connect(options.destination ?? context.destination)

  let disposed = false

  return {
    context,
    buses,
    master,
    limiter,
    setBusLevel(bus, position) {
      if (disposed) return
      buses[bus].gain.value = sliderToGain(clamp(position))
    },
    setMasterLevel(position) {
      if (disposed) return
      master.gain.value = sliderToGain(clamp(position))
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const bus of Object.values(buses)) bus.disconnect()
      master.disconnect()
      limiter.disconnect()
    },
  }
}
