// Verifies the selected D2 identity and completed permanent-voice receipt offline.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(root, path), 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const [selection, receipt, enrolled, manifest, rawManifest, batch] =
  await Promise.all([
    readJson('selection.json'),
    readJson('enrollment-receipt.json'),
    readJson('enrolled-voice.json'),
    readJson('../v1/review-manifest.json'),
    readJson('../v1/raw/manifest-d.json'),
    readJson('../v1/batch.json'),
  ])
const raw = await readFile(resolve(root, selection.source.raw_file))
const candidate = manifest.candidates.find(
  (item) => item.id === 'd' && item.selected_take === 'd2',
)
const preview = rawManifest.previews.find((item) => item.take === 'd2')
const direction = batch.directions.find((item) => item.id === 'd')

assert(selection.voice_name === 'Merc V1 Gentle Whimsical D2', 'Name changed.')
assert(selection.source.take === 'd2', 'Take changed.')
assert(selection.regeneration_allowed === false, 'Regeneration was allowed.')
assert(candidate && preview && direction, 'D2 source record is incomplete.')
assert(
  candidate.generated_voice_id === selection.source.generated_voice_id &&
    preview.generated_voice_id === selection.source.generated_voice_id,
  'Generated voice ID mismatch.',
)
assert(
  sha256(raw) === selection.source.raw_sha256 &&
    candidate.source.sha256 === selection.source.raw_sha256 &&
    preview.sha256 === selection.source.raw_sha256,
  'D2 raw hash mismatch.',
)
assert(
  direction.description === selection.source.voice_description &&
    candidate.voice_description === selection.source.voice_description,
  'D voice description mismatch.',
)
assert(receipt.status === 'complete', 'Enrollment receipt is not complete.')
assert(receipt.calls_completed === 0 || receipt.calls_completed === 1, 'Call bound failed.')
assert(receipt.credentials_persisted === false, 'Credential persistence flag failed.')
assert(enrolled.status === 'available', 'Permanent voice is not available.')
assert(
  typeof enrolled.voice_id === 'string' && enrolled.voice_id.length > 0,
  'Permanent voice ID is missing.',
)
assert(
  receipt.permanent_voice.voice_id === enrolled.voice_id,
  'Permanent voice ID mismatch.',
)
assert(enrolled.voice_name === selection.voice_name, 'Permanent name mismatch.')
assert(enrolled.source.take === 'd2', 'Permanent source take mismatch.')
assert(
  enrolled.source.raw_sha256 === selection.source.raw_sha256,
  'Permanent source hash mismatch.',
)
assert(enrolled.runtime_integrated === false, 'Runtime was unexpectedly integrated.')
assert(
  enrolled.production_lines_generated === false,
  'Production lines were unexpectedly generated.',
)

console.log(
  JSON.stringify({
    status: 'complete',
    voice_id: enrolled.voice_id,
    voice_name: enrolled.voice_name,
    source_take: enrolled.source.take,
    source_raw_sha256: enrolled.source.raw_sha256,
    enrollment_mode: enrolled.enrollment_mode,
    enrollment_calls_completed: receipt.calls_completed,
    runtime_integrated: false,
    production_lines_generated: false,
  }),
)
