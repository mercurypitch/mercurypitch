import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createMobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createSignal } from 'solid-js'
import type { ResettableBesideCueRepository } from './infrastructure/indexed-db-repository'
import { createIndexedDbBesideCueRepository } from './infrastructure/indexed-db-repository'
import type { BesideCuePlatform } from './infrastructure/mobile-runtime'
import { createBesideCueMobileRuntime, getBesideCuePlatform, } from './infrastructure/mobile-runtime'
import type { CinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'
import { createCinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'
import type { MockPurchaseRequest } from './purchases/mock-purchases'
import { isMockPurchasesEnabled } from './purchases/mock-purchases-flag'
import type { PurchasesSetup } from './purchases/revenuecat-config'
import { resolvePurchasesSetup } from './purchases/revenuecat-config'

export interface BesideCueAppServices {
  readonly repository: ResettableBesideCueRepository
  readonly runtime: Promise<MobileRuntime>
  readonly platform: BesideCuePlatform
  readonly purchases: PurchasesSetup
  readonly onboardingPreferences: CinematicOnboardingPreferenceStore
  /**
   * Set only by a development build running the fake store. The app renders the
   * mock overlay from it; a shipped build leaves it undefined.
   */
  readonly mockPurchaseRequest?: () => MockPurchaseRequest | undefined
  readonly now: () => Date
  readonly createId: () => string
}

function createLocalId(): string {
  if (typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }

  const values = new Uint32Array(4)
  window.crypto.getRandomValues(values)
  return [...values].map((value) => value.toString(36)).join('-')
}

/**
 * Swaps the store-free web ports for the fake store, keeping the real web
 * haptics and notification ports underneath so only purchases are pretend.
 */
async function createMockedRuntime(
  entitlementId: string,
  onRequest: (request: MockPurchaseRequest | undefined) => void,
): Promise<MobileRuntime> {
  const [base, { createMockPurchases }] = await Promise.all([
    createBesideCueMobileRuntime(),
    import('./purchases/mock-purchases'),
  ])
  const mock = createMockPurchases({ entitlementId, onRequest })

  return createMobileRuntime({
    haptics: base.haptics,
    localNotifications: base.localNotifications,
    purchases: mock.purchases,
    paywall: mock.paywall,
  })
}

export function createDefaultAppServices(): BesideCueAppServices {
  const platform = getBesideCuePlatform()
  const purchases = resolvePurchasesSetup(platform, import.meta.env)
  const repository = createIndexedDbBesideCueRepository()

  // The literal DEV test is what lets the bundler delete this whole branch, and
  // with it the dynamic import of the fake store, from a production build.
  if (
    import.meta.env.DEV &&
    isMockPurchasesEnabled(import.meta.env, window.location.search)
  ) {
    const [mockPurchaseRequest, setMockPurchaseRequest] =
      createSignal<MockPurchaseRequest>()

    return {
      repository,
      runtime: createMockedRuntime(purchases.entitlementId, (request) => {
        setMockPurchaseRequest(request)
      }),
      platform,
      // Reported as configured so the Pro surface behaves the way it does on a
      // device instead of showing the store-free notice. No adapter reads this
      // key — the mock ports never reach RevenueCat. The offering is dropped
      // because the fake store publishes exactly one, as `current`.
      purchases: {
        entitlementId: purchases.entitlementId,
        config: { apiKey: 'mock-store', logLevel: 'debug' },
      },
      onboardingPreferences: createCinematicOnboardingPreferenceStore(),
      mockPurchaseRequest,
      now: () => new Date(),
      createId: createLocalId,
    }
  }

  return {
    repository,
    runtime: createBesideCueMobileRuntime(purchases.config),
    platform,
    purchases,
    onboardingPreferences: createCinematicOnboardingPreferenceStore(),
    now: () => new Date(),
    createId: createLocalId,
  }
}
