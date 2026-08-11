// ============================================================
// GuitarTab3DView keyboard camera controls
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarTab3DView } from './GuitarTab3DView'
import type { CameraState } from './renderer/camera'
import { DEFAULT_CAMERA } from './renderer/camera'
import type { TabPresentation } from './renderer/TabRenderer'

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
  it('repaints when the playhead changes without keeping a paused frame loop alive', () => {
    const queuedFrames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    const [playheadBeat, setPlayheadBeat] = createSignal(0)
    render(() => (
      <>
        <button type="button" onClick={() => setPlayheadBeat(2)}>
          Advance
        </button>
        <GuitarTab3DView
          fallingNotes={() => []}
          playheadBeat={playheadBeat}
          visibleBeatWindow={() => 8}
          showNoteLabels={() => true}
          showFretboard={() => true}
          isActive={() => true}
          showGizmo={() => false}
        />
      </>
    ))

    expect(queuedFrames).toHaveLength(1)
    queuedFrames.shift()?.(performance.now())
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(renderer.render.mock.calls[0]?.[0]).toMatchObject({
      playheadBeat: 0,
    })
    expect(queuedFrames).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))

    expect(queuedFrames).toHaveLength(1)
    queuedFrames.shift()?.(performance.now())
    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(renderer.render.mock.calls[1]?.[0]).toMatchObject({
      playheadBeat: 2,
    })
    expect(queuedFrames).toHaveLength(0)
  })

  it('does no hidden playback or camera work and catches up when reactivated', () => {
    let nextFrameId = 0
    const queuedFrames = new Map<number, FrameRequestCallback>()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrameId += 1
      queuedFrames.set(nextFrameId, callback)
      return nextFrameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      queuedFrames.delete(frameId)
    })
    const first: CameraState = {
      yaw: 0,
      pitch: 0.55,
      radius: 21,
      target: [0, -2, -12],
    }
    const second: CameraState = {
      ...first,
      target: [3, -2, -12],
    }
    const [active, setActive] = createSignal(true)
    const [playheadBeat, setPlayheadBeat] = createSignal(0)
    const [preset, setPreset] = createSignal(first)
    render(() => (
      <GuitarTab3DView
        fallingNotes={() => []}
        playheadBeat={playheadBeat}
        visibleBeatWindow={() => 8}
        showNoteLabels={() => true}
        showFretboard={() => true}
        isActive={active}
        showGizmo={() => false}
        cameraPreset={preset}
        cameraAutoFollow={() => true}
        reducedMotion={() => true}
      />
    ))

    const runNextFrame = () => {
      const next = queuedFrames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      expect(next).toBeDefined()
      if (next === undefined) return
      queuedFrames.delete(next[0])
      next[1](performance.now())
    }
    runNextFrame()
    expect(renderer.render).toHaveBeenCalledTimes(1)

    setActive(false)
    setPlayheadBeat(6)
    setPreset(second)

    expect(queuedFrames.size).toBe(0)
    expect(screen.getByRole('img')).toHaveAttribute(
      'data-camera-target-x',
      first.target[0].toFixed(4),
    )

    setActive(true)

    expect(screen.getByRole('img')).toHaveAttribute(
      'data-camera-target-x',
      second.target[0].toFixed(4),
    )
    expect(queuedFrames.size).toBe(1)
    runNextFrame()
    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(renderer.render.mock.calls.at(-1)?.[0]).toMatchObject({
      playheadBeat: 6,
    })
  })

  it('snaps a reduced-motion preset, yields phrase following to a pointer, and resumes on reset', () => {
    const queuedFrames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    const first: CameraState = {
      yaw: 0,
      pitch: 0.55,
      radius: 21,
      target: [0, -2, -12],
    }
    const second: CameraState = {
      yaw: 0.1,
      pitch: 0.65,
      radius: 24,
      target: [2.2, -1, -10],
    }
    const [preset, setPreset] = createSignal(first)
    render(() => (
      <>
        <button type="button" onClick={() => setPreset(second)}>
          Follow next phrase
        </button>
        <GuitarTab3DView
          fallingNotes={() => []}
          playheadBeat={() => 0}
          visibleBeatWindow={() => 8}
          showNoteLabels={() => true}
          showFretboard={() => true}
          isActive={() => true}
          showGizmo={() => false}
          cameraPreset={preset}
          cameraAutoFollow={() => true}
          reducedMotion={() => true}
          reducedEffects={() => true}
        />
      </>
    ))

    const controls = screen.getByRole('group', {
      name: '3D performance view controls',
    })
    const canvas = screen.getByRole('img')
    expect(canvas).toHaveAttribute('data-camera-following', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Follow next phrase' }))
    expect(canvas).toHaveAttribute(
      'data-camera-target-x',
      second.target[0].toFixed(4),
    )
    queuedFrames.shift()?.(performance.now())
    expect(renderer.render.mock.calls.at(-1)?.[0].display).toMatchObject({
      motion: 'reduced',
      effects: 'reduced',
    })

    const pointer = (
      type: string,
      clientX: number,
      clientY: number,
    ): MouseEvent => {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX,
        clientY,
      })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      return event
    }
    canvas.dispatchEvent(pointer('pointerdown', 120, 90))
    canvas.dispatchEvent(pointer('pointermove', 160, 105))
    canvas.dispatchEvent(pointer('pointerup', 160, 105))

    expect(canvas).toHaveAttribute('data-camera-following', 'false')
    expect(canvas).not.toHaveAttribute('data-camera-yaw', second.yaw.toFixed(4))

    fireEvent.keyDown(controls, { key: 'r' })
    expect(canvas).toHaveAttribute('data-camera-following', 'true')
    expect(canvas).toHaveAttribute(
      'data-camera-target-x',
      second.target[0].toFixed(4),
    )
    expect(canvas).toHaveAttribute('data-camera-yaw', second.yaw.toFixed(4))
  })

  it('exposes a focused equivalent for orbit, zoom, and reset', () => {
    renderView()

    const controls = screen.getByRole('group', {
      name: '3D performance view controls',
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
    expect(canvas).toHaveAttribute('data-tab-presentation', 'fret-axis')
  })

  it('leaves keys from nested controls and playback shortcuts alone', () => {
    renderView(true)

    const controls = screen.getByRole('group', {
      name: '3D performance view controls',
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
      name: '3D performance view controls',
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

  it('switches presentation without remounting or moving the camera', () => {
    const [presentation, setPresentation] =
      createSignal<TabPresentation>('string-highway')
    render(() => (
      <>
        <button type="button" onClick={() => setPresentation('fret-axis')}>
          Use grid
        </button>
        <GuitarTab3DView
          fallingNotes={() => []}
          playheadBeat={() => 0}
          visibleBeatWindow={() => 8}
          showNoteLabels={() => false}
          showFretboard={() => true}
          isActive={() => true}
          showGizmo={() => false}
          presentation={presentation}
        />
      </>
    ))

    const canvas = screen.getByRole('img')
    const initialYaw = canvas.getAttribute('data-camera-yaw')
    const initialRadius = canvas.getAttribute('data-camera-radius')
    expect(canvas).toHaveAttribute('data-tab-presentation', 'string-highway')

    fireEvent.click(screen.getByRole('button', { name: 'Use grid' }))

    expect(canvas).toHaveAttribute('data-tab-presentation', 'fret-axis')
    expect(canvas).toHaveAttribute('data-camera-yaw', initialYaw)
    expect(canvas).toHaveAttribute('data-camera-radius', initialRadius)
    expect(renderer.mount).toHaveBeenCalledTimes(1)
  })
})
