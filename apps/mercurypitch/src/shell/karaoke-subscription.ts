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
// has a store only where the build carries its platform's RevenueCat key
// (plan step 25). Without one, `available` is false and every answer here
// is "unavailable", which the paywall says as "not available yet"; so is a
// store whose products do not exist yet. Nothing is bought, and no identity
// is made for a store that is not there.
//
// WHO BUYS. The store is told the server's own user id before a purchase, a
// restore, its subscription page, or the question whether it holds the
// subscription (logIn), because that id is what the RevenueCat webhook reads
// to know whom to give the songs to (workers/db-worker/src/revenuecat.ts).
// A phone the server cannot name buys nothing: the songs would go nowhere.
// Signing in happens when one of those is asked for, never at app start.
//
// WHAT IS BOUGHT. The current offering's monthly plan: Mercury Pitch Cloud
// (owner, S7 D2). With no such plan the store has nothing to sell yet,
// which is "unavailable" too. The paywall states its price as the store
// does, in the singer's own storefront (offer), never a price of our own.

import type { PaywallPort, PurchaseOutcome, PurchasePlan, PurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import type { KaraokeManageOutcome, KaraokeOffer, KaraokeRestoreOutcome, KaraokeSubscribeOutcome, KaraokeSubscriptionApi, } from '@/stores/native-shell-store'

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

  /** The current offering's monthly plan, if the store has one to sell. */
  async function monthlyPlan(): Promise<PurchasePlan | undefined> {
    const offerings = await purchases.getOfferings()
    return offerings.current?.plans.find(
      (candidate) => candidate.kind === 'monthly',
    )
  }

  async function subscribe(): Promise<KaraokeSubscribeOutcome> {
    if (!purchases.available) return 'unavailable'
    try {
      if (!(await signInToStore())) return 'failed'
      const monthly = await monthlyPlan()
      if (monthly === undefined) return 'unavailable'
      return purchased(await purchases.purchase(monthly))
    } catch (error) {
      return notThereYet(error) ? 'unavailable' : 'failed'
    }
  }

  /** What the paywall states: reading the store's catalogue needs nobody
   *  named, so nothing is identified for it. Null while the store has no
   *  plan to sell yet; a store that cannot say rejects, so the paywall can
   *  ask again. */
  async function offer(): Promise<KaraokeOffer | null> {
    if (!purchases.available) return null
    try {
      const monthly = await monthlyPlan()
      return monthly === undefined
        ? null
        : { priceText: monthly.priceText, title: monthly.title }
    } catch (error) {
      if (notThereYet(error)) return null
      throw error
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

  /** The store's own subscription page, where a subscriber cancels, as the
   *  server's user: never the store's anonymous id, whose restore there
   *  could move the subscription to an id the webhook does not know. */
  async function manage(): Promise<KaraokeManageOutcome> {
    try {
      if (!(await signInToStore())) return 'failed'
      await paywall.presentCustomerCenter()
      return 'opened'
    } catch {
      return 'failed'
    }
  }

  /** Whether the store holds the subscription for the server's user. */
  async function storeSubscribed(): Promise<boolean> {
    if (!purchases.available) return false
    try {
      if (!(await signInToStore())) return false
      const customer = await purchases.getCustomer()
      return customer.activeEntitlementIds.includes(KARAOKE_ENTITLEMENT)
    } catch {
      return false
    }
  }

  return {
    subscribe,
    restore,
    offer,
    storeSubscribed,
    // Absent with no store, so Settings draws no row that leads nowhere.
    ...(paywall.available && purchases.available ? { manage } : {}),
  }
}
