// ============================================================
// RevenueCat configuration — one place for keys, entitlement and offering
// ============================================================
//
// A RevenueCat `test_` key targets the Test Store, and the SDK deliberately
// refuses to run one in a release build. A release build must supply real store
// keys through the environment or it ships without purchases rather than
// crashing on launch.
//
// `import.meta.env.DEV` is false in every native build — `cap sync` copies the
// output of `vite build`, so a debug APK carries a production web bundle. That
// left the Test Store reachable only in a browser, where the plugin has no
// implementation at all. `VITE_REVENUECAT_ALLOW_TEST_STORE=1` is the way to say
// "this artifact is a debug build" from outside, which is the one thing the web
// layer cannot work out for itself.
//
// It must never be set for a build that goes to a store. Doing so ships a
// `test_` key in a release binary, and the SDK aborts the app on launch.

import type { PurchasesLogLevel } from '@irchiinnuss/mobile-runtime/capacitor'
import type { BesideCuePlatform } from '@/infrastructure/mobile-runtime'

/** RevenueCat Test Store key. Development builds only. */
const DEV_FALLBACK_API_KEY = 'test_QQigLtGKqfRKFJNzgOlaVwUQUtP'

const DEFAULT_ENTITLEMENT_ID = 'BeSideCue Pro'

/** What the interface calls the upgrade, independent of the dashboard id. */
export const PRO_DISPLAY_NAME = 'BeSideCue Pro'

const TEST_STORE_KEY_PREFIX = 'test_'

export interface PurchasesConfig {
  readonly apiKey: string
  readonly logLevel: PurchasesLogLevel
}

export interface PurchasesSetup {
  /** App-owned simulation only; never a real RevenueCat entitlement. */
  readonly mock?: boolean
  /**
   * Entitlement identifier as configured in the RevenueCat dashboard. Always
   * present so the interface can name the upgrade even where it cannot sell it.
   */
  readonly entitlementId: string
  /** Offering identifier, or undefined to use whichever is current. */
  readonly offeringId?: string
  /** Undefined when this build cannot talk to a store. */
  readonly config?: PurchasesConfig
  /** Set when purchases are off for a reason worth showing a developer. */
  readonly problem?: string
}

export interface PurchasesEnvironment {
  readonly VITE_REVENUECAT_ANDROID_KEY?: string
  readonly VITE_REVENUECAT_IOS_KEY?: string
  readonly VITE_REVENUECAT_ENTITLEMENT_ID?: string
  readonly VITE_REVENUECAT_OFFERING_ID?: string
  /** `'1'` marks a debug artifact, permitting the Test Store. Never in a release. */
  readonly VITE_REVENUECAT_ALLOW_TEST_STORE?: string
  readonly DEV?: boolean
}

function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text === undefined || text === '' ? undefined : text
}

function platformKey(
  platform: BesideCuePlatform,
  env: PurchasesEnvironment,
): string | undefined {
  return platform === 'ios'
    ? trimmed(env.VITE_REVENUECAT_IOS_KEY)
    : trimmed(env.VITE_REVENUECAT_ANDROID_KEY)
}

/**
 * Resolves what this build may do with purchases. Pure, so the rules are
 * testable without a browser or a native shell.
 */
export function resolvePurchasesSetup(
  platform: BesideCuePlatform,
  env: PurchasesEnvironment,
): PurchasesSetup {
  const entitlementId =
    trimmed(env.VITE_REVENUECAT_ENTITLEMENT_ID) ?? DEFAULT_ENTITLEMENT_ID
  const offeringId = trimmed(env.VITE_REVENUECAT_OFFERING_ID)
  const base = {
    entitlementId,
    ...(offeringId === undefined ? {} : { offeringId }),
  }

  if (platform === 'web') {
    return { ...base, problem: 'Purchases need the Android or iOS app.' }
  }

  const development = env.DEV === true
  const testStoreAllowed =
    development || env.VITE_REVENUECAT_ALLOW_TEST_STORE === '1'
  const configuredKey = platformKey(platform, env)
  const apiKey =
    configuredKey ?? (testStoreAllowed ? DEV_FALLBACK_API_KEY : undefined)

  if (apiKey === undefined) {
    return {
      ...base,
      problem: `This build has no RevenueCat key for ${platform}. Set VITE_REVENUECAT_${platform === 'ios' ? 'IOS' : 'ANDROID'}_KEY.`,
    }
  }

  if (apiKey.startsWith(TEST_STORE_KEY_PREFIX) && !testStoreAllowed) {
    // The SDK aborts the app rather than run a Test Store key in release.
    return {
      ...base,
      problem:
        'A RevenueCat Test Store key cannot be used in a release build. Set the store key for this platform.',
    }
  }

  return {
    ...base,
    config: {
      apiKey,
      logLevel: testStoreAllowed ? 'debug' : 'warn',
    },
  }
}
