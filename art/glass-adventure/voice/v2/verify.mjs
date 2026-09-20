// Verifies the complete v2 audition archive without making provider requests.

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const readJson = async (file) =>
  JSON.parse(await readFile(resolve(root, file), 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const verifyRecord = async (record, label) => {
  const bytes = await readFile(resolve(root, record.file))
  assert(sha256(bytes) === record.sha256, `${label} hash changed.`)
  if (Number.isFinite(record.bytes))
    assert(bytes.length === record.bytes, `${label} byte count changed.`)
}

const [batch, receipt, audit, plan, manifest] = await Promise.all([
  readJson('batch.json'),
  readJson('generation-receipt.json'),
  readJson('raw-audit.json'),
  readJson('review-plan.json'),
  readJson('review-manifest.json'),
])

const revision = 'merc-voice-auditions-v2-2026-09-20'
assert(
  [batch, receipt, audit, plan, manifest].every(
    (value) => value.revision === revision,
  ),
  'Revision mismatch.',
)
assert(receipt.status === 'complete', 'Generation receipt is incomplete.')
assert(receipt.calls_completed === 3, 'Expected exactly three completed calls.')
assert(receipt.previews_generated === 9, 'Expected exactly nine new previews.')
assert(receipt.voice_library_saved === false, 'A voice was unexpectedly saved.')
assert(receipt.cloning_used === false, 'Cloning was unexpectedly used.')
assert(batch.model_id === 'eleven_ttv_v3', 'Unexpected Voice Design model.')
assert(batch.output_format === 'pcm_44100', 'Unexpected source format.')
assert(
  batch.directions.map((item) => item.id).join('') === 'efg',
  'Expected E–G.',
)

const previewIds = new Set()
for (const direction of receipt.directions) {
  assert(
    direction.status === 'complete',
    `Direction ${direction.direction} failed.`,
  )
  assert(
    direction.previews.length === 3,
    `Direction ${direction.direction} is partial.`,
  )
  const request = await readJson(`raw/request-${direction.direction}.json`)
  assert(
    !('quality' in request.parameters),
    'Unsupported quality parameter found.',
  )
  assert(
    request.parameters.model_id === 'eleven_ttv_v3',
    'Request model changed.',
  )
  for (const preview of direction.previews) {
    assert(
      !previewIds.has(preview.generated_voice_id),
      `Duplicate generated voice ID for ${preview.take}.`,
    )
    previewIds.add(preview.generated_voice_id)
    await verifyRecord(
      { ...preview, file: `raw/${preview.file}` },
      `Raw ${preview.take}`,
    )
  }
}
assert(previewIds.size === 9, 'Expected nine unique generated voice IDs.')

assert(audit.all_raw_hashes_match === true, 'Raw audit hash gate failed.')
assert(
  audit.all_takes_zero_clipping === true,
  'Raw audit clipping gate failed.',
)
assert(audit.takes.length === 9, 'Raw audit must cover nine takes.')
assert(
  audit.takes.every(
    (take) =>
      take.pcm.clipped_samples === 0 &&
      take.independent_asr.normalized_exact_match === true,
  ),
  'A raw take failed clipping or exact ASR.',
)

assert(
  plan.selections.map((item) => item.take).join(',') === 'e1,f1,g1',
  'Unexpected review selection.',
)
assert(
  manifest.candidates.map((item) => item.id).join('') === 'defg',
  'Review manifest must contain D–G in order.',
)
assert(
  manifest.candidates.map((item) => item.selected_take).join(',') ===
    'd2,e1,f1,g1',
  'Review manifest takes changed.',
)
assert(
  manifest.benchmark.favorite_baseline === true,
  'D2 lost baseline status.',
)
assert(
  manifest.clipping_found === false,
  'Selected review media contains clipping.',
)
assert(
  manifest.all_selected_transcripts_match === true,
  'A selected review transcript is not exact.',
)

for (const candidate of manifest.candidates) {
  assert(
    candidate.lines.length === 5,
    `${candidate.id} does not have five clips.`,
  )
  assert(candidate.qa.pcm.clipped_samples === 0, `${candidate.id} clips.`)
  assert(
    candidate.qa.independent_asr.normalized_exact_match === true,
    `${candidate.id} ASR is not exact.`,
  )
  await verifyRecord(candidate.source, `${candidate.id} source`)
  await verifyRecord(candidate.reel.wav, `${candidate.id} WAV`)
  await verifyRecord(candidate.reel.mp3, `${candidate.id} MP3`)
  for (const [index, line] of candidate.lines.entries())
    await verifyRecord(line.audition, `${candidate.id} line ${index + 1}`)
}

const rawFiles = await readdir(resolve(root, 'raw'))
assert(
  rawFiles.filter((file) => /^merc-[e-g][1-3]\.pcm$/.test(file)).length === 9,
  'Raw directory does not contain exactly nine E–G PCM takes.',
)
assert(
  rawFiles.every((file) => !/^merc-d/i.test(file)),
  'D benchmark was duplicated into v2 raw media.',
)

console.log(
  JSON.stringify({
    status: 'complete',
    paid_calls: receipt.calls_completed,
    raw_takes: receipt.previews_generated,
    generated_voice_ids: previewIds.size,
    exact_asr_raw_takes: audit.takes.length,
    clipped_samples: 0,
    review_candidates: manifest.candidates.map(
      (candidate) => candidate.selected_take,
    ),
    review_line_clips: manifest.candidates.reduce(
      (total, candidate) => total + candidate.lines.length,
      0,
    ),
    voice_library_saved: false,
  }),
)
