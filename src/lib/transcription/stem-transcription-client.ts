// ============================================================
// Stem transcription client — worker first, this thread as a fallback
// ============================================================

import type { StemTranscriptionRequest, StemTranscriptionResponse, } from '@/workers/stem-transcription.worker'
import type { StemTranscription, TranscriptionProfile, } from './stem-transcription'
import { BASS_TRANSCRIPTION_PROFILE, decodeStemForAnalysis, transcribeStemSamples, } from './stem-transcription'

export interface TranscribeStemOptions {
  profile?: TranscriptionProfile
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
}

function createTranscriptionWorker(): Worker | null {
  try {
    return new Worker(
      new URL('../../workers/stem-transcription.worker.ts', import.meta.url),
      { type: 'module' },
    )
  } catch {
    // Test environments and locked-down browsers have no module workers. The
    // analysis still runs, just on this thread with its yields.
    return null
  }
}

function runInWorker(
  worker: Worker,
  samples: Float32Array,
  sampleRate: number,
  options: TranscribeStemOptions,
): Promise<StemTranscription> {
  return new Promise<StemTranscription>((resolve, reject) => {
    const finish = (): void => {
      worker.terminate()
      options.signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = (): void => {
      finish()
      reject(new DOMException('Transcription cancelled', 'AbortError'))
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    worker.onmessage = (event: MessageEvent<StemTranscriptionResponse>) => {
      const message = event.data
      if (message.type === 'PROGRESS') {
        options.onProgress?.(message.fraction)
        return
      }
      finish()
      if (message.type === 'RESULT') resolve(message.result)
      else reject(new Error(message.error))
    }
    worker.onerror = (event) => {
      finish()
      reject(
        new Error(event.message || 'The note reader stopped unexpectedly.'),
      )
    }

    const request: StemTranscriptionRequest = {
      type: 'TRANSCRIBE',
      samples,
      sampleRate,
      profile: options.profile,
    }
    // Transfer the buffer: a five-minute stem is megabytes, and this thread
    // has no further use for it.
    worker.postMessage(request, [samples.buffer])
  })
}

/**
 * Transcribe one stem URL. Decoding happens here because it needs an
 * AudioContext; the per-frame analysis goes to a worker so the room stays
 * responsive while a long song is read.
 */
export async function transcribeStem(
  stemUrl: string,
  options: TranscribeStemOptions = {},
): Promise<StemTranscription> {
  const profile = options.profile ?? BASS_TRANSCRIPTION_PROFILE
  const { samples, sampleRate } = await decodeStemForAnalysis(
    stemUrl,
    profile,
    options.signal,
  )
  if (options.signal?.aborted === true) {
    throw new DOMException('Transcription cancelled', 'AbortError')
  }

  const worker = createTranscriptionWorker()
  if (worker === null) {
    return transcribeStemSamples(samples, sampleRate, { ...options, profile })
  }
  return runInWorker(worker, samples, sampleRate, { ...options, profile })
}
