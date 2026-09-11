// ============================================================
// Capacitor runtime — every capability at once, for an app that has them all
// ============================================================
//
// This module composes the whole `MobileRuntime` from Capacitor adapters, and
// each adapter imports its plugin at module scope. So importing THIS file is
// a declaration that the app installs all four:
//
//   @capacitor/haptics
//   @capacitor/local-notifications
//   @revenuecat/purchases-capacitor        (only with `purchases`)
//   @revenuecat/purchases-capacitor-ui     (only with `purchases`)
//
// The `purchases` option gates which PORTS are composed, not which modules
// are loaded — a static import happens either way. An app that installs some
// of these and not others must compose from the narrow subpaths instead
// (`./capacitor/haptics` and the inert ports in the root barrel), which is
// what `apps/mercurypitch` does. Reaching a plugin the app never installed is
// hazard 3 in the native plan: it resolves at build time through this
// package's own devDependencies, so nothing fails until the bridge answers a
// call with `Unimplemented` on the device.
//
// For device capabilities that are not part of the runtime object — haptic
// taps, keep-awake, the status bar, share, Settings, the back button, app
// lifecycle — see `./platform`, which loads each plugin lazily and works in
// an app that installs none of them.

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
