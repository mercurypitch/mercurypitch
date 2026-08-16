// The close step of reset-app-data, pinned by mock.
//
// This lives in its own file because the main suite runs against
// fake-indexeddb, whose deleteDatabase auto-closes unhandled connections on
// versionchange — REAL browsers do not. There, an open raw connection (the
// model cache holds one from app start, for the pitch models) blocks the
// delete forever, which is why the close step must let go of every
// connection the app owns before anything is deleted. The shim cannot prove
// that, so this file pins the calls themselves.

import { describe, expect, it, vi } from 'vitest'
import { closeDatabase } from '@/db'
import { closeLocalDatabase } from '@/db/local-database'
import { closeModelCacheDb } from '@/lib/model-cache'
import { resetAppData } from '@/lib/reset-app-data'

vi.mock('@/db', () => ({ closeDatabase: vi.fn(async () => undefined) }))
vi.mock('@/db/local-database', () => ({ closeLocalDatabase: vi.fn() }))
vi.mock('@/lib/model-cache', () => ({
  closeModelCacheDb: vi.fn(),
  MODEL_CACHE_DB_NAME: 'pitchperfect-models',
}))

describe('resetAppData — the default close step', () => {
  it('lets go of every connection the app owns, before any delete', async () => {
    const order: string[] = []
    vi.mocked(closeDatabase).mockImplementation(async () => {
      order.push('db')
    })
    vi.mocked(closeLocalDatabase).mockImplementation(() => {
      order.push('local')
    })
    vi.mocked(closeModelCacheDb).mockImplementation(() => {
      order.push('models')
    })

    await resetAppData(
      'database',
      {},
      {
        deleteIdb: async (name) => {
          order.push(`delete:${name}`)
        },
      },
    )

    expect(order).toEqual([
      'db',
      'local',
      'models',
      'delete:MercuryPitchDB',
      'delete:pitchperfect-models',
    ])
  })
})
