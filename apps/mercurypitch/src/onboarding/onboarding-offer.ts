// ============================================================
// Beat 9: the Cloud offer, once, after the sung line (S7b §3.1, §5)
// ============================================================
//
// The offer is the shell's one Cloud sheet (CloudOffer.tsx, paywall B "The
// path"), opened through cloud-offer-store.ts as an offer nobody asked for
// ('onboarding'), so every cap there holds: once a session, not for a week
// after a Not now, never while the mic listens, never for a subscriber.
// The onboarding adds its own rules:
//
//   - once per install: marked as it opens (OFFER_SHOWN_KEY), so an
//     onboarding begun again after the app was closed on the offer does
//     not offer it twice;
//   - the holdout (S7 D13, kept by S7b §7): one install in ten never gets
//     it, so what the offer costs in retention can be measured. The group
//     is drawn once, as the onboarding first opens (OFFER_GROUP_KEY), for
//     every install that starts it, whether or not it reaches beat 9;
//   - only after the sung line: Not now on the layer, at any beat, leaves
//     with no offer, and a refused mic never reaches the line (S7b E5);
//   - never with the subscription held: askBeforeOffering asks the server
//     and the store, which knows of a purchase first, after making the
//     singer's identity (E11), within three seconds. Begun as the line's
//     score shows, so it has its answer by the time Continue is tapped.
//
// A skipped range gets it all the same: its line is sung from a middle
// key, and the offer follows the line.
//
// THIS INSTALL'S: `mp:` keys, which the settings sync never pushes, stored
// as bare words so a walk can seed them (probe-onboarding.mjs). Where
// storage is blocked, the session remembers.

import type { UnaskedRefusal } from '@/features/karaoke-room/cloud-offer-store'
import { askBeforeOffering, openCloudOffer, unaskedRefusal, } from '@/features/karaoke-room/cloud-offer-store'
import { KARAOKE_IMPORT } from '@/lib/native-build'

/** This install's group: offered beat 9, or held out of it. */
export const OFFER_GROUP_KEY = 'mp:onboarding-offer-group'

/** 'shown' once beat 9 has opened the offer on this install. */
export const OFFER_SHOWN_KEY = 'mp:onboarding-cloud-offer'

/** The share of installs held out of beat 9. */
export const HOLDOUT_SHARE = 0.1

export type OfferGroup = 'offer' | 'holdout'

/** Why beat 9 opens no offer. */
export type OfferSkip =
  /** A build without Cloud: nothing to offer (S7b §3.2). */
  | 'no-cloud'
  | 'holdout'
  /** Offered once on this install already. */
  | 'shown'
  /** The server or the store says the subscription is held. */
  | 'entitled'
  | UnaskedRefusal

let groupThisSession: OfferGroup | null = null
let shownThisSession = false

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Blocked storage: this session remembers.
  }
}

const isGroup = (value: string | null): value is OfferGroup =>
  value === 'offer' || value === 'holdout'

/**
 * This install's group, drawn the first time it is asked for: one in ten
 * (HOLDOUT_SHARE) held out, kept for good.
 */
export function onboardingOfferGroup(
  random: () => number = Math.random,
): OfferGroup {
  const kept = read(OFFER_GROUP_KEY)
  if (isGroup(kept)) return kept
  groupThisSession ??= random() < HOLDOUT_SHARE ? 'holdout' : 'offer'
  write(OFFER_GROUP_KEY, groupThisSession)
  return groupThisSession
}

/** Whether beat 9 has opened the offer on this install. */
export function onboardingOfferShown(): boolean {
  return shownThisSession || read(OFFER_SHOWN_KEY) === 'shown'
}

/**
 * Why beat 9 would open no offer, on what is known without asking: the
 * build, the group, the mark, and the offer's own caps. The mic may still
 * be closing as the score shows; the offer opens only once it has.
 */
export function offerSkipNow(): OfferSkip | null {
  if (!KARAOKE_IMPORT) return 'no-cloud'
  if (onboardingOfferGroup() === 'holdout') return 'holdout'
  if (onboardingOfferShown()) return 'shown'
  const refused = unaskedRefusal()
  return refused === 'singing' ? null : refused
}

/**
 * The asks before beat 9 (askBeforeOffering), begun as the line's score
 * shows: why it opens no offer, or null. Asks nothing when a rule already
 * says no, so the holdout makes no identity here.
 */
export function prepareOnboardingOffer(): Promise<OfferSkip | null> {
  const now = offerSkipNow()
  if (now !== null) return Promise.resolve(now)
  return askBeforeOffering().then(
    (facts) => (facts.storeHolds || facts.songs.subscribed ? 'entitled' : null),
    // Unasked: the offer goes on what is known, as the sheet does.
    () => null,
  )
}

/**
 * Beat 9, after Continue on the line: the offer, when the asks and the
 * offer's own caps allow it, and `stands` still holds once the asks have
 * answered (the layer may have been left meanwhile). True when it opened.
 */
export async function openOnboardingOffer(
  prepared: Promise<OfferSkip | null>,
  stands: () => boolean = () => true,
): Promise<boolean> {
  if ((await prepared) !== null || !stands()) return false
  if (!openCloudOffer('onboarding')) return false
  shownThisSession = true
  write(OFFER_SHOWN_KEY, 'shown')
  return true
}

/**
 * "Replay the onboarding" (the Developer screen, test builds only): beat 9
 * to come again, in the group that is offered it.
 */
export function replayOnboardingOffer(): void {
  shownThisSession = false
  write(OFFER_SHOWN_KEY, null)
  groupThisSession = 'offer'
  write(OFFER_GROUP_KEY, 'offer')
}

/** Tests only: nothing drawn, nothing shown. */
export function resetOnboardingOfferForTests(): void {
  groupThisSession = null
  shownThisSession = false
  write(OFFER_GROUP_KEY, null)
  write(OFFER_SHOWN_KEY, null)
}
