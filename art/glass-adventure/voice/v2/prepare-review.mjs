// Packages selected v2 previews beside the unchanged v1 D2 benchmark.

import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const rawDirectory = join(root, 'raw')
const candidateDirectory = join(root, 'candidates')
const lineDirectory = join(root, 'lines')
const plan = JSON.parse(await readFile(join(root, 'review-plan.json'), 'utf8'))
const batch = JSON.parse(await readFile(join(root, 'batch.json'), 'utf8'))
const receipt = JSON.parse(
  await readFile(join(root, 'generation-receipt.json'), 'utf8'),
)
const audit = JSON.parse(await readFile(join(root, 'raw-audit.json'), 'utf8'))
const benchmarkManifestPath = resolve(root, plan.benchmark.source_manifest)
const benchmarkManifest = JSON.parse(
  await readFile(benchmarkManifestPath, 'utf8'),
)
const benchmarkRoot = dirname(benchmarkManifestPath)

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const round = (value, digits = 6) => Number(value.toFixed(digits))

const run = (command, args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn('rtk', ['proxy', command, ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise({ stdout, stderr })
      else
        reject(new Error(`${command} exited ${code}: ${stderr.slice(-1200)}`))
    })
  })

const writeAtomic = async (path, value) => {
  const temporary = `${path}.tmp`
  await writeFile(temporary, value)
  await rename(temporary, path)
}

const mediaInfo = async (path) => {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_name,sample_rate,channels,bit_rate:format=duration,size',
    '-of',
    'json',
    path,
  ])
  const parsed = JSON.parse(stdout)
  return {
    codec: parsed.streams[0].codec_name,
    sample_rate_hz: Number(parsed.streams[0].sample_rate),
    channels: Number(parsed.streams[0].channels),
    bit_rate_bps: parsed.streams[0].bit_rate
      ? Number(parsed.streams[0].bit_rate)
      : null,
    duration_seconds: round(Number(parsed.format.duration), 3),
    bytes: Number(parsed.format.size),
  }
}

const outputRecord = async (path) => {
  const bytes = await readFile(path)
  return {
    file: relative(root, path),
    sha256: sha256(bytes),
    ...(await mediaInfo(path)),
  }
}

const benchmarkPath = (file) =>
  relative(root, resolve(benchmarkRoot, file)).replaceAll('\\', '/')

async function verifyBenchmarkFile(record) {
  const path = resolve(benchmarkRoot, record.file)
  const bytes = await readFile(path)
  if (sha256(bytes) !== record.sha256)
    throw new Error(`Benchmark file changed: ${record.file}`)
  return { ...record, file: benchmarkPath(record.file) }
}

if (receipt.status !== 'complete')
  throw new Error('Generation receipt is not complete.')
if (
  plan.revision !== batch.revision ||
  plan.revision !== receipt.revision ||
  plan.revision !== audit.revision
)
  throw new Error('Plan, batch, receipt and audit revisions do not match.')
if (plan.selections.length !== 3 || batch.directions.length !== 3)
  throw new Error('Review plan must select E, F and G exactly once.')
if (!audit.all_raw_hashes_match || !audit.all_takes_zero_clipping)
  throw new Error('Raw audit integrity or clipping gate failed.')
if (
  plan.benchmark.direction !== 'd' ||
  plan.benchmark.take !== 'd2' ||
  plan.benchmark.favorite_baseline !== true
)
  throw new Error('Expected D2 as the favorite baseline.')

const benchmark = benchmarkManifest.candidates.find(
  (candidate) =>
    candidate.id === plan.benchmark.direction &&
    candidate.selected_take === plan.benchmark.take,
)
if (!benchmark) throw new Error('D2 benchmark is absent from the v1 manifest.')
if (benchmark.voice_description !== batch.benchmark.description)
  throw new Error('D2 benchmark description changed.')
if (!benchmark.qa.independent_asr.normalized_exact_match)
  throw new Error('D2 benchmark ASR no longer passes.')
if (benchmark.qa.pcm.clipped_samples !== 0)
  throw new Error('D2 benchmark contains clipping.')

const benchmarkCandidate = {
  ...benchmark,
  comparison_role: 'favorite-baseline',
  favorite_baseline: true,
  generated_in_revision: false,
  source_revision: benchmarkManifest.revision,
  source: {
    ...benchmark.source,
    file: benchmarkPath(benchmark.source.file),
  },
  reel: {
    wav: await verifyBenchmarkFile(benchmark.reel.wav),
    mp3: await verifyBenchmarkFile(benchmark.reel.mp3),
  },
  lines: await Promise.all(
    benchmark.lines.map(async (line) => ({
      ...line,
      audition: await verifyBenchmarkFile(line.audition),
    })),
  ),
}

await mkdir(candidateDirectory, { recursive: true })
await mkdir(lineDirectory, { recursive: true })
const newCandidates = []

for (const selection of plan.selections) {
  const direction = batch.directions.find(
    (item) => item.id === selection.direction,
  )
  const completedDirection = receipt.directions.find(
    (item) => item.direction === selection.direction,
  )
  const preview = completedDirection?.previews.find(
    (item) => item.take === selection.take,
  )
  const takeAudit = audit.takes.find((item) => item.take === selection.take)
  if (!direction || !preview || !takeAudit)
    throw new Error(`Missing selected take ${selection.take}.`)
  if (selection.clips.length !== batch.lines.length)
    throw new Error(`Take ${selection.take} must have one clip per line.`)
  if (!takeAudit.independent_asr.normalized_exact_match)
    throw new Error(`Selected take ${selection.take} failed exact ASR.`)
  if (takeAudit.pcm.clipped_samples !== 0)
    throw new Error(`Selected take ${selection.take} contains clipping.`)

  const rawPath = join(rawDirectory, preview.file)
  const rawBytes = await readFile(rawPath)
  if (rawBytes.length !== preview.bytes || sha256(rawBytes) !== preview.sha256)
    throw new Error(`Raw take ${selection.take} does not match its receipt.`)

  let previousEnd = 0
  for (const [index, clip] of selection.clips.entries()) {
    if (
      clip.start < previousEnd ||
      clip.end <= clip.start ||
      clip.end > takeAudit.pcm.duration_seconds + 0.001
    )
      throw new Error(`Invalid clip ${index + 1} for ${selection.take}.`)
    previousEnd = clip.end
  }

  const baseName = `merc-${selection.direction}-${selection.slug}`
  const wavPath = join(candidateDirectory, `${baseName}.wav`)
  const mp3Path = join(candidateDirectory, `${baseName}.mp3`)
  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    plan.sample_format,
    '-ar',
    String(plan.sample_rate_hz),
    '-ac',
    String(plan.channels),
    '-i',
    rawPath,
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-c:a',
    'pcm_s16le',
    wavPath,
  ])
  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    wavPath,
    '-map_metadata',
    '-1',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '160k',
    mp3Path,
  ])

  const lines = []
  for (const [index, line] of batch.lines.entries()) {
    const clip = selection.clips[index]
    const linePath = join(
      lineDirectory,
      `${baseName}-${String(index + 1).padStart(2, '0')}-${line.id}.mp3`,
    )
    await run('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-ss',
      String(clip.start),
      '-t',
      String(clip.end - clip.start),
      '-map_metadata',
      '-1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      linePath,
    ])
    lines.push({
      ...line,
      clip_start_seconds: clip.start,
      clip_end_seconds: clip.end,
      audition: await outputRecord(linePath),
    })
  }

  newCandidates.push({
    id: selection.direction,
    label: direction.label,
    slug: selection.slug,
    summary: selection.summary,
    audition_note: selection.audition_note,
    difference_from_d: direction.difference_from_d,
    comparison_role: 'new-direction',
    favorite_baseline: false,
    generated_in_revision: true,
    selected_take: selection.take,
    generated_voice_id: preview.generated_voice_id,
    voice_description: direction.description,
    source: {
      file: relative(root, rawPath),
      bytes: preview.bytes,
      sha256: preview.sha256,
      media_type: preview.media_type,
      provider_duration_seconds: preview.provider_duration_seconds,
    },
    reel: {
      wav: await outputRecord(wavPath),
      mp3: await outputRecord(mp3Path),
    },
    qa: {
      decoded: true,
      pcm: takeAudit.pcm,
      integrated_lufs: takeAudit.loudness.integrated_lufs,
      loudness_range_lu: takeAudit.loudness.loudness_range_lu,
      true_peak_dbfs: takeAudit.loudness.true_peak_dbfs,
      independent_asr: takeAudit.independent_asr,
    },
    lines,
  })
}

const candidates = [benchmarkCandidate, ...newCandidates]
const manifest = {
  revision: plan.revision,
  prepared_at: new Date().toISOString(),
  purpose: 'Owner comparison only; no voice is enrolled or active in the game.',
  provider: receipt.provider,
  model: receipt.model,
  endpoint: receipt.endpoint,
  source_format: receipt.output_format,
  voice_library_saved: false,
  clipping_found: candidates.some(
    (candidate) => candidate.qa.pcm.clipped_samples !== 0,
  ),
  all_selected_transcripts_match: candidates.every(
    (candidate) => candidate.qa.independent_asr.normalized_exact_match,
  ),
  benchmark: {
    id: 'd',
    selected_take: 'd2',
    favorite_baseline: true,
    source_revision: benchmarkManifest.revision,
  },
  generated_id_retention: receipt.generated_id_retention,
  lines: batch.lines,
  candidates,
}

await writeAtomic(
  join(root, 'review-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
await rm(join(root, 'review-manifest.json.tmp'), { force: true })
const manifestBytes = await readFile(join(root, 'review-manifest.json'))
const localFiles = newCandidates.flatMap((candidate) => [
  candidate.reel.wav.file,
  candidate.reel.mp3.file,
  ...candidate.lines.map((line) => line.audition.file),
])
const totals = await Promise.all(
  localFiles.map(async (file) => (await stat(join(root, file))).size),
)
console.log(
  JSON.stringify({
    status: 'complete',
    candidates: candidates.length,
    benchmark: 'd2',
    new_candidates: newCandidates.map((candidate) => candidate.selected_take),
    line_auditions: candidates.length * batch.lines.length,
    all_selected_transcripts_match: manifest.all_selected_transcripts_match,
    clipping_found: manifest.clipping_found,
    manifest_sha256: sha256(manifestBytes),
    new_output_bytes: totals.reduce((sum, value) => sum + value, 0),
  }),
)
