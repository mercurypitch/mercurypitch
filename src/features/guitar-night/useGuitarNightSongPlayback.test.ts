// Song playback policy tests exercise stateful input/transport lifetimes and exclusive routes.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import type { GuitarBackingTransportStatus } from '@/features/guitar/backing/guitar-backing-transport'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { createGuitarTakeRecorder } from '@/lib/guitar/guitar-take-recorder'
import type { GuitarListeningStatus } from './useGuitarListeningController'
import { useGuitarNightSongPlayback } from './useGuitarNightSongPlayback'

const disposers: (() => void)[] = []
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()))

function harness(profile: GuitarInputProfileKind = 'interface') {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const [status, setStatus] =
      createSignal<GuitarBackingTransportStatus>('armed')
    const [inputStatus, setInputStatus] =
      createSignal<GuitarListeningStatus>('off')
    const [inputProfile, setInputProfile] = createSignal(profile)
    const [blocked, setBlocked] = createSignal(false)
    const [sourceIdentity, setSourceIdentity] = createSignal('first')
    const [take, setTake] = createSignal<GuitarTakeSnapshot | null>(null)
    const [takeover, setTakeover] = createSignal(false)
    let monitor = false
    let inputStarts = 0
    let backingStarts = 0
    const stopInput = () => {
      monitor = false
      setTakeover(false)
      setInputStatus('off')
    }
    const transport = {
      status,
      play: async () => {
        backingStarts += 1
        setStatus('playing')
        return true
      },
      pause: () => setStatus('paused'),
    }
    const controller = useGuitarNightSongPlayback({
      transport: () => transport,
      blocked,
      sourceIdentity,
      listening: {
        status: inputStatus,
        inputProfile,
        take,
        start: async () => {
          inputStarts += 1
          setInputStatus('listening')
          return true
        },
        stop: stopInput,
        useInputHere: async () => {
          setTakeover(false)
          setInputStatus('listening')
          return true
        },
        inputTakeoverPending: takeover,
        canTakeOverInput: takeover,
        calibrate: async () => {
          setInputStatus('calibrating')
          return true
        },
        selectInputProfile: async (next) => {
          stopInput()
          setInputProfile(next)
        },
        selectAudioInput: async () => {
          stopInput()
        },
        selectMidiInput: async () => {
          stopInput()
        },
      },
    })
    return {
      controller,
      status,
      setStatus,
      inputStatus,
      setInputStatus,
      setBlocked,
      setSourceIdentity,
      setTake,
      setTakeover,
      monitor: () => monitor,
      enableMonitor: () => {
        monitor = true
      },
      inputStarts: () => inputStarts,
      backingStarts: () => backingStarts,
    }
  })
}

describe('song playback policy', () => {
  it('starts backing without requesting input or enabling monitoring', async () => {
    const h = harness()
    await h.controller.play()
    expect(h.status()).toBe('playing')
    expect(h.inputStatus()).toBe('off')
    expect(h.inputStarts()).toBe(0)
    expect(h.monitor()).toBe(false)
  })

  it('keeps explicitly enabled DI and its monitor alive through Play and Pause', async () => {
    const h = harness()
    await h.controller.startListening()
    h.enableMonitor()
    await h.controller.play()
    expect(h.status()).toBe('playing')
    expect(h.inputStatus()).toBe('listening')
    expect(h.monitor()).toBe(true)
    h.controller.togglePlayback()
    expect(h.status()).toBe('paused')
    expect(h.inputStatus()).toBe('listening')
    expect(h.monitor()).toBe(true)
  })

  it('opens DI alongside a playing song but leaves monitoring off', async () => {
    const h = harness()
    await h.controller.play()
    await h.controller.startListening()
    expect(h.status()).toBe('playing')
    expect(h.inputStatus()).toBe('listening')
    expect(h.monitor()).toBe(false)
    h.controller.toggleListening()
    expect(h.inputStatus()).toBe('off')
    expect(h.status()).toBe('playing')
  })

  it.each(['microphone', 'midi'] as const)(
    'parks a pending backing start before opening %s',
    async (profile) => {
      const h = harness(profile)
      h.setStatus('loading')
      await h.controller.startListening()
      expect(h.status()).toBe('paused')
      expect(h.inputStatus()).toBe('listening')
    },
  )

  it.each(['microphone', 'midi'] as const)(
    'ends %s Listening before Play',
    async (profile) => {
      const h = harness(profile)
      await h.controller.startListening()
      await h.controller.play()
      expect(h.inputStatus()).toBe('off')
      expect(h.status()).toBe('playing')
    },
  )

  it('cancels a pending non-DI handoff before playback can start', async () => {
    const h = harness('microphone')
    h.setTakeover(true)
    await h.controller.play()
    expect(h.inputStatus()).toBe('off')
    expect(h.status()).toBe('playing')
    // A cancelled handoff cannot keep the toggle looking active.
    await h.controller.toggleListening()
    expect(h.inputStatus()).toBe('listening')
    expect(h.status()).toBe('paused')
  })

  it('parks backing when a non-DI handoff recovers while loading', async () => {
    const h = harness('microphone')
    h.setStatus('loading')
    await h.controller.useInputHere()
    expect(h.status()).toBe('paused')
    expect(h.inputStatus()).toBe('listening')
  })

  it('keeps calibration exclusive, including later transport activation', async () => {
    const h = harness('microphone')
    await h.controller.startListening()
    await h.controller.calibrate()
    expect(await h.controller.play()).toBe(false)
    h.setStatus('loading')
    expect(h.status()).toBe('paused')
    expect(h.inputStatus()).toBe('calibrating')
    expect(h.backingStarts()).toBe(0)
  })

  it('parks the backing after a live DI device is lost', async () => {
    const h = harness()
    await h.controller.startListening()
    await h.controller.play()
    h.setInputStatus('error')
    expect(h.status()).toBe('paused')
    expect(h.inputStatus()).toBe('error')
  })

  it('parks backing when the requested interface falls back to another input', async () => {
    const h = harness()
    await h.controller.play()
    h.setTake(
      createGuitarTakeRecorder({
        takeId: 'fallback',
        sampleRate: 48000,
        startedAtSeconds: 0,
        attackTimingSource: 'audio-clock',
        latency: { seconds: 0, provenance: 'none', uncertaintySeconds: null },
        input: {
          kind: 'interface',
          requestedDeviceId: 'di',
          activeDeviceId: 'builtin',
          activeDeviceLabel: 'Built-in microphone',
        },
      }).snapshot(),
    )
    await h.controller.startListening()
    expect(h.status()).toBe('paused')
    expect(h.inputStatus()).toBe('listening')
    // Play remains usable, but must end the fallback microphone capture first.
    await h.controller.play()
    expect(h.status()).toBe('playing')
    expect(h.inputStatus()).toBe('off')
  })

  it.each(['route', 'audio', 'midi'] as const)(
    'parks both lifetimes on a live %s change and does not resume monitoring',
    async (change) => {
      const h = harness()
      await h.controller.startListening()
      h.enableMonitor()
      await h.controller.play()
      if (change === 'route')
        await h.controller.selectInputProfile('microphone')
      if (change === 'audio') await h.controller.selectAudioInput('second')
      if (change === 'midi') await h.controller.selectMidiInput('second')
      expect(h.inputStatus()).toBe('off')
      expect(h.status()).toBe('paused')
      expect(h.monitor()).toBe(false)
    },
  )

  it('stops input, monitor and backing on source replacement even without unmount', async () => {
    const h = harness()
    await h.controller.startListening()
    h.enableMonitor()
    await h.controller.play()
    h.setSourceIdentity('second')
    expect(h.inputStatus()).toBe('off')
    expect(h.status()).toBe('paused')
    expect(h.monitor()).toBe(false)
  })

  it('does not reopen either path behind a tuner or suspended sheet', async () => {
    const h = harness()
    await h.controller.play()
    h.setBlocked(true)
    expect(await h.controller.play()).toBe(false)
    expect(await h.controller.startListening()).toBe(false)
    expect(await h.controller.useInputHere()).toBe(false)
    expect(h.status()).toBe('paused')
    expect(h.inputStatus()).toBe('off')
    h.setBlocked(false)
    expect(h.status()).toBe('paused')
    expect(h.inputStarts()).toBe(0)
  })

  it('releases both owned lifetimes on disposal', async () => {
    const h = harness()
    await h.controller.startListening()
    h.enableMonitor()
    await h.controller.play()
    disposers.splice(0).forEach((dispose) => dispose())
    expect(h.inputStatus()).toBe('off')
    expect(h.status()).toBe('paused')
    expect(h.monitor()).toBe(false)
  })
})
