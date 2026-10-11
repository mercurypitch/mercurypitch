// ============================================================
// The store build leaves the Long note room's pictures out
// ============================================================
//
// The room folds away in a build without the premium exercises
// (PREMIUM_EXERCISES, src/lib/native-build.ts), and its pictures did not:
// Vite emits an image as Rollup loads the module that imports it, which is
// before tree-shaking drops the room. The native config resolves them to an
// empty module in that build (vite.config.ts, PREMIUM_IMAGES), and
// `scripts/assert-bundle.mjs` STAGE 2 checks a store binary. A store binary
// is made only from a release tag, so this reads the switch on every pull
// request instead.

import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it } from 'vitest'

const ROOM = fileURLToPath(
  new URL('../../../src/features/long-note/', import.meta.url),
)
const LANTERN = `${ROOM}Lantern.tsx`
const PICTURES = readdirSync(ROOM).filter((name) => name.endsWith('.webp'))

type Resolve = (source: string, importer: string) => unknown

/**
 * The fold's resolveId, from this app's config loaded for a build against
 * `target`, which is set in the process and restored afterwards: the switch
 * reads it from there, as the real build does.
 */
const foldFor = async (target: 'dev' | 'production'): Promise<Resolve> => {
  const saved = process.env.MERCURYPITCH_API_TARGET
  process.env.MERCURYPITCH_API_TARGET = target
  try {
    const path = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path,
    )
    const fold = (loaded?.config.plugins ?? [])
      .flat()
      .find(
        (plugin): plugin is Plugin =>
          typeof plugin === 'object' &&
          plugin !== null &&
          'name' in plugin &&
          plugin.name === 'mercurypitch:fold-premium-images',
      )
    const resolveId = fold?.resolveId
    if (typeof resolveId !== 'function') {
      throw new Error(`no premium image fold in ${path}`)
    }
    return (source, importer) =>
      (resolveId as (...args: unknown[]) => unknown).call(
        {},
        source,
        importer,
        {
          attributes: {},
          isEntry: false,
        },
      )
  } finally {
    if (saved === undefined) delete process.env.MERCURYPITCH_API_TARGET
    else process.env.MERCURYPITCH_API_TARGET = saved
  }
}

describe('the Long note room pictures in a native build', () => {
  it('has pictures to fold, so the checks below are not vacuous', () => {
    expect(PICTURES.length).toBeGreaterThan(0)
  })

  it('resolves every one of them to nothing in the store build', async () => {
    const fold = await foldFor('production')
    for (const name of PICTURES) {
      const id = fold(`./${name}`, LANTERN)
      expect(typeof id === 'string' && id.startsWith('\0'), name).toBe(true)
    }
    // Only the room's: a picture anywhere else is left to Vite.
    expect(fold('./backdrop.webp', `${ROOM}../path/Path.tsx`)).toBeNull()
  }, 60000)

  it('leaves them to Vite in a build with the premium exercises', async () => {
    const fold = await foldFor('dev')
    for (const name of PICTURES) {
      expect(fold(`./${name}`, LANTERN), name).toBeNull()
    }
  }, 60000)
})
