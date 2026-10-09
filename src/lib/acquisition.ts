// ============================================================
// First-touch acquisition — where a funnel visitor came from
// ============================================================
//
// The gap this closes: the product funnel (mirrorEvents) knows what a
// visitor did and GA4 knows where sessions came from, but nothing joins
// the two. "Do Campaign E's visitors finish an upload more often than
// organic ones?" was unanswerable — the funnel carries no source, and
// GA4 carries none of our events. Every campaign decision downstream of
// a click was being made on Ads-side conversions alone.
//
// So the funnel records its own acquisition, first-party, next to the
// events it already stores. Same anonymity as the rest of the funnel: a
// random client id, no account, no audio, and nothing here identifies a
// person. `gclid` is Google's click id — it was already sent to Google
// on the way in; keeping a copy is what makes the click attributable to
// what the visitor then did.
//
// FIRST MEANINGFUL TOUCH, not strictly first touch. A visit that carries
// no signal at all (direct, no referrer) does not claim the slot — the
// next visit that does carry one fills it. Recording "direct" for
// someone who arrived by ad a week later would answer the question
// wrongly, and the question is the whole point.
//
// NOT FOREVER (privacy plan 4.2). The record carries the moment it was
// captured; the click id goes after 90 days and the whole record after
// 13 months (retention-periods.ts). Every event re-sends what is held
// here, so a record kept longer than the server keeps its row would
// bring the deleted row back. A record stored before the date existed is
// dated on first read with the earliest day this key could have been
// written (LEGACY_CAPTURED_AT), never "now", which would give an old
// click a fresh 90 days.
//
// The record also names the funnel id that captured it. A record for
// another id is dropped, not sent: when the id is renewed (funnel.ts) and
// the old record cannot be removed, sending it under the new id would join
// the two ids together.

import { daysBefore, DEFAULT_CLICK_ID_DAYS, DEFAULT_FUNNEL_MONTHS, MAX_PERIOD_DAYS, MAX_PERIOD_MONTHS, monthsBefore, parsePeriod, storedDate, } from '@/lib/retention-periods'

const STORAGE_KEY = 'mirror.acquisition.v1'

/**
 * The capture date of a record stored before records were dated: the UTC
 * day of the first commit that wrote this key (1c370b103, 8 Aug 2026,
 * found with `git log -S mirror.acquisition.v1`). Nothing in it can be
 * older, so its periods never run longer than they should.
 */
export const LEGACY_CAPTURED_AT = Date.UTC(2026, 7, 8)

/** Long enough for real campaign names, short enough to bound the row. */
const MAX_FIELD = 128
const MAX_REFERRER = 256

export interface FunnelAcquisition {
  gclid?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  referrer?: string
}

/** What localStorage holds: the record, when it was captured (epoch ms)
 *  and the funnel id it belongs to. Neither extra ever leaves the device:
 *  the event already carries the id. */
interface StoredAcquisition extends FunnelAcquisition {
  capturedAt?: number
  clientId?: string
}

/** How long the click id is kept, from VITE_RETENTION_CLICK_ID_DAYS. */
function clickIdDays(): number {
  return parsePeriod(
    import.meta.env.VITE_RETENTION_CLICK_ID_DAYS,
    DEFAULT_CLICK_ID_DAYS,
    MAX_PERIOD_DAYS,
  ).value
}

/** How long the whole record is kept, from VITE_RETENTION_FUNNEL_ID_MONTHS,
 *  the same period as the funnel id it belongs to (funnel.ts). */
export function funnelIdMonths(): number {
  return parsePeriod(
    import.meta.env.VITE_RETENTION_FUNNEL_ID_MONTHS,
    DEFAULT_FUNNEL_MONTHS,
    MAX_PERIOD_MONTHS,
  ).value
}

/** The wire/localStorage key for each field, in one place. */
const PARAM_FIELDS: readonly (readonly [
  param: string,
  field: keyof FunnelAcquisition,
])[] = [
  ['gclid', 'gclid'],
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_content', 'utmContent'],
  ['utm_term', 'utmTerm'],
]

function clamp(value: string | null, max: number): string | undefined {
  if (value === null) return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  return trimmed.slice(0, max)
}

/**
 * The app is a hash router, so an ad landing on `/#/karaoke?gclid=…`
 * puts the params where `location.search` cannot see them. Read both.
 */
function searchParams(): URLSearchParams {
  const direct = new URLSearchParams(window.location.search)
  if (direct.has('gclid') || direct.has('utm_source')) return direct

  const hash = window.location.hash
  const queryStart = hash.indexOf('?')
  if (queryStart === -1) return direct

  const fromHash = new URLSearchParams(hash.slice(queryStart + 1))
  // Merge rather than replace: a real query param still wins.
  for (const [key, value] of fromHash) {
    if (!direct.has(key)) direct.append(key, value)
  }
  return direct
}

/**
 * Referrers are recorded as origin + path only. A referring URL's query
 * string can carry anything — someone else's search terms, a session
 * token — and none of it is acquisition data we asked for.
 *
 * Same-origin referrers are internal navigation, not acquisition.
 */
function referrerOriginAndPath(): string | undefined {
  const raw = document.referrer
  if (raw === '') return undefined
  try {
    const url = new URL(raw)
    if (url.hostname === window.location.hostname) return undefined
    return clamp(`${url.origin}${url.pathname}`, MAX_REFERRER)
  } catch {
    return undefined
  }
}

function readFromPage(): FunnelAcquisition | undefined {
  const params = searchParams()
  const found: FunnelAcquisition = {}
  for (const [param, field] of PARAM_FIELDS) {
    const value = clamp(params.get(param), MAX_FIELD)
    if (value !== undefined) found[field] = value
  }
  const referrer = referrerOriginAndPath()
  if (referrer !== undefined) found.referrer = referrer

  return Object.keys(found).length > 0 ? found : undefined
}

/** The record without its capture date and id, or undefined when nothing
 *  is left in it. */
function fieldsOf(record: StoredAcquisition): FunnelAcquisition | undefined {
  const { capturedAt: _capturedAt, clientId: _clientId, ...fields } = record
  return Object.keys(fields).length > 0 ? fields : undefined
}

function write(record: StoredAcquisition): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Telemetry must never break the product.
  }
}

function remove(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Telemetry must never break the product.
  }
}

/**
 * Apply the id check and the retention periods to a stored record. Returns
 * the record to keep, or null when it belongs to another id or has run
 * out. An undated record (stored before the date existed) takes
 * LEGACY_CAPTURED_AT, and one with no id (stored before the id was) is
 * adopted by this one. Writes back only when something changed.
 */
function expire(
  record: StoredAcquisition,
  clientId: string,
  nowMs: number,
): StoredAcquisition | null {
  if (record.clientId !== undefined && record.clientId !== clientId) {
    remove()
    return null
  }
  const capturedAt = storedDate(record.capturedAt, nowMs, LEGACY_CAPTURED_AT)
  let changed = capturedAt !== record.capturedAt || record.clientId !== clientId
  if (capturedAt <= monthsBefore(nowMs, funnelIdMonths())) {
    remove()
    return null
  }
  const kept: StoredAcquisition = { ...record, capturedAt, clientId }
  if (
    kept.gclid !== undefined &&
    capturedAt <= daysBefore(nowMs, clickIdDays())
  ) {
    delete kept.gclid
    changed = true
  }
  if (changed) write(kept)
  return kept
}

/** Forget this device's acquisition. funnel.ts calls it when it renews the
 *  funnel id: the record belongs to the old id, and sent under the new one
 *  it would start a fresh server row that outlives the old one. */
export function forgetFunnelAcquisition(): void {
  remove()
}

/**
 * The acquisition recorded for this device, capturing it from the
 * current page on the first visit that carries any signal.
 *
 * Returns `undefined` for a visitor with nothing to record — direct,
 * no referrer, no campaign params — which is a real answer, not a
 * failure, and leaves the slot open for a later signal-bearing visit.
 * Also `undefined` once the click id was all there was and it has
 * expired; the slot stays taken then, since that click was the first
 * touch.
 *
 * `clientId` is the funnel id the event goes out under (funnel.ts). Only a
 * record captured for that id is returned.
 */
export function getFunnelAcquisition(
  clientId: string,
): FunnelAcquisition | undefined {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode / storage disabled: fall through to a live read, so
    // the very first event of the session still carries its source.
    return readFromPage()
  }

  const nowMs = Date.now()
  if (stored !== null && stored !== '') {
    let parsed: unknown = null
    try {
      parsed = JSON.parse(stored)
    } catch {
      // Corrupt entry — re-capture rather than carrying it forever.
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const kept = expire(parsed as StoredAcquisition, clientId, nowMs)
      if (kept !== null) return fieldsOf(kept)
    }
  }

  const captured = readFromPage()
  if (captured === undefined) return undefined
  write({ ...captured, capturedAt: nowMs, clientId })
  return captured
}
