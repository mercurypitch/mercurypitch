// ============================================================
// The way in to the exercises folds out of a store build: a source guard
// ============================================================
//
// The PR gate builds only the dev target, which carries the exercises, so
// nothing there would notice a store build that carried them too. That is
// asked of the built bundle by assert-bundle.mjs (KARAOKE_STAGE_2), when a
// store build is made. This file asks the sources the same question on
// every run: three shapes that fold, and one that would not.
//
//   - No static import of this folder from the Sing room or NativeShell. A
//     static import runs its module even under a branch that folds away
//     (MISTAKES.md), and would bring Long note's stored signals with it.
//   - Every `lazy(` in the Sing room sits behind `PREMIUM_EXERCISES ?`, so
//     the dynamic import inside it goes with the branch, and the options'
//     opener is handed over behind the constant too.
//   - The options' section is a ternary on the constant. `<Show
//     when={PREMIUM_EXERCISES}>` keeps its children, words and all.

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Repo-relative: vitest runs from the workspace root in either project. */
const ROOM = 'src/features/sing-room'
const NATIVE_SHELL = 'apps/mercurypitch/src/shell/NativeShell.tsx'

const read = (path: string): string => readFileSync(path, 'utf8')

/** The Sing room's own sources, without its tests. */
function roomSources(): Array<[string, string]> {
  return readdirSync(ROOM)
    .filter((name) => /\.tsx?$/u.test(name) && !name.includes('.test.'))
    .map((name) => [`${ROOM}/${name}`, read(`${ROOM}/${name}`)])
}

/** `from '...premium-exercises'` or a bare `import '...premium-exercises'`:
 *  a static import or re-export. `import('...')` is the dynamic one. */
const STATIC_IMPORT =
  /(?:\bfrom|\bimport)\s+['"](?:@\/features|\.\.)\/premium-exercises\b/u

describe('the way in to the exercises, in the sources', () => {
  it('is never imported statically by the Sing room or NativeShell', () => {
    const offenders = [
      ...roomSources(),
      [NATIVE_SHELL, read(NATIVE_SHELL)] as [string, string],
    ]
      .filter(([, text]) => STATIC_IMPORT.test(text))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('loads the row and the picker only behind PREMIUM_EXERCISES', () => {
    const stage = read(`${ROOM}/SingRoomStage.tsx`)
    const lazies = stage.match(/\blazy\(/gu) ?? []
    const folded = stage.match(/PREMIUM_EXERCISES\s*\?\s*lazy\(/gu) ?? []
    const imports =
      stage.match(/\bimport\(\s*'@\/features\/premium-exercises\//gu) ?? []

    expect([lazies.length, folded.length, imports.length]).toEqual([2, 2, 2])
  })

  it('hands the options their row only behind PREMIUM_EXERCISES', () => {
    // The constant leads, so the predicate and the opener fold away with
    // the row: without it both stayed in the store build, unreachable.
    const stage = read(`${ROOM}/SingRoomStage.tsx`)

    expect(stage).toMatch(
      /onOpenExercises=\{[^}]*?PREMIUM_EXERCISES && exercisesOffered\(\)/u,
    )
  })

  it("folds the options' section with a ternary, never a Show", () => {
    const options = read(`${ROOM}/SingRoomOptions.tsx`)
    const shown = roomSources()
      .filter(([, text]) => /<Show\s+when=\{PREMIUM_EXERCISES\}/u.test(text))
      .map(([path]) => path)

    expect(options).toMatch(
      /\{PREMIUM_EXERCISES \? \(\s*<Show when=\{props\.onOpenExercises\}>/u,
    )
    expect(shown).toEqual([])
  })
})
