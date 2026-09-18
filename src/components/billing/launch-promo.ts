// ============================================================
// launch-promo — what the client knows about the launch campaign
// ============================================================
//
// The server owns the code itself: `promoCodes` in D1, seeded by migration
// 0045 and re-dated by 0046. This file only decides whether the launch UI —
// the header pill and the one-click claim card — is still worth showing.
// Keep `endsAt` in step with the row's `expiresAt`; src/tests/launch-promo.test.ts
// reads the migration to make sure it is.

export const LAUNCH_PROMO = {
  code: 'PRODUCT_HUNT',
  credits: 5,
  endsAt: '2026-09-30T23:59:59.000Z',
} as const

/** True while the launch campaign can still be claimed. */
export function isLaunchPromoOpen(now: number = Date.now()): boolean {
  return now <= Date.parse(LAUNCH_PROMO.endsAt)
}
