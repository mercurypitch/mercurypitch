// ============================================================
// The Legend room folds out of a store build: a source guard
// ============================================================
//
// As leagues-fold.test.ts holds Leagues, on the same switch. The built
// bundle is asked by assert-bundle.mjs (KARAOKE_STAGE_2) when a store build
// is made; this file asks the sources on every run.
//
//   - The room is reached only through a lazy import behind NATIVE_LEAGUES:
//     a static import would put the room, its words and its stylesheet in
//     every build.
//   - The store the More row reads is free of side effects in the native
//     config, so a build that never reaches it drops it whole.
//   - The More sheet reads that store only inside its folded Together group.
//   - pushScreen refuses the room on a build without the switch.
//   - assert-bundle names what a store build must not carry.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const at = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url))
const read = (path: string): string => readFileSync(at(path), 'utf8')

/** Every source file under a folder, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/u.test(name) && !name.includes('.test.') ? [path] : []
  })
}

describe('the Legend room, in the sources', () => {
  it('is reached only through a lazy import behind the switch', () => {
    const root = at('./')
    const statically = [
      ...sources(root),
      ...sources(at('../../../src/')),
    ].filter((path) =>
      /(?:\bfrom|^import)\s+['"][^'"]*legend\/(?:LegendScreen|LegendRoom|legend-take)['"]/mu.test(
        readFileSync(path, 'utf8'),
      ),
    )
    // Only the room's own files may name each other.
    expect(
      statically
        .map((path) => relative(root, path))
        .filter((path) => !path.startsWith('shell/legend/')),
    ).toEqual([])
    expect(read('./shell/NativeShell.tsx')).toMatch(
      /const LegendScreen: Component = NATIVE_LEAGUES\s*\?\s*lazy\(async \(\) =>\s*import\('\.\/legend\/LegendScreen'\)/u,
    )
  })

  it('lists the store the More row reads as free of side effects', () => {
    expect(read('../vite.config.ts')).toContain(
      "'/apps/mercurypitch/src/shell/legend/legend-store.ts',",
    )
  })

  it('reads that store in the More sheet only inside the folded group', () => {
    const sheet = read('./shell/MoreSheet.tsx')
    const start = sheet.indexOf('{NATIVE_LEAGUES ? (')
    const end = sheet.indexOf(') : null}', start)
    expect(start).toBeGreaterThan(-1)
    const reads = [...sheet.matchAll(/legend(?:Card|Standing)\(/gu)].map(
      (match) => match.index,
    )
    expect(reads.length).toBeGreaterThan(0)
    for (const index of reads) {
      expect(index).toBeGreaterThan(start)
      expect(index).toBeLessThan(end)
    }
  })

  it('is refused by pushScreen on a build without the switch', () => {
    expect(read('./shell/run-shell-store.ts')).toMatch(
      /screen === 'legend'\) && !NATIVE_LEAGUES\) return/u,
    )
  })

  it('names in assert-bundle what a store build must not carry', () => {
    const assert = read('../scripts/assert-bundle.mjs')
    for (const marker of [
      'shell-legend',
      'Practice without ranking',
      'mp:legend-card',
      'The line everyone sings',
      'Everyone sings the same notes',
    ]) {
      expect(assert).toContain(`['${marker}',`)
    }
  })
})
