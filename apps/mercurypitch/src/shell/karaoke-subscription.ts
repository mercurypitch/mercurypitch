// ============================================================
// The Karaoke subscription, through the app's purchase ports (plan S8 §6.7)
// ============================================================
//
// The Karaoke room cannot import the shell, so its paywall and the Settings
// screen ask `nativeShellApi().karaokeSubscription`, and this is what answers.
// It is the one place that speaks to the store for the subscription, in the
// vocabulary of `@irchiinnuss/mobile-runtime`: plans, snapshots, outcomes.
//
// FAIL CLOSED. The app's own composition (infrastructure/mobile-runtime.ts)
// has no store until the products and the RevenueCat keys exist (owner, 27
// Sep; plan step 25), so `available` is false and every answer here is
// "unavailable", which the paywall says as "not available yet". Nothing is
// bought, and no identity is made for a store that is not there.
//
// WHO BUYS. The store is told the server's own user id before a purchase or
// a restore (logIn), because that id is what the RevenueCat webhook reads to
// know whom to give the songs to (workers/db-worker/src/revenuecat.ts). A
// phone the server cannot name buys nothing: the songs would go nowhere.
//
// WHAT IS BOUGHT. The current offering's monthly plan. With no such plan the
// store has nothing to sell yet, which is "unavailable" too.

import type { PaywallPort, PurchaseOutcome, PurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import type { KaraokeRestoreOutcome, KaraokeSubscribeOutcome, KaraokeSubscriptionApi, } from '@/stores/native-shell-store'

/**
 * The entitlement the Karaoke subscription unlocks. The db-worker grants the
 * songs for exactly this one (`SONGS_ENTITLEMENT`,
 * workers/db-worker/src/songs-allowance.ts); the two must stay equal.
 */
export const KARAOKE_ENTITLEMENT = 'cloud'

/** The two ports the subscription needs from the app's runtime. */
export interface KaraokeStore {
  readonly purchases: PurchasesPort
  readonly paywall: PaywallPort
}

/** The server's own id for this phone's user, or null when it has none. */
export type IdentifyForStore = () => Promise<string | null>

/** The store's own setup is not there yet: the products, the keys. */
function notThereYet(error: unknown): boolean {
  return (
    error instanceof PurchasesFailure &&
    (error.reason === 'unavailable' ||
      error.reason === 'configuration' ||
      error.reason === 'product-unavailable')
  )
}

function purchased(outcome: PurchaseOutcome): KaraokeSubscribeOutcome {
  switch (outcome.kind) {
    case 'purchased':
      return 'purchased'
    case 'pending':
      return 'pending'
    case 'cancelled':
      return 'cancelled'
  }
}

export function createKaraokeSubscription(
  store: KaraokeStore,
  identify: IdentifyForStore,
): KaraokeSubscriptionApi {
  const { purchases, paywall } = store

  /** Ready to buy as the server's user; false for a phone it cannot name. */
  async function signInToStore(): Promise<boolean> {
    await purchases.initialize()
    const id = await identify()
    if (id === null) return false
    await purchases.logIn(id)
    return true
  }

  async function subscribe(): Promise<KaraokeSubscribeOutcome> {
    if (!purchases.available) return 'unavailable'
    try {
      if (!(await signInToStore())) return 'failed'
      const offerings = await purchases.getOfferings()
      const monthly = offerings.current?.plans.find(
        (candidate) => candidate.kind === 'monthly',
      )
      if (monthly === undefined) return 'unavailable'
      return purchased(await purchases.purchase(monthly))
    } catch (error) {
      return notThereYet(error) ? 'unavailable' : 'failed'
    }
  }

  async function restore(): Promise<KaraokeRestoreOutcome> {
    if (!purchases.available) return 'unavailable'
    try {
      if (!(await signInToStore())) return 'failed'
      const customer = await purchases.restore()
      return customer.activeEntitlementIds.includes(KARAOKE_ENTITLEMENT)
        ? 'restored'
        : 'nothing'
    } catch (error) {
      return notThereYet(error) ? 'unavailable' : 'failed'
    }
  }

  return {
    subscribe,
    restore,
    // The store's own subscription page, where a subscriber cancels. Absent
    // with no store, so Settings draws no row that leads nowhere.
    ...(paywall.available
      ? { manage: async () => paywall.presentCustomerCenter() }
      : {}),
  }
}
