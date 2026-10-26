// Studio async measurement — admitted worker state with one transferred PCM chunk at a time.
import { reserveStudioMemory } from '../memory-budget'
import { createMeterWorkerClient } from './meter-worker-client'
import type { StudioLoudnessMeasurement, StudioMeterOptions, } from './stream-meter'
import { createStudioMeter, studioMeterWorkingBytes } from './stream-meter'

export interface StudioPcmReader {
  sampleRate: number
  channels: 1 | 2
  frames: number
  /** Return newly owned channel arrays; the browser worker transfers/detaches them. */
  read(from: number, to: number): Float32Array[]
}
export interface StudioMeasureOptions {
  signal?: AbortSignal
  dualMono?: boolean
  truePeak?: boolean
  createWorker?: (() => Worker) | null
}
const CHUNK_FRAMES = 4096

function defaultWorker(): Worker | undefined {
  if (typeof Worker === 'undefined') return undefined
  return new Worker(new URL('./meter.worker.ts', import.meta.url), {
    type: 'module',
  })
}

export async function measureStudioPcm(
  reader: StudioPcmReader,
  options: StudioMeasureOptions = {},
): Promise<StudioLoudnessMeasurement> {
  const signal = options.signal ?? new AbortController().signal
  signal.throwIfAborted()
  const configuration: StudioMeterOptions = {
    sampleRate: reader.sampleRate,
    channels: reader.channels,
    maxFrames: reader.frames,
    dualMono: options.dualMono,
    truePeak: options.truePeak ?? true,
  }
  const release = reserveStudioMemory(
    studioMeterWorkingBytes(configuration) +
      CHUNK_FRAMES * reader.channels * 4 * 2,
  )
  let worker: Worker | undefined
  try {
    const factory =
      options.createWorker === undefined ? defaultWorker : options.createWorker
    worker = factory?.()
    const call =
      worker === undefined ? undefined : createMeterWorkerClient(worker, signal)
    const fallback =
      worker === undefined ? createStudioMeter(configuration) : undefined
    if (worker) await call!({ kind: 'start', options: configuration })
    for (let from = 0; from < reader.frames; from += CHUNK_FRAMES) {
      signal.throwIfAborted()
      const channels = reader.read(
        from,
        Math.min(reader.frames, from + CHUNK_FRAMES),
      )
      if (worker)
        await call!(
          { kind: 'push', channels },
          channels.map((channel) => channel.buffer as ArrayBuffer),
        )
      else {
        fallback!.push(channels)
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
    signal.throwIfAborted()
    if (fallback) return fallback.finish()
    const result = await call!({ kind: 'finish' })
    if (!result.measurement)
      throw new Error('Audio measurement did not return a result.')
    return result.measurement
  } finally {
    worker?.terminate()
    release()
  }
}

export function audioBufferReader(buffer: AudioBuffer): StudioPcmReader {
  if (buffer.numberOfChannels !== 1 && buffer.numberOfChannels !== 2)
    throw new Error('Studio exports mono or stereo audio.')
  return {
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    frames: buffer.length,
    read: (from, to) =>
      Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
        buffer.getChannelData(channel).slice(from, to),
      ),
  }
}
