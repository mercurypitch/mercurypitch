import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import type { ResettableBesideCueRepository } from './infrastructure/indexed-db-repository'
import { createIndexedDbBesideCueRepository } from './infrastructure/indexed-db-repository'
import type { BesideCuePlatform } from './infrastructure/mobile-runtime'
import { createBesideCueMobileRuntime, getBesideCuePlatform, } from './infrastructure/mobile-runtime'
import type { PurchasesSetup } from './purchases/revenuecat-config'
import { resolvePurchasesSetup } from './purchases/revenuecat-config'

export interface BesideCueAppServices {
  readonly repository: ResettableBesideCueRepository
  readonly runtime: Promise<MobileRuntime>
  readonly platform: BesideCuePlatform
  readonly purchases: PurchasesSetup
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

export function createDefaultAppServices(): BesideCueAppServices {
  const platform = getBesideCuePlatform()
  const purchases = resolvePurchasesSetup(platform, import.meta.env)

  return {
    repository: createIndexedDbBesideCueRepository(),
    runtime: createBesideCueMobileRuntime(purchases.config),
    platform,
    purchases,
    now: () => new Date(),
    createId: createLocalId,
  }
}
