/**
 * Shared input-level helpers for the mic-insights feature. Every tab derives the
 * same RMS amplitude (0–1) so useMicInsights behaves identically everywhere,
 * whether the tab exposes raw time-domain data or an AnalyserNode.
 */

/** RMS amplitude (0–1) of a time-domain sample buffer. */
export function rmsOfTimeData(data: Float32Array | null | undefined): number {
  if (!data || data.length === 0) return 0
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}

// Reused scratch buffer so the per-frame RMS sampling doesn't allocate ~60×/s.
let scratch: Float32Array | null = null

/** RMS amplitude (0–1) sampled from an AnalyserNode's time-domain data. */
export function rmsOfAnalyser(
  analyser: AnalyserNode | null | undefined,
): number {
  if (!analyser) return 0
  if (scratch === null || scratch.length !== analyser.fftSize) {
    scratch = new Float32Array(analyser.fftSize)
  }
  analyser.getFloatTimeDomainData(scratch as Float32Array<ArrayBuffer>)
  return rmsOfTimeData(scratch)
}
