import { Capacitor } from '@capacitor/core'
import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import type { PurchasesConfig } from '@/purchases/revenuecat-config'

export type BesideCuePlatform = 'web' | 'android' | 'ios'

export function getBesideCuePlatform(): BesideCuePlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios' ? platform : 'web'
}

/**
 * Purchases stay opt-in: without a resolved store configuration the native
 * runtime composes the same store-free ports the web build uses, so the
 * RevenueCat plugin is never configured with a key this build should not use.
 */
export async function createBesideCueMobileRuntime(
  purchases?: PurchasesConfig,
): Promise<MobileRuntime> {
  if (Capacitor.isNativePlatform()) {
    const { createCapacitorMobileRuntime } =
      await import('@irchiinnuss/mobile-runtime/capacitor')
    return createCapacitorMobileRuntime({
      ...(purchases === undefined ? {} : { purchases }),
    })
  }

  const { createWebMobileRuntime } =
    await import('@irchiinnuss/mobile-runtime/web')
  return createWebMobileRuntime({
    onForegroundNotification: (delivery) => delivery.performAction('open'),
  })
}
