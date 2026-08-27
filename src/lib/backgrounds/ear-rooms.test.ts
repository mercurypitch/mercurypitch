// ============================================================
// The Ear Lab's rooms — the pack behind the Regulator Room
// ============================================================
//
// Four supporter rooms of the Ear Lab's world, and one more free room. A
// background is assembled from four places no single type check spans: this
// catalog, the worker's id-to-surface map, a D1 seed migration, and a
// placeholder wash in the picker's stylesheet. Miss one and the room either
// never appears or appears and fails to load.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKGROUND_CATALOG, EAR_ROOMS_BACKGROUND_IDS, getBackgroundDefinition, } from './background-catalog'

const MIGRATION =
  'workers/db-worker/migrations/0035_ear_rooms_background_pack.sql'
const WORKER_CATALOG = 'workers/db-worker/src/premium-background-catalog.ts'
const PICKER_CSS = 'src/features/backgrounds/PremiumBackgroundPicker.module.css'

describe("the Ear Lab's rooms", () => {
  it('gives the ear surface two free rooms and four supporter rooms', () => {
    const ear = BACKGROUND_CATALOG.filter((room) => room.surface === 'ear')
    expect(
      ear.filter((room) => room.access.kind === 'free').map((room) => room.id),
    ).toEqual(['ear-regulator-room', 'ear-glasshouse-bench'])
    expect([...EAR_ROOMS_BACKGROUND_IDS]).toEqual([
      'ear-transit-observatory',
      'ear-bell-loft',
      'ear-planetarium',
      'ear-anechoic-booth',
    ])
    for (const id of EAR_ROOMS_BACKGROUND_IDS) {
      expect(getBackgroundDefinition(id)!.surface).toBe('ear')
    }
  })

  it('serves the free rooms from public files, both orientations', () => {
    for (const id of ['ear-regulator-room', 'ear-glasshouse-bench'] as const) {
      const source = getBackgroundDefinition(id)!.assetSource
      expect(source.kind).toBe('public')
      if (source.kind === 'public') {
        expect(source.landscape).toMatch(/^\/ear-lab\/.+-landscape\.webp$/)
        expect(source.portrait).toMatch(/^\/ear-lab\/.+-portrait\.webp$/)
      }
    }
  })

  it('is delivered from the server, never from a public URL', () => {
    for (const id of EAR_ROOMS_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(background.access.kind).toBe('supporter')
      expect(background.assetSource).toEqual({
        kind: 'protected',
        key: `backgrounds/ear/${id}`,
      })
    }
  })

  it('tells the worker the same surface this catalog does', () => {
    const source = readFileSync(WORKER_CATALOG, 'utf8')
    for (const id of EAR_ROOMS_BACKGROUND_IDS) {
      expect(source).toContain(`'${id}': 'ear'`)
    }
  })

  it('is seeded by the migration, with matching titles', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    for (const id of EAR_ROOMS_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(sql).toContain(`('${id}', 'ear', '${background.label}'`)
    }
    expect(sql).toContain('premiumSupporterGroupPerks')
    expect(sql).toContain("g.slug = 'active-supporters'")
  })

  it('gives the edition a placeholder wash', () => {
    const css = readFileSync(PICKER_CSS, 'utf8')
    for (const id of EAR_ROOMS_BACKGROUND_IDS) {
      expect(css).toContain(
        `.edition_${getBackgroundDefinition(id)!.edition} {`,
      )
    }
  })
})
