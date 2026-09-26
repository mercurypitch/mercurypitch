// Camera mode preference controller — owns validated persistence and applies live view changes.

import { createSignal } from 'solid-js'
import type { GlassGameHost } from '../host'
import type { GlassRenderer } from '../render/glass-renderer'
import type { AdventureCameraMode } from './camera-mode'
import { CAMERA_MODE_PREFERENCE, parseCameraMode, serializeCameraMode, } from './camera-mode'
import type { AdventureInput } from './input'

export function createCameraModePreference(
  host: Pick<GlassGameHost, 'readPreference' | 'writePreference'>,
  input: Pick<AdventureInput, 'clear'>,
  renderer: () => Pick<
    GlassRenderer,
    'setCameraMode' | 'setMovementActive'
  > | null,
) {
  const [cameraMode, setCameraMode] = createSignal(
    parseCameraMode(host.readPreference(CAMERA_MODE_PREFERENCE)),
  )
  return {
    cameraMode,
    changeCameraMode(next: AdventureCameraMode): void {
      const mode = parseCameraMode(next)
      setCameraMode(mode)
      host.writePreference(CAMERA_MODE_PREFERENCE, serializeCameraMode(mode))
      input.clear()
      const activeRenderer = renderer()
      activeRenderer?.setMovementActive(false)
      activeRenderer?.setCameraMode(mode)
    },
  }
}
