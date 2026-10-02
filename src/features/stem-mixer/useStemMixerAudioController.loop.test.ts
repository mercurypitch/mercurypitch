// ============================================================
// StemMixer — the A-B loop, as the playback clock runs it
// ============================================================
//
// Paused at 0:05, A and then B on that same instant, then Play: the loop's
// end was already behind the playhead, so every frame seeked back to A and
// the song stood still on it, counting a "loop" sixty times a second. These
// drive the real controller through decoded stems and a hand-cranked frame
// clock, because the freeze lived in how the frame loop and the loop points
// meet, not in either one alone.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
}))

const SONG_SECONDS = 30
const FRAME_SECONDS = 0.05

function fakeBuffer(): AudioBuffer {
  return {
    duration: SONG_SECONDS,
    length: SONG_SECONDS * 48_000,
    numberOfChannels: 1,
    sampleRate: 48_000,
    getChannelData: () => new Float32Array(8),
  } as unknown as AudioBuffer
}

function fakeContext() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48_000,
    destination: {},
    resume: vi.fn(async () => Promise.resolve()),
    close: vi.fn(async () => Promise.resolve()),
    createGain: () => ({ ...node(), gain: param() }),
    createWaveShaper: () => ({ ...node(), curve: null, oversample: 'none' }),
    createAnalyser: () => ({
      ...node(),
      fftSize: 2048,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData: vi.fn(),
    }),
    createBufferSource: () => ({
      ...node(),
      buffer: null as AudioBuffer | null,
      playbackRate: { value: 1 },
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    }),
    decodeAudioData: vi.fn(async () => Promise.resolve(fakeBuffer())),
  }
}

function stemTrack(label: string, url: string) {
  return {
    label,
    url,
    color: '#fff',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 1,
  }
}

function harness() {
  const [vocal, setVocal] = createSignal(stemTrack('Vocal', '/v.m4a'))
  const [instrumental, setInstrumental] = createSignal(
    stemTrack('Instrumental', '/i.m4a'),
  )
  const [midi, setMidi] = createSignal(stemTrack('MIDI', ''))
  const [extras, setExtras] = createSignal([])
  const [midiNotes, setMidiNotes] = createSignal([])
  const noop = (): void => undefined
  const deps = {
    vocal,
    setVocal,
    instrumental,
    setInstrumental,
    midi,
    setMidi,
    extras,
    setExtras,
    tracks: () => [vocal(), instrumental()],
    anySoloed: () => false,
    PITCH_WINDOW_FILL_RATIO: 0.8,
    midiNotes,
    setMidiNotes,
    canvas: {
      syncCanvasSizes: noop,
      drawWaveformOverview: noop,
      drawLiveWaveform: noop,
      drawPitchCanvas: noop,
      drawMidiCanvas: noop,
    },
    updateCurrentLine: noop,
    setCurrentLineIdx: noop,
    setUserScrolled: noop,
    micActive: () => false,
    getMicAnalyserNode: () => null,
    getMicPitchDetector: () => null,
    getMicPitchHistory: () => [],
    setMicPitch: noop,
    comparisonData: () => [],
    pushComparison: noop,
    markLoopIteration: noop,
    clearComparisonData: noop,
    resetMicPitchHistory: noop,
    computeScore: () => ({}),
    setScore: noop,
    setShowScore: noop,
    resetScore: noop,
    stems: { vocal: '/v.m4a', instrumental: '/i.m4a' },
    songTitle: 'Goodbye to Spring',
    showNotification: noop,
  } as unknown as StemMixerAudioDeps
  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  return { controller, dispose }
}

let context: ReturnType<typeof fakeContext>
let frames: FrameRequestCallback[]
let active: ReturnType<typeof harness> | null = null

/** Advance the audio clock one frame at a time, running what each queued. */
function runFrames(count: number): void {
  for (let i = 0; i < count; i++) {
    context.currentTime += FRAME_SECONDS
    const due = frames
    frames = []
    for (const frame of due) frame(context.currentTime * 1000)
  }
}

async function loadedSong() {
  active = harness()
  await active.controller.loadStems()
  expect(active.controller.duration()).toBe(SONG_SECONDS)
  return active.controller
}

beforeEach(() => {
  frames = []
  context = fakeContext()
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return context
  })
  vi.stubGlobal('fetch', async () =>
    Promise.resolve(new Response(new Uint8Array(64))),
  )
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.push(frame)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  active?.dispose()
  active = null
  vi.unstubAllGlobals()
})

describe('the A-B loop while the song plays', () => {
  it('plays on through an A and a B on the same instant, instead of holding on A', async () => {
    const audio = await loadedSong()
    audio.seekTo(5)
    audio.setLoopStart(5)
    audio.setLoopEnd(5)
    audio.setLoopEnabled(true)

    audio.handlePlay()
    runFrames(20)

    expect(audio.elapsed()).toBeGreaterThan(5.9)
    expect(audio.loopCount()).toBe(0)
  })

  it('still takes a loop of at least 0.1 s back to A at its end', async () => {
    const audio = await loadedSong()
    audio.seekTo(5)
    audio.setLoopStart(5)
    audio.setLoopEnd(6)
    audio.setLoopEnabled(true)

    audio.handlePlay()
    runFrames(25)

    expect(audio.loopCount()).toBe(1)
    expect(audio.elapsed()).toBeLessThan(6)
    expect(audio.elapsed()).toBeGreaterThanOrEqual(5)
  })
})
