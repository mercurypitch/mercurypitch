import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PromoStore from './promo-store'

// One function stands in for the network across module resets, so every
// test gets a fresh store but can still see what it asked.
const fetchFeaturedPromo = vi.hoisted(() => vi.fn())
vi.mock('@/db/services/billing-service', () => ({ fetchFeaturedPromo }))

const LAUNCH = {
  code: 'LAUNCH',
  credits: 5,
  expiresAt: '2027-01-01T23:59:59.000Z',
}
const DURING = Date.parse('2026-11-15T12:00:00.000Z')

async function freshStore(): Promise<typeof PromoStore> {
  vi.resetModules()
  return import('./promo-store')
}

describe('promo-store', () => {
  beforeEach(() => {
    fetchFeaturedPromo.mockReset()
    fetchFeaturedPromo.mockResolvedValue(LAUNCH)
  })

  it('offers nothing before the server has answered', async () => {
    const store = await freshStore()
    expect(store.offeredPromo(DURING)).toBeNull()
  })

  it('offers the promo the server features', async () => {
    const store = await freshStore()
    await store.loadFeaturedPromo()
    expect(store.offeredPromo(DURING)).toEqual(LAUNCH)
  })

  it('offers nothing when the server features nothing', async () => {
    fetchFeaturedPromo.mockResolvedValue(null)
    const store = await freshStore()
    await store.loadFeaturedPromo()
    expect(store.offeredPromo(DURING)).toBeNull()
  })

  it('stops offering a promo once it has ended, without asking again', async () => {
    const store = await freshStore()
    await store.loadFeaturedPromo()
    expect(store.offeredPromo(Date.parse('2027-01-01T23:59:59.000Z'))).toEqual(
      LAUNCH,
    )
    expect(
      store.offeredPromo(Date.parse('2027-01-02T00:00:00.000Z')),
    ).toBeNull()
    expect(fetchFeaturedPromo).toHaveBeenCalledTimes(1)
  })

  it('keeps offering a promo with no end', async () => {
    fetchFeaturedPromo.mockResolvedValue({ ...LAUNCH, expiresAt: null })
    const store = await freshStore()
    await store.loadFeaturedPromo()
    expect(store.offeredPromo(Date.parse('2099-01-01T00:00:00.000Z'))).toEqual({
      ...LAUNCH,
      expiresAt: null,
    })
  })

  it('asks the server once per page load, however many surfaces load it', async () => {
    const store = await freshStore()
    await Promise.all([
      store.loadFeaturedPromo(),
      store.loadFeaturedPromo(),
      store.loadFeaturedPromo(),
    ])
    await store.loadFeaturedPromo()
    expect(fetchFeaturedPromo).toHaveBeenCalledTimes(1)
  })
})
