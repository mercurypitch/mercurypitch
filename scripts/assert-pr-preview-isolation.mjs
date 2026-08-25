// Fails closed before a PR preview can mutate either protected DB Worker.

import { log } from 'node:console'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { experimental_readRawConfig } from 'wrangler'

export const PREVIEW_WORKER_NAME = 'mercury-pitch-db-preview'
export const PREVIEW_DATABASE_NAME = 'mercurypitch-db-preview'
export const PREVIEW_DATABASE_PLACEHOLDER_ID =
  '00000000-0000-0000-0000-000000000000'
export const PREVIEW_TURNSTILE_SECRET = '1x0000000000000000000000000000000AA'

const PROTECTED_WORKER_NAMES = new Set([
  'mercury-pitch-db-dev',
  'mercury-pitch-db',
])
const PREVIEW_TOP_LEVEL_KEYS = [
  '$schema',
  'name',
  'main',
  'compatibility_date',
  'compatibility_flags',
  'workers_dev',
  'preview_urls',
  'secrets',
  'vars',
  'd1_databases',
  'r2_buckets',
]
const PREVIEW_VAR_VALUES = {
  PR_PREVIEW: 'true',
  TURNSTILE_SECRET: PREVIEW_TURNSTILE_SECRET,
  GOOGLE_CLIENT_ID:
    '940402390643-sb89ek7ocuoikqpd5llc6ike4fasccdl.apps.googleusercontent.com',
  ALLOWED_ORIGINS: '*.workers.dev',
  APP_FALLBACK_ORIGIN: 'https://dev.mercurypitch.com',
}
const PREVIEW_DATABASE_KEYS = [
  'binding',
  'database_name',
  'database_id',
  'migrations_dir',
]
const PREVIEW_R2_KEYS = ['binding', 'bucket_name']

function assertExactObjectKeys(value, expectedKeys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object with an exact approved shape.`)
  }

  const actualKeys = Object.keys(value)
  const expectedKeySet = new Set(expectedKeys)
  const actualKeySet = new Set(actualKeys)
  const unexpectedKeys = actualKeys.filter((key) => !expectedKeySet.has(key))
  const missingKeys = expectedKeys.filter((key) => !actualKeySet.has(key))

  if (unexpectedKeys.length > 0 || missingKeys.length > 0) {
    const unexpectedSummary =
      unexpectedKeys.length > 0 ? unexpectedKeys.join(',') : 'none'
    const missingSummary =
      missingKeys.length > 0 ? missingKeys.join(',') : 'none'
    throw new Error(
      `${label} must contain exactly the approved keys; unexpected=${unexpectedSummary}, missing=${missingSummary}.`,
    )
  }
}

function assertExactValues(value, expectedValues, label) {
  assertExactObjectKeys(value, Object.keys(expectedValues), label)
  for (const [key, expectedValue] of Object.entries(expectedValues)) {
    if (value[key] !== expectedValue) {
      throw new Error(`${label}.${key} must exactly match the approved value.`)
    }
  }
}

function createJsoncTokenReader(source) {
  let offset = 0

  function skipIgnored() {
    while (offset < source.length) {
      if (/\s/u.test(source[offset])) {
        offset += 1
        continue
      }
      if (source.startsWith('//', offset) === true) {
        offset += 2
        while (offset < source.length && source[offset] !== '\n') {
          offset += 1
        }
        continue
      }
      if (source.startsWith('/*', offset) === true) {
        const commentEnd = source.indexOf('*/', offset + 2)
        if (commentEnd === -1) {
          throw new Error('Unterminated JSONC block comment.')
        }
        offset = commentEnd + 2
        continue
      }
      break
    }
  }

  function readString() {
    const start = offset
    offset += 1
    while (offset < source.length) {
      if (source[offset] === '\\') {
        offset += 2
        continue
      }
      if (source[offset] === '"') {
        offset += 1
        return {
          type: 'string',
          value: JSON.parse(source.slice(start, offset)),
        }
      }
      offset += 1
    }
    throw new Error('Unterminated JSONC string.')
  }

  function next() {
    skipIgnored()
    if (offset >= source.length) return { type: 'eof' }

    const character = source[offset]
    if (character === '"') return readString()
    if ('{}[]:,'.includes(character)) {
      offset += 1
      return { type: 'punctuation', value: character }
    }

    const start = offset
    while (
      offset < source.length &&
      !/\s/u.test(source[offset]) &&
      !'{}[]:,'.includes(source[offset]) &&
      source.startsWith('//', offset) !== true &&
      source.startsWith('/*', offset) !== true
    ) {
      offset += 1
    }
    return { type: 'atom', value: source.slice(start, offset) }
  }

  return { next }
}

function formatJsonPath(path) {
  return path.reduce((formatted, segment) => {
    if (typeof segment === 'number') return `${formatted}[${segment}]`
    if (/^[A-Za-z_$][\w$]*$/u.test(segment)) return `${formatted}.${segment}`
    return `${formatted}[${JSON.stringify(segment)}]`
  }, '$')
}

function assertNoDuplicateJsoncKeys(source) {
  const reader = createJsoncTokenReader(source)
  let token = reader.next()

  function advance() {
    token = reader.next()
  }

  function isPunctuation(value) {
    return token.type === 'punctuation' && token.value === value
  }

  function expectPunctuation(value) {
    if (!isPunctuation(value)) {
      throw new Error(`Expected ${value} while checking JSONC object keys.`)
    }
  }

  function visitValue(path) {
    if (isPunctuation('{')) {
      visitObject(path)
      return
    }
    if (isPunctuation('[')) {
      visitArray(path)
      return
    }
    if (token.type === 'string' || token.type === 'atom') {
      advance()
      return
    }
    throw new Error('Expected a JSONC value while checking object keys.')
  }

  function visitObject(path) {
    advance()
    const keys = new Set()
    if (isPunctuation('}')) {
      advance()
      return
    }

    while (true) {
      if (token.type !== 'string') {
        throw new Error('Expected a JSONC object key.')
      }
      const key = token.value
      const keyPath = [...path, key]
      if (keys.has(key)) {
        throw new Error(`Duplicate JSONC key at ${formatJsonPath(keyPath)}.`)
      }
      keys.add(key)
      advance()
      expectPunctuation(':')
      advance()
      visitValue(keyPath)

      if (isPunctuation('}')) {
        advance()
        return
      }
      expectPunctuation(',')
      advance()
      if (isPunctuation('}')) {
        advance()
        return
      }
    }
  }

  function visitArray(path) {
    advance()
    if (isPunctuation(']')) {
      advance()
      return
    }

    let index = 0
    while (true) {
      visitValue([...path, index])
      index += 1
      if (isPunctuation(']')) {
        advance()
        return
      }
      expectPunctuation(',')
      advance()
      if (isPunctuation(']')) {
        advance()
        return
      }
    }
  }

  visitValue([])
  if (token.type !== 'eof') {
    throw new Error('Unexpected content after the JSONC document.')
  }
}

function readPreviewConfig(configPath) {
  const configSource = readFileSync(configPath, 'utf8')
  assertNoDuplicateJsoncKeys(configSource)

  const parsed = experimental_readRawConfig({ config: configPath })
  if (parsed.redirected === true) {
    throw new Error('PR preview config redirection is not allowed.')
  }
  return parsed.rawConfig
}

export function assertPreviewIsolation({
  config,
  workflowWorkerName,
  workflowDatabaseName,
  expectedDatabaseId,
}) {
  assertExactObjectKeys(
    config,
    PREVIEW_TOP_LEVEL_KEYS,
    'PR preview Wrangler config',
  )
  const configuredWorkerName = config.name
  const databases = Array.isArray(config.d1_databases)
    ? config.d1_databases
    : []
  const buckets = Array.isArray(config.r2_buckets) ? config.r2_buckets : []
  const configuredDatabaseName = databases[0]?.database_name
  const configuredDatabaseId = databases[0]?.database_id
  const requiredDatabaseId =
    expectedDatabaseId ?? PREVIEW_DATABASE_PLACEHOLDER_ID
  const previewMode = config.vars?.PR_PREVIEW
  const turnstileSecret = config.vars?.TURNSTILE_SECRET

  if (config.main !== 'src/index.ts') {
    throw new Error('PR preview Worker main must remain src/index.ts.')
  }
  assertExactObjectKeys(config.secrets, ['required'], 'PR preview secrets')
  if (
    !Array.isArray(config.secrets.required) ||
    config.secrets.required.length !== 1 ||
    config.secrets.required[0] !== 'JWT_SECRET'
  ) {
    throw new Error('PR preview required secrets must be exactly JWT_SECRET.')
  }
  assertExactValues(config.vars, PREVIEW_VAR_VALUES, 'PR preview vars')

  if (
    configuredWorkerName !== PREVIEW_WORKER_NAME ||
    workflowWorkerName !== PREVIEW_WORKER_NAME
  ) {
    throw new Error(
      `PR preview Worker must be exactly ${PREVIEW_WORKER_NAME}; received config=${configuredWorkerName ?? 'missing'}, workflow=${workflowWorkerName}.`,
    )
  }
  if (
    PROTECTED_WORKER_NAMES.has(configuredWorkerName) ||
    PROTECTED_WORKER_NAMES.has(workflowWorkerName)
  ) {
    throw new Error('PR previews must never target a dev or production Worker.')
  }
  if (
    configuredDatabaseName !== PREVIEW_DATABASE_NAME ||
    workflowDatabaseName !== PREVIEW_DATABASE_NAME ||
    databases.length !== 1
  ) {
    throw new Error(
      `PR preview D1 must be exactly ${PREVIEW_DATABASE_NAME}; received config=${configuredDatabaseName ?? 'missing'}, workflow=${workflowDatabaseName}.`,
    )
  }
  assertExactObjectKeys(
    databases[0],
    PREVIEW_DATABASE_KEYS,
    'PR preview D1 binding',
  )
  if (
    (expectedDatabaseId !== undefined &&
      (typeof expectedDatabaseId !== 'string' ||
        expectedDatabaseId === PREVIEW_DATABASE_PLACEHOLDER_ID)) ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(
      requiredDatabaseId,
    ) ||
    configuredDatabaseId !== requiredDatabaseId
  ) {
    throw new Error(
      `PR preview D1 id must exactly match the expected preview database id; received config=${configuredDatabaseId ?? 'missing'}, expected=${requiredDatabaseId}.`,
    )
  }
  if (
    databases[0].binding !== 'DB' ||
    databases[0].migrations_dir !== 'migrations'
  ) {
    throw new Error(
      'PR preview D1 binding and migrations directory must exactly match the approved values.',
    )
  }
  if (buckets.length !== 1) {
    throw new Error('PR preview R2 bindings must contain exactly one bucket.')
  }
  assertExactObjectKeys(buckets[0], PREVIEW_R2_KEYS, 'PR preview R2 binding')
  if (
    buckets[0].binding !== 'GUIDED_MEDIA_BUCKET' ||
    buckets[0].bucket_name !== 'mercurypitch-guided-media-dev'
  ) {
    throw new Error(
      'PR preview R2 binding must exactly match the approved bucket.',
    )
  }
  if (config.workers_dev !== false) {
    throw new Error('The stable workers.dev route must remain disabled.')
  }
  if (config.preview_urls !== true) {
    throw new Error('Immutable Worker preview URLs must remain enabled.')
  }
  if (previewMode !== 'true') {
    throw new Error('PR_PREVIEW must remain true so side effects fail closed.')
  }
  if (turnstileSecret !== PREVIEW_TURNSTILE_SECRET) {
    throw new Error(
      "The dedicated preview Worker must use Cloudflare's public test secret.",
    )
  }
}

function runCli() {
  const [
    configPath,
    workflowWorkerName,
    workflowDatabaseName,
    expectedDatabaseId,
  ] = process.argv.slice(2)
  if (!configPath || !workflowWorkerName || !workflowDatabaseName) {
    throw new Error(
      'Usage: node scripts/assert-pr-preview-isolation.mjs <config> <worker-name> <database-name> [resolved-database-id]',
    )
  }
  assertPreviewIsolation({
    config: readPreviewConfig(configPath),
    workflowWorkerName,
    workflowDatabaseName,
    expectedDatabaseId,
  })
  log('PR preview isolation contract: PASS')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCli()
}
