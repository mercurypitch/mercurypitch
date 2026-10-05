// Device diagnostics policy tests — no release can inherit a testing console flag.
import { describe, expect, it } from 'vitest'
import { portableConsoleEnabled } from './portable-console-policy'

describe('test-build portable console', () => {
  it.each(['ios', 'android'])(
    'includes diagnostics in the %s games preview',
    (platform) => {
      expect(
        portableConsoleEnabled({
          VITE_BESIDE_CUE_GAMES: '1',
          VITE_BESIDE_CUE_NATIVE_PLATFORM: platform,
        }),
      ).toBe(true)
    },
  )
  it('allows explicit LAN diagnostics but leaves ordinary web builds clean', () => {
    expect(portableConsoleEnabled({})).toBe(false)
    expect(portableConsoleEnabled({ VITE_BESIDE_CUE_GAMES: '1' })).toBe(false)
    expect(portableConsoleEnabled({ VITE_PORTABLE_CONSOLE: 'true' })).toBe(true)
  })
  it('rejects inherited testing flags for a release tag', () => {
    expect(
      portableConsoleEnabled({
        GITHUB_REF: 'refs/tags/bc-v1.0.0',
        VITE_PORTABLE_CONSOLE: 'true',
        VITE_BESIDE_CUE_GAMES: '1',
        VITE_BESIDE_CUE_NATIVE_PLATFORM: 'ios',
      }),
    ).toBe(false)
  })
})
