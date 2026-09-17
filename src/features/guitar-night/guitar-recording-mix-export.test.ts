// Offline mix export tests prove guitar and drummer stay separate until rendering.
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import type { DrumKitTrigger } from '@/features/drum-night/runtime/drum-runtime-types'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { renderGuitarRecordingMix } from './guitar-recording-mix-export'

const mocks = vi.hoisted(() => ({
  amp: vi.fn(),
  drum: vi.fn(),
  trigger: vi.fn((_hit: DrumKitTrigger) => 'sampled' as const),
  prewarm: vi.fn(async () => undefined),
  disposeDrums: vi.fn(async () => undefined),
}))

vi.mock('@/lib/guitar/guitar-amp-stage', () => ({
  createGuitarAmpStage: mocks.amp,
}))
vi.mock('@/features/drum-night/audio/drum-kit-player', () => ({
  createDrumKitPlayer: mocks.drum,
}))

const audioBuffer = (
  channels: readonly Float32Array[],
  sampleRate = 48_000,
): AudioBuffer =>
  ({
    duration: channels[0]!.length / sampleRate,
    sampleRate,
    length: channels[0]!.length,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel]!,
  }) as AudioBuffer

class TestOfflineAudioContext {
  static latest: TestOfflineAudioContext | null = null
  readonly destination = {} as AudioDestinationNode
  readonly gains: GainNode[] = []
  readonly sources: Array<{
    buffer: AudioBuffer | null
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []
  readonly limiter = {
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    TestOfflineAudioContext.latest = this
  }

  createDynamicsCompressor() {
    return this.limiter as unknown as DynamicsCompressorNode
  }

  createGain() {
    const node = {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as GainNode
    this.gains.push(node)
    return node
  }

  createBufferSource() {
    const source = {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(),
      disconnect: vi.fn(),
    }
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }

  async decodeAudioData() {
    return audioBuffer([new Float32Array([0.25]), new Float32Array([-0.25])])
  }

  async startRendering() {
    return audioBuffer([
      new Float32Array([0.25, 0.5]),
      new Float32Array([-0.25, -0.5]),
    ])
  }
}

function draft(): GuitarRecordingDraft {
  return {
    recording: {
      id: 'take',
      version: 1,
      detectorVersion: 'test',
      title: 'Separate lanes',
      createdAt: '',
      updatedAt: '',
      state: 'draft',
      sampleRate: 48_000,
      inputChannel: 0,
      inputKind: 'interface',
      frames: 4_800,
      chunks: 1,
      audioStartFrame: 0,
      clockAnomalies: 0,
      interruption: null,
      amp: null,
      backing: null,
      takeId: null,
      scoreId: null,
    },
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
    peaks: [],
    notes: [],
    drumTrack: {
      version: 1,
      hits: [
        {
          offsetSeconds: 0.02,
          gmKey: 36,
          velocity: 120,
          kitId: 'muldjord',
          level: 1.1,
        },
        {
          offsetSeconds: 0.06,
          gmKey: 38,
          velocity: 108,
          kitId: 'crocell',
          level: 0.9,
        },
      ],
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('OfflineAudioContext', TestOfflineAudioContext)
  vi.clearAllMocks()
  TestOfflineAudioContext.latest = null
  const ampNode = { connect: vi.fn(), disconnect: vi.fn() }
  mocks.amp.mockReturnValue({
    input: ampNode,
    output: ampNode,
    dispose: vi.fn(),
  })
  mocks.drum.mockImplementation(() => ({
    activate: vi.fn(async () => true),
    prewarm: mocks.prewarm,
    trigger: mocks.trigger,
    dispose: mocks.disposeDrums,
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('renderGuitarRecordingMix', () => {
  it('mixes the selected guitar source with independently scheduled drum kits', async () => {
    const original = draft()
    const originalBytes = original.blob!.size
    const result = await renderGuitarRecordingMix({
      draft: original,
      source: 'recording',
      notes: [],
      amp: { ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS, enabled: false },
      drumLevel: 1.5,
      includeDrums: true,
    })

    expect(result.type).toBe('audio/wav')
    expect(result.size).toBe(52)
    expect(original.blob!.size).toBe(originalBytes)
    expect(
      TestOfflineAudioContext.latest?.sources[0]?.start,
    ).toHaveBeenCalledWith(0)
    expect(mocks.drum).toHaveBeenCalledTimes(2)
    expect(
      mocks.drum.mock.calls.map(([options]) => options.initialKitId),
    ).toEqual(['muldjord', 'crocell'])
    expect(
      mocks.drum.mock.calls.every(([options]) => options.offline === true),
    ).toBe(true)
    expect(mocks.trigger.mock.calls.map(([hit]) => hit)).toEqual([
      expect.objectContaining({ gmKey: 36, atContextTime: 0.02 }),
      expect.objectContaining({ gmKey: 38, atContextTime: 0.06 }),
    ])
    const gains = TestOfflineAudioContext.latest!.gains
    expect(gains[0]!.gain.value).toBeCloseTo(1.65)
    expect(gains[1]!.gain.value).toBeCloseTo(1.35)
    expect(mocks.disposeDrums).toHaveBeenCalledTimes(2)
    expect(
      gains.every((gain) => vi.mocked(gain.disconnect).mock.calls.length === 1),
    ).toBe(true)
  })

  it('can deliberately render guitar only without deleting saved drummer data', async () => {
    const original = draft()
    await renderGuitarRecordingMix({
      draft: original,
      source: 'recording',
      notes: [],
      amp: { ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS, enabled: false },
      drumLevel: 1,
      includeDrums: false,
    })
    expect(mocks.drum).not.toHaveBeenCalled()
    expect(original.drumTrack?.hits).toHaveLength(2)
  })
})
