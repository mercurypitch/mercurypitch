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

/** RMS amplitude (0–1) sampled from an AnalyserNode's time-domain data. */
export function rmsOfAnalyser(
  analyser: AnalyserNode | null | undefined,
): number {
  if (!analyser) return 0
  const buf = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(buf)
  return rmsOfTimeData(buf)
}
