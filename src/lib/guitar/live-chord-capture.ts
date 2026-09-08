// Disposable live chord side tap borrows the selected dry channel without owning monitoring or microphone access.
import type { LiveChordResult } from '../transcription/basic-pitch-live'
import type { GuitarRecordingInput } from './recording-capture'
import type { GuitarCaptureMessage } from './recording-types'
import { createGuitarPcmNode, prepareGuitarPcmWorklet, } from './recording-worklet'

export interface LiveChordSnapshot extends LiveChordResult {
  /** Absolute AudioContext time of source sample zero, not worker/UI arrival time. */
  audioStartSeconds: number
}

type LiveWorkerMessage =
  | { type: 'ready' }
  | { type: 'buffer'; buffer: ArrayBuffer }
  | { type: 'result'; result: LiveChordResult }
  | { type: 'error'; message: string }

export async function startLiveChordCapture(options: {
  input: GuitarRecordingInput
  signal: AbortSignal
  onReady(): void
  onResult(snapshot: LiveChordSnapshot): void
  onError(message: string): void
}) {
  const { input, signal } = options
  const { context, source, channel, channelCount } = input
  signal.throwIfAborted()
  if (
    !Number.isInteger(channel) ||
    channel < 0 ||
    channel >= channelCount ||
    !Number.isInteger(channelCount) ||
    channelCount > 32
  )
    throw new Error('Choose an available input channel for live chords.')
  await prepareGuitarPcmWorklet(context)
  signal.throwIfAborted()
  let splitter: ChannelSplitterNode | undefined
  let node: AudioWorkletNode | undefined
  let silence: GainNode | undefined
  let worker: Worker | undefined
  let stopped = false
  let connected = false
  let origin: number | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const dispose = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    signal.removeEventListener('abort', dispose)
    context.removeEventListener('statechange', stateChange)
    if (splitter !== undefined) {
      try {
        source.disconnect(splitter)
      } catch {
        /* The input owner may have already released its route. */
      }
      splitter.disconnect()
    }
    if (node !== undefined) {
      node.port.onmessage = null
      node.onprocessorerror = null
      node.port.close()
      node.disconnect()
    }
    silence?.disconnect()
    if (worker !== undefined) {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
  }
  const fail = (message: string) => {
    if (stopped) return
    dispose()
    options.onError(message)
  }
  const stateChange = () => {
    if (context.state !== 'running')
      fail('Audio paused. Toggle Live chords off and on to retry.')
  }
  const deadline = (ms: number, message: string) => {
    clearTimeout(timer)
    timer = setTimeout(() => fail(message), ms)
  }
  try {
    splitter = context.createChannelSplitter(channelCount)
    node = createGuitarPcmNode(context)
    silence = context.createGain()
    silence.gain.value = 0
    worker = new Worker(
      new URL('../../workers/guitar-live-chords.worker.ts', import.meta.url),
      { type: 'module' },
    )
    node.port.onmessage = ({ data }: MessageEvent<GuitarCaptureMessage>) => {
      if (stopped) return
      if (data.type === 'started')
        origin = data.audioStartFrame / context.sampleRate
      else if (data.type === 'pcm') worker!.postMessage(data, [data.buffer])
      else
        fail(
          'Live chord processing fell behind. Recording and monitoring can continue; refine after Stop.',
        )
    }
    node.onprocessorerror = () =>
      fail('Live chord capture failed. Recording and monitoring can continue.')
    worker.onerror = () =>
      fail('Live chord preview failed. Refine after Stop is still available.')
    worker.onmessage = ({ data }: MessageEvent<LiveWorkerMessage>) => {
      if (stopped) return
      try {
        if (data.type === 'ready') {
          if (connected) return
          connected = true
          for (let index = 0; index < 12; index++) {
            const buffer = new ArrayBuffer(4096 * 4)
            node!.port.postMessage({ type: 'buffer', buffer }, [buffer])
          }
          source.connect(splitter!)
          splitter!.connect(node!, channel, 0)
          node!.connect(silence!)
          silence!.connect(context.destination)
          node!.port.postMessage({
            type: 'start',
            maxFrames: Number.MAX_SAFE_INTEGER,
            stopOnClockGap: true,
          })
          deadline(
            5000,
            'No audio reached Live chords. Check Listening and the selected input.',
          )
          options.onReady()
        } else if (data.type === 'buffer') {
          node!.port.postMessage(data, [data.buffer])
        } else if (data.type === 'result' && origin !== null) {
          deadline(
            5000,
            'Live chords stopped responding. Refine after Stop is still available.',
          )
          options.onResult({ ...data.result, audioStartSeconds: origin })
        } else if (data.type === 'error') fail(data.message)
      } catch (error) {
        fail(
          error instanceof Error ? error.message : 'Live chord preview failed.',
        )
      }
    }
    signal.addEventListener('abort', dispose, { once: true })
    context.addEventListener('statechange', stateChange)
    deadline(
      45000,
      'Live chord model took too long to load. Toggle Live chords off and on to retry.',
    )
    worker.postMessage({ type: 'init', sampleRate: context.sampleRate })
  } catch (error) {
    dispose()
    throw error
  }
  return { dispose }
}
