// Guitar amp cabinet loads one licensed, full-length IR lazily and shares decoded kernels by sample rate.
import cabinetUrl from '@/assets/audio/guitar/cookie-monster.wav?url'

export type GuitarAmpCabinetStatus = 'idle' | 'loading' | 'ready' | 'error'
export const GUITAR_AMP_CABINET_TRIM_DB = -18
export const GUITAR_AMP_CABINET_SHA256 =
  '48b4e8dc8bde8595f8b8153128e99debd981c30b2b7a427e8bf8f3db0a84f49f'

let status: GuitarAmpCabinetStatus = 'idle'
let bytes: Promise<ArrayBuffer> | undefined
const kernels = new Map<number, Promise<AudioBuffer>>()
const listeners = new Set<(status: GuitarAmpCabinetStatus) => void>()
const processingFailures = new Set<object>()
const notifications: GuitarAmpCabinetStatus[] = []
let notifying = false

export function getGuitarAmpCabinetStatus(): GuitarAmpCabinetStatus {
  return processingFailures.size > 0 ? 'error' : status
}

function publish(next: GuitarAmpCabinetStatus): void {
  status = next
  notifications.push(getGuitarAmpCabinetStatus())
  if (notifying) return
  // A retry owner may synchronously start loading. Every other owner must
  // still receive idle, and UI observers must see idle before loading.
  notifying = true
  try {
    while (notifications.length > 0) {
      const notification = notifications.shift()!
      for (const listener of [...listeners]) listener(notification)
    }
  } finally {
    notifying = false
  }
}

/** Keep a failed live processor visible even when the cabinet bytes are valid. */
export function reportGuitarAmpProcessingFailure(
  owner: object,
  failed: boolean,
): void {
  if (failed === processingFailures.has(owner)) return
  if (failed) processingFailures.add(owner)
  else processingFailures.delete(owner)
  publish(status)
}

/** Subscribing is inert: neither audio nor network starts on a settings mount. */
export function subscribeGuitarAmpCabinetStatus(
  listener: (status: GuitarAmpCabinetStatus) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function fetchKernel(): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(cabinetUrl, { signal: controller.signal })
    if (!response.ok) throw new Error('Cabinet could not be loaded')
    const data = await response.arrayBuffer()
    if (data.byteLength !== 172_304) throw new Error('Cabinet size is invalid')
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hash = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('')
    if (hash !== GUITAR_AMP_CABINET_SHA256)
      throw new Error('Cabinet checksum is invalid')
    return data
  } finally {
    clearTimeout(timer)
  }
}

/** Called only by an owned amp after playback/monitor activation, never by UI. */
export function loadGuitarAmpCabinet(
  context: BaseAudioContext,
): Promise<AudioBuffer> {
  const cached = kernels.get(context.sampleRate)
  if (cached !== undefined) return cached
  // Share the request across tracks, but decode at the output device's rate.
  bytes ??= fetchKernel()
  const pending = bytes
    .then((data) => context.decodeAudioData(data.slice(0)))
    .then((buffer) => {
      if (
        buffer.numberOfChannels !== 1 ||
        buffer.sampleRate !== context.sampleRate ||
        Math.abs(buffer.duration - 1.19625) > 2 / context.sampleRate
      ) {
        throw new Error('Cabinet format is invalid')
      }
      publish('ready')
      return buffer
    })
    .catch((error: unknown) => {
      publish('error')
      throw error
    })
  kernels.set(context.sampleRate, pending)
  publish('loading')
  return pending
}

/** An explicit retry wakes existing amp owners; without one this stays inert. */
export function retryGuitarAmpCabinet(): void {
  if (getGuitarAmpCabinetStatus() !== 'error') return
  kernels.clear()
  bytes = undefined
  processingFailures.clear()
  publish('idle')
}
