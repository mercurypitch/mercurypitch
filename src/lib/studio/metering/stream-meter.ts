// Studio streaming meters — bounded K-weighted windows, exact gated block powers and sample holds.
import { createBiquad, kWeightingCoefficients } from './k-weighting'
import { createTruePeakEstimator } from './true-peak'

export interface StudioMeterOptions {
  sampleRate: number
  channels: 1 | 2
  /** Only raw mono sources need this; the playback graph is already dual mono. */
  dualMono?: boolean
  truePeak?: boolean
  /** Omit for live windows only; finite bound admits exact integrated block storage. */
  maxFrames?: number
}
export interface StudioMeterSnapshot {
  frames: number
  momentaryLufs: number | null
  shortTermLufs: number | null
  peakL: number
  peakR: number
  holdL: number
  holdR: number
  clipL: boolean
  clipR: boolean
}
export interface StudioLoudnessMeasurement {
  integratedLufs: number
  samplePeakDb: number
  truePeakDb: number
}
export const amplitudeToDb = (value: number): number =>
  value > 0 ? 20 * Math.log10(value) : -Infinity
const toLufs = (power: number): number =>
  power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity

export function studioMeterWorkingBytes(options: StudioMeterOptions): number {
  return (
    Math.round(options.sampleRate * 3) * 8 +
    (options.maxFrames === undefined
      ? 0
      : Math.ceil(options.maxFrames / Math.round(options.sampleRate * 0.1)) *
        8) +
    8192
  )
}

export function createStudioMeter(options: StudioMeterOptions) {
  const { sampleRate, channels } = options
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 384000 ||
    (channels !== 1 && channels !== 2) ||
    (options.maxFrames !== undefined &&
      (!Number.isSafeInteger(options.maxFrames) ||
        options.maxFrames < 0 ||
        options.maxFrames > sampleRate * 3600))
  )
    throw new Error(
      'This audio cannot be measured with the supported sample rate or duration.',
    )
  const momentaryFrames = Math.round(sampleRate * 0.4)
  const shortFrames = Math.round(sampleRate * 3)
  const stepFrames = Math.round(sampleRate * 0.1)
  const energyRing = new Float64Array(shortFrames)
  const powers = new Float64Array(
    options.maxFrames === undefined
      ? 0
      : Math.ceil(options.maxFrames / stepFrames),
  )
  const filters = Array.from({ length: channels }, () =>
    kWeightingCoefficients(sampleRate).map(createBiquad),
  )
  const peakFilters =
    options.truePeak === true
      ? Array.from({ length: channels }, createTruePeakEstimator)
      : []
  let frames = 0,
    blockCount = 0,
    momentarySum = 0,
    shortSum = 0,
    totalPower = 0
  const interval = [0, 0],
    holds = [0, 0]
  let sampleMaximum = 0
  let finished = false

  function frameEnergy(input: readonly Float32Array[], frame: number): number {
    let energy = 0
    for (let channel = 0; channel < channels; channel++) {
      const value = input[channel][frame]
      if (!Number.isFinite(value))
        throw new Error('The audio contains invalid samples.')
      const absolute = Math.abs(value)
      interval[channel] = Math.max(interval[channel], absolute)
      holds[channel] = Math.max(holds[channel], absolute)
      sampleMaximum = Math.max(sampleMaximum, absolute)
      peakFilters[channel]?.push(value)
      const weighted = filters[channel][1].push(filters[channel][0].push(value))
      energy += weighted * weighted
    }
    return channels === 1 && options.dualMono === true ? energy * 2 : energy
  }

  function recordEnergy(energy: number): void {
    const cursor = frames % shortFrames
    const oldMomentary =
      frames >= momentaryFrames
        ? energyRing[(frames - momentaryFrames) % shortFrames]
        : 0
    shortSum += energy - energyRing[cursor]
    momentarySum += energy - oldMomentary
    energyRing[cursor] = energy
    totalPower += energy
    frames++
    if (
      powers.length > 0 &&
      frames >= momentaryFrames &&
      (frames - momentaryFrames) % stepFrames === 0
    )
      powers[blockCount++] = Math.max(0, momentarySum) / momentaryFrames
  }

  function push(
    input: readonly Float32Array[],
    from = 0,
    to = input[0]?.length ?? 0,
  ): void {
    if (finished) throw new Error('This measurement is already complete.')
    if (
      input.length !== channels ||
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < from ||
      input.some((channel) => channel.length < to)
    )
      throw new Error(
        'The audio measurement received inconsistent channel data.',
      )
    if (
      options.maxFrames !== undefined &&
      frames + to - from > options.maxFrames
    )
      throw new Error('The audio measurement exceeded its admitted duration.')
    for (let frame = from; frame < to; frame++)
      recordEnergy(frameEnergy(input, frame))
  }

  function integrated(): number {
    if (options.maxFrames === undefined || frames === 0) return -Infinity
    // Preserve source-preparation's short-clip policy; programme gates start at 400 ms.
    if (frames < momentaryFrames)
      return toLufs(totalPower / frames) > -70
        ? toLufs(totalPower / frames)
        : -Infinity
    let sum = 0,
      count = 0
    for (let i = 0; i < blockCount; i++)
      if (toLufs(powers[i]) > -70) {
        sum += powers[i]
        count++
      }
    if (count === 0) return -Infinity
    const gate = Math.max(-70, toLufs(sum / count) - 10)
    sum = 0
    count = 0
    for (let i = 0; i < blockCount; i++)
      if (toLufs(powers[i]) > gate) {
        sum += powers[i]
        count++
      }
    return count > 0 ? toLufs(sum / count) : -Infinity
  }

  return {
    push,
    snapshot(consumePeaks = false): StudioMeterSnapshot {
      const mono = channels === 1 && options.dualMono === true
      const result = {
        frames,
        momentaryLufs:
          frames >= momentaryFrames
            ? toLufs(Math.max(0, momentarySum) / momentaryFrames)
            : null,
        shortTermLufs:
          frames >= shortFrames
            ? toLufs(Math.max(0, shortSum) / shortFrames)
            : null,
        peakL: interval[0],
        peakR: interval[mono ? 0 : 1],
        holdL: holds[0],
        holdR: holds[mono ? 0 : 1],
        clipL: holds[0] >= 1,
        clipR: holds[mono ? 0 : 1] >= 1,
      }
      if (consumePeaks) interval.fill(0)
      return result
    },
    finish(): StudioLoudnessMeasurement {
      finished = true
      const sample = sampleMaximum
      const peak = Math.max(
        sample,
        ...peakFilters.map((filter) => filter.finish()),
      )
      return {
        integratedLufs: integrated(),
        samplePeakDb: amplitudeToDb(sample),
        truePeakDb: amplitudeToDb(peak),
      }
    },
    clearPeakHold() {
      holds.fill(0)
    },
    reset() {
      energyRing.fill(0)
      powers.fill(0)
      interval.fill(0)
      holds.fill(0)
      for (const channel of filters)
        for (const filter of channel) filter.reset()
      for (const filter of peakFilters) filter.reset()
      frames = 0
      blockCount = 0
      momentarySum = 0
      shortSum = 0
      totalPower = 0
      finished = false
      sampleMaximum = 0
    },
  }
}
