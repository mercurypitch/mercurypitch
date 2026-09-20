// Enrolls the owner's exact v1 D2 selection once, with duplicate search and a durable ledger.

import { createHash } from 'node:crypto'
import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2] ?? '--dry-run'
if (!['--dry-run', '--enroll'].includes(mode) || process.argv.length > 3)
  throw new Error('Usage: node enroll.mjs [--dry-run|--enroll]')

const selection = JSON.parse(
  await readFile(resolve(root, 'selection.json'), 'utf8'),
)
const sourceManifest = JSON.parse(
  await readFile(resolve(root, selection.source.manifest), 'utf8'),
)
const rawManifest = JSON.parse(
  await readFile(resolve(root, selection.source.raw_manifest), 'utf8'),
)
const sourceBatch = JSON.parse(
  await readFile(resolve(root, selection.source.batch), 'utf8'),
)
const rawBytes = await readFile(resolve(root, selection.source.raw_file))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const receiptPath = resolve(root, 'enrollment-receipt.json')
const enrolledVoicePath = resolve(root, 'enrolled-voice.json')

const saveJson = (path, value, options = {}) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    ...options,
  })
const saveJsonAtomic = async (path, value) => {
  const temporary = `${path}.tmp`
  await saveJson(temporary, value)
  await rename(temporary, path)
}
const safeMessage = (value, key) =>
  String(value ?? '')
    .replaceAll(key, '[redacted]')
    .slice(0, 300)

function validateSelection() {
  if (selection.revision !== 'merc-voice-selection-v3-2026-09-20')
    throw new Error('Unexpected selection revision.')
  if (selection.voice_name !== 'Merc V1 Gentle Whimsical D2')
    throw new Error('Unexpected permanent voice name.')
  if (
    selection.source.direction !== 'd' ||
    selection.source.take !== 'd2' ||
    selection.regeneration_allowed !== false
  )
    throw new Error('Selection must preserve original D2 without regeneration.')
  if (
    selection.runtime_integration_in_enrollment_scope !== false ||
    selection.production_line_generation_in_enrollment_scope !== false
  )
    throw new Error('Enrollment scope must exclude runtime and line generation.')

  const candidate = sourceManifest.candidates.find(
    (item) => item.id === 'd' && item.selected_take === 'd2',
  )
  const preview = rawManifest.previews.find((item) => item.take === 'd2')
  const direction = sourceBatch.directions.find((item) => item.id === 'd')
  if (!candidate || !preview || !direction)
    throw new Error('Original D2 source records are incomplete.')
  if (
    sourceManifest.revision !== selection.source.audition_revision ||
    rawManifest.revision !== selection.source.audition_revision ||
    sourceBatch.revision !== selection.source.audition_revision
  )
    throw new Error('Original D2 revision mismatch.')
  if (
    candidate.generated_voice_id !== selection.source.generated_voice_id ||
    preview.generated_voice_id !== selection.source.generated_voice_id
  )
    throw new Error('Original D2 generated voice ID mismatch.')
  if (
    candidate.source.sha256 !== selection.source.raw_sha256 ||
    preview.sha256 !== selection.source.raw_sha256 ||
    sha256(rawBytes) !== selection.source.raw_sha256
  )
    throw new Error('Original D2 raw hash mismatch.')
  if (
    candidate.source.bytes !== selection.source.raw_bytes ||
    preview.bytes !== selection.source.raw_bytes ||
    rawBytes.length !== selection.source.raw_bytes
  )
    throw new Error('Original D2 raw byte count mismatch.')
  if (
    candidate.voice_description !== selection.source.voice_description ||
    direction.description !== selection.source.voice_description
  )
    throw new Error('Original D voice description mismatch.')
  if (
    candidate.qa.pcm.clipped_samples !== 0 ||
    !candidate.qa.independent_asr.normalized_exact_match
  )
    throw new Error('Original D2 quality evidence failed.')
}

async function providerError(response, key) {
  let providerStatus = null
  let providerMessage = null
  try {
    const body = await response.json()
    providerStatus =
      typeof body?.detail?.status === 'string' ? body.detail.status : null
    providerMessage =
      typeof body?.detail?.message === 'string'
        ? safeMessage(body.detail.message, key)
        : null
  } catch {
    // The HTTP status is enough if the provider returns no JSON detail.
  }
  return { provider_status: providerStatus, provider_message: providerMessage }
}

async function searchVoices(key, { name, voiceId } = {}) {
  const matches = []
  let nextPageToken = null
  for (let page = 0; page < 5; page += 1) {
    const url = new URL('https://api.elevenlabs.io/v2/voices')
    url.searchParams.set('page_size', '100')
    url.searchParams.set('include_total_count', 'false')
    if (name) {
      url.searchParams.set('search', name)
      url.searchParams.set('voice_type', 'saved')
    }
    if (voiceId) url.searchParams.append('voice_ids', voiceId)
    if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken)
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: { 'xi-api-key': key, Accept: 'application/json' },
    })
    if (!response.ok) {
      const detail = await providerError(response, key)
      const error = new Error(`Voice search failed with HTTP ${response.status}.`)
      error.provider = { http_status: response.status, ...detail }
      throw error
    }
    const body = await response.json()
    if (!Array.isArray(body.voices))
      throw new Error('Voice search returned a malformed response.')
    matches.push(...body.voices)
    if (!body.has_more) return matches
    if (typeof body.next_page_token !== 'string' || !body.next_page_token)
      throw new Error('Voice search pagination token is missing.')
    nextPageToken = body.next_page_token
  }
  throw new Error('Voice search exceeded the bounded five-page scan.')
}

function publicVoiceRecord(voice) {
  return {
    voice_id: voice.voice_id,
    name: voice.name ?? null,
    category: voice.category ?? null,
    description: voice.description ?? null,
    is_owner: voice.is_owner ?? null,
    created_at_unix: voice.created_at_unix ?? null,
  }
}

async function persistAvailableVoice(receipt, voice, enrollmentMode) {
  const now = new Date().toISOString()
  receipt.status = 'complete'
  receipt.completed_at = now
  receipt.enrollment_mode = enrollmentMode
  receipt.permanent_voice = publicVoiceRecord(voice)
  receipt.availability_verified_at = now
  await saveJsonAtomic(receiptPath, receipt)
  await saveJsonAtomic(enrolledVoicePath, {
    revision: selection.revision,
    status: 'available',
    verified_at: now,
    voice_id: voice.voice_id,
    voice_name: selection.voice_name,
    provider_name: voice.name ?? null,
    provider_category: voice.category ?? null,
    provider_description_matches:
      voice.description === selection.source.voice_description,
    source: {
      audition_revision: selection.source.audition_revision,
      direction: 'd',
      take: 'd2',
      generated_voice_id: selection.source.generated_voice_id,
      raw_sha256: selection.source.raw_sha256,
    },
    enrollment_mode: enrollmentMode,
    runtime_integrated: false,
    production_lines_generated: false,
  })
}

validateSelection()
console.log(
  JSON.stringify({
    mode,
    revision: selection.revision,
    voice_name: selection.voice_name,
    source_take: selection.source.take,
    source_raw_sha256: selection.source.raw_sha256,
    calls_planned: mode === '--enroll' ? 1 : 0,
    duplicate_search_required: true,
    regeneration: false,
    runtime_integration: false,
  }),
)
if (mode === '--dry-run') process.exit(0)

try {
  const existingReceipt = JSON.parse(await readFile(receiptPath, 'utf8'))
  if (existingReceipt.status === 'complete') {
    console.log(
      JSON.stringify({
        status: 'already-complete',
        voice_id: existingReceipt.permanent_voice?.voice_id ?? null,
        voice_name: existingReceipt.permanent_voice?.name ?? selection.voice_name,
      }),
    )
    process.exit(0)
  }
  throw new Error(
    `Enrollment ledger already exists with status ${existingReceipt.status}; inspect it without retrying.`,
  )
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const key = process.env.BESIDECUE_ELEVENLABS_API_KEY
if (!key || key.startsWith('pass://'))
  throw new Error('Inject the API key through the password manager.')

let existingVoices
try {
  existingVoices = await searchVoices(key, { name: selection.voice_name })
} catch (error) {
  const summary = {
    status: 'preflight-search-failed-no-enrollment-attempted',
    checked_at: new Date().toISOString(),
    http_status: error.provider?.http_status ?? null,
    provider_status: error.provider?.provider_status ?? null,
    provider_message: error.provider?.provider_message ?? safeMessage(error.message, key),
  }
  await saveJsonAtomic(resolve(root, 'preflight-search.json'), summary)
  throw error
}

const exactNameMatches = existingVoices.filter(
  (voice) => voice.name === selection.voice_name,
)
if (exactNameMatches.length > 1)
  throw new Error('Multiple exact-name voices exist; reconcile before enrollment.')
if (exactNameMatches.length === 1) {
  const existing = exactNameMatches[0]
  if (
    existing.description !== selection.source.voice_description ||
    existing.category !== 'generated' ||
    existing.is_owner === false
  )
    throw new Error(
      'An exact-name voice exists but does not match the selected generated voice metadata.',
    )
  const receipt = {
    revision: selection.revision,
    status: 'reconciling-existing-exact-match',
    started_at: new Date().toISOString(),
    calls_planned: 0,
    calls_completed: 0,
    duplicate_search: {
      endpoint: '/v2/voices',
      exact_name_matches: 1,
    },
    selected_generated_voice_id: selection.source.generated_voice_id,
    selected_raw_sha256: selection.source.raw_sha256,
    credentials_persisted: false,
  }
  await saveJson(receiptPath, receipt, { flag: 'wx' })
  await persistAvailableVoice(receipt, existing, 'reconciled-existing')
  console.log(
    JSON.stringify({
      status: 'complete-existing',
      voice_id: existing.voice_id,
      voice_name: existing.name,
      enrollment_calls_completed: 0,
    }),
  )
  process.exit(0)
}

const requestBody = {
  voice_name: selection.voice_name,
  voice_description: selection.source.voice_description,
  generated_voice_id: selection.source.generated_voice_id,
}
const receipt = {
  revision: selection.revision,
  status: 'reserved-before-enrollment',
  started_at: new Date().toISOString(),
  provider: 'ElevenLabs',
  endpoint: '/v1/text-to-voice',
  calls_planned: 1,
  calls_completed: 0,
  duplicate_search: {
    endpoint: '/v2/voices',
    exact_name_matches: 0,
  },
  request: requestBody,
  selected_raw_sha256: selection.source.raw_sha256,
  source_regenerated: false,
  credentials_persisted: false,
  runtime_integrated: false,
  production_lines_generated: false,
  official_documentation: {
    create:
      'https://elevenlabs.io/docs/api-reference/text-to-voice/create',
    list_voices:
      'https://elevenlabs.io/docs/api-reference/voices/search',
  },
}
await saveJson(receiptPath, receipt, { flag: 'wx' })
receipt.status = 'submitted-outcome-unknown'
receipt.submitted_at = new Date().toISOString()
await saveJsonAtomic(receiptPath, receipt)
console.log(JSON.stringify({ status: 'submitting-single-enrollment-call' }))

try {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
  receipt.http_status = response.status
  receipt.provider_request_id = response.headers.get('request-id')
  if (!response.ok) {
    Object.assign(receipt, await providerError(response, key))
    receipt.status = 'rejected-no-automatic-retry'
    receipt.completed_at = new Date().toISOString()
    await saveJsonAtomic(receiptPath, receipt)
    throw new Error(`Enrollment rejected with HTTP ${response.status}.`)
  }
  const created = await response.json()
  if (typeof created.voice_id !== 'string' || !created.voice_id)
    throw new Error('Enrollment returned no permanent voice ID.')
  receipt.status = 'created-awaiting-read-verification'
  receipt.calls_completed = 1
  receipt.created_voice = publicVoiceRecord(created)
  await saveJsonAtomic(receiptPath, receipt)
  if (created.name != null && created.name !== selection.voice_name)
    throw new Error('Enrollment returned an unexpected voice name.')

  let verified
  try {
    const voices = await searchVoices(key, { voiceId: created.voice_id })
    verified = voices.find((voice) => voice.voice_id === created.voice_id)
  } catch (error) {
    receipt.status = 'created-verification-unavailable-no-retry'
    receipt.verification_error = safeMessage(error.message, key)
    receipt.completed_at = new Date().toISOString()
    await saveJsonAtomic(receiptPath, receipt)
    throw error
  }
  if (!verified)
    throw new Error('Created voice is not yet visible in the voice library.')
  if (verified.name !== selection.voice_name)
    throw new Error('Verified voice has an unexpected name.')
  await persistAvailableVoice(receipt, verified, 'created')
  console.log(
    JSON.stringify({
      status: 'complete',
      voice_id: verified.voice_id,
      voice_name: verified.name,
      category: verified.category ?? null,
      enrollment_calls_completed: 1,
      availability_verified: true,
    }),
  )
} catch (error) {
  if (receipt.status === 'submitted-outcome-unknown') {
    receipt.status = 'uncertain-outcome-no-automatic-retry'
    receipt.error = safeMessage(error.message, key)
    receipt.completed_at = new Date().toISOString()
    await saveJsonAtomic(receiptPath, receipt)
  } else if (receipt.status === 'created-awaiting-read-verification') {
    receipt.status = 'created-validation-failed-no-retry'
    receipt.error = safeMessage(error.message, key)
    receipt.completed_at = new Date().toISOString()
    await saveJsonAtomic(receiptPath, receipt)
  }
  throw error
}
