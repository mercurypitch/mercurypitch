// ============================================================
// Retention periods — how long funnel and security data is kept
// ============================================================
//
// The defaults are the ones the privacy plan recommends (section 4.2), shipped
// on the owner's "go with recommended" of 9 Oct 2026. The lawyer sets the final
// numbers (question Q2), so every period is a config var and changing one is a
// config edit, not a code change:
//
//   worker (workers/db-worker/wrangler.jsonc, every env block):
//     RETENTION_CLICK_ID_DAYS     gclid cleared from funnelAcquisition   90
//     RETENTION_FUNNEL_MONTHS     mirrorEvents + funnelAcquisition rows   13
//     RETENTION_RATE_LIMIT_DAYS   auth_ratelimit rows                      2
//     RETENTION_PROMO_EMAIL_DAYS  promoEmailClaims, after the code closes 30
//   browser (.env.production, .env.development):
//     VITE_RETENTION_CLICK_ID_DAYS     the stored gclid                   90
//     VITE_RETENTION_FUNNEL_ID_MONTHS  the funnel id, the acquisition     13
//
// Both sides read through parsePeriod, so a value that is not a whole number
// of at least one falls back to the default here. A typo must never turn into
// a shorter period than the one the owner chose, and a default is the period
// the notice states. A very large value is capped rather than refused: it
// asks to keep MORE, and the cap only keeps the date arithmetic in range.
//
// Shared by the worker sweep (funnel-retention.ts) and the browser
// (funnel.ts, acquisition.ts), which import it from here.

export const DAY_MS = 86_400_000

/** Google Ads' longest click conversion window. After it a click id
 *  attributes nothing. */
export const DEFAULT_CLICK_ID_DAYS = 90
/** A same-month comparison a year later, inside CNIL's 13 months for
 *  audience-measurement trackers. */
export const DEFAULT_FUNNEL_MONTHS = 13
/** The longest rate-limit window is one day; an older row is reset on its
 *  next hit anyway. */
export const DEFAULT_RATE_LIMIT_DAYS = 2
/** A promo code's email records only stop repeat claims while the code is
 *  open; they go this many days after it closes. */
export const DEFAULT_PROMO_EMAIL_DAYS = 30

/** About a hundred years: far past anything meant, well inside what Date
 *  can represent. */
export const MAX_PERIOD_DAYS = 36_500
export const MAX_PERIOD_MONTHS = 1_200

export interface ParsedPeriod {
  /** The period to use. */
  value: number
  /** Why the configured value was not used as given, or null. */
  problem: string | null
}

/**
 * A whole number of days or months from a config string.
 *
 * Unset or empty means the default, silently. Anything else that is not a
 * plain run of digits (a sign, a decimal point, an exponent, a unit), and
 * zero, also means the default, with a problem to log. Above `max` means
 * `max`.
 */
export function parsePeriod(
  raw: unknown,
  fallback: number,
  max: number,
): ParsedPeriod {
  if (raw === undefined || raw === null)
    return { value: fallback, problem: null }
  const text = String(raw).trim()
  if (text === '') return { value: fallback, problem: null }
  if (!/^[0-9]+$/.test(text)) {
    return {
      value: fallback,
      problem: `"${text}" is not a whole number; using ${fallback}`,
    }
  }
  const n = Number(text)
  if (n < 1) {
    return {
      value: fallback,
      problem: `"${text}" is below 1; using ${fallback}`,
    }
  }
  if (n > max) {
    return { value: max, problem: `"${text}" is above ${max}; using ${max}` }
  }
  return { value: n, problem: null }
}

/** How far ahead of the device clock a stored date may be and still be
 *  believed: a clock corrected by a few hours is not a broken record. */
export const CLOCK_SKEW_MS = DAY_MS

/**
 * The date a browser record was written, as stored, or `legacyMs` when it
 * cannot be believed: missing (written before dates were stored), not a
 * number, or more than a day in the future.
 *
 * `legacyMs` is a fixed day, the earliest the key could have been written,
 * never "now". "Now" would give an old record a fresh period, and restart it
 * on every read where the new date fails to save.
 */
export function storedDate(
  value: unknown,
  nowMs: number,
  legacyMs: number,
): number {
  const ms = typeof value === 'string' && value !== '' ? Number(value) : value
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return legacyMs
  }
  return ms > nowMs + CLOCK_SKEW_MS ? legacyMs : ms
}

/** The moment `days` whole days before `nowMs`. */
export function daysBefore(nowMs: number, days: number): number {
  return nowMs - days * DAY_MS
}

/**
 * The same UTC time of day `months` calendar months before `nowMs`, on the
 * same day of the month, or the month's last day when it is shorter: 13
 * months before 31 March 2027 is 28 February 2026, which has no 31st.
 */
export function monthsBefore(nowMs: number, months: number): number {
  const now = new Date(nowMs)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() - months
  // Day 0 of the following month is the last day of the target month;
  // Date.UTC normalises a negative month into earlier years.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Date.UTC(
    year,
    month,
    Math.min(now.getUTCDate(), lastDay),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds(),
  )
}
