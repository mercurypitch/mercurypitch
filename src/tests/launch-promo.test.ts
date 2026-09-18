import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isLaunchPromoOpen, LAUNCH_PROMO, } from '@/components/billing/launch-promo'

describe('launch promo window', () => {
  it('is open until the end date and closed after it', () => {
    const end = Date.parse(LAUNCH_PROMO.endsAt)
    expect(isLaunchPromoOpen(end - 1)).toBe(true)
    expect(isLaunchPromoOpen(end)).toBe(true)
    expect(isLaunchPromoOpen(end + 1)).toBe(false)
  })

  it('ends when the server says the code expires', () => {
    // The client date is a copy of the migration's; if one moves, both must.
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'workers/db-worker/migrations/0046_promo_product_hunt_window.sql',
      ),
      'utf8',
    )
    expect(migration).toContain(`expiresAt = '${LAUNCH_PROMO.endsAt}'`)
  })
})
