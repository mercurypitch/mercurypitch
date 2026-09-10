// ============================================================
// Mercury Pitch native runtime — composed WITHOUT a store
// ============================================================
//
// V1-1 sells nothing. That is a product decision, and this file is where it
// becomes a fact about the binary rather than a promise in a plan.
//
// The options object below has NO `purchases` key, and that omission is the
// whole mechanism: `createCapacitorMobileRuntime` substitutes the inert ports
// when the key is absent, so `runtime.purchases.available` is false and every
// write rejects with `unavailable`. Nothing has to remember to check a flag.
//
// It matters that the omission is here and not in a test helper. A probe can
// be told `purchasesAvailable: false` and will happily report what it was
// told, whatever this file says. The test beside this one therefore asserts on
// THIS module's own composition -- see mobile-runtime.test.ts.
//
// When purchases do arrive, this is the one line that changes: add
// `purchases: { apiKey, ... }` and the real RevenueCat ports replace the inert
// ones. `@irchiinnuss/purchase-kit` already refuses to let that build reach a
// store without a real platform key.

import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import type { CapacitorMobileRuntimeOptions } from '@irchiinnuss/mobile-runtime/capacitor'
import { createCapacitorMobileRuntime } from '@irchiinnuss/mobile-runtime/capacitor'

/**
 * The options this app composes its runtime from.
 *
 * Exported so a test can assert on the object rather than on the ports it
 * produces -- the difference between "this app did not ask for a store" and
 * "something, somewhere, ended up without one".
 */
export const MOBILE_RUNTIME_OPTIONS: CapacitorMobileRuntimeOptions =
  Object.freeze({
    // A notification listener that throws inside the plugin's own callback has
    // nowhere to report to -- the rejection is swallowed by the bridge and the
    // reminder simply stops arriving. This repository has been bitten by
    // unowned fire-and-forget tails before, so the callback is given an owner
    // here rather than left to default.
    onListenerError: (error: unknown) => {
      console.error('[mercury-pitch] local notification listener failed', error)
    },

    // No `purchases` key. Deliberate, load-bearing, and covered by a test.
  })

export function createNativeRuntime(): MobileRuntime {
  return createCapacitorMobileRuntime(MOBILE_RUNTIME_OPTIONS)
}
