#!/usr/bin/env node
// ============================================================
// assert-prod-trader-details — no release names a placeholder seller
// ============================================================
//
// The purchase mail and the withdrawal acknowledgement name who sells the
// credits (CRD Art. 6(1)(b) and (c)), from the db-worker's TRADER_* vars
// (workers/db-worker/src/checkout-consent.ts). An empty name or address goes
// out to a buyer as "[TRADER_NAME]" or "[TRADER_ADDRESS]". The production
// deploy (.github/workflows/deploy-db.yml, prod only) runs this before it
// touches the database or the worker, and stops when the prod block of
// wrangler.jsonc lacks either. The VAT ID may stay empty: a sole trader
// outside the VAT system has none. Dev deploys are never checked.
//
//   node scripts/assert-prod-trader-details.mjs [path/to/wrangler.jsonc]

import { fileURLToPath } from 'node:url'
import { experimental_readRawConfig } from 'wrangler'

/** The environment a release deploys (deploy-db.yml, --env prod). */
const PRODUCTION = 'prod'
const REQUIRED = ['TRADER_NAME', 'TRADER_ADDRESS']

/** The required trader vars the production block leaves empty. */
export function missingTraderDetails(config) {
  const vars = config?.env?.[PRODUCTION]?.vars ?? {}
  return REQUIRED.filter(
    (key) => typeof vars[key] !== 'string' || vars[key].trim() === '',
  )
}

function main() {
  const path =
    process.argv[2] ??
    fileURLToPath(
      new URL('../workers/db-worker/wrangler.jsonc', import.meta.url),
    )
  const { rawConfig } = experimental_readRawConfig({ config: path })
  const missing = missingTraderDetails(rawConfig)
  if (missing.length > 0) {
    console.error(
      `${path}: env.${PRODUCTION}.vars leaves ${missing.join(' and ')} empty. ` +
        'The purchase and withdrawal mails would name a placeholder seller. ' +
        'Fill them in before deploying to production.',
    )
    process.exit(1)
  }
  console.log(`${path}: the production seller details are set.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
