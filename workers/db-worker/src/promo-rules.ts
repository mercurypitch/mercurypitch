// ============================================================
// promo-rules — when a promo code can be claimed, and what the app may say about it
// ============================================================
//
// One rule, two readers. `POST /api/billing/promo/redeem` refuses a code with
// `promoRefusal`, and `GET /api/billing/promo/featured` asks the same question
// before offering the featured code, so the header pill can never advertise a
// code the server would then turn down.
//
// A date that does not parse closes the code. `new Date('garbage') < now` is
// false, which the old inline checks read as "never expires". Admin writes go
// through `validatePromoWrite`, so a bad date should not get in, but a
// hand-run UPDATE still could.
//
// Pure on purpose, like validation.ts: no worker imports, so the main
// project's tests can load it without the Cloudflare ambient types.

/** The columns that decide whether a code is open. */
export interface PromoWindow {
  active: number | boolean
  startsAt: string | null
  expiresAt: string | null
  maxRedemptions: number | null
  redemptionCount: number
}

/** A featured row: the window plus what the app is allowed to show. */
export interface FeaturedPromoRow extends PromoWindow {
  code: string
  credits: number
}

/** What the public route says about the featured code. Nothing about the cap. */
export interface FeaturedPromoView {
  code: string
  credits: number
  expiresAt: string | null
}

export type PromoRefusal = 'inactive' | 'not-started' | 'expired' | 'full'

/** The refusal the redemption route answers with, in the words it always used. */
export const PROMO_REFUSALS: Record<
  PromoRefusal,
  { error: string; status: number }
> = {
  inactive: { error: 'Invalid or inactive promo code.', status: 404 },
  'not-started': { error: 'This promo code is not active yet.', status: 400 },
  expired: { error: 'This promo code has expired.', status: 400 },
  full: {
    error: 'This promo code has reached its maximum redemption limit.',
    status: 400,
  },
}

/**
 * Why a code cannot be claimed at `now`, or null when it can. The order is
 * the order the redemption route has always refused in. Both ends are
 * inclusive: a code is open at the instant it starts and at the instant it
 * ends.
 */
export function promoRefusal(
  promo: PromoWindow,
  now: Date,
): PromoRefusal | null {
  if (!promo.active) return 'inactive'
  const at = now.getTime()
  // `!(a <= b)` rather than `a > b`: NaN fails every comparison, so a date
  // that does not parse lands on the refusing side.
  if (promo.startsAt !== null && !(Date.parse(promo.startsAt) <= at)) {
    return 'not-started'
  }
  if (promo.expiresAt !== null && !(at <= Date.parse(promo.expiresAt))) {
    return 'expired'
  }
  if (
    promo.maxRedemptions !== null &&
    promo.redemptionCount >= promo.maxRedemptions
  ) {
    return 'full'
  }
  return null
}

/** The featured code as the app may show it, or null when it is not open. */
export function featuredPromoView(
  row: FeaturedPromoRow | null,
  now: Date,
): FeaturedPromoView | null {
  if (row === null || promoRefusal(row, now) !== null) return null
  return { code: row.code, credits: row.credits, expiresAt: row.expiresAt }
}

// The one timestamp shape the table holds: UTC, milliseconds, `Z`. Requiring
// the exact round trip also refuses a day that does not exist, which
// `new Date` would otherwise roll into the next month.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
export const isInstant = (value: unknown): value is string => {
  if (typeof value !== 'string' || !INSTANT.test(value)) return false
  // Month 13 matches the pattern and makes an Invalid Date, whose
  // toISOString() throws: check it is a date before asking.
  const ms = Date.parse(value)
  return Number.isFinite(ms) && new Date(ms).toISOString() === value
}

// Upper case only. UNIQUE(code) is case-sensitive while redemption matches on
// UPPER(code), so 'launch' beside 'LAUNCH' would make a typed code ambiguous.
const CODE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/

const isWhole = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max

const isFlag = (value: unknown): boolean =>
  value === true || value === false || value === 0 || value === 1

const FIELD_RULES: ReadonlyArray<
  [column: string, ok: (value: unknown) => boolean, message: string]
> = [
  [
    'startsAt',
    (v) => v === null || isInstant(v),
    'startsAt must be null or a UTC timestamp like 2026-10-02T00:00:00.000Z',
  ],
  [
    'expiresAt',
    (v) => v === null || isInstant(v),
    'expiresAt must be null or a UTC timestamp like 2027-01-01T23:59:59.000Z',
  ],
  [
    'code',
    (v) => typeof v === 'string' && CODE.test(v),
    'code must be 3 to 32 capital letters, digits, _ or -',
  ],
  [
    'credits',
    (v) => isWhole(v, 1, 1000),
    'credits must be a whole number from 1 to 1000',
  ],
  [
    'maxRedemptions',
    (v) => v === null || isWhole(v, 0, 1_000_000),
    'maxRedemptions must be null or a whole number from 0 to 1000000',
  ],
  ['active', isFlag, 'active must be true or false'],
  ['featured', isFlag, 'featured must be true or false'],
]

/**
 * Value checks for writes to `promoCodes` through the admin table API.
 * Returns an error message, or null when the body is acceptable. Columns
 * absent from the body are not checked; a PATCH sends only what it changes.
 */
export function validatePromoWrite(
  body: Record<string, unknown>,
): string | null {
  for (const [column, ok, message] of FIELD_RULES) {
    if (body[column] !== undefined && !ok(body[column])) return message
  }
  const { startsAt, expiresAt } = body
  // Both are canonical instants by now, so string order is time order.
  if (
    typeof startsAt === 'string' &&
    typeof expiresAt === 'string' &&
    startsAt > expiresAt
  ) {
    return 'startsAt must not be after expiresAt'
  }
  return null
}
