// ============================================================
// Waveform peak cache — exact min/max range queries without
// rescanning hundreds of raw audio samples per canvas pixel
// ============================================================

export interface WaveformPeakCache {
  blockSize: number
  blockCount: number
  leafCount: number
  minTree: Float32Array
  maxTree: Float32Array
}

export interface WaveformPeakRange {
  min: number
  max: number
}

export const WAVEFORM_PEAK_BLOCK_SIZE = 64

/**
 * Build a segment-tree mipmap over fixed-size audio blocks.
 *
 * Drawing still reads the two partial edge blocks from the source samples, so
 * range results remain exact (and therefore do not reintroduce moiré). Every
 * whole block between those edges is reduced through the tree in O(log n).
 */
export function buildWaveformPeakCache(
  samples: Float32Array,
  blockSize = WAVEFORM_PEAK_BLOCK_SIZE,
): WaveformPeakCache {
  const safeBlockSize =
    Number.isFinite(blockSize) && blockSize > 0
      ? Math.max(1, Math.floor(blockSize))
      : WAVEFORM_PEAK_BLOCK_SIZE
  const blockCount = Math.ceil(samples.length / safeBlockSize)
  let leafCount = 1
  while (leafCount < Math.max(1, blockCount)) leafCount *= 2

  const minTree = new Float32Array(leafCount * 2)
  const maxTree = new Float32Array(leafCount * 2)
  minTree.fill(Number.POSITIVE_INFINITY)
  maxTree.fill(Number.NEGATIVE_INFINITY)

  for (let block = 0; block < blockCount; block++) {
    const start = block * safeBlockSize
    const end = Math.min(start + safeBlockSize, samples.length)
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (let sample = start; sample < end; sample++) {
      const value = samples[sample]
      if (value < min) min = value
      if (value > max) max = value
    }
    minTree[leafCount + block] = min
    maxTree[leafCount + block] = max
  }

  for (let node = leafCount - 1; node > 0; node--) {
    minTree[node] = Math.min(minTree[node * 2], minTree[node * 2 + 1])
    maxTree[node] = Math.max(maxTree[node * 2], maxTree[node * 2 + 1])
  }

  return {
    blockSize: safeBlockSize,
    blockCount,
    leafCount,
    minTree,
    maxTree,
  }
}

function queryWholeBlocks(
  cache: WaveformPeakCache,
  startBlock: number,
  endBlock: number,
  range: WaveformPeakRange,
): void {
  let left = startBlock + cache.leafCount
  let right = endBlock + cache.leafCount

  while (left < right) {
    if ((left & 1) === 1) {
      range.min = Math.min(range.min, cache.minTree[left])
      range.max = Math.max(range.max, cache.maxTree[left])
      left++
    }
    if ((right & 1) === 1) {
      right--
      range.min = Math.min(range.min, cache.minTree[right])
      range.max = Math.max(range.max, cache.maxTree[right])
    }
    left >>= 1
    right >>= 1
  }
}

/** Return the exact min/max over the half-open sample range [start, end). */
export function queryWaveformPeakRange(
  samples: Float32Array,
  cache: WaveformPeakCache,
  start: number,
  end: number,
): WaveformPeakRange {
  const range = {
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  }
  const safeStart = Math.max(0, Math.min(samples.length, Math.floor(start)))
  const safeEnd = Math.max(safeStart, Math.min(samples.length, Math.floor(end)))
  if (safeStart === safeEnd) return { min: 0, max: 0 }

  const { blockSize } = cache
  const firstWholeBlock = Math.ceil(safeStart / blockSize)
  const lastWholeBlock = Math.floor(safeEnd / blockSize)
  const leadingEnd = Math.min(firstWholeBlock * blockSize, safeEnd)

  for (let sample = safeStart; sample < leadingEnd; sample++) {
    const value = samples[sample]
    if (value < range.min) range.min = value
    if (value > range.max) range.max = value
  }

  if (firstWholeBlock < lastWholeBlock) {
    queryWholeBlocks(cache, firstWholeBlock, lastWholeBlock, range)
  }

  const trailingStart = Math.max(lastWholeBlock * blockSize, leadingEnd)
  for (let sample = trailingStart; sample < safeEnd; sample++) {
    const value = samples[sample]
    if (value < range.min) range.min = value
    if (value > range.max) range.max = value
  }

  return Number.isFinite(range.min) ? range : { min: 0, max: 0 }
}
