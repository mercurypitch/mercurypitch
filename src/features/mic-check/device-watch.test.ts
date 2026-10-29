// The browser half of the roster: the device list, read once a burst of
// changes settles, and what a capture track says it opened.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_SETTLE_MS, listDevices, trackIdentity, watchDeviceChanges, } from './device-watch'
import type { FakeMediaDevices } from './fake-capture.fixture'
import { audioInput, fakeMediaDevices, fakeTrack } from './fake-capture.fixture'

let devices: FakeMediaDevices | null = null

afterEach(() => {
  devices?.restore()
  devices = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('listDevices', () => {
  it('lists what the browser lists', async () => {
    // Arrange
    const usb = audioInput('usb', 'Scarlett 4i4 USB')
    devices = fakeMediaDevices([usb])

    // Act
    const listed = await listDevices()

    // Assert
    expect(listed).toEqual([usb])
  })

  it('lists nothing where the browser keeps no device list', async () => {
    // Arrange
    devices = fakeMediaDevices()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    })

    // Act
    const listed = await listDevices()

    // Assert
    expect(listed).toBeNull()
  })

  it('lists nothing when the browser refuses to', async () => {
    // Arrange
    devices = fakeMediaDevices()
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockRejectedValue(
      new DOMException('Not allowed', 'NotAllowedError'),
    )

    // Act
    const listed = await listDevices()

    // Assert
    expect(listed).toBeNull()
  })
})

describe('watchDeviceChanges', () => {
  it('reads a burst of device changes once, after it settles', () => {
    // Arrange
    vi.useFakeTimers()
    devices = fakeMediaDevices()
    const onChange = vi.fn()
    watchDeviceChanges(onChange)
    devices.change()
    vi.advanceTimersByTime(100)
    devices.change()
    vi.advanceTimersByTime(100)
    devices.change()

    // Act
    vi.advanceTimersByTime(DEVICE_SETTLE_MS)

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('reads nothing more once unsubscribed, not even a change in flight', () => {
    // Arrange
    vi.useFakeTimers()
    devices = fakeMediaDevices()
    const onChange = vi.fn()
    const unwatch = watchDeviceChanges(onChange)
    devices.change()

    // Act
    unwatch()
    devices.change()
    vi.advanceTimersByTime(DEVICE_SETTLE_MS * 2)

    // Assert
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('trackIdentity', () => {
  it('names the device a track opened', () => {
    // Arrange
    const track = fakeTrack({
      label: 'Scarlett 4i4 USB',
      deviceId: 'usb',
      groupId: 'focusrite',
    })

    // Act
    const identity = trackIdentity(track)

    // Assert
    expect(identity).toEqual({
      deviceId: 'usb',
      groupId: 'focusrite',
      label: 'Scarlett 4i4 USB',
    })
  })

  it('reads a blank label, before the grant names it, as no label', () => {
    // Arrange
    const track = fakeTrack({ deviceId: 'usb' })

    // Act
    const identity = trackIdentity(track)

    // Assert
    expect(identity?.label).toBeNull()
  })

  it('has nothing to say without a track', () => {
    // Act
    const identity = trackIdentity(null)

    // Assert
    expect(identity).toBeNull()
  })
})
