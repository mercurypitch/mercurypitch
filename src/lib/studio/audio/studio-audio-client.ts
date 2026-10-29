// ============================================================
// Studio audio client — one module worker reads and checks canonical PCM, builds waveform peaks and checks a restore's audio while the Studio is open
//
// installStudioAudioWorker() routes every canonical PCM read
// (readCanonicalPcmBytes) and every check of handed-over audio bytes
// (checkPreparedStudioBytes, a restore's) through the worker until its
// uninstall runs; the worker ends once the jobs it holds are answered.
// Where a worker cannot start, or the platform is big-endian, the same work
// runs on this thread as it did before.
// ============================================================

import { StudioMemoryError } from '@/lib/studio/memory-budget'
import type { StudioAssetBytes } from '@/lib/studio/model/types'
import type { CanonicalPcmMetadata, CanonicalPcmOptions } from './canonical-pcm'
import { decodeCanonicalPcm, readCanonicalPcmBytesHere, setCanonicalPcmReader, } from './canonical-pcm'
import { checkImportCancelled } from './import-limits'
import type { StudioBytesChecker } from './prepare-studio-asset'
import { checkStudioBytesHere, setStudioBytesChecker, } from './prepare-studio-asset'
import type { StudioAudioReady, StudioAudioRequest, StudioAudioResponse, } from './studio-audio-jobs'
import { buildStudioPeaks, encodeStudioPeaks } from './waveform-peaks'

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

/** The worker could not run this job: do it on this thread instead. */
class StudioAudioWorkerUnavailable extends Error {}

interface Pending {
  resolve(bytes: readonly ArrayBuffer[]): void
  reject(error: unknown): void
}

let worker: Worker | null = null
/** Settles when the worker's code has loaded, or rejects when it cannot. */
let loaded: Promise<void> = Promise.resolve()
let broken = !LITTLE_ENDIAN || typeof Worker === 'undefined'
let installs = 0
let sequence = 0
const pending = new Map<number, Pending>()

function failAll(error: unknown): void {
  for (const job of pending.values()) job.reject(error)
  pending.clear()
}

/** End a worker nobody needs: the Studio closed and every job it holds is answered. */
function retireIfIdle(): void {
  if (installs > 0 || pending.size > 0 || !worker) return
  worker.terminate()
  worker = null
}

function running(): Worker | null {
  if (broken || installs === 0) return null
  if (worker) return worker
  let started!: { resolve(): void; reject(error: unknown): void }
  loaded = new Promise<void>((resolve, reject) => {
    started = { resolve, reject }
  })
  loaded.catch(() => undefined)
  try {
    worker = new Worker(
      new URL('../../../workers/studio-audio.worker.ts', import.meta.url),
      { type: 'module' },
    )
  } catch {
    broken = true
    started.reject(new StudioAudioWorkerUnavailable())
    return null
  }
  worker.onmessage = (
    event: MessageEvent<StudioAudioResponse | StudioAudioReady>,
  ) => {
    const answer = event.data
    if ('ready' in answer) {
      started.resolve()
      return
    }
    const job = pending.get(answer.id)
    if (!job) return
    pending.delete(answer.id)
    if (answer.ok) job.resolve(answer.bytes)
    else job.reject(new Error(answer.message))
    retireIfIdle()
  }
  // A worker that fails to load or dies hands its jobs back to this thread.
  const fail = () => {
    broken = true
    worker?.terminate()
    worker = null
    started.reject(new StudioAudioWorkerUnavailable())
    failAll(new StudioAudioWorkerUnavailable())
  }
  worker.onerror = fail
  worker.onmessageerror = fail
  return worker
}

/** A plain copy: the caller's metadata may be a store proxy. */
function plainMetadata(metadata: CanonicalPcmMetadata): CanonicalPcmMetadata {
  return {
    channels: metadata.channels,
    normalizedSampleRate: metadata.normalizedSampleRate,
    normalizedFrameCount: metadata.normalizedFrameCount,
    canonicalPcmByteLength: metadata.canonicalPcmByteLength,
    canonicalPcmSha256: metadata.canonicalPcmSha256,
  }
}

type Job =
  | { kind: 'verify' | 'peaks'; blob: Blob; metadata: CanonicalPcmMetadata }
  | {
      kind: 'bytes'
      original: ArrayBuffer
      canonical: ArrayBuffer
      sha256: string
      metadata: CanonicalPcmMetadata
    }

async function run(
  job: Job,
  signal?: AbortSignal,
): Promise<readonly ArrayBuffer[]> {
  let target = running()
  if (!target) throw new StudioAudioWorkerUnavailable()
  if (job.kind === 'bytes') {
    // Bytes sent to a worker that never loads are lost: wait until it has.
    await loaded
    if (worker !== target) target = running()
    if (!target) throw new StudioAudioWorkerUnavailable()
  }
  checkImportCancelled(signal)
  const id = ++sequence
  const sent = target
  return new Promise<readonly ArrayBuffer[]>((resolve, reject) => {
    const abort = () => {
      // The worker finishes the job; its answer finds nobody waiting.
      pending.delete(id)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
      retireIfIdle()
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
      ...job,
      id,
      metadata: plainMetadata(job.metadata),
    }
    sent.postMessage(
      request,
      job.kind === 'bytes' ? [job.original, job.canonical] : [],
    )
  })
}

async function readOffThread(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions,
): Promise<ArrayBuffer> {
  try {
    const [bytes] = await run(
      { kind: 'verify', blob, metadata },
      options.signal,
    )
    return bytes
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
    const [bytes] = await run({ kind: 'peaks', blob, metadata }, signal)
    return bytes
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

/** Whether these bytes went to a worker that died before handing them back. */
function lost(data: StudioAssetBytes): boolean {
  return (
    data.original.byteLength !== data.asset.byteLength ||
    data.canonicalPcm.byteLength !== data.asset.canonicalPcmByteLength
  )
}

/**
 * Both hashes and the samples of a restore's bytes, in the worker. The
 * bytes travel there and back without a copy; a worker that never loaded
 * leaves them where they are and the check runs here instead.
 */
const checkBytesOffThread: StudioBytesChecker = async (data, options) => {
  try {
    const [original, canonicalPcm] = await run(
      {
        kind: 'bytes',
        original: data.original,
        canonical: data.canonicalPcm,
        sha256: data.asset.sha256,
        metadata: data.asset,
      },
      options.signal,
    )
    return { ...data, original, canonicalPcm } satisfies StudioAssetBytes
  } catch (error) {
    if (!(error instanceof StudioAudioWorkerUnavailable)) throw error
    // A worker that dies holding the bytes most likely ran out of memory.
    if (lost(data))
      throw new StudioMemoryError(
        'Studio needs more memory to check this audio. Stop playback and try again.',
      )
    await checkStudioBytesHere(data, options)
    return data
  }
}

/** Read and check audio in the worker while the Studio is open; the returned function stops it. */
export function installStudioAudioWorker(): () => void {
  installs++
  setCanonicalPcmReader(readOffThread)
  setStudioBytesChecker(checkBytesOffThread)
  let installed = true
  return () => {
    if (!installed) return
    installed = false
    installs--
    if (installs > 0) return
    setCanonicalPcmReader(null)
    setStudioBytesChecker(null)
    retireIfIdle()
  }
}
