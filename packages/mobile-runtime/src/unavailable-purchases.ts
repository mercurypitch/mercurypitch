// ============================================================
// Store-free purchase ports — honest no-ops for platforms without billing
// ============================================================
//
// Used by the web runtime and by a native runtime that was composed without
// store credentials. Reads resolve to an empty customer so a product can
// render its locked state without branching, while every write fails loudly
// rather than pretending a purchase happened.

import type { CustomerSnapshot, PaywallPort, PurchasesListenerHandle, PurchasesPort, } from './contracts'
import { PurchasesFailure } from './contracts'

const EMPTY_CUSTOMER: CustomerSnapshot = Object.freeze({
  appUserId: '',
  anonymous: true,
  entitlements: Object.freeze({}),
  activeEntitlementIds: Object.freeze([]),
  managementUrl: null,
})

export interface UnavailablePurchasesOptions {
  /** Shown to the customer, so products can name their own store. */
  message?: string
}

const DEFAULT_MESSAGE = 'Purchases are only available in the mobile app.'

export function createUnavailablePurchasesPort(
  options: UnavailablePurchasesOptions = {},
): PurchasesPort {
  const message = options.message ?? DEFAULT_MESSAGE
  const failure = (): PurchasesFailure =>
    new PurchasesFailure('unavailable', message)

  return {
    available: false,
    async initialize() {
      // Nothing to configure, and no reason to fail an app's start-up path.
    },
    async getCustomer() {
      return EMPTY_CUSTOMER
    },
    async getOfferings() {
      return { all: Object.freeze([]) }
    },
    async purchase() {
      throw failure()
    },
    async restore() {
      throw failure()
    },
    async addCustomerListener(): Promise<PurchasesListenerHandle> {
      return {
        async remove() {
          // No store events can arrive, so there is nothing to detach.
        },
      }
    },
    async logIn() {
      throw failure()
    },
    async logOut() {
      throw failure()
    },
  }
}

export function createUnavailablePaywallPort(
  options: UnavailablePurchasesOptions = {},
): PaywallPort {
  const message = options.message ?? DEFAULT_MESSAGE
  const failure = (): PurchasesFailure =>
    new PurchasesFailure('unavailable', message)

  return {
    available: false,
    async present() {
      throw failure()
    },
    async presentCustomerCenter() {
      throw failure()
    },
  }
}
