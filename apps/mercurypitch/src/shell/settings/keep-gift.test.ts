// ============================================================
// The launch gift Keep offers: the server's answer, and only while it runs
// ============================================================
//
// S7b E6: Keep's gift row shows only while GET /api/billing/promo/featured
// says the app gift is live. The app asks; it never decides the count or
// the day, and a build without Import asks nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as BillingService from '@/db/services/billing-service'
import type * as NativeBuild from '@/lib/native-build'
import { liveAppGift, loadAppGift, resetAppGift } from './keep-gift'

const build = vi.hoisted(() => ({ importing: true }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get KARAOKE_IMPORT() {
    return build.importing
  },
}))

const server = vi.hoisted(() => ({
  answers: [] as Array<{ songs: number; endsAt: string | null } | null>,
  asked: 0,
}))
vi.mock('@/db/services/billing-service', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingService>()),
  fetchAppGift: () => {
    server.asked += 1
    return Promise.resolve(server.answers.shift() ?? null)
  },
}))

const GIFT = { songs: 5, endsAt: '2027-01-01T23:59:59.000Z' }

beforeEach(() => {
  build.importing = true
  server.answers = []
  server.asked = 0
  resetAppGift()
})

afterEach(() => {
  resetAppGift()
})

describe('the launch gift Keep offers', () => {
  it('is the server’s answer: songs and the day it ends', async () => {
    server.answers = [GIFT]

    const before = liveAppGift()
    await loadAppGift()

    expect(before).toBeNull()
    expect(liveAppGift(Date.parse('2026-10-16T12:00:00.000Z'))).toEqual(GIFT)
  })

  it('stops showing once its end has passed, without asking again', async () => {
    server.answers = [GIFT]
    await loadAppGift()

    expect(liveAppGift(Date.parse('2027-01-02T00:00:00.000Z'))).toBeNull()
    expect(server.asked).toBe(1)
  })

  it('follows the latest answer: a gift switched off since is gone', async () => {
    server.answers = [GIFT, null]
    await loadAppGift()
    const first = liveAppGift(Date.parse('2026-10-16T12:00:00.000Z'))

    await loadAppGift()

    expect(first).toEqual(GIFT)
    expect(liveAppGift(Date.parse('2026-10-16T12:00:00.000Z'))).toBeNull()
  })

  it('asks once at a time', async () => {
    server.answers = [GIFT]

    await Promise.all([loadAppGift(), loadAppGift()])

    expect(server.asked).toBe(1)
  })

  it('asks nothing in a build without Import', async () => {
    build.importing = false

    await loadAppGift()

    expect(server.asked).toBe(0)
    expect(liveAppGift()).toBeNull()
  })
})
