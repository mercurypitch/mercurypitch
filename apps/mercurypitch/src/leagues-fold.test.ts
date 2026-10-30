// ============================================================
// Leagues fold out of a store build: a source guard
// ============================================================
//
// The PR gate builds only the dev target, which carries Leagues, so nothing
// there would notice a store build that carried them too. The built bundle
// is asked by assert-bundle.mjs (KARAOKE_STAGE_2) when a store build is
// made; this file asks the sources on every run.
//
//   - The switch is its own constant, folded from KARAOKE_IMPORT.
//   - The screen is reached only through a lazy import behind it: a static
//     import would put the screen, its words and its stylesheet in every
//     build.
//   - The store the More row reads is free of side effects in the native
//     config, so a build that never reaches it drops it whole.
//   - The More sheet reads that store only inside its folded Together group.
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

describe('Leagues, in the sources', () => {
  it('have a switch of their own, on exactly where the Karaoke import is', () => {
    expect(read('../../../src/lib/native-build.ts')).toMatch(
      /export const NATIVE_LEAGUES: boolean = KARAOKE_IMPORT\n/u,
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

  it('name in assert-bundle what a store build must not carry', () => {
    const assert = read('../scripts/assert-bundle.mjs')
    for (const marker of [
      'shell-leagues',
      'Climb a rung every week',
      'mp:league-card',
      'A rung higher every week',
    ]) {
      expect(assert).toContain(`['${marker}',`)
    }
  })
})
