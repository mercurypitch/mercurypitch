// ============================================================
// The exercise rooms do not select, call out or drag
// ============================================================
//
// On an iPhone, a tap on the Ng bridge's picture and on the Lantern's note
// label selected them (TestFlight, 17 Oct). The rooms said `user-select:
// none` in places, unprefixed, and iOS honours only `-webkit-user-select`;
// the native build added no prefixes then (it has a CSS target since). The
// fix is one shared rule (RoomSurface.module.css) that every room puts on
// its root, and draggable={false} on the rooms' pictures. These read the
// sources, because jsdom neither applies CSS modules nor knows what WebKit
// honours.

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const FEATURES = join(ROOT, 'src/features')

/** Each room's root component, by its folder. */
const ROOMS = {
  echo: 'EchoRoom.tsx',
  'long-note': 'LongNoteRoom.tsx',
  'lip-roll': 'LipRollRoom.tsx',
  'ng-slides': 'NgSlidesRoom.tsx',
} as const

const read = (path: string): string => readFileSync(path, 'utf8')

/** The declarations of the first rule whose selector list has this selector. */
function rule(css: string, selector: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//gu, '')
  for (const [, selectors, body] of bare.matchAll(/([^{}]+)\{([^}]*)\}/gu)) {
    if (selectors.split(',').some((one) => one.trim() === selector)) return body
  }
  throw new Error(`no rule for ${selector}`)
}

describe('the shared room surface', () => {
  const css = read(join(ROOT, 'src/components/room-kit/RoomSurface.module.css'))

  it('turns selection off in the spelling WebKit honours, and the callout', () => {
    const surface = rule(css, '.surface')
    expect(surface).toMatch(/-webkit-user-select:\s*none;/u)
    expect(surface).toMatch(/(?:^|[;\s])user-select:\s*none;/u)
    expect(surface).toMatch(/-webkit-touch-callout:\s*none;/u)
  })

  it('stops a picture being dragged out', () => {
    expect(rule(css, '.surface img')).toMatch(/-webkit-user-drag:\s*none;/u)
  })

  it('lets a text field inside a room take typing again', () => {
    const field = rule(css, '.surface textarea')
    expect(field).toMatch(/-webkit-user-select:\s*text;/u)
  })
})

describe.each(Object.entries(ROOMS))('%s', (folder, file) => {
  const source = read(join(FEATURES, folder, file))

  it('puts the shared surface on its root', () => {
    expect(source).toMatch(
      /import surface from '@\/components\/room-kit\/RoomSurface\.module\.css'/u,
    )
    // The root is the element whose class names the room's own `.room`.
    const root = /class=\{`\$\{styles\.room\}([^`]*)`\}/u.exec(source)
    expect(root?.[1]).toContain('${surface.surface}')
  })

  it('says draggable={false} on every picture it draws', () => {
    const dir = join(FEATURES, folder)
    const tsx = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(
      (name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'),
    )
    const images = tsx.flatMap((name) =>
      [...read(join(dir, name)).matchAll(/<img\b[^>]*>/gu)].map((m) => ({
        name,
        tag: m[0],
      })),
    )
    for (const { name, tag } of images) {
      expect(tag, `${folder}/${name}`).toContain('draggable={false}')
    }
  })
})

it('the four rooms with pictures still have pictures to check', () => {
  // A guard on the parser: if the rooms stopped spelling <img> this way, the
  // loop above would pass on nothing.
  const count = ['echo', 'ng-slides', 'lip-roll']
    .flatMap((folder) =>
      readdirSync(join(FEATURES, folder), {
        recursive: true,
        encoding: 'utf8',
      })
        .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
        .map((name) => read(join(FEATURES, folder, name))),
    )
    .reduce((sum, text) => sum + (text.match(/<img\b/gu)?.length ?? 0), 0)
  expect(count).toBeGreaterThanOrEqual(10)
})
