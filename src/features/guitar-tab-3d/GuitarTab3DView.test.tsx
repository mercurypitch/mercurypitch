// ============================================================
// GuitarTab3DView keyboard camera controls
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarTab3DView } from './GuitarTab3DView'
import type { CameraState } from './renderer/camera'
import { DEFAULT_CAMERA } from './renderer/camera'

const renderer = vi.hoisted(() => ({
  mount: vi.fn(),
  render: vi.fn(),
  setCamera: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('./renderer/TabRenderer', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, createTabRenderer: () => renderer }
})

function renderView(showGizmo = false) {
  return render(() => (
    <GuitarTab3DView
      fallingNotes={() => []}
      playheadBeat={() => 0}
      visibleBeatWindow={() => 8}
      showNoteLabels={() => true}
      showFretboard={() => true}
      isActive={() => true}
      showGizmo={() => showGizmo}
      ariaLabel={() => 'Practice phrase fretboard'}
    />
  ))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('GuitarTab3DView keyboard camera', () => {
  it('exposes a focused equivalent for orbit, zoom, and reset', () => {
    renderView()

    const controls = screen.getByRole('group', {
      name: '3D fretboard view controls',
    })
    const canvas = screen.getByRole('img', {
      name: 'Practice phrase fretboard',
    })
    const instructionsId = controls.getAttribute('aria-describedby')

    expect(controls).toHaveAttribute('tabindex', '0')
    expect(document.getElementById(instructionsId ?? '')).toHaveTextContent(
      'Use the arrow keys to orbit the view',
    )

    controls.focus()
    expect(controls).toHaveFocus()

    const initialYaw = canvas.getAttribute('data-camera-yaw')
    const initialRadius = canvas.getAttribute('data-camera-radius')
    const orbitEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight',
    })
    controls.dispatchEvent(orbitEvent)

    expect(orbitEvent.defaultPrevented).toBe(true)
    expect(canvas.getAttribute('data-camera-yaw')).not.toBe(initialYaw)

    fireEvent.keyDown(controls, { key: '+' })
    expect(Number(canvas.getAttribute('data-camera-radius'))).toBeLessThan(
      Number(initialRadius),
    )

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now() + 300)
      return 1
    })
    fireEvent.keyDown(controls, { key: 'r' })

    expect(canvas).toHaveAttribute(
      'data-camera-yaw',
      DEFAULT_CAMERA.yaw.toFixed(4),
    )
    expect(canvas).toHaveAttribute(
      'data-camera-radius',
      DEFAULT_CAMERA.radius.toFixed(4),
    )
  })

  it('leaves keys from nested controls and playback shortcuts alone', () => {
    renderView(true)

    const controls = screen.getByRole('group', {
      name: '3D fretboard view controls',
    })
    const canvas = screen.getByRole('img', {
      name: 'Practice phrase fretboard',
    })
    const initialYaw = canvas.getAttribute('data-camera-yaw')
    const zoomButton = screen.getByRole('button', { name: 'Zoom in' })

    fireEvent.keyDown(zoomButton, { key: 'ArrowRight' })
    fireEvent.keyDown(controls, { key: ' ' })

    expect(canvas).toHaveAttribute('data-camera-yaw', initialYaw)
  })

  it('uses the host camera for entry and reset without changing legacy defaults', () => {
    const preset: CameraState = {
      yaw: 0.35,
      pitch: 0.7,
      radius: 32,
      target: [1.5, 2, -12],
    }
    render(() => (
      <GuitarTab3DView
        fallingNotes={() => []}
        playheadBeat={() => 0}
        visibleBeatWindow={() => 8}
        showNoteLabels={() => false}
        showFretboard={() => true}
        isActive={() => true}
        showGizmo={() => false}
        cameraPreset={() => preset}
      />
    ))

    const controls = screen.getByRole('group', {
      name: '3D fretboard view controls',
    })
    const canvas = screen.getByRole('img')
    expect(canvas).toHaveAttribute('data-camera-yaw', preset.yaw.toFixed(4))
    expect(canvas).toHaveAttribute(
      'data-camera-radius',
      preset.radius.toFixed(4),
    )
    expect(canvas).toHaveAttribute(
      'data-camera-target-x',
      preset.target[0].toFixed(4),
    )

    fireEvent.keyDown(controls, { key: 'ArrowRight' })
    expect(canvas.getAttribute('data-camera-yaw')).not.toBe(
      preset.yaw.toFixed(4),
    )

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now() + 300)
      return 1
    })
    fireEvent.keyDown(controls, { key: 'r' })
    expect(canvas).toHaveAttribute('data-camera-yaw', preset.yaw.toFixed(4))
    expect(canvas).toHaveAttribute(
      'data-camera-radius',
      preset.radius.toFixed(4),
    )
  })
})
