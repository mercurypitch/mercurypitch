import { createCapacitorHapticsPort } from './capacitor/haptics'
import type { CapacitorLocalNotificationsOptions } from './capacitor/local-notifications'
import { createCapacitorLocalNotificationsPort } from './capacitor/local-notifications'
import type { CapacitorPurchasesOptions } from './capacitor/purchases'
import { createCapacitorPurchasesPort } from './capacitor/purchases'
import { createCapacitorPaywallPort } from './capacitor/purchases-ui'
import type { MobileRuntime } from './runtime'
import { createMobileRuntime } from './runtime'
import { createUnavailablePaywallPort, createUnavailablePurchasesPort, } from './unavailable-purchases'

export { createCapacitorHapticsPort } from './capacitor/haptics'
export type { CapacitorLocalNotificationsOptions } from './capacitor/local-notifications'
export { createCapacitorLocalNotificationsPort } from './capacitor/local-notifications'
export type {
  CapacitorPurchasesOptions,
  PurchasesLogLevel,
} from './capacitor/purchases'
export { createCapacitorPurchasesPort } from './capacitor/purchases'
export { createCapacitorPaywallPort } from './capacitor/purchases-ui'

export interface CapacitorMobileRuntimeOptions extends CapacitorLocalNotificationsOptions {
  /** Omit to run without a store; purchases then report themselves unavailable. */
  purchases?: CapacitorPurchasesOptions
}

/**
 * Convenience composition for apps that opt into every native capability.
 * Consumers that only need one capability can import its narrower subpath.
 */
export function createCapacitorMobileRuntime(
  options: CapacitorMobileRuntimeOptions = {},
): MobileRuntime {
  const purchasesOptions = options.purchases

  return createMobileRuntime({
    haptics: createCapacitorHapticsPort(),
    localNotifications: createCapacitorLocalNotificationsPort(options),
    purchases:
      purchasesOptions === undefined
        ? createUnavailablePurchasesPort()
        : createCapacitorPurchasesPort(purchasesOptions),
    paywall:
      purchasesOptions === undefined
        ? createUnavailablePaywallPort()
        : createCapacitorPaywallPort(),
  })
}
