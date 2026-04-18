// Vitest test setup file
import type { AudioContext as AudioContextType } from 'standardized-audio-context'
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
  getFloatTimeDomainData(data: Float32Array) {
    data.fill(0)
  }
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class MockMediaStreamAudioSourceNode {}

global.AudioContext = MockAudioContext as unknown as typeof AudioContextType
;(global.navigator as unknown as { mediaDevices?: { getUserMedia: () => Promise<{ getTracks: () => [] }> } }).mediaDevices = {
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

// Mock requestAnimationFrame
let rafId = 0
global.requestAnimationFrame = (_cb: FrameRequestCallback) => {
  return ++rafId
}
global.cancelAnimationFrame = () => {}
