// Camera mode preference — validates and persists the player's exploration perspective.

import type { AdventureCameraMode } from '../render/camera-policy'

export type { AdventureCameraMode } from '../render/camera-policy'

export const CAMERA_MODE_PREFERENCE = 'camera-mode:v1'
export const DEFAULT_CAMERA_MODE: AdventureCameraMode = 'third-person'

export function parseCameraMode(raw: string | null): AdventureCameraMode {
  return raw === 'first-person' || raw === 'third-person'
    ? raw
    : DEFAULT_CAMERA_MODE
}

export function serializeCameraMode(mode: AdventureCameraMode): string {
  return parseCameraMode(mode)
}

export function toggleCameraMode(
  mode: AdventureCameraMode,
): AdventureCameraMode {
  return mode === 'first-person' ? 'third-person' : 'first-person'
}

export function handleCameraModeShortcut(
  event: Pick<
    KeyboardEvent,
    | 'altKey'
    | 'code'
    | 'ctrlKey'
    | 'defaultPrevented'
    | 'metaKey'
    | 'preventDefault'
    | 'repeat'
  >,
  viewport: HTMLElement,
  blocked: boolean,
  toggle: () => void,
): boolean {
  if (event.code !== 'KeyV') return false
  if (
    !blocked &&
    document.activeElement === viewport &&
    !event.repeat &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault()
    toggle()
  }
  return true
}
