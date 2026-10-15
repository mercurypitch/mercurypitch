import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type SeparatorModule = typeof import('@/lib/vocal-separator')

interface SentMessage {
  type: string
  requestId?: number
  forceWebGpu?: boolean
}

class MockWorker {
  static instances: MockWorker[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly postMessage = vi.fn<(message: SentMessage) => void>()
  readonly terminate = vi.fn()

  constructor() {
    MockWorker.instances.push(this)
  }

  send(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }
}

const MODEL = '/models/vocals.onnx'
const LOST = { type: 'gpu-lost', message: 'GPU connection lost' }

let mod: SeparatorModule

function initOf(worker: MockWorker | undefined): SentMessage | undefined {
  return worker?.postMessage.mock.calls.find(([m]) => m.type === 'init')?.[0]
}

beforeEach(async () => {
  vi.useFakeTimers()
  MockWorker.instances = []
  vi.stubGlobal('Worker', MockWorker)
  // Giving up on the GPU lasts for the page, so each test loads a fresh one.
  vi.resetModules()
  mod = await import('@/lib/vocal-separator')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('VocalSeparator when the graphics card stops answering', () => {
  it('sets the model up on the CPU once the GPU setup runs past its limit', async () => {
    const separator = new mod.VocalSeparator()
    const notices: string[] = []
    separator.onNotice = (message) => notices.push(message)
    const init = separator.initialize(MODEL, true)
    const gpuWorker = MockWorker.instances[0]
    expect(initOf(gpuWorker)).toMatchObject({ forceWebGpu: true })

    // The limit counts from the end of the download, not from the request.
    vi.advanceTimersByTime(mod.GPU_SETUP_LIMIT_MS * 3)
    expect(gpuWorker.terminate).not.toHaveBeenCalled()

    gpuWorker.send({ type: 'gpu-start' })
    vi.advanceTimersByTime(mod.GPU_SETUP_LIMIT_MS - 1)
    expect(gpuWorker.terminate).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(gpuWorker.terminate).toHaveBeenCalledTimes(1)
    const cpuWorker = MockWorker.instances[1]
    expect(initOf(cpuWorker)).toEqual({
      type: 'init',
      modelPath: MODEL,
      forceWebGpu: false,
    })
    expect(notices).toEqual([mod.GPU_FALLBACK_NOTICE])

    cpuWorker.send({ type: 'ready', provider: 'wasm' })
    await init
    expect(separator.status).toBe('ready')
    expect(separator.provider).toBe('wasm')
  })

  it('moves to the CPU at once when the device is lost during setup', () => {
    const separator = new mod.VocalSeparator()
    void separator.initialize(MODEL, true)
    const gpuWorker = MockWorker.instances[0]

    gpuWorker.send({ type: 'gpu-start' })
    gpuWorker.send(LOST)

    expect(gpuWorker.terminate).toHaveBeenCalledTimes(1)
    expect(initOf(MockWorker.instances[1])).toMatchObject({
      forceWebGpu: false,
    })
  })

  it('keeps the GPU when its setup finishes in time', async () => {
    const separator = new mod.VocalSeparator()
    const init = separator.initialize(MODEL, true)
    const gpuWorker = MockWorker.instances[0]

    gpuWorker.send({ type: 'gpu-start' })
    gpuWorker.send({ type: 'ready', provider: 'webgpu' })
    await init
    vi.advanceTimersByTime(mod.GPU_SETUP_LIMIT_MS * 2)

    expect(gpuWorker.terminate).not.toHaveBeenCalled()
    expect(MockWorker.instances).toHaveLength(1)
    expect(separator.provider).toBe('webgpu')
  })

  it('starts every later separator in the page on the CPU', () => {
    const first = new mod.VocalSeparator()
    first.initialize(MODEL, true).catch(() => {})
    MockWorker.instances[0].send({ type: 'gpu-start' })
    vi.advanceTimersByTime(mod.GPU_SETUP_LIMIT_MS)
    first.destroy()

    const second = new mod.VocalSeparator()
    void second.initialize(MODEL, true)

    expect(initOf(MockWorker.instances.at(-1))).toMatchObject({
      forceWebGpu: false,
    })
  })

  it('ignores a worker it has already replaced', () => {
    const separator = new mod.VocalSeparator()
    void separator.initialize(MODEL, true)
    const gpuWorker = MockWorker.instances[0]

    gpuWorker.send({ type: 'gpu-start' })
    gpuWorker.send(LOST)
    gpuWorker.send({ type: 'ready', provider: 'webgpu' })

    expect(separator.status).toBe('initializing')
  })
})

describe('VocalSeparator when the device is lost mid-run', () => {
  async function readyOnGpu(): Promise<{
    separator: InstanceType<SeparatorModule['VocalSeparator']>
    gpuWorker: MockWorker
    notices: string[]
  }> {
    const separator = new mod.VocalSeparator()
    const notices: string[] = []
    separator.onNotice = (message) => notices.push(message)
    const init = separator.initialize(MODEL, true)
    const gpuWorker = MockWorker.instances[0]
    gpuWorker.send({ type: 'gpu-start' })
    gpuWorker.send({ type: 'ready', provider: 'webgpu' })
    await init
    return { separator, gpuWorker, notices }
  }

  it('calls the run off when the worker never reports a switch', async () => {
    const { separator, gpuWorker } = await readyOnGpu()

    const run = separator.separate(new Float32Array([0]), 44100)
    const outcome = expect(run).rejects.toThrow(mod.GPU_LOST_RUN_MESSAGE)
    gpuWorker.send(LOST)
    vi.advanceTimersByTime(mod.GPU_LOST_GRACE_MS - 1)
    expect(gpuWorker.terminate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    await outcome
    expect(gpuWorker.terminate).toHaveBeenCalledTimes(1)
    expect(separator.status).toBe('idle')

    // Trying again sets the model up on the CPU.
    void separator.initialize(MODEL, true)
    expect(initOf(MockWorker.instances[1])).toMatchObject({
      forceWebGpu: false,
    })
  })

  it('lets the run finish when the worker switches to the CPU by itself', async () => {
    const { separator, gpuWorker, notices } = await readyOnGpu()

    const run = separator.separate(new Float32Array([0]), 44100)
    gpuWorker.send(LOST)
    gpuWorker.send({ type: 'provider', provider: 'wasm' })
    vi.advanceTimersByTime(mod.GPU_LOST_GRACE_MS * 2)

    expect(gpuWorker.terminate).not.toHaveBeenCalled()
    expect(notices).toEqual([mod.GPU_FALLBACK_NOTICE])
    expect(separator.provider).toBe('wasm')

    gpuWorker.send({
      type: 'complete',
      requestId: 1,
      vocals: new Float32Array(1),
      instrumental: new Float32Array(1),
      metadata: { durationSec: 1, sampleRate: 44100, numChunks: 1 },
    })
    await expect(run).resolves.toMatchObject({ sampleRate: 44100 })
  })

  it('starts over on the next use when the device is lost between runs', async () => {
    const { separator, gpuWorker } = await readyOnGpu()

    gpuWorker.send(LOST)

    expect(gpuWorker.terminate).toHaveBeenCalledTimes(1)
    expect(separator.status).toBe('idle')
    // Nothing hung, so the next setup may try the GPU again.
    void separator.initialize(MODEL, true)
    expect(initOf(MockWorker.instances[1])).toMatchObject({
      forceWebGpu: true,
    })
  })
})
