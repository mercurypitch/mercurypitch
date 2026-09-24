// Merc encore auditions — bounded D2 singing generation with durable per-line receipts.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const batch = JSON.parse(await readFile(join(root, 'batch.json'), 'utf8'))
const generate = process.argv[2] === '--generate'
if (!['--dry-run', '--generate'].includes(process.argv[2] ?? '--dry-run'))
  throw new Error('Use --dry-run or --generate.')
if (batch.voice_id !== 'B4fBPRmasEsTgd6YlSok' || batch.lines.length !== 4)
  throw new Error('Unexpected approved voice or line count.')
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = (file, value, flag = 'w') =>
  writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag })
console.log(
  JSON.stringify({
    revision: batch.revision,
    lines: batch.lines.length,
    characters: batch.lines.reduce((sum, line) => sum + line.text.length, 0),
    generate,
  }),
)
if (!generate) process.exit(0)
const key = process.env.BESIDECUE_ELEVENLABS_API_KEY
if (!key || key.startsWith('pass://')) throw new Error('Missing injected key.')
const headers = { 'xi-api-key': key, 'Content-Type': 'application/json' }
const voice = await fetch(
  `https://api.elevenlabs.io/v1/voices/${batch.voice_id}`,
  {
    headers,
    signal: AbortSignal.timeout(30_000),
  },
)
if (!voice.ok) throw new Error(`Voice verification HTTP ${voice.status}.`)
const identity = await voice.json()
if (identity.name !== batch.voice_name) throw new Error('Voice name mismatch.')
await mkdir(join(root, 'raw'), { recursive: true })
for (const line of batch.lines) {
  if (!/^[a-z-]+$/.test(line.id)) throw new Error('Unsafe line ID.')
  const receiptPath = join(root, 'raw', `${line.id}.json`)
  let previous
  try {
    previous = JSON.parse(await readFile(receiptPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (previous) {
    if (previous.status !== 'complete' || previous.text !== line.text)
      throw new Error(
        `Inspect prior attempt for ${line.id}; no automatic retry.`,
      )
    const bytes = await readFile(join(root, 'raw', `${line.id}.pcm`))
    if (digest(bytes) !== previous.sha256)
      throw new Error('Stored audio mismatch.')
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
    text: line.text,
    voice_id: batch.voice_id,
    request,
    output_format: batch.output_format,
    started_at: new Date().toISOString(),
    status: 'reserved',
  }
  await json(receiptPath, receipt, 'wx')
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
      await json(receiptPath, receipt)
      throw new Error(`Speech HTTP ${response.status}; inspect ${line.id}.`)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 4000 || bytes.length % 2)
      throw new Error('Invalid PCM bytes.')
    await writeFile(join(root, 'raw', `${line.id}.pcm`), bytes, { flag: 'wx' })
    receipt.status = 'complete'
    receipt.bytes = bytes.length
    receipt.sha256 = digest(bytes)
    receipt.sample_rate_hz = Number(batch.output_format.split('_')[1])
    receipt.duration_seconds = bytes.length / (receipt.sample_rate_hz * 2)
    receipt.completed_at = new Date().toISOString()
    await json(receiptPath, receipt)
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
      await json(receiptPath, receipt)
    }
    throw new Error(
      `Generation stopped at ${line.id}; ${error.name}. Inspect receipt before retry.`,
    )
  }
}
