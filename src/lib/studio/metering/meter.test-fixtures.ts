// Meter reference fixtures — deterministic PCM for independent FFmpeg and chunk-boundary checks.
export function meterTone(
  rate = 48000,
  seconds = 4,
  frequency = 997,
  amplitude = 0.1,
  phase = 0,
): Float32Array {
  return Float32Array.from(
    { length: Math.round(rate * seconds) },
    (_, frame) =>
      amplitude * Math.sin((2 * Math.PI * frequency * frame) / rate + phase),
  )
}

export function adversarialPeak(): Float32Array {
  const data = new Float32Array(48000)
  data[100] = 1
  for (let k = -7; k <= 8; k++) {
    const t = k - 0.5
    const weight =
      (Math.sin(Math.PI * t) / (Math.PI * t)) *
      (0.5 + 0.5 * Math.cos((Math.PI * t) / 8))
    data[1000 + k] = 0.7 * Math.sign(weight)
  }
  return data
}
