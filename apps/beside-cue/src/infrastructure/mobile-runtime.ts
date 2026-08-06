import { Capacitor } from '@capacitor/core'
import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'

export type BesideCuePlatform = 'web' | 'android' | 'ios'

export function getBesideCuePlatform(): BesideCuePlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios' ? platform : 'web'
}

export async function createBesideCueMobileRuntime(): Promise<MobileRuntime> {
  if (Capacitor.isNativePlatform()) {
    const { createCapacitorMobileRuntime } =
      await import('@irchiinnuss/mobile-runtime/capacitor')
    return createCapacitorMobileRuntime()
  }

  const { createWebMobileRuntime } =
    await import('@irchiinnuss/mobile-runtime/web')
  return createWebMobileRuntime({
    onForegroundNotification: (delivery) => delivery.performAction('open'),
  })
}
