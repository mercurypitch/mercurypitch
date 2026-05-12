// ============================================================
// Audio Chunker — Chunked overlap-add processing utilities
// Splits long audio into overlapping chunks for ONNX inference
// then recombines with Hanning crossfade overlap-add.
// ============================================================

/** Parameters for chunked overlap-add processing. */
export interface ChunkConfig {
  chunkSize: number // samples per chunk (e.g. 261120)
  trim: number // trim samples at chunk edges (e.g. 3840)
  genSize: number // chunkSize - trim, the stride between chunks
}

/** Default UVR-MDX chunk config matching the ONNX model's 256-frame window. */
export const UVR_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 261120,
  trim: 3840,
  genSize: 253440,
}

/** A [start, end) sample range for one chunk. */
export interface ChunkRange {
  start: number
  end: number
}

/**
 * Compute chunk boundaries for overlap-add processing.
 * @param audioLen  Length of the audio in samples
 * @param config    Chunk parameters
 * @returns Array of sample ranges [start, end)
 */
export function computeChunkRanges(
  audioLen: number,
  config: ChunkConfig,
): ChunkRange[] {
  const { chunkSize, genSize, trim } = config
  // For audio shorter than chunkSize, one chunk covers everything.
  // Otherwise: need enough chunks so that (numChunks-1)*genSize + chunkSize >= audioLen
  const numChunks =
    audioLen <= chunkSize ? 1 : Math.ceil((audioLen - trim) / genSize)
  const totalPadded = (numChunks - 1) * genSize + chunkSize
  const ranges: ChunkRange[] = []

  for (let i = 0; i < numChunks; i++) {
    const start = i * genSize
    const end = Math.min(start + chunkSize, totalPadded)
    ranges.push({ start, end })
  }

  return ranges
}

/**
 * Hanning crossfade window pair for overlapping chunk boundaries.
 * fadeIn ramps 0→1, fadeOut ramps 1→0.
 * @param overlapLen  Length of the overlap region in samples
 */
export function crossfadeWindows(overlapLen: number): {
  fadeIn: Float32Array
  fadeOut: Float32Array
} {
  const fadeIn = new Float32Array(overlapLen)
  const fadeOut = new Float32Array(overlapLen)
  for (let i = 0; i < overlapLen; i++) {
    fadeIn[i] = 0.5 * (1 - Math.cos((Math.PI * (i + 1)) / (overlapLen + 1)))
    fadeOut[i] = 1 - fadeIn[i]
  }
  return { fadeIn, fadeOut }
}

/**
 * Overlap-add chunk outputs into a single contiguous signal.
 * Chunks are placed at config.genSize stride, with Hanning crossfades
 * at the overlap boundaries.
 *
 * @param chunkOutputs  Array of audio chunks (must be in order)
 * @param totalSamples  Final output length in samples
 * @param config        Chunk parameters
 * @returns Overlap-added signal of length totalSamples
 */
export function overlapAdd(
  chunkOutputs: Float32Array[],
  totalSamples: number,
  config: ChunkConfig,
): Float32Array {
  const { genSize, trim } = config
  const accum = new Float32Array(totalSamples)
  const weights = new Float32Array(totalSamples)

  const { fadeIn, fadeOut } = crossfadeWindows(trim)

  for (let ci = 0; ci < chunkOutputs.length; ci++) {
    const chunk = chunkOutputs[ci]
    const start = ci * genSize

    for (let i = 0; i < chunk.length && start + i < totalSamples; i++) {
      const pos = start + i
      let weight = 1

      // Crossfade at chunk boundaries
      if (ci > 0 && i < trim) {
        weight = fadeIn[i]
      }
      if (ci < chunkOutputs.length - 1 && i >= chunk.length - trim) {
        weight = fadeOut[i - (chunk.length - trim)]
      }

      accum[pos] += chunk[i] * weight
      weights[pos] += weight
    }
  }

  // Normalize by weight sum
  const result = new Float32Array(totalSamples)
  for (let i = 0; i < totalSamples; i++) {
    if (weights[i] > 1e-10) {
      result[i] = accum[i] / weights[i]
    }
  }

  return result
}
