// ============================================================
// Mercury Pitch native runtime — composed from what this app installs
// ============================================================
//
// Two product facts become facts about the binary here.
//
// THE CLOUD SUBSCRIPTION SELLS THROUGH REVENUECAT (plan S8 step 25). Where
// the build carries its platform's store key (purchases-setup.ts), the
// purchase and paywall ports are RevenueCat's; where it does not, they are
// the inert ones, so `runtime.purchases.available` is false and every write
// rejects with `unavailable`. Nothing has to remember to check a flag, and
// `@irchiinnuss/purchase-kit` refuses to let a store build out without a
// real platform key, or with a Test Store one.
//
// V1-1 SCHEDULES NOTHING. There is no reminder in this app, so there is no
// `@capacitor/local-notifications` in its dependencies and that port is the
// inert one.
//
// WHY THIS COMPOSES PORT BY PORT rather than calling
// `createCapacitorMobileRuntime`. That helper is the every-capability
// composition, and it imports all four of its plugins at module scope — a
// static import happens whether or not the matching option was passed. This
// app installs three of them (`@capacitor/haptics` and RevenueCat's two), so
// reaching the helper would bundle a notification plugin that has no native
// half in this binary: it resolves at build time through the shared
// package's own devDependencies, and fails first on the device as an
// `Unimplemented` from the bridge. That is hazard 3 in the native plan. The
// narrow subpaths below are the fix, and they are also the honest
// description of this app.
//
// Device capabilities that are not part of this object — haptic taps that a
// screen fires directly, keep-awake, the status bar, share, Settings, the
// back button, app lifecycle — come from `@irchiinnuss/mobile-runtime/platform`
// instead. See `native-shell.ts`.
//
// The test beside this one asserts on the runtime THIS function builds, not
// on a probe. A probe told `purchasesAvailable: false` reports what it was
// told, whatever this file says.

import { Capacitor } from '@capacitor/core'
import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createMobileRuntime, createUnavailableLocalNotificationsPort, createUnavailablePaywallPort, createUnavailablePurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { createCapacitorHapticsPort } from '@irchiinnuss/mobile-runtime/capacitor/haptics'
import { createCapacitorPurchasesPort } from '@irchiinnuss/mobile-runtime/capacitor/purchases'
import { createCapacitorPaywallPort } from '@irchiinnuss/mobile-runtime/capacitor/purchases-ui'
import type { PurchasesPlatform, PurchasesSetup } from './purchases-setup'
import { resolvePurchasesSetup } from './purchases-setup'

/** This build's store, from the platform it runs on and the keys it carries.
 *  Each variable is named, so the build inlines these three and not the
 *  whole environment. */
function thisBuildsStore(): PurchasesSetup {
  const setup = resolvePurchasesSetup(
    Capacitor.getPlatform() as PurchasesPlatform,
    {
      VITE_REVENUECAT_IOS_KEY: import.meta.env.VITE_REVENUECAT_IOS_KEY,
      VITE_REVENUECAT_ANDROID_KEY: import.meta.env.VITE_REVENUECAT_ANDROID_KEY,
      VITE_REVENUECAT_ALLOW_TEST_STORE: import.meta.env
        .VITE_REVENUECAT_ALLOW_TEST_STORE,
    },
  )
  if (setup.problem !== undefined) console.info(`[purchases] ${setup.problem}`)
  return setup
}

export function createNativeRuntime(
  store: PurchasesSetup = thisBuildsStore(),
): MobileRuntime {
  const { apiKey } = store
  return createMobileRuntime({
    haptics: createCapacitorHapticsPort(),
    localNotifications: createUnavailableLocalNotificationsPort(),
    purchases:
      apiKey === undefined
        ? createUnavailablePurchasesPort()
        : createCapacitorPurchasesPort({ apiKey }),
    paywall:
      apiKey === undefined
        ? createUnavailablePaywallPort()
        : createCapacitorPaywallPort(),
  })
}
