// ============================================================
// The native Progress page folds out of a store build: a source guard
// ============================================================
//
// As community-fold.test.ts holds Community, for the Progress tab's own page
// (NATIVE_PROGRESS). The PR gate builds only the dev target, which carries
// the page, so nothing there would notice a store build that carried it
// too. The built bundle is asked by assert-bundle.mjs (KARAOKE_STAGE_2)
// when a store build is made; this file asks the sources on every run.
//
//   - The switch is its own constant, folded from KARAOKE_IMPORT.
//   - It is read in a ternary or a plain conditional, never a <Show>: only
//     a ternary folds, and a <Show> keeps both arms in every bundle.
//   - The page is reached only through a lazy import behind it, which the
//     shell lends the app through the bridge, itself behind the switch: a
//     static import would put the page, its words and its stylesheet in
//     every build. No module of it is imported from outside its folder, so
//     none of its state needs listing as free of side effects.
//   - The app picks the page or the web one by the same switch, before
//     `lazy()` is written, so a build with the native page carries no chunk
//     of the web one.
//   - The page takes the web page's types and nothing else of it.
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
const FOLDER = 'shell/progress/'
const EVERY_SOURCE = (): string[] => [
  ...sources(ROOT),
  ...sources(at('../../../src/')),
]
const outsideFolder = (path: string): boolean =>
  !relative(ROOT, path).startsWith(FOLDER)

describe('the native Progress page, in the sources', () => {
  it('has a switch of its own, on exactly where the Karaoke import is', () => {
    expect(read('../../../src/lib/native-build.ts')).toMatch(
      /export const NATIVE_PROGRESS: boolean = KARAOKE_IMPORT\n/u,
    )
  })

  it('never reads the switch in a <Show>', () => {
    const shown = EVERY_SOURCE().filter((path) =>
      /when=\{[^}]*NATIVE_PROGRESS/u.test(readFileSync(path, 'utf8')),
    )
    expect(shown.map((path) => relative(ROOT, path))).toEqual([])
  })

  it('is reached only through a lazy import behind the switch, lent through the bridge', () => {
    const statically = EVERY_SOURCE()
      .filter(outsideFolder)
      .filter((path) =>
        /(?:\bfrom|^import)\s+['"][^'"]*shell\/progress\/|(?:\bfrom|^import)\s+['"]\.\/progress\//mu.test(
          readFileSync(path, 'utf8'),
        ),
      )
    expect(statically.map((path) => relative(ROOT, path))).toEqual([])
    const shell = read('./shell/NativeShell.tsx')
    expect(shell).toMatch(
      /const ProgressScreen: Component = NATIVE_PROGRESS\s*\?\s*lazy\(async \(\) =>\s*import\('\.\/progress\/ProgressScreen'\)/u,
    )
    expect(shell).toMatch(
      /\.\.\.\(NATIVE_PROGRESS \? \{ progressPage: ProgressScreen \} : \{\}\)/u,
    )
  })

  it('is drawn in the tab by the same switch, the web page folded out with it', () => {
    const app = read('../../../src/App.tsx')
    expect(app).toMatch(
      /const ProgressRoute: Component = NATIVE_PROGRESS\s*\?\s*\(\) => null\s*:\s*lazy\(/u,
    )
    expect(app).toMatch(
      /const NativeProgressPage: Component = NATIVE_PROGRESS\s*\?\s*\(\) => <Dynamic component=\{nativeShellApi\(\)\?\.progressPage\} \/>\s*:\s*\(\) => null/u,
    )
    expect(app).toMatch(
      /\{NATIVE_PROGRESS \? \(\s*<NativeProgressPage \/>\s*\) : \(\s*<ProgressRoute \/>\s*\)\}/u,
    )
    // The web page is imported nowhere else: its chunk is the one App folds.
    const importers = EVERY_SOURCE()
      .filter((path) =>
        /['"]@\/features\/progress\/ProgressRoute['"]/u.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(at('../../../'), path))
    expect(importers).toEqual(['src/App.tsx'])
  })

  it("takes the web page's types and nothing else of it", () => {
    const pageImports = sources(at(`./${FOLDER}`)).flatMap((path) =>
      [
        ...readFileSync(path, 'utf8').matchAll(
          /^import\s+(type\s+)?[^'"]*['"]@\/features\/progress\/ProgressPage['"]/gmu,
        ),
      ].map((match) => `${relative(ROOT, path)}:${match[1] ?? 'value'}`),
    )
    expect(pageImports.length).toBeGreaterThan(0)
    expect(pageImports.filter((entry) => entry.endsWith(':value'))).toEqual([])
  })

  it('names in assert-bundle what a store build must not carry', () => {
    const assert = read('../scripts/assert-bundle.mjs')
    for (const marker of [
      'shell-progress',
      'progress-week-sheet',
      'Tap a week',
      'Your progress starts with one run.',
    ]) {
      expect(assert).toMatch(
        new RegExp(`\\[\\s*'${marker.replace(/[.?]/gu, '\\$&')}',`, 'u'),
      )
    }
  })

  it('says each marker where the page draws it, and nowhere outside it', () => {
    const page = sources(at(`./${FOLDER}`))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    const elsewhere = EVERY_SOURCE()
      .filter(outsideFolder)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    for (const marker of [
      'shell-progress',
      'progress-week-sheet',
      'Tap a week',
      'Your progress starts with one run.',
    ]) {
      expect(page, marker).toContain(marker)
      expect(elsewhere.includes(marker), marker).toBe(false)
    }
  })
})
