// Guitar capture borrows an existing input and context, keeping a bounded dry side branch off the monitor path.
import RecordingWorker from '@/workers/guitar-recorder.worker.ts?worker'
import type { GuitarCaptureMessage, GuitarRecordedNote, GuitarRecordingChunk, GuitarRecordingPreview, GuitarRecordingSummary, GuitarRecordingWorkerMessage, } from './recording-types'
import { GUITAR_RECORDING_LIMIT_SECONDS, GUITAR_RECORDING_MAX_BUFFERED_SECONDS, GUITAR_RECORDING_PCM_FRAMES, GUITAR_RECORDING_POOL_LOW_WATER, GUITAR_RECORDING_POOL_SIZE, } from './recording-types'
import { createGuitarPcmNode, prepareGuitarPcmWorklet, } from './recording-worklet'

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
  /** Synchronous bounded evidence deltas; never wait for storage or render here. */
  onPreview?(preview: GuitarRecordingPreview): void
  onChunk(
    chunk: GuitarRecordingChunk,
    previewNote: GuitarRecordedNote | null,
  ): Promise<void>
}

function createCaptureBranch(context: AudioContext, channelCount: number) {
  let splitter: ChannelSplitterNode | undefined
  let node: AudioWorkletNode | undefined
  let silence: GainNode | undefined
  try {
    splitter = context.createChannelSplitter(channelCount)
    node = createGuitarPcmNode(context)
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
  await prepareGuitarPcmWorklet(context)
  options.signal.throwIfAborted()
  const { worker, splitter, node, silence } = createCaptureBranch(
    context,
    channelCount,
  )
  let disposed = false
  let stopped = false
  let started = false
  let failure: Error | null = null
  let previewFailure: Error | null = null
  let previewSequence = -1
  let previewFrames = 0
  let previewEnded = false
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
  // ── Capture headroom ──────────────────────────────────────────
  //
  // A buffer only returns to the worklet once its chunk is durable, so the
  // pool doubles as the budget for how long storage may stall. Fixed at 32
  // buffers that budget was ~1.4 s at 48 kHz, and a stalled database ended
  // takes after a note or two (2026-09-09, a multi-tab schema deadlock).
  //
  // So the pool grows under pressure. It grows HERE, on the main thread:
  // allocating on the render thread is what causes dropouts, which is the
  // one failure worse than the one being fixed.
  const maxBuffers = Math.max(
    GUITAR_RECORDING_POOL_SIZE,
    Math.ceil(
      (GUITAR_RECORDING_MAX_BUFFERED_SECONDS * context.sampleRate) /
        GUITAR_RECORDING_PCM_FRAMES,
    ),
  )
  let allocated = 0
  let outstanding = 0
  let grew = false
  const sendBuffer = (buffer: ArrayBuffer): void => {
    node.port.postMessage({ type: 'buffer', buffer }, [buffer])
  }
  /** Top the worklet back up when it is running short and we may still grow. */
  const growPoolIfNeeded = (): void => {
    if (disposed || stopped) return
    const spare = allocated - outstanding
    if (spare > GUITAR_RECORDING_POOL_LOW_WATER) return
    const room = maxBuffers - allocated
    if (room <= 0) return
    const want = Math.min(GUITAR_RECORDING_POOL_SIZE - spare, room)
    if (want <= 0) return
    if (!grew) {
      grew = true
      console.warn(
        `[guitar] recording storage is not keeping up; holding audio in memory (up to ${GUITAR_RECORDING_MAX_BUFFERED_SECONDS}s)`,
      )
    }
    for (let index = 0; index < want; index++) {
      allocated++
      sendBuffer(new ArrayBuffer(GUITAR_RECORDING_PCM_FRAMES * 4))
    }
  }
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
    node.onprocessorerror = null
    node.port.close()
    worker.onmessage = null
    worker.onerror = null
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
      // A start acknowledgement may already be queued when Stop is pressed.
      // It must not retire the newer deadline guarding the stop response.
      if (!stopped) clearTimeout(timer)
      options.onStart(message.audioStartFrame)
    } else if (message.type === 'pcm') {
      outstanding++
      worker.postMessage(message, [message.buffer])
      growPoolIfNeeded()
    } else {
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
    if (message.type === 'preview') {
      const preview = message.preview
      if (
        previewEnded ||
        failure !== null ||
        preview.sequence <= previewSequence ||
        preview.frames < previewFrames
      )
        return
      previewSequence = preview.sequence
      previewFrames = preview.frames
      previewEnded = preview.ended
      try {
        options.onPreview?.(preview)
      } catch {
        // A view failure must not discard the PCM already queued for saving.
        previewEnded = true
        previewFailure = new Error(
          'Live note preview failed. The captured audio is being saved.',
        )
        void stop(previewFailure.message)
      }
    } else if (message.type === 'chunk') {
      writes = writes
        .then(async () => {
          if (failure !== null) return
          await options.onChunk(message.chunk, message.previewNote ?? null)
          // A buffer is reusable only after its encoded audio/evidence are
          // durable, which is what ties capture to write latency at all. The
          // pool absorbs that (see growPoolIfNeeded); returning these is what
          // lets it shrink back to a steady state once storage recovers.
          for (const buffer of message.recycled) {
            outstanding--
            if (!disposed) sendBuffer(buffer)
          }
        })
        .catch((error: unknown) => {
          failure =
            error instanceof Error
              ? error
              : new Error('The recording could not be saved.')
          void stop(failure.message)
        })
    } else if (message.type === 'finished') {
      previewEnded = true
      clearTimeout(timer)
      void writes.then(() => {
        if (disposed) return
        const summary = {
          ...message.summary,
          interruption:
            failure?.message ??
            previewFailure?.message ??
            message.summary.interruption,
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
      allocated++
      sendBuffer(new ArrayBuffer(GUITAR_RECORDING_PCM_FRAMES * 4))
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
