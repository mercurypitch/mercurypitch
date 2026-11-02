// ============================================================
// The blocked store: one account's blocks, as the device knows them
// ============================================================
//
// The worker is a stand-in at the network edge; the service and the store
// are real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

import { setAuthToken } from '@/db/services/user-service'
import { blockedSingerIds, blockSingerAndHide, ensureBlockedSingers, readBlockedSingers, resetBlockedSingersForTests, unblockSingerAndShow, } from './blocked-singers-store'

function tokenFor(sub: string, provider = 'password'): string {
  const body = btoa(
    JSON.stringify({
      sub,
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

let reads = 0
/** The list the stand-in worker sends for GET /api/blocks. */
let list: Array<{ userId: string; displayName: string }> = []
/** Reads of the list held open until the test lets them go. */
let hold: Promise<void> | null = null

beforeEach(() => {
  reads = 0
  list = []
  hold = null
  resetBlockedSingersForTests()
  setAuthToken(tokenFor('acc-1'))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      if (method === 'GET') {
        if (hold !== null) await hold
        reads++
        return Response.json({
          blocks: list.map((row) => ({ ...row, createdAt: '2026-11-01' })),
        })
      }
      if (new URL(url).pathname === '/api/blocks/refuse') {
        return Response.json({ error: 'No' }, { status: 429 })
      }
      if (String(init.body).includes('nobody')) {
        return Response.json({ error: 'No such singer' }, { status: 404 })
      }
      return Response.json({ blocked: method === 'POST' }, { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  setAuthToken(null)
})

describe('the blocked store', () => {
  it('knows whom the account blocked once it has read the list', async () => {
    list = [{ userId: 'ada', displayName: 'Ada' }]

    expect(blockedSingerIds().size).toBe(0)
    await readBlockedSingers()

    expect([...blockedSingerIds()]).toEqual(['ada'])
  })

  it('hides a singer the moment a block lands, and shows them again once lifted', async () => {
    await blockSingerAndHide('ben')
    expect(blockedSingerIds().has('ben')).toBe(true)

    await unblockSingerAndShow('ben')
    expect(blockedSingerIds().has('ben')).toBe(false)
  })

  it('changes nothing when the worker refuses', async () => {
    await blockSingerAndHide('refuse')

    const lifted = await unblockSingerAndShow('refuse')
    const blocked = await blockSingerAndHide('nobody')

    expect(lifted).toEqual({ status: 'busy' })
    expect(blocked).toEqual({ status: 'missing' })
    expect([...blockedSingerIds()]).toEqual(['refuse'])
  })

  it('keeps a block made while the list was being read', async () => {
    let release: () => void = () => {}
    hold = new Promise((resolve) => {
      release = resolve
    })
    const read = readBlockedSingers()
    await blockSingerAndHide('ben')
    // The list answers after the block, as it was before the block landed.
    release()
    await read

    expect(blockedSingerIds().has('ben')).toBe(true)
  })

  it('reads the list once for an account, however many boards ask', async () => {
    ensureBlockedSingers()
    ensureBlockedSingers()
    await readBlockedSingers()
    ensureBlockedSingers()

    expect(reads).toBe(1)
  })

  it('never shows one account’s blocks to another signed in on the device', async () => {
    await blockSingerAndHide('ada')

    setAuthToken(tokenFor('acc-2'))
    expect(blockedSingerIds().size).toBe(0)
    setAuthToken(null)
    expect(blockedSingerIds().size).toBe(0)
    setAuthToken(tokenFor('acc-1'))
    expect([...blockedSingerIds()]).toEqual(['ada'])
  })
})
