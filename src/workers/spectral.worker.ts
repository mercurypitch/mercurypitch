import type { WindowType } from '../lib/stft-engine'
import { frameSpectrum } from '../lib/stft-engine'
import type { BreathinessResult, HarmonicRichnessResult, ResonanceResult, } from '../lib/vocal-analyzer'
import { computeHarmonicRichness, computeHNR, detectResonance, } from '../lib/vocal-analyzer'

export interface SpectralAnalysisResult {
  breathiness: BreathinessResult
  richness: HarmonicRichnessResult
  resonance: ResonanceResult
  magnitudeSpectrum: Float32Array
  /** Phase angles per bin (-π to π). Only populated when requested. */
  phaseSpectrum?: Float32Array
}

export type SpectralWorkerMessage =
  | {
      type: 'ANALYZE'
      audio: Float32Array
      sampleRate: number
      fundamentalFreq: number
      windowType?: WindowType
    }
  | { type: 'DESTROY' }

export type SpectralWorkerResponse =
  | {
      type: 'RESULT'
      result: SpectralAnalysisResult
    }
  | {
      type: 'ERROR'
      error: string
    }

self.onmessage = (event: MessageEvent<SpectralWorkerMessage>) => {
  if (event.data.type === 'ANALYZE') {
    try {
      const { audio, sampleRate, fundamentalFreq, windowType } = event.data
      const nFft = 2048
      // The buffer's own spectrum. This read frame 0 of a centre-padded STFT:
      // half zeros, then the first half of the audio under the falling half
      // of the window, starting at full height. That edge spread energy into
      // every bin, and a clean held note read as breathy.
      const spectrum = frameSpectrum(audio, nFft, windowType ?? 'hann')
      const nFreq = spectrum.length / 2

      const magnitudeSpectrum = new Float32Array(nFreq)
      const phaseSpectrum = new Float32Array(nFreq)
      for (let f = 0; f < nFreq; f++) {
        const real = spectrum[f * 2]
        const imag = spectrum[f * 2 + 1]
        magnitudeSpectrum[f] = Math.sqrt(real * real + imag * imag)
        phaseSpectrum[f] = Math.atan2(imag, real)
      }

      const result: SpectralAnalysisResult = {
        breathiness: computeHNR(
          magnitudeSpectrum,
          sampleRate,
          fundamentalFreq,
          nFft,
        ),
        richness: computeHarmonicRichness(
          magnitudeSpectrum,
          sampleRate,
          fundamentalFreq,
          nFft,
        ),
        resonance: detectResonance(magnitudeSpectrum, sampleRate, nFft),
        magnitudeSpectrum,
        phaseSpectrum,
      }

      // Transfer both buffers to avoid cloning overhead
      self.postMessage(
        { type: 'RESULT', result },
        { transfer: [magnitudeSpectrum.buffer, phaseSpectrum.buffer] },
      )
    } catch (e: unknown) {
      self.postMessage({
        type: 'ERROR',
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
}
