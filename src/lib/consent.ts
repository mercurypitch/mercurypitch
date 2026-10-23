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
// decides whether to SHOW the banner. So nothing here may grant on a
// visitor's behalf: a `consent update` overrides the region default,
// and a visitor in Germany whose phone says America/New_York would be
// granted without being asked. Only Accept grants. Ad click ids are
// redacted from the first hit wherever ad storage is denied.
//
// There is no third-party consent SDK: this is a screenful of code and
// loads no extra script, which fits an app whose promise is "your audio
// never leaves your device".
//
// The Google tag is only loaded when an Ads or GA4 id is set for the
// build (prod only) — dev, test and tour builds stay inert. Dev and PR
// previews (CONSENT_PREVIEW, no tag) show the banner and store the choice
// but never touch gtag, the dataLayer or Google: see isConsentPreview.
// ============================================================

import { createSignal } from 'solid-js'
import { isRestrictedTimezone, RESTRICTED_COUNTRIES, } from '@/lib/consent-regions'
import { CONSENT_PREVIEW, GA4_MEASUREMENT_ID, GOOGLE_ADS_TAG_ID, IS_TEST, } from '@/lib/defaults'
import { ga4TrafficParams } from '@/lib/internal-traffic'

export type ConsentStatus = 'granted' | 'denied'

interface StoredConsent {
  status: ConsentStatus
  /** epoch ms of the decision */
  at: number
  /**
   * Always false now: only a visitor's own choice is stored. True on records
   * from before October 2026, when a non-European time zone was granted
   * silently; those are ignored and removed (see initConsent).
   */
  implicit: boolean
}

const STORAGE_KEY = 'mp.consent.v1'

// The region lists and the clock test live in consent-regions.ts; the clock
// test is re-exported for this module's importers and tests.
export { isRestrictedTimezone }

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
  karaoke_song_staged: 'AW-18321142458/yMwyCPfhhtMcELrlmaBE',
  glass_complete: 'AW-18321142458/_3BSCJWIndIcELrlmaBE',
  voiceprint_complete: 'AW-18321142458/paplCNuC-OQcELrlmaBE',
} as const

// ── reactive state ────────────────────────────────────────────

const [bannerOpen, setBannerOpen] = createSignal(false)
const [status, setStatus] = createSignal<ConsentStatus | null>(null)

/** True while the consent banner should be shown. */
export const isConsentBannerOpen = bannerOpen

// Whether this page mounted the banner (setupConsent). hasAnyTag() is true for
// the whole production build, including rooms that never mount it, so it
// cannot say alone whether "Cookie settings" has anything to reopen.
const [bannerMounted, setBannerMounted] = createSignal(false)

/** True once this page has a consent banner that Cookie settings can reopen. */
export const canReopenConsent = bannerMounted

/** Called by setupConsent once the banner is in the DOM. */
export function markConsentBannerMounted(): void {
  setBannerMounted(true)
}

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
  // Without a tag there is nobody to tell: consent preview stores the choice
  // and stops here, so no gtag or dataLayer ever appears on the page.
  if (!hasAnyTag()) return
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

function persist(next: ConsentStatus): void {
  try {
    const record: StoredConsent = {
      status: next,
      at: Date.now(),
      implicit: false,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Storage unavailable (private mode, blocked cookies) — the decision is
    // still applied in-memory for this page; it just won't be remembered.
  }
}

function forgetStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to remove when storage is unavailable.
  }
}

// ── region detection (banner display only) ────────────────────

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
 * Consent preview: a dev or PR-preview build (CONSENT_PREVIEW) with no Google
 * tag. The banner shows and stores the choice by production's rules; no
 * gtag.js loads, gtag is never called and the dataLayer is never written.
 * A build with a tag ignores the flag and runs Consent Mode as production.
 */
export function isConsentPreview(): boolean {
  return !hasAnyTag() && CONSENT_PREVIEW
}

/** True when this build mounts the consent banner: a Google tag, or preview. */
export function isConsentActive(): boolean {
  return hasAnyTag() || isConsentPreview()
}

/** Show the banner for this visitor unless they already chose. */
function decideBanner(): void {
  const stored = readStored()
  if (stored !== null && !stored.implicit) {
    setStatus(stored.status)
    applyConsent(stored.status)
  } else {
    // A silent grant from an earlier version is not a choice: drop it.
    if (stored !== null) forgetStored()
    // EEA/UK/CH by the clock: ask. Elsewhere: no banner and no update, so a
    // visitor inside the region list stays denied whatever the clock says.
    if (isRestrictedTimezone(currentTimezone())) setBannerOpen(true)
  }
}

/**
 * Boot Consent Mode and decide the initial state. Idempotent and safe to call
 * from every entry point. No-op unless the build ships a Google tag or is a
 * consent preview, and a preview only decides the banner.
 */
export function initConsent(): void {
  if (typeof window === 'undefined') return
  if (!isConsentActive()) return
  const w = gtagWindow()
  if (w.__mpConsentBooted === true) return
  w.__mpConsentBooted = true

  if (isConsentPreview()) {
    decideBanner()
    console.info('[consent] preview: banner only, no Google tag')
    return
  }

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
  // Redact ad click identifiers wherever ad storage is denied, from the very
  // first hit. It only acts while ad_storage is denied, so a granted visitor
  // is unaffected; applyConsent keeps it in step with a later choice.
  pushGtag('set', 'ads_data_redaction', true)
  // Keep the gclid in the URL when cookies are unavailable, so conversions
  // still attribute under denial.
  pushGtag('set', 'url_passthrough', true)
  pushGtag('js', new Date())

  // 2) Apply the visitor's own prior decision immediately. Otherwise leave the
  //    region defaults above in charge: they follow the IP, not the clock.
  decideBanner()

  // 3) Load the tag (async, non-blocking).
  loadTag()
}

/**
 * The current page URL with the hash fragment stripped. Fragments are never
 * sent in a Referer header, so gtag reading `location.href` for
 * `page_location` is the one path that would carry a fragment-borne token off
 * the device — this is what we hand it instead.
 */
export function locationWithoutFragment(): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

function loadTag(): void {
  if (IS_TEST) return
  // One gtag.js load configures every product on the shared dataLayer, all
  // gated by the same Consent Mode signals (ad_storage for Ads, analytics_storage
  // for GA4).
  const primary =
    GOOGLE_ADS_TAG_ID !== '' ? GOOGLE_ADS_TAG_ID : GA4_MEASUREMENT_ID
  if (primary === '') return
  // Pin page_location to the URL WITHOUT its hash. The app is hash-routed, so
  // a one-time credential can sit in location.hash while the tag loads — a
  // password-reset token (#/reset-password?token=…) or the Google redirect
  // JWT (#gauth=…). gtag's default page_location is the full href, which would
  // ship that secret to Google; the fragment carries no analytics value here
  // (routes are tracked as GA4 events), so drop it from every config.
  const pageLocation = { page_location: locationWithoutFragment() }
  if (GOOGLE_ADS_TAG_ID !== '')
    pushGtag('config', GOOGLE_ADS_TAG_ID, pageLocation)
  // traffic_type is GA4's, not Ads' — only the analytics config carries it,
  // and only on a browser we marked as ours.
  if (GA4_MEASUREMENT_ID !== '') {
    pushGtag('config', GA4_MEASUREMENT_ID, {
      ...pageLocation,
      ...ga4TrafficParams(),
    })
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    primary,
  )}`
  document.head.appendChild(script)
}

// ── Cookie settings ───────────────────────────────────────────
//
// The same behaviour and words as the landing's banner (disjoint-colliders
// #100, ConsentAnalytics.astro), so both hosts agree: reopened from Cookie
// settings, the banner states the current choice and its date, can close
// unchanged, and confirms a Decline instead of vanishing.

// True while the banner is open as Cookie settings rather than as the first ask.
const [settingsOpen, setSettingsOpen] = createSignal(false)
const [settingsLine, setSettingsLine] = createSignal('')

/** The status line above the buttons: empty except in Cookie settings. */
export const consentSettingsLine = settingsLine

/** True while the banner is open as Cookie settings. */
export const isConsentSettingsOpen = settingsOpen

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Copy C3: what this site has stored as the visitor's choice. */
function choiceLine(choice: StoredConsent | null): string {
  if (choice === null || choice.implicit) {
    return 'You haven\u2019t made a choice for this site yet.'
  }
  const verb = choice.status === 'granted' ? 'accepted' : 'declined'
  if (choice.at <= 0) return `You ${verb} cookies on this site.`
  const d = new Date(choice.at)
  return `You ${verb} cookies on ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}

/**
 * Every domain a Google cookie may have been set on from `hostname`: the host
 * itself with no Domain attribute (''), then the host and each parent short
 * of the bare TLD. GA4 writes _ga to the widest it can (.mercurypitch.com,
 * shared with the landing), and a cookie goes only when it is deleted the way
 * it was set.
 */
export function googleCookieDomains(hostname: string): string[] {
  const parts = hostname.split('.')
  const domains = ['']
  for (let i = 0; i < parts.length - 1; i++) {
    domains.push(parts.slice(i).join('.'))
  }
  return domains
}

/**
 * Delete _ga, _ga_* and _gcl_*. A Consent Mode update stops new writes but
 * leaves the old cookies in place, so Decline has to remove them itself.
 */
function clearGoogleCookies(): void {
  let jar: string
  try {
    jar = String(document.cookie)
  } catch {
    return
  }
  const domains = googleCookieDomains(window.location.hostname)
  for (const pair of jar.split(';')) {
    const name = pair.split('=')[0].trim()
    if (!/^(_ga|_ga_.+|_gcl_.+)$/.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${
        domain === '' ? '' : `; Domain=${domain}`
      }`
    }
  }
}

function closeBanner(): void {
  setBannerOpen(false)
  setSettingsOpen(false)
  setSettingsLine('')
}

export function acceptConsent(): void {
  persist('granted')
  setStatus('granted')
  applyConsent('granted')
  closeBanner()
  console.info('[consent] granted')
}

export function declineConsent(): void {
  persist('denied')
  setStatus('denied')
  applyConsent('denied')
  clearGoogleCookies()
  // Cookie settings stays open to confirm it; the first ask just closes.
  if (settingsOpen()) setSettingsLine('Google cookies are off for this site.')
  else closeBanner()
  console.info('[consent] denied')
}

/** Re-open the banner as Cookie settings, stating the current choice. */
export function openConsentSettings(): void {
  setSettingsOpen(true)
  setSettingsLine(choiceLine(readStored()))
  setBannerOpen(true)
}

/** Close Cookie settings without changing the choice. */
export function closeConsentSettings(): void {
  if (settingsOpen()) closeBanner()
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

/**
 * Mirror one product funnel event into GA4.
 *
 * Until this existed GA4 saw only its automatic events (page_view,
 * session_start, scroll, …): the funnel's milestones went to our own
 * database and to Google Ads as conversions, and neither writes a GA4
 * event. Ads bidding never needed GA4 — but GA4 audiences do, and a
 * future video campaign (Demand Gen / PMax) can only target people who
 * reached a milestone if GA4 has ever seen that milestone.
 *
 * `send_to` is explicit: this dataLayer is shared with the Ads tag, and
 * an unaddressed event would be delivered to both.
 *
 * No metrics ride along. GA4 only reports custom parameters that were
 * registered as custom dimensions in the property first, so sending them
 * blind would be bytes nobody can read; our own database already stores
 * the metrics that matter.
 */
export function trackGa4Event(event: string): void {
  if (!hasGa4() || IS_TEST) return
  pushGtag('event', event, {
    send_to: GA4_MEASUREMENT_ID,
    // The GA4 config already carries traffic_type for a marked browser;
    // repeating it per event keeps our own testing excluded even if the
    // event races the config (first paint) or a later config resets it.
    ...ga4TrafficParams(),
  })
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
