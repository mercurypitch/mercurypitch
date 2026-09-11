// Guitar Night amp settings tests pin preset recipes, lossless V1 migration, and V2 persistence.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { GUITAR_ELECTRIC_AMP_CABINETS } from '@/lib/guitar/guitar-electric-amp'
import { clearGuitarNightAmpSettings, customizeGuitarNightAmpSettings, DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY, GUITAR_NIGHT_AMP_PRESETS, GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY, guitarNightAmpSettingsForPreset, loadGuitarNightAmpSettings, normalizeGuitarNightAmpSettings, saveGuitarNightAmpSettings, } from './guitar-amp-settings'

beforeEach(() => {
  localStorage.clear()
})

describe('Guitar Night amp presets', () => {
  it('keeps every curated preset complete, bounded, and distinct', () => {
    expect(GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.id)).toEqual([
      'tight',
      'articulate',
      'heavy',
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
        version: 2,
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

  it('starts new preferences at the auditioned Tight recipe', () => {
    expect(DEFAULT_GUITAR_NIGHT_AMP_SETTINGS).toEqual(
      guitarNightAmpSettingsForPreset('tight'),
    )
    expect(DEFAULT_GUITAR_NIGHT_AMP_SETTINGS).toMatchObject({
      engine: 'studio',
      head: 'definition',
      character: 1,
      drive: 0.7,
      output: 0.6,
      bass: 0,
      mid: 0,
      treble: 0,
      presence: 0,
      asymmetry: 0,
    })
  })

  it('keeps the two Definition endpoints on the same cabinet and Heavy on its own head', () => {
    const tight = guitarNightAmpSettingsForPreset('tight')
    expect(guitarNightAmpSettingsForPreset('articulate')).toEqual({
      ...tight,
      presetId: 'articulate',
      character: 0,
    })
    expect(guitarNightAmpSettingsForPreset('heavy')).toEqual({
      ...tight,
      presetId: 'heavy',
      head: 'heavy',
    })
  })

  it('selects and restores Lead on its own Studio head with the shared cabinet', () => {
    const chosen = guitarNightAmpSettingsForPreset('lead')
    expect(chosen).toEqual({
      ...guitarNightAmpSettingsForPreset('tight'),
      presetId: 'lead',
      head: 'lead',
    })
    expect(saveGuitarNightAmpSettings(chosen)).toEqual(chosen)
    expect(loadGuitarNightAmpSettings()).toEqual(chosen)
    const custom = customizeGuitarNightAmpSettings(chosen, { drive: 0.51 })
    expect(saveGuitarNightAmpSettings(custom)).toEqual(custom)
    expect(loadGuitarNightAmpSettings()).toEqual(custom)
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
      character: -3,
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
      character: 0,
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
    ['future version', { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, version: 3 }],
    [
      'missing engine',
      { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, engine: undefined },
    ],
    ['unknown engine', { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, engine: 'nam' }],
    ['unknown head', { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, head: 'giant' }],
    [
      'invalid character',
      { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, character: Infinity },
    ],
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
      version: 2,
      presetId: 'custom',
      drive: 0.44,
      bass: 1,
      cabinet: 'open',
    })
  })
})

const legacyCustom = {
  version: 1,
  presetId: 'custom',
  enabled: false,
  drive: 0.47,
  bass: -0.4,
  mid: 0.28,
  treble: -0.51,
  presence: 0.09,
  output: 0.38,
  cabinet: 'dark',
  asymmetry: 0.16,
}

// Literal pre-Studio Lead: the factory now deliberately returns the new head.
const legacyLead = {
  version: 1,
  presetId: 'lead',
  enabled: true,
  drive: 0.84,
  bass: -0.1,
  mid: 0.38,
  treble: -0.22,
  presence: 0.08,
  output: 0.25,
  cabinet: 'dark',
  asymmetry: 0.46,
}

describe('Guitar Night V1 migration', () => {
  it('preserves every custom scalar, cabinet and bypass without adopting a Studio head', () => {
    expect(
      normalizeGuitarNightAmpSettings({
        ...legacyCustom,
        engine: 'studio',
        head: 'heavy',
        character: 0,
      }),
    ).toEqual({
      ...legacyCustom,
      version: 2,
      engine: 'lite',
      head: 'definition',
      character: 1,
    })
  })

  it.each(['studio-clean', 'edge', 'crunch'] as const)(
    'keeps %s on the unchanged Lite recipe',
    (presetId) => {
      const preset = guitarNightAmpSettingsForPreset(presetId)
      const {
        engine: _engine,
        head: _head,
        character: _character,
        ...legacy
      } = preset
      expect(
        normalizeGuitarNightAmpSettings({ ...legacy, version: 1 }),
      ).toEqual(preset)
      expect(preset.engine).toBe('lite')
    },
  )

  it.each([1, 2])(
    'keeps stored V%d Lite Lead values as Custom until the user chooses the new head',
    (version) => {
      const stored = {
        ...legacyLead,
        version,
        engine: 'lite',
        head: 'definition',
        character: 1,
      }
      const key =
        version === 1
          ? GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY
          : GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY
      const serialized = JSON.stringify(stored)
      localStorage.setItem(key, serialized)
      expect(loadGuitarNightAmpSettings()).toEqual({
        ...stored,
        version: 2,
        presetId: 'custom',
      })
      expect(localStorage.getItem(key)).toBe(serialized)
      expect(
        normalizeGuitarNightAmpSettings({
          ...stored,
          enabled: false,
          drive: 0.53,
        }),
      ).toEqual({
        ...stored,
        version: 2,
        presetId: 'custom',
        enabled: false,
        drive: 0.53,
      })
    },
  )

  it('does not accept a new head name inside a legacy envelope', () => {
    expect(
      normalizeGuitarNightAmpSettings({ ...legacyCustom, presetId: 'tight' }),
    ).toEqual(DEFAULT_GUITAR_NIGHT_AMP_SETTINGS)
  })

  it('migrates in memory without writing or deleting the old key', () => {
    const oldSerialized = JSON.stringify(legacyCustom)
    localStorage.setItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY, oldSerialized)

    expect(loadGuitarNightAmpSettings()).toEqual({
      ...legacyCustom,
      version: 2,
      engine: 'lite',
      head: 'definition',
      character: 1,
    })
    expect(
      localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
    ).toBeNull()
    expect(localStorage.getItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY)).toBe(
      oldSerialized,
    )
  })

  it('prefers a deliberate V2 edit and leaves the old app preference recoverable', () => {
    const oldSerialized = JSON.stringify(legacyCustom)
    localStorage.setItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY, oldSerialized)
    const chosen = guitarNightAmpSettingsForPreset('heavy')

    saveGuitarNightAmpSettings(chosen)

    expect(loadGuitarNightAmpSettings()).toEqual(chosen)
    expect(localStorage.getItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY)).toBe(
      oldSerialized,
    )
  })

  it('does not silently resurrect V1 when the newer preference is corrupt', () => {
    localStorage.setItem(
      GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY,
      JSON.stringify(legacyCustom),
    )
    localStorage.setItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY, '{broken')

    expect(loadGuitarNightAmpSettings()).toEqual(
      DEFAULT_GUITAR_NIGHT_AMP_SETTINGS,
    )
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
