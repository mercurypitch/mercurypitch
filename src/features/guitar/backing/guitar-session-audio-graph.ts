// Guitar session audio graph gives every room source one reusable, route-owned output path.
// Electric guide voices lazily share one amp stage; clean guide audio bypasses it.
// ============================================================

import { createGuitarAmpStage } from '@/lib/guitar/guitar-amp-stage'
import type { GuitarElectricAmpParameters, GuitarElectricAmpStage, } from '@/lib/guitar/guitar-electric-amp'
import { normalizeGuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
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
  /** Seed a dormant amp or update it without replacing its public ports. */
  setElectricAmpParameters(
    parameters: Partial<GuitarElectricAmpParameters>,
  ): void
  getElectricAmpParameters(): GuitarElectricAmpParameters
  dispose(): void
}

interface GuitarSessionAudioGraphOptions {
  destination?: AudioNode
  masterLevel?: number
  busLevels?: Partial<Record<GuitarSessionAudioBus, number>>
  /** Seed the dormant amp before any guide voice can reach it. */
  electricAmpParameters?: Partial<GuitarElectricAmpParameters>
}

export const GUITAR_SESSION_DEFAULT_BUS_LEVELS: Readonly<
  Record<GuitarSessionAudioBus, number>
> = Object.freeze({
  guide: 0.72,
  drums: 1,
  bass: 0.68,
  stems: 1,
  monitor: 0.74,
})

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
  let electricAmpParameters = normalizeGuitarElectricAmpParameters(
    options.electricAmpParameters,
  )
  let electricAmp: GuitarElectricAmpStage | undefined
  let disposed = false

  const guideInputs = {
    clean: buses.guide,
    get electric(): AudioNode {
      if (electricAmp === undefined) {
        if (disposed) throw new Error('Guitar session audio graph is disposed')
        electricAmp = createGuitarAmpStage(context, electricAmpParameters)
        electricAmp.output.connect(buses.guide)
      }
      return electricAmp.input
    },
  } satisfies Record<GuitarGuideInput, AudioNode>

  for (const bus of Object.keys(buses) as GuitarSessionAudioBus[]) {
    const level =
      options.busLevels?.[bus] ?? GUITAR_SESSION_DEFAULT_BUS_LEVELS[bus]
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
    setElectricAmpParameters(parameters) {
      if (disposed) return
      electricAmpParameters = normalizeGuitarElectricAmpParameters(
        parameters,
        electricAmpParameters,
      )
      electricAmp?.setParameters(electricAmpParameters, context.currentTime)
    },
    getElectricAmpParameters: () => ({ ...electricAmpParameters }),
    dispose() {
      if (disposed) return
      disposed = true
      for (const bus of Object.values(buses)) bus.disconnect()
      electricAmp?.dispose()
      master.disconnect()
      limiter.disconnect()
    },
  }
}
