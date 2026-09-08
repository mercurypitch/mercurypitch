// Live capture boundary tests prove optional analysis cannot close the shared route or recording.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startLiveChordCapture } from './live-chord-capture'
import type { GuitarCaptureMessage } from './recording-types'

class Node {
  connect = vi.fn()
  disconnect = vi.fn()
  gain = { value: 1 }
}
class Worklet extends Node {
  port = {
    postMessage: vi.fn(),
    close: vi.fn(),
    onmessage: null as
      | ((event: MessageEvent<GuitarCaptureMessage>) => void)
      | null,
  }
  onprocessorerror: (() => void) | null = null
}
class Analysis {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  send(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

function setup() {
  const source = new Node()
  const splitter = new Node()
  const silence = new Node()
  const node = new Worklet()
  const worker = new Analysis()
  const track = { stop: vi.fn() }
  const context = Object.assign(new EventTarget(), {
    state: 'running',
    sampleRate: 48000,
    destination: new Node(),
    audioWorklet: { addModule: vi.fn(async () => {}) },
    createChannelSplitter: vi.fn(() => splitter),
    createGain: vi.fn(() => silence),
    close: vi.fn(),
  })
  vi.stubGlobal(
    'AudioWorkletNode',
    vi.fn(function () {
      return node
    }),
  )
  vi.stubGlobal(
    'Worker',
    vi.fn(function () {
      return worker
    }),
  )
  const abort = new AbortController()
  const options = {
    input: {
      context: context as unknown as AudioContext,
      source: source as unknown as AudioNode,
      stream: { getTracks: () => [track] } as unknown as MediaStream,
      channel: 1,
      channelCount: 2,
    },
    signal: abort.signal,
    onReady: vi.fn(),
    onResult: vi.fn(),
    onError: vi.fn(),
  }
  return {
    options,
    abort,
    source,
    splitter,
    silence,
    context,
    node,
    worker,
    track,
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('loads first, borrows only the chosen channel and recycles a fixed pool without an audible path', async () => {
  const h = setup()
  const capture = await startLiveChordCapture(h.options)
  expect(h.source.connect).not.toHaveBeenCalled()
  expect(h.worker.postMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'init',
    sampleRate: 48000,
  })
  h.worker.send({ type: 'ready' })
  expect(h.source.connect).toHaveBeenCalledExactlyOnceWith(h.splitter)
  expect(h.splitter.connect).toHaveBeenCalledExactlyOnceWith(h.node, 1, 0)
  expect(h.silence.gain.value).toBe(0)
  expect(
    h.node.port.postMessage.mock.calls.filter(
      ([data]) => data.type === 'buffer',
    ),
  ).toHaveLength(12)
  h.worker.send({ type: 'ready' })
  expect(h.source.connect).toHaveBeenCalledTimes(1)
  h.node.port.onmessage?.({
    data: { type: 'started', audioStartFrame: 480000 },
  } as MessageEvent<GuitarCaptureMessage>)
  const pcm = {
    type: 'pcm' as const,
    firstFrame: 0,
    frames: 4096,
    sequence: 0,
    buffer: new ArrayBuffer(4096 * 4),
  }
  h.node.port.onmessage?.({ data: pcm } as MessageEvent<GuitarCaptureMessage>)
  expect(h.worker.postMessage).toHaveBeenLastCalledWith(pcm, [pcm.buffer])
  h.worker.send({ type: 'buffer', buffer: pcm.buffer })
  expect(h.node.port.postMessage).toHaveBeenLastCalledWith(
    { type: 'buffer', buffer: pcm.buffer },
    [pcm.buffer],
  )
  h.worker.send({
    type: 'result',
    result: { notes: [], analysedSeconds: 0.5, processingMs: 32 },
  })
  expect(h.options.onResult).toHaveBeenCalledExactlyOnceWith({
    notes: [],
    analysedSeconds: 0.5,
    processingMs: 32,
    audioStartSeconds: 10,
  })
  capture.dispose()
  h.abort.abort()
  expect(h.worker.terminate).toHaveBeenCalledTimes(1)
  expect(h.node.port.close).toHaveBeenCalledTimes(1)
  expect(h.source.disconnect).toHaveBeenCalledExactlyOnceWith(h.splitter)
  expect(h.context.close).not.toHaveBeenCalled()
  expect(h.track.stop).not.toHaveBeenCalled()
  expect(h.options.onError).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['abort', 'overload', 'worker', 'timeout', 'suspend'])(
  'cleans up %s without touching the input owner',
  async (action) => {
    const h = setup()
    await startLiveChordCapture(h.options)
    const late = h.worker.onmessage!
    if (action === 'abort') h.abort.abort()
    if (action === 'overload')
      h.worker.send({ type: 'error', message: 'Too slow; refine after Stop.' })
    if (action === 'worker') h.worker.onerror?.()
    if (action === 'timeout') await vi.advanceTimersByTimeAsync(45000)
    if (action === 'suspend') {
      h.context.state = 'suspended'
      h.context.dispatchEvent(new Event('statechange'))
    }
    late({ data: { type: 'ready' } } as MessageEvent)
    expect(h.source.connect).not.toHaveBeenCalled()
    expect(h.worker.terminate).toHaveBeenCalledTimes(1)
    expect(h.options.onResult).not.toHaveBeenCalled()
    expect(h.options.onError).toHaveBeenCalledTimes(action === 'abort' ? 0 : 1)
    expect(h.context.close).not.toHaveBeenCalled()
    expect(h.track.stop).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  },
)

it('aborts a pending worklet registration before allocating a Worker or nodes', async () => {
  const h = setup()
  const pending = Promise.withResolvers<undefined>()
  h.context.audioWorklet.addModule.mockReturnValue(pending.promise)
  const starting = startLiveChordCapture(h.options)
  h.abort.abort()
  pending.resolve(undefined)
  await expect(starting).rejects.toMatchObject({ name: 'AbortError' })
  expect(h.context.createChannelSplitter).not.toHaveBeenCalled()
  expect(Worker).not.toHaveBeenCalled()
})
