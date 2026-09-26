// Camera comfort preference regression — updates stay reactive and reach the current renderer.

import { describe, expect, it, vi } from 'vitest'
import { CAMERA_COMFORT_PREFERENCE, serializeCameraComfort, } from './camera-comfort'
import { createCameraComfortPreference } from './camera-comfort-preference'

describe('camera comfort preference controller', () => {
  it('loads saved settings and applies normalized changes to the current renderer', () => {
    const initial = {
      lookSensitivity: 0.8,
      followSmoothnessSeconds: 0.42,
    }
    const writePreference = vi.fn()
    const setFollowSmoothness = vi.fn()
    let activeRenderer: { setFollowSmoothness(seconds: number): void } | null =
      null
    const renderer = vi.fn(() => activeRenderer)
    const preference = createCameraComfortPreference(
      {
        readPreference: (key) =>
          key === CAMERA_COMFORT_PREFERENCE
            ? serializeCameraComfort(initial)
            : null,
        writePreference,
      },
      renderer,
    )

    expect(preference.cameraComfort()).toEqual(initial)
    expect(renderer).not.toHaveBeenCalled()

    preference.changeCameraComfort({
      lookSensitivity: 99,
      followSmoothnessSeconds: -1,
    })
    expect(preference.cameraComfort()).toEqual({
      lookSensitivity: 1.8,
      followSmoothnessSeconds: 0.08,
    })
    expect(writePreference).toHaveBeenLastCalledWith(
      CAMERA_COMFORT_PREFERENCE,
      serializeCameraComfort(preference.cameraComfort()),
    )
    expect(setFollowSmoothness).not.toHaveBeenCalled()
    expect(renderer).toHaveBeenCalledOnce()

    activeRenderer = { setFollowSmoothness }
    preference.changeCameraComfort({
      lookSensitivity: 1.2,
      followSmoothnessSeconds: 0.2,
    })
    expect(renderer).toHaveBeenCalledTimes(2)
    expect(setFollowSmoothness).toHaveBeenCalledOnce()
    expect(setFollowSmoothness).toHaveBeenCalledWith(0.2)
  })
})
