// Test setup shared by both Vitest projects.
//
// Everything here is environment-agnostic: the doubles are assigned onto
// `global`, which exists under `node` as much as under `jsdom`. The only
// piece that genuinely needs a document — `@testing-library/jest-dom` — lives
// in `setup.ts`, the jsdom project's entry, so the node project does not pay
// for it. See `vitest.config.ts` for how the two projects divide the suite.
//
// Provide a real in-memory IndexedDB so the DexieAdapter (used when
// VITE_API_BASE_URL is empty in tests) works instead of throwing
// MissingAPIError and logging noisy caught errors to stderr.
import 'fake-indexeddb/auto'

// Mock Web Audio API for tests
class MockAudioContext {
  sampleRate = 44100
  state: 'suspended' | 'running' | 'closed' = 'running'
  currentTime = 0

  createGain() {
    return new MockGainNode()
  }
  createOscillator() {
    return new MockOscillator()
  }
  createAnalyser() {
    return new MockAnalyser()
  }
  createMediaStreamSource() {
    return new MockMediaStreamAudioSourceNode()
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode()
  }
  createChannelSplitter(_channels?: number) {
    return new MockChannelSplitterNode()
  }
  createMediaElementSource() {
    return new MockMediaElementAudioSourceNode()
  }
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode()
  }
  createWaveShaper() {
    return new MockWaveShaperNode()
  }
  // tone-player builds a piano-ish PeriodicWave per context and caches it in
  // a WeakMap keyed by the context, so this only has to be a distinct object.
  createPeriodicWave(_real?: Float32Array, _imag?: Float32Array) {
    return {} as PeriodicWave
  }
  destination = {}

  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

class MockGainNode {
  gain = {
    value: 0.8,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {},
    cancelAndHoldAtTime: () => {},
    cancelScheduledValues: () => {},
  }
  /** Recorded downstream nodes so tests can assert the audio graph. */
  connectedTo: unknown[] = []
  connect(target?: unknown) {
    this.connectedTo.push(target)
  }
  disconnect() {}
}

class MockWaveShaperNode {
  // The mixer's master soft clipper. `curve` and `oversample` are plain
  // properties in the spec, so the double only has to hold them.
  curve: Float32Array | null = null
  oversample: 'none' | '2x' | '4x' = 'none'
  connectedTo: unknown[] = []
  connect(target?: unknown) {
    this.connectedTo.push(target)
  }
  disconnect() {}
}

class MockDynamicsCompressorNode {
  threshold = { value: -24, setValueAtTime: () => {} }
  knee = { value: 30, setValueAtTime: () => {} }
  ratio = { value: 12, setValueAtTime: () => {} }
  attack = { value: 0.003, setValueAtTime: () => {} }
  release = { value: 0.25, setValueAtTime: () => {} }
  connectedTo: unknown[] = []
  connect(target?: unknown) {
    this.connectedTo.push(target)
  }
  disconnect() {}
}

class MockOscillator {
  type: OscillatorType = 'sine'
  frequency = {
    value: 440,
    setValueAtTime: () => {},
    setTargetAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
  setPeriodicWave(_wave: PeriodicWave) {}
  onended: (() => void) | null = null
}

class MockAnalyser {
  // An AnalyserNode IS an AudioNode, and the mic controller tears its graph
  // down with `micAnalyserNode?.disconnect()`. Without these the double threw
  // on every unmount that had opened a mic, which is why no test had ever
  // opened one.
  connect() {}
  disconnect() {}
  fftSize = 2048
  smoothingTimeConstant = 0.1
  frequencyBinCount = 1024
  _frequencyData = new Float32Array(1024)
  _timeData = new Float32Array(1024)

  getFloatFrequencyData(data: Float32Array) {
    data.fill(-100)
  }
  getByteFrequencyData(data: Uint8Array) {
    data.fill(0)
  }
  getFloatTimeDomainData(data: Float32Array) {
    data.fill(0)
  }
  getByteTimeDomainData(data: Uint8Array) {
    data.fill(128)
  }
}

class MockMediaStreamAudioSourceNode {
  connect() {}
  disconnect() {}
}

class MockMediaElementAudioSourceNode {
  connect() {}
  disconnect() {}
}

class MockBiquadFilterNode {
  type: BiquadFilterType = 'lowpass'
  frequency = {
    value: 440,
    setValueAtTime: () => {},
    setTargetAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
  }
  Q = { value: 1 }
  gain = { value: 0 }
  connect() {}
  disconnect() {}
}

class MockChannelSplitterNode {
  connect(_dest: unknown, _output?: number, _input?: number) {}
  disconnect() {}
}

global.AudioContext = MockAudioContext as unknown as typeof global.AudioContext
;(
  global.navigator as unknown as {
    mediaDevices?: { getUserMedia: () => Promise<{ getTracks: () => [] }> }
  }
).mediaDevices = {
  getUserMedia: () => Promise.resolve({ getTracks: () => [] }),
}

// Mock Web Storage (functional per-key storage).
//
// Both are doubled, not just localStorage. jsdom supplies a real
// sessionStorage, so a missing double was invisible there — and Node 24+
// exposes both as globals, so it was invisible under a modern local Node too.
// Under the `node` project on CI's Node 22 neither exists, and
// `reset-app-data.ts`'s `defaultEnv()` reads bare `sessionStorage`, which threw
// `ReferenceError: sessionStorage is not defined` on the runner alone.
function createStorageMock(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k])
    },
  } as unknown as Storage
}

global.localStorage = createStorageMock()
global.sessionStorage = createStorageMock()

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// Prevent jsdom "Not implemented: navigation" errors.
// downloadMelodyAsWAV creates <a> elements with blob: URLs and clicks them.
// jsdom only supports hash-based navigation, so redirect blob/data URLs to
// hash URLs that jsdom can handle without throwing.
URL.createObjectURL = (blob: Blob) => {
  void blob
  return `#download-${Math.random().toString(36).slice(2)}`
}

// Mock requestAnimationFrame
let rafId = 0
global.requestAnimationFrame = (_cb: FrameRequestCallback) => {
  return ++rafId
}
global.cancelAnimationFrame = () => {}

// Mock Web Worker to prevent node's worker_threads from throwing file URL errors
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}
}
global.Worker = MockWorker as unknown as typeof Worker

import { vi } from 'vitest'

vi.mock('worker_threads', () => {
  return {
    Worker: MockWorker,
  }
})

// jsdom provides no fetch, so an unstubbed call falls through to Node's undici
// and makes a real outbound request. That is how `blob:` fixtures in the Stem
// Mixer suite came to log `TypeError: fetch failed` on CI and nowhere else:
// the rejection landed after the test had already ended, so it read as
// unattributed noise on a green run rather than as a bug in the test.
//
// A test that wants network behaviour stubs it (`vi.stubGlobal('fetch', ...)`,
// which overrides this). Anything else is an omission, and should say so at
// the call site.
global.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : String(input)
  return Promise.reject(
    new Error(`Unexpected network request: ${url}. Stub fetch in this test.`),
  )
}) as unknown as typeof fetch
