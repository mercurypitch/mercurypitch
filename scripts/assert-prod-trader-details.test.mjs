// The production deploy of the db-worker stops when the seller the mails
// name is not set: an empty TRADER_NAME or TRADER_ADDRESS in the prod block
// of wrangler.jsonc would go out to buyers as "[TRADER_NAME]". The VAT ID
// may stay empty.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
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

// Where the check runs: a tag deploys the website and the prod DB worker
// side by side (.github/workflows/build.yml), so each stops on its own.

const CHECK =
  'node scripts/assert-prod-trader-details.mjs workers/db-worker/wrangler.jsonc'

function jobsOf(workflow) {
  const text = readFileSync(
    new URL(`../.github/workflows/${workflow}`, import.meta.url),
    'utf8',
  )
  return parse(text).jobs
}

function stepsOf(workflow, job) {
  return jobsOf(workflow)[job].steps
}

function indexOf(steps, name) {
  const index = steps.findIndex((step) => step.name === name)
  assert.notEqual(index, -1, `no step named ${name}`)
  return index
}

test('stops a release tag before the website is built or deployed', () => {
  const steps = stepsOf('build.yml', 'build-and-deploy')
  const check = steps.findIndex((step) => step.run === CHECK)

  assert.notEqual(check, -1, 'build.yml never runs the check')
  assert.equal(
    steps[check].if,
    "startsWith(github.ref, 'refs/tags/v') && github.event_name == 'push'",
  )
  // It reads wrangler.jsonc through wrangler, so the install comes first.
  assert.ok(indexOf(steps, 'Install dependencies') < check)
  assert.ok(check < indexOf(steps, 'Build app before direct deployment'))
  assert.ok(check < indexOf(steps, 'Deploy to Production Environment'))
})

test('stops the production database deploy too', () => {
  const steps = stepsOf('deploy-db.yml', 'deploy-db-worker')
  const check = steps.findIndex((step) => step.run === CHECK)

  assert.notEqual(check, -1, 'deploy-db.yml never runs the check')
  assert.equal(steps[check].if, "env.DEPLOY_ENV == 'prod'")
})

// The prod Jam worker deploys first, and a tag must not ship it alone: the
// whole prod deploy waits on the check, and deploys nothing when it fails.
test('holds every prod worker of a release, the Jam worker first, on the check', () => {
  const jobs = jobsOf('deploy-db.yml')
  const gate = jobs['check-seller-details']
  assert.ok(gate, 'deploy-db.yml has no check-seller-details job')
  assert.equal(gate.env.DEPLOY_ENV, "${{ inputs.environment || 'dev' }}")
  const check = gate.steps.findIndex((step) => step.run === CHECK)
  assert.notEqual(check, -1, 'check-seller-details never runs the check')
  assert.equal(gate.steps[check].if, "env.DEPLOY_ENV == 'prod'")
  assert.ok(indexOf(gate.steps, 'Install dependencies') < check)
  assert.deepEqual([jobs['deploy-jam-worker'].needs].flat(), [
    'check-seller-details',
  ])
  assert.deepEqual([jobs['deploy-db-worker'].needs].flat(), [
    'deploy-jam-worker',
  ])
})
