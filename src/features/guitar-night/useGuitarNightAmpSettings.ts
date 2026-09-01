// Guitar Night amp settings keep one local, versioned tone across both rehearsal rooms.
// ============================================================

import { createMemo, createSignal } from 'solid-js'
import type { GuitarElectricAmpCabinet, GuitarElectricAmpParameters, } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarNightAmpPresetId, GuitarNightAmpSettingsV1, } from './guitar-amp-settings'
import { DEFAULT_GUITAR_NIGHT_AMP_SETTINGS, guitarNightAmpSettingsForPreset, loadGuitarNightAmpSettings, normalizeGuitarNightAmpSettings, saveGuitarNightAmpSettings, } from './guitar-amp-settings'

export type GuitarNightAmpContinuousParameter =
  | 'drive'
  | 'bass'
  | 'mid'
  | 'treble'
  | 'presence'
  | 'output'

function ampParameters(
  settings: GuitarNightAmpSettingsV1,
): GuitarElectricAmpParameters {
  return {
    enabled: settings.enabled,
    drive: settings.drive,
    bass: settings.bass,
    mid: settings.mid,
    treble: settings.treble,
    presence: settings.presence,
    output: settings.output,
    cabinet: settings.cabinet,
    asymmetry: settings.asymmetry,
  }
}

/** Own one in-memory tone and persist only deliberate scalar setting changes. */
export function useGuitarNightAmpSettings() {
  const [settings, setSettingsSignal] = createSignal<GuitarNightAmpSettingsV1>(
    loadGuitarNightAmpSettings(),
  )
  const parameters = createMemo(() => ampParameters(settings()))

  const replace = (candidate: unknown, persist = true): void => {
    const next = normalizeGuitarNightAmpSettings(candidate)
    setSettingsSignal(next)
    if (persist) saveGuitarNightAmpSettings(next)
  }

  const selectPreset = (presetId: GuitarNightAmpPresetId): void => {
    if (presetId === 'custom') return
    replace(guitarNightAmpSettingsForPreset(presetId))
  }

  const setEnabled = (enabled: boolean): void => {
    replace({ ...settings(), enabled })
  }

  const setContinuousParameter = (
    parameter: GuitarNightAmpContinuousParameter,
    value: number,
    persist = true,
  ): void => {
    replace(
      {
        ...settings(),
        presetId: 'custom',
        [parameter]: value,
      },
      persist,
    )
  }

  const setCabinet = (cabinet: GuitarElectricAmpCabinet): void => {
    replace({ ...settings(), presetId: 'custom', cabinet })
  }

  const persist = (): void => {
    saveGuitarNightAmpSettings(settings())
  }

  const reset = (): void => {
    replace(DEFAULT_GUITAR_NIGHT_AMP_SETTINGS)
  }

  return {
    settings,
    parameters,
    selectPreset,
    setEnabled,
    setContinuousParameter,
    setCabinet,
    persist,
    reset,
  }
}

export type GuitarNightAmpSettingsController = ReturnType<
  typeof useGuitarNightAmpSettings
>
