// Camera mode preference regression — only supported perspectives survive persistence.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAMERA_MODE_PREFERENCE, DEFAULT_CAMERA_MODE, handleCameraModeShortcut, parseCameraMode, serializeCameraMode, toggleCameraMode, } from './camera-mode'

function shortcutEvent(
  overrides: Partial<Parameters<typeof handleCameraModeShortcut>[0]> = {},
) {
  return {
    altKey: false,
    code: 'KeyV',
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    preventDefault: vi.fn(),
    repeat: false,
    ...overrides,
  }
}

describe('camera mode preference', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('defaults missing and unknown saved values to third-person', () => {
    expect(CAMERA_MODE_PREFERENCE).toBe('camera-mode:v1')
    expect(parseCameraMode(null)).toBe(DEFAULT_CAMERA_MODE)
    expect(parseCameraMode('')).toBe(DEFAULT_CAMERA_MODE)
    expect(parseCameraMode('immersive')).toBe(DEFAULT_CAMERA_MODE)
  })

  it('round-trips both supported modes', () => {
    expect(parseCameraMode(serializeCameraMode('third-person'))).toBe(
      'third-person',
    )
    expect(parseCameraMode(serializeCameraMode('first-person'))).toBe(
      'first-person',
    )
  })

  it('toggles between the two perspectives', () => {
    expect(toggleCameraMode('third-person')).toBe('first-person')
    expect(toggleCameraMode('first-person')).toBe('third-person')
  })

  it('only toggles V from the focused gameplay viewport', () => {
    const viewport = {} as HTMLElement
    const editableInput = {} as HTMLElement
    const toggle = vi.fn()
    vi.stubGlobal('document', { activeElement: editableInput })

    expect(
      handleCameraModeShortcut(shortcutEvent(), viewport, false, toggle),
    ).toBe(true)
    expect(toggle).not.toHaveBeenCalled()

    vi.stubGlobal('document', { activeElement: viewport })
    const accepted = shortcutEvent()
    expect(handleCameraModeShortcut(accepted, viewport, false, toggle)).toBe(
      true,
    )
    expect(accepted.preventDefault).toHaveBeenCalledOnce()
    expect(toggle).toHaveBeenCalledOnce()
  })

  it('ignores repeated, modified, prevented and blocked V presses', () => {
    const viewport = {} as HTMLElement
    vi.stubGlobal('document', { activeElement: viewport })
    const toggle = vi.fn()

    for (const event of [
      shortcutEvent({ repeat: true }),
      shortcutEvent({ ctrlKey: true }),
      shortcutEvent({ altKey: true }),
      shortcutEvent({ metaKey: true }),
      shortcutEvent({ defaultPrevented: true }),
    ]) {
      expect(handleCameraModeShortcut(event, viewport, false, toggle)).toBe(
        true,
      )
    }
    expect(
      handleCameraModeShortcut(shortcutEvent(), viewport, true, toggle),
    ).toBe(true)
    expect(toggle).not.toHaveBeenCalled()
  })
})
