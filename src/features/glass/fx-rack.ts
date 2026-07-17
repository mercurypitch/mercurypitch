// ============================================================
// Glass — the voice FX rack (plan §17.1, decisions 13 + 17).
//
// Echo · Reverb · Hall as three parallel sends over a dry path.
// Applied at PLAYBACK (the recorded blob stays dry) and to the
// opt-in live monitor (wet-only, headphone-gated by the UI).
// The pitch detector never sees this graph — analysis is always
// dry. Impulse responses are generated, not downloaded.
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

/** Cosmic preset pills (decision 17). Send levels are starting points. */
export const FX_PRESETS: readonly FxPreset[] = [
  { name: 'Dry', settings: { echo: 0, reverb: 0, hall: 0 } },
  { name: 'Starlight', settings: { echo: 10, reverb: 25, hall: 0 } },
  { name: 'Nebula', settings: { echo: 18, reverb: 35, hall: 22 } },
  { name: 'Supernova', settings: { echo: 8, reverb: 20, hall: 65 } },
] as const

export const DEFAULT_FX: FxSettings = FX_PRESETS[1].settings // Starlight

/** The preset matching `settings`, if any (sliders may leave all of them). */
export function presetNameFor(settings: FxSettings): string | null {
  for (const preset of FX_PRESETS) {
    if (
      preset.settings.echo === settings.echo &&
      preset.settings.reverb === settings.reverb &&
      preset.settings.hall === settings.hall
    ) {
      return preset.name
    }
  }
  return null
}

export interface FxRack {
  /** Full path: dry + all three sends (playback goes here). */
  input: AudioNode
  /** Sends only, no dry (the live monitor — you already hear yourself). */
  wetInput: AudioNode
  setSettings: (settings: FxSettings) => void
  dispose: () => void
}

/** Exponentially decaying, stereo-decorrelated noise IR. */
function buildImpulse(
  ctx: AudioContext,
  seconds: number,
  { decayPower = 2.2, lowpassPasses = 0 } = {},
): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.max(1, Math.round(rate * seconds))
  const buffer = ctx.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decayPower)
    }
    // Cheap darkening for the hall: neighbor-averaging passes act as a
    // gentle lowpass without a filter graph.
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

export function createFxRack(ctx: AudioContext): FxRack {
  const input = ctx.createGain()
  const wetInput = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = 0.9
  output.connect(ctx.destination)

  // Dry path (full input only — the monitor skips it).
  const dry = ctx.createGain()
  dry.gain.value = 1
  input.connect(dry).connect(output)

  // Echo: feedback delay, softened by a lowpass in the loop.
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

  // Reverb: intimate generated IR.
  const reverbSend = ctx.createGain()
  reverbSend.gain.value = 0
  const reverb = ctx.createConvolver()
  reverb.buffer = buildImpulse(ctx, 1.2)
  reverbSend.connect(reverb).connect(output)

  // Hall: longer, darker generated IR.
  const hallSend = ctx.createGain()
  hallSend.gain.value = 0
  const hall = ctx.createConvolver()
  hall.buffer = buildImpulse(ctx, 3.4, { decayPower: 2.6, lowpassPasses: 2 })
  hallSend.connect(hall).connect(output)

  for (const send of [echoSend, reverbSend, hallSend]) {
    input.connect(send)
    wetInput.connect(send)
  }

  const setSettings = (settings: FxSettings): void => {
    const t = ctx.currentTime
    echoSend.gain.setTargetAtTime(settings.echo / 100, t, 0.03)
    reverbSend.gain.setTargetAtTime((settings.reverb / 100) * 0.9, t, 0.03)
    hallSend.gain.setTargetAtTime((settings.hall / 100) * 0.8, t, 0.03)
  }

  return {
    input,
    wetInput,
    setSettings,
    dispose: () => {
      for (const node of [
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
      ]) {
        node.disconnect()
      }
    },
  }
}
