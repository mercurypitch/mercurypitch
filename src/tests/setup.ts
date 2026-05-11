// Vitest test setup file
import '@testing-library/jest-dom'

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
  }
  connect() {}
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
  onended: (() => void) | null = null
}

class MockAnalyser {
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

// Mock localStorage (functional per-key storage)
const localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value
  },
  removeItem: (key: string) => {
    delete localStorageStore[key]
  },
  clear: () => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
  },
}
global.localStorage = localStorageMock as unknown as Storage

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
const _origCreateObjectURL = URL.createObjectURL.bind(URL)
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
