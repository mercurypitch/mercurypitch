// ============================================================
// The Cloud offer's state: whether it is up, who asked, and its caps
// ============================================================
//
// One offer, opened from several places (S7b §5): the Karaoke room's import
// gate, Settings' "See the plan", the onboarding's beat 9, and the
// onboarding's own Not now (owner, 20 Oct 2026), each counted by its own
// name. Each opens the same sheet (CloudOffer.tsx, mounted once by the
// native shell), so the caps live here, where every way in has to pass them.
//
// THE CAPS (S7 §5, kept by S7b §5) are for an offer the singer did not ask
// for. A tap on Import or on "See the plan" is the singer's own question and
// is always answered. An offer nobody asked for opens:
//   - at most once a session;
//   - never while a song plays, a run is paused mid-way or counting in, or
//     the microphone is listening;
//   - not for 7 days after a Not now, from any offer;
//   - never for a subscriber.
// No countdowns, struck-through prices or urgency words: that rule is the
// copy's, and CloudOffer.test.tsx reads the sheet for it.
//
// BEFORE ANY OFFER (S7 §3.9, E11). `askBeforeOffering` makes the singer's
// identity first (singer-identity.ts), then asks the server again and the
// store whether it holds the subscription: the store knows of a purchase
// before the server does, and a subscriber is never offered it again. It
// answers within three seconds; past that the offer opens on what is known.
//
// THE PRICE is the store's (S7b §4.3). `askCloudPlan` asks for it and keeps
// the answer (`cloudPlan`), so the onboarding, which opens no offer without
// one (onboarding-offer.ts), hands the sheet the price it saw.
//
// AFTER A SIGN-IN (TestFlight build 919). `settleCloudAfterSignIn` runs at
// the end of every way in (sign-in-landing.ts): a purchase this phone made
// signed out goes to the account through the store (karaoke-subscription.ts
// carryToAccount), and the server is asked again either way, so Settings
// and the room show the account as it now is, without a restart.

import { createSignal } from 'solid-js'
import { ensureSingerIdentity } from '@/db/services/singer-identity'
import { trackEvent } from '@/lib/analytics'
import { micActive, singingCaptureActive } from '@/stores/mic-store'
import type { KaraokeCarryOutcome, KaraokeOffer, } from '@/stores/native-shell-store'
import { nativeRunControls, nativeShellApi } from '@/stores/native-shell-store'
import { showNotification } from '@/stores/notifications-store'
import { CLOUD_VIEW_EVENT } from './cloud-measure'
import type { KaraokeSongs } from './karaoke-songs'
import { awaitSubscription, CLOUD_NAME, karaokeSongs, refreshKaraokeSongs, songsOnTheWay, } from './karaoke-songs'

/**
 * Where an offer was opened from. The onboarding opens it at its end (beat
 * 9) and as its own Not now leaves (`onboarding-exit`), apart so the two
 * are counted apart.
 */
export type CloudOfferSource =
  | 'import'
  | 'settings'
  | 'onboarding'
  | 'onboarding-exit'

/** The offer itself, or what follows a yes from the store. */
export type CloudOfferView = 'offer' | 'subscribed'

/** Opened by the singer's own tap, so no cap applies. */
const ASKED_FOR: Readonly<Record<CloudOfferSource, boolean>> = {
  import: true,
  settings: true,
  onboarding: false,
  'onboarding-exit': false,
}

/** After a Not now, no offer nobody asked for, for this long (S7 §5). */
export const NOT_NOW_QUIET_MS = 7 * 24 * 60 * 60 * 1000

/** How long the offer waits for the identity, the server and the store. */
export const BEFORE_OFFER_MS = 3_000

/** When the last Not now was said, on this phone; settings sync skips it. */
const NOT_NOW_KEY = 'mp:cloud-offer-not-now'

export interface CloudOfferState {
  readonly source: CloudOfferSource
  readonly view: CloudOfferView
}

const [current, setCurrent] = createSignal<CloudOfferState | null>(null)

/** The offer that is up, or null. Reactive. */
export const cloudOffer = current

const [guest, setGuest] = createSignal<Node | null>(null)

/**
 * Who stands by the offer's art while it is up, or null (S7b beat 9): the
 * onboarding's Merc, small beside the two lights, on the offer it opened.
 * The one Merc is moved into the sheet, not copied, and the sheet lets him
 * go as the offer closes. Reactive.
 */
export const cloudOfferGuest = guest

/** Merc by the art of the offer just opened; null to let him go. */
export function setCloudOfferGuest(node: Node | null): void {
  setGuest(node)
}

/** Whether the offer's sheet is up. Reactive. */
export function cloudOfferOpen(): boolean {
  return current() !== null
}

const [plan, setPlan] = createSignal<KaraokeOffer | null>(null)

/**
 * The month's plan at the store's own price, as the store last gave it, or
 * null before it has given one. The sheet opens on it, so an offer opened
 * once its price was in hand (the onboarding's, onboarding-offer.ts) shows
 * that price from its first frame instead of asking again. Reactive.
 */
export const cloudPlan = plan

/** Whether there is a store here to ask for a price at all. */
export function cloudPriceAskable(): boolean {
  return nativeShellApi()?.karaokeSubscription?.offer !== undefined
}

/**
 * Ask the store for the plan and its price: the plan, or null when it has
 * none to sell yet or there is no store. Rejects when the store cannot say.
 * Its answer is kept (cloudPlan), a plan or none.
 */
export async function askCloudPlan(): Promise<KaraokeOffer | null> {
  const ask = nativeShellApi()?.karaokeSubscription?.offer
  if (ask === undefined) {
    setPlan(null)
    return null
  }
  const found = await ask()
  setPlan(found)
  return found
}

/** Offers nobody asked for, this session. */
let unaskedThisSession = 0

/** Where storage is blocked, the session still remembers a Not now. */
let notNowThisSession: number | null = null

function lastNotNow(): number | null {
  try {
    const raw = localStorage.getItem(NOT_NOW_KEY)
    const at = raw === null ? Number.NaN : Number(raw)
    if (Number.isFinite(at)) return at
  } catch {
    // Blocked storage: fall back to this session's.
  }
  return notNowThisSession
}

function rememberNotNow(at: number): void {
  notNowThisSession = at
  try {
    localStorage.setItem(NOT_NOW_KEY, String(at))
  } catch {
    // Blocked storage: this session remembers.
  }
}

/**
 * The singer is singing, or about to: a song plays, a run is paused
 * mid-way or counting in, or the microphone is listening.
 */
export function singingNow(): boolean {
  const run = nativeRunControls()
  return (
    (run?.isPlaying() ?? false) ||
    (run?.isPaused() ?? false) ||
    (run?.isCountingIn?.() ?? false) ||
    micActive() ||
    singingCaptureActive()
  )
}

/** Why an offer nobody asked for would not open now. */
export type UnaskedRefusal = 'subscribed' | 'session' | 'not-now' | 'singing'

/** Why an offer nobody asked for would not open now, or null when it may. */
export function unaskedRefusal(
  now: number = Date.now(),
): UnaskedRefusal | null {
  if (karaokeSongs().subscribed || songsOnTheWay()) return 'subscribed'
  if (unaskedThisSession > 0) return 'session'
  const quietFrom = lastNotNow()
  if (quietFrom !== null && now - quietFrom < NOT_NOW_QUIET_MS) {
    return 'not-now'
  }
  if (singingNow()) return 'singing'
  return null
}

/** Ask the server until it has heard of the subscription the store sold. */
function waitForSongs(): Promise<KaraokeSongs> {
  return awaitSubscription(async () => refreshKaraokeSongs({ identify: true }))
}

/**
 * Open the offer, or what follows a yes from the store. An offer nobody
 * asked for passes the caps first and answers false when one holds it back.
 */
export function openCloudOffer(
  source: CloudOfferSource,
  view: CloudOfferView = 'offer',
  now: number = Date.now(),
): boolean {
  if (view === 'offer' && !ASKED_FOR[source]) {
    if (unaskedRefusal(now) !== null) return false
    unaskedThisSession += 1
  }
  setCurrent({ source, view })
  if (view === 'offer') trackEvent(CLOUD_VIEW_EVENT[source])
  if (view === 'subscribed' && !karaokeSongs().subscribed) void waitForSongs()
  return true
}

/**
 * The store said yes while the offer was up: say what follows, and ask the
 * server until it has heard. A caller that has already asked (a restore)
 * passes `wait: false`.
 */
export function showCloudSubscribed(wait = true): void {
  const open = current()
  if (open === null) return
  setCurrent({ source: open.source, view: 'subscribed' })
  if (wait) void waitForSongs()
}

/**
 * Close the offer. Not now (its button, Back, the backdrop, a swipe) keeps
 * offers nobody asked for away for a week; anything else does not.
 */
export function closeCloudOffer(
  how: 'not-now' | 'done',
  now: number = Date.now(),
): void {
  const open = current()
  setCurrent(null)
  setGuest(null)
  if (how === 'not-now' && open?.view === 'offer') rememberNotNow(now)
}

/** What is known just before an offer opens. */
export interface OfferFacts {
  /** What the server says now, or what was known before it. */
  readonly songs: KaraokeSongs
  /** The store holds the subscription for this singer. */
  readonly storeHolds: boolean
}

/**
 * Before an offer opens: the singer's identity (E11), the server's word on
 * the songs, and the store's on the subscription. Within BEFORE_OFFER_MS;
 * past that, what is known and no store, while the asks carry on. A
 * caller with an ask of its own before these passes its `deadline`, which
 * stands in for that wait, so the two share one (onboarding-offer.ts).
 */
export async function askBeforeOffering(
  deadline?: Promise<void>,
): Promise<OfferFacts> {
  const ask = (async (): Promise<OfferFacts> => {
    await ensureSingerIdentity()
    const storeSubscribed =
      nativeShellApi()?.karaokeSubscription?.storeSubscribed
    const [songs, storeHolds] = await Promise.all([
      refreshKaraokeSongs(),
      storeSubscribed === undefined
        ? Promise.resolve(false)
        : storeSubscribed().catch(() => false),
    ])
    return { songs, storeHolds }
  })()
  let timer: ReturnType<typeof setTimeout> | undefined
  const wait =
    deadline ??
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, BEFORE_OFFER_MS)
    })
  const late = wait.then(
    (): OfferFacts => ({ songs: karaokeSongs(), storeHolds: false }),
  )
  try {
    return await Promise.race([ask, late])
  } finally {
    clearTimeout(timer)
  }
}

/** Said once a sign-in has brought this phone's purchase to the account. */
export const CARRIED_LINE = `Your ${CLOUD_NAME} subscription is on this account now.`

/**
 * After a sign-in: a subscription this phone bought signed out goes to the
 * account, and the server is asked again, until it has heard of the move.
 * Without a store (or one that has nothing of this phone's) it only asks
 * the server, so what Settings shows is the account's, not the phone's.
 */
export async function settleCloudAfterSignIn(): Promise<KaraokeCarryOutcome> {
  const carry = nativeShellApi()?.karaokeSubscription?.carryToAccount
  const carried =
    carry === undefined
      ? 'nothing'
      : await carry().catch(() => 'failed' as const)
  if (carried === 'moved') {
    showNotification(CARRIED_LINE, 'success')
    await waitForSongs()
  } else {
    await refreshKaraokeSongs()
  }
  return carried
}

/**
 * "Replay the onboarding" (the Developer screen, test builds only): the
 * caps on an offer nobody asked for start over, nothing offered this
 * session and no Not now kept, so its beat 9 can open again.
 */
export function forgetUnaskedOffers(): void {
  unaskedThisSession = 0
  notNowThisSession = null
  try {
    localStorage.removeItem(NOT_NOW_KEY)
  } catch {
    // Nothing was kept.
  }
}

/** Tests: nothing open, nothing offered this session, no Not now kept. */
export function resetCloudOfferForTests(): void {
  setCurrent(null)
  setGuest(null)
  setPlan(null)
  forgetUnaskedOffers()
}
