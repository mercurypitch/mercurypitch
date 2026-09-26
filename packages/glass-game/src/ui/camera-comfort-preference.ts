// Camera comfort preference controller — owns validated persistence and live follow response.

import { createSignal } from 'solid-js'
import type { GlassGameHost } from '../host'
import type { GlassRenderer } from '../render/glass-renderer'
import type { CameraComfortSettings } from './camera-comfort'
import { CAMERA_COMFORT_PREFERENCE, normalizeCameraComfort, parseCameraComfort, serializeCameraComfort, } from './camera-comfort'

export function createCameraComfortPreference(
  host: Pick<GlassGameHost, 'readPreference' | 'writePreference'>,
  renderer: () => Pick<GlassRenderer, 'setFollowSmoothness'> | null,
) {
  const [cameraComfort, setCameraComfort] = createSignal(
    parseCameraComfort(host.readPreference(CAMERA_COMFORT_PREFERENCE)),
  )
  return {
    cameraComfort,
    changeCameraComfort(next: CameraComfortSettings): void {
      const normalized = normalizeCameraComfort(next)
      setCameraComfort(normalized)
      host.writePreference(
        CAMERA_COMFORT_PREFERENCE,
        serializeCameraComfort(normalized),
      )
      renderer()?.setFollowSmoothness(normalized.followSmoothnessSeconds)
    },
  }
}
