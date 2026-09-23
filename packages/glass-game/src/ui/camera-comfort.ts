// Camera comfort tuning — bounded shared settings, presets and persistence format.

import { CAMERA_FOLLOW_SMOOTHNESS } from '../render/camera'

export const CAMERA_COMFORT_PREFERENCE = 'camera-comfort:v1'

export const LOOK_SENSITIVITY = {
  minimum: 0.4,
  maximum: 1.8,
  default: 1,
} as const

export interface CameraComfortSettings {
  lookSensitivity: number
  followSmoothnessSeconds: number
}

export interface CameraComfortPreset {
  id: 'gentle' | 'responsive'
  label: string
  settings: CameraComfortSettings
}

export const DEFAULT_CAMERA_COMFORT: CameraComfortSettings = {
  lookSensitivity: LOOK_SENSITIVITY.default,
  followSmoothnessSeconds: CAMERA_FOLLOW_SMOOTHNESS.default,
}

export const CAMERA_COMFORT_PRESETS: readonly CameraComfortPreset[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    settings: { lookSensitivity: 0.8, followSmoothnessSeconds: 0.32 },
  },
  {
    id: 'responsive',
    label: 'Responsive',
    settings: { lookSensitivity: 1.2, followSmoothnessSeconds: 0.12 },
  },
]

function bounded(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

export function normalizeCameraComfort(
  source: Partial<CameraComfortSettings> | null | undefined,
): CameraComfortSettings {
  return {
    lookSensitivity: bounded(
      source?.lookSensitivity,
      LOOK_SENSITIVITY.minimum,
      LOOK_SENSITIVITY.maximum,
      DEFAULT_CAMERA_COMFORT.lookSensitivity,
    ),
    followSmoothnessSeconds: bounded(
      source?.followSmoothnessSeconds,
      CAMERA_FOLLOW_SMOOTHNESS.minimum,
      CAMERA_FOLLOW_SMOOTHNESS.maximum,
      DEFAULT_CAMERA_COMFORT.followSmoothnessSeconds,
    ),
  }
}

export function parseCameraComfort(raw: string | null): CameraComfortSettings {
  if (raw === null) return { ...DEFAULT_CAMERA_COMFORT }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null)
      return { ...DEFAULT_CAMERA_COMFORT }
    return normalizeCameraComfort(parsed as Partial<CameraComfortSettings>)
  } catch {
    return { ...DEFAULT_CAMERA_COMFORT }
  }
}

export function serializeCameraComfort(
  settings: CameraComfortSettings,
): string {
  return JSON.stringify(normalizeCameraComfort(settings))
}

export function cameraComfortPresetText(
  settings: CameraComfortSettings,
): string {
  return JSON.stringify(
    { cameraComfort: normalizeCameraComfort(settings) },
    null,
    2,
  )
}
