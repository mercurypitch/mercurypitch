// ============================================================
// Studio audio client — one module worker reads and checks canonical PCM and builds waveform peaks while the Studio is open
//
// installStudioAudioWorker() routes every canonical PCM read
// (readCanonicalPcmBytes) through the worker until its uninstall runs, which
// also ends the worker. Where a worker cannot start, or the platform is
// big-endian, the same work runs on this thread as it did before.
// ============================================================

import type { StudioAudioRequest, StudioAudioResponse, } from '@/workers/studio-audio.worker'
import type { CanonicalPcmMetadata, CanonicalPcmOptions } from './canonical-pcm'
import { decodeCanonicalPcm, readCanonicalPcmBytesHere, setCanonicalPcmReader, } from './canonical-pcm'
import { checkImportCancelled } from './import-limits'
import { buildStudioPeaks, encodeStudioPeaks } from './waveform-peaks'

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

/** The worker could not run this job: do it on this thread instead. */
class StudioAudioWorkerUnavailable extends Error {}

interface Pending {
  resolve(bytes: ArrayBuffer): void
  reject(error: unknown): void
}

let worker: Worker | null = null
let broken = !LITTLE_ENDIAN || typeof Worker === 'undefined'
let installs = 0
let sequence = 0
const pending = new Map<number, Pending>()

function failAll(error: unknown): void {
  for (const job of pending.values()) job.reject(error)
  pending.clear()
}

function running(): Worker | null {
  if (broken || installs === 0) return null
  if (worker) return worker
  try {
    worker = new Worker(
      new URL('../../../workers/studio-audio.worker.ts', import.meta.url),
      { type: 'module' },
    )
  } catch {
    broken = true
    return null
  }
  worker.onmessage = (event: MessageEvent<StudioAudioResponse>) => {
    const job = pending.get(event.data.id)
    if (!job) return
    pending.delete(event.data.id)
    if (event.data.ok) job.resolve(event.data.bytes)
    else job.reject(new Error(event.data.message))
  }
  // A worker that fails to load or dies hands its jobs back to this thread.
  const fail = () => {
    broken = true
    worker?.terminate()
    worker = null
    failAll(new StudioAudioWorkerUnavailable())
  }
  worker.onerror = fail
  worker.onmessageerror = fail
  return worker
}

function run(
  kind: StudioAudioRequest['kind'],
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const target = running()
  if (!target) return Promise.reject(new StudioAudioWorkerUnavailable())
  checkImportCancelled(signal)
  const id = ++sequence
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const abort = () => {
      // The worker finishes the job; its answer finds nobody waiting.
      pending.delete(id)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    const settle =
      <T>(next: (value: T) => void) =>
      (value: T) => {
        signal?.removeEventListener('abort', abort)
        next(value)
      }
    pending.set(id, { resolve: settle(resolve), reject: settle(reject) })
    const request: StudioAudioRequest = {
      id,
      kind,
      blob,
      // A plain copy: the caller's metadata may be a store proxy.
      metadata: {
        channels: metadata.channels,
        normalizedSampleRate: metadata.normalizedSampleRate,
        normalizedFrameCount: metadata.normalizedFrameCount,
        canonicalPcmByteLength: metadata.canonicalPcmByteLength,
        canonicalPcmSha256: metadata.canonicalPcmSha256,
      },
    }
    target.postMessage(request)
  })
}

async function readOffThread(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions,
): Promise<ArrayBuffer> {
  try {
    return await run('verify', blob, metadata, options.signal)
  } catch (error) {
    if (!(error instanceof StudioAudioWorkerUnavailable)) throw error
    return readCanonicalPcmBytesHere(blob, metadata, options)
  }
}

/**
 * A take's waveform peaks, encoded for storage, built from its canonical PCM
 * after the same header, hash and sample checks a read makes.
 */
export async function buildStudioPeaksBytes(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  try {
    return await run('peaks', blob, metadata, signal)
  } catch (error) {
    if (!(error instanceof StudioAudioWorkerUnavailable)) throw error
  }
  const audio = await decodeCanonicalPcm(blob, metadata, { signal })
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index),
  )
  return encodeStudioPeaks(
    buildStudioPeaks(channels, audio.length),
    metadata.canonicalPcmSha256,
  )
}

/** Read canonical PCM in the worker while the Studio is open; the returned function stops it. */
export function installStudioAudioWorker(): () => void {
  installs++
  setCanonicalPcmReader(readOffThread)
  let installed = true
  return () => {
    if (!installed) return
    installed = false
    installs--
    if (installs > 0) return
    setCanonicalPcmReader(null)
    worker?.terminate()
    worker = null
    failAll(new DOMException('The Studio closed.', 'AbortError'))
  }
}
