// ============================================================
// Which store this build sells through, if any
// ============================================================
//
// The Karaoke room's Mercury Pitch Cloud subscription (plan S8 step 25,
// owner S7 D2) is sold through RevenueCat, with the platform's public SDK
// key compiled into the build. CI passes the repository secrets
// MERCURYPITCH_REVENUECAT_IOS_KEY and MERCURYPITCH_REVENUECAT_ANDROID_KEY in
// as VITE_REVENUECAT_IOS_KEY and VITE_REVENUECAT_ANDROID_KEY
// (capacitor-app.yml): the TestFlight build and the Play build carry theirs.
// A public SDK key is not a secret; it ships inside the binary by design.
//
// A build without its platform's key sells nothing, and says so: the ports
// are the inert ones, and the paywall answers "not available yet". That is
// every build that cannot reach a store anyway: the web, and the debug APK
// that is sideloaded rather than installed by Play, which Play Billing will
// not serve (capacitor-app.yml gives it no Android key outside a tag).
//
// A RevenueCat Test Store key (`test_`) is honoured only where the build
// says it is a debug artifact (VITE_REVENUECAT_ALLOW_TEST_STORE=1). The
// SDK aborts a release app that configures one, and
// @irchiinnuss/purchase-kit refuses the flag and any `test_` key in a
// distribution build before a bundle exists (vite.config.ts).
//
// The entitlement is `cloud`, fixed in code on both sides
// (KARAOKE_ENTITLEMENT, and the db-worker's SONGS_ENTITLEMENT): a dashboard
// rename is a change to both, never a build variable.

export type PurchasesPlatform = 'ios' | 'android' | 'web'

/** The build variables this reads: public keys and one debug switch. */
export interface PurchasesEnv {
  readonly VITE_REVENUECAT_IOS_KEY?: string
  readonly VITE_REVENUECAT_ANDROID_KEY?: string
  readonly VITE_REVENUECAT_ALLOW_TEST_STORE?: string
}

export interface PurchasesSetup {
  /** The SDK key this build sells with. Absent: it sells nothing. */
  readonly apiKey?: string
  /** Why it sells nothing, for a developer reading the log. */
  readonly problem?: string
}

/** RevenueCat's own prefixes, per store. */
const STORE_KEY_PREFIX = { ios: 'appl_', android: 'goog_' } as const
const TEST_STORE_PREFIX = 'test_'

function keyName(platform: 'ios' | 'android'): keyof PurchasesEnv {
  return platform === 'ios'
    ? 'VITE_REVENUECAT_IOS_KEY'
    : 'VITE_REVENUECAT_ANDROID_KEY'
}

/** What this build may sell through. Pure, so the rules are testable. */
export function resolvePurchasesSetup(
  platform: PurchasesPlatform,
  env: PurchasesEnv,
): PurchasesSetup {
  if (platform === 'web') {
    return { problem: 'Purchases need the iOS or Android app.' }
  }
  const name = keyName(platform)
  const key = env[name]?.trim() ?? ''
  if (key === '') {
    return { problem: `This build has no ${name}, so it sells nothing.` }
  }
  if (key.startsWith(TEST_STORE_PREFIX)) {
    return env.VITE_REVENUECAT_ALLOW_TEST_STORE === '1'
      ? { apiKey: key }
      : {
          problem:
            'A RevenueCat Test Store key needs a debug build (VITE_REVENUECAT_ALLOW_TEST_STORE=1).',
        }
  }
  const prefix = STORE_KEY_PREFIX[platform]
  if (!key.startsWith(prefix) || key.length === prefix.length) {
    return { problem: `${name} is not a ${platform} RevenueCat key.` }
  }
  return { apiKey: key }
}
