// Studio inputs tests — the list holds the browser's audio inputs from the start, reads them again at a plug without waiting for a settle, and stops reading once the Studio is gone.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FakeMediaDevices } from '@/lib/audio-input/fake-devices.fixture'
import { audioInput, fakeMediaDevices, } from '@/lib/audio-input/fake-devices.fixture'
import { createStudioInputs } from './studio-inputs'

let devices: FakeMediaDevices | null = null
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  devices?.restore()
  devices = null
  vi.useRealTimers()
})

/** The Studio's input list, owned the way the Studio's hook owns it. */
function studioInputs() {
  return createRoot((done) => {
    dispose = done
    return createStudioInputs()
  })
}

const speakers = {
  ...audioInput('speakers', 'Speakers'),
  kind: 'audiooutput',
} as MediaDeviceInfo

describe('createStudioInputs', () => {
  it('holds the audio inputs from the start, and no outputs', async () => {
    // Arrange
    vi.useFakeTimers()
    const desk = audioInput('desk-mic', 'Desk mic')
    devices = fakeMediaDevices([desk, speakers])

    // Act
    const inputs = studioInputs()
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(inputs.devices()).toEqual([desk])
  })

  it('reads the list again at a plug, without waiting for the burst to settle', async () => {
    // Arrange
    vi.useFakeTimers()
    const desk = audioInput('desk-mic', 'Desk mic')
    const usb = audioInput('usb', 'Interface In 1')
    devices = fakeMediaDevices([desk])
    const inputs = studioInputs()
    await vi.advanceTimersByTimeAsync(0)

    // Act
    devices.list([desk, usb])
    devices.change()
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(inputs.devices()).toEqual([desk, usb])
  })

  it('reads nothing more once the Studio is gone', async () => {
    // Arrange
    vi.useFakeTimers()
    const desk = audioInput('desk-mic', 'Desk mic')
    devices = fakeMediaDevices([desk])
    const inputs = studioInputs()
    await vi.advanceTimersByTimeAsync(0)
    dispose?.()
    dispose = null
    const enumerate = vi.spyOn(navigator.mediaDevices, 'enumerateDevices')

    // Act
    devices.list([desk, audioInput('usb', 'Interface In 1')])
    devices.change()
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    expect(enumerate).not.toHaveBeenCalled()
    expect(inputs.devices()).toEqual([desk])
  })
})
