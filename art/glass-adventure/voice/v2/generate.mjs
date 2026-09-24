// Merc voice audition v2 generator — three bounded Voice Design calls with resumable receipts.
//
// This script creates original designed voices only. It never clones, enrolls,
// deletes or edits a library voice. A request ledger is reserved before each
// paid call, so an interrupted run cannot blindly spend twice.

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const rawRoot = join(root, 'raw')
const mode = process.argv[2] ?? '--dry-run'
if (!['--dry-run', '--generate'].includes(mode) || process.argv.length > 3)
  throw new Error('Usage: node generate.mjs [--dry-run|--generate]')

const batch = JSON.parse(await readFile(join(root, 'batch.json'), 'utf8'))
const script = batch.lines.map((line) => line.text).join('\n\n')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const saveJson = (path, value, options = {}) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    ...options,
  })

function validateBatch() {
  if (batch.revision !== 'merc-voice-auditions-v2-2026-09-20')
    throw new Error('Unexpected revision.')
  if (batch.model_id !== 'eleven_ttv_v3') throw new Error('Unexpected model.')
  if (batch.output_format !== 'pcm_44100')
    throw new Error('Unexpected output format.')
  if (script.length !== 191)
    throw new Error(
      `Expected the unchanged 191-character script, received ${script.length}.`,
    )
  if (batch.lines.length !== 5) throw new Error('Expected five shared lines.')
  if (batch.directions.length !== 3)
    throw new Error('Expected three new directions.')
  if (
    batch.benchmark?.id !== 'd' ||
    batch.benchmark?.take !== 'd2' ||
    batch.benchmark?.favorite_baseline !== true
  )
    throw new Error('Expected D2 as the favorite benchmark.')
  const ids = new Set()
  for (const direction of batch.directions) {
    if (!/^[e-g]$/.test(direction.id) || ids.has(direction.id))
      throw new Error(`Invalid direction ID: ${direction.id}`)
    ids.add(direction.id)
    if (
      typeof direction.description !== 'string' ||
      direction.description.length < 20 ||
      direction.description.length > 1000 ||
      !Number.isInteger(direction.seed)
    )
      throw new Error(`Invalid direction: ${direction.id}`)
  }
}

function audioExtension(bytes, mediaType) {
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF') return 'wav'
  if (
    bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  )
    return 'mp3'
  if (mediaType?.includes('pcm') || batch.output_format.startsWith('pcm_'))
    return 'pcm'
  return 'bin'
}

validateBatch()
await mkdir(rawRoot, { recursive: true })
console.log(
  JSON.stringify({
    mode,
    revision: batch.revision,
    requests: batch.directions.length,
    previews_expected_per_request: 3,
    preview_text_characters_per_request: script.length,
    total_billable_preview_text_characters:
      script.length * batch.directions.length,
    model: batch.model_id,
    output_format: batch.output_format,
    benchmark: `${batch.benchmark.id}${batch.benchmark.take.slice(-1)}`,
    library_enrollment: false,
  }),
)
if (mode === '--dry-run') process.exit(0)

const key = process.env.BESIDECUE_ELEVENLABS_API_KEY
if (!key || key.startsWith('pass://'))
  throw new Error('Inject the API key through pass-cli run.')

const batchReceiptPath = join(root, 'generation-receipt.json')
try {
  await access(batchReceiptPath)
  throw new Error(
    'A generation receipt already exists; inspect it instead of rerunning.',
  )
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const receipt = {
  revision: batch.revision,
  status: 'started',
  started_at: new Date().toISOString(),
  provider: batch.provider,
  endpoint: batch.endpoint,
  model: batch.model_id,
  output_format: batch.output_format,
  request_settings: {
    loudness: batch.loudness,
    guidance_scale: batch.guidance_scale,
    should_enhance: batch.should_enhance,
    auto_generate_text: batch.auto_generate_text,
  },
  preview_text: script,
  preview_text_characters_per_request: script.length,
  calls_planned: 3,
  previews_expected: 9,
  benchmark: {
    id: batch.benchmark.id,
    take: batch.benchmark.take,
    generated_in_this_revision: false,
    source_manifest: batch.benchmark.manifest,
  },
  voice_library_saved: false,
  cloning_used: false,
  subscription_check_skipped:
    'Known key lacks user_read; generation scope was already proven by v1.',
  official_documentation: {
    design: 'https://elevenlabs.io/docs/api-reference/text-to-voice/design',
    save_selected:
      'https://elevenlabs.io/docs/api-reference/text-to-voice/create',
  },
  generated_id_retention: {
    documented_expiry: null,
    note: 'Official Voice Design and create-voice docs reviewed 2026-09-20 explain how to save a generated_voice_id but state no validity or retention period. Preserve audio and IDs, then save the selected voice promptly.',
  },
  directions: [],
}
await saveJson(batchReceiptPath, receipt, { flag: 'wx' })

for (const direction of batch.directions) {
  const ledgerPath = join(rawRoot, `manifest-${direction.id}.json`)
  try {
    await access(ledgerPath)
    throw new Error(
      `Direction ${direction.id} already has a ledger; inspect it instead of retrying.`,
    )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const parameters = {
    voice_description: direction.description,
    text: script,
    model_id: batch.model_id,
    loudness: batch.loudness,
    guidance_scale: batch.guidance_scale,
    should_enhance: batch.should_enhance,
    auto_generate_text: batch.auto_generate_text,
    seed: direction.seed,
  }
  await saveJson(join(rawRoot, `request-${direction.id}.json`), {
    revision: batch.revision,
    direction: direction.id,
    label: direction.label,
    difference_from_d: direction.difference_from_d,
    endpoint: batch.endpoint,
    query: { output_format: batch.output_format },
    parameters,
  })
  const ledger = {
    revision: batch.revision,
    direction: direction.id,
    label: direction.label,
    status: 'submitted-outcome-unknown',
    started_at: new Date().toISOString(),
    model: batch.model_id,
    output_format: batch.output_format,
    seed: direction.seed,
    voice_library_saved: false,
    previews: [],
  }
  await saveJson(ledgerPath, ledger, { flag: 'wx' })
  console.log(JSON.stringify({ direction: direction.id, status: 'submitting' }))

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-voice/design?output_format=${encodeURIComponent(batch.output_format)}`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(240000),
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parameters),
      },
    )
    ledger.http_status = response.status
    ledger.provider_request_id = response.headers.get('request-id')
    ledger.provider_character_cost = response.headers.get('character-cost')
    if (!response.ok) {
      let providerStatus = null
      let providerMessage = null
      try {
        const body = await response.json()
        providerStatus =
          typeof body?.detail?.status === 'string' ? body.detail.status : null
        providerMessage =
          typeof body?.detail?.message === 'string'
            ? body.detail.message.replaceAll(key, '[redacted]').slice(0, 300)
            : null
      } catch {
        // A status code is sufficient when the provider has no JSON detail.
      }
      ledger.provider_status = providerStatus
      ledger.provider_message = providerMessage
      ledger.status = 'rejected-no-automatic-retry'
      ledger.completed_at = new Date().toISOString()
      await saveJson(ledgerPath, ledger)
      receipt.directions.push(ledger)
      receipt.status = 'stopped-after-rejection'
      await saveJson(batchReceiptPath, receipt)
      throw new Error(
        `Provider rejected direction ${direction.id} with HTTP ${response.status}.`,
      )
    }

    const body = await response.json()
    if (!Array.isArray(body.previews) || body.previews.length === 0)
      throw new Error('Provider returned no previews.')
    ledger.returned_text_matches = body.text === script
    ledger.previews_returned = body.previews.length
    for (const [index, preview] of body.previews.entries()) {
      if (
        typeof preview.audio_base_64 !== 'string' ||
        typeof preview.generated_voice_id !== 'string'
      )
        throw new Error(`Provider returned malformed preview ${index + 1}.`)
      const bytes = Buffer.from(preview.audio_base_64, 'base64')
      if (bytes.length < 1000)
        throw new Error(`Provider returned truncated preview ${index + 1}.`)
      const take = `${direction.id}${index + 1}`
      const extension = audioExtension(bytes, preview.media_type)
      const file = `merc-${take}.${extension}`
      await writeFile(join(rawRoot, file), bytes, { flag: 'wx' })
      ledger.previews.push({
        take,
        file,
        generated_voice_id: preview.generated_voice_id,
        media_type: preview.media_type,
        language: preview.language,
        provider_duration_seconds: preview.duration_secs,
        bytes: bytes.length,
        sha256: sha256(bytes),
      })
      await saveJson(ledgerPath, ledger)
    }
    if (ledger.previews.length !== 3) {
      ledger.status = 'partial-provider-result-no-automatic-retry'
      ledger.completed_at = new Date().toISOString()
      await saveJson(ledgerPath, ledger)
      receipt.directions.push(ledger)
      receipt.status = 'stopped-after-partial-result'
      await saveJson(batchReceiptPath, receipt)
      throw new Error(
        `Provider returned ${ledger.previews.length} previews for direction ${direction.id}; preserved all results and stopped.`,
      )
    }
    ledger.status = 'complete'
    ledger.completed_at = new Date().toISOString()
    await saveJson(ledgerPath, ledger)
    receipt.directions.push(ledger)
    await saveJson(batchReceiptPath, receipt)
    console.log(
      JSON.stringify({
        direction: direction.id,
        status: ledger.status,
        previews: ledger.previews.length,
        returned_text_matches: ledger.returned_text_matches,
      }),
    )
  } catch (error) {
    if (ledger.status === 'submitted-outcome-unknown') {
      ledger.status =
        ledger.previews.length > 0
          ? 'uncertain-partial-preserved-no-automatic-retry'
          : 'uncertain-outcome-no-automatic-retry'
      ledger.error = String(error?.message ?? error)
        .replaceAll(key, '[redacted]')
        .slice(0, 300)
      ledger.completed_at = new Date().toISOString()
      await saveJson(ledgerPath, ledger)
      receipt.directions.push(ledger)
      receipt.status = 'stopped-after-uncertain-outcome'
      await saveJson(batchReceiptPath, receipt)
    }
    throw error
  }
}

receipt.status = 'complete'
receipt.completed_at = new Date().toISOString()
receipt.calls_completed = receipt.directions.filter(
  (direction) => direction.status === 'complete',
).length
receipt.previews_generated = receipt.directions.reduce(
  (total, direction) => total + direction.previews.length,
  0,
)
await saveJson(batchReceiptPath, receipt)
console.log(
  JSON.stringify({
    status: receipt.status,
    calls_completed: receipt.calls_completed,
    previews_generated: receipt.previews_generated,
  }),
)
