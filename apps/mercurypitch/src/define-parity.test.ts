// ============================================================
// Every constant the web build defines, this build defines too
// ============================================================
//
// `@` resolves to the repository's own `src/`, so the root config and this
// one compile the SAME module graph. Vite replaces only the identifiers it is
// told about, which makes a one-sided `define` a ReferenceError at module
// evaluation in whichever build is missing it -- on a phone, at whatever
// moment that module first happens to be reached, with no build-time warning
// of any kind. `__SW_ENABLED__` did exactly that once.
//
// Nothing in non-test `src/` reads `process.env` today, so the concrete risk
// is a dependency that does. The point of this suite is not that one key: it
// is that the NEXT key added to the root config cannot quietly skip this one.

import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it } from 'vitest'

/** The same env both builds really run under. `command: 'build'` matters --
 *  the root config keys `__SW_ENABLED__` on it, and this app's config runs
 *  its purchase-policy assertion only for a build. */
const BUILD_ENV = { command: 'build', mode: 'production' } as const

const defineKeys = async (relativePath: string): Promise<string[]> => {
  const path = fileURLToPath(new URL(relativePath, import.meta.url))
  const loaded = await loadConfigFromFile(BUILD_ENV, path)
  if (loaded == null) throw new Error(`no vite config at ${path}`)
  return Object.keys(loaded.config.define ?? {})
}

describe('vite define parity with the web build', () => {
  it('defines every constant the root config defines', async () => {
    const [rootKeys, nativeKeys] = await Promise.all([
      defineKeys('../../../vite.config.ts'),
      defineKeys('../vite.config.ts'),
    ])

    // A real root config with a real define block, so a refactor that moves
    // the block somewhere this test cannot see it fails loudly instead of
    // passing against an empty set.
    expect(rootKeys.length).toBeGreaterThan(0)

    // Keys only, never values: `__SW_ENABLED__` and `__NATIVE_BUILD__` are
    // deliberately opposite in the two builds. What must not differ is
    // whether the identifier gets replaced at all.
    const missing = rootKeys.filter((key) => !nativeKeys.includes(key))
    expect(
      missing,
      `apps/mercurypitch/vite.config.ts is missing ${missing.join(', ')}. ` +
        'Add it to this app’s define block with the value this build ' +
        'needs -- an identifier the root config replaces and this one does ' +
        'not is a ReferenceError on the phone, not a missing feature.',
    ).toEqual([])
  }, 60000)
})
