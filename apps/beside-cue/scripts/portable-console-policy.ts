// Test-build diagnostics policy — native previews include capture, release tags always exclude it.
export function portableConsoleEnabled(
  env: Record<string, string | undefined>,
): boolean {
  if ((env.GITHUB_REF ?? '').startsWith('refs/tags/')) return false
  return (
    env.VITE_PORTABLE_CONSOLE === 'true' ||
    (env.VITE_BESIDE_CUE_GAMES === '1' &&
      (env.VITE_BESIDE_CUE_NATIVE_PLATFORM === 'ios' ||
        env.VITE_BESIDE_CUE_NATIVE_PLATFORM === 'android'))
  )
}
