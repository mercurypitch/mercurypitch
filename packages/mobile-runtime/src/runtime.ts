// ============================================================
// Mobile runtime composition — one dependency object for application shells
// ============================================================

import type { HapticsPort, LocalNotificationsPort, PaywallPort, PurchasesPort, } from './contracts'

export interface MobileRuntime {
  readonly haptics: HapticsPort
  readonly localNotifications: LocalNotificationsPort
  readonly purchases: PurchasesPort
  readonly paywall: PaywallPort
}

export function createMobileRuntime(runtime: MobileRuntime): MobileRuntime {
  return Object.freeze({
    haptics: runtime.haptics,
    localNotifications: runtime.localNotifications,
    purchases: runtime.purchases,
    paywall: runtime.paywall,
  })
}
