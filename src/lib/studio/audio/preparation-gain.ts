// ============================================================
// Studio source preparation — bounded whole-source BS.1770 analysis
// ============================================================
// The same filters, dual-mono convention and gates as studio-fx/loudness,
// with a 400 ms rolling buffer instead of song-length Float64 intermediates.

import type { PcmAudio } from './import-limits'
import { checkImportCancelled, DEFAULT_STUDIO_IMPORT_LIMITS, importCheckpoint, validatePcmDimensions, } from './import-limits'

export const PREPARATION_ALGORITHM_VERSION = 'bs1770-48k-v1'
export const PREPARATION_ANALYSIS_BYTES = 19200 * 8 + 3001 * 8
const SAMPLE_RATE = 48_000
const BLOCK_FRAMES = 19_200
const STEP_FRAMES = 4_800
const LOUDNESS_OFFSET = -0.691

interface Filter {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  x1: number
  x2: number
  y1: number
  y2: number
}

function createFilter(highShelf: boolean): Filter {
  const f0 = highShelf ? 1681.974450955533 : 38.13547087602444
  const q = highShelf ? 0.7071752369554196 : 0.5003270373238773
  const k = Math.tan((Math.PI * f0) / SAMPLE_RATE)
  const a0 = 1 + k / q + k * k
  const vh = Math.pow(10, 3.999843853973347 / 20)
  const vb = Math.pow(vh, 0.4996667741545416)
  return {
    b0: highShelf ? (vh + (vb * k) / q + k * k) / a0 : 1,
    b1: highShelf ? (2 * (k * k - vh)) / a0 : -2,
    b2: highShelf ? (vh - (vb * k) / q + k * k) / a0 : 1,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

function filterSample(x: number, filter: Filter): number {
  const y =
    filter.b0 * x +
    filter.b1 * filter.x1 +
    filter.b2 * filter.x2 -
    filter.a1 * filter.y1 -
    filter.a2 * filter.y2
  filter.x2 = filter.x1
  filter.x1 = x
  filter.y2 = filter.y1
  filter.y1 = y
  return y
}

function toLufs(power: number): number {
  return power > 0
    ? LOUDNESS_OFFSET + 10 * Math.log10(power)
    : Number.NEGATIVE_INFINITY
}

function preparationChannels(audio: PcmAudio): Float32Array[] {
  validatePcmDimensions(audio, DEFAULT_STUDIO_IMPORT_LIMITS)
  const channels = Array.from(
    { length: audio.numberOfChannels },
    (_, channel) => audio.getChannelData(channel),
  )
  if (channels.some((channel) => channel.length !== audio.length))
    throw new Error('Audio channel lengths do not match')
  return channels
}

interface ChannelFilters {
  shelf: Filter
  highPass: Filter
}

function weightedFramePower(
  channels: readonly Float32Array[],
  filters: readonly ChannelFilters[],
  frame: number,
): number {
  let power = 0
  for (let channel = 0; channel < channels.length; channel++) {
    const sample = channels[channel][frame]
    if (!Number.isFinite(sample))
      throw new Error('This audio contains invalid samples.')
    const weighted = filterSample(
      filterSample(sample, filters[channel].shelf),
      filters[channel].highPass,
    )
    power += weighted * weighted
  }
  return channels.length === 1 ? power * 2 : power
}

function gatedLoudness(powers: readonly number[]): number {
  const absolute = powers.filter((power) => toLufs(power) > -70)
  if (absolute.length === 0) return Number.NEGATIVE_INFINITY
  const average = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length
  const relativeGate = toLufs(average(absolute)) - 10
  const gated = absolute.filter((power) => toLufs(power) > relativeGate)
  return toLufs(average(gated.length === 0 ? absolute : gated))
}

/** Analyse the immutable whole source. Never call this for a trimmed clip. */
export async function measurePreparationLoudness(
  audio: PcmAudio,
  signal?: AbortSignal,
): Promise<number> {
  checkImportCancelled(signal)
  const channels = preparationChannels(audio)
  const filters = channels.map(() => ({
    shelf: createFilter(true),
    highPass: createFilter(false),
  }))
  const window = Math.min(BLOCK_FRAMES, audio.length)
  const ring = new Float64Array(window)
  const powers: number[] = []
  let energy = 0
  for (let from = 0; from < audio.length; from += 65_536) {
    for (
      let frame = from;
      frame < Math.min(audio.length, from + 65_536);
      frame++
    ) {
      const power = weightedFramePower(channels, filters, frame)
      const index = frame % window
      energy += power - ring[index]
      ring[index] = power
      if (frame + 1 >= window && (frame + 1 - window) % STEP_FRAMES === 0) {
        powers.push(Math.max(0, energy / window))
      }
    }
    await importCheckpoint(signal)
  }
  return gatedLoudness(powers)
}

export async function sourcePreparation(
  audio: PcmAudio,
  signal?: AbortSignal,
): Promise<{
  algorithmVersion: typeof PREPARATION_ALGORITHM_VERSION
  gainDb: number
}> {
  const loudness = await measurePreparationLoudness(audio, signal)
  return {
    algorithmVersion: PREPARATION_ALGORITHM_VERSION,
    gainDb: Number.isFinite(loudness)
      ? Math.max(-24, Math.min(36, -18 - loudness))
      : 0,
  }
}
