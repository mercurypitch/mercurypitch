// A room that is struggling has to be able to say so.
// ============================================================
//
// `recordAnimationFrame` is what lets a device that only looks capable get
// demoted mid-session, and the low tier is what unlocks performance-mode.css.
// Guitar Night fed it from nowhere: not the transport clock, not the 3D render
// loop. So a room that was visibly stuttering on a phone could never demote
// itself, and the stylesheet written for exactly that case never applied.
//
// The transport clock is the room's only continuous animation frame while a
// song plays, which makes it the one honest place to sample from — a loop that
// runs sporadically would report its own idle gaps as missed frames.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarBackingTransport } from './guitar-backing-transport'

const tier = vi.hoisted(() => ({ recordAnimationFrame: vi.fn() }))

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, recordAnimationFrame: tier.recordAnimationFrame }
})

vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
}))

const { useGuitarBackingTransportController } =
  await import('./useGuitarBackingTransportController')

function fakeTransport(): {
  transport: GuitarBackingTransport
  emit: () => void
  setStatus: (next: 'idle' | 'playing') => void
} {
  let status: 'idle' | 'playing' = 'idle'
  const listeners = new Set<() => void>()
  const transport = {
    configure: vi.fn(),
    activate: vi.fn(async () => true),
    play: vi.fn(async () => true),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setLoopRange: vi.fn(() => true),
    setPlaybackRate: vi.fn(async () => true),
    setMasterVolume: vi.fn(),
    setElectricAmpParameters: vi.fn(),
    setTrackMuted: vi.fn(),
    setTrackLevelDb: vi.fn(),
    toggleTrackSolo: vi.fn(),
    resetTrackLevels: vi.fn(),
    getAudioContext: () => null,
    getAudioGraph: () => null,
    getLoadMode: () => null,
    getLoopRange: () => null,
    getLoopMode: () => null,
    getLoopError: () => null,
    getLoadProgress: () => null,
    getStatus: () => status,
    getCurrentTime: () => 0,
    getDuration: () => 60,
    getPlaybackRate: () => 1,
    getMasterVolume: () => 1,
    getTrackStates: () => [],
    getSoloedTrackId: () => null,
    getError: () => null,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: vi.fn(async () => undefined),
  } as unknown as GuitarBackingTransport

  return {
    transport,
    emit: () => {
      for (const listener of listeners) listener()
    },
    setStatus: (next) => {
      status = next
    },
  }
}

describe('the backing clock feeds the frame-health sampler', () => {
  let queued: FrameRequestCallback[]

  beforeEach(() => {
    queued = []
    tier.recordAnimationFrame.mockClear()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queued.push(callback)
      return queued.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports every frame it runs, with that frame timestamp', () => {
    const fake = fakeTransport()
    createRoot(() => {
      useGuitarBackingTransportController({
        createTransport: () => fake.transport,
      })
      fake.setStatus('playing')
      fake.emit()

      expect(queued).toHaveLength(1)
      queued.shift()?.(16)
      expect(tier.recordAnimationFrame).toHaveBeenCalledWith(16)

      expect(queued).toHaveLength(1)
      queued.shift()?.(33)
      expect(tier.recordAnimationFrame).toHaveBeenCalledWith(33)
      expect(tier.recordAnimationFrame).toHaveBeenCalledTimes(2)
    })
  })

  it('stops reporting when the song does', () => {
    const fake = fakeTransport()
    createRoot(() => {
      useGuitarBackingTransportController({
        createTransport: () => fake.transport,
      })
      fake.setStatus('playing')
      fake.emit()
      queued.shift()?.(16)

      fake.setStatus('idle')
      queued.shift()?.(33)

      // The loop ends, so nothing keeps sampling an idle room — a paused tab
      // would otherwise report its own gaps as missed frames.
      expect(queued).toHaveLength(0)
      expect(tier.recordAnimationFrame).toHaveBeenCalledTimes(2)
    })
  })

  it('forwards amp edits without activating the transport', () => {
    const fake = fakeTransport()
    createRoot((dispose) => {
      const controller = useGuitarBackingTransportController({
        createTransport: () => fake.transport,
      })
      const parameters = {
        ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
        drive: 0.72,
      }

      controller.setElectricAmpParameters(parameters)

      expect(fake.transport.setElectricAmpParameters).toHaveBeenCalledWith(
        parameters,
      )
      expect(fake.transport.activate).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('forwards mixer edits and Solo state without starting or seeking playback', () => {
    const fake = fakeTransport()
    let solo: string | null = null
    fake.transport.getSoloedTrackId = () => solo
    fake.transport.toggleTrackSolo = vi.fn((id) => {
      solo = solo === id ? null : id
    })
    createRoot((dispose) => {
      const controller = useGuitarBackingTransportController({
        createTransport: () => fake.transport,
      })
      controller.setTrackLevelDb('drums', 4)
      controller.toggleTrackSolo('drums')
      expect(controller.soloedTrackId()).toBe('drums')
      controller.setTrackMuted('guitar', true)
      controller.resetTrackLevels()
      expect(fake.transport.setTrackLevelDb).toHaveBeenCalledWith('drums', 4)
      expect(fake.transport.setTrackMuted).toHaveBeenCalledWith('guitar', true)
      expect(fake.transport.resetTrackLevels).toHaveBeenCalledOnce()
      expect(fake.transport.activate).not.toHaveBeenCalled()
      expect(fake.transport.play).not.toHaveBeenCalled()
      expect(fake.transport.seek).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('forwards loop marks and exposes transport acceptance, mode and errors without a UI seek loop', () => {
    const fake = fakeTransport()
    let range: { start: number; end: number } | null = null
    let error: string | null = null
    fake.transport.getLoopRange = () => range
    fake.transport.getLoopMode = () => 'buffered'
    fake.transport.getLoopError = () => error
    fake.transport.setLoopRange = vi.fn((next) => {
      range = next
      return true
    })
    createRoot((dispose) => {
      const controller = useGuitarBackingTransportController({
        createTransport: () => fake.transport,
      })
      expect(controller.setLoopRange({ start: 1, end: 3 })).toBe(true)
      expect(controller.loopRange()).toEqual({ start: 1, end: 3 })
      expect(controller.loopMode()).toBe('buffered')
      range = null
      error = 'Loop memory budget exceeded'
      fake.emit()
      expect(controller.loopRange()).toBeNull()
      expect(controller.loopError()).toBe(error)
      expect(fake.transport.seek).not.toHaveBeenCalled()
      expect(fake.transport.play).not.toHaveBeenCalled()
      expect(fake.transport.activate).not.toHaveBeenCalled()
      dispose()
    })
  })
})
