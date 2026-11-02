// ============================================================
// Community folds out of a store build: a source guard
// ============================================================
//
// As leagues-fold.test.ts holds Leagues, for Community's switch of its own
// (NATIVE_COMMUNITY). The PR gate builds only the dev target, which carries
// Community, so nothing there would notice a store build that carried it
// too. The built bundle is asked by assert-bundle.mjs (KARAOKE_STAGE_2)
// when a store build is made; this file asks the sources on every run.
//
//   - The switch is its own constant, folded from KARAOKE_IMPORT.
//   - It is read in a ternary or a plain conditional, never a <Show>: only
//     a ternary folds, and a <Show> keeps both arms in every bundle.
//   - The two screens are reached only through lazy imports behind it: a
//     static import would put the screens, their words and their
//     stylesheet in every build.
//   - The store the More row reads is free of side effects in the native
//     config. From outside its folder only the More sheet reads it, inside
//     a branch the switch folds; the shell reaches it through
//     community-entry.ts, whose every call into it is behind the switch.
//   - pushScreen refuses both screens on a build without the switch.
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

const ROOT = at('./')
const EVERY_SOURCE = (): string[] => [
  ...sources(ROOT),
  ...sources(at('../../../src/')),
]
const outsideFolder = (path: string): boolean =>
  !relative(ROOT, path).startsWith('shell/community/')

/** Where each match of `pattern` falls in `text`. */
const indexes = (text: string, pattern: RegExp): number[] =>
  [...text.matchAll(pattern)].map((match) => match.index)

describe('Community, in the sources', () => {
  it('has a switch of its own, on exactly where the Karaoke import is', () => {
    expect(read('../../../src/lib/native-build.ts')).toMatch(
      /export const NATIVE_COMMUNITY: boolean = KARAOKE_IMPORT\n/u,
    )
  })

  it('never reads the switch in a <Show>', () => {
    const shown = EVERY_SOURCE().filter((path) =>
      /when=\{[^}]*NATIVE_COMMUNITY/u.test(readFileSync(path, 'utf8')),
    )
    expect(shown.map((path) => relative(ROOT, path))).toEqual([])
  })

  it('reaches its screens only through lazy imports behind the switch', () => {
    const statically = EVERY_SOURCE()
      .filter(outsideFolder)
      .filter((path) =>
        /(?:\bfrom|^import)\s+['"][^'"]*community\/(?:Community\w*|community-lines|community\.css)['"]/mu.test(
          readFileSync(path, 'utf8'),
        ),
      )
    expect(statically.map((path) => relative(ROOT, path))).toEqual([])
    const shell = read('./shell/NativeShell.tsx')
    expect(shell).toMatch(
      /const CommunityScreen: Component = NATIVE_COMMUNITY\s*\?\s*lazy\(async \(\) =>\s*import\('\.\/community\/CommunityScreen'\)/u,
    )
    expect(shell).toMatch(
      /const CommunityResultScreen: Component = NATIVE_COMMUNITY\s*\?\s*lazy\(async \(\) =>\s*import\('\.\/community\/CommunityResultScreen'\)/u,
    )
  })

  it('lists the store the More row reads as free of side effects', () => {
    expect(read('../vite.config.ts')).toContain(
      "'/apps/mercurypitch/src/shell/community/community-store.ts',",
    )
  })

  it('is reached from outside its folder only by the More sheet, and the shell through its entry', () => {
    const importers = (module: string): string[] =>
      EVERY_SOURCE()
        .filter(outsideFolder)
        .filter((path) =>
          new RegExp(`from\\s+['"][^'"]*community/${module}['"]`, 'u').test(
            readFileSync(path, 'utf8'),
          ),
        )
        .map((path) => relative(ROOT, path))
        .sort()
    expect(importers('community-store')).toEqual(['shell/MoreSheet.tsx'])
    expect(importers('community-entry')).toEqual(['shell/NativeShell.tsx'])
  })

  it('reads that store in the More sheet only inside its folded row', () => {
    const sheet = read('./shell/MoreSheet.tsx')
    expect(sheet).toContain('{NATIVE_LEAGUES || NATIVE_COMMUNITY ? (')
    const start = sheet.indexOf('{NATIVE_COMMUNITY ? (')
    const end = sheet.indexOf(') : null}', start)
    expect(start).toBeGreaterThan(-1)
    const reads = indexes(sheet, /communityCounts\(/gu)
    expect(reads.length).toBeGreaterThan(0)
    for (const index of reads) {
      expect(index).toBeGreaterThan(start)
      expect(index).toBeLessThan(end)
    }
  })

  it('lets the shell’s entry reach the store only behind the switch', () => {
    const entry = read('./shell/community/community-entry.ts')
    for (const [call, guard] of [
      ['forgetCommunityResult()', 'if (NATIVE_COMMUNITY) '],
      ['installCommunityWatch()', 'return NATIVE_COMMUNITY ? '],
    ]) {
      const at = entry.indexOf(call)
      expect(at, call).toBeGreaterThan(-1)
      expect(entry.slice(at - guard.length, at)).toBe(guard)
      expect(entry.indexOf(call, at + 1)).toBe(-1)
    }
  })

  it('is refused by pushScreen on a build without the switch', () => {
    expect(read('./shell/run-shell-store.ts')).toMatch(
      /screen\.startsWith\('community'\) && !NATIVE_COMMUNITY\) return/u,
    )
  })

  it('names in assert-bundle what a store build must not carry', () => {
    const assert = read('../scripts/assert-bundle.mjs')
    for (const marker of [
      'shell-community',
      'shell-shared-result',
      'Sign in to see your runs, your best and your streak here.',
      'mp:community-card',
      'What other singers shared',
      'M17.6 13.7a6.5 6.5 0 0 1 3.4 5.8',
    ]) {
      expect(assert).toMatch(
        new RegExp(`\\[\\s*'${marker.replace(/[.?]/gu, '\\$&')}',`, 'u'),
      )
    }
  })
})
