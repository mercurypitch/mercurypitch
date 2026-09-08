// Capture boundary tests fake browser ports, not the recorder's ownership or durable-write ordering.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startGuitarRecordingCapture } from './recording-capture'
import type { GuitarCaptureMessage, GuitarRecordingChunk, GuitarRecordingSummary, GuitarRecordingWorkerMessage, } from './recording-types'
import { GUITAR_RECORDING_LIMIT_SECONDS, GUITAR_RECORDING_PCM_FRAMES, GUITAR_RECORDING_POOL_SIZE, } from './recording-types'

const edge = vi.hoisted(() => ({ worker: vi.fn() }))
vi.mock('@/workers/guitar-recorder.worker.ts?worker', () => ({
  default: vi.fn(function RecordingWorker() {
    return edge.worker()
  }),
}))
vi.mock('@/workers/guitar-recorder.worklet.ts?worker&url', () => ({
  default: 'recorder-worklet.js',
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const summary: GuitarRecordingSummary = {
  frames: 128,
  notes: [],
  clockAnomalies: 0,
  interruption: null,
}

function chunk(sequence = 0): GuitarRecordingChunk {
  return {
    id: `take:${sequence}`,
    recordingId: 'take',
    kind: 'audio',
    createdAt: '',
    updatedAt: '',
    sequence,
    firstFrame: sequence * 128,
    frames: 128,
    pcm: new ArrayBuffer(256),
    pitches: [],
    attacks: [],
    notes: [],
    peak: 0.2,
  }
}
class GraphNode {
  connect = vi.fn()
  disconnect = vi.fn()
}
class CaptureNode extends GraphNode {
  port = {
    postMessage: vi.fn(),
    close: vi.fn(),
    onmessage: null as
      | ((event: MessageEvent<GuitarCaptureMessage>) => void)
      | null,
  }
  onprocessorerror: (() => void) | null = null
  send(data: GuitarCaptureMessage) {
    this.port.onmessage?.({ data } as MessageEvent<GuitarCaptureMessage>)
  }
}
class AnalysisWorker {
  postMessage = vi.fn()
  terminate = vi.fn()
  onerror: (() => void) | null = null
  onmessage:
    | ((event: MessageEvent<GuitarRecordingWorkerMessage>) => void)
    | null = null
  send(data: GuitarRecordingWorkerMessage) {
    this.onmessage?.({ data } as MessageEvent<GuitarRecordingWorkerMessage>)
  }
}

function harness() {
  const source = new GraphNode()
  const splitter = new GraphNode()
  const silence = Object.assign(new GraphNode(), { gain: { value: 1 } })
  const node = new CaptureNode()
  const worker = new AnalysisWorker()
  const abort = new AbortController()
  const trackStop = vi.fn()
  const context = Object.assign(new EventTarget(), {
    sampleRate: 48000,
    state: 'running',
    destination: new GraphNode(),
    audioWorklet: { addModule: vi.fn(async (): Promise<void> => undefined) },
    createChannelSplitter: vi.fn(() => splitter),
    createGain: vi.fn(() => silence),
    close: vi.fn(),
  })
  const removeStateListener = vi.spyOn(context, 'removeEventListener')
  const removeAbortListener = vi.spyOn(abort.signal, 'removeEventListener')
  vi.stubGlobal(
    'AudioWorkletNode',
    vi.fn(function () {
      return node
    }),
  )
  edge.worker.mockReturnValue(worker)
  const onChunk = vi.fn(
    async (_chunk: GuitarRecordingChunk): Promise<void> => undefined,
  )
  const options = {
    id: 'take',
    signal: abort.signal,
    input: {
      context: context as unknown as AudioContext,
      source: source as unknown as AudioNode,
      stream: {
        getTracks: () => [{ stop: trackStop }],
      } as unknown as MediaStream,
      channel: 1,
      channelCount: 2,
    },
    onStart: vi.fn(),
    onPreview: vi.fn(),
    onChunk,
  }
  const finish = () => worker.send({ type: 'finished', summary })
  return {
    context,
    source,
    splitter,
    silence,
    node,
    worker,
    abort,
    trackStop,
    options,
    onChunk,
    finish,
    removeStateListener,
    removeAbortListener,
  }
}

function expectReleased(h: ReturnType<typeof harness>) {
  expect(h.source.disconnect).toHaveBeenCalledExactlyOnceWith(h.splitter)
  expect(h.splitter.disconnect).toHaveBeenCalledTimes(1)
  expect(h.node.disconnect).toHaveBeenCalledTimes(1)
  expect(h.silence.disconnect).toHaveBeenCalledTimes(1)
  expect(h.node.port.close).toHaveBeenCalledTimes(1)
  expect(h.worker.terminate).toHaveBeenCalledTimes(1)
  expect(h.trackStop).not.toHaveBeenCalled()
  expect(h.context.close).not.toHaveBeenCalled()
  expect(h.removeStateListener).toHaveBeenCalledExactlyOnceWith(
    'statechange',
    expect.any(Function),
  )
  expect(h.removeAbortListener).toHaveBeenCalledExactlyOnceWith(
    'abort',
    expect.any(Function),
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  edge.worker.mockReset()
  vi.stubGlobal('Worker', AnalysisWorker)
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('borrowed guitar capture boundary', () => {
  it('publishes ordered ephemeral evidence before slow durable writes and retires it on finish', async () => {
    const h = harness()
    const write = deferred()
    h.onChunk.mockImplementationOnce(() => write.promise)
    const capture = await startGuitarRecordingCapture(h.options)
    const first = {
      sequence: 0,
      frames: 2048,
      notes: [],
      pendingNote: null,
      pitch: null,
      ended: false,
    }
    h.worker.send({ type: 'preview', preview: first })
    h.worker.send({ type: 'chunk', chunk: chunk(), recycled: [] })
    h.worker.send({
      type: 'preview',
      preview: { ...first, sequence: 8, frames: 1024 },
    })
    const final = { ...first, sequence: 1, frames: 4096, ended: true }
    h.worker.send({ type: 'preview', preview: final })
    h.worker.send({ type: 'preview', preview: first })
    h.worker.send({ type: 'preview', preview: { ...final, sequence: 2 } })
    expect(h.options.onPreview.mock.calls).toEqual([[first], [final]])
    h.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.worker.terminate).not.toHaveBeenCalled()
    write.resolve()
    await capture.done
    h.worker.send({ type: 'preview', preview: { ...first, sequence: 3 } })
    expect(h.options.onPreview).toHaveBeenCalledTimes(2)
  })

  it('saves queued audio even if the preview consumer throws, with an explicit stop reason', async () => {
    const h = harness()
    h.options.onPreview.mockImplementation(() => {
      throw new Error('view failed')
    })
    const capture = await startGuitarRecordingCapture(h.options)
    const first = chunk()
    h.worker.send({
      type: 'preview',
      preview: {
        sequence: 0,
        frames: 128,
        notes: [],
        pendingNote: null,
        pitch: null,
        ended: false,
      },
    })
    const buffers = [new ArrayBuffer(512), new ArrayBuffer(512)]
    h.worker.send({ type: 'chunk', chunk: first, recycled: buffers })
    h.worker.send({
      type: 'preview',
      preview: {
        sequence: 1,
        frames: 128,
        notes: [],
        pendingNote: null,
        pitch: null,
        ended: true,
      },
    })
    h.finish()
    await expect(capture.done).resolves.toMatchObject({
      interruption:
        'Live note preview failed. The captured audio is being saved.',
    })
    expect(h.onChunk).toHaveBeenCalledExactlyOnceWith(first, null)
    expect(h.options.onPreview).toHaveBeenCalledOnce()
    expect(h.node.port.postMessage).toHaveBeenCalledWith({
      type: 'stop',
      reason: 'Live note preview failed. The captured audio is being saved.',
    })
    for (const buffer of buffers)
      expect(h.node.port.postMessage).toHaveBeenCalledWith(
        { type: 'buffer', buffer },
        [buffer],
      )
    expectReleased(h)
  })

  it('waits for slow storage after analysis has finished without misreporting a worker timeout', async () => {
    const h = harness()
    const write = deferred()
    h.onChunk.mockImplementationOnce(() => write.promise)
    const capture = await startGuitarRecordingCapture(h.options)
    h.node.send({ type: 'started', audioStartFrame: 100 })
    h.node.send({
      type: 'stopped',
      frames: 128,
      clockAnomalies: 0,
      reason: null,
    })
    h.worker.send({
      type: 'chunk',
      chunk: chunk(),
      recycled: [new ArrayBuffer(512)],
    })
    h.finish()
    await vi.advanceTimersByTimeAsync(10000)
    expect(h.worker.terminate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    write.resolve()
    await expect(capture.done).resolves.toEqual(summary)
  })

  it('isolates the selected channel, bounds its buffer pool and never owns the input or output', async () => {
    const h = harness()
    const capture = await startGuitarRecordingCapture(h.options)
    expect(h.context.audioWorklet.addModule).toHaveBeenCalledWith(
      'recorder-worklet.js',
    )
    expect(h.source.connect).toHaveBeenCalledWith(h.splitter)
    expect(h.splitter.connect).toHaveBeenCalledWith(h.node, 1, 0)
    expect(h.node.connect).toHaveBeenCalledWith(h.silence)
    expect(h.silence.connect).toHaveBeenCalledWith(h.context.destination)
    expect(h.silence.gain.value).toBe(0)
    const buffers = h.node.port.postMessage.mock.calls.filter(
      ([message]) => message.type === 'buffer',
    )
    expect(buffers).toHaveLength(GUITAR_RECORDING_POOL_SIZE)
    for (const [message, transfer] of buffers) {
      expect(message.buffer.byteLength).toBe(GUITAR_RECORDING_PCM_FRAMES * 4)
      expect(transfer).toEqual([message.buffer])
    }
    expect(h.node.port.postMessage).toHaveBeenCalledWith({
      type: 'start',
      maxFrames: 48000 * GUITAR_RECORDING_LIMIT_SECONDS,
    })
    h.node.send({ type: 'started', audioStartFrame: 1234 })
    expect(h.options.onStart).toHaveBeenCalledExactlyOnceWith(1234)
    const buffer = new ArrayBuffer(512)
    const pcm = {
      type: 'pcm' as const,
      buffer,
      sequence: 0,
      firstFrame: 0,
      frames: 128,
    }
    h.node.send(pcm)
    expect(h.worker.postMessage).toHaveBeenCalledWith(pcm, [buffer])
    h.finish()
    await expect(capture.done).resolves.toEqual(summary)
    expectReleased(h)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels during module loading without allocating a capture branch', async () => {
    const h = harness()
    const loading = deferred()
    h.context.audioWorklet.addModule.mockReturnValueOnce(loading.promise)
    const starting = startGuitarRecordingCapture(h.options)
    const result = expect(starting).rejects.toMatchObject({
      name: 'AbortError',
    })
    h.abort.abort()
    loading.resolve()
    await result
    expect(h.context.createChannelSplitter).not.toHaveBeenCalled()
    expect(edge.worker).not.toHaveBeenCalled()
    expect(h.trackStop).not.toHaveBeenCalled()
  })

  it('retries a failed module load instead of caching the rejected promise', async () => {
    const h = harness()
    h.context.audioWorklet.addModule.mockRejectedValueOnce(
      new Error('asset unavailable'),
    )
    await expect(startGuitarRecordingCapture(h.options)).rejects.toThrow(
      'asset unavailable',
    )
    const capture = await startGuitarRecordingCapture(h.options)
    expect(h.context.audioWorklet.addModule).toHaveBeenCalledTimes(2)
    h.finish()
    await capture.done
    expectReleased(h)
  })

  it.each([-1, 2, 0.5])(
    'rejects unavailable channel %s before allocation',
    async (channel) => {
      const h = harness()
      h.options.input.channel = channel
      await expect(startGuitarRecordingCapture(h.options)).rejects.toThrow(
        'available input channel',
      )
      expect(h.context.audioWorklet.addModule).not.toHaveBeenCalled()
      expect(edge.worker).not.toHaveBeenCalled()
    },
  )

  it('releases partial graph allocation if the Worker constructor fails', async () => {
    const h = harness()
    edge.worker.mockImplementationOnce(() => {
      throw new Error('worker unavailable')
    })
    await expect(startGuitarRecordingCapture(h.options)).rejects.toThrow(
      'worker unavailable',
    )
    expect(h.splitter.disconnect).toHaveBeenCalledOnce()
    expect(h.node.disconnect).toHaveBeenCalledOnce()
    expect(h.node.port.close).toHaveBeenCalledOnce()
    expect(h.silence.disconnect).toHaveBeenCalledOnce()
    expect(h.source.connect).not.toHaveBeenCalled()
  })

  it('recycles buffers and resolves completion only after ordered durable writes', async () => {
    const h = harness()
    const write = deferred()
    h.onChunk.mockImplementationOnce(() => write.promise)
    const capture = await startGuitarRecordingCapture(h.options)
    const settled = vi.fn()
    void capture.done.then(settled)
    const first = chunk(0)
    const second = chunk(1)
    const recycled = new ArrayBuffer(512)
    h.worker.send({ type: 'chunk', chunk: first, recycled: [recycled] })
    h.worker.send({
      type: 'chunk',
      chunk: second,
      recycled: [new ArrayBuffer(512)],
    })
    h.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.onChunk).toHaveBeenCalledExactlyOnceWith(first, null)
    expect(settled).not.toHaveBeenCalled()
    expect(h.worker.terminate).not.toHaveBeenCalled()
    expect(
      h.node.port.postMessage.mock.calls.some(
        ([message]) => message.buffer === recycled,
      ),
    ).toBe(false)
    write.resolve()
    await capture.done
    expect(h.onChunk).toHaveBeenNthCalledWith(2, second, null)
    const recycledCall = h.node.port.postMessage.mock.calls.find(
      ([message]) => message.buffer === recycled,
    )
    expect(recycledCall?.[0].type).toBe('buffer')
    expect(recycledCall?.[1][0]).toBe(recycled)
    expectReleased(h)
  })

  it('keeps a storage failure explicit and does not publish later chunks as durable', async () => {
    const h = harness()
    h.onChunk.mockRejectedValueOnce(new Error('quota exceeded'))
    const capture = await startGuitarRecordingCapture(h.options)
    h.worker.send({
      type: 'chunk',
      chunk: chunk(),
      recycled: [new ArrayBuffer(512)],
    })
    h.worker.send({
      type: 'chunk',
      chunk: chunk(1),
      recycled: [new ArrayBuffer(512)],
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(h.node.port.postMessage).toHaveBeenCalledWith({
      type: 'stop',
      reason: 'quota exceeded',
    })
    expect(h.onChunk).toHaveBeenCalledOnce()
    h.finish()
    await expect(capture.done).resolves.toMatchObject({
      interruption: 'quota exceeded',
    })
    expectReleased(h)
  })

  it('waits for an in-flight checkpoint before rejecting a failed Worker', async () => {
    const h = harness()
    const write = deferred()
    h.onChunk.mockImplementationOnce(() => write.promise)
    const capture = await startGuitarRecordingCapture(h.options)
    const rejected = vi.fn()
    void capture.done.catch(rejected)
    h.worker.send({
      type: 'chunk',
      chunk: chunk(),
      recycled: [new ArrayBuffer(512)],
    })
    await vi.advanceTimersByTimeAsync(0)
    h.worker.onerror?.()
    await vi.advanceTimersByTimeAsync(0)
    expectReleased(h)
    expect(rejected).not.toHaveBeenCalled()
    write.resolve()
    await expect(capture.done).rejects.toThrow('worker failed')
    expect(
      h.node.port.postMessage.mock.calls.filter(
        ([message]) => message.type === 'buffer',
      ),
    ).toHaveLength(GUITAR_RECORDING_POOL_SIZE)
  })

  it.each(['abort', 'suspend'] as const)(
    'flushes once on %s and removes its listeners on completion',
    async (cause) => {
      const h = harness()
      const capture = await startGuitarRecordingCapture(h.options)
      h.node.send({ type: 'started', audioStartFrame: 100 })
      if (cause === 'abort') h.abort.abort()
      else {
        h.context.state = 'suspended'
        h.context.dispatchEvent(new Event('statechange'))
      }
      void capture.stop()
      expect(
        h.node.port.postMessage.mock.calls.filter(
          ([message]) => message.type === 'stop',
        ),
      ).toHaveLength(1)
      h.finish()
      await capture.done
      expectReleased(h)
      expect(vi.getTimerCount()).toBe(0)
      h.context.dispatchEvent(new Event('statechange'))
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('keeps the stop deadline when an in-flight start acknowledgement arrives late', async () => {
    const h = harness()
    const capture = await startGuitarRecordingCapture(h.options)
    const rejected = vi.fn()
    void capture.done.catch(rejected)
    void capture.stop()
    h.node.send({ type: 'started', audioStartFrame: 100 })
    await vi.advanceTimersByTimeAsync(8000)
    expect(rejected).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: expect.stringContaining('stopped responding'),
      }),
    )
    expectReleased(h)
  })

  it.each(['start', 'stop', 'analysis'] as const)(
    'bounds an unresponsive %s phase and preserves input ownership',
    async (phase) => {
      const h = harness()
      const capture = await startGuitarRecordingCapture(h.options)
      const rejected = expect(capture.done).rejects.toThrow(
        phase === 'start'
          ? 'No audio reached'
          : phase === 'stop'
            ? 'stopped responding'
            : 'Analysis did not finish',
      )
      if (phase !== 'start')
        h.node.send({ type: 'started', audioStartFrame: 100 })
      if (phase === 'stop') void capture.stop()
      if (phase === 'analysis')
        h.node.send({
          type: 'stopped',
          frames: 128,
          clockAnomalies: 0,
          reason: null,
        })
      await vi.advanceTimersByTimeAsync(phase === 'start' ? 5000 : 8000)
      await rejected
      expectReleased(h)
    },
  )
})
