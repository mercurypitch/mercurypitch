// ============================================================
// Mercury Pitch native runtime — composed from what this app installs
// ============================================================
//
// Two product facts become facts about the binary here.
//
// V1-1 SELLS NOTHING. The purchase and paywall ports are the inert ones, so
// `runtime.purchases.available` is false and every write rejects with
// `unavailable`. Nothing has to remember to check a flag. When purchases do
// arrive, this is where the RevenueCat ports replace them, and
// `@irchiinnuss/purchase-kit` already refuses to let that build reach a store
// without a real platform key.
//
// V1-1 SCHEDULES NOTHING. There is no reminder in this app, so there is no
// `@capacitor/local-notifications` in its dependencies and that port is the
// inert one too.
//
// WHY THIS COMPOSES PORT BY PORT rather than calling
// `createCapacitorMobileRuntime`. That helper is the every-capability
// composition, and it imports all four of its plugins at module scope — a
// static import happens whether or not the matching option was passed. This
// app installs exactly one of them (`@capacitor/haptics`), so reaching the
// helper would bundle a notification plugin and a billing SDK that have no
// native half in this binary: both resolve at build time through the shared
// package's own devDependencies, and fail first on the device as an
// `Unimplemented` from the bridge. That is hazard 3 in the native plan. The
// narrow subpath below is the fix, and it is also the honest description of
// this app: one native capability, three admissions.
//
// Device capabilities that are not part of this object — haptic taps that a
// screen fires directly, keep-awake, the status bar, share, Settings, the
// back button, app lifecycle — come from `@irchiinnuss/mobile-runtime/platform`
// instead. See `native-shell.ts`.
//
// The test beside this one asserts on the runtime THIS function builds, not
// on a probe. A probe told `purchasesAvailable: false` reports what it was
// told, whatever this file says.

import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createMobileRuntime, createUnavailableLocalNotificationsPort, createUnavailablePaywallPort, createUnavailablePurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { createCapacitorHapticsPort } from '@irchiinnuss/mobile-runtime/capacitor/haptics'

export function createNativeRuntime(): MobileRuntime {
  return createMobileRuntime({
    haptics: createCapacitorHapticsPort(),
    localNotifications: createUnavailableLocalNotificationsPort(),
    purchases: createUnavailablePurchasesPort(),
    paywall: createUnavailablePaywallPort(),
  })
}
