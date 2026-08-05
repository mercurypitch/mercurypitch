// ============================================================
// Background access and selection tests
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BillingMe } from '@/db/services/billing-service'
import type { BackgroundSelectionStorage } from './background-access'
import { BACKGROUND_SELECTION_KEYS, deriveBackgroundAccess, deterministicFreeJamBackground, fetchBackgroundAccess, fetchPerksMe, hasBackgroundEntitlement, NO_BACKGROUND_ACCESS, persistBackgroundId, readPersistedBackgroundId, resolveBackgroundSelection, resolvePersistedBackgroundSelection, resolveSharedBackgroundSelection, } from './background-access'
import { getBackgroundDefinition, listBackgrounds } from './background-catalog'

function billingMe(entitlements: BillingMe['entitlements'] = []): BillingMe {
  return { creditBalance: 0, entitlements, stripeConfigured: true }
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function memoryStorage(): BackgroundSelectionStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('server-evidenced background access', () => {
  it('unlocks the standard pack for an active supporter entitlement', () => {
    const access = deriveBackgroundAccess(
      billingMe([
        {
          feature: 'supporter',
          source: 'donation:sup-voice',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
      ]),
      { perks: [] },
      Date.parse('2026-08-05T00:00:00.000Z'),
    )
    expect(access.supporter).toBe(true)
    expect(
      hasBackgroundEntitlement(getBackgroundDefinition('aurora-loft')!, access),
    ).toBe(true)
    expect(
      hasBackgroundEntitlement(
        getBackgroundDefinition('midnight-rain-stage')!,
        access,
      ),
    ).toBe(true)
  })

  it('honors a matching explicit grant without unlocking the whole pack', () => {
    const access = deriveBackgroundAccess(billingMe(), {
      perks: ['golden-stage'],
    })
    expect(
      hasBackgroundEntitlement(
        getBackgroundDefinition('golden-stage')!,
        access,
      ),
    ).toBe(true)
    expect(
      hasBackgroundEntitlement(getBackgroundDefinition('aurora-loft')!, access),
    ).toBe(false)
  })

  it('fails closed for expired or malformed supporter expiration dates', () => {
    const expired = deriveBackgroundAccess(
      billingMe([
        {
          feature: 'supporter',
          source: 'donation:sup-fund',
          expiresAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      { perks: [] },
      Date.parse('2026-08-05T00:00:00.000Z'),
    )
    const malformed = deriveBackgroundAccess(
      billingMe([
        {
          feature: 'supporter',
          source: 'manual',
          expiresAt: 'not-a-date',
        },
      ]),
      { perks: [] },
    )
    const empty = deriveBackgroundAccess(
      billingMe([
        {
          feature: 'supporter',
          source: 'manual',
          expiresAt: '',
        },
      ]),
      { perks: [] },
    )
    const abbreviatedFuture = deriveBackgroundAccess(
      billingMe([
        {
          feature: 'supporter',
          source: 'manual',
          expiresAt: '2099',
        },
      ]),
      { perks: [] },
    )
    expect(expired.supporter).toBe(false)
    expect(malformed.supporter).toBe(false)
    expect(empty.supporter).toBe(false)
    expect(abbreviatedFuture.supporter).toBe(false)
  })

  it('filters unknown explicit grants at the client boundary', () => {
    const access = deriveBackgroundAccess(billingMe(), {
      perks: ['golden-singer', 'made-up-perk', 'golden-singer'],
    })
    expect(access.explicitPerks).toEqual(['golden-singer'])
  })

  it('combines independent successful billing and perk responses', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/api/billing/me')) {
        return Promise.resolve(
          response(
            billingMe([
              {
                feature: 'supporter',
                source: 'manual',
                expiresAt: null,
              },
            ]),
          ),
        )
      }
      return Promise.resolve(response({ perks: ['aurora-loft', 'unknown'] }))
    })

    const access = await fetchBackgroundAccess('https://api.test')
    expect(access.supporter).toBe(true)
    expect(access.explicitPerks).toEqual(['aurora-loft'])
    expect(access.verification).toEqual({
      supporter: 'verified',
      explicitPerks: 'verified',
    })
  })

  it('keeps verified evidence when the other endpoint is offline', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/api/billing/me')) {
        return Promise.resolve(
          response(
            billingMe([
              {
                feature: 'supporter',
                source: 'manual',
                expiresAt: null,
              },
            ]),
          ),
        )
      }
      return Promise.reject(new Error('offline'))
    })

    const access = await fetchBackgroundAccess('https://api.test')
    expect(access.supporter).toBe(true)
    expect(access.explicitPerks).toEqual([])
    expect(access.verification.explicitPerks).toBe('unavailable')
  })

  it('degrades to no access when the cloud API is unavailable', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const access = await fetchBackgroundAccess('')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(access).toEqual(NO_BACKGROUND_ACCESS)
  })

  it('rejects malformed /api/perks/me responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(response({ perks: 'all' }))
    expect(await fetchPerksMe('https://api.test')).toBeNull()
  })
})

describe('background selection', () => {
  it('falls back for unknown, cross-surface, and unreleased selections', () => {
    expect(
      resolveBackgroundSelection('jam', 'unknown', NO_BACKGROUND_ACCESS).id,
    ).toBe('room-stage')
    expect(
      resolveBackgroundSelection('jam', 'karaoke-theatre', NO_BACKGROUND_ACCESS)
        .id,
    ).toBe('room-stage')
    expect(
      resolveBackgroundSelection('jam', 'golden-stage', {
        supporter: true,
        explicitPerks: [],
        verification: {
          supporter: 'verified',
          explicitPerks: 'verified',
        },
      }).id,
    ).toBe('room-stage')
  })

  it('persists only a preferred id and rechecks access on resolution', () => {
    const storage = memoryStorage()
    expect(persistBackgroundId('jam', 'golden-stage', storage)).toBe(true)
    expect(readPersistedBackgroundId('jam', storage)).toBe('golden-stage')
    expect(
      resolvePersistedBackgroundSelection('jam', NO_BACKGROUND_ACCESS, storage)
        .id,
    ).toBe('room-stage')
  })

  it('rejects a persisted id from the wrong surface', () => {
    const storage = memoryStorage()
    storage.setItem(BACKGROUND_SELECTION_KEYS.jam, 'karaoke-theatre')
    expect(readPersistedBackgroundId('jam', storage)).toBeNull()
    expect(persistBackgroundId('jam', 'karaoke-theatre', storage)).toBe(false)
  })

  it('degrades safely when storage is unavailable', () => {
    const broken: BackgroundSelectionStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(readPersistedBackgroundId('jam', broken)).toBeNull()
    expect(persistBackgroundId('jam', 'room-stage', broken)).toBe(false)
  })

  it('keeps room-id fallback deterministic and within the free Jam set', () => {
    const first = deterministicFreeJamBackground('ABCD12')
    const second = deterministicFreeJamBackground('ABCD12')
    const freeJamIds = listBackgrounds('jam').map((background) => background.id)
    expect(second.id).toBe(first.id)
    expect(freeJamIds).toContain(first.id)
    expect(deterministicFreeJamBackground(null).id).toBe('room-stage')
  })

  it('validates a shared host selection without consulting viewer access', () => {
    expect(resolveSharedBackgroundSelection('jam', 'room-keys').id).toBe(
      'room-keys',
    )
    expect(resolveSharedBackgroundSelection('jam', 'unknown').id).toBe(
      'room-stage',
    )
  })
})
