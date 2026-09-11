// ============================================================
// The asset manifest still describes the tree it names
// ============================================================
//
// A manifest of globs has one quiet failure: an asset is renamed or deleted,
// the glob matches nothing, and the binary ships without a picture nobody
// thought to look for. `sync-native-assets.mjs` refuses to build on that and
// `assert-bundle.mjs` refuses to pass it — but both of those run only when
// somebody builds the NATIVE app, while the files these globs point at belong
// to the WEB app and move far more often than this shell does.
//
// So the same check runs here, in the suite `pnpm mercurypitch:test` runs and
// the PR gate runs for every change under `src/` — the change that is
// actually likely to move a picture.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- a plain .mjs manifest with no types, on purpose: the
// same file is read by a Vite config, by a bare-node build script that runs
// before any install, and by this test.
import { globToRegExp, NATIVE_ASSETS, resolveNativeAssets, } from '../native-assets.mjs'

interface Entry {
  glob: string
  reason: string
}

const entries = NATIVE_ASSETS as readonly Entry[]

const WEB_PUBLIC = fileURLToPath(new URL('../../../public', import.meta.url))

describe('native asset manifest', () => {
  it('resolves every entry against the web app public tree', () => {
    const resolved = resolveNativeAssets(WEB_PUBLIC) as {
      entries: Array<Entry & { files: string[] }>
      files: string[]
    }

    const empty = resolved.entries
      .filter((entry) => entry.files.length === 0)
      .map((entry) => entry.glob)

    expect(empty).toEqual([])
    // The tree really was walked. Without this the assertion above passes
    // just as happily against a public/ directory that is not there.
    expect(resolved.files.length).toBeGreaterThan(entries.length)
  })

  it('gives every entry a reason, and names each glob once', () => {
    for (const entry of entries) {
      expect(entry.reason.length, entry.glob).toBeGreaterThan(20)
    }

    const globs = entries.map((entry) => entry.glob)
    expect(new Set(globs).size).toBe(globs.length)
  })

  it('keeps a single star inside one path segment', () => {
    // The manifest leans on exactly this: `legends/*.webp` is the 31 masters
    // and `legends/mid/*.webp` is the 31 downscales, as two entries with two
    // byte counts. A matcher that let `*` cross a `/` would silently fold the
    // second tier into the first.
    const masters = globToRegExp('legends/*.webp') as RegExp

    expect(masters.test('legends/adele.webp')).toBe(true)
    expect(masters.test('legends/mid/adele.webp')).toBe(false)
    expect(masters.test('legends/adele.png')).toBe(false)
    expect(masters.test('other/legends/adele.webp')).toBe(false)
  })

  it('crosses segments only for a double star', () => {
    const deep = globToRegExp('legends/**/*.webp') as RegExp

    expect(deep.test('legends/mid/adele.webp')).toBe(true)
    expect(deep.test('legends/adele.webp')).toBe(true)
  })

  it('reads a dot as a dot, not as any character', () => {
    const mark = globToRegExp('brand-mark.svg') as RegExp

    expect(mark.test('brand-mark.svg')).toBe(true)
    expect(mark.test('brand-markXsvg')).toBe(false)
  })
})
