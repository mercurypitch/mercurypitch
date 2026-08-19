// ============================================================
// Mercury Rooms — the pack that gave every surface new art at once
// ============================================================
//
// Four free rooms and eight supporter ones, and the first supporter art Guitar
// Night has ever had. A background is assembled from four places that no
// single type check spans: this catalog, the files in `public/`, the worker's
// id-to-surface map, and a D1 seed migration. Get any one of them wrong and
// the room either never appears or appears and fails to load — both of which
// look like a server problem rather than a missing line.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKGROUND_CATALOG, CURRENT_FREE_BACKGROUND_IDS, getBackgroundDefinition, MERCURY_ROOMS_BACKGROUND_IDS, } from './background-catalog'

const NEW_FREE_IDS = [
  'karaoke-tokyo-cyber',
  'jam-velvet-lounge',
  'piano-ambient-led-studio',
  'guitar-midnight-canyon',
] as const

const MIGRATION =
  'workers/db-worker/migrations/0032_mercury_rooms_background_pack.sql'
const WORKER_CATALOG = 'workers/db-worker/src/premium-background-catalog.ts'
const PICKER_CSS = 'src/features/backgrounds/PremiumBackgroundPicker.module.css'

describe('the supporter half', () => {
  it('reaches all four surfaces, two rooms each', () => {
    // Guitar is the one that matters: its rooms only joined this catalog in
    // the release before this pack, and until then a guitar identity could
    // not be stored server-side at all.
    const bySurface = new Map<string, string[]>()
    for (const id of MERCURY_ROOMS_BACKGROUND_IDS) {
      const surface = getBackgroundDefinition(id)!.surface
      bySurface.set(surface, [...(bySurface.get(surface) ?? []), id])
    }
    expect([...bySurface.keys()].sort()).toEqual([
      'guitar',
      'jam',
      'karaoke',
      'piano',
    ])
    for (const ids of bySurface.values()) expect(ids).toHaveLength(2)
  })

  it('is delivered from the server, never from a public URL', () => {
    // A supporter room served from `public/` is a supporter room anyone can
    // fetch by guessing the path.
    for (const id of MERCURY_ROOMS_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(background.access.kind).toBe('supporter')
      expect(background.assetSource).toEqual({
        kind: 'protected',
        key: `backgrounds/${background.surface}/${id}`,
      })
    }
  })

  it('pairs a dark room with a bright one on every surface', () => {
    // The bright half is the point of the pack, not a coincidence: nothing in
    // the library made the light foreground treatment work hard enough to
    // judge it.
    const light = MERCURY_ROOMS_BACKGROUND_IDS.filter(
      (id) => getBackgroundDefinition(id)!.treatment === 'light',
    )
    expect(light).toHaveLength(4)
    expect(
      new Set(light.map((id) => getBackgroundDefinition(id)!.surface)).size,
    ).toBe(4)
  })

  it('tells the worker the same surface this catalog does', () => {
    // Two hand-maintained maps of the same fact. TypeScript makes the worker
    // list every id; it cannot make it list the right surface, and the wrong
    // one resolves to an R2 key that does not exist.
    const source = readFileSync(WORKER_CATALOG, 'utf8')
    for (const id of MERCURY_ROOMS_BACKGROUND_IDS) {
      const surface = getBackgroundDefinition(id)!.surface
      expect(source).toContain(`'${id}': '${surface}'`)
    }
  })

  it('is seeded by the migration, with matching surfaces and titles', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    for (const id of MERCURY_ROOMS_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(sql).toContain(
        `('${id}', '${background.surface}', '${background.label}'`,
      )
    }
    // And assigned to the automatic supporter group, or supporters own art
    // nobody can see.
    expect(sql).toContain('premiumSupporterGroupPerks')
    expect(sql).toContain("g.slug = 'active-supporters'")
  })

  it('gives every new edition a placeholder wash', () => {
    // `styles[edition_x]` is a plain lookup: a missing rule is not a type
    // error, it is a tile that renders as nothing while the artwork loads.
    const css = readFileSync(PICKER_CSS, 'utf8')
    for (const id of MERCURY_ROOMS_BACKGROUND_IDS) {
      expect(css).toContain(
        `.edition_${getBackgroundDefinition(id)!.edition} {`,
      )
    }
  })
})

describe('the free half', () => {
  it('adds one room to each surface, registered as free and shipped', () => {
    expect(
      NEW_FREE_IDS.every((id) => CURRENT_FREE_BACKGROUND_IDS.includes(id)),
    ).toBe(true)
    const surfaces = NEW_FREE_IDS.map(
      (id) => getBackgroundDefinition(id)!.surface,
    )
    expect([...surfaces].sort()).toEqual(['guitar', 'jam', 'karaoke', 'piano'])
    for (const id of NEW_FREE_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(background.access.kind).toBe('free')
      expect(background.delivery).toBe('shipped')
    }
  })

  it('ships both orientations, as real files of the right shape', () => {
    // A room that 404s leaves the page on the CSS fallback under a name that
    // promises a picture. And the portrait matters most: a phone held upright
    // is where these are seen.
    for (const id of NEW_FREE_IDS) {
      const source = getBackgroundDefinition(id)!.assetSource
      expect(source.kind).toBe('public')
      if (source.kind !== 'public') continue
      expect(source.portrait).toBeDefined()

      for (const [path, orientation] of [
        [source.landscape, 'landscape'],
        [source.portrait!, 'portrait'],
      ] as const) {
        const bytes = readFileSync(`public${path}`)
        expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
        expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP')
        // Big enough to be the artwork rather than a placeholder, small
        // enough that four of them do not weigh down the bundle.
        expect(bytes.byteLength).toBeGreaterThan(20_000)
        expect(bytes.byteLength).toBeLessThan(600_000)
        expect(path.endsWith(`-${orientation}.webp`)).toBe(true)
      }
    }
  })

  it('leaves each surface its original default room', () => {
    // A new free room must not quietly become what everyone sees: the default
    // is what an existing player already has selected by absence.
    const defaults = BACKGROUND_CATALOG.filter((background) =>
      [
        'karaoke-theatre',
        'room-stage',
        'piano-afterglow',
        'velvet-rehearsal',
      ].includes(background.id),
    )
    expect(defaults).toHaveLength(4)
    for (const id of NEW_FREE_IDS) {
      expect(defaults.map((background) => background.id)).not.toContain(id)
    }
  })
})
