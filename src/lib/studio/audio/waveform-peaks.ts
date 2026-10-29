// Studio waveform peaks — a pyramid of a take's peaks and loudness, 256 frames a peak and each level eight times coarser.
//
// Built once from canonical PCM (in the Studio audio worker) and stored with
// the take, so opening a song draws from a few hundred kilobytes instead of
// reading, hashing and scanning every sample again. A draw picks the
// coarsest level that still has a peak for every pixel column, so a whole
// song and the closest zoom read about the same number of values.
//
// Values are 16-bit, scaled by the take's loudest sample (at least full
// scale), so a take with overs keeps them and every level costs 6 bytes a
// peak: a 5-minute take is about 390 KB.

export const STUDIO_PEAK_FRAMES = 256
export const STUDIO_PEAK_LEVEL_STEP = 8
export const STUDIO_PEAKS_VERSION = 1
export const STUDIO_PEAKS_MIME = 'application/vnd.mercurypitch.peaks'

const MAGIC = 0x4b50504d // MPPK as little-endian bytes.
const HEADER_BYTES = 88
const SHA_OFFSET = 24
const FULL = 32_767

export interface StudioPeakLevel {
  readonly framesPerPeak: number
  readonly minima: Int16Array
  readonly maxima: Int16Array
  /** Loudness across all channels, drawn inside the peaks. */
  readonly rms: Int16Array
}

export interface StudioPeaks {
  readonly frameCount: number
  /** A stored value times this is a sample value. */
  readonly scale: number
  readonly levels: readonly StudioPeakLevel[]
}

interface FloatLevel {
  framesPerPeak: number
  minima: Float32Array
  maxima: Float32Array
  rms: Float32Array
}

/** One channel's extremes and squared sum into level 0; a sample that is not a finite number is refused. */
function scanChannel(
  samples: Float32Array,
  frameCount: number,
  level: { minima: Float32Array; maxima: Float32Array; squares: Float64Array },
): void {
  const { minima, maxima, squares } = level
  for (let peak = 0; peak < minima.length; peak++) {
    const to = Math.min(frameCount, (peak + 1) * STUDIO_PEAK_FRAMES)
    let low = minima[peak]
    let high = maxima[peak]
    let sum = 0
    for (let frame = peak * STUDIO_PEAK_FRAMES; frame < to; frame++) {
      const value = samples[frame]
      if (!Number.isFinite(value))
        throw new Error('This audio contains invalid samples.')
      if (value < low) low = value
      if (value > high) high = value
      sum += value * value
    }
    minima[peak] = low
    maxima[peak] = high
    squares[peak] += sum
  }
}

/** Level 0, from every channel at once. */
function baseLevel(
  channels: readonly Float32Array[],
  frameCount: number,
): FloatLevel {
  const count = Math.max(1, Math.ceil(frameCount / STUDIO_PEAK_FRAMES))
  const level = {
    minima: new Float32Array(count),
    maxima: new Float32Array(count),
    squares: new Float64Array(count),
  }
  for (const samples of channels) scanChannel(samples, frameCount, level)
  const rms = new Float32Array(count)
  for (let peak = 0; peak < count; peak++) {
    const frames = Math.min(
      STUDIO_PEAK_FRAMES,
      frameCount - peak * STUDIO_PEAK_FRAMES,
    )
    rms[peak] = Math.sqrt(
      level.squares[peak] / Math.max(1, frames * channels.length),
    )
  }
  return {
    framesPerPeak: STUDIO_PEAK_FRAMES,
    minima: level.minima,
    maxima: level.maxima,
    rms,
  }
}

/** The next level up: eight peaks of the one below as one. */
function coarser(level: FloatLevel, frameCount: number): FloatLevel {
  const framesPerPeak = level.framesPerPeak * STUDIO_PEAK_LEVEL_STEP
  const count = Math.max(1, Math.ceil(frameCount / framesPerPeak))
  const minima = new Float32Array(count)
  const maxima = new Float32Array(count)
  const rms = new Float32Array(count)
  for (let peak = 0; peak < count; peak++) {
    const first = peak * STUDIO_PEAK_LEVEL_STEP
    const last = Math.min(level.minima.length, first + STUDIO_PEAK_LEVEL_STEP)
    let low = 0
    let high = 0
    let squares = 0
    let frames = 0
    for (let below = first; below < last; below++) {
      low = Math.min(low, level.minima[below])
      high = Math.max(high, level.maxima[below])
      const span = Math.min(
        level.framesPerPeak,
        frameCount - below * level.framesPerPeak,
      )
      squares += level.rms[below] * level.rms[below] * span
      frames += span
    }
    minima[peak] = low
    maxima[peak] = high
    rms[peak] = Math.sqrt(squares / Math.max(1, frames))
  }
  return { framesPerPeak, minima, maxima, rms }
}

function quantize(values: Float32Array, scale: number): Int16Array {
  const out = new Int16Array(values.length)
  for (let index = 0; index < values.length; index++)
    out[index] = Math.max(
      -FULL,
      Math.min(FULL, Math.round((values[index] / scale) * FULL)),
    )
  return out
}

/** Every level of a take's peaks, from its planar channels. */
export function buildStudioPeaks(
  channels: readonly Float32Array[],
  frameCount: number,
): StudioPeaks {
  const levels: FloatLevel[] = [baseLevel(channels, frameCount)]
  while (levels[levels.length - 1].minima.length > 1)
    levels.push(coarser(levels[levels.length - 1], frameCount))
  let loudest = 1
  for (let peak = 0; peak < levels[0].minima.length; peak++)
    loudest = Math.max(loudest, -levels[0].minima[peak], levels[0].maxima[peak])
  // Stored as a 32-bit float, so values are scaled by exactly what is kept.
  const scale = Math.fround(loudest / FULL)
  const full = scale * FULL
  return {
    frameCount,
    scale,
    levels: levels.map((level) => ({
      framesPerPeak: level.framesPerPeak,
      minima: quantize(level.minima, full),
      maxima: quantize(level.maxima, full),
      rms: quantize(level.rms, full),
    })),
  }
}

/** The stored form: a header naming the take's canonical PCM hash, then each level's values. */
export function encodeStudioPeaks(
  peaks: StudioPeaks,
  canonicalPcmSha256: string,
): ArrayBuffer {
  const counts = peaks.levels.map((level) => level.minima.length)
  const values = counts.reduce((sum, count) => sum + count * 3, 0)
  const bytes = new ArrayBuffer(HEADER_BYTES + counts.length * 4 + values * 2)
  const view = new DataView(bytes)
  view.setUint32(0, MAGIC, true)
  view.setUint16(4, STUDIO_PEAKS_VERSION, true)
  view.setUint16(6, counts.length, true)
  view.setUint32(8, peaks.frameCount, true)
  view.setUint32(12, STUDIO_PEAK_FRAMES, true)
  view.setUint32(16, STUDIO_PEAK_LEVEL_STEP, true)
  view.setFloat32(20, peaks.scale, true)
  for (let index = 0; index < 64; index++)
    view.setUint8(SHA_OFFSET + index, canonicalPcmSha256.charCodeAt(index))
  let offset = HEADER_BYTES
  for (const count of counts) {
    view.setUint32(offset, count, true)
    offset += 4
  }
  for (const level of peaks.levels)
    for (const series of [level.minima, level.maxima, level.rms]) {
      new Int16Array(bytes, offset, series.length).set(series)
      offset += series.length * 2
    }
  return bytes
}

/**
 * Peaks read back for this take, as views over the stored bytes; null when
 * they belong to other audio, another version or are damaged, so the caller
 * builds them again.
 */
export function decodeStudioPeaks(
  bytes: ArrayBuffer,
  expected: { normalizedFrameCount: number; canonicalPcmSha256: string },
): StudioPeaks | null {
  if (bytes.byteLength < HEADER_BYTES) return null
  const view = new DataView(bytes)
  const levelCount = view.getUint16(6, true)
  const frameCount = view.getUint32(8, true)
  const scale = view.getFloat32(20, true)
  if (
    view.getUint32(0, true) !== MAGIC ||
    view.getUint16(4, true) !== STUDIO_PEAKS_VERSION ||
    view.getUint32(12, true) !== STUDIO_PEAK_FRAMES ||
    view.getUint32(16, true) !== STUDIO_PEAK_LEVEL_STEP ||
    frameCount !== expected.normalizedFrameCount ||
    !(scale > 0) ||
    levelCount < 1 ||
    bytes.byteLength < HEADER_BYTES + levelCount * 4
  )
    return null
  for (let index = 0; index < 64; index++)
    if (
      view.getUint8(SHA_OFFSET + index) !==
      expected.canonicalPcmSha256.charCodeAt(index)
    )
      return null
  const levels: StudioPeakLevel[] = []
  let offset = HEADER_BYTES + levelCount * 4
  let framesPerPeak = STUDIO_PEAK_FRAMES
  for (let level = 0; level < levelCount; level++) {
    const count = view.getUint32(HEADER_BYTES + level * 4, true)
    if (
      count !== Math.max(1, Math.ceil(frameCount / framesPerPeak)) ||
      offset + count * 6 > bytes.byteLength
    )
      return null
    const series = () => {
      const values = new Int16Array(bytes, offset, count)
      offset += count * 2
      return values
    }
    levels.push({
      framesPerPeak,
      minima: series(),
      maxima: series(),
      rms: series(),
    })
    framesPerPeak *= STUDIO_PEAK_LEVEL_STEP
  }
  if (offset !== bytes.byteLength) return null
  return { frameCount, scale, levels }
}

/** The coarsest level with at least one peak for every column this many frames wide. */
export function studioPeakLevel(
  peaks: StudioPeaks,
  framesPerColumn: number,
): StudioPeakLevel {
  let chosen = peaks.levels[0]
  for (const level of peaks.levels)
    if (level.framesPerPeak <= framesPerColumn) chosen = level
  return chosen
}

/** The stored size of a take's peaks, before they are built: what a read of them reserves. */
export function studioPeaksByteLength(frameCount: number): number {
  let values = 0
  let levels = 0
  for (
    let framesPerPeak = STUDIO_PEAK_FRAMES;
    ;
    framesPerPeak *= STUDIO_PEAK_LEVEL_STEP
  ) {
    const count = Math.max(1, Math.ceil(frameCount / framesPerPeak))
    values += count * 3
    levels++
    if (count <= 1) break
  }
  return HEADER_BYTES + levels * 4 + values * 2
}
