// ============================================================
// Loudness — ITU-R BS.1770 integrated loudness, sample and true peak
// ============================================================
//
// The measurement behind "normalize first, then fixed thresholds": every
// track is brought to one reference loudness before its chain, so a quiet
// booth take and a hot mastered stem meet the same compressor and EQ
// thresholds, and the master is gained toward a target by one measured,
// linear move instead of riding the level.
//
// K-weighting coefficients are derived for the buffer's own sample rate (the
// same analog prototypes libebur128 uses), so 44.1 kHz and 48 kHz measure
// alike. Blocks are 400 ms with 75 % overlap, gated at -70 LUFS absolute and
// -10 LU relative. A mono buffer is measured as dual mono, because the Studio
// plays it on both speakers.
//
// True peak is estimated by 4x windowed-sinc interpolation, evaluated only
// around samples within 3 dB of the sample peak; inter-sample overs live
// there, and the rest of the buffer cannot hold one.

export interface LoudnessMeasurement {
  /** Integrated loudness, LUFS; -Infinity for silence. */
  readonly integratedLufs: number
  /** Highest absolute sample, dBFS. */
  readonly samplePeakDb: number
  /** Highest reconstructed peak between samples (4x), dBTP. */
  readonly truePeakDb: number
}

/** Anything with channels of samples: an AudioBuffer, or plain arrays in tests. */
export interface SampledAudio {
  readonly sampleRate: number
  readonly numberOfChannels: number
  getChannelData(channel: number): Float32Array
}

interface Biquad {
  readonly b0: number
  readonly b1: number
  readonly b2: number
  readonly a1: number
  readonly a2: number
}

const BLOCK_SECONDS = 0.4
const STEP_SECONDS = 0.1
const ABSOLUTE_GATE_LUFS = -70
const RELATIVE_GATE_LU = -10
const LOUDNESS_OFFSET = -0.691

/** Stage 1: the head's acoustic effect, a +4 dB high shelf near 1.7 kHz. */
function preFilter(sampleRate: number): Biquad {
  const f0 = 1681.974450955533
  const gainDb = 3.999843853973347
  const q = 0.7071752369554196
  const k = Math.tan((Math.PI * f0) / sampleRate)
  const vh = Math.pow(10, gainDb / 20)
  const vb = Math.pow(vh, 0.4996667741545416)
  const a0 = 1 + k / q + k * k
  return {
    b0: (vh + (vb * k) / q + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / q + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  }
}

/** Stage 2: the revised low-frequency B-curve, a high-pass near 38 Hz. */
function rlbFilter(sampleRate: number): Biquad {
  const f0 = 38.13547087602444
  const q = 0.5003270373238773
  const k = Math.tan((Math.PI * f0) / sampleRate)
  const a0 = 1 + k / q + k * k
  return {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  }
}

function applyBiquad(input: ArrayLike<number>, f: Biquad): Float64Array {
  const output = new Float64Array(input.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i]
    const y = f.b0 * x + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    output[i] = y
  }
  return output
}

/** Running sum of K-weighted squares: block energy is a difference of two. */
function kWeightedEnergy(data: Float32Array, sampleRate: number): Float64Array {
  const weighted = applyBiquad(
    applyBiquad(data, preFilter(sampleRate)),
    rlbFilter(sampleRate),
  )
  const cumulative = new Float64Array(weighted.length + 1)
  for (let i = 0; i < weighted.length; i++) {
    cumulative[i + 1] = cumulative[i] + weighted[i] * weighted[i]
  }
  return cumulative
}

function channelsOf(audio: SampledAudio): Float32Array[] {
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) =>
    audio.getChannelData(c),
  )
  return channels.length === 1 ? [channels[0], channels[0]] : channels
}

/** Mean square of every 400 ms block, summed across channels. */
function blockPowers(audio: SampledAudio): number[] {
  const energies = channelsOf(audio).map((data) =>
    kWeightedEnergy(data, audio.sampleRate),
  )
  const length = energies[0].length - 1
  const blockLength = Math.round(BLOCK_SECONDS * audio.sampleRate)
  const step = Math.round(STEP_SECONDS * audio.sampleRate)
  // A clip shorter than one block is measured as a single block.
  const window = Math.min(blockLength, length)
  if (window === 0) return []
  const powers: number[] = []
  for (let start = 0; start + window <= length; start += step) {
    let power = 0
    for (const energy of energies) {
      power += (energy[start + window] - energy[start]) / window
    }
    powers.push(power)
  }
  return powers
}

const toLufs = (power: number): number =>
  power > 0
    ? LOUDNESS_OFFSET + 10 * Math.log10(power)
    : Number.NEGATIVE_INFINITY

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function integratedLoudness(audio: SampledAudio): number {
  const powers = blockPowers(audio).filter(
    (power) => toLufs(power) > ABSOLUTE_GATE_LUFS,
  )
  if (powers.length === 0) return Number.NEGATIVE_INFINITY
  const relativeGate = toLufs(mean(powers)) + RELATIVE_GATE_LU
  const gated = powers.filter((power) => toLufs(power) > relativeGate)
  return toLufs(mean(gated.length > 0 ? gated : powers))
}

const TAPS_PER_SIDE = 8

/** Windowed sinc (Hann) for a fractional position. */
function interpolate(
  data: Float32Array,
  index: number,
  fraction: number,
): number {
  let sum = 0
  for (let k = -TAPS_PER_SIDE + 1; k <= TAPS_PER_SIDE; k++) {
    const n = index + k
    if (n < 0 || n >= data.length) continue
    const t = k - fraction
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)
    const hann = 0.5 + 0.5 * Math.cos((Math.PI * t) / TAPS_PER_SIDE)
    sum += data[n] * sinc * hann
  }
  return sum
}

function peaks(audio: SampledAudio): { sample: number; truePeak: number } {
  const channels = channelsOf(audio).slice(0, audio.numberOfChannels)
  let sample = 0
  for (const data of channels) {
    for (let i = 0; i < data.length; i++)
      sample = Math.max(sample, Math.abs(data[i]))
  }
  let truePeak = sample
  const candidate = sample * Math.pow(10, -3 / 20)
  for (const data of channels) {
    for (let i = 0; i + 1 < data.length; i++) {
      if (Math.abs(data[i]) < candidate && Math.abs(data[i + 1]) < candidate)
        continue
      for (const fraction of [0.25, 0.5, 0.75]) {
        truePeak = Math.max(truePeak, Math.abs(interpolate(data, i, fraction)))
      }
    }
  }
  return { sample, truePeak }
}

const toDb = (gain: number): number =>
  gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY

export function measureLoudness(audio: SampledAudio): LoudnessMeasurement {
  const { sample, truePeak } = peaks(audio)
  return {
    integratedLufs: integratedLoudness(audio),
    samplePeakDb: toDb(sample),
    truePeakDb: toDb(truePeak),
  }
}
