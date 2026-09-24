// Feed every decoded delivery asset through the production YIN detector and melody judge.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = dirname(fileURLToPath(import.meta.url))
const REPO = join(ROOT, '..', '..', '..', '..')
const PACKAGE = join(REPO, 'packages', 'glass-game')
const PUBLIC = join(
  REPO,
  'apps',
  'beside-cue',
  'public',
  'games',
  'adventure-voice-v6',
)
const SAMPLE_RATE = Number(process.env.MERC_SAMPLE_RATE ?? 48_000)
if (![24_000, 44_100, 48_000].includes(SAMPLE_RATE))
  throw new Error(`Unsupported verification sample rate: ${SAMPLE_RATE}`)
const WINDOW = 2_048
const HOP = 1_024
const LEAD_SECONDS = 0.12

const vite = await createServer({
  root: PACKAGE,
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
})
const { PitchDetector } = await vite.ssrLoadModule(
  `/@fs/${join(REPO, 'packages', 'pitch-engine', 'src', 'pitch-detector.ts')}`,
)
const { createMelodyJudge } = await vite.ssrLoadModule(
  '/src/core/melody-judge.ts',
)
const { compileMelody } = await vite.ssrLoadModule(
  '/src/core/melody-contour.ts',
)
const { glassMelody } = await vite.ssrLoadModule('/src/content/melodies.ts')
const { MERC_ENCORE_JUDGE_POLICY } = await vite.ssrLoadModule(
  '/src/content/encore-examples.ts',
)

function decode(path) {
  const decoded = spawnSync(
    'rtk',
    [
      'proxy',
      'ffmpeg',
      '-v',
      'error',
      '-i',
      path,
      '-f',
      'f32le',
      '-ar',
      String(SAMPLE_RATE),
      '-ac',
      '1',
      'pipe:1',
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  )
  if (decoded.status !== 0)
    throw new Error(`ffmpeg failed for ${path}: ${decoded.stderr.toString()}`)
  return new Float32Array(
    decoded.stdout.buffer.slice(
      decoded.stdout.byteOffset,
      decoded.stdout.byteOffset + decoded.stdout.byteLength,
    ),
  )
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function detectedFrames(samples, midiOffset = 0) {
  const detector = new PitchDetector({
    sampleRate: SAMPLE_RATE,
    bufferSize: WINDOW,
    algorithm: 'yin',
    minFrequency: 60,
    maxFrequency: 1_600,
    minAmplitude: 0.005,
  })
  const frames = []
  for (
    let start = 0, sequence = 0;
    start + WINDOW <= samples.length;
    start += HOP, sequence++
  ) {
    const result = detector.detect(samples.subarray(start, start + WINDOW))
    const captureSeconds = (start + WINDOW) / SAMPLE_RATE
    frames.push({
      sequence,
      captureSeconds,
      capturedAtMs: captureSeconds * 1_000,
      midi:
        result.frequency > 0
          ? 69 + 12 * Math.log2(result.frequency / 440) + midiOffset
          : null,
      confidence: result.clarity,
    })
  }
  return frames
}

function judgeFrames(contour, frames, trace = null) {
  const judge = createMelodyJudge(contour, MERC_ENCORE_JUDGE_POLICY)
  for (const frame of frames) {
    judge.feed(frame, frame.capturedAtMs)
    if (trace !== null)
      trace.push({
        captureSeconds: frame.captureSeconds,
        midi: frame.midi,
        confidence: frame.confidence,
        usable: frame.midi !== null && frame.confidence >= 0.5,
        ...judge.snapshot(),
      })
  }
  const finalTime = frames.at(-1)?.capturedAtMs ?? 0
  judge.advanceTo(finalTime)
  return judge.snapshot()
}

function evidenceGapReport(frames) {
  const gaps = []
  let previous = null
  for (const frame of frames) {
    if (frame.midi === null || frame.confidence < 0.5) continue
    if (previous !== null) {
      const durationSeconds = frame.captureSeconds - previous.captureSeconds
      if (durationSeconds > 0.1)
        gaps.push({
          fromCaptureSeconds: previous.captureSeconds,
          toCaptureSeconds: frame.captureSeconds,
          durationSeconds,
          skippedDetectorHops: frame.sequence - previous.sequence - 1,
        })
    }
    previous = frame
  }
  return {
    maximumSeconds: Math.max(0, ...gaps.map((gap) => gap.durationSeconds)),
    gaps,
  }
}

function muteContourRange(samples, contour, firstAnchorIndex) {
  const muted = samples.slice()
  const firstAnchor = contour.anchors[firstAnchorIndex]
  const nextAnchor = contour.anchors[firstAnchorIndex + 1]
  const fromSeconds = LEAD_SECONDS + firstAnchor.startSeconds
  const toSeconds =
    LEAD_SECONDS + (nextAnchor?.startSeconds ?? contour.durationSeconds)
  muted.fill(
    0,
    Math.max(0, Math.floor(fromSeconds * SAMPLE_RATE)),
    Math.min(muted.length, Math.ceil(toSeconds * SAMPLE_RATE)),
  )
  return muted
}

const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.json'), 'utf8'))
const requestedVariant = process.env.MERC_VARIANT_FILTER
const files = requestedVariant
  ? manifest.files.filter((file) => file.path.includes(requestedVariant))
  : manifest.files
const results = []
for (const [index, file] of files.entries()) {
  const match =
    /^(first-arc|sunlit-steps|gallery-arch)\/r(\d+)-p(\d+)\.mp3$/.exec(
      file.path,
    )
  if (match === null) throw new Error(`Unexpected variant path: ${file.path}`)
  const [, melodyId, rawRoot, rawPace] = match
  const rootMidi = Number(rawRoot)
  const pace = Number(rawPace) / 100
  const contour = compileMelody(glassMelody(melodyId), { rootMidi, pace })
  const sourcePath = join(PUBLIC, file.path)
  const sourceSha256 = sha256(sourcePath)
  if (sourceSha256 !== file.sha256)
    throw new Error(`Manifest/source hash mismatch for ${file.path}`)
  const samples = decode(sourcePath)
  const frames = detectedFrames(samples)
  const trace = []
  const snapshot = judgeFrames(contour, frames, trace)
  results.push({
    id: `${melodyId}-r${rootMidi}-p${rawPace}`,
    assetPath: file.path,
    bytes: file.bytes,
    sha256: sourceSha256,
    complete: snapshot.complete,
    retryCount: snapshot.retryCount,
    progress: snapshot.progress,
    voicedFrames: frames.filter(
      (frame) => frame.midi !== null && frame.confidence >= 0.5,
    ).length,
    evidenceGaps: evidenceGapReport(frames),
    trace: requestedVariant ? trace : undefined,
  })
  if ((index + 1) % 20 === 0 || index + 1 === files.length)
    console.log(`${index + 1}/${files.length}`)
}

const representative = manifest.files.find((file) =>
  file.path.includes('first-arc/r50-p100'),
)
if (representative === undefined)
  throw new Error('Representative variant missing.')
const representativeSamples = decode(join(PUBLIC, representative.path))
const representativeContour = compileMelody(glassMelody('first-arc'), {
  rootMidi: 50,
  pace: 1,
})
const representativeFrames = detectedFrames(representativeSamples)
const wrongKey = judgeFrames(
  representativeContour,
  representativeFrames.map((frame) => ({
    ...frame,
    midi: frame.midi === null ? null : frame.midi + 2,
  })),
)
const constantFrames = representativeFrames.map((frame, sequence) => ({
  sequence,
  captureSeconds: frame.captureSeconds,
  capturedAtMs: frame.capturedAtMs,
  midi: 50,
  confidence: 0.99,
}))
const constantNote = judgeFrames(representativeContour, constantFrames)
const silence = judgeFrames(
  representativeContour,
  detectedFrames(new Float32Array(representativeSamples.length)),
)
const missingMiddle = judgeFrames(
  representativeContour,
  detectedFrames(
    muteContourRange(representativeSamples, representativeContour, 1),
  ),
)
const missingFinal = judgeFrames(
  representativeContour,
  detectedFrames(
    muteContourRange(
      representativeSamples,
      representativeContour,
      representativeContour.anchors.length - 1,
    ),
  ),
)
const failed = results.filter((result) => !result.complete)
const report = {
  revision: manifest.revision,
  manifestSha256: sha256(join(PUBLIC, 'manifest.json')),
  detector: {
    algorithm: 'production YIN',
    sampleRate: SAMPLE_RATE,
    window: WINDOW,
    hop: HOP,
    minimumFrequency: 60,
    maximumFrequency: 1_600,
    minimumAmplitude: 0.005,
    confidenceFloorAtJudge: 0.5,
  },
  judgePolicy: MERC_ENCORE_JUDGE_POLICY,
  approvedVariantCount: files.length,
  completedVariantCount: results.length - failed.length,
  maximumRetryCount: Math.max(...results.map((result) => result.retryCount)),
  minimumVoicedFrames: Math.min(
    ...results.map((result) => result.voicedFrames),
  ),
  failed,
  negativeControls: {
    twoSemitonesHighCompletes: wrongKey.complete,
    constantRootCompletes: constantNote.complete,
    silenceCompletes: silence.complete,
    missingMiddleAnchorCompletes: missingMiddle.complete,
    missingFinalAnchorCompletes: missingFinal.complete,
  },
  variants: results,
}
writeFileSync(
  join(
    ROOT,
    'analysis',
    `runtime-verification-${
      requestedVariant
        ? requestedVariant.replaceAll(/[^a-z0-9]+/gi, '-')
        : 'full'
    }-sr${SAMPLE_RATE}.json`,
  ),
  `${JSON.stringify(report, null, 2)}\n`,
)
await vite.close()
console.log(
  JSON.stringify(
    {
      approvedVariantCount: report.approvedVariantCount,
      completedVariantCount: report.completedVariantCount,
      maximumRetryCount: report.maximumRetryCount,
      minimumVoicedFrames: report.minimumVoicedFrames,
      failedCount: failed.length,
      negativeControls: report.negativeControls,
    },
    null,
    2,
  ),
)
if (
  failed.length > 0 ||
  report.negativeControls.twoSemitonesHighCompletes ||
  report.negativeControls.constantRootCompletes ||
  report.negativeControls.silenceCompletes ||
  report.negativeControls.missingMiddleAnchorCompletes ||
  report.negativeControls.missingFinalAnchorCompletes
)
  process.exitCode = 1
