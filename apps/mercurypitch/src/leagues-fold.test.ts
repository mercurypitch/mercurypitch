// ============================================================
// Leagues in every build, and still one line from leaving: a source guard
// ============================================================
//
// Leagues and the Legend room rode KARAOKE_IMPORT, on in test builds alone,
// until the owner put them in the store build too (3 Nov 2026). The PR gate
// builds only the dev target, so this file asks the sources on every run:
//
//   - The switch is its own constant, on in every build.
//   - The screen is reached only through a lazy import behind it: a build
//     that never opens it never loads it, and setting the switch back to
//     KARAOKE_IMPORT folds it out of a store build again.
//   - The store the More row reads is free of side effects in the native
//     config, so a build that never reaches it drops it whole.
//   - The More sheet reads that store only inside its Together group.
//   - assert-bundle no longer names them as what a store build must not
//     carry, or every store build would fail its check.

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

describe('Leagues, in the sources', () => {
  it('have a switch of their own, on in every build', () => {
    expect(read('../../../src/lib/native-build.ts')).toMatch(
      /export const NATIVE_LEAGUES: boolean = true\n/u,
    )
  })

  it('reach the screen only through a lazy import behind the switch', () => {
    const root = at('./')
    const statically = [
      ...sources(root),
      ...sources(at('../../../src/')),
    ].filter((path) =>
      /(?:\bfrom|^import)\s+['"][^'"]*leagues\/LeaguesScreen['"]/mu.test(
        readFileSync(path, 'utf8'),
      ),
    )
    expect(statically.map((path) => relative(root, path))).toEqual([])
    expect(read('./shell/NativeShell.tsx')).toMatch(
      /const LeaguesScreen: Component = NATIVE_LEAGUES\s*\?\s*lazy\(async \(\) =>\s*import\('\.\/leagues\/LeaguesScreen'\)/u,
    )
  })

  it('list the store the More row reads as free of side effects', () => {
    expect(read('../vite.config.ts')).toContain(
      "'/apps/mercurypitch/src/shell/leagues/league-store.ts',",
    )
  })

  it('read that store in the More sheet only inside the folded group', () => {
    const sheet = read('./shell/MoreSheet.tsx')
    const start = sheet.indexOf('{NATIVE_LEAGUES ? (')
    const end = sheet.indexOf(') : null}', start)
    expect(start).toBeGreaterThan(-1)
    const reads = [...sheet.matchAll(/leagueCard\(/gu)].map(
      (match) => match.index,
    )
    expect(reads.length).toBeGreaterThan(0)
    for (const index of reads) {
      expect(index).toBeGreaterThan(start)
      expect(index).toBeLessThan(end)
    }
  })

  it('are no longer named in assert-bundle as what a store build must not carry', () => {
    const assert = read('../scripts/assert-bundle.mjs')
    for (const marker of [
      'shell-leagues',
      'Climb a rung every week',
      'mp:league-card',
      'A rung higher every week',
      'shell-legend',
      'Practice without ranking',
      'mp:legend-card',
      'The line everyone sings',
      'Everyone sings the same notes',
    ]) {
      expect(assert).not.toContain(`['${marker}',`)
    }
  })
})
