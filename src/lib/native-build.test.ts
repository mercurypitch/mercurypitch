// ============================================================
// The build constants, as each build compiles them
// ============================================================
//
// Under vitest nothing is defined, so the module reads the way it does when
// an identifier is missing. Each case below defines what a build would and
// reads the module afresh: the web build, a native test build, and the store
// build. The Karaoke room's import (plan S8, Stage 2) must be in a native
// test build only, and must never be switched on by a define in the web one.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from './native-build'

async function readAs(
  defines: Record<string, unknown>,
): Promise<typeof NativeBuild> {
  for (const [name, value] of Object.entries(defines)) {
    vi.stubGlobal(name, value)
  }
  vi.resetModules()
  return import('./native-build')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('the Karaoke import and where it separates', () => {
  it("are off, and the page's own origin, when nothing is defined", async () => {
    const build = await readAs({})

    expect([build.KARAOKE_IMPORT, build.UVR_ORIGIN]).toEqual([false, ''])
  })

  it('are on, on the host that goes with the worker, in a native test build', async () => {
    const build = await readAs({
      __NATIVE_BUILD__: true,
      __KARAOKE_IMPORT__: true,
      __UVR_ORIGIN__: 'https://dev.mercurypitch.com',
    })

    expect([build.KARAOKE_IMPORT, build.UVR_ORIGIN]).toEqual([
      true,
      'https://dev.mercurypitch.com',
    ])
  })

  it('are off in the store build', async () => {
    const build = await readAs({
      __NATIVE_BUILD__: true,
      __KARAOKE_IMPORT__: false,
      __UVR_ORIGIN__: 'https://mercurypitch.com',
    })

    expect(build.KARAOKE_IMPORT).toBe(false)
  })

  it('are off in a native build that does not say', async () => {
    const build = await readAs({ __NATIVE_BUILD__: true })

    expect([build.KARAOKE_IMPORT, build.UVR_ORIGIN]).toEqual([false, ''])
  })

  it('cannot be switched on, or sent elsewhere, in the web build', async () => {
    const build = await readAs({
      __NATIVE_BUILD__: false,
      __KARAOKE_IMPORT__: true,
      __UVR_ORIGIN__: 'https://mercurypitch.com',
    })

    expect([build.KARAOKE_IMPORT, build.UVR_ORIGIN]).toEqual([false, ''])
  })
})
