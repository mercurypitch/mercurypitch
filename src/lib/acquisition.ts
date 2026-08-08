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

const STORAGE_KEY = 'mirror.acquisition.v1'

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

/**
 * The acquisition recorded for this device, capturing it from the
 * current page on the first visit that carries any signal.
 *
 * Returns `undefined` for a visitor with nothing to record — direct,
 * no referrer, no campaign params — which is a real answer, not a
 * failure, and leaves the slot open for a later signal-bearing visit.
 */
export function getFunnelAcquisition(): FunnelAcquisition | undefined {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode / storage disabled: fall through to a live read, so
    // the very first event of the session still carries its source.
    return readFromPage()
  }

  if (stored !== null && stored !== '') {
    try {
      return JSON.parse(stored) as FunnelAcquisition
    } catch {
      // Corrupt entry — re-capture rather than carrying it forever.
    }
  }

  const captured = readFromPage()
  if (captured === undefined) return undefined
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(captured))
  } catch {
    // Telemetry must never break the product.
  }
  return captured
}
