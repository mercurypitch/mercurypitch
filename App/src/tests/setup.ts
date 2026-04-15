// Vitest test setup file
import '@testing-library/jest-dom';

// Mock Web Audio API for tests
class MockAudioContext {
  sampleRate = 44100;
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 0;

  createGain() { return new MockGainNode(); }
  createOscillator() { return new MockOscillator(); }
  createAnalyser() { return new MockAnalyser(); }
  createMediaStreamSource() { return new MockMediaStreamAudioSourceNode(); }
  destination = {};

  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

class MockGainNode {
  gain = { value: 0.8, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  connect() {}
  disconnect() {}
}

class MockOscillator {
  type: OscillatorType = 'sine';
  frequency = { value: 440, setValueAtTime: () => {}, setTargetAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
  onended: (() => void) | null = null;
}

class MockAnalyser {
  fftSize = 2048;
  smoothingTimeConstant = 0.1;
  frequencyBinCount = 1024;
  _frequencyData = new Float32Array(1024);
  _timeData = new Float32Array(1024);

  getFloatFrequencyData(data: Float32Array) { data.fill(-100); }
  getFloatTimeDomainData(data: Float32Array) { data.fill(0); }
}

class MockMediaStreamAudioSourceNode {}

global.AudioContext = MockAudioContext as any;
global.navigator.mediaDevices = {
  getUserMedia: () => Promise.resolve({ getTracks: () => [] }),
} as any;

// Mock localStorage
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};
global.localStorage = localStorageMock as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock requestAnimationFrame
let rafId = 0;
global.requestAnimationFrame = (cb: FrameRequestCallback) => {
  return ++rafId;
};
global.cancelAnimationFrame = () => {};