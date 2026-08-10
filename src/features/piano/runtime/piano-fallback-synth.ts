// ============================================================
// Piano fallback synth — small route-neutral zero-download instrument
// ============================================================
//
// The transport owns and activates the AudioContext. This synth only builds
// its graph after that context exists, so construction is silent and live or
// scheduled notes can share one route lifetime without importing AudioEngine.

export const PIANO_FALLBACK_MAX_VOICES = 32

export interface PianoFallbackSynthNote {
  /** Stable live or score voice identity. */
  id: string
  midi: number
  /** Normalized strike velocity in the inclusive range 0..1. */
  velocity: number
  /** Normalized soft-pedal value captured when the note began. */
  softPedalValue?: number
  /** AudioContext time. Omit for an immediate live note. */
  atContextTime?: number
}

export interface PianoFallbackSynth {
  noteOn(note: PianoFallbackSynthNote): boolean
  noteOff(id: string, atContextTime?: number): boolean
  panic(atContextTime?: number): void
  activeVoiceIds(): readonly string[]
  dispose(): void
}

export interface PianoFallbackSynthOptions {
  /** The route-owned transport context; this synth never creates one. */
  getAudioContext(): AudioContext | null
  /** Test/device seam. Values above the production ceiling are clamped. */
  maxVoices?: number
}

interface SynthGraph {
  context: AudioContext
  master: GainNode
  limiter: DynamicsCompressorNode
}

interface SynthVoice {
  id: string
  graph: SynthGraph
  gain: GainNode
  oscillators: OscillatorNode[]
  releaseAt: number | null
}

const MINIMUM_GAIN = 0.0001
const RELEASE_SECONDS = 0.085

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function midiFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function strikeGain(velocity: number, softPedalValue: number): number {
  const curvedVelocity = Math.pow(clamp(velocity, 0, 1), 1.35)
  const softScale = 1 - clamp(softPedalValue, 0, 1) * 0.42
  return Math.max(MINIMUM_GAIN, curvedVelocity * softScale * 0.13)
}

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // A stopped or closed graph may already be disconnected.
  }
}

/** Create a polyphonic fallback that remains inert until its first note. */
export function createPianoFallbackSynth(
  options: PianoFallbackSynthOptions,
): PianoFallbackSynth {
  const requestedVoices = options.maxVoices ?? PIANO_FALLBACK_MAX_VOICES
  const maxVoices = Math.min(
    PIANO_FALLBACK_MAX_VOICES,
    Math.max(
      1,
      Number.isFinite(requestedVoices) ? Math.floor(requestedVoices) : 1,
    ),
  )
  const voices = new Map<string, SynthVoice>()
  let graph: SynthGraph | null = null
  let disposed = false

  const disconnectGraph = (ownedGraph: SynthGraph | null): void => {
    if (ownedGraph === null) return
    safeDisconnect(ownedGraph.master)
    safeDisconnect(ownedGraph.limiter)
  }

  const cleanVoice = (voice: SynthVoice): void => {
    if (voices.get(voice.id) === voice) voices.delete(voice.id)
    for (const oscillator of voice.oscillators) safeDisconnect(oscillator)
    safeDisconnect(voice.gain)
  }

  const releaseVoice = (voice: SynthVoice, requestedAt: number): boolean => {
    const context = voice.graph.context
    const releaseAt = Math.max(
      context.currentTime,
      Number.isFinite(requestedAt) ? requestedAt : context.currentTime,
    )
    if (voice.releaseAt !== null && voice.releaseAt <= releaseAt) return false
    voice.releaseAt = releaseAt
    const stopAt = releaseAt + RELEASE_SECONDS

    try {
      if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') {
        voice.gain.gain.cancelAndHoldAtTime(releaseAt)
      } else {
        voice.gain.gain.cancelScheduledValues(releaseAt)
        voice.gain.gain.setValueAtTime(
          Math.max(MINIMUM_GAIN, voice.gain.gain.value),
          releaseAt,
        )
      }
      voice.gain.gain.exponentialRampToValueAtTime(MINIMUM_GAIN, stopAt)
    } catch {
      // Closing a route can invalidate AudioParams before cleanup reaches them.
    }

    for (const oscillator of voice.oscillators) {
      try {
        oscillator.stop(stopAt + 0.015)
      } catch {
        // A stolen or already-ended voice is safe to ignore.
      }
    }
    return true
  }

  const panic = (atContextTime?: number): void => {
    const active = Array.from(voices.values())
    voices.clear()
    for (const voice of active) {
      releaseVoice(voice, atContextTime ?? voice.graph.context.currentTime)
    }
  }

  const ensureGraph = (context: AudioContext): SynthGraph => {
    if (graph?.context === context) return graph
    if (graph !== null) {
      panic(graph.context.currentTime)
      disconnectGraph(graph)
    }

    const master = context.createGain()
    const limiter = context.createDynamicsCompressor()
    master.gain.value = 0.72
    limiter.threshold.value = -8
    limiter.knee.value = 5
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.16
    master.connect(limiter)
    limiter.connect(context.destination)
    graph = { context, master, limiter }
    return graph
  }

  const noteOff = (id: string, atContextTime?: number): boolean => {
    if (disposed) return false
    const voice = voices.get(id)
    if (voice === undefined) return false
    return releaseVoice(voice, atContextTime ?? voice.graph.context.currentTime)
  }

  return {
    noteOn(note) {
      if (disposed || note.id.trim() === '') return false
      const context = options.getAudioContext()
      if (context === null || context.state === 'closed') return false

      const velocity = clamp(note.velocity, 0, 1)
      if (velocity <= 0) {
        noteOff(note.id, note.atContextTime)
        return false
      }

      const currentGraph = ensureGraph(context)
      const requestedStart = note.atContextTime
      const startAt = Math.max(
        context.currentTime,
        typeof requestedStart === 'number' && Number.isFinite(requestedStart)
          ? requestedStart
          : context.currentTime,
      )
      const existing = voices.get(note.id)
      if (existing !== undefined) {
        voices.delete(note.id)
        releaseVoice(existing, context.currentTime)
      }
      while (voices.size >= maxVoices) {
        const oldest = voices.values().next().value as SynthVoice | undefined
        if (oldest === undefined) break
        voices.delete(oldest.id)
        releaseVoice(oldest, context.currentTime)
      }

      const midi = Math.round(clamp(note.midi, 0, 127))
      const frequency = midiFrequency(midi)
      const peak = strikeGain(velocity, note.softPedalValue ?? 0)
      const voiceGain = context.createGain()
      voiceGain.gain.setValueAtTime(MINIMUM_GAIN, startAt)
      voiceGain.gain.exponentialRampToValueAtTime(peak, startAt + 0.008)
      voiceGain.gain.exponentialRampToValueAtTime(
        Math.max(MINIMUM_GAIN, peak * 0.58),
        startAt + 0.24,
      )
      voiceGain.gain.exponentialRampToValueAtTime(
        Math.max(MINIMUM_GAIN, peak * 0.3),
        startAt + 4,
      )
      voiceGain.connect(currentGraph.master)

      const fundamental = context.createOscillator()
      fundamental.type = 'triangle'
      fundamental.frequency.setValueAtTime(frequency, startAt)
      fundamental.detune.setValueAtTime(-1.5, startAt)

      const overtone = context.createOscillator()
      overtone.type = 'sine'
      overtone.frequency.setValueAtTime(frequency * 2, startAt)
      overtone.detune.setValueAtTime(1.5, startAt)

      const oscillators = [fundamental, overtone]
      const voice: SynthVoice = {
        id: note.id,
        graph: currentGraph,
        gain: voiceGain,
        oscillators,
        releaseAt: null,
      }
      voices.set(note.id, voice)
      fundamental.onended = () => cleanVoice(voice)

      for (const oscillator of oscillators) {
        oscillator.connect(voiceGain)
        oscillator.start(startAt)
      }
      return true
    },

    noteOff,

    panic,

    activeVoiceIds() {
      return Object.freeze(Array.from(voices.keys()))
    },

    dispose() {
      if (disposed) return
      disposed = true
      panic(graph?.context.currentTime)
      disconnectGraph(graph)
      graph = null
    },
  }
}
