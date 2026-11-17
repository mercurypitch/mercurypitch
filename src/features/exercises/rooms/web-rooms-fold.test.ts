// ============================================================
// The web's way in to the rooms folds out of a native build: a source guard
// ============================================================
//
// The rooms reach the web through two files, the Exercises page and its
// menu, and both are in the native bundle too, since the native app renders
// the web's App under its shell. A store build must carry no room
// (apps/mercurypitch/scripts/assert-bundle.mjs asks that of the bundle when
// one is made). The PR gate builds no store bundle, so this file asks the
// sources the same question on every run:
//
//   - The page and the menu import nothing of the rooms statically but
//     their ids. A static import runs its module even under a branch that
//     folds away (MISTAKES.md), and the catalogue brings Long note's stored
//     signals with it.
//   - Every dynamic import of the rooms folder sits in `WEB_ROOMS ? lazy(`,
//     so it goes with the branch when the constant folds to false.
//   - The ids' module reaches for nothing but the exercise contracts.
//   - No exercise's id is one of the strings assert-bundle.mjs refuses in a
//     store build. The ids are in every build: the page asks whether its
//     selected exercise is a room, and the drills' tables are keyed by them.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as contracts from '@/lib/domain/exercise-contracts'

/** Repo-relative: vitest runs from the workspace root. */
const PAGE = 'src/pages/ExercisesPage.tsx'
const MENU = 'src/features/exercises/ExerciseMenu.tsx'
const IDS = 'src/features/exercises/rooms/web-room-ids.ts'
const BUNDLE_CHECK = 'apps/mercurypitch/scripts/assert-bundle.mjs'

const read = (path: string): string => readFileSync(path, 'utf8')

/** A static import, or a re-export, of a room's code: the rooms folder
 *  (but for its ids), the catalogue, the kit or a room's own feature. The
 *  old drills of the same names live under features/exercises and are not
 *  rooms. */
const STATIC_ROOM_IMPORT =
  /(?:\bfrom|\bimport)\s+['"][^'"]*(?:\/rooms\/(?!web-room-ids['"])|premium-exercises|room-kit|@\/features\/(?:long-note|echo|lip-roll|ng-slides|home-note|first-note|leap|harmony|warm-up)\/)[^'"]*['"]/u

/** Every `import('…/rooms/…')` in a source. */
const DYNAMIC_ROOM_IMPORT = /\bimport\(\s*['"][^'"]*\/rooms\/[^'"]+['"]\s*\)/gu

/** The same, where it folds: straight after `WEB_ROOMS ? lazy(() =>`. */
const FOLDED_ROOM_IMPORT =
  /\bWEB_ROOMS\s*\?\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"][^'"]*\/rooms\/[^'"]+['"]\s*\)/gu

describe("the web's way in to the rooms", () => {
  it.each([PAGE, MENU])(
    '%s imports nothing of the rooms statically but their ids',
    (path) => {
      const source = read(path)

      expect(source.match(STATIC_ROOM_IMPORT)).toBeNull()
    },
  )

  it.each([PAGE, MENU])(
    '%s opens the rooms only behind WEB_ROOMS, lazily',
    (path) => {
      const source = read(path)

      const dynamic = source.match(DYNAMIC_ROOM_IMPORT) ?? []
      const folded = source.match(FOLDED_ROOM_IMPORT) ?? []

      expect(dynamic.length).toBeGreaterThan(0)
      expect(folded.length).toBe(dynamic.length)
    },
  )

  it('keeps the ids free of everything but the exercise contracts', () => {
    const imports = read(IDS).match(/from\s+['"][^'"]+['"]/gu) ?? []

    expect(imports.length).toBeGreaterThan(0)
    expect(
      imports.filter((i) => !i.includes('@/lib/domain/exercise-contracts')),
    ).toEqual([])
  })

  it('gives no exercise an id the store bundle is checked for', () => {
    // The Warm-up's id is its path's test id too, and that test id was what
    // the check looked for until the web held the id as an exercise type.
    const check = read(BUNDLE_CHECK)
    const ids = Object.entries(contracts).flatMap(([name, value]) =>
      name.startsWith('EXERCISE_') && typeof value === 'string' ? [value] : [],
    )

    expect(ids).toContain(contracts.EXERCISE_WARM_UP_PATH)
    expect(ids.filter((id) => check.includes(`'${id}'`))).toEqual([])
  })

  it('would catch a static import of the strip, the host or a room', () => {
    // The guard itself, on the shapes it is there to refuse.
    for (const line of [
      "import RoomsStrip from './rooms/RoomsStrip'",
      "import WebRoomHost from '@/features/exercises/rooms/WebRoomHost'",
      "import { webRooms } from './rooms/web-room-list'",
      "import { EXERCISE_CATALOGUE } from '@/features/premium-exercises/catalogue'",
      "import { LongNoteRoom } from '@/features/long-note/LongNoteRoom'",
    ]) {
      expect(line, line).toMatch(STATIC_ROOM_IMPORT)
    }
    for (const line of [
      "import { isWebRoom } from '@/features/exercises/rooms/web-room-ids'",
      "import LongNoteExercise from '@/features/exercises/long-note/LongNoteExercise'",
    ]) {
      expect(line, line).not.toMatch(STATIC_ROOM_IMPORT)
    }
  })
})
