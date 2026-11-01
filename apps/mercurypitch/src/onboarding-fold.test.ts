// ============================================================
// The onboarding folds out of a store build: a source guard
// ============================================================
//
// The PR gate builds only the dev target, which carries the onboarding, so
// nothing there would notice a store build that carried it too. The built
// bundle is asked by assert-bundle.mjs (KARAOKE_STAGE_2) when a store build
// is made; this file asks the sources on every run.
//
//   - The switch is its own constant, folded from KARAOKE_IMPORT.
//   - The layer and its flag are free of side effects in the native config,
//     so a build that never calls them drops them whole, the flag's storage
//     key with them.
//   - Outside the onboarding's own folder, every use of the layer sits
//     behind the switch. One that did not (the alley's door tap, review of
//     1 Nov 2026) kept the layer, its flag and its key in the store build:
//     folding a branch drops the code in it, not what the file imports for
//     it (MISTAKES.md, a folded branch still runs the modules its imports
//     name).
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

/** `source` with its comments blanked out, every index where it was. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/\S/gu, ' '))
    .replace(
      /(^|[^:'"])\/\/[^\n]*/gu,
      (comment, before: string) =>
        before + ' '.repeat(comment.length - before.length),
    )
}

/** The index of the bracket that closes the one at `open`. */
function closing(source: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}' }
  const shut = pairs[source[open]]
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === source[open]) depth += 1
    else if (source[i] === shut) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return source.length
}

/**
 * The stretches of `source` the switch governs: an `if (NATIVE_ONBOARDING…)`
 * block, or the rest of its line for a one-line `if`, and a JSX
 * `{NATIVE_ONBOARDING ? ( … ) : null}`.
 */
function behindTheSwitch(source: string): (readonly [number, number])[] {
  const stretches: (readonly [number, number])[] = []
  for (const found of source.matchAll(/if \(NATIVE_ONBOARDING\b/gu)) {
    const condition = found.index + 'if '.length
    const after = closing(source, condition) + 1
    const next = source.slice(after).search(/\S/u) + after
    if (source[next] === '{') stretches.push([next, closing(source, next)])
    else stretches.push([after, source.indexOf('\n', after)])
  }
  for (const found of source.matchAll(/\{NATIVE_ONBOARDING \? \(/gu)) {
    const open = found.index + found[0].length - 1
    stretches.push([open, closing(source, open)])
  }
  return stretches
}

describe('the onboarding, in the sources', () => {
  it('has a switch of its own, on exactly where the Karaoke import is', () => {
    expect(read('../../../src/lib/native-build.ts')).toMatch(
      /export const NATIVE_ONBOARDING: boolean = KARAOKE_IMPORT\n/u,
    )
  })

  it('lists its layer and its flag as free of side effects', () => {
    const config = read('../vite.config.ts')
    expect(config).toContain(
      "'/apps/mercurypitch/src/onboarding/onboarding-layer.ts',",
    )
    expect(config).toContain(
      "'/apps/mercurypitch/src/onboarding/onboarding-flag.ts',",
    )
  })

  it('uses its layer outside its own folder only behind the switch', () => {
    const root = at('./')
    const onboarding = at('./onboarding/')
    const unguarded: string[] = []
    const users = [...sources(root), ...sources(at('../../../src/'))].filter(
      (path) => !path.startsWith(onboarding),
    )
    let callers = 0
    for (const path of users) {
      const source = withoutComments(readFileSync(path, 'utf8'))
      const imported = source.match(
        /^import \{([^}]*)\} from '[^']*onboarding\/onboarding-layer'/mu,
      )
      if (imported === null) continue
      callers += 1
      const names = imported[1]
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '')
      const stretches = behindTheSwitch(source)
      const body = (imported.index ?? 0) + imported[0].length
      for (const name of names) {
        for (const use of source.matchAll(new RegExp(`\\b${name}\\b`, 'gu'))) {
          if (use.index < body) continue
          const guarded = stretches.some(
            ([from, to]) => use.index > from && use.index < to,
          )
          if (!guarded) {
            const line = source.slice(0, use.index).split('\n').length
            unguarded.push(`${relative(root, path)}:${line} ${name}`)
          }
        }
      }
    }
    // The shell and the alley, so a rename cannot leave this asking nothing.
    expect(callers).toBeGreaterThanOrEqual(2)
    expect(unguarded).toEqual([])
  })

  it('names in assert-bundle what a store build must not carry', () => {
    const assert = read('../scripts/assert-bundle.mjs')
    for (const marker of [
      'mp:native-onboarding',
      'onboarding-not-now',
      'native_onboarding_',
    ]) {
      expect(assert).toContain(`['${marker}',`)
    }
  })
})
