// ============================================================
// Beat 9: the Cloud offer, once, after the sung line or at Not now (S7b §5)
// ============================================================
//
// The offer is the shell's one Cloud sheet (CloudOffer.tsx, paywall B "The
// path"), opened through cloud-offer-store.ts as an offer nobody asked for,
// so every cap there holds: once a session, not for a week after a Not now,
// never while the mic listens, never for a subscriber. It opens at the
// onboarding's end ('onboarding'), and on its own Not now at any beat
// ('onboarding-exit', owner, 20 Oct 2026), counted apart. The onboarding
// adds its own rules, the same for both:
//
//   - once per install: marked as it opens (OFFER_SHOWN_KEY), so an
//     onboarding begun again after the app was closed on the offer does
//     not offer it twice;
//   - the holdout (S7 D13, kept by S7b §7): one install in ten never gets
//     it, so what the offer costs in retention can be measured. The group
//     is drawn once, as the onboarding first opens (OFFER_GROUP_KEY), for
//     every install that starts it, whether or not it reaches an offer;
//   - never after a refused mic, or one that would not open, and not
//     granted since (S7b E5): the layer checks that itself, at its Not now
//     (NativeOnboarding.tsx), and a refused mic never reaches the line;
//   - never without a price to show: a store here, with the month's plan to
//     sell, priced (cloud-offer-store.ts askCloudPlan). Without one the
//     sheet could only say "Subscriptions are not available yet." over a
//     Subscribe that cannot be tapped, a paywall in the way of the end with
//     nothing behind it. The price makes no identity, so it is asked as the
//     onboarding opens (askOfferPrice) and is known long before the end;
//     nothing else is asked, nor any identity made, for an offer that
//     cannot open; the sheet then opens on the price it was given;
//   - never with the subscription held: askBeforeOffering asks the server
//     and the store, which knows of a purchase first, after making the
//     singer's identity (E11). Begun as the line's score shows, so it has
//     its answer by the time Continue is tapped; at Not now, begun in the
//     tap, the layer up and waiting on them.
//
// The price and these asks share one wait of three seconds
// (BEFORE_OFFER_MS): asked one after the other with a wait each, a slow
// store kept the layer waiting six.
//
// A skipped range gets it all the same: its line is sung from a middle
// key, and the offer follows the line.
//
// THIS INSTALL'S: `mp:` keys, which the settings sync never pushes, stored
// as bare words so a walk can seed them (probe-onboarding.mjs). Where
// storage is blocked, the session remembers.

import type { CloudOfferSource, UnaskedRefusal, } from '@/features/karaoke-room/cloud-offer-store'
import { askBeforeOffering, askCloudPlan, BEFORE_OFFER_MS, cloudPriceAskable, openCloudOffer, unaskedRefusal, } from '@/features/karaoke-room/cloud-offer-store'
import { trackNativeOnboarding } from '@/features/onboarding/funnel'
import { KARAOKE_IMPORT } from '@/lib/native-build'

/** This install's group: offered beat 9, or held out of it. */
export const OFFER_GROUP_KEY = 'mp:onboarding-offer-group'

/** 'shown' once the onboarding has opened the offer on this install. */
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
  /**
   * Nothing to buy at a price: no store here, none with the plan to sell
   * yet, or one that could not say in time.
   */
  | 'unavailable'
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
  if (groupThisSession === null) {
    groupThisSession = random() < HOLDOUT_SHARE ? 'holdout' : 'offer'
    // Counted as it is drawn, so the held-out installs can be told apart
    // when their retention is read (S7b §7).
    trackNativeOnboarding(
      groupThisSession === 'holdout'
        ? 'native_onboarding_group_holdout'
        : 'native_onboarding_group_offer',
    )
  }
  write(OFFER_GROUP_KEY, groupThisSession)
  return groupThisSession
}

/** Whether the onboarding has opened the offer on this install. */
export function onboardingOfferShown(): boolean {
  return shownThisSession || read(OFFER_SHOWN_KEY) === 'shown'
}

/**
 * Why beat 9 would open no offer, on what is known without asking: the
 * build, the group, the mark, a store to ask for a price, and the offer's
 * own caps. The mic may still be closing as the score shows; the offer
 * opens only once it has.
 */
export function offerSkipNow(): OfferSkip | null {
  if (!KARAOKE_IMPORT) return 'no-cloud'
  if (onboardingOfferGroup() === 'holdout') return 'holdout'
  if (onboardingOfferShown()) return 'shown'
  if (!cloudPriceAskable()) return 'unavailable'
  const refused = unaskedRefusal()
  return refused === 'singing' ? null : refused
}

/**
 * Whether the store has the plan to sell, priced: asked of it now, as the
 * onboarding opens, since asking makes no identity. Null when a rule says
 * no already, so the holdout asks nothing. A store that cannot say: no.
 */
export function askOfferPrice(): Promise<boolean> | null {
  if (offerSkipNow() !== null) return null
  return askCloudPlan().then(
    (plan) => plan !== null,
    () => false,
  )
}

/**
 * The asks before beat 9, begun as the line's score shows: the price
 * (`price`, asked as the layer opened, else now), then askBeforeOffering,
 * all within one BEFORE_OFFER_MS; why it opens no offer, or null. Asks
 * nothing when a rule already says no, and nothing past a store with no
 * price, so the holdout, and an install with nothing to buy, make no
 * identity here.
 */
export async function prepareOnboardingOffer(
  price: Promise<boolean> | null = null,
): Promise<OfferSkip | null> {
  const now = offerSkipNow()
  if (now !== null) return now
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, BEFORE_OFFER_MS)
  })
  try {
    const priced = await Promise.race([
      price ?? askOfferPrice() ?? Promise.resolve(false),
      deadline.then(() => false),
    ])
    if (!priced) return 'unavailable'
    return await askBeforeOffering(deadline).then(
      (facts) =>
        facts.storeHolds || facts.songs.subscribed ? 'entitled' : null,
      // Unasked: the offer goes on what is known, as the sheet does.
      () => null,
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Where the onboarding opens the offer: its end, or its Not now. */
export type OnboardingOfferSource = Extract<
  CloudOfferSource,
  'onboarding' | 'onboarding-exit'
>

/**
 * Beat 9, after Continue on the line, or the onboarding's Not now: the
 * offer, when the asks and the offer's own caps allow it, and `stands`
 * still holds once the asks have answered (the layer may have been left
 * meanwhile). True when it opened.
 */
export async function openOnboardingOffer(
  prepared: Promise<OfferSkip | null>,
  stands: () => boolean = () => true,
  source: OnboardingOfferSource = 'onboarding',
): Promise<boolean> {
  if ((await prepared) !== null || !stands()) return false
  if (!openCloudOffer(source)) return false
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
