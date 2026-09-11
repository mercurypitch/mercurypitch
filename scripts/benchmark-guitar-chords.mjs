// Offline chord candidate benchmark: local PCM, pinned model, no uploads or changes to saved takes.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import * as ort from 'onnxruntime-web/wasm'
import { createServer } from 'vite'

const { values } = parseArgs({
  options: {
    model: { type: 'string' },
    'download-model': { type: 'boolean', default: false },
    audio: { type: 'string' },
    labels: { type: 'string' },
    report: { type: 'string' },
    fixture: { type: 'string' },
  },
})
if (!values.model)
  throw new Error(
    'Supply --model /absolute/path/to/nmp.onnx. Add --download-model only for an explicit pinned-model download.',
  )
if (values.labels && !values.audio) throw new Error('--labels needs --audio.')
if (values.fixture && values.audio)
  throw new Error('Choose --fixture or --audio, not both.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true },
  optimizeDeps: { entries: [], noDiscovery: true },
  resolve: { alias: { '@': path.join(root, 'src') } },
})
let session

function resample(samples, rate) {
  const bytes = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'f32le',
      '-ar',
      String(rate),
      '-ac',
      '1',
      '-i',
      'pipe:0',
      '-f',
      'f32le',
      '-ar',
      '22050',
      '-ac',
      '1',
      'pipe:1',
    ],
    {
      input: Buffer.from(
        samples.buffer,
        samples.byteOffset,
        samples.byteLength,
      ),
      timeout: 30000,
      maxBuffer: 301 * 22050 * 4,
    },
  )
  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
}

async function localFixture() {
  const input = await stat(values.audio)
  if (!input.isFile() || input.size > 256 * 1024 * 1024)
    throw new Error('Choose a local audio file under 256 MiB.')
  const bytes = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      path.resolve(values.audio),
      '-t',
      '301',
      '-f',
      'f32le',
      '-ar',
      '48000',
      '-ac',
      '1',
      'pipe:1',
    ],
    { timeout: 30000, maxBuffer: 302 * 48000 * 4 },
  )
  const samples = new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
  if (samples.length > 300 * 48000)
    throw new Error('Choose a clip no longer than five minutes.')
  let labels = null
  if (values.labels) {
    const info = await stat(values.labels)
    if (!info.isFile() || info.size > 2 * 1024 * 1024)
      throw new Error('Choose a labels JSON file under 2 MiB.')
    labels = JSON.parse(await readFile(values.labels, 'utf8'))
    if (labels === null) throw new Error('Labels must be an object.')
  }
  if (
    labels !== null &&
    (!Array.isArray(labels.notes) ||
      labels.notes.length > 10000 ||
      !Array.isArray(labels.probes) ||
      labels.probes.length > 3000 ||
      (labels.provenance !== undefined &&
        (typeof labels.provenance !== 'string' ||
          labels.provenance.length > 2000)))
  )
    throw new Error(
      'Labels need notes and probes arrays; see docs/guitar-chord-refinement.md.',
    )
  for (const note of labels?.notes ?? []) {
    if (
      !Number.isInteger(note.midi) ||
      note.midi < 0 ||
      note.midi > 127 ||
      !Number.isFinite(note.startSeconds) ||
      !Number.isFinite(note.endSeconds) ||
      note.startSeconds < 0 ||
      note.endSeconds <= note.startSeconds ||
      note.endSeconds > samples.length / 48000
    )
      throw new Error('Invalid truth note.')
  }
  for (const probe of labels?.probes ?? []) {
    if (
      !Number.isFinite(probe.seconds) ||
      probe.seconds < 0 ||
      probe.seconds >= samples.length / 48000 ||
      !Array.isArray(probe.midis) ||
      probe.midis.some(
        (midi) => !Number.isInteger(midi) || midi < 0 || midi > 127,
      ) ||
      new Set(probe.midis).size !== probe.midis.length
    )
      throw new Error('Invalid truth probe.')
    probe.midis.sort((a, b) => a - b)
  }
  return {
    id: 'local-audio',
    sampleRate: 48000,
    samples,
    notes: labels?.notes ?? null,
    probes: labels?.probes ?? [],
    labelProvenance: labels?.provenance ?? null,
    midiAt: null,
    limitation:
      labels === null
        ? 'Unlabelled local audio: note counts are not accuracy measurements.'
        : 'User-supplied truth; not independently audited. Downmixed mono for this offline comparison.',
  }
}

try {
  const { BASIC_PITCH, transcribeBasicPitch } = await server.ssrLoadModule(
    '/src/lib/transcription/basic-pitch-inference.ts',
  )
  const { createGuitarChordFixtures } = await server.ssrLoadModule(
    '/src/lib/guitar/recording-chord-fixtures.ts',
  )
  const { scoreGuitarChordCandidate } = await server.ssrLoadModule(
    '/src/lib/guitar/recording-chord-benchmark.ts',
  )
  const { runGuitarRecordingBenchmark } = await server.ssrLoadModule(
    '/src/lib/guitar/recording-benchmark.ts',
  )
  const { BASIC_PITCH_DECODER_DEFAULTS } = await server.ssrLoadModule(
    '/src/lib/transcription/basic-pitch-decoder.ts',
  )
  let model
  if (values['download-model']) {
    const response = await fetch(BASIC_PITCH.modelUrl, {
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok)
      throw new Error(`Model download failed (${response.status}).`)
    model = Buffer.from(await response.arrayBuffer())
  } else {
    if ((await stat(values.model)).size !== BASIC_PITCH.modelBytes)
      throw new Error('Unexpected model size.')
    model = await readFile(values.model)
  }
  if (
    model.length !== BASIC_PITCH.modelBytes ||
    createHash('sha256').update(model).digest('hex') !== BASIC_PITCH.modelSha256
  )
    throw new Error(
      'Model checksum differs from the audited upstream artifact.',
    )
  if (values['download-model'])
    await writeFile(values.model, model, { flag: 'wx' })
  ort.env.wasm.numThreads = 1
  const loadStarted = performance.now()
  session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
  })
  const loadMs = performance.now() - loadStarted
  const predict = async (samples) => {
    const tensor = new ort.Tensor('float32', samples, [1, 43844, 1])
    let output
    try {
      output = await session.run({ 'serving_default_input_2:0': tensor })
      const notes = output['StatefulPartitionedCall:1']
      const onsets = output['StatefulPartitionedCall:2']
      for (const value of [notes, onsets])
        if (
          !value ||
          value.type !== 'float32' ||
          value.dims.join(',') !== '1,172,88'
        )
          throw new Error('Unexpected model tensor contract.')
      return { notes: notes.data.slice(), onsets: onsets.data.slice() }
    } finally {
      tensor.dispose()
      for (const value of Object.values(output ?? {})) value.dispose()
    }
  }
  const candidates = [
    { id: 'basic-pitch-onset', decoder: { ...BASIC_PITCH_DECODER_DEFAULTS } },
    {
      id: 'basic-pitch-frame-assisted',
      decoder: { ...BASIC_PITCH_DECODER_DEFAULTS, frameStartThreshold: 0.5 },
    },
    {
      id: 'basic-pitch-short-notes',
      decoder: { ...BASIC_PITCH_DECODER_DEFAULTS, minDurationSeconds: 0.055 },
    },
  ]
  const fixtures = values.audio
    ? [await localFixture()]
    : createGuitarChordFixtures().filter(
        (item) => !values.fixture || item.id === values.fixture,
      )
  if (!fixtures.length) throw new Error('Unknown fixture.')
  const results = []
  for (const fixture of fixtures) {
    const baseline = runGuitarRecordingBenchmark(
      fixture,
      { id: 'recorder-yin', analysis: {} },
      2048,
    )
    const baselineNotes = baseline.emittedNotes.map((note) => ({
      midi: note.midi,
      startSeconds: note.startFrame / fixture.sampleRate,
      endSeconds: note.endFrame / fixture.sampleRate,
      confidence: note.clarity,
    }))
    results.push({
      fixture: fixture.id,
      candidate: baseline.candidate,
      processingMs: baseline.processingMs,
      noteCount: baselineNotes.length,
      metrics:
        fixture.notes === null
          ? null
          : scoreGuitarChordCandidate(fixture, baselineNotes),
      notes: baselineNotes,
    })
    const resampleStart = performance.now()
    const samples = resample(fixture.samples, fixture.sampleRate)
    const resampleMs = performance.now() - resampleStart
    for (const candidate of candidates) {
      const result = await transcribeBasicPitch(samples, predict, {
        decoder: candidate.decoder,
        signal: AbortSignal.timeout(120000),
      })
      results.push({
        fixture: fixture.id,
        candidate: candidate.id,
        processingMs: result.processingMs,
        resampleMs,
        audioSeconds: samples.length / 22050,
        windows: result.windows,
        noteCount: result.notes.length,
        metrics:
          fixture.notes === null
            ? null
            : scoreGuitarChordCandidate(fixture, result.notes),
        notes: result.notes,
      })
    }
  }
  const report = {
    schemaVersion: 'guitar-chord-benchmark/1',
    evidenceOrigin: values.audio ? 'local-audio' : 'synthetic-harmonic-strings',
    labelProvenance: fixtures[0].labelProvenance ?? null,
    hardwareValidation: 'not-run',
    model: BASIC_PITCH,
    runtime: {
      version: ort.env.versions.web,
      executionProvider: 'wasm',
      threads: 1,
      loadMs,
    },
    method:
      'Same 48 kHz PCM for baseline; FFmpeg filtered resampling to 22,050 Hz for Basic Pitch. Exact MIDI, one-to-one onsets within 60 ms; sustained exact pitch sets measured at independent labelled probes. Own bounded hysteresis decoder, not upstream Melodia or a claim about stock Basic Pitch quality. No octave folding. Not physical latency.',
    candidates,
    limitations: fixtures.map((f) => ({ fixture: f.id, text: f.limitation })),
    results,
  }
  if (values.report)
    await writeFile(values.report, JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
    })
  console.log(
    JSON.stringify(
      {
        evidenceOrigin: report.evidenceOrigin,
        modelLoadMs: loadMs,
        results: results.map(({ notes: _notes, ...item }) => ({
          ...item,
          metrics: item.metrics && {
            notes: item.metrics.notes,
            exactSets: item.metrics.exactSets,
            totalSets: item.metrics.totalSets,
            falseOctavesAtProbes: item.metrics.falseOctavesAtProbes,
          },
        })),
      },
      null,
      2,
    ),
  )
} finally {
  try {
    await session?.release()
  } finally {
    await server.close()
  }
}
