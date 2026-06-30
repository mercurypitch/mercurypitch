// ============================================================
// Guitar Synthesis — Karplus-Strong physical modeling + bass
// ============================================================

import { NOTE_NAMES } from '@/lib/note-utils'

/**
 * Guitar voice variant.
 * - `acoustic`: warm pluck, body resonance, medium decay
 * - `electric`: bright pluck, longer sustain, overdrive + cab filter
 * - `bass`: dark pluck, thumpy low end
 */
export type GuitarVariant = 'acoustic' | 'electric' | 'bass'

export interface GuitarVoice {
  /** The output gain node — connect this to the main signal chain */
  gain: GainNode
  /** Source nodes — already started internally; caller may schedule stop */
  oscillators: (AudioBufferSourceNode | OscillatorNode)[]
  /** LFOs (always empty — pluck decay is baked into the rendered buffer) */
  lfos: OscillatorNode[]
  lfoGains: GainNode[]
  /** Always true — the Karplus-Strong buffer has its own decay envelope */
  hasCustomEnvelope: true
  /** Cleanup: disconnect all internal nodes */
  dispose(): void
}

// ── Karplus-Strong rendering ────────────────────────────────────

interface PluckParams {
  /** Feedback gain of the string loop (0..1) — controls sustain */
  damping: number
  /** One-pole lowpass coefficient on the excitation (0..1, 1 = bright) */
  brightness: number
  /** Pick position along the string (0..0.5) — comb filter on excitation */
  pickPosition: number
  /** Rendered buffer length in seconds (natural ring-out) */
  decaySeconds: number
  /** Output level applied to the normalized waveform */
  level: number
}

const PLUCK_PARAMS: Record<GuitarVariant, PluckParams> = {
  acoustic: {
    damping: 0.995,
    brightness: 0.6,
    pickPosition: 0.18,
    decaySeconds: 2.2,
    level: 0.6,
  },
  electric: {
    damping: 0.998,
    brightness: 0.85,
    pickPosition: 0.12,
    decaySeconds: 2.8,
    level: 0.45,
  },
  bass: {
    damping: 0.996,
    brightness: 0.3,
    pickPosition: 0.35,
    decaySeconds: 1.8,
    level: 0.7,
  },
}

/**
 * Render a plucked-string waveform using the Karplus-Strong algorithm.
 *
 * A noise burst (lowpass-filtered for pick softness, comb-filtered for
 * pick position) fills a delay line tuned to the fundamental period.
 * Each pass through the loop applies a two-point-average lowpass
 * (high frequencies decay faster, like a real string) scaled by the
 * damping factor. An allpass filter provides fractional-sample tuning
 * so high notes stay in tune despite the integer delay-line length.
 *
 * Exported for tests — production code goes through createGuitarVoice /
 * createBassVoice which wrap this in cached AudioBuffers.
 */
export function renderPluckWaveform(
  sampleRate: number,
  freq: number,
  params: PluckParams,
): Float32Array {
  // Guard against an invalid frequency (0 / NaN / Infinity): otherwise
  // sampleRate/freq is Infinity, N becomes Infinity and `new Float32Array(N)`
  // throws — taking down the whole audio engine for a single bad note. Return
  // a silent buffer of the normal length instead.
  if (!Number.isFinite(freq) || freq <= 0) {
    return new Float32Array(
      Math.max(2, Math.floor(params.decaySeconds * sampleRate)),
    )
  }

  // The averaging lowpass adds 0.5 samples of delay; the allpass adds
  // `frac` more. Solve for the integer delay length N and fraction.
  const exactPeriod = sampleRate / freq - 0.5
  const N = Math.max(2, Math.floor(exactPeriod - 0.001))
  const frac = Math.min(1, Math.max(0.001, exactPeriod - N))
  const apCoeff = (1 - frac) / (1 + frac)

  // --- Excitation: lowpassed noise + pick-position comb ---
  const excitation = new Float32Array(N)
  let lp = 0
  // brightness 1 → no filtering; brightness 0 → heavy lowpass
  const lpCoeff = 1 - params.brightness
  for (let i = 0; i < N; i++) {
    const noise = Math.random() * 2 - 1
    lp += (noise - lp) * (1 - lpCoeff * 0.95)
    excitation[i] = lp
  }
  const pickOffset = Math.max(1, Math.round(N * params.pickPosition))
  const combed = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    combed[i] = excitation[i] - excitation[(i - pickOffset + N) % N] * 0.9
  }

  // --- String loop ---
  const length = Math.max(N * 2, Math.floor(params.decaySeconds * sampleRate))
  const out = new Float32Array(length)
  const delay = combed
  let ptr = 0
  let prev = 0 // damping lowpass state
  let apX1 = 0 // allpass states
  let apY1 = 0
  for (let i = 0; i < length; i++) {
    const cur = delay[ptr]
    out[i] = cur
    // Two-point average lowpass scaled by damping
    const damped = params.damping * 0.5 * (cur + prev)
    prev = cur
    // First-order allpass for fractional-delay tuning
    const apOut = apCoeff * (damped - apY1) + apX1
    apX1 = damped
    apY1 = apOut
    delay[ptr] = apOut
    ptr = (ptr + 1) % N
  }

  // --- Normalize to a consistent level ---
  let peak = 0
  for (let i = 0; i < length; i++) {
    const a = Math.abs(out[i])
    if (a > peak) peak = a
  }
  if (peak > 0) {
    const norm = params.level / peak
    for (let i = 0; i < length; i++) out[i] *= norm
  }
  return out
}

// ── Buffer cache ────────────────────────────────────────────────
// Notes repeat constantly during practice, so cache rendered plucks.
// Keyed by variant + cent-rounded frequency + sample rate.

const MAX_CACHED_BUFFERS = 96
const pluckBufferCache = new Map<string, AudioBuffer>()

function getPluckBuffer(
  ctx: BaseAudioContext,
  freq: number,
  variant: GuitarVariant,
): AudioBuffer {
  const key = `${variant}|${Math.round(freq * 10)}|${ctx.sampleRate}`
  const cached = pluckBufferCache.get(key)
  if (cached) return cached

  const params = PLUCK_PARAMS[variant]
  const data = renderPluckWaveform(ctx.sampleRate, freq, params)
  const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate)
  buffer.getChannelData(0).set(data)

  if (pluckBufferCache.size >= MAX_CACHED_BUFFERS) {
    // Evict the oldest entry (Map preserves insertion order)
    const oldest = pluckBufferCache.keys().next().value
    if (oldest !== undefined) pluckBufferCache.delete(oldest)
  }
  pluckBufferCache.set(key, buffer)
  return buffer
}

/** Clear the rendered pluck cache (e.g., for tests). */
export function clearPluckCache(): void {
  pluckBufferCache.clear()
}

// ── Voice factories ─────────────────────────────────────────────

/** Soft-clipping curve for the electric overdrive WaveShaper. */
function makeDriveCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive)
  }
  return curve
}

function createPluckVoice(
  ctx: BaseAudioContext,
  freq: number,
  variant: GuitarVariant,
): GuitarVoice {
  const now = ctx.currentTime

  const source = ctx.createBufferSource()
  source.buffer = getPluckBuffer(ctx, freq, variant)

  const outputGain = ctx.createGain()
  outputGain.gain.setValueAtTime(1, now)

  const allNodes: AudioNode[] = [outputGain]
  let chainHead: AudioNode = source

  if (variant === 'acoustic') {
    // Body resonance: gentle low-mid bump + rolled-off extreme highs
    const body = ctx.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.setValueAtTime(180, now)
    body.Q.setValueAtTime(1.0, now)
    body.gain.setValueAtTime(3, now)

    const air = ctx.createBiquadFilter()
    air.type = 'lowpass'
    air.frequency.setValueAtTime(7500, now)
    air.Q.setValueAtTime(0.5, now)

    chainHead.connect(body)
    body.connect(air)
    chainHead = air
    allNodes.push(body, air)
  } else if (variant === 'electric') {
    // Overdrive → presence boost → cabinet lowpass
    const drive = ctx.createWaveShaper()
    drive.curve = makeDriveCurve(2.5)
    drive.oversample = '2x'

    const presence = ctx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.setValueAtTime(2800, now)
    presence.Q.setValueAtTime(0.9, now)
    presence.gain.setValueAtTime(4, now)

    const cab = ctx.createBiquadFilter()
    cab.type = 'lowpass'
    cab.frequency.setValueAtTime(5000, now)
    cab.Q.setValueAtTime(0.7, now)

    chainHead.connect(drive)
    drive.connect(presence)
    presence.connect(cab)
    chainHead = cab
    allNodes.push(drive, presence, cab)
  } else {
    // Bass: keep it dark and round
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.setValueAtTime(Math.min(2500, Math.max(600, freq * 8)), now)
    tone.Q.setValueAtTime(0.6, now)

    chainHead.connect(tone)
    chainHead = tone
    allNodes.push(tone)
  }

  chainHead.connect(outputGain)
  source.start(now)

  return {
    gain: outputGain,
    oscillators: [source],
    lfos: [],
    lfoGains: [],
    hasCustomEnvelope: true,
    dispose() {
      try {
        source.stop()
      } catch {
        /* may already be stopped */
      }
      try {
        source.disconnect()
      } catch {
        /* ok */
      }
      for (const node of allNodes) {
        try {
          node.disconnect()
        } catch {
          /* ok */
        }
      }
    },
  }
}

/**
 * Create a Karplus-Strong plucked guitar voice.
 *
 * The pluck rings out for its natural decay regardless of `durationMs` —
 * the engine's note envelope handles early release when needed.
 */
export function createGuitarVoice(
  ctx: BaseAudioContext,
  freq: number,
  _durationMs: number,
  variant: Exclude<GuitarVariant, 'bass'> = 'acoustic',
): GuitarVoice {
  return createPluckVoice(ctx, freq, variant)
}

/**
 * Create a Karplus-Strong bass voice — same string model with a darker
 * excitation and tone filter for a round, thumpy low end.
 */
export function createBassVoice(
  ctx: BaseAudioContext,
  freq: number,
  _durationMs: number,
): GuitarVoice {
  return createPluckVoice(ctx, freq, 'bass')
}

/**
 * Standard guitar tuning frequencies (Hz) — low E to high e.
 */
export const GUITAR_TUNING: Record<string, number> = {
  E2: 82.41,
  A2: 110.0,
  D3: 146.83,
  G3: 196.0,
  B3: 246.94,
  E4: 329.63,
}

/** String names from high to low. */
export const GUITAR_STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'] as const

/**
 * Assign a MIDI note to the best guitar string (minimize fret position).
 * Returns { stringIndex: 0-5, fret: fret number }.
 * String index 0 is the high e string, 5 is the low E string.
 */
export function assignGuitarString(midi: number): {
  stringIndex: number
  fret: number
} {
  const openMidi: Record<number, number> = {
    0: 64, // high e = MIDI 64
    1: 59, // B = MIDI 59
    2: 55, // G = MIDI 55
    3: 50, // D = MIDI 50
    4: 45, // A = MIDI 45
    5: 40, // low E = MIDI 40
  }

  let bestString = 0
  let bestFret = 999

  for (let s = 0; s < 6; s++) {
    const fret = midi - openMidi[s]
    if (fret >= 0 && fret <= 24 && fret < bestFret) {
      bestFret = fret
      bestString = s
    }
  }

  if (bestFret === 999) {
    // Note out of range — clamp onto the nearest extreme string
    if (midi < 40) {
      // Too low: low E string, open
      return { stringIndex: 5, fret: 0 }
    }
    // Too high: high e string, capped at fret 24
    return { stringIndex: 0, fret: Math.min(24, midi - 64) }
  }

  return { stringIndex: bestString, fret: bestFret }
}

/**
 * Convert a melody (array of MIDI + duration items) to guitar notes
 * with optimal string assignments.
 */
export interface GuitarNote {
  id: string
  midi: number
  noteName: string
  stringIndex: number
  fret: number
  startBeat: number
  duration: number
  targetFreq: number
  isBacking?: boolean
  trackId?: string
}

export function melodyToGuitarNotes(
  items: Array<{
    midi: number
    noteName?: string
    startBeat: number
    duration: number
    targetFreq?: number
    id?: string
    /** Explicit fingering (Guitar Pro imports); auto-placed when omitted. */
    stringIndex?: number
    fret?: number
  }>,
): GuitarNote[] {
  return items.map((item, index) => {
    const { stringIndex, fret } =
      item.stringIndex !== undefined && item.fret !== undefined
        ? { stringIndex: item.stringIndex, fret: item.fret }
        : assignGuitarString(item.midi)
    return {
      id: item.id ?? `note-${index}-${item.startBeat}-${item.midi}`,
      midi: item.midi,
      noteName: item.noteName ?? midiToGuitarNoteName(item.midi),
      stringIndex,
      fret,
      startBeat: item.startBeat,
      duration: item.duration,
      targetFreq: item.targetFreq ?? 440 * Math.pow(2, (item.midi - 69) / 12),
    }
  })
}

/** MIDI number to note name (e.g., 60 → "C4"). */
function midiToGuitarNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[midi % 12]}${octave}`
}
