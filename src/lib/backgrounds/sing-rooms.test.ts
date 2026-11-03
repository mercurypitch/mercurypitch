// ============================================================
// The Sing room's covers — three free, three for supporters
// ============================================================
//
// The native Sing tab IS a room, and its picture is one of these covers. A
// supporter cover is assembled from four places no single type check spans:
// this catalog, the worker's id-to-surface map, a D1 seed migration, and a
// placeholder wash in the picker's stylesheet. Miss one and the room either
// never appears or appears and fails to load. The free covers' files are
// checked in background-catalog.test.ts, beside the Drum rooms' files.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BackgroundDefinition } from './background-catalog'
import { BACKGROUND_CATALOG, DEFAULT_BACKGROUND_IDS, getBackgroundDefinition, SING_ROOMS_BACKGROUND_IDS, } from './background-catalog'

const MIGRATION =
  'workers/db-worker/migrations/0073_sing_rooms_background_pack.sql'
const WORKER_CATALOG = 'workers/db-worker/src/premium-background-catalog.ts'
const PICKER_CSS = 'src/features/backgrounds/PremiumBackgroundPicker.module.css'

const SING: readonly BackgroundDefinition[] = BACKGROUND_CATALOG.filter(
  (room) => room.surface === 'sing',
)

describe("the Sing room's covers", () => {
  it('gives the sing surface three free covers and three supporter covers', () => {
    expect(
      SING.filter((room) => room.access.kind === 'free').map((room) => room.id),
    ).toEqual([
      'sing-retro-analog-studio',
      'sing-rehearsal-attic',
      'sing-choir-room',
    ])
    expect([...SING_ROOMS_BACKGROUND_IDS]).toEqual([
      'sing-echo-cistern',
      'sing-snowfall-pavilion',
      'sing-ghost-light-stage',
    ])
    expect(
      SING.filter((room) => room.access.kind === 'supporter').map(
        (room) => room.id,
      ),
    ).toEqual([...SING_ROOMS_BACKGROUND_IDS])
  })

  it('keeps the Retro Analog Studio the default', () => {
    // A new cover must not quietly become what everyone sees: the default is
    // what a singer who never opened the picker already has.
    expect(DEFAULT_BACKGROUND_IDS.sing).toBe('sing-retro-analog-studio')
  })

  it('keeps every cover a dark room with its lamp low', () => {
    // The room's veil and the trace assume a dark picture, and the band the
    // trace lives in has to stay quiet, so each focal point is the lamp below
    // that band.
    for (const room of SING) {
      expect(room.treatment ?? 'dark', room.id).toBe('dark')
      expect(room.focalPoint.y, room.id).toBeGreaterThanOrEqual(0.6)
      expect(room.focalPoint.y, room.id).toBeLessThanOrEqual(0.75)
    }
  })

  it('is delivered from the server, never from a public URL', () => {
    for (const id of SING_ROOMS_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      expect(background.access.kind).toBe('supporter')
      expect(background.delivery).toBe('master-ready')
      expect(background.assetSource).toEqual({
        kind: 'protected',
        key: `backgrounds/sing/${id}`,
      })
    }
  })

  it('tells the worker the same surface this catalog does', () => {
    const source = readFileSync(WORKER_CATALOG, 'utf8')
    for (const id of SING_ROOMS_BACKGROUND_IDS) {
      expect(source).toContain(`'${id}': 'sing'`)
    }
  })

  it('is seeded by the migration, with matching titles', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    for (const id of SING_ROOMS_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)!
      const description = background.description ?? ''
      expect(sql).toContain(`('${id}', 'sing', '${background.label}'`)
      expect(description, id).not.toBe('')
      expect(sql).toContain(`'${description}.'`)
    }
    expect(sql).toContain('premiumSupporterGroupPerks')
    expect(sql).toContain("g.slug = 'active-supporters'")
  })

  it('gives the edition a placeholder wash', () => {
    const css = readFileSync(PICKER_CSS, 'utf8')
    for (const id of SING_ROOMS_BACKGROUND_IDS) {
      expect(css).toContain(
        `.edition_${getBackgroundDefinition(id)!.edition} {`,
      )
    }
  })

  it('names each cover once across the whole catalog', () => {
    // Two rooms with one label are two cards nobody can tell apart, in the
    // picker or in Studio's library.
    for (const room of SING) {
      expect(
        BACKGROUND_CATALOG.filter((other) => other.label === room.label),
        room.label,
      ).toHaveLength(1)
    }
  })
})
