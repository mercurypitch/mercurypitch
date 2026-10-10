#!/usr/bin/env node
// ============================================================
// assert-prod-trader-details — no release names a placeholder seller
// ============================================================
//
// The purchase mail and the withdrawal acknowledgement name who sells the
// credits (CRD Art. 6(1)(b) and (c)), from the db-worker's TRADER_* settings
// (workers/db-worker/src/checkout-consent.ts). An unset name or address goes
// out to a buyer as "[TRADER_NAME]" or "[TRADER_ADDRESS]". The production
// deploy (.github/workflows/deploy-db.yml, prod only) runs this before it
// deploys the Jam worker, the database or the DB worker, and the website's
// deploy on a release tag (.github/workflows/build.yml) before it builds,
// and each stops when the prod worker lacks either secret. The name, the
// address and the VAT ID are Worker secrets, so the prod block of
// wrangler.jsonc must not declare them: a var and a secret cannot share a
// name. The VAT ID may stay unset: a sole trader outside the VAT system has
// none. Dev deploys are never checked.
//
//   node scripts/assert-prod-trader-details.mjs [path/to/wrangler.jsonc] [--secrets <file>]
//
// The secret names come from `wrangler secret list --env prod`, which needs
// CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or from a file holding that
// command's JSON (--secrets, for the tests).

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { experimental_readRawConfig } from 'wrangler'

/** The environment a release deploys (deploy-db.yml, --env prod). */
const PRODUCTION = 'prod'
const REQUIRED = ['TRADER_NAME', 'TRADER_ADDRESS']
const SECRETS = [...REQUIRED, 'TRADER_VAT_ID']

/**
 * The names in what `wrangler secret list --format json` printed, or null
 * when the text holds no such list.
 */
export function secretNames(text) {
  const start = text.search(/^\[\s*(?:$|\{|\])/m)
  if (start === -1) return null
  try {
    const list = JSON.parse(text.slice(start, text.lastIndexOf(']') + 1))
    if (!Array.isArray(list)) return null
    return list
      .map((secret) => secret?.name)
      .filter((name) => typeof name === 'string')
  } catch {
    return null
  }
}

/** The required trader secrets the production worker lacks. */
export function missingTraderSecrets(names) {
  return REQUIRED.filter((key) => !names.includes(key))
}

/** Trader secrets the production block also declares as vars. */
export function clashingTraderVars(config) {
  const vars = config?.env?.[PRODUCTION]?.vars ?? {}
  return SECRETS.filter((key) => Object.hasOwn(vars, key))
}

/** `wrangler secret list` for the production worker, as it printed it. */
function listSecrets(path) {
  const req = createRequire(import.meta.url)
  const pkg = req.resolve('wrangler/package.json')
  const bin = join(dirname(pkg), req(pkg).bin.wrangler)
  const result = spawnSync(
    process.execPath,
    [
      bin,
      'secret',
      'list',
      '--config',
      path,
      '--env',
      PRODUCTION,
      '--format',
      'json',
    ],
    { encoding: 'utf8' },
  )
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function main() {
  const args = process.argv.slice(2)
  const flag = args.indexOf('--secrets')
  const file = flag === -1 ? null : args.splice(flag, 2)[1]
  const path =
    args[0] ??
    fileURLToPath(
      new URL('../workers/db-worker/wrangler.jsonc', import.meta.url),
    )
  const { rawConfig } = experimental_readRawConfig({ config: path })

  const clash = clashingTraderVars(rawConfig)
  if (clash.length > 0) {
    fail(
      `${path}: env.${PRODUCTION}.vars declares ${clash.join(' and ')}. ` +
        'These are Worker secrets, and a var by the same name fails the deploy. ' +
        'Remove it from wrangler.jsonc.',
    )
  }

  const listed = file
    ? { stdout: readFileSync(file, 'utf8'), stderr: '' }
    : listSecrets(path)
  const names = secretNames(listed.stdout)
  if (names === null) {
    fail(
      `wrangler secret list --env ${PRODUCTION} gave no list of secrets.\n` +
        listed.stderr.trim(),
    )
  }

  const missing = missingTraderSecrets(names)
  if (missing.length > 0) {
    fail(
      `The ${PRODUCTION} worker has no ${missing.join(' or ')} secret. ` +
        'The purchase and withdrawal mails would name a placeholder seller. ' +
        `Set it with \`wrangler secret put <NAME> --config ${path} --env ${PRODUCTION}\` ` +
        'before deploying to production.',
    )
  }
  console.log(`${path}: the production seller details are set.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
