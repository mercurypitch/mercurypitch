// The spectral worker reads the spectrum of the buffer it is handed.
//
// It took frame 0 of a centre-padded STFT, which is half zeros and then the
// first half of the audio under the falling half of the window, starting at
// full height. Half the note never reached the spectrum, and the hard edge
// spread energy into every bin, so a clean held note read as "breathy" on the
// live analysis readouts.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpectralWorkerMessage, SpectralWorkerResponse, } from './spectral.worker'

const SAMPLE_RATE = 44100
const N_FFT = 2048
/** A fundamental on a bin centre, so the full window holds it in two bins. */
const F0 = (20 * SAMPLE_RATE) / N_FFT

/** One analyser buffer of a held note: a fundamental and two overtones. */
function heldNote(): Float32Array {
  const out = new Float32Array(N_FFT)
  for (let i = 0; i < N_FFT; i++) {
    const t = (2 * Math.PI * F0 * i) / SAMPLE_RATE
    out[i] = 0.5 * Math.sin(t) + 0.25 * Math.sin(2 * t) + 0.12 * Math.sin(3 * t)
  }
  return out
}

async function analyse(audio: Float32Array) {
  vi.resetModules()
  const posted: SpectralWorkerResponse[] = []
  const worker = {
    onmessage: null as
      | ((event: MessageEvent<SpectralWorkerMessage>) => void)
      | null,
    postMessage(message: SpectralWorkerResponse) {
      posted.push(message)
    },
  }
  vi.stubGlobal('self', worker)
  await import('./spectral.worker')
  worker.onmessage!({
    data: {
      type: 'ANALYZE',
      audio,
      sampleRate: SAMPLE_RATE,
      fundamentalFreq: F0,
    },
  } as MessageEvent<SpectralWorkerMessage>)
  const response = posted[0]
  if (response?.type !== 'RESULT') throw new Error('no spectral result')
  return response.result
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('spectral worker', () => {
  it('puts the whole buffer into the fundamental, not half of it', async () => {
    const result = await analyse(heldNote())

    // A sine of amplitude A on a bin centre under a Hann window peaks at
    // A * N / 4. Frame 0 saw half the samples and peaked near half that.
    expect(result.magnitudeSpectrum[20]).toBeCloseTo((0.5 * N_FFT) / 4, 0)
  })

  it('reads a clean held note as harmonic, not breathy', async () => {
    const result = await analyse(heldNote())

    // Frame 0's leakage put this note at 9.2 dB, "breathy".
    expect(result.breathiness.hnrDb).toBeGreaterThanOrEqual(30)
    expect(result.breathiness.quality).not.toBe('breathy')
  })
})
