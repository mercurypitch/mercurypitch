// Explicit post-stop chord refinement owns one disposable worker and never requests audio devices.
import type { PolyphonicNote } from './basic-pitch-decoder'
import { GUITAR_REFINEMENT_MAX_BYTES } from './guitar-refinement-audio'

export interface GuitarRefinementProgress {
  stage: 'loading' | 'decoding' | 'analysing'
  fraction: number
}
export interface GuitarRefinementResult {
  notes: PolyphonicNote[]
  duration: number
  processingMs: number
  decoderVersion: string
  modelSha256: string
}
export type GuitarRefinementMessage =
  | { type: 'progress'; progress: GuitarRefinementProgress }
  | { type: 'result'; result: GuitarRefinementResult }
  | { type: 'error'; message: string }

/** Abort terminates even a blocked WASM run/model load, and settles the pending promise. */
export function refineGuitarRecordingAudio(
  blob: Blob,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: GuitarRefinementProgress) => void
  } = {},
): Promise<GuitarRefinementResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted === true) {
      reject(new DOMException('Chord refinement cancelled.', 'AbortError'))
      return
    }
    if (blob.size > GUITAR_REFINEMENT_MAX_BYTES) {
      reject(new Error('Recording audio exceeds the 256 MiB refinement limit.'))
      return
    }
    let worker: Worker | undefined
    let settled = false
    const cleanup = () => {
      settled = true
      options.signal?.removeEventListener('abort', abort)
      if (worker !== undefined) {
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
        worker.terminate()
      }
    }
    const fail = (error: unknown) => {
      if (settled) return
      cleanup()
      reject(error)
    }
    const abort = () =>
      fail(new DOMException('Chord refinement cancelled.', 'AbortError'))
    try {
      worker = new Worker(
        new URL('../../workers/guitar-refinement.worker.ts', import.meta.url),
        { type: 'module' },
      )
      worker.onmessage = ({ data }: MessageEvent<GuitarRefinementMessage>) => {
        if (settled) return
        if (data.type === 'result') {
          cleanup()
          resolve(data.result)
        } else if (data.type === 'error') fail(new Error(data.message))
        else if (data.type === 'progress') {
          try {
            options.onProgress?.(data.progress)
          } catch (error) {
            fail(error)
          }
        }
      }
      worker.onerror = (event) => {
        event.preventDefault()
        fail(new Error(event.message || 'Chord refinement worker failed.'))
      }
      worker.onmessageerror = () =>
        fail(new Error('Chord refinement returned unreadable data.'))
      options.signal?.addEventListener('abort', abort, { once: true })
      worker.postMessage({ blob })
    } catch (error) {
      fail(error)
    }
  })
}
