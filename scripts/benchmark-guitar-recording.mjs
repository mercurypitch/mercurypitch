// Headless same-PCM comparison; stdout contains metrics, never audio or private paths.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({
  options: { 'chunk-frames': { type: 'string', default: '8192' } },
})
const chunkFrames = Number(values['chunk-frames'])
const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true },
  optimizeDeps: { entries: [], noDiscovery: true },
  resolve: { alias: { '@': path.join(root, 'src') } },
})
try {
  const { createGuitarRecordingBenchmarkFixtures } = await server.ssrLoadModule(
    '/src/lib/guitar/recording-benchmark-fixtures.ts',
  )
  const { GUITAR_RECORDING_BENCHMARK_CASES, runGuitarRecordingBenchmark } =
    await server.ssrLoadModule('/src/lib/guitar/recording-benchmark.ts')
  const { guitarPitchConfiguration } = await server.ssrLoadModule(
    '/src/lib/guitar/guitar-pitch-evidence.ts',
  )
  const fixtures = createGuitarRecordingBenchmarkFixtures()
  // Warm each detector before timed results; this is throughput, not startup latency.
  for (const candidate of GUITAR_RECORDING_BENCHMARK_CASES)
    runGuitarRecordingBenchmark(fixtures[0], candidate, chunkFrames)
  const results = fixtures.flatMap((fixture) =>
    GUITAR_RECORDING_BENCHMARK_CASES.map((candidate) =>
      runGuitarRecordingBenchmark(fixture, candidate, chunkFrames),
    ),
  )
  console.log(
    JSON.stringify(
      {
        schemaVersion: 'guitar-recording-benchmark/v1',
        evidenceOrigin: 'synthetic-fixtures',
        hardwareValidation: 'not-run',
        chunkFrames,
        configurations: GUITAR_RECORDING_BENCHMARK_CASES.map((candidate) => ({
          id: candidate.id,
          pitch: guitarPitchConfiguration(
            candidate.analysis.pitchProfile ?? 'recording',
            candidate.analysis.pitchOverrides,
          ),
        })),
        method:
          'Identical 48 kHz PCM; production recorder 4096-sample windows / 1024-sample hop / unchanged note segmentation. Rehearsal detector settings only, not its render-loop cadence or score matcher. Exact MIDI and ordered one-to-one onsets within 60 ms. Timing percentiles cover matched pairs only, using backdated evidence frames, not device or live-display latency. Repeated picks are strongly damped (28 ms decay), not overlapping sustained notes. Contour and chord fixtures have no note-label accuracy claim.',
        results,
      },
      null,
      2,
    ),
  )
} finally {
  await server.close()
}
