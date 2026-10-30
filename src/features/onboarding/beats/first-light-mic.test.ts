// What First Light's waiting screen reads its microphone from: the stage
// feed, which follows the voice session's capture and takes its note from
// the session's own frames, and the roster, which marks the input the
// capture opened and follows devices that come and go.

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_SETTLE_MS } from '@/features/mic-check/device-watch'
import type { FakeMediaDevices } from '@/features/mic-check/fake-capture.fixture'
import { audioInput, fakeCapture, fakeMediaDevices, fakeStream, fakeTrack, sine, } from '@/features/mic-check/fake-capture.fixture'
import { listeningInput } from '@/features/mic-check/mic-roster'
import { LAND_MS } from '@/features/mic-check/note-tracker'
import { micManager } from '@/lib/mic-manager'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { VoiceSession } from '@/lib/voice-session'
import type { InputRoster } from './first-light-mic'
import { createStageFeed, useInputRoster } from './first-light-mic'

const FRAME_MS = 16
const HOLD_FRAMES = Math.ceil(LAND_MS / FRAME_MS) + 4

const SCARLETT = audioInput('usb', 'Scarlett 4i4 USB', 'focusrite')
const BUILT_IN = audioInput('built-in', 'Built-in Microphone')

/** The two things the feed asks a voice session. */
function sessionWith(
  context: AudioContext | null,
  frame: PitchFrame | null = null,
): VoiceSession {
  return { context: () => context, latest: () => frame } as VoiceSession
}

let devices: FakeMediaDevices | null = null

afterEach(() => {
  devices?.restore()
  devices = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createStageFeed', () => {
  it('stays at rest while the session has no audio graph', () => {
    // Arrange
    vi.spyOn(micManager, 'getStream').mockReturnValue(fakeStream())
    const feed = createStageFeed()

    // Act
    feed.read(sessionWith(null), 0)

    // Assert
    expect(feed.live.active).toBe(false)
  })

  it("paints the level of the session's capture", () => {
    // Arrange
    const capture = fakeCapture()
    capture.play(sine(220, 0.3))
    vi.spyOn(micManager, 'getStream').mockReturnValue(fakeStream())
    const feed = createStageFeed()

    // Act
    feed.read(sessionWith(capture.context), 0)

    // Assert
    expect(feed.live.active).toBe(true)
    expect(feed.live.rms).toBeCloseTo(0.3 / Math.SQRT2, 2)
  })

  it("lands the note the session's own frame heard, not one of its own", () => {
    // Arrange: the audio is an A4, the session's frame an A3.
    const capture = fakeCapture()
    capture.play(sine(440, 0.3))
    vi.spyOn(micManager, 'getStream').mockReturnValue(fakeStream())
    const session = sessionWith(capture.context, {
      t: 0,
      f0: 220,
      conf: 0.95,
      rms: 0.2,
    })
    const feed = createStageFeed()

    // Act
    for (let i = 0; i < HOLD_FRAMES; i++) feed.read(session, i * FRAME_MS)

    // Assert
    expect(feed.live.note?.midi).toBe(57)
  })

  it('follows a switch of input onto the new stream', () => {
    // Arrange
    const capture = fakeCapture()
    const getStream = vi
      .spyOn(micManager, 'getStream')
      .mockReturnValue(fakeStream())
    const session = sessionWith(capture.context)
    const feed = createStageFeed()
    feed.read(session, 0)
    const [oldSource] = capture.nodes
    getStream.mockReturnValue(fakeStream())

    // Act
    feed.read(session, FRAME_MS)

    // Assert: the old graph let go, a new one built on the new stream.
    expect(oldSource?.disconnect).toHaveBeenCalled()
    expect(capture.nodes).toHaveLength(6)
    expect(feed.live.active).toBe(true)
  })

  it('settles the stage to rest when it stops', () => {
    // Arrange
    const capture = fakeCapture()
    capture.play(sine(220, 0.3))
    vi.spyOn(micManager, 'getStream').mockReturnValue(fakeStream())
    const feed = createStageFeed()
    feed.read(sessionWith(capture.context), 0)

    // Act
    feed.stop()

    // Assert
    expect(feed.live.active).toBe(false)
    expect(feed.live.rms).toBe(0)
    for (const node of capture.nodes) expect(node.disconnect).toHaveBeenCalled()
  })
})

describe('useInputRoster', () => {
  /** A roster under its own root, and the way to end that root. */
  function mounted(): InputRoster & { dispose: () => void } {
    return createRoot((dispose) => ({ ...useInputRoster(), dispose }))
  }

  it('marks the input the capture opened as the one Merc hears', async () => {
    // Arrange
    devices = fakeMediaDevices([BUILT_IN, SCARLETT])
    vi.spyOn(micManager, 'getStream').mockReturnValue(
      fakeStream(
        fakeTrack({
          label: 'Scarlett 4i4 USB',
          deviceId: 'usb',
          groupId: 'focusrite',
        }),
      ),
    )
    const inputs = mounted()

    // Act
    await inputs.refresh()

    // Assert
    expect(listeningInput(inputs.roster())?.name).toBe('Scarlett 4i4 USB')
    expect(inputs.settings()?.sampleRate).toBe(48_000)
    inputs.dispose()
  })

  it('lists the inputs again once a device change settles', async () => {
    // Arrange
    vi.useFakeTimers()
    devices = fakeMediaDevices([BUILT_IN])
    vi.spyOn(micManager, 'getStream').mockReturnValue(null)
    const inputs = mounted()
    await inputs.refresh()
    devices.list([BUILT_IN, SCARLETT])

    // Act
    devices.change()
    await vi.advanceTimersByTimeAsync(DEVICE_SETTLE_MS)

    // Assert
    expect(inputs.roster().inputs.map((input) => input.name)).toEqual([
      'Built-in Microphone',
      'Scarlett 4i4 USB',
    ])
    inputs.dispose()
  })

  it('stops following device changes once its owner is gone', async () => {
    // Arrange
    vi.useFakeTimers()
    devices = fakeMediaDevices([BUILT_IN])
    vi.spyOn(micManager, 'getStream').mockReturnValue(null)
    const inputs = mounted()
    await inputs.refresh()
    devices.list([BUILT_IN, SCARLETT])

    // Act
    inputs.dispose()
    devices.change()
    await vi.advanceTimersByTimeAsync(DEVICE_SETTLE_MS)

    // Assert
    expect(inputs.roster().inputs).toHaveLength(1)
  })
})
