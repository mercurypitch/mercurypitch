// ============================================================
// The store build leaves the premium exercises' pictures and voices out
// ============================================================
//
// The rooms fold away in a build without the premium exercises
// (PREMIUM_EXERCISES, src/lib/native-build.ts), and their pictures did not:
// Vite emits an image as Rollup loads the module that imports it, which is
// before tree-shaking drops the room. The native config resolves them to an
// empty module in that build (vite.config.ts, PREMIUM_IMAGES), and
// `scripts/assert-bundle.mjs` STAGE 2 checks a store binary. A store binary
// is made only from a release tag, so this reads the switch on every pull
// request instead, for every picture in every premium room's folder, at
// any depth (Echo's, Ng slides', Lip roll's and Home note's are in an art/
// folder of their own), and every voice file (Merc's sung "ooh" set for Echo's
// calls, in its voice/ folder, and his spoken opening lines in the Ear
// rooms' voice/ folders; vite.config.ts, PREMIUM_VOICES). The Cloud
// offer's art (src/features/karaoke-room/assets/) is Stage 2 and folds the
// same way, and so do the Ear Lab with Merc's pictures and serif
// (src/features/ear-lab/merc/; EAR_LAB_WITH_MERC rides the same switch),
// and the Legend room's copies of Merc's stills (shell/legend/stills/;
// NATIVE_LEAGUES, the same switch again).

import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it } from 'vitest'

const FEATURES = fileURLToPath(
  new URL('../../../src/features/', import.meta.url),
)
/** The premium rooms that paint pictures or speak today, by folder, the
 *  Warm-up's path, and the Ear Lab with Merc (Merc's stills). */
const ROOMS = [
  'long-note',
  'echo',
  'ng-slides',
  'lip-roll',
  'warm-up',
  'home-note',
  'first-note',
  'leap',
  'ear-lab/merc',
] as const

/** Every .webp and .mp3 under `dir`, as paths relative to it. */
function picturesIn(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.webp') || name.endsWith('.mp3'))
    .map((name) => relative(dir, join(dir, name)))
}

/** Each room's pictures, with the room file that would import them. */
const PICTURES = ROOMS.flatMap((room) => {
  const dir = join(FEATURES, room)
  const importer = join(dir, 'Room.tsx')
  return picturesIn(dir).map((name) => ({ room, name, importer }))
})

type Resolve = (source: string, importer: string) => unknown

/**
 * The fold's resolveId, from this app's config loaded for a build against
 * `target`, which is set in the process and restored afterwards: the switch
 * reads it from there, as the real build does.
 */
const foldFor = async (target: 'dev' | 'production'): Promise<Resolve> => {
  const saved = process.env.MERCURYPITCH_API_TARGET
  process.env.MERCURYPITCH_API_TARGET = target
  try {
    const path = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path,
    )
    const fold = (loaded?.config.plugins ?? [])
      .flat()
      .find(
        (plugin): plugin is Plugin =>
          typeof plugin === 'object' &&
          plugin !== null &&
          'name' in plugin &&
          plugin.name === 'mercurypitch:fold-premium-images',
      )
    const resolveId = fold?.resolveId
    if (typeof resolveId !== 'function') {
      throw new Error(`no premium image fold in ${path}`)
    }
    return (source, importer) =>
      (resolveId as (...args: unknown[]) => unknown).call(
        {},
        source,
        importer,
        {
          attributes: {},
          isEntry: false,
        },
      )
  } finally {
    if (saved === undefined) delete process.env.MERCURYPITCH_API_TARGET
    else process.env.MERCURYPITCH_API_TARGET = saved
  }
}

describe("the premium rooms' pictures in a native build", () => {
  it('has pictures to fold in every room, so the checks below are not vacuous', () => {
    for (const room of ROOMS) {
      expect(
        PICTURES.filter((picture) => picture.room === room).length,
        room,
      ).toBeGreaterThan(0)
    }
  })

  it("has Merc's voice for Echo to fold, so the voice checks are not vacuous", () => {
    const voices = PICTURES.filter(
      (file) => file.room === 'echo' && file.name.endsWith('.mp3'),
    )
    expect(voices.length).toBe(10)
  })

  it("has Merc's spoken lines for each Ear room to fold", () => {
    for (const room of ['home-note', 'first-note', 'leap'] as const) {
      const lines = PICTURES.filter(
        (file) =>
          file.room === room &&
          /(?:^|\/)merc-says-[a-z-]+\.mp3$/u.test(file.name),
      )
      expect(lines.length, room).toBe(3)
    }
  })

  it('resolves every one of them to nothing in the store build', async () => {
    const fold = await foldFor('production')
    for (const { name, importer } of PICTURES) {
      const id = fold(`./${name}`, importer)
      expect(typeof id === 'string' && id.startsWith('\0'), name).toBe(true)
    }
    // Only the rooms': a picture anywhere else is left to Vite.
    expect(fold('./backdrop.webp', join(FEATURES, 'path/Path.tsx'))).toBeNull()
    expect(fold('./ding.mp3', join(FEATURES, 'path/Path.tsx'))).toBeNull()
  }, 60000)

  it('leaves them to Vite in a build with the premium exercises', async () => {
    const fold = await foldFor('dev')
    for (const { name, importer } of PICTURES) {
      expect(fold(`./${name}`, importer), name).toBeNull()
    }
  }, 60000)
})

describe("the Cloud offer's art in a native build", () => {
  const dir = join(FEATURES, 'karaoke-room', 'assets')
  const importer = join(FEATURES, 'karaoke-room', 'CloudOffer.tsx')
  const art = picturesIn(dir)

  it('has art to fold, so the checks below are not vacuous', () => {
    expect(art).toContain('paywall-two-lights.webp')
  })

  it('resolves it to nothing in the store build', async () => {
    const fold = await foldFor('production')
    for (const name of art) {
      const id = fold(`./assets/${name}`, importer)
      expect(typeof id === 'string' && id.startsWith('\0'), name).toBe(true)
    }
  }, 60000)

  it('leaves it to Vite in a build that imports songs', async () => {
    const fold = await foldFor('dev')
    for (const name of art) {
      expect(fold(`./assets/${name}`, importer), name).toBeNull()
    }
  }, 60000)
})

describe("the Legend room's stills of Merc in a native build", () => {
  const legend = fileURLToPath(new URL('./shell/legend/', import.meta.url))
  const importer = join(legend, 'legend-stills.ts')
  const stills = picturesIn(join(legend, 'stills'))

  it('has stills to fold, so the checks below are not vacuous', () => {
    expect(stills).toEqual(
      expect.arrayContaining([
        'merc-listen.webp',
        'merc-celebrate.webp',
        'merc-point.webp',
      ]),
    )
  })

  it('resolves them to nothing in the store build', async () => {
    const fold = await foldFor('production')
    for (const name of stills) {
      const id = fold(`./stills/${name}`, importer)
      expect(typeof id === 'string' && id.startsWith('\0'), name).toBe(true)
    }
  }, 60000)

  it('leaves them to Vite in a build with the Legend room', async () => {
    const fold = await foldFor('dev')
    for (const name of stills) {
      expect(fold(`./stills/${name}`, importer), name).toBeNull()
    }
  }, 60000)
})

describe("the Ear Lab with Merc's serif, and a picture asked for by URL", () => {
  const dir = join(FEATURES, 'ear-lab', 'merc')
  const stills = join(dir, 'stills.ts')
  const entry = join(dir, 'entry.ts')
  const serif = [
    '@fontsource-variable/crimson-pro/wght.css',
    '@fontsource-variable/crimson-pro/wght-italic.css',
  ]

  it("has Merc's stills, so the picture asked for by URL below is real", () => {
    expect(picturesIn(join(dir, 'stills'))).toEqual(
      expect.arrayContaining(['merc-point.webp']),
    )
  })

  it('resolves them to nothing in the store build', async () => {
    const fold = await foldFor('production')
    for (const sheet of serif) {
      const id = fold(sheet, entry)
      expect(typeof id === 'string' && id.startsWith('\0'), sheet).toBe(true)
    }
    // A query names the same file: ?url folds as the bare import does.
    const byUrl = fold('./stills/merc-point.webp?url', stills)
    expect(typeof byUrl === 'string' && byUrl.startsWith('\0')).toBe(true)
    // Only Crimson Pro: the app's own fonts are left to Vite.
    expect(fold('@fontsource-variable/inter/wght.css', entry)).toBeNull()
  }, 60000)

  it('leaves them to Vite in a build with the room', async () => {
    const fold = await foldFor('dev')
    for (const sheet of serif) {
      expect(fold(sheet, entry), sheet).toBeNull()
    }
    expect(fold('./stills/merc-point.webp?url', stills)).toBeNull()
  }, 60000)
})
