// Guitar capture borrows an existing input and context, keeping a bounded dry side branch off the monitor path.
import RecordingWorker from '@/workers/guitar-recorder.worker.ts?worker'
import workletUrl from '@/workers/guitar-recorder.worklet.ts?worker&url'
import type { GuitarCaptureMessage, GuitarRecordedNote, GuitarRecordingChunk, GuitarRecordingSummary, GuitarRecordingWorkerMessage, } from './recording-types'
import { GUITAR_RECORDING_CHUNK_FRAMES, GUITAR_RECORDING_LIMIT_SECONDS, GUITAR_RECORDING_POOL_SIZE, } from './recording-types'

export interface GuitarRecordingInput {
  context: AudioContext
  source: AudioNode
  stream: MediaStream
  channel: number
  channelCount: number
}

interface GuitarCaptureOptions {
  id: string
  input: GuitarRecordingInput
  signal: AbortSignal
  onStart(audioFrame: number): void
  onChunk(
    chunk: GuitarRecordingChunk,
    previewNote: GuitarRecordedNote | null,
  ): Promise<void>
}

const registered = new WeakMap<AudioContext, Promise<void>>()

function createCaptureBranch(context: AudioContext, channelCount: number) {
  let splitter: ChannelSplitterNode | undefined
  let node: AudioWorkletNode | undefined
  let silence: GainNode | undefined
  try {
    splitter = context.createChannelSplitter(channelCount)
    node = new AudioWorkletNode(context, 'guitar-recorder', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    })
    silence = context.createGain()
    silence.gain.value = 0
    return { splitter, node, silence, worker: new RecordingWorker() }
  } catch (error) {
    splitter?.disconnect()
    node?.disconnect()
    node?.port.close()
    silence?.disconnect()
    throw error
  }
}

export async function startGuitarRecordingCapture(
  options: GuitarCaptureOptions,
) {
  const { context, source, channel, channelCount } = options.input
  if (
    typeof context.audioWorklet?.addModule !== 'function' ||
    typeof Worker === 'undefined'
  ) {
    throw new Error(
      'Recording needs AudioWorklet and Web Workers. Live monitoring is still available.',
    )
  }
  if (
    !Number.isInteger(channel) ||
    channel < 0 ||
    channel >= channelCount ||
    channelCount > 32
  )
    throw new Error('Choose an available input channel before recording.')
  let module = registered.get(context)
  if (module === undefined) {
    module = context.audioWorklet
      .addModule(workletUrl)
      .catch((error: unknown) => {
        registered.delete(context)
        throw error
      })
    registered.set(context, module)
  }
  await module
  options.signal.throwIfAborted()
  const { worker, splitter, node, silence } = createCaptureBranch(
    context,
    channelCount,
  )
  let disposed = false
  let stopped = false
  let started = false
  let failure: Error | null = null
  let writes: Promise<void> = Promise.resolve()
  let resolveDone!: (summary: GuitarRecordingSummary) => void
  let rejectDone!: (error: Error) => void
  const done = new Promise<GuitarRecordingSummary>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })
  // The controller attaches before start acknowledgement; avoid an unhandled
  // rejection if an asset or device fails during that first microtask.
  void done.catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    clearTimeout(timer)
    options.signal.removeEventListener('abort', abort)
    context.removeEventListener('statechange', stateChange)
    try {
      source.disconnect(splitter)
    } catch {
      /* The input owner may already have released its node. */
    }
    splitter.disconnect()
    node.disconnect()
    silence.disconnect()
    node.port.onmessage = null
    node.port.close()
    worker.terminate()
  }
  const fail = (error: Error): void => {
    if (disposed) return
    failure = error
    dispose()
    // Do not release the draft lock until the in-flight durable write settles.
    // Recovery must never race a late checkpoint from this failed capture.
    void writes.then(() => rejectDone(error))
  }
  const stop = (
    reason: string | null = null,
  ): Promise<GuitarRecordingSummary> => {
    if (stopped || disposed) return done
    stopped = true
    clearTimeout(timer)
    node.port.postMessage({ type: 'stop', reason })
    timer = setTimeout(
      () =>
        fail(
          new Error(
            'Recording stopped responding. Recover the saved draft from the room.',
          ),
        ),
      8000,
    )
    return done
  }
  const abort = (): void => {
    void stop('Recording was cancelled or the room was closed.')
  }
  const stateChange = (): void => {
    if (context.state !== 'running')
      void stop('Audio was suspended. The saved part is available to recover.')
  }
  node.port.onmessage = (event: MessageEvent<GuitarCaptureMessage>): void => {
    if (disposed) return
    const message = event.data
    if (message.type === 'started') {
      started = true
      clearTimeout(timer)
      options.onStart(message.audioStartFrame)
    } else if (message.type === 'pcm')
      worker.postMessage(message, [message.buffer])
    else {
      stopped = true
      clearTimeout(timer)
      timer = setTimeout(
        () =>
          fail(
            new Error(
              'Analysis did not finish. Recover the saved audio draft.',
            ),
          ),
        8000,
      )
      worker.postMessage(message)
    }
  }
  worker.onmessage = (
    event: MessageEvent<GuitarRecordingWorkerMessage>,
  ): void => {
    if (disposed) return
    const message = event.data
    if (message.type === 'chunk') {
      writes = writes
        .then(async () => {
          if (failure !== null) return
          await options.onChunk(message.chunk, message.previewNote ?? null)
          // A buffer is reusable only after its encoded audio/evidence are durable.
          if (!disposed)
            node.port.postMessage(
              { type: 'buffer', buffer: message.recycled },
              [message.recycled],
            )
        })
        .catch((error: unknown) => {
          failure =
            error instanceof Error
              ? error
              : new Error('The recording could not be saved.')
          void stop(failure.message)
        })
    } else if (message.type === 'finished') {
      void writes.then(() => {
        if (disposed) return
        const summary = {
          ...message.summary,
          interruption: failure?.message ?? message.summary.interruption,
        }
        dispose()
        resolveDone(summary)
      })
    } else fail(new Error(message.message))
  }
  worker.onerror = () =>
    fail(new Error('The recording worker failed. Recover the saved draft.'))
  node.onprocessorerror = () =>
    fail(new Error('Audio capture failed. Recover the saved draft.'))
  try {
    worker.postMessage({
      type: 'init',
      recordingId: options.id,
      sampleRate: context.sampleRate,
    })
    for (let index = 0; index < GUITAR_RECORDING_POOL_SIZE; index++) {
      const buffer = new ArrayBuffer(GUITAR_RECORDING_CHUNK_FRAMES * 4)
      node.port.postMessage({ type: 'buffer', buffer }, [buffer])
    }
    source.connect(splitter)
    splitter.connect(node, channel, 0)
    node.connect(silence)
    silence.connect(context.destination)
    options.signal.addEventListener('abort', abort, { once: true })
    context.addEventListener('statechange', stateChange)
    node.port.postMessage({
      type: 'start',
      maxFrames: context.sampleRate * GUITAR_RECORDING_LIMIT_SECONDS,
    })
    timer = setTimeout(() => {
      if (!started)
        fail(
          new Error(
            'No audio reached the recorder. Check the selected input and try again.',
          ),
        )
    }, 5000)
  } catch (error) {
    dispose()
    throw error
  }
  return { done, stop }
}
