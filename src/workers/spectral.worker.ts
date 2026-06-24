import type { WindowType } from '../lib/stft-engine'
import { stftForward } from '../lib/stft-engine'
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
      const stft = stftForward(audio, nFft, nFft, windowType ?? 'hann')

      const magnitudeSpectrum = new Float32Array(stft.nFreq)
      const phaseSpectrum = new Float32Array(stft.nFreq)
      for (let f = 0; f < stft.nFreq; f++) {
        const real = stft.data[f * 2]
        const imag = stft.data[f * 2 + 1]
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
