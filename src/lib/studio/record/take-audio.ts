// ============================================================
// Studio take audio — a take's captured chunks, the 16-bit audio its journal and its file keep, and the peaks its live waveform draws
// ============================================================
//
// A finished take is kept the way an imported file is: a WAV goes through
// the Studio's own import (prepareStudioAsset), which decodes it at 48 kHz,
// measures it and writes its canonical PCM. So a take captured on a clock
// that is not 48 kHz is resampled by that decode, and the rest of the
// Studio never knows a take was recorded rather than picked.
//
// The WAV is 16-bit, the most widely read form, and the journal that keeps a
// take through a closed tab (studio-take-journal.ts) holds those same 16-bit
// values, so a take kept from the journal is the same file the take would
// have become.
import { encodeMonoPcmSamplesToWav } from '@/lib/audio-buffer-wav'

/** One stretch of a take, its samples a view of exactly its frames. */
export interface StudioTakeChunk {
  /** Its first frame, counted from the take's start. */
  readonly firstFrame: number
  readonly samples: Float32Array
}

/** A take's chunks as they arrive, and the one signal they make. */
export function createStudioTakeBuffer() {
  const chunks: StudioTakeChunk[] = []
  let frames = 0
  return {
    /** Keep `frames` samples of `buffer`, the pooled buffer handed over. */
    append(
      firstFrame: number,
      count: number,
      buffer: ArrayBuffer,
    ): StudioTakeChunk {
      const chunk = {
        firstFrame,
        samples: new Float32Array(buffer, 0, count),
      }
      chunks.push(chunk)
      frames = Math.max(frames, firstFrame + count)
      return chunk
    },
    get frames(): number {
      return frames
    },
    /** Every chunk in its place; a stretch no chunk covers stays silent. */
    assemble(): Float32Array {
      const out = new Float32Array(frames)
      for (const chunk of chunks) out.set(chunk.samples, chunk.firstFrame)
      return out
    },
    clear(): void {
      chunks.length = 0
      frames = 0
    },
  }
}

export type StudioTakeBuffer = ReturnType<typeof createStudioTakeBuffer>

/** The 16-bit values a WAV keeps for these samples (audio-buffer-wav.ts). */
export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, Number(samples[i]) || 0))
    out[i] = value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff)
  }
  return out
}

/** Samples that write back to exactly these 16-bit values. */
export function pcm16ToFloat(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++)
    out[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff
  return out
}

/** A take's file name: what its clip shows once kept, and while it records. */
export function studioTakeFileName(title: string): string {
  return `${title}.wav`
}

/** The file a take is kept as: mono 16-bit WAV at the rate it was captured. */
export function studioTakeWav(samples: Float32Array, sampleRate: number): Blob {
  return new Blob([encodeMonoPcmSamplesToWav(samples, sampleRate)], {
    type: 'audio/wav',
  })
}

/** A live waveform's resolution: one peak every 10 ms. */
export const STUDIO_LIVE_PEAKS_PER_SECOND = 100

/**
 * The loudest sample and the loudness (RMS) of every 10 ms of a take as it
 * records, for the waveform that grows in its lane: drawn as the saved
 * clip's waveform is, a pale band to the peaks around a solid body, so the
 * take keeps its shape when it lands. Fixed-size for the longest take, so
 * nothing grows while the take runs.
 */
export function createStudioLivePeaks(sampleRate: number, maxFrames: number) {
  const bucket = Math.max(
    1,
    Math.round(sampleRate / STUDIO_LIVE_PEAKS_PER_SECOND),
  )
  const peaks = new Float32Array(Math.ceil(maxFrames / bucket) + 1)
  const rms = new Float32Array(peaks.length)
  let count = 0
  let loudest = 0
  let squares = 0
  let filled = 0
  return {
    /** Frames of the take each peak covers. */
    bucketFrames: bucket,
    peaks,
    rms,
    get count(): number {
      return count
    },
    push(samples: Float32Array): void {
      for (let i = 0; i < samples.length; i++) {
        const value = Math.abs(samples[i])
        if (value > loudest) loudest = value
        squares += value * value
        if (++filled < bucket) continue
        if (count < peaks.length) {
          peaks[count] = loudest
          rms[count++] = Math.sqrt(squares / bucket)
        }
        loudest = 0
        squares = 0
        filled = 0
      }
    },
  }
}

export type StudioLivePeaks = ReturnType<typeof createStudioLivePeaks>
