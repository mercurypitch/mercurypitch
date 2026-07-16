// ============================================================
// Cookie consent + Google Consent Mode v2 (Google Ads + GA4).
//
// Privacy-first and non-intrusive:
//   - EEA / UK / Switzerland visitors see a slim opt-in banner and
//     ad-storage stays DENIED until they accept.
//   - Everyone else (US / CA / AU / NZ opt-out regimes) is granted by
//     default and sees no banner.
//
// The real, IP-based enforcement is done by Google via the `region`
// list on the Consent Mode default — the timezone check here only
// decides whether to SHOW the banner. There is no third-party consent
// SDK: this is a screenful of code and loads no extra script, which
// fits an app whose promise is "your audio never leaves your device".
//
// The Google tag is only loaded when an Ads or GA4 id is set for the
// build (prod only) — dev, test and tour builds stay inert.
// ============================================================

import { createSignal } from 'solid-js'
import { GA4_MEASUREMENT_ID, GOOGLE_ADS_TAG_ID, IS_TEST } from '@/lib/defaults'

export type ConsentStatus = 'granted' | 'denied'

interface StoredConsent {
  status: ConsentStatus
  /** epoch ms of the decision */
  at: number
  /** true when set silently (non-EEA default), false when the user chose */
  implicit: boolean
}

const STORAGE_KEY = 'mp.consent.v1'

// EEA + UK + Switzerland — where prior opt-in consent is required. Passed to
// the Consent Mode `region` default (ISO 3166-1 alpha-2), so Google applies
// the denied-by-default state by the visitor's actual IP location.
const RESTRICTED_COUNTRIES = [
  // EU-27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA (non-EU)
  'IS',
  'LI',
  'NO',
  // UK + Switzerland
  'GB',
  'CH',
]

// European timezones that are NOT in scope (used only to avoid showing the
// banner to visitors whose clock says Europe/* but who are outside the EEA).
const NON_EEA_EUROPE_TZ = new Set([
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Simferopol',
  'Europe/Volgograd',
  'Europe/Kirov',
  'Europe/Samara',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Astrakhan',
  'Europe/Istanbul',
  'Europe/Minsk',
])

/**
 * Public conversion `send_to` targets (client-side IDs, NOT secrets) — sourced
 * from the campaigns repo `mercury/config/conversion-map.md`. Used by the
 * funnel wiring to fire Google Ads conversions via {@link trackAdConversion}.
 */
export const AD_CONVERSIONS = {
  mirror_complete: 'AW-18321142458/7VJjCKnUgNAcELrlmaBE',
  credits_purchase: 'AW-18321142458/pw1DCKzUgNAcELrlmaBE',
  app_open: 'AW-18321142458/lmf2CK_UgNAcELrlmaBE',
  card_shared: 'AW-18321142458/W8rLCLLUgNAcELrlmaBE',
  karaoke_demo_complete: 'AW-18321142458/ij7mCMrOx9EcELrlmaBE',
} as const

// ── reactive state ────────────────────────────────────────────

const [bannerOpen, setBannerOpen] = createSignal(false)
const [status, setStatus] = createSignal<ConsentStatus | null>(null)

/** True while the consent banner should be shown. */
export const isConsentBannerOpen = bannerOpen
/** Current consent decision, or null before one is made. */
export const consentStatus = status

// ── gtag / dataLayer plumbing ─────────────────────────────────

interface GtagWindow extends Window {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __mpConsentBooted?: boolean
}

function gtagWindow(): GtagWindow {
  return window as unknown as GtagWindow
}

/**
 * The canonical gtag function, created once and shared with gtag.js. It pushes
 * the raw Arguments object onto the dataLayer exactly as Google's snippet does
 * (`function gtag(){dataLayer.push(arguments)}`) — gtag.js only reliably reads
 * Arguments objects as command tuples, not plain arrays.
 */
function ensureGtag(w: GtagWindow): (...args: unknown[]) => void {
  if (!w.dataLayer) w.dataLayer = []
  let g = w.gtag
  if (!g) {
    const dataLayer = w.dataLayer
    g = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments)
    }
    w.gtag = g
  }
  return g
}

/** Queue a gtag command on the dataLayer (processed once gtag.js loads). */
function pushGtag(...args: unknown[]): void {
  ensureGtag(gtagWindow())(...args)
}

/** The four Consent Mode signals, all set to the same value. */
function consentSignals(value: ConsentStatus): Record<string, ConsentStatus> {
  return {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  }
}

function applyConsent(value: ConsentStatus): void {
  pushGtag('consent', 'update', consentSignals(value))
  // Redact ad click identifiers while consent is withheld (Consent Mode v2).
  pushGtag('set', 'ads_data_redaction', value === 'denied')
}

// ── persistence ───────────────────────────────────────────────

function readStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return null
    const parsed = JSON.parse(raw) as Partial<StoredConsent>
    if (parsed.status === 'granted' || parsed.status === 'denied') {
      return {
        status: parsed.status,
        at: typeof parsed.at === 'number' ? parsed.at : 0,
        implicit: parsed.implicit === true,
      }
    }
    return null
  } catch {
    return null
  }
}

function persist(next: ConsentStatus, implicit: boolean): void {
  try {
    const record: StoredConsent = { status: next, at: Date.now(), implicit }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Storage unavailable (private mode, blocked cookies) — the decision is
    // still applied in-memory for this page; it just won't be remembered.
  }
}

// ── region detection (banner display only) ────────────────────

/** Pure: is this IANA timezone inside the EEA / UK / CH banner scope? */
export function isRestrictedTimezone(tz: string): boolean {
  if (tz === '') return true // unknown → be cautious and ask
  return tz.startsWith('Europe/') && !NON_EEA_EUROPE_TZ.has(tz)
}

function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}

// ── public API ────────────────────────────────────────────────

/** True when this build ships the Google Ads tag (prod only). */
export function hasAdTag(): boolean {
  return GOOGLE_ADS_TAG_ID !== ''
}

/** True when this build ships the Google Analytics 4 tag (prod only). */
export function hasGa4(): boolean {
  return GA4_MEASUREMENT_ID !== ''
}

/** True when either Google tag is configured — the consent banner gates both. */
export function hasAnyTag(): boolean {
  return hasAdTag() || hasGa4()
}

/**
 * Boot Consent Mode and decide the initial state. Idempotent and safe to call
 * from every entry point. No-op unless the build ships a Google tag.
 */
export function initConsent(): void {
  if (typeof window === 'undefined') return
  if (!hasAnyTag()) return
  const w = gtagWindow()
  if (w.__mpConsentBooted === true) return
  w.__mpConsentBooted = true

  // 1) Consent Mode v2 defaults — pushed BEFORE gtag.js loads. Global default
  //    is granted (opt-out regimes); the EEA/UK/CH region default is denied.
  pushGtag('consent', 'default', {
    ...consentSignals('granted'),
  })
  pushGtag('consent', 'default', {
    ...consentSignals('denied'),
    region: RESTRICTED_COUNTRIES,
    wait_for_update: 500,
  })
  // Keep the gclid in the URL when cookies are unavailable, so conversions
  // still attribute under denial.
  pushGtag('set', 'url_passthrough', true)
  pushGtag('js', new Date())

  // 2) Apply any prior decision immediately; otherwise decide by region.
  const stored = readStored()
  if (stored !== null) {
    setStatus(stored.status)
    applyConsent(stored.status)
  } else if (isRestrictedTimezone(currentTimezone())) {
    // EEA/UK/CH first visit: stay denied (the default) and ask.
    setBannerOpen(true)
  } else {
    // Elsewhere: granted by default, no banner.
    persist('granted', true)
    setStatus('granted')
    applyConsent('granted')
  }

  // 3) Load the tag (async, non-blocking).
  loadTag()
}

function loadTag(): void {
  if (IS_TEST) return
  // One gtag.js load configures every product on the shared dataLayer, all
  // gated by the same Consent Mode signals (ad_storage for Ads, analytics_storage
  // for GA4).
  const primary =
    GOOGLE_ADS_TAG_ID !== '' ? GOOGLE_ADS_TAG_ID : GA4_MEASUREMENT_ID
  if (primary === '') return
  if (GOOGLE_ADS_TAG_ID !== '') pushGtag('config', GOOGLE_ADS_TAG_ID)
  if (GA4_MEASUREMENT_ID !== '') pushGtag('config', GA4_MEASUREMENT_ID)
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    primary,
  )}`
  document.head.appendChild(script)
}

export function acceptConsent(): void {
  persist('granted', false)
  setStatus('granted')
  applyConsent('granted')
  setBannerOpen(false)
  console.info('[consent] granted')
}

export function declineConsent(): void {
  persist('denied', false)
  setStatus('denied')
  applyConsent('denied')
  setBannerOpen(false)
  console.info('[consent] denied')
}

/** Re-open the banner so a visitor can change a prior choice (Settings). */
export function openConsentSettings(): void {
  setBannerOpen(true)
}

/**
 * Fire a Google Ads conversion. Consent Mode decides whether it sets cookies;
 * a no-op unless the build ships an ad tag. `sendTo` is a value from
 * {@link AD_CONVERSIONS}.
 */
export function trackAdConversion(
  sendTo: string,
  params?: { value?: number; currency?: string; transactionId?: string },
): void {
  if (!hasAdTag() || IS_TEST) return
  const payload: Record<string, unknown> = { send_to: sendTo }
  if (params?.value !== undefined) payload.value = params.value
  if (params?.currency !== undefined && params.currency !== '') {
    payload.currency = params.currency
  }
  if (params?.transactionId !== undefined && params.transactionId !== '') {
    payload.transaction_id = params.transactionId
  }
  pushGtag('event', 'conversion', payload)
}

// ── credits_purchase (survives the Stripe round-trip) ─────────

const PENDING_PURCHASE_KEY = 'mp.pendingPurchase.v1'

interface PendingPurchase {
  value: number
  currency: string
  txn: string
}

/**
 * Remember an in-flight purchase's value just before the Stripe redirect, so
 * {@link flushPendingPurchase} can fire the conversion with the amount when the
 * visitor returns. sessionStorage survives the same-tab redirect round-trip.
 */
export function stashPendingPurchase(value: number, currency: string): void {
  try {
    const record: PendingPurchase = {
      value,
      currency: currency.toUpperCase(),
      txn: globalThis.crypto.randomUUID(),
    }
    sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(record))
  } catch {
    // No storage — the conversion just fires without a value on return.
  }
}

/**
 * Fire the `credits_purchase` conversion on the Stripe success return. Only
 * fires when a stash is present and clears it, so a refresh of the success page
 * does not double-count (credits_purchase counts every purchase).
 */
export function flushPendingPurchase(): void {
  let stash: PendingPurchase
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_KEY)
    if (raw === null || raw === '') return
    stash = JSON.parse(raw) as PendingPurchase
    sessionStorage.removeItem(PENDING_PURCHASE_KEY)
  } catch {
    return
  }
  trackAdConversion(AD_CONVERSIONS.credits_purchase, {
    value: stash.value,
    currency: stash.currency,
    transactionId: stash.txn,
  })
}
