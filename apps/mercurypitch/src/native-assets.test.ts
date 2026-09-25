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

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { BackgroundDefinition, PublicBackgroundSource, } from '@/lib/backgrounds/background-catalog'
import { defaultBackground, listBackgrounds, } from '@/lib/backgrounds/background-catalog'
// @ts-expect-error -- a plain .mjs manifest with no types, on purpose: the
// same file is read by a Vite config, by a bare-node build script that runs
// before any install, and by this test.
import { globToRegExp, NATIVE_ASSETS, resolveNativeAssets, } from '../native-assets.mjs'
import { DOORS } from './alley/alley-plate'

interface Entry {
  glob: string
  reason: string
}

const entries = NATIVE_ASSETS as readonly Entry[]

const WEB_PUBLIC = fileURLToPath(new URL('../../../public', import.meta.url))
const WORKFLOW = fileURLToPath(
  new URL(
    '../../../.github/workflows/mercurypitch-mobile.yml',
    import.meta.url,
  ),
)

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

describe('the pictures an open door ends on', () => {
  // A door's open grows into its room's own picture (alley-entry.ts), and a
  // room whose picture is not in the binary draws none: the Ear Lab's
  // portrait file was never listed, so on a phone held upright the room had
  // no photograph and the open had nothing to end on (device round 4).
  // Every file of each open door's default room, in both orientations and
  // at every density the catalogue names, has to ship.
  const shipped = new Set(
    (resolveNativeAssets(WEB_PUBLIC) as { files: string[] }).files,
  )
  const rooms = DOORS.flatMap((door) =>
    door.roomBackground === null
      ? []
      : [[door.key, door.roomBackground.surface] as const],
  )

  it('has an open door to check', () => {
    expect(rooms.map(([key]) => key)).toEqual(['ear', 'sing'])
  })

  /** Every file a public room names, as a path under public/. */
  const filesOf = (background: BackgroundDefinition): string[] => {
    expect(background.assetSource.kind, background.id).toBe('public')
    const source = background.assetSource as PublicBackgroundSource
    return [
      source.landscape,
      source.landscape2x,
      source.portrait,
      source.portrait2x,
    ].flatMap((file) => (file === undefined ? [] : [file.replace(/^\//u, '')]))
  }

  it.each(rooms)('%s: its default room ships whole', (_, surface) => {
    const files = filesOf(defaultBackground(surface))
    expect(files.length).toBeGreaterThan(1)
    expect(files.filter((file) => !shipped.has(file))).toEqual([])
  })

  // The room is the player's to choose, not only its default: any free room
  // of the surface can be picked in the app, and the open ends on whichever
  // is chosen. The Glasshouse Bench was never listed, so choosing it left the
  // Ear Lab door opening onto no picture, back to the plate's grow (device
  // round 4). Supporter rooms come from the server and are never bundled.
  it.each(rooms)(
    '%s: every free room it can be given ships whole',
    (_, surface) => {
      const free = listBackgrounds(surface).filter(
        (background) => background.access.kind === 'free',
      )
      expect(free.length).toBeGreaterThan(0)
      const missing = free.flatMap((background) =>
        filesOf(background)
          .filter((file) => !shipped.has(file))
          .map((file) => `${background.id}: ${file}`),
      )
      expect(missing).toEqual([])
    },
  )
})

describe('the native build, when a shipped file changes', () => {
  // The manifest's header asks for every file it ships to be in the mobile
  // workflow's `paths:` filter and in its `changed-paths-regex`, or a change
  // to the art never runs the build that asserts the art is there. Both list
  // the Ear Lab's pictures one by one, so a new room there has to be added
  // to both, and nothing checked that it was.
  const workflow = readFileSync(WORKFLOW, 'utf8')
  const files = (
    resolveNativeAssets(WEB_PUBLIC) as { files: string[] }
  ).files.map((file) => `public/${file}`)

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(entries.length)
  })

  it("runs for every one of them, by the pull request's paths filter", () => {
    const list = /^ {4}paths:\n((?: {6}(?:- '[^']+'|#.*)\n)+)/mu.exec(workflow)
    expect(list).not.toBeNull()
    const globs = [...list![1].matchAll(/- '([^']+)'/gu)].map(
      (match) => globToRegExp(match[1]) as RegExp,
    )
    expect(
      files.filter((file) => !globs.some((glob) => glob.test(file))),
    ).toEqual([])
  })

  it('runs for every one of them, by changed-paths-regex', () => {
    const source = /changed-paths-regex: '([^']+)'/u.exec(workflow)?.[1]
    expect(source).toBeDefined()
    const changed = new RegExp(source!, 'u')
    expect(files.filter((file) => !changed.test(file))).toEqual([])
  })
})
