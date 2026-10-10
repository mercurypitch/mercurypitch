// The production deploy of the db-worker stops when the seller the mails
// name is not set: without a TRADER_NAME or TRADER_ADDRESS secret on the prod
// worker, the mails would go out to buyers as "[TRADER_NAME]". The VAT ID
// may stay unset.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { clashingTraderVars, missingTraderSecrets, secretNames, } from './assert-prod-trader-details.mjs'

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

/** What `wrangler secret list --format json` prints for these names. */
function listOf(names) {
  return JSON.stringify(
    names.map((name) => ({ name, type: 'secret_text' })),
    null,
    2,
  )
}

const VARS = { TRADER_EMAIL: 'sales@example.test' }
const SET = ['JWT_SECRET', 'TRADER_NAME', 'TRADER_ADDRESS']

function check(list, vars = VARS) {
  const dir = mkdtempSync(join(tmpdir(), 'trader-details-'))
  try {
    const path = join(dir, 'wrangler.jsonc')
    const secrets = join(dir, 'secrets.json')
    writeFileSync(path, configWith(vars))
    writeFileSync(secrets, list)
    return spawnSync(process.execPath, [SCRIPT, path, '--secrets', secrets], {
      encoding: 'utf8',
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('reads the names wrangler secret list prints', () => {
  assert.deepEqual(secretNames(listOf(SET)), SET)
  assert.deepEqual(secretNames('[]\n'), [])
  assert.equal(secretNames(''), null)
  assert.equal(
    secretNames('✘ [ERROR] A request to the Cloudflare API failed.'),
    null,
  )
})

test('names what production is missing', () => {
  assert.deepEqual(missingTraderSecrets(['JWT_SECRET', 'TRADER_ADDRESS']), [
    'TRADER_NAME',
  ])
  assert.deepEqual(missingTraderSecrets([]), ['TRADER_NAME', 'TRADER_ADDRESS'])
})

test('asks nothing of the VAT ID or the dev block', () => {
  assert.deepEqual(missingTraderSecrets(SET), [])
  assert.deepEqual(
    clashingTraderVars({
      env: { dev: { vars: { TRADER_NAME: '' } }, prod: { vars: VARS } },
    }),
    [],
  )
})

test('refuses a prod var by the name of a secret', () => {
  assert.deepEqual(
    clashingTraderVars({
      env: { prod: { vars: { ...VARS, TRADER_NAME: '', TRADER_VAT_ID: '' } } },
    }),
    ['TRADER_NAME', 'TRADER_VAT_ID'],
  )
  const result = check(listOf(SET), { ...VARS, TRADER_ADDRESS: '' })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /TRADER_ADDRESS/)
})

test('fails the deploy without a name or an address', () => {
  const result = check(listOf(['JWT_SECRET', 'TRADER_NAME']))

  assert.equal(result.status, 1)
  assert.match(result.stderr, /TRADER_ADDRESS/)
  assert.doesNotMatch(result.stderr, /TRADER_NAME/)
})

test('fails the deploy when wrangler lists nothing', () => {
  const result = check('')

  assert.equal(result.status, 1)
  assert.match(result.stderr, /no list of secrets/)
})

test('lets the deploy go on once both are set', () => {
  const result = check(listOf(SET))

  assert.equal(result.status, 0, result.stderr)
})

// Where the check runs: a tag deploys the website and the prod DB worker
// side by side (.github/workflows/build.yml), so each stops on its own.

const CHECK =
  'node scripts/assert-prod-trader-details.mjs workers/db-worker/wrangler.jsonc'

// It asks Cloudflare for the prod worker's secrets.
const CLOUDFLARE = {
  CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
  CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
}

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
  assert.deepEqual(steps[check].env, CLOUDFLARE)
  // It runs wrangler, so the install comes first.
  assert.ok(indexOf(steps, 'Install dependencies') < check)
  assert.ok(check < indexOf(steps, 'Build app before direct deployment'))
  assert.ok(check < indexOf(steps, 'Deploy to Production Environment'))
})

test('stops the production database deploy too', () => {
  const steps = stepsOf('deploy-db.yml', 'deploy-db-worker')
  const check = steps.findIndex((step) => step.run === CHECK)

  assert.notEqual(check, -1, 'deploy-db.yml never runs the check')
  assert.equal(steps[check].if, "env.DEPLOY_ENV == 'prod'")
  assert.deepEqual(steps[check].env, CLOUDFLARE)
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
  assert.deepEqual(gate.steps[check].env, CLOUDFLARE)
  assert.ok(indexOf(gate.steps, 'Install dependencies') < check)
  assert.deepEqual([jobs['deploy-jam-worker'].needs].flat(), [
    'check-seller-details',
  ])
  assert.deepEqual([jobs['deploy-db-worker'].needs].flat(), [
    'deploy-jam-worker',
  ])
})
