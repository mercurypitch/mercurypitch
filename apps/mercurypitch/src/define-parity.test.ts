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

/**
 * This app's define block for a build run with `env` in the process, which
 * is restored afterwards: the switches it reads come from there.
 */
const nativeDefine = async (
  env: Record<string, string>,
): Promise<Record<string, unknown>> => {
  const saved = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  )
  Object.assign(process.env, env)
  try {
    const path = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
    const loaded = await loadConfigFromFile(BUILD_ENV, path)
    if (loaded == null) throw new Error(`no vite config at ${path}`)
    return (loaded.config.define ?? {}) as Record<string, unknown>
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

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

// Stage 2 of the Karaoke room is compiled in or out, never hidden: the
// constant folds, and a store build carries none of it (plan S8, owner
// 27 Sep). Keyed on the same switch that picks the worker.
describe('the Karaoke import constant', () => {
  it('is on in a dev-target build and off in the store build', async () => {
    const dev = await nativeDefine({ MERCURYPITCH_API_TARGET: 'dev' })
    const store = await nativeDefine({ MERCURYPITCH_API_TARGET: 'production' })

    expect([dev.__KARAOKE_IMPORT__, dev.__UVR_ORIGIN__]).toEqual([
      'true',
      '"https://dev.mercurypitch.com"',
    ])
    expect([store.__KARAOKE_IMPORT__, store.__UVR_ORIGIN__]).toEqual([
      'false',
      '"https://mercurypitch.com"',
    ])
  }, 60000)

  it('is off in the web build, which asks its own origin', async () => {
    const path = fileURLToPath(
      new URL('../../../vite.config.ts', import.meta.url),
    )
    const loaded = await loadConfigFromFile(BUILD_ENV, path)
    if (loaded == null) throw new Error(`no vite config at ${path}`)
    const web = (loaded.config.define ?? {}) as Record<string, unknown>

    expect([web.__KARAOKE_IMPORT__, web.__UVR_ORIGIN__]).toEqual([
      'false',
      '""',
    ])
  }, 60000)
})

// The portable console and the Developer screen are a test build's, and the
// committed .env turns them on -- so the store build shipped both, the log
// viewer and the developer sign-in screen with its token readout. The switch
// that picks the production worker compiles them out, whatever the env says.
describe('the portable console constant', () => {
  const KEY = 'import.meta.env.VITE_PORTABLE_CONSOLE'

  it('is off in the store build, even when the env turns it on', async () => {
    const store = await nativeDefine({
      MERCURYPITCH_API_TARGET: 'production',
      VITE_PORTABLE_CONSOLE: 'true',
    })
    expect(store[KEY]).toBe('"false"')
  }, 60000)

  it('follows the env in a dev-target build', async () => {
    const on = await nativeDefine({
      MERCURYPITCH_API_TARGET: 'dev',
      VITE_PORTABLE_CONSOLE: 'true',
    })
    const off = await nativeDefine({
      MERCURYPITCH_API_TARGET: 'dev',
      VITE_PORTABLE_CONSOLE: 'false',
    })
    expect([on[KEY], off[KEY]]).toEqual(['"true"', '"false"'])
  }, 60000)
})
