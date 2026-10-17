// ============================================================
// A fake RevenueCat: one store account, and whose its subscription is
// ============================================================
//
// The phone's store account (an Apple ID, a Google account) holds at most one
// Mercury Pitch Cloud subscription, and RevenueCat files it under one App User
// ID at a time. This fake keeps exactly that much: whom the SDK is identified
// as now (`logIn`), and which App User ID the store account's subscription is
// filed under. The app tells the store the server's own user id (this phone's
// anonymous identity, or the account), so "filed under" is "whose it is".
//
// Restore files it under whoever restores: RevenueCat's "Transfer to new App
// User ID", which the owner's Restore on TestFlight build 919 showed is the
// project's setting. Buying a subscription the store account already has,
// filed under somebody else, does what `alreadyOwned` says, because that is
// the part no test can know for certain: TestFlight answered build 919 with
// Apple's own "You're subscribed" and no change at all ('store-cancels').
//
// Every move is reported as RevenueCat's webhook would report it, so a fake
// server can follow (`onEvent`).

import type { CustomerSnapshot, PaywallPort, PurchaseOfferings, PurchaseOutcome, PurchasePlan, PurchasePlanHandle, PurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import { createCustomerSnapshot } from '@irchiinnuss/mobile-runtime/testing'

/** The entitlement the subscription unlocks (KARAOKE_ENTITLEMENT). */
const CLOUD = 'cloud'

export const MONTHLY: PurchasePlan = {
  id: '$rc_monthly',
  kind: 'monthly',
  offeringId: 'default',
  productId: 'mp.cloud.monthly',
  title: 'Mercury Pitch Cloud',
  description: '20 songs a month',
  priceText: '€4.99',
  currencyCode: 'EUR',
  handle: {} as PurchasePlanHandle,
}

const OFFERINGS: PurchaseOfferings = {
  current: { id: 'default', description: 'Cloud', plans: [MONTHLY] },
  all: [],
}

/**
 * What a purchase does when the store account's subscription is already
 * filed under another App User ID.
 *  - 'store-cancels': the store says it is already subscribed and the
 *    purchase comes back cancelled. Nothing moves.
 *  - 'kept': RevenueCat answers, and keeps it with the App User ID it has.
 *  - 'refused': RevenueCat refuses with receipt_already_in_use.
 *  - 'transferred': RevenueCat applies its transfer to the purchase too.
 */
export type AlreadyOwned = 'store-cancels' | 'kept' | 'refused' | 'transferred'

/** What RevenueCat's webhook tells the server, in the fake's words. */
export type FakeStoreEvent =
  | { readonly type: 'INITIAL_PURCHASE'; readonly appUserId: string }
  | { readonly type: 'TRANSFER'; readonly from: string; readonly to: string }

export interface FakeRevenueCatOptions {
  /** Whose the store account's subscription is at the start; null for none. */
  readonly owner?: string | null
  readonly alreadyOwned?: AlreadyOwned
  readonly onEvent?: (event: FakeStoreEvent) => void
}

export interface FakeRevenueCat {
  readonly purchases: PurchasesPort
  readonly paywall: PaywallPort
  /** Every store call, in order, with the App User ID it ran as. */
  readonly calls: string[]
  /** Whose the store account's subscription is now; null for none. */
  owner(): string | null
  /** Another phone on the same store account taps Restore as `id`. */
  restoreElsewhereAs(id: string): void
  /** The store files a purchase under `id`: a pending one approved, say. */
  grant(id: string): void
  /** The next call to `method` fails with `error`, once. */
  failNext(method: 'restore' | 'getCustomer', error: unknown): void
  /** The calls made after `mark`, a length of `calls` read earlier. */
  since(mark: number): string[]
}

export function fakeRevenueCat(
  options: FakeRevenueCatOptions = {},
): FakeRevenueCat {
  let current: string | null = null
  let owner = options.owner ?? null
  const alreadyOwned = options.alreadyOwned ?? 'store-cancels'
  const calls: string[] = []
  const failing = new Map<'restore' | 'getCustomer', unknown>()

  /** Throws the failure a test asked for, once. */
  const failIfAsked = (method: 'restore' | 'getCustomer'): void => {
    if (!failing.has(method)) return
    const error = failing.get(method)
    failing.delete(method)
    throw error
  }

  const snapshot = (id: string | null): CustomerSnapshot =>
    createCustomerSnapshot(id !== null && owner === id ? [CLOUD] : [], {
      appUserId: id ?? '$RCAnonymousID:fake',
      anonymous: id === null,
    })

  const fileUnder = (to: string): void => {
    const from = owner
    owner = to
    if (from !== null && from !== to) {
      options.onEvent?.({ type: 'TRANSFER', from, to })
    }
  }

  const purchases: PurchasesPort = {
    available: true,
    async initialize() {
      calls.push('initialize')
    },
    async getCustomer() {
      calls.push(`getCustomer ${current ?? 'anonymous'}`)
      failIfAsked('getCustomer')
      return snapshot(current)
    },
    async getOfferings() {
      calls.push('getOfferings')
      return OFFERINGS
    },
    async purchase(): Promise<PurchaseOutcome> {
      calls.push(`purchase ${current ?? 'anonymous'}`)
      const buyer = current
      if (buyer === null) throw new PurchasesFailure('unknown', 'nobody named')
      if (owner === null) {
        owner = buyer
        options.onEvent?.({ type: 'INITIAL_PURCHASE', appUserId: buyer })
      } else if (owner !== buyer) {
        switch (alreadyOwned) {
          case 'store-cancels':
            return { kind: 'cancelled' }
          case 'refused':
            throw new PurchasesFailure(
              'already-owned',
              'There is already another active subscriber using the same receipt.',
            )
          case 'transferred':
            fileUnder(buyer)
            break
          case 'kept':
            break
        }
      }
      return {
        kind: 'purchased',
        customer: snapshot(buyer),
        productId: MONTHLY.productId,
      }
    },
    async restore() {
      calls.push(`restore ${current ?? 'anonymous'}`)
      failIfAsked('restore')
      if (current !== null && owner !== null) fileUnder(current)
      return snapshot(current)
    },
    async addCustomerListener() {
      return { remove: async () => undefined }
    },
    async logIn(id) {
      calls.push(`logIn ${id}`)
      current = id
      return snapshot(id)
    },
    async logOut() {
      calls.push('logOut')
      current = null
      return snapshot(null)
    },
  }

  const paywall: PaywallPort = {
    available: true,
    async present() {
      return 'cancelled'
    },
    async presentCustomerCenter() {
      calls.push(`customer center ${current ?? 'anonymous'}`)
    },
  }

  return {
    purchases,
    paywall,
    calls,
    owner: () => owner,
    restoreElsewhereAs(id) {
      if (owner !== null) fileUnder(id)
    },
    grant(id) {
      owner = id
      options.onEvent?.({ type: 'INITIAL_PURCHASE', appUserId: id })
    },
    failNext(method, error) {
      failing.set(method, error)
    },
    since: (mark) => calls.slice(mark),
  }
}
