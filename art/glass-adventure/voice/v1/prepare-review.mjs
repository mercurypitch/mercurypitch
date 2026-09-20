// Packages selected Merc Voice Design previews into lossless sources and browser auditions.
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
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

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const round = (value, digits = 6) => Number(value.toFixed(digits))
const normalizeSpeech = (value) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()

const run = (command, args) =>
  new Promise((resolve, reject) => {
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
      if (code === 0) resolve({ stdout, stderr })
      else
        reject(new Error(`${command} exited ${code}: ${stderr.slice(-1200)}`))
    })
  })

const writeAtomic = async (path, value) => {
  const temporary = `${path}.tmp`
  await writeFile(temporary, value)
  await rename(temporary, path)
}

const pcmStats = (bytes) => {
  if (bytes.length % 2 !== 0) throw new Error('PCM byte count must be even.')
  let energy = 0
  let peak = 0
  let clippedSamples = 0
  for (let offset = 0; offset < bytes.length; offset += 2) {
    const sample = bytes.readInt16LE(offset)
    const magnitude = Math.abs(sample)
    energy += sample * sample
    peak = Math.max(peak, magnitude)
    if (magnitude >= 32767) clippedSamples += 1
  }
  const samples = bytes.length / 2
  const rms = Math.sqrt(energy / samples)
  return {
    samples,
    duration_seconds: round(samples / plan.sample_rate_hz, 3),
    peak_sample: peak,
    peak_dbfs: round(20 * Math.log10(peak / 32768), 2),
    rms_dbfs: round(20 * Math.log10(rms / 32768), 2),
    clipped_samples: clippedSamples,
  }
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

if (receipt.status !== 'complete')
  throw new Error('Generation receipt is not complete.')
if (plan.revision !== batch.revision || plan.revision !== receipt.revision) {
  throw new Error('Plan, batch and generation receipt revisions do not match.')
}
if (plan.selections.length !== batch.directions.length) {
  throw new Error('Review plan must select one take for every direction.')
}

await mkdir(candidateDirectory, { recursive: true })
await mkdir(lineDirectory, { recursive: true })
const candidates = []

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
  if (!direction || !preview)
    throw new Error(`Missing selected take ${selection.take}.`)
  if (selection.clips.length !== batch.lines.length) {
    throw new Error(`Take ${selection.take} must have one clip range per line.`)
  }

  const rawPath = join(rawDirectory, preview.file)
  const rawBytes = await readFile(rawPath)
  if (
    rawBytes.length !== preview.bytes ||
    sha256(rawBytes) !== preview.sha256
  ) {
    throw new Error(`Raw take ${selection.take} does not match its receipt.`)
  }
  const stats = pcmStats(rawBytes)
  if (
    Math.abs(stats.duration_seconds - preview.provider_duration_seconds) > 0.001
  ) {
    throw new Error(`Raw duration mismatch for ${selection.take}.`)
  }
  if (stats.clipped_samples !== 0)
    throw new Error(`Clipping found in ${selection.take}.`)

  let previousEnd = 0
  for (const [index, clip] of selection.clips.entries()) {
    if (
      clip.start < previousEnd ||
      clip.end <= clip.start ||
      clip.end > stats.duration_seconds + 0.001
    ) {
      throw new Error(`Invalid clip ${index + 1} for ${selection.take}.`)
    }
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

  const expectedText = batch.lines.map((line) => line.text).join(' ')
  candidates.push({
    id: selection.direction,
    label: direction.label,
    slug: selection.slug,
    summary: selection.summary,
    audition_note: selection.audition_note,
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
      pcm: stats,
      integrated_lufs: selection.integrated_lufs,
      loudness_range_lu: selection.loudness_range_lu,
      true_peak_dbfs: selection.true_peak_dbfs,
      independent_asr: {
        ...plan.asr,
        transcript: selection.asr_transcript,
        normalized_exact_match:
          normalizeSpeech(selection.asr_transcript) ===
          normalizeSpeech(expectedText),
        mean_token_probability: selection.asr_mean_token_probability,
      },
    },
    lines,
  })
}

const manifest = {
  revision: plan.revision,
  prepared_at: new Date().toISOString(),
  purpose: 'Owner audition only; no voice is activated in the game.',
  provider: receipt.provider,
  model: receipt.model,
  endpoint: receipt.endpoint,
  source_format: receipt.output_format,
  voice_library_saved: false,
  clipping_found: false,
  all_selected_transcripts_match: candidates.every(
    (candidate) => candidate.qa.independent_asr.normalized_exact_match,
  ),
  canon: [
    'docs/branding/BRAND.md',
    'docs/branding/MASCOT.md',
    'apps/beside-cue/docs/games/glass-3d-art.md#21-visual-hierarchy',
    '<user-dotfiles>/irchiinnuss/native-apps/break-glass/voiceover-plan.md#1-voice-direction',
  ],
  generated_id_retention: receipt.generated_id_retention,
  lines: batch.lines,
  candidates,
}

await writeAtomic(
  join(root, 'review-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
for (const suffix of ['.tmp']) {
  await rm(join(root, `review-manifest.json${suffix}`), { force: true })
}
const manifestBytes = await readFile(join(root, 'review-manifest.json'))
const totals = await Promise.all(
  [
    ...candidates.flatMap((candidate) => [
      candidate.reel.wav.file,
      candidate.reel.mp3.file,
    ]),
    ...candidates.flatMap((candidate) =>
      candidate.lines.map((line) => line.audition.file),
    ),
  ].map(async (file) => (await stat(join(root, file))).size),
)
console.log(
  JSON.stringify({
    status: 'complete',
    candidates: candidates.length,
    line_auditions: candidates.length * batch.lines.length,
    manifest_sha256: sha256(manifestBytes),
    output_bytes: totals.reduce((sum, value) => sum + value, 0),
  }),
)
