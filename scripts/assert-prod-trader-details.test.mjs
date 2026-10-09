// The production deploy of the db-worker stops when the seller the mails
// name is not set: an empty TRADER_NAME or TRADER_ADDRESS in the prod block
// of wrangler.jsonc would go out to buyers as "[TRADER_NAME]". The VAT ID
// may stay empty.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { missingTraderDetails } from './assert-prod-trader-details.mjs'

const SCRIPT = fileURLToPath(
  new URL('./assert-prod-trader-details.mjs', import.meta.url),
)

/** A wrangler.jsonc with these prod vars, comments and all. */
function configWith(vars) {
  return `{
  // The db-worker, cut down to what the check reads.
  "name": "db-worker",
  "env": {
    "dev": { "vars": { "TRADER_NAME": "" } },
    "prod": {
      "vars": ${JSON.stringify(vars)}
    }
  }
}
`
}

function check(vars) {
  const dir = mkdtempSync(join(tmpdir(), 'trader-details-'))
  try {
    const path = join(dir, 'wrangler.jsonc')
    writeFileSync(path, configWith(vars))
    return spawnSync(process.execPath, [SCRIPT, path], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const SET = {
  TRADER_NAME: 'Sample Trader',
  TRADER_ADDRESS: '1 Sample Street, 00000 Sampletown',
  TRADER_EMAIL: 'sales@example.test',
  TRADER_VAT_ID: '',
}

test('names what production is missing', () => {
  assert.deepEqual(
    missingTraderDetails({
      env: { prod: { vars: { ...SET, TRADER_NAME: ' ' } } },
    }),
    ['TRADER_NAME'],
  )
  assert.deepEqual(missingTraderDetails({ env: { prod: { vars: {} } } }), [
    'TRADER_NAME',
    'TRADER_ADDRESS',
  ])
  assert.deepEqual(missingTraderDetails({}), ['TRADER_NAME', 'TRADER_ADDRESS'])
})

test('asks nothing of the VAT ID or the dev block', () => {
  assert.deepEqual(missingTraderDetails({ env: { prod: { vars: SET } } }), [])
})

test('fails the deploy without a name or an address', () => {
  const result = check({ ...SET, TRADER_ADDRESS: '' })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /TRADER_ADDRESS/)
  assert.doesNotMatch(result.stderr, /TRADER_NAME/)
})

test('lets the deploy go on once both are set', () => {
  const result = check(SET)

  assert.equal(result.status, 0, result.stderr)
})
