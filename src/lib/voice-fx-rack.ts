// ============================================================
// Voice FX Rack — shared, non-destructive listening-room audio graph
// ============================================================

export interface FxSettings {
  /** 0..100 wet, one per effect. */
  echo: number
  reverb: number
  hall: number
}

export interface FxPreset {
  name: string
  settings: FxSettings
}

export const FX_PRESETS: readonly FxPreset[] = [
  { name: 'Dry', settings: { echo: 0, reverb: 0, hall: 0 } },
  { name: 'Starlight', settings: { echo: 10, reverb: 25, hall: 0 } },
  { name: 'Nebula', settings: { echo: 18, reverb: 35, hall: 22 } },
  { name: 'Supernova', settings: { echo: 8, reverb: 20, hall: 65 } },
] as const

export const DEFAULT_FX: FxSettings = FX_PRESETS[1].settings

function clampSend(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

export function normalizeFxSettings(settings: FxSettings): FxSettings {
  return {
    echo: clampSend(settings.echo),
    reverb: clampSend(settings.reverb),
    hall: clampSend(settings.hall),
  }
}

/** The preset matching `settings`, if any (sliders may leave all of them). */
export function presetNameFor(settings: FxSettings): string | null {
  const normalized = normalizeFxSettings(settings)
  for (const preset of FX_PRESETS) {
    if (
      preset.settings.echo === normalized.echo &&
      preset.settings.reverb === normalized.reverb &&
      preset.settings.hall === normalized.hall
    ) {
      return preset.name
    }
  }
  return null
}

export interface FxRack {
  /** Full path: dry + all three sends (recorded playback goes here). */
  input: AudioNode
  /** Sends only, no dry (used by Glass's headphone-gated monitor). */
  wetInput: AudioNode
  setSettings: (settings: FxSettings) => void
  dispose: () => void
}

export interface FxRackOptions {
  /** Optional safety limiting for user-generated takes with stacked wet sends. */
  safetyLimiter?: boolean
}

function createSeededNoise(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return (((value ^ (value >>> 14)) >>> 0) / 4_294_967_296) * 2 - 1
  }
}

/** Exponentially decaying, deterministic stereo-decorrelated noise IR. */
function buildImpulse(
  ctx: AudioContext,
  seconds: number,
  {
    decayPower = 2.2,
    lowpassPasses = 0,
    seed,
  }: { decayPower?: number; lowpassPasses?: number; seed: number },
): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.max(1, Math.round(rate * seconds))
  const buffer = ctx.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel++) {
    const noise = createSeededNoise(seed + channel * 0x9e3779b9)
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = noise() * Math.pow(1 - i / length, decayPower)
    }
    for (let pass = 0; pass < lowpassPasses; pass++) {
      let previous = 0
      for (let i = 0; i < length; i++) {
        const smoothed = (data[i] + previous) / 2
        previous = data[i]
        data[i] = smoothed
      }
    }
  }
  return buffer
}

const impulseCache = new WeakMap<
  AudioContext,
  { reverb: AudioBuffer; hall: AudioBuffer }
>()

function getImpulseBuffers(ctx: AudioContext): {
  reverb: AudioBuffer
  hall: AudioBuffer
} {
  const cached = impulseCache.get(ctx)
  if (cached !== undefined) return cached
  const buffers = {
    reverb: buildImpulse(ctx, 1.2, {
      seed: 0x71a5f11d,
    }),
    hall: buildImpulse(ctx, 3.4, {
      decayPower: 2.6,
      lowpassPasses: 2,
      seed: 0x4e3b2a19,
    }),
  }
  impulseCache.set(ctx, buffers)
  return buffers
}

export function createFxRack(
  ctx: AudioContext,
  options: FxRackOptions = {},
): FxRack {
  const input = ctx.createGain()
  const wetInput = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = options.safetyLimiter === true ? 0.88 : 0.9

  // Glass keeps its established graph unchanged. Voice History opts into this
  // safety stage because several wet sends can stack over arbitrary saved input.
  const limiter =
    options.safetyLimiter === true ? ctx.createDynamicsCompressor() : null
  if (limiter !== null) {
    limiter.threshold.value = -6
    limiter.knee.value = 4
    limiter.ratio.value = 16
    limiter.attack.value = 0.003
    limiter.release.value = 0.18
    output.connect(limiter).connect(ctx.destination)
  } else {
    output.connect(ctx.destination)
  }

  const dry = ctx.createGain()
  dry.gain.value = 1
  input.connect(dry).connect(output)

  const echoSend = ctx.createGain()
  echoSend.gain.value = 0
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.28
  const feedback = ctx.createGain()
  feedback.gain.value = 0.35
  const echoDamp = ctx.createBiquadFilter()
  echoDamp.type = 'lowpass'
  echoDamp.frequency.value = 3200
  echoSend.connect(delay)
  delay.connect(echoDamp).connect(feedback).connect(delay)
  delay.connect(output)

  const reverbSend = ctx.createGain()
  reverbSend.gain.value = 0
  const reverb = ctx.createConvolver()
  const impulseBuffers = getImpulseBuffers(ctx)
  reverb.buffer = impulseBuffers.reverb
  reverbSend.connect(reverb).connect(output)

  const hallSend = ctx.createGain()
  hallSend.gain.value = 0
  const hall = ctx.createConvolver()
  hall.buffer = impulseBuffers.hall
  hallSend.connect(hall).connect(output)

  for (const send of [echoSend, reverbSend, hallSend]) {
    input.connect(send)
    wetInput.connect(send)
  }

  const setSettings = (next: FxSettings): void => {
    const settings = normalizeFxSettings(next)
    const time = ctx.currentTime
    echoSend.gain.setTargetAtTime(settings.echo / 100, time, 0.03)
    reverbSend.gain.setTargetAtTime((settings.reverb / 100) * 0.9, time, 0.03)
    hallSend.gain.setTargetAtTime((settings.hall / 100) * 0.8, time, 0.03)
  }

  let disposed = false
  return {
    input,
    wetInput,
    setSettings,
    dispose: () => {
      if (disposed) return
      disposed = true
      const nodes: AudioNode[] = [
        input,
        wetInput,
        output,
        dry,
        echoSend,
        delay,
        feedback,
        echoDamp,
        reverbSend,
        reverb,
        hallSend,
        hall,
      ]
      if (limiter !== null) nodes.push(limiter)
      for (const node of nodes) {
        node.disconnect()
      }
    },
  }
}
