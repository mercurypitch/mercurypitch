// ============================================================
// Canonical PCM at 16 bits — Save space's copy of a take: exact where the source was 16-bit, else scaled to its own peak
// ============================================================
//
// Save space keeps a take's canonical copy as whole 16-bit steps instead of
// 32-bit floats, in half the room. A step below zero and a step above it are
// kept in the header, and a stored value stands for the 32-bit float it
// multiplies to, as a Float32Array stores it: q * step, rounded once.
//
// A 16-bit WAV at 48 kHz decodes onto such a grid, and the copy then keeps
// exactly the floats the decoder gave, so playback, renders and exports are
// the same as at full quality. Chromium divides a negative sample by 32768
// and multiplies a positive one by the float nearest 1/32767 (every one of
// the 65536 values, measured in Chromium 148, Nov 2026); Firefox divides
// both by 32768. Anything else, an MP3 or a 44.1 kHz or 24-bit file
// resampled on import, is scaled so its loudest sample is 32767 steps: the
// error is then at most half a step, about 98 dB below the take's peak.
import { importCheckpoint } from './import-limits'

/** The size of one step below zero and one above it: a stored value q stands for q times its sign's step. */
export interface Pcm16Steps {
  readonly negative: number
  readonly positive: number
}

const CHUNK_SAMPLES = 65_536
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

/** The grid Chromium decodes a 16-bit WAV onto. */
const ASYMMETRIC: Pcm16Steps = {
  negative: 2 ** -15,
  positive: Math.fround(1 / 32_767),
}
/** The grid Firefox decodes a 16-bit WAV onto. */
const SYMMETRIC: Pcm16Steps = { negative: 2 ** -15, positive: 2 ** -15 }

/** Steps a header may carry: positive 32-bit floats whose largest multiple is still finite. */
export function validPcm16Steps(steps: Pcm16Steps): boolean {
  return [steps.negative, steps.positive].every(
    (step) =>
      step > 0 &&
      Math.fround(step) === step &&
      Number.isFinite(Math.fround(step * 32_768)),
  )
}

/** What a scan has seen: the loudest sample, and which grids every sample lies on. */
interface GridScan {
  peak: number
  asymmetric: boolean
  symmetric: boolean
}

/**
 * Whether `value` is a whole number of 1/32768 steps up to `highest`: where
 * both grids keep a negative sample, and Firefox a positive one. A float
 * times 32768 is exact, so it is whole only for a sample on the grid.
 */
function onBinaryGrid(value: number, highest: number): boolean {
  const steps = value * 32_768
  return steps === Math.round(steps) && steps >= -32_768 && steps <= highest
}

/** Whether `value` is a whole number of Chromium's steps above zero. */
function onChromiumPositive(value: number): boolean {
  const steps = Math.round(value * 32_767)
  return steps <= 32_767 && Math.fround(steps * ASYMMETRIC.positive) === value
}

/** One sample into the scan; one that is not a finite number is refused. */
function scanSample(scan: GridScan, value: number): void {
  if (!Number.isFinite(value))
    throw new Error('This audio contains invalid samples.')
  scan.peak = Math.max(scan.peak, Math.abs(value))
  if (!scan.asymmetric && !scan.symmetric) return
  if (value < 0) {
    if (!onBinaryGrid(value, 0)) scan.asymmetric = scan.symmetric = false
    return
  }
  if (scan.symmetric) scan.symmetric = onBinaryGrid(value, 32_767)
  if (scan.asymmetric) scan.asymmetric = onChromiumPositive(value)
}

/**
 * The steps that keep `channels` at 16 bits: a decoder's 16-bit grid when
 * every sample lies on it, else the loudest sample over 32767 steps. Null
 * when no 16-bit copy can hold them (a peak at the very top of the float
 * range), and the caller keeps 32-bit floats. A sample that is not a finite
 * number is refused, as the 32-bit copy refuses it.
 */
export async function choosePcm16Steps(
  channels: readonly Float32Array[],
  signal?: AbortSignal,
): Promise<Pcm16Steps | null> {
  const scan: GridScan = { peak: 0, asymmetric: true, symmetric: true }
  for (const samples of channels)
    for (let from = 0; from < samples.length; from += CHUNK_SAMPLES) {
      const to = Math.min(samples.length, from + CHUNK_SAMPLES)
      for (let index = from; index < to; index++)
        scanSample(scan, samples[index])
      await importCheckpoint(signal)
    }
  const { asymmetric, symmetric, peak } = scan
  if (asymmetric) return ASYMMETRIC
  if (symmetric) return SYMMETRIC
  const step = Math.fround(peak / 32_767)
  const scaled = { negative: step, positive: step }
  return validPcm16Steps(scaled) ? scaled : null
}

/** `samples` as whole steps, each the nearest, written little-endian from `byteOffset`. */
export async function writePcm16Channel(
  samples: Float32Array,
  steps: Pcm16Steps,
  bytes: ArrayBuffer,
  byteOffset: number,
  signal?: AbortSignal,
): Promise<void> {
  const view = LITTLE_ENDIAN
    ? new Int16Array(bytes, byteOffset, samples.length)
    : null
  const data = new DataView(bytes)
  for (let from = 0; from < samples.length; from += CHUNK_SAMPLES) {
    const to = Math.min(samples.length, from + CHUNK_SAMPLES)
    for (let index = from; index < to; index++) {
      const value = samples[index]
      const step = value < 0 ? steps.negative : steps.positive
      const whole = Math.max(
        -32_768,
        Math.min(32_767, Math.round(value / step)),
      )
      if (view) view[index] = whole
      else data.setInt16(byteOffset + index * 2, whole, true)
    }
    await importCheckpoint(signal)
  }
}

/** The floats `frames` stored steps from `byteOffset` stand for, into `output`. */
export async function readPcm16Channel(
  bytes: ArrayBuffer,
  byteOffset: number,
  frames: number,
  steps: Pcm16Steps,
  output: Float32Array,
  signal?: AbortSignal,
): Promise<void> {
  const { negative, positive } = steps
  const view = LITTLE_ENDIAN ? new Int16Array(bytes, byteOffset, frames) : null
  const data = new DataView(bytes)
  for (let from = 0; from < frames; from += CHUNK_SAMPLES) {
    const to = Math.min(frames, from + CHUNK_SAMPLES)
    for (let index = from; index < to; index++) {
      const whole = view
        ? view[index]
        : data.getInt16(byteOffset + index * 2, true)
      // The product is exact as a double and rounded once on the way into
      // the Float32Array: the same float a 32-bit multiply gives.
      output[index] = whole * (whole < 0 ? negative : positive)
    }
    await importCheckpoint(signal)
  }
}
