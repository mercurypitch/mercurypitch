// ============================================================
// A capture the mic check's tests can play into
// ============================================================
//
// jsdom has no Web Audio, and the global mock hands every analyser zeros
// (docs/agent/TESTING.md 3.6), so no signal could reach an analysis through
// it. This fakes that edge honestly instead: an AudioContext whose analyser
// hands back whatever a case plays into it. The stream, its track and the
// device list a case plugs into are the shared input fakes
// (@/lib/audio-input/fake-devices.fixture).

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
