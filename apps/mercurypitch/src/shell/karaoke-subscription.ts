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
//
// A PURCHASE MADE SIGNED OUT goes to the account signed in to after it
// (TestFlight build 919: it stayed with the phone until Restore purchase). A
// phone without an account buys as its own anonymous identity, whose id is
// the phone's device id, and keeps a note of it (SignedOutPurchaseNote).
// After a sign-in, `carryToAccount` asks RevenueCat whether that identity
// still holds the subscription and, when it does, restores as the account.
// RevenueCat moves it and says so in its TRANSFER webhook, which
// revenuecat.ts already follows (the entitlement, and an anonymous
// identity's songs), so every renewal after it names the account. A move the
// server made on its own would be undone by the next renewal, which RevenueCat
// would still file under the phone's id.
//
// NEVER ANOTHER ACCOUNT'S (owner rule D2: a phone can be shared). Only this
// phone's own anonymous identity's purchase moves by itself: the note says
// the phone bought it signed out, and RevenueCat says that identity holds it
// now. A subscription filed under any account stays where it is, and Restore
// purchase is the one way to move it. So the note goes once it no longer
// holds: the identity became an account itself (made in place, the same id;
// `settleNote`, on every change of session), the subscription moved, or the
// identity no longer has it.
//
// SUBSCRIBE WHEN THE STORE HAS IT. Subscribe carries this phone's own
// purchase first, and buys nothing. Otherwise it buys; a store that answers
// without giving this user the subscription, or refuses it as owned, holds it
// for another account: `held-elsewhere`, which the offer says, pointing to
// Restore purchase.
//
// ONE FLOW AT A TIME. logIn changes whom the store answers for, so the flows
// that name somebody run one after another and never interleave: a carry
// that had switched to the phone's identity must not hand a purchase to it.
//
// TIMED ON A TEST BUILD. A `timer` (subscription-timing.ts) times each step
// of a subscribe, a restore and a carry, for the Developer screen. Without
// one, nothing is timed.

import type { CustomerSnapshot, PaywallPort, PurchaseOutcome, PurchasePlan, PurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import type { KaraokeCarryOutcome, KaraokeManageOutcome, KaraokeOffer, KaraokeRestoreOutcome, KaraokeSubscribeOutcome, KaraokeSubscriptionApi, } from '@/stores/native-shell-store'

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

/** Who is on this phone, as the session it holds says. */
export interface PhoneIdentity {
  /** A real account is signed in; false on the phone's anonymous identity. */
  readonly accountHeld: () => boolean
  /** The account signed in, by the session's own id; null without one. */
  readonly accountId: () => string | null
  /** The phone's anonymous identity: the device id the server keys it on,
   *  '' when there is none. */
  readonly anonymousId: () => string
}

/**
 * This phone's note of the subscription the store gave its anonymous
 * identity, signed out: that identity's id, or null.
 */
export interface SignedOutPurchaseNote {
  read(): string | null
  write(anonymousId: string): void
  clear(): void
}

/** What is timed: one Subscribe, Restore purchase, or a sign-in's carry. */
export type TimedFlow = 'subscribe' | 'restore' | 'carry'

/** The steps a flow is timed by. */
export type TimedStep =
  | 'initialize'
  | 'identify'
  | 'logIn'
  | 'getOfferings'
  | 'getCustomer'
  | 'purchase'
  | 'restore'

/** One flow being timed. */
export interface TimedRun {
  step<T>(name: TimedStep, work: () => Promise<T>): Promise<T>
  end(outcome: string): void
}

/** Times the flows, on a test build (subscription-timing.ts). */
export interface SubscriptionTimer {
  begin(flow: TimedFlow): TimedRun
}

const UNTIMED: TimedRun = {
  step: async (_name, work) => work(),
  end: () => undefined,
}

export interface KaraokeSubscriptionOptions {
  /** Who is on the phone. Without it nothing is noted and nothing carried. */
  readonly phone?: PhoneIdentity
  readonly note?: SignedOutPurchaseNote
  readonly timer?: SubscriptionTimer
}

/** Where the note is kept: this phone's own, never synced (no
 *  `pitchperfect_` prefix). */
export const SIGNED_OUT_PURCHASE_KEY = 'mp:cloud-signed-out-purchase'

/**
 * The note, in this phone's storage. Where storage is blocked nothing is
 * noted, so nothing moves by itself, and Restore purchase still does.
 */
export function storedPurchaseNote(
  storage: () => Storage = () => localStorage,
): SignedOutPurchaseNote {
  return {
    read() {
      try {
        const kept = storage().getItem(SIGNED_OUT_PURCHASE_KEY)
        return kept === null || kept === '' ? null : kept
      } catch {
        return null
      }
    },
    write(anonymousId) {
      try {
        storage().setItem(SIGNED_OUT_PURCHASE_KEY, anonymousId)
      } catch {
        // Blocked storage: nothing is noted.
      }
    },
    clear() {
      try {
        storage().removeItem(SIGNED_OUT_PURCHASE_KEY)
      } catch {
        // Nothing was kept.
      }
    },
  }
}

/**
 * Forget the note once the phone's anonymous identity has become an account
 * itself (made in place, so the same id): what it bought is that account's,
 * and no later sign-in may take it anywhere. The wiring calls this on every
 * change of session, so a sign-in that never reached afterSignIn (a sheet
 * closed mid-request) counts too.
 */
export function settleNote(
  note: SignedOutPurchaseNote,
  phone: PhoneIdentity,
): void {
  const kept = note.read()
  if (kept !== null && phone.accountHeld() && phone.accountId() === kept) {
    note.clear()
  }
}

/** The store's own setup is not there yet: the products, the keys. */
function notThereYet(error: unknown): boolean {
  return (
    error instanceof PurchasesFailure &&
    (error.reason === 'unavailable' ||
      error.reason === 'configuration' ||
      error.reason === 'product-unavailable')
  )
}

/** The store keeps the subscription for another App User ID. */
function ownedElsewhere(error: unknown): boolean {
  return error instanceof PurchasesFailure && error.reason === 'already-owned'
}

const holds = (customer: CustomerSnapshot): boolean =>
  customer.activeEntitlementIds.includes(KARAOKE_ENTITLEMENT)

export function createKaraokeSubscription(
  store: KaraokeStore,
  identify: IdentifyForStore,
  options: KaraokeSubscriptionOptions = {},
): KaraokeSubscriptionApi {
  const { purchases, paywall } = store
  const { phone, note, timer } = options

  // ONE FLOW AT A TIME: each waits for the one before it, failed or not.
  let queue: Promise<unknown> = Promise.resolve()

  function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
    const turn = queue.then(work, work)
    queue = turn.catch(() => undefined)
    return turn
  }

  /** A flow, timed where a timer was given. Runs inside oneAtATime. */
  async function timed<T extends string>(
    name: TimedFlow,
    work: (run: TimedRun) => Promise<T>,
  ): Promise<T> {
    const run = timer?.begin(name) ?? UNTIMED
    let outcome = 'threw'
    try {
      const answer = await work(run)
      outcome = answer
      return answer
    } finally {
      run.end(outcome)
    }
  }

  /** The store set up, and the server's id for whoever is on the phone. */
  async function whoIsHere(run: TimedRun): Promise<string | null> {
    await run.step('initialize', async () => purchases.initialize())
    return run.step('identify', identify)
  }

  async function logIn(run: TimedRun, id: string): Promise<void> {
    await run.step('logIn', async () => purchases.logIn(id))
  }

  /** Ready to buy as the server's user; null for a phone it cannot name. */
  async function signInToStore(run: TimedRun): Promise<string | null> {
    const id = await whoIsHere(run)
    if (id !== null) await logIn(run, id)
    return id
  }

  /** The phone is on its anonymous identity, and `id` is that identity. */
  function anonymousHere(id: string): boolean {
    return (
      phone !== undefined && !phone.accountHeld() && id === phone.anonymousId()
    )
  }

  /** Note what the store gave the phone's anonymous identity. */
  function noteSignedOut(id: string): void {
    if (anonymousHere(id)) note?.write(id)
  }

  /**
   * The phone's own anonymous identity, when it bought the subscription
   * signed out and `account` is a different account signed in now. Forgets
   * a note that can no longer apply: another device id, or an account made
   * of that identity in place, which already has what it bought.
   */
  function carriedFrom(account: string): string | null {
    if (note === undefined || phone === undefined) return null
    if (!phone.accountHeld()) return null
    const anonymous = note.read()
    if (anonymous === null) return null
    if (anonymous !== phone.anonymousId() || anonymous === account) {
      note.clear()
      return null
    }
    return anonymous
  }

  /**
   * Move the phone's own purchase to `account`, when RevenueCat says the
   * phone's anonymous identity still holds it: a restore as the account,
   * which RevenueCat files under the account and reports as a TRANSFER.
   * Whatever it finds, the store answers for the account afterwards.
   */
  async function carry(
    run: TimedRun,
    anonymous: string,
    account: string,
  ): Promise<'moved' | 'nothing' | 'failed'> {
    let heldThere = false
    try {
      await logIn(run, anonymous)
      const there = await run.step('getCustomer', async () =>
        purchases.getCustomer({ refresh: true }),
      )
      heldThere = holds(there)
    } finally {
      await logIn(run, account)
    }
    if (!heldThere) {
      // Ended, or moved on to an account: never this sign-in's to take.
      note?.clear()
      return 'nothing'
    }
    const customer = await run.step('restore', async () => purchases.restore())
    if (!holds(customer)) return 'failed'
    note?.clear()
    return 'moved'
  }

  /** The current offering's monthly plan, if the store has one to sell. */
  async function monthlyPlan(): Promise<PurchasePlan | undefined> {
    const offerings = await purchases.getOfferings()
    return offerings.current?.plans.find(
      (candidate) => candidate.kind === 'monthly',
    )
  }

  /** What a purchase ended in, for the buyer `id`. */
  function bought(
    outcome: PurchaseOutcome,
    id: string,
  ): KaraokeSubscribeOutcome {
    switch (outcome.kind) {
      case 'purchased':
        // The store sold nothing new: its account already pays for the
        // subscription, and RevenueCat keeps it filed under another one.
        if (!holds(outcome.customer)) return 'held-elsewhere'
        noteSignedOut(id)
        return 'purchased'
      case 'pending':
        noteSignedOut(id)
        return 'pending'
      case 'cancelled':
        return 'cancelled'
    }
  }

  async function subscribe(): Promise<KaraokeSubscribeOutcome> {
    if (!purchases.available) return 'unavailable'
    return oneAtATime(async () =>
      timed('subscribe', async (run) => {
        try {
          const id = await whoIsHere(run)
          if (id === null) return 'failed'
          const anonymous = carriedFrom(id)
          if (anonymous === null) await logIn(run, id)
          else {
            // This phone bought it signed out: bring it here, buy nothing.
            const carried = await carry(run, anonymous, id)
            if (carried !== 'nothing') return carried
          }
          const monthly = await run.step('getOfferings', monthlyPlan)
          if (monthly === undefined) return 'unavailable'
          const outcome = await run.step('purchase', async () =>
            purchases.purchase(monthly),
          )
          return bought(outcome, id)
        } catch (error) {
          if (ownedElsewhere(error)) return 'held-elsewhere'
          return notThereYet(error) ? 'unavailable' : 'failed'
        }
      }),
    )
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
    return oneAtATime(async () =>
      timed('restore', async (run) => {
        try {
          const id = await signInToStore(run)
          if (id === null) return 'failed'
          const customer = await run.step('restore', async () =>
            purchases.restore(),
          )
          if (!holds(customer)) return 'nothing'
          // Signed out, the phone's identity has it now; an account that
          // restored it has it, and any note of the phone's is spent.
          if (anonymousHere(id)) note?.write(id)
          else if (phone?.accountHeld() === true) note?.clear()
          return 'restored'
        } catch (error) {
          return notThereYet(error) ? 'unavailable' : 'failed'
        }
      }),
    )
  }

  /** After a sign-in: the purchase this phone made signed out, to the
   *  account. A phone that made none asks the store nothing. */
  async function carryToAccount(): Promise<KaraokeCarryOutcome> {
    if (!purchases.available) return 'unavailable'
    return oneAtATime(async () => {
      if (note?.read() == null || phone?.accountHeld() !== true) {
        return 'nothing'
      }
      return timed('carry', async (run) => {
        try {
          const account = await whoIsHere(run)
          if (account === null) return 'failed'
          const anonymous = carriedFrom(account)
          return anonymous === null
            ? 'nothing'
            : await carry(run, anonymous, account)
        } catch (error) {
          return notThereYet(error) ? 'unavailable' : 'failed'
        }
      })
    })
  }

  /** The store's own subscription page, where a subscriber cancels, as the
   *  server's user: never the store's anonymous id, whose restore there
   *  could move the subscription to an id the webhook does not know. */
  async function manage(): Promise<KaraokeManageOutcome> {
    return oneAtATime(async () => {
      try {
        if ((await signInToStore(UNTIMED)) === null) return 'failed'
        await paywall.presentCustomerCenter()
        return 'opened'
      } catch {
        return 'failed'
      }
    })
  }

  /** Whether the store holds the subscription for the server's user. */
  async function storeSubscribed(): Promise<boolean> {
    if (!purchases.available) return false
    return oneAtATime(async () => {
      try {
        if ((await signInToStore(UNTIMED)) === null) return false
        return holds(await purchases.getCustomer())
      } catch {
        return false
      }
    })
  }

  return {
    subscribe,
    restore,
    offer,
    storeSubscribed,
    carryToAccount,
    // Absent with no store, so Settings draws no row that leads nowhere.
    ...(paywall.available && purchases.available ? { manage } : {}),
  }
}
