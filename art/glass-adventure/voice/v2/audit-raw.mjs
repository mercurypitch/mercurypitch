// Audits every raw v2 preview for integrity, clipping, loudness and independent ASR.

import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const model =
  '/home/maff/.dotfiles/personal/besidecue/assets/voice-auditions/2026-09-05-casting-review/speech-audit-v1/models/ggml-base.en.bin'
const modelSha256 =
  'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002'
const sampleRate = 44100
const batch = JSON.parse(await readFile(join(root, 'batch.json'), 'utf8'))
const receipt = JSON.parse(
  await readFile(join(root, 'generation-receipt.json'), 'utf8'),
)
const expectedText = batch.lines.map((line) => line.text).join(' ')

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

function pcmStats(bytes) {
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
    duration_seconds: round(samples / sampleRate, 3),
    peak_sample: peak,
    peak_dbfs: round(20 * Math.log10(peak / 32768), 2),
    rms_dbfs: round(20 * Math.log10(rms / 32768), 2),
    clipped_samples: clippedSamples,
  }
}

function parseLoudness(stderr) {
  const start = stderr.lastIndexOf('{')
  const end = stderr.lastIndexOf('}')
  if (start < 0 || end <= start)
    throw new Error('ffmpeg did not return loudness JSON.')
  const value = JSON.parse(stderr.slice(start, end + 1))
  return {
    integrated_lufs: Number(value.input_i),
    loudness_range_lu: Number(value.input_lra),
    true_peak_dbfs: Number(value.input_tp),
    threshold_lufs: Number(value.input_thresh),
  }
}

if (receipt.status !== 'complete')
  throw new Error('Generation receipt is not complete.')
if (receipt.revision !== batch.revision)
  throw new Error('Batch and generation receipt revisions do not match.')
if (receipt.calls_completed !== 3 || receipt.previews_generated !== 9)
  throw new Error('Expected three completed calls and nine previews.')

const temporaryRoot = await mkdtemp(join(tmpdir(), 'merc-voice-v2-audit-'))
const takes = []
try {
  for (const direction of batch.directions) {
    const completedDirection = receipt.directions.find(
      (item) => item.direction === direction.id,
    )
    if (
      completedDirection?.status !== 'complete' ||
      completedDirection.previews.length !== 3
    )
      throw new Error(`Direction ${direction.id} is incomplete.`)

    for (const preview of completedDirection.previews) {
      const rawPath = join(root, 'raw', preview.file)
      const rawBytes = await readFile(rawPath)
      if (
        rawBytes.length !== preview.bytes ||
        sha256(rawBytes) !== preview.sha256
      )
        throw new Error(`Raw take ${preview.take} does not match its receipt.`)
      const stats = pcmStats(rawBytes)
      if (
        Math.abs(stats.duration_seconds - preview.provider_duration_seconds) >
        0.001
      )
        throw new Error(`Raw duration mismatch for ${preview.take}.`)

      const wavPath = join(temporaryRoot, `${preview.take}.wav`)
      const asrBase = join(temporaryRoot, `${preview.take}-asr`)
      await run('ffmpeg', [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        's16le',
        '-ar',
        String(sampleRate),
        '-ac',
        '1',
        '-i',
        rawPath,
        '-map_metadata',
        '-1',
        '-c:a',
        'pcm_s16le',
        wavPath,
      ])
      await run('whisper-cli', [
        '-m',
        model,
        '-l',
        'en',
        '-ojf',
        '-of',
        asrBase,
        '-np',
        '-ng',
        wavPath,
      ])
      const asr = JSON.parse(await readFile(`${asrBase}.json`, 'utf8'))
      const transcription = asr.transcription ?? []
      const transcript = transcription
        .map((segment) => segment.text.trim())
        .join(' ')
      const speechTokens = transcription
        .flatMap((segment) => segment.tokens ?? [])
        .filter(
          (token) =>
            typeof token.text === 'string' &&
            !token.text.startsWith('[_') &&
            Number.isFinite(token.p),
        )
      const meanTokenProbability =
        speechTokens.reduce((total, token) => total + token.p, 0) /
        speechTokens.length
      const loudnessRun = await run('ffmpeg', [
        '-hide_banner',
        '-nostats',
        '-f',
        's16le',
        '-ar',
        String(sampleRate),
        '-ac',
        '1',
        '-i',
        rawPath,
        '-af',
        'loudnorm=I=-24:LRA=7:TP=-2:print_format=json',
        '-f',
        'null',
        '-',
      ])

      takes.push({
        direction: direction.id,
        label: direction.label,
        take: preview.take,
        source: {
          file: `raw/${preview.file}`,
          bytes: preview.bytes,
          sha256: preview.sha256,
          generated_voice_id: preview.generated_voice_id,
          media_type: preview.media_type,
          provider_duration_seconds: preview.provider_duration_seconds,
        },
        pcm: stats,
        loudness: parseLoudness(loudnessRun.stderr),
        independent_asr: {
          engine: 'whisper.cpp',
          model: 'base.en',
          model_source:
            '<user-dotfiles>/besidecue/assets/voice-auditions/2026-09-05-casting-review/speech-audit-v1/models/ggml-base.en.bin',
          model_sha256: modelSha256,
          language: asr.result?.language ?? 'en',
          expected_text_supplied: false,
          transcript,
          normalized_exact_match:
            normalizeSpeech(transcript) === normalizeSpeech(expectedText),
          mean_token_probability: round(meanTokenProbability),
          segments: transcription.map((segment) => ({
            start_seconds: round(segment.offsets.from / 1000, 3),
            end_seconds: round(segment.offsets.to / 1000, 3),
            text: segment.text.trim(),
          })),
        },
      })
      console.log(
        JSON.stringify({
          take: preview.take,
          clipped_samples: stats.clipped_samples,
          exact_asr:
            normalizeSpeech(transcript) === normalizeSpeech(expectedText),
          mean_token_probability: round(meanTokenProbability),
        }),
      )
    }
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

const audit = {
  revision: batch.revision,
  audited_at: new Date().toISOString(),
  expected_text: expectedText,
  all_raw_hashes_match: true,
  all_takes_zero_clipping: takes.every(
    (take) => take.pcm.clipped_samples === 0,
  ),
  exact_asr_takes: takes
    .filter((take) => take.independent_asr.normalized_exact_match)
    .map((take) => take.take),
  takes,
}
const outputPath = join(root, 'raw-audit.json')
const temporaryPath = `${outputPath}.tmp`
await writeFile(temporaryPath, `${JSON.stringify(audit, null, 2)}\n`)
await rename(temporaryPath, outputPath)
console.log(
  JSON.stringify({
    status: 'complete',
    takes: takes.length,
    all_takes_zero_clipping: audit.all_takes_zero_clipping,
    exact_asr_takes: audit.exact_asr_takes,
  }),
)
