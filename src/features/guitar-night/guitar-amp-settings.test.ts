// Guitar Night amp settings tests pin presets, strict V1 validation, and local persistence.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { GUITAR_ELECTRIC_AMP_CABINETS } from '@/lib/guitar/guitar-electric-amp'
import { clearGuitarNightAmpSettings, customizeGuitarNightAmpSettings, DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, GUITAR_NIGHT_AMP_PRESETS, GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY, guitarNightAmpSettingsForPreset, loadGuitarNightAmpSettings, normalizeGuitarNightAmpSettings, saveGuitarNightAmpSettings, } from './guitar-amp-settings'

beforeEach(() => {
  localStorage.clear()
})

describe('Guitar Night amp presets', () => {
  it('keeps every curated preset complete, bounded, and distinct', () => {
    expect(GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.id)).toEqual([
      'studio-clean',
      'edge',
      'crunch',
      'lead',
    ])
    expect(
      new Set(GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.label)).size,
    ).toBe(GUITAR_NIGHT_AMP_PRESETS.length)

    for (const preset of GUITAR_NIGHT_AMP_PRESETS) {
      const settings = guitarNightAmpSettingsForPreset(preset.id)
      expect(settings).toEqual({
        version: 1,
        presetId: preset.id,
        ...preset.settings,
      })
      expect(settings.drive).toBeGreaterThanOrEqual(0)
      expect(settings.drive).toBeLessThanOrEqual(1)
      expect(settings.output).toBeGreaterThanOrEqual(0)
      expect(settings.output).toBeLessThanOrEqual(1)
      expect(settings.asymmetry).toBeGreaterThanOrEqual(0)
      expect(settings.asymmetry).toBeLessThanOrEqual(1)
      expect(GUITAR_ELECTRIC_AMP_CABINETS).toContain(settings.cabinet)
      for (const control of [
        settings.bass,
        settings.mid,
        settings.treble,
        settings.presence,
      ]) {
        expect(control).toBeGreaterThanOrEqual(-1)
        expect(control).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps the default aligned with the familiar edge preset', () => {
    expect(DEFAULT_GUITAR_NIGHT_AMP_SETTINGS).toEqual(
      guitarNightAmpSettingsForPreset('edge'),
    )
  })
})

describe('normalizeGuitarNightAmpSettings', () => {
  it('clamps a complete finite custom state', () => {
    const normalized = normalizeGuitarNightAmpSettings({
      ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
      presetId: 'custom',
      drive: 4,
      bass: -4,
      mid: 3,
      treble: -2,
      presence: 8,
      output: -3,
      asymmetry: 9,
      cabinet: 'dark',
    })

    expect(normalized).toEqual({
      ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
      presetId: 'custom',
      drive: 1,
      bass: -1,
      mid: 1,
      treble: -1,
      presence: 1,
      output: 0,
      asymmetry: 1,
      cabinet: 'dark',
    })
  })

  it.each([
    ['not an object', null],
    [
      'missing a scalar',
      { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, mid: undefined },
    ],
    [
      'non-finite scalar',
      { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, drive: Number.NaN },
    ],
    ['wrong boolean', { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, enabled: 1 }],
    [
      'unknown cabinet',
      { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, cabinet: 'huge' },
    ],
    [
      'unknown preset',
      { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, presetId: 'metal' },
    ],
    ['future version', { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, version: 2 }],
  ])('falls back for %s', (_label, value) => {
    expect(normalizeGuitarNightAmpSettings(value)).toEqual(
      DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
    )
  })

  it('marks bounded manual changes as custom', () => {
    const current = guitarNightAmpSettingsForPreset('studio-clean')
    const customized = customizeGuitarNightAmpSettings(current, {
      drive: 0.44,
      bass: 2,
    })

    expect(customized).toMatchObject({
      version: 1,
      presetId: 'custom',
      drive: 0.44,
      bass: 1,
      cabinet: 'open',
    })
  })
})

describe('Guitar Night amp local persistence', () => {
  it('round-trips a custom state through localStorage only', () => {
    const custom = customizeGuitarNightAmpSettings(
      guitarNightAmpSettingsForPreset('crunch'),
      { drive: 0.61, cabinet: 'dark' },
    )

    expect(saveGuitarNightAmpSettings(custom)).toEqual(custom)
    expect(loadGuitarNightAmpSettings()).toEqual(custom)
    expect(
      JSON.parse(
        localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
      ),
    ).toEqual(custom)
  })

  it.each([
    '{bad json',
    JSON.stringify({
      ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
      version: 99,
    }),
    JSON.stringify({
      ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
      output: null,
    }),
  ])('falls back safely for corrupt or unsupported storage', (serialized) => {
    localStorage.setItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY, serialized)

    expect(loadGuitarNightAmpSettings()).toEqual(
      DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
    )
  })

  it('clears only the amp preference key', () => {
    localStorage.setItem('unrelated', 'keep')
    saveGuitarNightAmpSettings(guitarNightAmpSettingsForPreset('lead'))

    clearGuitarNightAmpSettings()

    expect(
      localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
    ).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })
})
