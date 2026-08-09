import type { CustomerInfo, PurchasesPackage, } from '@revenuecat/purchases-capacitor'
import { PACKAGE_TYPE, PURCHASES_ERROR_CODE, } from '@revenuecat/purchases-capacitor'
import { describe, expect, it } from 'vitest'
import { PurchasesFailure } from '../contracts'
import { toCustomerSnapshot, toPurchasePlan } from './purchases'

function customerInfo(overrides: Partial<CustomerInfo> = {}): CustomerInfo {
  const entitlement = {
    identifier: 'BeSideCue Pro',
    isActive: true,
    willRenew: false,
    periodType: 'TRIAL',
    latestPurchaseDate: '2026-08-01T00:00:00Z',
    latestPurchaseDateMillis: 0,
    originalPurchaseDate: '2026-08-01T00:00:00Z',
    originalPurchaseDateMillis: 0,
    expirationDate: null,
    expirationDateMillis: null,
    store: 'PLAY_STORE',
    productIdentifier: 'beside_cue_lifetime',
    productPlanIdentifier: null,
    isSandbox: true,
    unsubscribeDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAt: '2026-08-05T00:00:00Z',
    billingIssueDetectedAtMillis: 0,
    ownershipType: 'PURCHASED',
    verification: 'NOT_REQUESTED',
  }

  return {
    entitlements: {
      all: { 'BeSideCue Pro': entitlement },
      active: { 'BeSideCue Pro': entitlement },
      verification: 'NOT_REQUESTED',
    },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: '2026-08-01T00:00:00Z',
    originalAppUserId: '$RCAnonymousID:abc123',
    requestDate: '2026-08-06T00:00:00Z',
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: 'https://play.google.com/store/account/subscriptions',
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
    ...overrides,
  } as CustomerInfo
}

function storePackage(
  identifier: string,
  packageType: PACKAGE_TYPE,
): PurchasesPackage {
  return {
    identifier,
    packageType,
    offeringIdentifier: 'default',
    product: {
      identifier: `product.${identifier}`,
      title: 'Beside Cue Pro',
      description: 'Support the work',
      priceString: '€3.99',
      currencyCode: 'EUR',
    },
  } as unknown as PurchasesPackage
}

describe('customer snapshot mapping', () => {
  it('keeps a lifetime entitlement free of an expiry date', () => {
    const snapshot = toCustomerSnapshot(customerInfo())

    expect(snapshot.entitlements['BeSideCue Pro']?.expiresAt).toBeNull()
    expect(snapshot.activeEntitlementIds).toEqual(['BeSideCue Pro'])
  })

  it('reads a trial period and a billing issue', () => {
    const entitlement =
      toCustomerSnapshot(customerInfo()).entitlements['BeSideCue Pro']

    expect(entitlement?.periodKind).toBe('trial')
    expect(entitlement?.billingIssueDetectedAt).toEqual(
      new Date('2026-08-05T00:00:00Z'),
    )
  })

  it('recognises an identifier RevenueCat generated itself', () => {
    expect(toCustomerSnapshot(customerInfo()).anonymous).toBe(true)
    expect(
      toCustomerSnapshot(customerInfo({ originalAppUserId: 'customer-1' }))
        .anonymous,
    ).toBe(false)
  })
})

describe('plan mapping', () => {
  it('reads the kind from the package type', () => {
    expect(
      toPurchasePlan(storePackage('$rc_annual', PACKAGE_TYPE.ANNUAL)).kind,
    ).toBe('yearly')
    expect(
      toPurchasePlan(storePackage('$rc_lifetime', PACKAGE_TYPE.LIFETIME)).kind,
    ).toBe('lifetime')
  })

  it('falls back to the identifier for a custom package', () => {
    // A dashboard may publish "yearly" rather than the standard "$rc_annual".
    expect(
      toPurchasePlan(storePackage('yearly', PACKAGE_TYPE.CUSTOM)).kind,
    ).toBe('yearly')
    expect(
      toPurchasePlan(storePackage('lifetime', PACKAGE_TYPE.CUSTOM)).kind,
    ).toBe('lifetime')
    expect(
      toPurchasePlan(storePackage('monthly', PACKAGE_TYPE.CUSTOM)).kind,
    ).toBe('monthly')
  })

  it('leaves an unrecognised package kindless rather than guessing', () => {
    expect(
      toPurchasePlan(storePackage('founder-pack', PACKAGE_TYPE.CUSTOM)).kind,
    ).toBe('other')
  })

  it('carries the localized price through unchanged', () => {
    const plan = toPurchasePlan(storePackage('monthly', PACKAGE_TYPE.MONTHLY))

    expect(plan.priceText).toBe('€3.99')
    expect(plan.currencyCode).toBe('EUR')
    expect(plan.offeringId).toBe('default')
  })
})

describe('purchase failures', () => {
  it('names a reason the interface can act on', () => {
    const failure = new PurchasesFailure('network', 'offline')

    expect(failure.reason).toBe('network')
    expect(failure).toBeInstanceOf(Error)
  })

  it('models cancellation as a code, not a thrown failure', () => {
    // The adapter converts this code into a cancelled outcome; asserting the
    // code exists keeps that mapping honest if the SDK renumbers.
    expect(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR).toBe('1')
    expect(PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR).toBe('20')
  })
})
