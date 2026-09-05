// ============================================================
// Purchase build policy — fail closed before producing a native store bundle
// ============================================================

export function assertPurchaseBuildSafe(
  env: Readonly<Record<string, string | undefined>>,
  releaseTag: boolean,
): void {
  const distribution = env.VITE_BESIDE_CUE_DISTRIBUTION
  const mock = env.VITE_MOCK_PURCHASES === '1'
  if (
    distribution !== undefined &&
    distribution !== '' &&
    distribution !== 'store' &&
    distribution !== 'testflight-internal'
  ) {
    throw new Error('Unknown Beside Cue purchase distribution.')
  }
  if (mock && (distribution !== 'testflight-internal' || releaseTag)) {
    throw new Error(
      'Mock purchases require an internal-only TestFlight build, never a release tag.',
    )
  }
  if (distribution === 'testflight-internal' && (!mock || releaseTag)) {
    throw new Error('Internal mock distribution and purchase mode must agree.')
  }
  if (
    (distribution === 'store' ||
      distribution === 'testflight-internal' ||
      releaseTag) &&
    env.VITE_REVENUECAT_ALLOW_TEST_STORE === '1'
  ) {
    throw new Error(
      'RevenueCat Test Store is not allowed in a distribution archive.',
    )
  }
  if (releaseTag && distribution !== 'store') {
    throw new Error('A release tag requires an explicit store distribution.')
  }
  if (distribution !== 'store') return
  const platform = env.VITE_BESIDE_CUE_NATIVE_PLATFORM
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error('A store build must name its native purchase platform.')
  }
  const key =
    env[
      platform === 'ios'
        ? 'VITE_REVENUECAT_IOS_KEY'
        : 'VITE_REVENUECAT_ANDROID_KEY'
    ]?.trim()
  const prefix = platform === 'ios' ? 'appl_' : 'goog_'
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
