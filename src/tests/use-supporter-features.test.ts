// ============================================================
// useSupporterFeatures — perk-gated controls stay hidden until granted
// ============================================================

import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as BackgroundAccess from '@/lib/backgrounds/background-access'

const fetchPerksMe = vi.fn<() => Promise<unknown>>()

vi.mock('@/lib/backgrounds/background-access', async (importOriginal) => {
  const actual = await importOriginal<typeof BackgroundAccess>()
  return {
    ...actual,
    fetchPerksMe: () => fetchPerksMe(),
  }
})

vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
}))

import { useSupporterFeatures } from '@/lib/use-supporter-features'

describe('useSupporterFeatures', () => {
  beforeEach(() => {
    fetchPerksMe.mockReset()
  })

  it('grants a feature only after the worker confirms it', async () => {
    fetchPerksMe.mockResolvedValue({ features: ['lab-access'], perks: [] })
    await createRoot(async (dispose) => {
      const features = useSupporterFeatures()
      // In flight: nothing is granted, so gated controls never flash.
      expect(features.hasFeature('lab-access')).toBe(false)
      await vi.waitFor(() => {
        expect(features.hasFeature('lab-access')).toBe(true)
      })
      expect(features.hasFeature('admin-console')).toBe(false)
      dispose()
    })
  })

  it('reads a failed or signed-out fetch as no perks at all', async () => {
    fetchPerksMe.mockResolvedValue(null)
    await createRoot(async (dispose) => {
      const features = useSupporterFeatures()
      await vi.waitFor(() => {
        expect(fetchPerksMe).toHaveBeenCalled()
      })
      expect(features.perks()).toBeNull()
      expect(features.hasFeature('lab-access')).toBe(false)
      dispose()
    })
  })
})
