// ============================================================
// The Room Library — the pack that turned each picker into a shelf
// ============================================================
//
// Mercury Rooms gave every surface exactly two supporter rooms, which made
// the picker a choice between one dark room and one bright one. This pack is
// the rest of the shelf. It is also the largest single batch the catalog has
// taken, and a background is still assembled from four places no single type
// check spans: this catalog, the worker's id-to-surface map, a D1 seed
// migration, and a placeholder wash in the picker's stylesheet. Miss one and
// the room either never appears or appears and fails to load — both of which
// read as a server problem rather than a missing line.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getBackgroundDefinition, ROOM_LIBRARY_BACKGROUND_IDS, } from './background-catalog'

const MIGRATION =
  'workers/db-worker/migrations/0033_room_library_background_pack.sql'
const WORKER_CATALOG = 'workers/db-worker/src/premium-background-catalog.ts'
const PICKER_CSS = 'src/features/backgrounds/PremiumBackgroundPicker.module.css'

describe('the room library', () => {
  it('gives every surface a shelf rather than a pair', () => {
    const bySurface = new Map<string, string[]>()
    for (const id of ROOM_LIBRARY_BACKGROUND_IDS) {
      const surface = getBackgroundDefinition(id)!.surface
      bySurface.set(surface, [...(bySurface.get(surface) ?? []), id])
    }
    expect([...bySurface.keys()].sort()).toEqual([
      'guitar',
      'jam',
      'karaoke',
      'piano',
    ])
    for (const ids of bySurface.values())
      expect(ids.length).toBeGreaterThanOrEqual(6)
  })

  it('is delivered from the server, never from a public URL', () => {
    // A supporter room served from `public/` is a supporter room anyone can
    // fetch by guessing the path.
    for (const id of ROOM_LIBRARY_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(background.access.kind).toBe('supporter')
      expect(background.assetSource).toEqual({
        kind: 'protected',
        key: `backgrounds/${background.surface}/${id}`,
      })
    }
  })

  it('tells the worker the same surface this catalog does', () => {
    // Two hand-maintained maps of the same fact. TypeScript makes the worker
    // list every id; it cannot make it list the right surface, and the wrong
    // one resolves to an R2 key that does not exist.
    const source = readFileSync(WORKER_CATALOG, 'utf8')
    for (const id of ROOM_LIBRARY_BACKGROUND_IDS) {
      const surface = getBackgroundDefinition(id)!.surface
      expect(source).toContain(`'${id}': '${surface}'`)
    }
  })

  it('is seeded by the migration, with matching surfaces and titles', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    for (const id of ROOM_LIBRARY_BACKGROUND_IDS) {
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
    for (const id of ROOM_LIBRARY_BACKGROUND_IDS) {
      expect(css).toContain(
        `.edition_${getBackgroundDefinition(id)!.edition} {`,
      )
    }
  })

  it('numbers the two Nordic Amphitheatres so they can be told apart', () => {
    // Different pictures, one letter apart in the id, and the picker shows
    // the D1 title rather than the label below — so both have to move
    // together. 0032 seeded the first one and is applied everywhere, which
    // leaves renaming its row from here as the only way to do it.
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(getBackgroundDefinition('karaoke-nordic-amphitheatre')!.label).toBe(
      'Nordic Amphitheatre v1',
    )
    expect(getBackgroundDefinition('karaoke-nordic-amphitheater')!.label).toBe(
      'Nordic Amphitheatre v2',
    )
    expect(sql).toContain("SET title = 'Nordic Amphitheatre v1'")
    expect(sql).toContain("WHERE id = 'karaoke-nordic-amphitheatre'")
  })

  it('names each room once, across the whole catalog', () => {
    // The library was assembled from a gallery whose folder names do not all
    // match the ids already shipped; a duplicate id would silently shadow a
    // room that already exists.
    const ids = [...ROOM_LIBRARY_BACKGROUND_IDS]
    expect(new Set(ids).size).toBe(ids.length)
    const labels = ids.map((id) => getBackgroundDefinition(id)!.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
