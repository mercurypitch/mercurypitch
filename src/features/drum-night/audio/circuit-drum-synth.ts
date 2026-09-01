// ============================================================
// Circuit drum synth — zero-byte electronic kit with deterministic movement
// ============================================================
//
// Circuit is an explicitly selected synth model, never the implicit fallback
// for a sampled kit. Its dense metallic excitation is generated once per
// AudioContext and reused by hats and cymbals; bounded seeded variation moves
// pitch, tone, decay, and gain without turning repeated hits into new voices.

import type { DrumKitPlaybackLane, DrumKitPlayerPort, DrumKitTrigger, DrumKitTriggerOutcome, } from '@/features/drum-night/runtime/drum-runtime-types'
import { drumVoiceForMidi } from '@/lib/drum-voice-map'
import type { DrumVoiceId } from '@/lib/drum-voices'
import { fnv1a32, mulberry32 } from './drum-sample-select'

export type DrumSynthModelId = 'circuit' | 'mercury-synth'

export interface DrumSynthModelDescriptor {
  readonly engine: 'synth-model'
  readonly modelId: DrumSynthModelId
  readonly name: string
  readonly character: string
  readonly publishedEncodedBytes: 0
  /** Sample failures must remain honest Mercury fallback, never this model. */
  readonly eligibleAsSampleFallback: boolean
  readonly sampleFailureFallbackModelId: 'mercury-synth'
}

export const CIRCUIT_DRUM_SYNTH_MODEL: DrumSynthModelDescriptor = Object.freeze(
  {
    engine: 'synth-model',
    modelId: 'circuit',
    name: 'Circuit',
    character: 'Tight electronic drums with bounded analog-style movement',
    publishedEncodedBytes: 0,
    eligibleAsSampleFallback: false,
    sampleFailureFallbackModelId: 'mercury-synth',
  },
)

export interface CircuitHitVariation {
  /** 0.97–1.03 keeps the intended drum identity intact. */
  readonly pitchRatio: number
  /** 0.9–1.1 keeps tails recognisable while avoiding exact repetition. */
  readonly decayRatio: number
  /** 0.92–1.08 moves filters without crossing articulation families. */
  readonly toneRatio: number
  /** 0.96–1.04 stays subordinate to authored velocity. */
  readonly gainRatio: number
}

export interface CircuitDrumSynthOptions {
  readonly getAudioContext: () => AudioContext | null
  readonly getOutput: () => AudioNode | null
  readonly variationSeed?: number
}

export interface CircuitDrumSynth extends DrumKitPlayerPort {
  readonly synthModelId: 'circuit'
  trigger(hit: DrumKitTrigger): DrumKitTriggerOutcome
}

/**
 * Destination-aware core for hosts that already own their mix graph.
 *
 * Drum Night passes its live/authored family destination into `trigger`, so
 * Circuit cannot bypass lane gains or the live-capture boundary. `lane` stays
 * on the hit and scopes open-hat choking and panic just like sampled voices.
 */
export interface CircuitDrumEngine {
  readonly synthModelId: 'circuit'
  trigger(
    context: BaseAudioContext,
    destination: AudioNode,
    hit: DrumKitTrigger,
  ): DrumKitTriggerOutcome
  choke(group: string, atContextTime?: number, lane?: DrumKitPlaybackLane): void
  panic(lane?: DrumKitPlaybackLane): void
  dispose(): void
}

interface ActiveCircuitVoice {
  readonly context: BaseAudioContext
  readonly gains: GainNode[]
  readonly sources: AudioScheduledSourceNode[]
  readonly chokeGroup: string | null
  readonly lane: DrumKitPlaybackLane
  remainingSources: number
  released: boolean
}

interface CircuitVoicePlan {
  readonly context: BaseAudioContext
  readonly destination: AudioNode
  readonly at: number
  readonly amplitude: number
  readonly chokeGroup: string | null
  readonly lane: DrumKitPlaybackLane
  readonly variation: CircuitHitVariation
  readonly register: (
    sources: AudioScheduledSourceNode[],
    gains: GainNode[],
  ) => void
}

const METALLIC_SECONDS = 0.9
const MINIMUM_GAIN = 0.0001
const PANIC_SECONDS = 0.08
const PANIC_SLACK_SECONDS = 0.025
const CHOKE_SECONDS = 0.045
const DEFAULT_VARIATION_SEED = 0xc1ac017
export const CIRCUIT_OPEN_HAT_CHOKE_GROUP = 'hi-hat-open'

const metallicExcitationByContext = new WeakMap<BaseAudioContext, AudioBuffer>()

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function hashString(value: string | undefined): number {
  if (value === undefined) return 0
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function symmetric(draw: number, amount: number): number {
  return 1 + (draw * 2 - 1) * amount
}

/** Pure deterministic parameter movement, exported so bounds stay testable. */
export function circuitHitVariation(
  seed: number,
  sequence: number,
  gmKey: number,
  sourceId?: string,
): CircuitHitVariation {
  const random = mulberry32(
    fnv1a32(seed, sequence, gmKey, hashString(sourceId), 0xc1ac017),
  )
  return Object.freeze({
    pitchRatio: symmetric(random(), 0.03),
    decayRatio: symmetric(random(), 0.1),
    toneRatio: symmetric(random(), 0.08),
    gainRatio: symmetric(random(), 0.04),
  })
}

/**
 * Return one deterministic, spectrally dense metallic excitation per context.
 * The buffer has no kit bytes and allocates only after a Circuit hit activates.
 */
export function circuitMetallicExcitation(
  context: BaseAudioContext,
): AudioBuffer {
  const cached = metallicExcitationByContext.get(context)
  if (cached !== undefined) return cached

  const length = Math.max(1, Math.floor(context.sampleRate * METALLIC_SECONDS))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  const random = mulberry32(fnv1a32(context.sampleRate, length, 0x6d3a1))
  const ratios = [1, 1.342, 1.817, 2.391, 3.073, 4.119, 5.331]
  const baseHz = 823
  for (let index = 0; index < length; index += 1) {
    const time = index / context.sampleRate
    let metallic = 0
    for (let partial = 0; partial < ratios.length; partial += 1) {
      const phase = 2 * Math.PI * baseHz * ratios[partial] * time
      metallic += Math.sin(phase) >= 0 ? 1 : -1
    }
    const noise = random() * 2 - 1
    data[index] = clamp(metallic / ratios.length + noise * 0.24, -1, 1) * 0.58
  }
  metallicExcitationByContext.set(context, buffer)
  return buffer
}

function atLeastNow(context: BaseAudioContext, requested: number): number {
  return Math.max(
    context.currentTime,
    Number.isFinite(requested) ? requested : context.currentTime,
  )
}

function connectGain(
  context: BaseAudioContext,
  destination: AudioNode,
  at: number,
  peak: number,
  decaySeconds: number,
): GainNode {
  const gain = context.createGain()
  gain.gain.setValueAtTime(Math.max(MINIMUM_GAIN, peak), at)
  gain.gain.exponentialRampToValueAtTime(
    MINIMUM_GAIN,
    at + Math.max(0.02, decaySeconds),
  )
  gain.connect(destination)
  return gain
}

function oscillatorVoice(
  plan: CircuitVoicePlan,
  options: {
    readonly type: OscillatorType
    readonly startHz: number
    readonly endHz: number
    readonly decaySeconds: number
    readonly gain: number
  },
): void {
  const decay = options.decaySeconds * plan.variation.decayRatio
  const source = plan.context.createOscillator()
  source.type = options.type
  source.frequency.setValueAtTime(
    options.startHz * plan.variation.pitchRatio,
    plan.at,
  )
  source.frequency.exponentialRampToValueAtTime(
    Math.max(20, options.endHz * plan.variation.pitchRatio),
    plan.at + Math.min(decay, 0.12),
  )
  const gain = connectGain(
    plan.context,
    plan.destination,
    plan.at,
    plan.amplitude * options.gain,
    decay,
  )
  source.connect(gain)
  source.start(plan.at)
  source.stop(plan.at + decay + 0.035)
  plan.register([source], [gain])
}

function excitationVoice(
  plan: CircuitVoicePlan,
  options: {
    readonly filterType: BiquadFilterType
    readonly frequencyHz: number
    readonly q: number
    readonly decaySeconds: number
    readonly gain: number
    readonly playbackRate?: number
  },
): void {
  const decay = options.decaySeconds * plan.variation.decayRatio
  const source = plan.context.createBufferSource()
  source.buffer = circuitMetallicExcitation(plan.context)
  source.playbackRate.setValueAtTime(
    (options.playbackRate ?? 1) * plan.variation.pitchRatio,
    plan.at,
  )
  const filter = plan.context.createBiquadFilter()
  filter.type = options.filterType
  filter.frequency.setValueAtTime(
    options.frequencyHz * plan.variation.toneRatio,
    plan.at,
  )
  filter.Q.setValueAtTime(options.q, plan.at)
  const gain = connectGain(
    plan.context,
    plan.destination,
    plan.at,
    plan.amplitude * options.gain,
    decay,
  )
  source.connect(filter)
  filter.connect(gain)
  source.start(plan.at, 0, Math.min(METALLIC_SECONDS, decay + 0.06))
  source.stop(plan.at + Math.min(METALLIC_SECONDS, decay + 0.08))
  plan.register([source], [gain])
}

function triggerCircuitVoice(voice: DrumVoiceId, plan: CircuitVoicePlan): void {
  switch (voice) {
    case 'kick':
      oscillatorVoice(plan, {
        type: 'sine',
        startHz: 142,
        endHz: 43,
        decaySeconds: 0.34,
        gain: 0.92,
      })
      return
    case 'snare':
      excitationVoice(plan, {
        filterType: 'bandpass',
        frequencyHz: 1850,
        q: 0.72,
        decaySeconds: 0.16,
        gain: 0.56,
      })
      oscillatorVoice(plan, {
        type: 'triangle',
        startHz: 214,
        endHz: 136,
        decaySeconds: 0.12,
        gain: 0.34,
      })
      return
    case 'sidestick':
      excitationVoice(plan, {
        filterType: 'bandpass',
        frequencyHz: 2_650,
        q: 2.4,
        decaySeconds: 0.045,
        gain: 0.42,
        playbackRate: 1.22,
      })
      return
    case 'clap':
      excitationVoice(plan, {
        filterType: 'bandpass',
        frequencyHz: 1_340,
        q: 1.1,
        decaySeconds: 0.19,
        gain: 0.52,
        playbackRate: 0.86,
      })
      return
    case 'hh-closed':
    case 'hh-pedal':
      excitationVoice(plan, {
        filterType: 'highpass',
        frequencyHz: voice === 'hh-pedal' ? 6_200 : 7_800,
        q: 0.7,
        decaySeconds: voice === 'hh-pedal' ? 0.065 : 0.045,
        gain: voice === 'hh-pedal' ? 0.2 : 0.25,
        playbackRate: voice === 'hh-pedal' ? 0.9 : 1.08,
      })
      return
    case 'hh-open':
      excitationVoice(plan, {
        filterType: 'highpass',
        frequencyHz: 6_900,
        q: 0.68,
        decaySeconds: 0.31,
        gain: 0.29,
        playbackRate: 1.03,
      })
      return
    case 'tom-low':
    case 'tom-mid':
    case 'tom-high': {
      const startHz =
        voice === 'tom-low' ? 154 : voice === 'tom-mid' ? 232 : 337
      oscillatorVoice(plan, {
        type: 'triangle',
        startHz,
        endHz: startHz * 0.58,
        decaySeconds: voice === 'tom-low' ? 0.31 : 0.25,
        gain: 0.58,
      })
      return
    }
    case 'crash':
      excitationVoice(plan, {
        filterType: 'bandpass',
        frequencyHz: 4_850,
        q: 0.58,
        decaySeconds: 0.82,
        gain: 0.42,
        playbackRate: 0.8,
      })
      return
    case 'ride':
      excitationVoice(plan, {
        filterType: 'highpass',
        frequencyHz: 5_200,
        q: 0.82,
        decaySeconds: 0.58,
        gain: 0.31,
        playbackRate: 0.94,
      })
      oscillatorVoice(plan, {
        type: 'triangle',
        startHz: 1_180,
        endHz: 1_020,
        decaySeconds: 0.11,
        gain: 0.12,
      })
  }
}

export function createCircuitDrumEngine(
  options: Pick<CircuitDrumSynthOptions, 'variationSeed'> = {},
): CircuitDrumEngine {
  const activeVoices = new Set<ActiveCircuitVoice>()
  const seed = options.variationSeed ?? DEFAULT_VARIATION_SEED
  let sequence = 0
  let disposed = false

  const retireVoice = (voice: ActiveCircuitVoice): void => {
    activeVoices.delete(voice)
    for (const gain of voice.gains) {
      try {
        gain.disconnect()
      } catch {
        // A host may already have retired its route-owned destination.
      }
    }
  }

  const register = (
    context: BaseAudioContext,
    lane: DrumKitPlaybackLane,
    chokeGroup: string | null,
    sources: AudioScheduledSourceNode[],
    gains: GainNode[],
  ): void => {
    const voice: ActiveCircuitVoice = {
      context,
      gains,
      sources,
      chokeGroup,
      lane,
      remainingSources: sources.length,
      released: false,
    }
    activeVoices.add(voice)
    for (const source of sources) {
      source.addEventListener(
        'ended',
        () => {
          voice.remainingSources -= 1
          if (voice.remainingSources <= 0) retireVoice(voice)
        },
        { once: true },
      )
    }
  }

  const releaseVoice = (
    voice: ActiveCircuitVoice,
    requestedAt: number | undefined,
    releaseSeconds: number,
  ): void => {
    if (voice.released) return
    voice.released = true
    const now = atLeastNow(
      voice.context,
      requestedAt ?? voice.context.currentTime,
    )
    for (const gain of voice.gains) {
      let held = false
      try {
        gain.gain.cancelAndHoldAtTime(now)
        held = true
      } catch {
        // Older Web Audio implementations need the explicit anchor below.
      }
      if (!held) {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(Math.max(MINIMUM_GAIN, gain.gain.value), now)
      }
      gain.gain.setTargetAtTime(
        MINIMUM_GAIN,
        now,
        Math.max(0.001, releaseSeconds / 5),
      )
    }
    for (const source of voice.sources) {
      try {
        source.stop(now + releaseSeconds + PANIC_SLACK_SECONDS)
      } catch {
        // A source whose natural tail already ended needs no second stop.
      }
    }
  }

  const choke = (
    group: string,
    atContextTime?: number,
    lane?: DrumKitPlaybackLane,
  ): void => {
    if (group === '') return
    for (const voice of [...activeVoices]) {
      if (
        voice.chokeGroup === group &&
        (lane === undefined || voice.lane === lane)
      ) {
        releaseVoice(voice, atContextTime, CHOKE_SECONDS)
      }
    }
  }

  const panic = (lane?: DrumKitPlaybackLane): void => {
    for (const voice of [...activeVoices]) {
      if (lane === undefined || voice.lane === lane) {
        releaseVoice(voice, undefined, PANIC_SECONDS)
      }
    }
  }

  return {
    synthModelId: 'circuit',
    trigger(context, destination, hit): DrumKitTriggerOutcome {
      if (disposed) return 'dropped'
      const voice = drumVoiceForMidi(hit.gmKey)
      if (voice === null) return 'unmapped'
      const velocity = clamp(hit.velocity, 1, 127)
      const variation = circuitHitVariation(
        seed,
        sequence,
        hit.gmKey,
        hit.sourceId,
      )
      const amplitude = Math.pow(velocity / 127, 0.72) * variation.gainRatio
      sequence += 1
      const lane = hit.lane ?? 'live'
      const at = atLeastNow(context, hit.atContextTime ?? context.currentTime)
      if (voice === 'hh-closed' || voice === 'hh-pedal') {
        choke(CIRCUIT_OPEN_HAT_CHOKE_GROUP, at, lane)
      }
      const chokeGroup =
        voice === 'hh-open' ? CIRCUIT_OPEN_HAT_CHOKE_GROUP : null
      try {
        triggerCircuitVoice(voice, {
          context,
          destination,
          at,
          amplitude,
          chokeGroup,
          lane,
          variation,
          register: (sources, gains) =>
            register(context, lane, chokeGroup, sources, gains),
        })
        return 'synthesized'
      } catch {
        return 'dropped'
      }
    },
    choke,
    panic,
    dispose(): void {
      if (disposed) return
      panic()
      disposed = true
    },
  }
}

export function createCircuitDrumSynth(
  options: CircuitDrumSynthOptions,
): CircuitDrumSynth {
  const engine = createCircuitDrumEngine({
    ...(options.variationSeed === undefined
      ? {}
      : { variationSeed: options.variationSeed }),
  })
  let disposed = false

  return {
    synthModelId: 'circuit',
    activate(): boolean {
      return (
        !disposed &&
        options.getAudioContext() !== null &&
        options.getOutput() !== null
      )
    },
    trigger(hit): DrumKitTriggerOutcome {
      if (disposed) return 'dropped'
      const context = options.getAudioContext()
      const destination = options.getOutput()
      if (context === null || destination === null) return 'dropped'
      return engine.trigger(context, destination, hit)
    },
    panic: (lane) => engine.panic(lane),
    dispose(): void {
      if (disposed) return
      disposed = true
      engine.dispose()
    },
  }
}
