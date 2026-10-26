// Reproduce the candidate-shortcut underestimate in Studio FX true-peak metering.
// Requires Node with native TypeScript type stripping (verified with Node 25.8.2).
// Usage: node true-peak-repro.mjs [absolute/path/to/loudness.ts] [result.json]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sourcePath = resolve(process.argv[2] ?? './src/lib/studio-fx/loudness.ts')
const { measureLoudness } = await import(pathToFileURL(sourcePath).href)
const sampleRate = 48000
const samples = new Float32Array(sampleRate)
const interval = 1000
const fraction = 0.5
const radius = 8

function interpolationWeight(k) {
  const t = k - fraction
  return (
    (Math.sin(Math.PI * t) / (Math.PI * t)) *
    (0.5 + 0.5 * Math.cos((Math.PI * t) / radius))
  )
}

// Remote sample establishes a global peak of 1. The local reconstruction
// uses only +/-0.7 samples, all below the global -3 dB candidate threshold.
samples[100] = 1
for (let k = -radius + 1; k <= radius; k++) {
  samples[interval + k] = 0.7 * Math.sign(interpolationWeight(k))
}
let localReconstructedPeak = 0
for (let k = -radius + 1; k <= radius; k++) {
  localReconstructedPeak += samples[interval + k] * interpolationWeight(k)
}
const measured = measureLoudness({
  sampleRate,
  numberOfChannels: 1,
  getChannelData: () => samples,
})
const localPeakDb = 20 * Math.log10(Math.abs(localReconstructedPeak))
const result = {
  nodeVersion: process.version,
  sourcePath,
  sampleRate,
  localInterval: interval,
  localFraction: fraction,
  candidateThreshold: Math.pow(10, -3 / 20),
  localAdjacentSampleAmplitude: samples[interval],
  samplePeakDb: measured.samplePeakDb,
  reportedTruePeakDb: measured.truePeakDb,
  uncheckedHalfSamplePeakDb: localPeakDb,
  underestimateDb: localPeakDb - measured.truePeakDb,
  shortcutMissConfirmed: localPeakDb > measured.truePeakDb + 0.01,
  interpretation:
    'Same interpolation kernel at a skipped phase proves the shortcut is not a safe bound. This is not an independent BS.1770 compliance test.',
}
const json = JSON.stringify(result, null, 2) + '\n'
if (process.argv[3])
  writeFileSync(resolve(process.argv[3]), json, { flag: 'wx' })
process.stdout.write(json)
