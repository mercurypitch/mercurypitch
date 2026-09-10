// ============================================================
// Purchase build policy — fail closed before producing a native store bundle
// ============================================================
//
// This runs inside `vite build`, not at runtime, and every rule here exists
// because the alternative is discovering the problem from a customer. A store
// binary that configures a RevenueCat Test Store key is aborted by the SDK on
// launch; a store binary with NO key silently sells nothing; a mock build that
// escapes onto a release tag hands out entitlements for free. None of those
// three announce themselves in a build log.
//
// Beside Cue wrote these rules. They are here rather than in that app because
// a second app now ships the same way, and a rule learned once should not have
// to be learned again -- which is also why the two app-specific environment
// variable names are configuration rather than constants.

/** What this app calls itself, and where it keeps its two build switches. */
export interface PurchaseBuildPolicy {
  /** Named in error messages, so a failure says which app refused. */
  readonly appName: string
  /** Env var holding '', 'store' or 'testflight-internal'. */
  readonly distributionEnv: string
  /** Env var holding 'ios' or 'android'. */
  readonly platformEnv: string
}

/** RevenueCat's own prefixes. A key that does not carry one is not that key. */
const KEY_PREFIX = { ios: 'appl_', android: 'goog_' } as const

/**
 * The Test Store prefix. RevenueCat's SDK aborts an app that configures one in
 * a release binary, so catching it here turns a launch crash on a reviewer's
 * device into a red build.
 */
const TEST_STORE_PREFIX = 'test_'

export function assertPurchaseBuildSafe(
  policy: PurchaseBuildPolicy,
  env: Readonly<Record<string, string | undefined>>,
  releaseTag: boolean,
): void {
  const distribution = env[policy.distributionEnv]
  const mock = env.VITE_MOCK_PURCHASES === '1'

  if (
    distribution !== undefined &&
    distribution !== '' &&
    distribution !== 'store' &&
    distribution !== 'testflight-internal'
  ) {
    throw new Error(`Unknown ${policy.appName} purchase distribution.`)
  }
  if (mock && (distribution !== 'testflight-internal' || releaseTag)) {
    throw new Error(
      'Mock purchases require an internal-only TestFlight build, never a release tag.',
    )
  }
  if (distribution === 'testflight-internal' && (!mock || releaseTag)) {
    throw new Error('Internal mock distribution and purchase mode must agree.')
  }

  const distributing =
    distribution === 'store' ||
    distribution === 'testflight-internal' ||
    releaseTag

  if (distributing && env.VITE_REVENUECAT_ALLOW_TEST_STORE === '1') {
    throw new Error(
      'RevenueCat Test Store is not allowed in a distribution archive.',
    )
  }

  // The flag above is the intent; this is the fact. A key can be a Test Store
  // key whatever the flag says -- a stale `.env.local`, a secret pasted into
  // the wrong repository -- and the flag would report the build as safe.
  if (distributing) {
    for (const name of [
      'VITE_REVENUECAT_IOS_KEY',
      'VITE_REVENUECAT_ANDROID_KEY',
    ]) {
      if (env[name]?.trim().startsWith(TEST_STORE_PREFIX) === true) {
        throw new Error(
          `${name} is a RevenueCat Test Store key and is not allowed in a distribution archive.`,
        )
      }
    }
  }

  if (releaseTag && distribution !== 'store') {
    throw new Error('A release tag requires an explicit store distribution.')
  }
  if (distribution !== 'store') return

  const platform = env[policy.platformEnv]
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error('A store build must name its native purchase platform.')
  }

  const key =
    env[
      platform === 'ios'
        ? 'VITE_REVENUECAT_IOS_KEY'
        : 'VITE_REVENUECAT_ANDROID_KEY'
    ]?.trim()
  const prefix = KEY_PREFIX[platform]
  if (
    key === undefined ||
    !key.startsWith(prefix) ||
    key.length === prefix.length
  ) {
    throw new Error(
      `A ${platform} store build requires its platform-specific RevenueCat SDK key.`,
    )
  }
}
