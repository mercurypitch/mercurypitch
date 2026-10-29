// ============================================================
// A capture the mic check's tests can play into
// ============================================================
//
// jsdom has no Web Audio, and the global mock hands every analyser zeros
// (docs/agent/TESTING.md 3.6), so no signal could reach an analysis through
// it. This fakes that edge honestly instead: an AudioContext whose analyser
// hands back whatever a case plays into it, a stream whose track says which
// device it opened and fires the events a browser's track would, and a
// device list a case can plug into.

import type { Mock } from 'vitest'
import { vi } from 'vitest'

export interface FakeNode {
  connect: Mock
  disconnect: Mock
  gain?: { value: number }
}

export interface FakeCapture {
  context: AudioContext
  /** The buffer the analyser hands over from now on, samples in -1..1, and the byte every spectrum bin reads. */
  play: (samples: Float32Array, spectrum?: number) => void
  /** Every node made, in order: an analysis makes a source, an analyser and a sink. */
  nodes: FakeNode[]
}

export function fakeCapture(sampleRate = 48_000): FakeCapture {
  let samples: Float32Array = new Float32Array(2048)
  let spectrumByte = 0
  const nodes: FakeNode[] = []

  const node = <T extends FakeNode>(made: T): T => {
    nodes.push(made)
    return made
  }
  const edges = (): FakeNode => ({ connect: vi.fn(), disconnect: vi.fn() })

  const context = {
    sampleRate,
    state: 'running',
    destination: { kind: 'destination' },
    createMediaStreamSource: () => node(edges()),
    createAnalyser: () =>
      node({
        ...edges(),
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        minDecibels: -100,
        maxDecibels: -30,
        get frequencyBinCount(): number {
          return this.fftSize / 2
        },
        getFloatTimeDomainData: (into: Float32Array) => {
          into.fill(0)
          into.set(samples.subarray(0, into.length))
        },
        getByteFrequencyData: (into: Uint8Array) => {
          into.fill(spectrumByte)
        },
      }),
    createGain: () => node({ ...edges(), gain: { value: 1 } }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }

  return {
    context: context as unknown as AudioContext,
    play: (next, spectrum = 0) => {
      samples = next
      spectrumByte = spectrum
    },
    nodes,
  }
}

/** A sine at `hz`, one analyser buffer long. */
export function sine(
  hz: number,
  amplitude: number,
  sampleRate = 48_000,
  length = 2048,
): Float32Array {
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate)
  }
  return samples
}

export interface FakeTrackOptions {
  label?: string
  deviceId?: string
  groupId?: string
  /** On top of 48 kHz with the browser's voice processing off. */
  settings?: MediaTrackSettings
}

/** A live capture track: an EventTarget, so a case can fire `mute` and `ended`. */
export function fakeTrack(options: FakeTrackOptions = {}): MediaStreamTrack {
  const track = new EventTarget() as EventTarget & {
    label: string
    muted: boolean
    readyState: MediaStreamTrackState
    getSettings: () => MediaTrackSettings
  }
  track.label = options.label ?? ''
  track.muted = false
  track.readyState = 'live'
  track.getSettings = () => ({
    deviceId: options.deviceId,
    groupId: options.groupId,
    sampleRate: 48_000,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    ...options.settings,
  })
  return track as unknown as MediaStreamTrack
}

export function fakeStream(track: MediaStreamTrack = fakeTrack()): MediaStream {
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream
}

/** An input as `enumerateDevices()` lists it. */
export function audioInput(
  deviceId: string,
  label: string,
  groupId = deviceId,
): MediaDeviceInfo {
  return { deviceId, groupId, kind: 'audioinput', label } as MediaDeviceInfo
}

export interface FakeMediaDevices {
  /** What `enumerateDevices()` lists from now on. */
  list: (devices: MediaDeviceInfo[]) => void
  /** Fire `devicechange`, as a plug or an unplug would. */
  change: () => void
  /** Put the browser's own `navigator.mediaDevices` back. */
  restore: () => void
}

/** Puts a device list on `navigator.mediaDevices` that a case controls. */
export function fakeMediaDevices(
  initial: MediaDeviceInfo[] = [],
): FakeMediaDevices {
  let devices = initial
  const target = new EventTarget()
  const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: () => Promise.resolve(devices),
      getUserMedia: () => Promise.reject(new Error('not in this test')),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
  })
  return {
    list: (next) => {
      devices = next
    },
    change: () => {
      target.dispatchEvent(new Event('devicechange'))
    },
    restore: () => {
      if (original === undefined) {
        Reflect.deleteProperty(navigator, 'mediaDevices')
      } else {
        Object.defineProperty(navigator, 'mediaDevices', original)
      }
    },
  }
}
