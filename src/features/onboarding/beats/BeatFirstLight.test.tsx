// ============================================================
// First light hands its live mic level to the sky (owner decision V11)
// ============================================================
//
// On main a small Merc on this beat pulsed with the mic level. The beat now
// sits on a painted plate, and the reaction moved into the picture: a glow
// where the star will light follows the voice, and the star lights when
// the note lands. FirstLight draws both; this beat only reports the level
// it already measures for its meter, and reports zero once it stops.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'

const mic = vi.hoisted(() => ({ level: 0 }))

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      // A take that never ends: the beat stays on its live meter.
      record: () => new Promise(() => {}),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => mic.level,
      context: () => null,
      isOpen: (): boolean => true,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {},
    }) as unknown as VoiceSession,
}))

import { BeatFirstLight } from './BeatFirstLight'

let queued: Map<number, FrameRequestCallback>
let nextId: number

/** Runs the frames asked for so far, as the browser would on a tick. */
function tick(): void {
  const due = [...queued.values()]
  queued.clear()
  for (const callback of due) callback(performance.now())
}

beforeEach(() => {
  mic.level = 0
  queued = new Map()
  nextId = 1
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++
    queued.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('First light and the live level', () => {
  it('reports every frame of the live level while it listens', async () => {
    // Arrange
    const onLevel = vi.fn<(level: number) => void>()
    render(() => (
      <BeatFirstLight
        onHeard={() => {}}
        onContinue={() => {}}
        onDenied={() => {}}
        onLevel={onLevel}
      />
    ))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start listening' }),
    )
    await vi.waitFor(() => expect(queued.size).toBe(1))

    // Act
    mic.level = 0.02
    tick()
    mic.level = 0.05
    tick()

    // Assert
    expect(onLevel.mock.calls.map(([level]) => level)).toEqual([0.02, 0.05])
  })

  it('reports silence when the beat goes, so the glow does not stay lit', async () => {
    // Arrange
    const onLevel = vi.fn<(level: number) => void>()
    const { unmount } = render(() => (
      <BeatFirstLight
        onHeard={() => {}}
        onContinue={() => {}}
        onDenied={() => {}}
        onLevel={onLevel}
      />
    ))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start listening' }),
    )
    await vi.waitFor(() => expect(queued.size).toBe(1))
    mic.level = 0.05
    tick()

    // Act
    unmount()

    // Assert
    expect(onLevel).toHaveBeenLastCalledWith(0)
  })
})
