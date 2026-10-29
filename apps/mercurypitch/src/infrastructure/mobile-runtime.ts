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
// ITS NOTIFICATIONS PORT IS THE INERT ONE. The one reminder this app sets,
// the Ear Lab's "Remind me tomorrow", goes through
// `@irchiinnuss/mobile-runtime/platform` (native-reminders.ts), whose
// wrappers load the package's own Capacitor adapter for the plugin
// (capacitor/local-notifications) only when a reminder is set, in a build
// with the Ear Lab with Merc. Nothing reads `runtime.localNotifications`.
//
// WHY THIS COMPOSES PORT BY PORT rather than calling
// `createCapacitorMobileRuntime`. That helper is the every-capability
// composition, and it imports all four of its plugins at module scope — a
// static import happens whether or not the matching option was passed. That
// put a notification plugin in a binary with no native half for it (hazard 3
// in the native plan: it resolved at build time through the shared
// package's own devDependencies, and failed first on the device as an
// `Unimplemented` from the bridge). The plugin is installed now, for the Ear
// Lab's reminder, but the helper would still put it in every build's startup
// graph, the store build's included, where the platform wrappers keep it to
// the build that sets one. The narrow subpaths below are the fix, and they
// are also the honest description of this app.
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
