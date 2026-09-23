// Camera comfort settings regression — saved and copied values remain bounded.

import { describe, expect, it } from 'vitest'
import { CAMERA_FOLLOW_SMOOTHNESS } from '../render/camera'
import { CAMERA_COMFORT_PRESETS, cameraComfortPresetText, DEFAULT_CAMERA_COMFORT, LOOK_SENSITIVITY, parseCameraComfort, serializeCameraComfort, } from './camera-comfort'

describe('camera comfort settings', () => {
  it('uses defaults for missing, malformed and non-finite values', () => {
    expect(parseCameraComfort(null)).toEqual(DEFAULT_CAMERA_COMFORT)
    expect(parseCameraComfort('{')).toEqual(DEFAULT_CAMERA_COMFORT)
    expect(
      parseCameraComfort(
        JSON.stringify({
          lookSensitivity: 'fast',
          followSmoothnessSeconds: null,
        }),
      ),
    ).toEqual(DEFAULT_CAMERA_COMFORT)
  })

  it('clamps persisted values and round-trips the supported shape', () => {
    const bounded = parseCameraComfort(
      JSON.stringify({
        lookSensitivity: 99,
        followSmoothnessSeconds: -2,
        ignored: true,
      }),
    )
    expect(bounded).toEqual({
      lookSensitivity: LOOK_SENSITIVITY.maximum,
      followSmoothnessSeconds: CAMERA_FOLLOW_SMOOTHNESS.minimum,
    })
    expect(parseCameraComfort(serializeCameraComfort(bounded))).toEqual(bounded)
  })

  it('keeps gentle and responsive presets distinct and copyable', () => {
    const gentle = CAMERA_COMFORT_PRESETS.find(
      (preset) => preset.id === 'gentle',
    )!
    const responsive = CAMERA_COMFORT_PRESETS.find(
      (preset) => preset.id === 'responsive',
    )!
    expect(gentle.settings.lookSensitivity).toBeLessThan(
      responsive.settings.lookSensitivity,
    )
    expect(gentle.settings.followSmoothnessSeconds).toBeGreaterThan(
      responsive.settings.followSmoothnessSeconds,
    )
    expect(JSON.parse(cameraComfortPresetText(gentle.settings))).toEqual({
      cameraComfort: gentle.settings,
    })
  })
})
