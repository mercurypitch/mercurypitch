// Guitar Night amp settings controller tests protect local persistence and live previews.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY, GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY, } from './guitar-amp-settings'
import { useGuitarNightAmpSettings } from './useGuitarNightAmpSettings'

const legacyLead = {
  version: 1,
  presetId: 'lead',
  enabled: false,
  drive: 0.84,
  bass: -0.1,
  mid: 0.38,
  treble: -0.22,
  presence: 0.08,
  output: 0.25,
  cabinet: 'dark',
  asymmetry: 0.46,
}

describe('useGuitarNightAmpSettings', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('shares one persisted curated tone without activating audio', () => {
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()

      expect(amp.settings().presetId).toBe('tight')
      amp.selectPreset('crunch')

      expect(amp.settings().presetId).toBe('crunch')
      expect(amp.parameters().drive).toBeGreaterThan(0.5)
      expect(
        JSON.parse(
          localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
        ),
      ).toMatchObject({ version: 2, presetId: 'crunch', engine: 'lite' })
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

  it('never turns a bypassed amp on while choosing or resetting a tone', () => {
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()
      amp.selectPreset('lead')
      amp.setEnabled(false)

      expect(amp.settings()).toMatchObject({ presetId: 'lead', enabled: false })

      amp.selectPreset('heavy')
      expect(amp.settings()).toMatchObject({
        presetId: 'heavy',
        enabled: false,
        engine: 'studio',
        head: 'heavy',
      })

      amp.reset()
      expect(amp.settings()).toMatchObject({
        presetId: 'tight',
        enabled: false,
        engine: 'studio',
        head: 'definition',
      })
      dispose()
    })
  })

  it('forwards the live Character value and persists it only at gesture commit', () => {
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()

      amp.setContinuousParameter('character', 0.36, false)

      expect(amp.parameters()).toMatchObject({
        engine: 'studio',
        head: 'definition',
        character: 0.36,
      })
      expect(amp.settings().presetId).toBe('custom')
      expect(
        localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
      ).toBeNull()
      amp.persist()
      expect(
        JSON.parse(
          localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
        ),
      ).toMatchObject({ version: 2, presetId: 'custom', character: 0.36 })
      dispose()
    })
  })

  it('does not open audio, fetch assets or rewrite a migrated preference on mount', () => {
    const audio = vi.spyOn(globalThis, 'AudioContext')
    const fetch = vi.spyOn(globalThis, 'fetch')
    const saved = JSON.stringify(legacyLead)
    localStorage.setItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY, saved)

    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()
      expect(amp.parameters()).toMatchObject({
        engine: 'lite',
        enabled: false,
        drive: 0.84,
      })
      expect(amp.settings().presetId).toBe('custom')
      dispose()
    })

    expect(audio).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(
      localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
    ).toBeNull()
    expect(localStorage.getItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY)).toBe(
      saved,
    )
    audio.mockRestore()
    fetch.mockRestore()
  })

  it('adopts Studio Lead only after an explicit selection and keeps the saved bypass', () => {
    localStorage.setItem(
      GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY,
      JSON.stringify(legacyLead),
    )
    createRoot((dispose) => {
      const amp = useGuitarNightAmpSettings()

      amp.selectPreset('lead')

      expect(amp.settings()).toMatchObject({
        presetId: 'lead',
        engine: 'studio',
        head: 'lead',
        enabled: false,
      })
      expect(
        JSON.parse(
          localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
        ),
      ).toEqual(amp.settings())
      dispose()
    })
  })
})
