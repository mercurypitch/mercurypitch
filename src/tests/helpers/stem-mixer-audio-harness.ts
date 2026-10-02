// ============================================================
// The stem mixer's audio controller, on a fake context, for unit tests
// ============================================================
//
// `useStemMixerAudioController` drives real sources off an AudioContext and a
// requestAnimationFrame loop. This gives it a context that records what it is
// asked to build and a frame clock the test turns by hand, and wires the
// thirty-odd deps with inert stand-ins, so a test can play a song and look at
// what the transport did.
//
// The caller mocks '@/lib/audio-unlock' itself (vi.mock is per file), and
// undoes the globals with vi.unstubAllGlobals() after each test.

import type { Accessor } from 'solid-js'
import { createRoot, createSignal } from 'solid-js'
import { vi } from 'vitest'
import type { StemMixerAudioDeps } from '@/features/stem-mixer/useStemMixerAudioController'
import { useStemMixerAudioController } from '@/features/stem-mixer/useStemMixerAudioController'

export const SONG_SECONDS = 30
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
    createBufferSource: vi.fn(() => ({
      ...node(),
      buffer: null as AudioBuffer | null,
      playbackRate: { value: 1 },
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    })),
    decodeAudioData: vi.fn(async () => Promise.resolve(fakeBuffer())),
  }
}

export type FakeAudioContext = ReturnType<typeof fakeContext>

export interface FakeStemTrack {
  label: string
  url: string
  color: string
  buffer: AudioBuffer | null
  gainNode: null
  analyserNode: null
  sourceNode: null
  muted: boolean
  soloed: boolean
  volume: number
}

export function stemTrack(
  label: string,
  url: string,
  buffer: AudioBuffer | null = null,
): FakeStemTrack {
  return {
    label,
    url,
    color: '#fff',
    buffer,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 1,
  }
}

/** A decoded stem beside the vocal and the instrumental, such as Drums. */
export const decodedStem = (label: string): FakeStemTrack =>
  stemTrack(label, `/${label.toLowerCase()}.m4a`, fakeBuffer())

export interface AudioHarnessOptions {
  /** Played after the vocal and the instrumental, already decoded. */
  extraTracks?: FakeStemTrack[]
  keyShift?: Accessor<number>
  keepDrums?: Accessor<boolean>
}

export interface AudioHarness {
  audio: ReturnType<typeof useStemMixerAudioController>
  context: FakeAudioContext
  /** Advance the audio clock one frame at a time, running what each queued. */
  runFrames: (count: number) => void
  /** Decodes the stems; the song is SONG_SECONDS long. */
  load: () => Promise<void>
  dispose: () => void
}

export function createAudioHarness(
  options: AudioHarnessOptions = {},
): AudioHarness {
  const context = fakeContext()
  let frames: FrameRequestCallback[] = []
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
    tracks: () => [vocal(), instrumental(), ...(options.extraTracks ?? [])],
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
    keyShift: options.keyShift,
    keepDrums: options.keepDrums,
  } as unknown as StemMixerAudioDeps

  let audio!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    audio = useStemMixerAudioController(deps)
    return disposeRoot
  })

  return {
    audio,
    context,
    runFrames: (count) => {
      for (let i = 0; i < count; i++) {
        context.currentTime += FRAME_SECONDS
        const due = frames
        frames = []
        for (const frame of due) frame(context.currentTime * 1000)
      }
    },
    load: async () => {
      await audio.loadStems()
    },
    dispose,
  }
}
