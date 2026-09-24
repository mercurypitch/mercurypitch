// Reserve every provider request before issuing the bounded Merc audition batch.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const batch = JSON.parse(await readFile(join(root, 'batch.json'), 'utf8'))
const mode = process.argv[2] ?? '--dry-run'
if (!['--dry-run', '--generate'].includes(mode))
  throw new Error('Use --dry-run or --generate.')
if (
  batch.revision !== 'merc-melody-phrases-v6-2026-09-24' ||
  batch.voice_id !== 'B4fBPRmasEsTgd6YlSok' ||
  batch.voice_name !== 'Merc V1 Gentle Whimsical D2' ||
  batch.model_id !== 'eleven_v3' ||
  batch.output_format !== 'pcm_24000' ||
  batch.lines.length !== 6 ||
  new Set(batch.lines.map((line) => line.id)).size !== batch.lines.length
)
  throw new Error('Unexpected Merc audition batch.')

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const writeJson = (file, value, flag = 'w') =>
  writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag })

console.log(
  JSON.stringify({
    revision: batch.revision,
    calls: batch.lines.length,
    characters: batch.lines.reduce((sum, line) => sum + line.text.length, 0),
    generate: mode === '--generate',
  }),
)
if (mode !== '--generate') process.exit(0)

const key = process.env.BESIDECUE_ELEVENLABS_API_KEY
if (!key || key.startsWith('pass://')) throw new Error('Missing injected key.')
const headers = { 'xi-api-key': key, 'Content-Type': 'application/json' }
const voice = await fetch(
  `https://api.elevenlabs.io/v1/voices/${batch.voice_id}`,
  { headers, signal: AbortSignal.timeout(30_000) },
)
if (!voice.ok) throw new Error(`Voice verification HTTP ${voice.status}.`)
const identity = await voice.json()
if (identity.name !== batch.voice_name) throw new Error('Voice name mismatch.')

await mkdir(join(root, 'raw'), { recursive: true })
for (const line of batch.lines) {
  if (!/^[a-z-]+$/.test(line.id)) throw new Error('Unsafe line ID.')
  const receiptPath = join(root, 'raw', `${line.id}.json`)
  const audioPath = join(root, 'raw', `${line.id}.pcm`)
  let previous
  try {
    previous = JSON.parse(await readFile(receiptPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (previous) {
    if (
      previous.status !== 'complete' ||
      previous.text !== line.text ||
      previous.voice_id !== batch.voice_id
    )
      throw new Error(`Inspect prior attempt for ${line.id}; no automatic retry.`)
    const bytes = await readFile(audioPath)
    if (digest(bytes) !== previous.sha256)
      throw new Error(`Stored audio mismatch for ${line.id}.`)
    console.log(JSON.stringify({ id: line.id, status: 'already-complete' }))
    continue
  }

  const request = {
    text: line.text,
    model_id: batch.model_id,
    language_code: 'en',
    voice_settings: batch.voice_settings,
    seed: line.seed,
  }
  const receipt = {
    revision: batch.revision,
    id: line.id,
    phrase_id: line.phrase_id,
    text: line.text,
    voice_id: batch.voice_id,
    request,
    output_format: batch.output_format,
    started_at: new Date().toISOString(),
    status: 'reserved',
  }
  await writeJson(receiptPath, receipt, 'wx')
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${batch.voice_id}?output_format=${batch.output_format}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90_000),
      },
    )
    receipt.http_status = response.status
    receipt.request_id = response.headers.get('request-id')
    receipt.character_cost = response.headers.get('character-cost')
    if (!response.ok) {
      receipt.status = 'rejected'
      const failure = await response.json().catch(() => ({}))
      const detail = failure.detail
      receipt.error =
        typeof detail === 'object' && detail !== null
          ? {
              code: detail.code ?? detail.status,
              message: String(detail.message ?? '').replaceAll(
                key,
                '<redacted>',
              ),
            }
          : {
              message: String(detail ?? 'No error detail').replaceAll(
                key,
                '<redacted>',
              ),
            }
      await writeJson(receiptPath, receipt)
      throw new Error(`Speech HTTP ${response.status}; inspect ${line.id}.`)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 4000 || bytes.length % 2)
      throw new Error('Invalid PCM bytes.')
    await writeFile(audioPath, bytes, { flag: 'wx' })
    receipt.status = 'complete'
    receipt.bytes = bytes.length
    receipt.sha256 = digest(bytes)
    receipt.sample_rate_hz = Number(batch.output_format.split('_')[1])
    receipt.duration_seconds = bytes.length / (receipt.sample_rate_hz * 2)
    receipt.completed_at = new Date().toISOString()
    await writeJson(receiptPath, receipt)
    console.log(
      JSON.stringify({
        id: line.id,
        status: receipt.status,
        seconds: receipt.duration_seconds,
      }),
    )
  } catch (error) {
    if (receipt.status === 'reserved') {
      receipt.status = 'uncertain'
      receipt.error = { name: error.name }
      await writeJson(receiptPath, receipt)
    }
    throw new Error(
      `Generation stopped at ${line.id}; ${error.name}. Inspect receipt before retry.`,
    )
  }
}
