// The mic check once it listens: keyboard focus as Start and Stop swap
// places, and the action for a default that moved, which reopens on the new
// default instead of pinning it by id.
//
// The voice session and the manager's stream are faked at their edges, as in
// useMicCheckController.test.ts; the panel and its controller are real.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MicState } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import type { FakeMediaDevices } from './fake-capture.fixture'
import { audioInput, fakeCapture, fakeMediaDevices, fakeStream, fakeTrack, } from './fake-capture.fixture'
import { MicCheckPanel } from './MicCheckPanel'

const voice = vi.hoisted(() => ({
  context: null as AudioContext | null,
  /** Sessions created: one per start of the check. */
  sessions: 0,
  /** The inputs a session was asked to switch to. */
  picked: [] as string[],
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession => {
    voice.sessions++
    return {
      open: (): Promise<OpenResult> => Promise.resolve({ ok: true }),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok'),
      context: () => voice.context,
      useDevice: (deviceId: string): Promise<ProbeResult> => {
        voice.picked.push(deviceId)
        return Promise.resolve('ok')
      },
      isOpen: (): boolean => true,
      close: () => undefined,
    } as unknown as VoiceSession
  },
}))

const SCARLETT = audioInput('usb', 'Scarlett 4i4 USB', 'focusrite')
const BUILT_IN = audioInput('built-in', 'Built-in Microphone')

let devices: FakeMediaDevices

beforeEach(() => {
  voice.sessions = 0
  voice.picked = []
  voice.context = fakeCapture().context
  // jsdom has no 2D canvas; the stage then draws nothing.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  // The system default has moved to the built-in microphone; the check
  // opens on the Scarlett.
  devices = fakeMediaDevices([
    audioInput('default', 'Default - Built-in Microphone', 'built-in'),
    SCARLETT,
    BUILT_IN,
  ])
  const track = fakeTrack({
    label: 'Scarlett 4i4 USB',
    deviceId: 'usb',
    groupId: 'focusrite',
  })
  vi.spyOn(micManager, 'getStream').mockReturnValue(fakeStream(track))
  vi.spyOn(micManager, 'getPreferredDevice').mockReturnValue(null)
  vi.spyOn(micManager, 'forceReleaseAll').mockResolvedValue()
  vi.spyOn(micManager, 'subscribe').mockImplementation((listener) => {
    listener({
      active: true,
      error: null,
      consumers: [],
      blockedBy: null,
    } satisfies MicState)
    return () => {}
  })
})

afterEach(() => {
  cleanup()
  devices.restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MicCheckPanel while listening', () => {
  it('hands keyboard focus from Start to Stop and back', async () => {
    // Arrange
    render(() => <MicCheckPanel />)
    const start = screen.getByTestId('mic-check-start')
    start.focus()

    // Act
    start.click()

    // Assert
    const stop = await screen.findByTestId('mic-check-stop')
    await vi.waitFor(() => expect(document.activeElement).toBe(stop))

    // Act: Stop, from the keyboard too.
    stop.click()

    // Assert
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByTestId('mic-check-start'),
      ),
    )
  })

  it('reopens on a default that moved, without pinning it', async () => {
    // Arrange
    render(() => <MicCheckPanel />)
    screen.getByTestId('mic-check-start').click()
    const listen = await screen.findByRole('button', {
      name: 'Listen to the new default',
    })

    // Act
    listen.click()

    // Assert: a fresh open on the default; no input picked by its id.
    await vi.waitFor(() => expect(voice.sessions).toBe(2))
    expect(voice.picked).toEqual([])
  })
})
