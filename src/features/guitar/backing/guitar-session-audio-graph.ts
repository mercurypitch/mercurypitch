// Guitar session audio graph gives every room source one reusable, route-owned output path.
// Electric guide voices meet at one amp stage; clean guide audio bypasses it.
// ============================================================

import { createGuitarElectricAmpStage } from '@/lib/guitar/guitar-electric-amp'
import { sliderToGain } from '@/lib/volume-curve'

export type GuitarSessionAudioBus =
  | 'guide'
  | 'drums'
  | 'bass'
  | 'stems'
  | 'monitor'

export type GuitarGuideInput = 'clean' | 'electric'

export interface GuitarSessionAudioGraph {
  readonly context: AudioContext
  readonly buses: Readonly<Record<GuitarSessionAudioBus, GainNode>>
  readonly guideInputs: Readonly<Record<GuitarGuideInput, AudioNode>>
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

/** Anchor a live gain before replacing its automation, then settle calmly. */
export function setGuitarSessionGainTarget(
  parameter: AudioParam,
  target: number,
  at: number,
  timeConstant = 0.012,
): void {
  // Read first: a fallback cancel may move `.value` to an older scheduled
  // point. Re-anchoring that moved value is the click this helper prevents.
  const held = parameter.value
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(at)
  } else {
    parameter.cancelScheduledValues(at)
    parameter.setValueAtTime(held, at)
  }
  parameter.setTargetAtTime(target, at, timeConstant)
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

  // A normal guitar pickup combines its strings before the amplifier. Keep
  // that non-linearity on a dedicated electric input: the clean guide path is
  // also used by tuner/reference tones and must not inherit amp colour.
  const electricAmp = createGuitarElectricAmpStage(context)
  electricAmp.output.connect(buses.guide)

  const guideInputs = {
    clean: buses.guide,
    electric: electricAmp.input,
  } satisfies Record<GuitarGuideInput, AudioNode>

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
    guideInputs,
    master,
    limiter,
    setBusLevel(bus, position) {
      if (disposed) return
      buses[bus].gain.value = sliderToGain(clamp(position))
    },
    setMasterLevel(position) {
      if (disposed) return
      const now = context.currentTime
      setGuitarSessionGainTarget(
        master.gain,
        sliderToGain(clamp(position)),
        now,
      )
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const bus of Object.values(buses)) bus.disconnect()
      for (const node of electricAmp.nodes) node.disconnect()
      master.disconnect()
      limiter.disconnect()
    },
  }
}
