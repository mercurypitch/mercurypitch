// Native game asset profile — bind packaged builds to their reviewed mobile GLBs.

export function nativeGameAssetProfile(
  buildPlatform: unknown,
  runtimePlatform: unknown,
): 'mobile' | undefined {
  return buildPlatform === 'android' ||
    buildPlatform === 'ios' ||
    runtimePlatform === 'android' ||
    runtimePlatform === 'ios'
    ? 'mobile'
    : undefined
}
