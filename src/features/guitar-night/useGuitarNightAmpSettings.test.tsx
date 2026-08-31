// Guitar Night amp settings controller tests protect local persistence and live previews.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY } from './guitar-amp-settings'
import { useGuitarNightAmpSettings } from './useGuitarNightAmpSettings'

describe('useGuitarNightAmpSettings', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('shares one persisted curated tone without activating audio', () => {
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()

      expect(amp.settings().presetId).toBe('edge')
      amp.selectPreset('crunch')

      expect(amp.settings().presetId).toBe('crunch')
      expect(amp.parameters().drive).toBeGreaterThan(0.5)
      expect(
        JSON.parse(
          localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
        ),
      ).toMatchObject({ version: 1, presetId: 'crunch' })
      dispose()
    })
  })

  it('previews a bounded custom value and writes only on commit', () => {
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()
      amp.setContinuousParameter('mid', -4, false)

      expect(amp.settings()).toMatchObject({ presetId: 'custom', mid: -1 })
      expect(
        localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
      ).toBeNull()

      amp.persist()
      expect(
        JSON.parse(
          localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
        ),
      ).toMatchObject({ presetId: 'custom', mid: -1 })
      dispose()
    })
  })

  it('keeps bypass on the selected preset and reset restores the safe default', () => {
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()
      amp.selectPreset('lead')
      amp.setEnabled(false)

      expect(amp.settings()).toMatchObject({ presetId: 'lead', enabled: false })

      amp.reset()
      expect(amp.settings()).toMatchObject({ presetId: 'edge', enabled: true })
      dispose()
    })
  })
})
