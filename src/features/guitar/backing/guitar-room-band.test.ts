// Room-band tests pin the click's beat map, especially when it repeats a span.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HumanizeInputEvent } from '@/features/drum-night/groove/groove-humanize'
import type { DrumKitTrigger } from '@/features/drum-night/runtime/drum-runtime-types'
import type { GuitarElectricAmpStage } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { sliderToGain } from '@/lib/volume-curve'
import type { GuitarRoomBand, GuitarRoomBandBeatPhase, } from './guitar-room-band'
import { createGuitarRoomBand, groupNotesByBeat, groupPercussionHitsByBeat, guitarRoomBandVelocityGain, resolveBandLoop, } from './guitar-room-band'
import { resolveGuitarRoomRhythmPreset } from './guitar-room-rhythm'
import { setGuitarSessionGainTarget } from './guitar-session-audio-graph'

const guitarVoices = vi.hoisted(() => ({
  createBassVoice: vi.fn(),
  createGuitarVoice: vi.fn(),
}))
const drumVoices = vi.hoisted(() => ({
  triggerDrumVoice: vi.fn(),
}))

vi.mock('@/lib/drum-voices', () => drumVoices)
vi.mock('@/lib/guitar/guitar-synth', () => guitarVoices)

function fakeAudioNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function fakeAudioParam() {
  return {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  }
}

function fakeAudioContext(
  createdGains: Array<
    ReturnType<typeof fakeAudioNode> & {
      gain: ReturnType<typeof fakeAudioParam>
    }
  > = [],
): AudioContext {
  const startedAtMs = Date.now()
  return {
    get currentTime() {
      return 5 + (Date.now() - startedAtMs) / 1000
    },
    state: 'running',
    destination: fakeAudioNode(),
    createGain: () => {
      const gain = { ...fakeAudioNode(), gain: fakeAudioParam() }
      createdGains.push(gain)
      return gain
    },
    createDynamicsCompressor: () => ({
      ...fakeAudioNode(),
      threshold: fakeAudioParam(),
      knee: fakeAudioParam(),
      ratio: fakeAudioParam(),
      attack: fakeAudioParam(),
      release: fakeAudioParam(),
    }),
    createWaveShaper: () => ({
      ...fakeAudioNode(),
      curve: null,
      oversample: 'none',
    }),
    createBiquadFilter: () => ({
      ...fakeAudioNode(),
      type: 'lowpass',
      frequency: fakeAudioParam(),
      Q: fakeAudioParam(),
      gain: fakeAudioParam(),
    }),
    close: vi.fn(async () => undefined),
  } as unknown as AudioContext
}

function fakeElectricAmpStage(): GuitarElectricAmpStage {
  const parameters = { ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS }
  return {
    input: fakeAudioNode() as unknown as GainNode,
    output: fakeAudioNode() as unknown as GainNode,
    nodes: [],
    getParameters: vi.fn(() => parameters),
    setParameters: vi.fn(() => parameters),
    setBypassed: vi.fn(),
    dispose: vi.fn(),
  }
}

async function disposeBand(band: GuitarRoomBand): Promise<void> {
  const pending = band.dispose()
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(80)
  await pending
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  localStorage.clear()
})

describe('resolveBandLoop', () => {
  it('keeps a loop the exercise actually contains', () => {
    expect(resolveBandLoop({ start: 4, end: 8 }, 16)).toEqual({
      start: 4,
      end: 8,
    })
  })

  it('trims a loop that runs off the end of the exercise', () => {
    expect(resolveBandLoop({ start: 12, end: 40 }, 16)).toEqual({
      start: 12,
      end: 16,
    })
  })

  it('refuses a loop that starts past the exercise', () => {
    expect(resolveBandLoop({ start: 20, end: 24 }, 16)).toBeNull()
  })

  it('refuses a loop shorter than one beat, which the pulse cannot express', () => {
    expect(resolveBandLoop({ start: 4, end: 4.5 }, 16)).toBeNull()
  })

  it('is absent when nothing was asked for', () => {
    expect(resolveBandLoop(null, 16)).toBeNull()
    expect(resolveBandLoop(undefined, 16)).toBeNull()
  })
})

describe('groupNotesByBeat', () => {
  it('buckets a note by the beat it starts in, fraction and all', () => {
    const grouped = groupNotesByBeat([
      { midi: 40, startBeat: 0, durationBeats: 0.5 },
      { midi: 43, startBeat: 0.5, durationBeats: 0.5 },
      { midi: 45, startBeat: 2.75, durationBeats: 0.25 },
    ])
    expect(grouped.get(0)?.map((note) => note.midi)).toEqual([40, 43])
    expect(grouped.get(2)?.map((note) => note.midi)).toEqual([45])
    expect(grouped.get(1)).toBeUndefined()
  })

  it('drops a note with no position rather than sounding it on beat one', () => {
    const grouped = groupNotesByBeat([
      { midi: 40, startBeat: Number.NaN, durationBeats: 1 },
      { midi: 41, startBeat: -2, durationBeats: 1 },
    ])
    expect(grouped.size).toBe(0)
  })

  it('keeps imported strike intensity monotonic and legacy notes at unity', () => {
    expect(guitarRoomBandVelocityGain(undefined)).toBe(1)
    expect(guitarRoomBandVelocityGain(Number.NaN)).toBe(1)
    expect(guitarRoomBandVelocityGain(0)).toBe(1)
    expect(guitarRoomBandVelocityGain(128)).toBe(1)
    const quiet = guitarRoomBandVelocityGain(40)
    const medium = guitarRoomBandVelocityGain(80)
    const loud = guitarRoomBandVelocityGain(120)
    expect(quiet).toBeGreaterThan(0)
    expect(quiet).toBeLessThan(medium)
    expect(medium).toBeLessThan(loud)
    expect(loud).toBeLessThan(1)
    expect(guitarRoomBandVelocityGain(127)).toBe(1)
  })
})

describe('groupPercussionHitsByBeat', () => {
  it('keeps fractional authored positions in their scheduling buckets', () => {
    const grouped = groupPercussionHitsByBeat([
      { trackId: 'track-drums', gmKey: 36, startBeat: 0, velocity: 100 },
      { trackId: 'track-drums', gmKey: 42, startBeat: 0.5, velocity: 80 },
      { trackId: 'track-drums', gmKey: 49, startBeat: 2.75, velocity: 127 },
    ])
    expect(grouped.get(0)?.map((hit) => hit.gmKey)).toEqual([36, 42])
    expect(grouped.get(2)?.map((hit) => hit.gmKey)).toEqual([49])
    expect(grouped.get(1)).toBeUndefined()
  })

  it('drops attacks with no usable authored position', () => {
    expect(
      groupPercussionHitsByBeat([
        {
          trackId: 'track-drums',
          gmKey: 36,
          startBeat: Number.NaN,
          velocity: 100,
        },
        { trackId: 'track-drums', gmKey: 38, startBeat: -1, velocity: 100 },
      ]).size,
    ).toBe(0)
  })

  it('keeps true time primary but orders same-time open hats before closers', () => {
    const grouped = groupPercussionHitsByBeat([
      { trackId: 'closer', gmKey: 42, startBeat: 1, velocity: 100 },
      { trackId: 'open', gmKey: 46, startBeat: 1, velocity: 100 },
      {
        trackId: 'choked-first-in-source',
        gmKey: 49,
        startBeat: 1,
        velocity: 110,
        articulation: 'choke',
      },
      { trackId: 'ordinary-crash', gmKey: 49, startBeat: 1, velocity: 110 },
      { trackId: 'earlier', gmKey: 44, startBeat: 0.75, velocity: 100 },
    ])

    expect(grouped.get(0)?.map((hit) => hit.trackId)).toEqual(['earlier'])
    expect(grouped.get(1)?.map((hit) => hit.trackId)).toEqual([
      'open',
      'ordinary-crash',
      'choked-first-in-source',
      'closer',
    ])
  })
})

describe('createGuitarRoomBand', () => {
  it('keeps the Guitar room drum bus at unity instead of hiding attenuation', async () => {
    const band = createGuitarRoomBand({
      contextFactory: () => fakeAudioContext(),
      activateContext: async () => undefined,
    })

    const graph = await band.activate()

    expect(graph?.buses.drums.gain.value).toBe(1)
    await disposeBand(band)
  })

  it('broadcasts a same-time hat close across track players after the open strike', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const routed: string[] = []
    const players: Array<{
      prewarm: ReturnType<typeof vi.fn>
    }> = []
    let playerIndex = 0
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => {
        const index = playerIndex++
        const port = {
          setKit: vi.fn(),
          activate: vi.fn(() => true),
          trigger: vi.fn((hit: DrumKitTrigger) => {
            routed.push(`trigger:${index}:${hit.gmKey}`)
            return 'synthesized' as const
          }),
          choke: vi.fn((request: { gmKey: number }) => {
            routed.push(`choke:${index}:${request.gmKey}`)
            return 'choked' as const
          }),
          prewarm: vi.fn(async () => undefined),
          snapshot: vi.fn(() => ({
            selectedKitId: 'studio' as const,
            status: 'ready' as const,
            sampleStatus:
              index === 0 ? ('ready' as const) : ('reduced' as const),
            fallbackReady: true,
            sampledReady: true,
            preparedSamples: 4,
            plannedSamples: 4,
            selectedFormat: 'opus' as const,
            error: null,
          })),
          subscribe: vi.fn(() => () => undefined),
          panic: vi.fn(),
          dispose: vi.fn(),
        }
        players.push(port)
        return port
      },
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      exercisePulse: false,
      percussion: [
        { trackId: 'closed-first', gmKey: 42, startBeat: 0, velocity: 100 },
        { trackId: 'open-second', gmKey: 46, startBeat: 0, velocity: 100 },
        {
          trackId: 'open-second',
          gmKey: 49,
          startBeat: 0.5,
          velocity: 116,
          articulation: 'choke',
        },
      ],
    })

    expect(routed).toEqual([
      'trigger:1:46',
      'choke:0:46',
      'choke:1:46',
      'trigger:0:42',
      'trigger:1:49',
      'choke:0:49',
      'choke:1:49',
    ])
    expect(players[0]?.prewarm).toHaveBeenCalledWith([
      { gmKey: 42, velocity: 100 },
    ])
    expect(players[1]?.prewarm).toHaveBeenCalledWith([
      { gmKey: 46, velocity: 100 },
      { gmKey: 49, velocity: 116 },
    ])
    expect(band.drumPlaybackSnapshot?.()).toMatchObject({
      status: 'ready',
      sampleStatus: 'reduced',
      sampledReady: true,
      selectedFormat: 'opus',
      routingCounts: {
        synthesized: 3,
        choked: 2,
      },
    })

    await disposeBand(band)
  })

  it.each([
    {
      name: 'same-time generated closer after imported open',
      generatedVoice: 'hh-closed' as const,
      generatedBeat: 0,
      generatedOffsetMs: 0,
      importedGmKey: 46,
      importedBeat: 0,
      expected: [
        'trigger:authored:46:5.090',
        'choke:generated:46:5.090',
        'choke:authored:46:5.090',
        'trigger:generated:42:5.090',
      ],
    },
    {
      name: 'same-time imported closer after generated open',
      generatedVoice: 'hh-open' as const,
      generatedBeat: 0,
      generatedOffsetMs: 0,
      importedGmKey: 42,
      importedBeat: 0,
      expected: [
        'trigger:generated:46:5.090',
        'choke:generated:46:5.090',
        'choke:authored:46:5.090',
        'trigger:authored:42:5.090',
      ],
    },
    {
      name: 'humanized generated closer after an earlier imported open',
      generatedVoice: 'hh-closed' as const,
      generatedBeat: 0,
      generatedOffsetMs: 5,
      importedGmKey: 46,
      importedBeat: 0,
      expected: [
        'trigger:authored:46:5.090',
        'choke:generated:46:5.095',
        'choke:authored:46:5.095',
        'trigger:generated:42:5.095',
      ],
    },
    {
      name: 'humanized generated open before a later imported closer',
      generatedVoice: 'hh-open' as const,
      generatedBeat: 0,
      generatedOffsetMs: -5,
      importedGmKey: 42,
      importedBeat: 0,
      expected: [
        'trigger:generated:46:5.085',
        'choke:generated:46:5.090',
        'choke:authored:46:5.090',
        'trigger:authored:42:5.090',
      ],
    },
    {
      name: 'later generated closer after fractional imported open',
      generatedVoice: 'hh-closed' as const,
      generatedBeat: 0.5,
      generatedOffsetMs: 0,
      importedGmKey: 46,
      importedBeat: 0.25,
      expected: [
        'trigger:authored:46:5.215',
        'choke:generated:46:5.340',
        'choke:authored:46:5.340',
        'trigger:generated:42:5.340',
      ],
    },
    {
      name: 'earlier imported closer before fractional generated open',
      generatedVoice: 'hh-open' as const,
      generatedBeat: 0.5,
      generatedOffsetMs: 0,
      importedGmKey: 42,
      importedBeat: 0.25,
      expected: [
        'choke:generated:46:5.215',
        'choke:authored:46:5.215',
        'trigger:authored:42:5.215',
        'trigger:generated:46:5.340',
      ],
    },
  ])('$name', async (scenario) => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const routed: string[] = []
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: (options) => ({
        setKit: vi.fn(),
        activate: vi.fn(() => true),
        trigger: vi.fn((hit: DrumKitTrigger) => {
          routed.push(
            `trigger:${options.role}:${hit.gmKey}:${(hit.atContextTime ?? 0).toFixed(3)}`,
          )
          return 'synth-fallback' as const
        }),
        choke: vi.fn((request: { gmKey: number; atContextTime?: number }) => {
          routed.push(
            `choke:${options.role}:${request.gmKey}:${(request.atContextTime ?? 0).toFixed(3)}`,
          )
          return 'idle' as const
        }),
        panic: vi.fn(),
        dispose: vi.fn(),
      }),
      readDrumSoundPreference: () => ({
        kitId: 'mercury-synth',
        feelId: 'rock',
      }),
      loadHumanizer: async () => ({
        humanizeDrumEvents: (events) =>
          events.map((event) => ({
            timeOffsetMs: scenario.generatedOffsetMs,
            velocity: event.velocity,
            ornaments: [],
          })),
      }),
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'groove',
      rhythmPreset: {
        id: 'cross-source-hat-order',
        label: 'Test',
        detail: 'Test',
        beatsPerPattern: 1,
        hits: [
          {
            beatOffset: scenario.generatedBeat,
            voice: scenario.generatedVoice,
            velocity: 0.7,
          },
        ],
      },
      percussion: [
        {
          trackId: 'authored-drums',
          gmKey: scenario.importedGmKey,
          startBeat: scenario.importedBeat,
          velocity: 100,
        },
      ],
    })

    expect(routed).toEqual(scenario.expected)
    await disposeBand(band)
  })

  it('holds a late fractional hit until the next humanized beat establishes true order', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const routed: string[] = []
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: (options) => ({
        setKit: vi.fn(),
        activate: vi.fn(() => true),
        trigger: vi.fn((hit: DrumKitTrigger) => {
          routed.push(
            `trigger:${options.role}:${hit.gmKey}:${(hit.atContextTime ?? 0).toFixed(3)}`,
          )
          return 'synth-fallback' as const
        }),
        choke: vi.fn((request: { gmKey: number; atContextTime?: number }) => {
          routed.push(
            `choke:${options.role}:${request.gmKey}:${(request.atContextTime ?? 0).toFixed(3)}`,
          )
          return 'idle' as const
        }),
        panic: vi.fn(),
        dispose: vi.fn(),
      }),
      readDrumSoundPreference: () => ({
        kitId: 'mercury-synth',
        feelId: 'rock',
      }),
      loadHumanizer: async () => ({
        humanizeDrumEvents: (events) =>
          events.map((event) => ({
            timeOffsetMs: -10,
            velocity: event.velocity,
            ornaments: [],
          })),
      }),
      scheduleAheadSeconds: 0.12,
      schedulerIntervalMs: 24,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 2,
      feel: 'groove',
      rhythmPreset: {
        id: 'cross-bucket-hat-order',
        label: 'Test',
        detail: 'Test',
        beatsPerPattern: 2,
        hits: [{ beatOffset: 1, voice: 'hh-closed', velocity: 0.7 }],
      },
      percussion: [
        {
          trackId: 'authored-drums',
          gmKey: 46,
          startBeat: 0.99,
          velocity: 100,
        },
      ],
    })

    expect(routed).toEqual([])
    await vi.advanceTimersByTimeAsync(500)
    expect(routed).toEqual([
      'choke:generated:46:5.580',
      'choke:authored:46:5.580',
      'trigger:generated:42:5.580',
      'trigger:authored:46:5.585',
    ])

    await disposeBand(band)
  })

  it('queues an authored choke release after intervening same-cymbal attacks', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const routed: string[] = []
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => ({
        setKit: vi.fn(),
        activate: vi.fn(() => true),
        trigger: vi.fn((hit: DrumKitTrigger) => {
          routed.push(
            `trigger:${hit.sourceId}:${(hit.atContextTime ?? 0).toFixed(3)}`,
          )
          return 'synth-fallback' as const
        }),
        choke: vi.fn(
          (request: { atContextTime?: number; sourceId?: string }) => {
            routed.push(
              `choke:${request.sourceId}:${(request.atContextTime ?? 0).toFixed(3)}`,
            )
            return 'choked' as const
          },
        ),
        panic: vi.fn(),
        dispose: vi.fn(),
      }),
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      exercisePulse: false,
      percussion: [
        {
          trackId: 'authored-drums',
          gmKey: 49,
          startBeat: 0,
          velocity: 110,
          sourceId: 'choked-crash',
          articulation: 'choke',
        },
        {
          trackId: 'authored-drums',
          gmKey: 49,
          startBeat: 0.1,
          velocity: 100,
          sourceId: 'later-crash',
        },
      ],
    })

    expect(routed).toEqual([
      'trigger:choked-crash:5.090',
      'trigger:later-crash:5.140',
      'choke:choked-crash:choke:5.200',
    ])
    await disposeBand(band)
  })

  it('anchors a live gain before destructive cancellation', () => {
    const parameter = fakeAudioParam()
    parameter.value = 0.43
    parameter.cancelScheduledValues.mockImplementation(() => {
      parameter.value = 0
    })

    setGuitarSessionGainTarget(parameter as unknown as AudioParam, 0.7, 5)

    expect(parameter.setValueAtTime).toHaveBeenCalledWith(0.43, 5)
    expect(parameter.setTargetAtTime).toHaveBeenCalledWith(0.7, 5, 0.012)
  })

  it('remembers master volume before audio activation and ramps later changes', async () => {
    const context = fakeAudioContext()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
    })

    band.setMasterLevel(0.42)
    const graph = await band.activate()
    expect(graph?.master.gain.value).toBeCloseTo(sliderToGain(0.42), 6)

    band.setMasterLevel(0.68)
    expect(graph?.master.gain.setTargetAtTime).toHaveBeenCalledWith(
      sliderToGain(0.68),
      expect.any(Number),
      0.012,
    )
    await disposeBand(band)
  })

  it('seeds amp state before activation and updates the existing shared stage', async () => {
    const gains: Array<
      ReturnType<typeof fakeAudioNode> & {
        gain: ReturnType<typeof fakeAudioParam>
      }
    > = []
    const context = fakeAudioContext(gains)
    const contextFactory = vi.fn(() => context)
    const band = createGuitarRoomBand({
      contextFactory,
      activateContext: async () => undefined,
    })
    const initial = {
      ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      drive: 0.22,
      presence: -0.2,
    }

    band.setElectricAmpParameters(initial)
    expect(contextFactory).not.toHaveBeenCalled()

    const graph = await band.activate()
    const nodeCount = gains.length
    expect(graph?.getElectricAmpParameters()).toEqual(initial)

    const edited = { ...initial, enabled: false, drive: 0.79 }
    band.setElectricAmpParameters(edited)
    expect(graph?.getElectricAmpParameters()).toEqual(edited)
    expect(gains).toHaveLength(nodeCount)
    await disposeBand(band)
  })

  it('keeps authored parts on independent live gain lanes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    guitarVoices.createGuitarVoice.mockImplementation(() => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    }))
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 2,
    })
    band.setMelodyChannelLevel('track-bass', 0)

    await band.start({
      tempoBpm: 90,
      countInBeats: 0,
      exerciseBeats: 2,
      durationBeats: 2,
      feel: 'click',
      melody: [
        {
          midi: 40,
          startBeat: 0,
          durationBeats: 1,
          channelId: 'track-bass',
          instrumentFamily: 'neutral',
        },
        {
          midi: 64,
          startBeat: 0,
          durationBeats: 1,
          channelId: 'track-guitar',
          instrumentFamily: 'neutral',
        },
      ],
    })

    const bassGate = guitarVoices.createGuitarVoice.mock.calls[0]?.[0]
    const guitarGate = guitarVoices.createGuitarVoice.mock.calls[1]?.[0]
    expect(bassGate).toBeDefined()
    expect(guitarGate).toBeDefined()

    band.setMelodyChannelLevel('track-bass', 0.5)
    const bassOutput = guitarVoices.createGuitarVoice.mock.results[0]?.value
      .gain.connect.mock.calls[0]?.[0] as GainNode | undefined
    const guitarOutput = guitarVoices.createGuitarVoice.mock.results[1]?.value
      .gain.connect.mock.calls[0]?.[0] as GainNode | undefined
    expect(bassOutput).not.toBe(guitarOutput)
    expect(bassOutput?.gain.value).toBe(0)
    expect(bassOutput?.gain.setTargetAtTime).toHaveBeenCalledWith(
      sliderToGain(0.5),
      5,
      0.012,
    )
    await disposeBand(band)
  })

  it('sums one guitar track before drive but isolates other tracks and neutral parts', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const voice = () => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    })
    guitarVoices.createGuitarVoice.mockImplementation(voice)
    guitarVoices.createBassVoice.mockImplementation(voice)
    const stages: GuitarElectricAmpStage[] = []
    const createElectricAmpStage = vi.fn(() => {
      const stage = fakeElectricAmpStage()
      stages.push(stage)
      return stage
    })
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createElectricAmpStage,
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 90,
      countInBeats: 0,
      exerciseBeats: 2,
      durationBeats: 2,
      feel: 'click',
      melody: [
        {
          midi: 64,
          startBeat: 0,
          durationBeats: 1,
          velocity: 40,
          channelId: 'first-guitar',
          instrumentFamily: 'electric-guitar',
        },
        {
          midi: 67,
          startBeat: 0.25,
          durationBeats: 1,
          velocity: 80,
          channelId: 'first-guitar',
          instrumentFamily: 'electric-guitar',
        },
        {
          midi: 40,
          startBeat: 0,
          durationBeats: 1,
          channelId: 'bass-track',
          instrumentFamily: 'bass',
        },
        {
          midi: 71,
          startBeat: 0,
          durationBeats: 1,
          velocity: 120,
          channelId: 'second-guitar',
          instrumentFamily: 'electric-guitar',
        },
        {
          midi: 76,
          startBeat: 0,
          durationBeats: 1,
          channelId: 'strings-track',
          instrumentFamily: 'neutral',
        },
      ],
    })

    expect(createElectricAmpStage).toHaveBeenCalledTimes(2)
    const guitarDestinations = guitarVoices.createGuitarVoice.mock.results.map(
      (result) => result.value.gain.connect.mock.calls[0]?.[0],
    )
    expect(guitarDestinations[0]).toBe(stages[0]?.input)
    expect(guitarDestinations[1]).toBe(stages[0]?.input)
    expect(guitarDestinations[2]).toBe(stages[1]?.input)
    expect(guitarDestinations[3]).not.toBe(stages[0]?.input)
    expect(guitarDestinations[3]).not.toBe(stages[1]?.input)
    expect(
      guitarVoices.createGuitarVoice.mock.calls.map((call) => [
        call[3],
        call[5],
      ]),
    ).toEqual([
      ['electric', 'shared'],
      ['electric', 'shared'],
      ['electric', 'shared'],
      ['acoustic', 'per-voice'],
    ])
    expect(guitarVoices.createBassVoice).toHaveBeenCalledOnce()

    const firstTrackFader = (
      stages[0]?.output.connect as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as
      | (ReturnType<typeof fakeAudioNode> & {
          gain: ReturnType<typeof fakeAudioParam>
        })
      | undefined
    const secondTrackFader = (
      stages[1]?.output.connect as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0]
    expect(firstTrackFader).toBeDefined()
    expect(secondTrackFader).toBeDefined()
    expect(firstTrackFader).not.toBe(secondTrackFader)

    band.setMelodyChannelLevel('first-guitar', 0.5)
    expect(firstTrackFader?.gain.setTargetAtTime).toHaveBeenCalledWith(
      sliderToGain(0.5),
      5,
      0.012,
    )

    const edited = {
      ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      drive: 0.81,
    }
    band.setElectricAmpParameters(edited)
    for (const stage of stages) {
      expect(stage.setParameters).toHaveBeenCalledWith(edited, 5)
    }

    const firstVoiceGain =
      guitarVoices.createGuitarVoice.mock.results[0]?.value.gain.gain
    const secondVoiceGain =
      guitarVoices.createGuitarVoice.mock.results[1]?.value.gain.gain
    const thirdVoiceGain =
      guitarVoices.createGuitarVoice.mock.results[2]?.value.gain.gain
    expect(firstVoiceGain?.setValueAtTime).toHaveBeenCalledWith(
      guitarRoomBandVelocityGain(40),
      5.09,
    )
    expect(secondVoiceGain?.setValueAtTime).toHaveBeenCalledWith(
      guitarRoomBandVelocityGain(80),
      5.256666666666667,
    )
    expect(thirdVoiceGain?.setValueAtTime).toHaveBeenCalledWith(
      guitarRoomBandVelocityGain(120),
      5.09,
    )
    await disposeBand(band)
    for (const stage of stages) expect(stage.dispose).toHaveBeenCalledOnce()
  })

  it('keeps a direct melody fader behind every pre-run and live gate', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    guitarVoices.createGuitarVoice.mockImplementation(() => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    }))
    const stage = fakeElectricAmpStage()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createElectricAmpStage: () => stage,
      scheduleAheadSeconds: 2,
    })
    band.setMelodyChannelGain?.('track-guitar', 1.8)
    band.setMelodyChannelAudible?.('track-guitar', false)

    await band.start({
      tempoBpm: 90,
      countInBeats: 0,
      exerciseBeats: 2,
      durationBeats: 2,
      feel: 'click',
      melody: [
        {
          midi: 64,
          startBeat: 0,
          durationBeats: 1,
          channelId: 'track-guitar',
          instrumentFamily: 'electric-guitar',
        },
      ],
    })

    const trackFader = (stage.output.connect as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as GainNode | undefined
    expect(trackFader?.gain.value).toBe(0)

    band.setMelodyChannelAudible?.('track-guitar', true)
    expect(trackFader?.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      1.8,
      5,
      0.012,
    )
    band.setMelodyChannelAudible?.('track-guitar', false)
    band.setMelodyChannelGain?.('track-guitar', 1.4)
    expect(trackFader?.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      5,
      0.012,
    )
    band.setMelodyChannelAudible?.('track-guitar', true)
    expect(trackFader?.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      1.4,
      5,
      0.012,
    )
    await disposeBand(band)
  })

  it('constructs no kit player before Play or for a click-only run', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const createPercussionPlayer = vi.fn(() => kitPlayer)
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer,
      scheduleAheadSeconds: 1,
    })

    expect(createPercussionPlayer).not.toHaveBeenCalled()
    await band.activate()
    expect(createPercussionPlayer).not.toHaveBeenCalled()

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'click',
    })
    expect(createPercussionPlayer).not.toHaveBeenCalled()

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'click',
      percussion: [
        { trackId: 'track-drums', gmKey: 36, startBeat: 0, velocity: 100 },
      ],
    })
    expect(createPercussionPlayer).toHaveBeenCalledOnce()
    expect(kitPlayer.activate).toHaveBeenCalledOnce()

    await disposeBand(band)
  })

  it('pins the Guitar-specific kit and lazily loads feel only for an audible generated groove', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const createPercussionPlayer = vi.fn(() => kitPlayer)
    const readDrumSoundPreference = vi.fn(() => ({
      kitId: 'studio' as const,
      feelId: 'funk' as const,
    }))
    const humanizeDrumEvents = vi.fn((events: readonly HumanizeInputEvent[]) =>
      events.map((event) => ({
        timeOffsetMs: 7,
        velocity: event.velocity,
        ornaments: [],
      })),
    )
    const loadHumanizer = vi.fn(async () => ({ humanizeDrumEvents }))
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer,
      readDrumSoundPreference,
      loadHumanizer,
      scheduleAheadSeconds: 1,
    })

    await band.activate()
    expect(createPercussionPlayer).not.toHaveBeenCalled()
    expect(loadHumanizer).not.toHaveBeenCalled()

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'click',
    })
    expect(createPercussionPlayer).not.toHaveBeenCalled()
    expect(loadHumanizer).not.toHaveBeenCalled()

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'groove',
      exercisePulse: false,
    })
    expect(createPercussionPlayer).not.toHaveBeenCalled()
    expect(loadHumanizer).not.toHaveBeenCalled()

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'groove',
    })

    expect(createPercussionPlayer).toHaveBeenCalledOnce()
    expect(createPercussionPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ kitId: 'studio', role: 'generated' }),
    )
    expect(kitPlayer.activate).toHaveBeenCalledOnce()
    expect(loadHumanizer).toHaveBeenCalledOnce()
    expect(humanizeDrumEvents).toHaveBeenCalled()
    expect(readDrumSoundPreference).toHaveBeenCalledTimes(3)

    await disposeBand(band)
  })

  it('refuses to start when the generated groove player cannot activate', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(async () => false),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => kitPlayer,
      scheduleAheadSeconds: 1,
    })

    await expect(
      band.start({
        tempoBpm: 120,
        countInBeats: 0,
        exerciseBeats: 1,
        feel: 'groove',
      }),
    ).rejects.toThrow('selected drum player could not activate')

    expect(kitPlayer.trigger).not.toHaveBeenCalled()
    expect(kitPlayer.panic).toHaveBeenCalledOnce()

    await disposeBand(band)
  })

  it('humanizes only generated hits while reference and authored clocks remain exact', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const generatedPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn((_hit: DrumKitTrigger) => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const authoredPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const humanizeDrumEvents = vi.fn((events: readonly HumanizeInputEvent[]) =>
      events.map((event) => ({
        timeOffsetMs: 17,
        velocity: Math.min(127, event.velocity + 3),
        ornaments: [],
      })),
    )
    const onExerciseBeatScheduled = vi.fn()
    const onBeat = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: (options) =>
        options.role === 'generated' ? generatedPlayer : authoredPlayer,
      readDrumSoundPreference: () => ({
        kitId: 'circuit',
        feelId: 'funk',
      }),
      loadHumanizer: async () => ({ humanizeDrumEvents }),
      scheduleAheadSeconds: 1,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'groove',
      rhythmPreset: resolveGuitarRoomRhythmPreset('first-win-rock'),
      percussion: [
        {
          trackId: 'authored-drums',
          gmKey: 38,
          startBeat: 0.25,
          velocity: 91,
          sourceId: 'gpx-drum-1',
        },
      ],
      onExerciseBeatScheduled,
      onBeat,
    })

    expect(authoredPlayer.trigger).toHaveBeenCalledWith({
      gmKey: 38,
      velocity: 91,
      atContextTime: 5.215,
      sourceId: 'gpx-drum-1',
      lane: 'authored',
    })
    expect(generatedPlayer.trigger).toHaveBeenCalled()
    expect(
      generatedPlayer.trigger.mock.calls[0]?.[0].atContextTime,
    ).toBeCloseTo(5.107, 6)
    expect(humanizeDrumEvents).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        style: 'funk',
        intensity: 0.6,
        locked: true,
        tempoBpm: 120,
        seed: expect.any(Number),
      }),
    )
    expect(onExerciseBeatScheduled).toHaveBeenCalledWith(
      expect.objectContaining({ beatIndex: 0, scheduledAtSeconds: 5.09 }),
    )

    await vi.advanceTimersByTimeAsync(100)
    expect(onBeat).toHaveBeenCalledWith(0, 'exercise', 5.09)

    await disposeBand(band)
  })

  it('repeats one pinned generated pocket across a 15-beat loop without moving reference beats', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const generatedPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn((_hit: DrumKitTrigger) => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const humanizeDrumEvents = vi.fn((events: readonly HumanizeInputEvent[]) =>
      events.map((event) => ({
        timeOffsetMs: 11 + event.step / 10,
        velocity: Math.min(127, event.velocity + event.step),
        ornaments: [],
      })),
    )
    const onExerciseBeatScheduled = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => generatedPlayer,
      readDrumSoundPreference: () => ({
        kitId: 'mercury-synth',
        feelId: 'rock',
      }),
      loadHumanizer: async () => ({ humanizeDrumEvents }),
      scheduleAheadSeconds: 8,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 15,
      loop: { start: 0, end: 15 },
      feel: 'groove',
      rhythmPreset: resolveGuitarRoomRhythmPreset('first-win-rock'),
      onExerciseBeatScheduled,
    })

    const firstLapHit = generatedPlayer.trigger.mock.calls.find(
      ([hit]) => hit.sourceId === 'guitar-generated:first-win-rock:0:0:0',
    )?.[0]
    const secondLapHit = generatedPlayer.trigger.mock.calls.find(
      ([hit]) => hit.sourceId === 'guitar-generated:first-win-rock:1:0:0',
    )?.[0]
    expect(firstLapHit).toBeDefined()
    expect(secondLapHit).toBeDefined()
    expect(secondLapHit?.velocity).toBe(firstLapHit?.velocity)
    expect(
      (secondLapHit?.atContextTime ?? 0) - (firstLapHit?.atContextTime ?? 0),
    ).toBeCloseTo(7.5, 6)
    expect(humanizeDrumEvents).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ locked: true }),
    )

    const referenceDownbeats = onExerciseBeatScheduled.mock.calls
      .map(([beat]) => beat)
      .filter((beat) => beat.beatIndex === 0)
      .slice(0, 2)
    expect(referenceDownbeats).toEqual([
      expect.objectContaining({
        beatIndex: 0,
        iteration: 0,
        scheduledAtSeconds: 5.09,
      }),
      expect.objectContaining({
        beatIndex: 0,
        iteration: 1,
        scheduledAtSeconds: 12.59,
      }),
    ])

    await disposeBand(band)
  })

  it('refuses to start when an authored drum player cannot activate', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(async () => false),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => kitPlayer,
      scheduleAheadSeconds: 1,
    })

    await expect(
      band.start({
        tempoBpm: 120,
        countInBeats: 0,
        exerciseBeats: 1,
        feel: 'click',
        percussion: [
          { trackId: 'track-drums', gmKey: 36, startBeat: 0, velocity: 100 },
        ],
      }),
    ).rejects.toThrow('selected drum player could not activate')

    expect(kitPlayer.trigger).not.toHaveBeenCalled()
    expect(kitPlayer.panic).toHaveBeenCalledOnce()

    await disposeBand(band)
  })

  it('schedules a semantic beat including fractional hits on the shared clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn((_hit: DrumKitTrigger) => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => kitPlayer,
      scheduleAheadSeconds: 1,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      feel: 'groove',
      rhythmPreset: resolveGuitarRoomRhythmPreset('first-win-rock'),
    })

    expect(
      kitPlayer.trigger.mock.calls.map(([hit]) => [
        hit.gmKey,
        hit.atContextTime,
      ]),
    ).toEqual([
      [36, 5.09],
      [42, 5.09],
      [42, 5.34],
    ])
    expect(drumVoices.triggerDrumVoice).not.toHaveBeenCalled()

    await disposeBand(band)
  })

  it('changes a rhythm only on a gapless loop boundary', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    const onRhythmPreset = vi.fn()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn((_hit: DrumKitTrigger) => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const rhythmPresetForIteration = vi.fn((iteration: number) =>
      resolveGuitarRoomRhythmPreset(
        iteration % 2 === 0 ? 'first-win-rock' : 'first-win-pocket',
      ),
    )
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => kitPlayer,
      scheduleAheadSeconds: 0.12,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 4,
      loop: { start: 0, end: 4 },
      feel: 'groove',
      rhythmPresetForIteration,
      onBeat,
      onRhythmPreset,
    })
    await vi.advanceTimersByTimeAsync(1_600)
    expect(rhythmPresetForIteration).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(580)

    expect(rhythmPresetForIteration).toHaveBeenNthCalledWith(1, 0, null)
    expect(rhythmPresetForIteration.mock.calls[1]?.[0]).toBe(1)
    expect(
      onRhythmPreset.mock.calls
        .slice(0, 2)
        .map((call) => [call[0].id, call[1], call[2]]),
    ).toEqual([
      ['first-win-rock', 0, 5.09],
      ['first-win-pocket', 1, 7.09],
    ])
    expect(onBeat.mock.calls.slice(0, 5).map((call) => call[0])).toEqual([
      0, 1, 2, 3, 0,
    ])
    expect(onBeat.mock.calls.slice(0, 5).map((call) => call[2])).toEqual([
      5.09, 5.59, 6.09, 6.59, 7.09,
    ])

    await disposeBand(band)
  })

  it('keeps 220 BPM and reports the authoritative audio time for each beat', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat =
      vi.fn<
        (
          beatIndex: number,
          phase: GuitarRoomBandBeatPhase,
          scheduledAtSeconds?: number,
        ) => void
      >()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 220,
      countInBeats: 0,
      exerciseBeats: 2,
      feel: 'click',
      onBeat,
    })
    await vi.advanceTimersByTimeAsync(450)

    expect(onBeat).toHaveBeenCalledTimes(2)
    const firstAt = onBeat.mock.calls[0]?.[2]
    const secondAt = onBeat.mock.calls[1]?.[2]
    expect(firstAt).toBeCloseTo(5.09, 6)
    expect(secondAt).toBeCloseTo(5.09 + 60 / 220, 6)

    await disposeBand(band)
  })

  it('schedules every beat through an authored tempo map', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      feel: 'click',
      onBeat,
    })
    await vi.advanceTimersByTimeAsync(3200)

    expect(onBeat.mock.calls.map((call) => call[2])).toEqual([
      5.09, 5.59, 6.09, 7.09,
    ])
    expect(result.expectedHitTimesMs).toEqual([90, 590, 1090, 2090])

    await disposeBand(band)
  })

  it('repeats fractional drums through the tempo map with authored velocity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(
        (_hit: {
          gmKey: number
          velocity: number
          atContextTime?: number
          sourceId?: string
        }) => 'synth-fallback' as const,
      ),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => kitPlayer,
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      startBeat: 1,
      loop: { start: 1, end: 3 },
      feel: 'click',
      exercisePulse: false,
      percussion: [
        {
          trackId: 'track-drums',
          gmKey: 36,
          startBeat: 1.25,
          velocity: 127,
          sourceId: 'midi-t2-e7',
        },
        {
          trackId: 'track-drums',
          gmKey: 54,
          startBeat: 1.5,
          velocity: 100,
          sourceId: 'midi-t2-e8',
        },
        {
          trackId: 'track-drums',
          gmKey: 40,
          startBeat: 2.5,
          velocity: 64,
          sourceId: 'midi-t2-e9',
        },
      ],
    })

    const scheduled = kitPlayer.trigger.mock.calls
      .slice(0, 6)
      .map((call) => call[0])
    expect(scheduled).toEqual([
      {
        gmKey: 36,
        velocity: 127,
        atContextTime: 5.215,
        sourceId: 'midi-t2-e7',
        lane: 'authored',
      },
      {
        gmKey: 54,
        velocity: 100,
        atContextTime: 5.34,
        sourceId: 'midi-t2-e8',
        lane: 'authored',
      },
      {
        gmKey: 40,
        velocity: 64,
        atContextTime: 6.09,
        sourceId: 'midi-t2-e9',
        lane: 'authored',
      },
      {
        gmKey: 36,
        velocity: 127,
        atContextTime: 6.715,
        sourceId: 'midi-t2-e7',
        lane: 'authored',
      },
      {
        gmKey: 54,
        velocity: 100,
        atContextTime: 6.84,
        sourceId: 'midi-t2-e8',
        lane: 'authored',
      },
      {
        gmKey: 40,
        velocity: 64,
        atContextTime: 7.59,
        sourceId: 'midi-t2-e9',
        lane: 'authored',
      },
    ])
    expect(kitPlayer.activate).toHaveBeenCalledOnce()
    expect(drumVoices.triggerDrumVoice).not.toHaveBeenCalled()

    await disposeBand(band)
  })

  it('opens and closes a muted drum track on the current run without restarting its clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const gains: Array<
      ReturnType<typeof fakeAudioNode> & {
        gain: ReturnType<typeof fakeAudioParam>
      }
    > = []
    const context = fakeAudioContext(gains)
    const playerOutput: { current: (() => AudioNode | null) | null } = {
      current: null,
    }
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(
        (_hit: {
          gmKey: number
          velocity: number
          atContextTime?: number
          sourceId?: string
        }) => 'synth-fallback' as const,
      ),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: (options) => {
        playerOutput.current = options.getOutput
        return kitPlayer
      },
      scheduleAheadSeconds: 4,
    })
    band.setPercussionTrackGain?.('track-drums', 1.8)

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 4,
      exercisePulse: false,
      audiblePercussionTrackIds: [],
      percussion: [
        { trackId: 'track-drums', gmKey: 36, startBeat: 1.5, velocity: 96 },
      ],
    })

    const trackGate = playerOutput.current?.() as unknown as ReturnType<
      typeof fakeAudioNode
    > & { gain: ReturnType<typeof fakeAudioParam> }
    expect(trackGate?.gain.value).toBe(0)
    expect(kitPlayer.trigger).toHaveBeenCalledWith({
      gmKey: 36,
      velocity: 96,
      atContextTime: 5.84,
      lane: 'authored',
    })

    band.setPercussionTrackAudible('track-drums', true)
    band.setPercussionTrackAudible('track-drums', false)
    expect(trackGate?.gain.setTargetAtTime.mock.calls).toEqual([
      [1.8, 5, 0.012],
      [0, 5, 0.012],
    ])

    band.setPercussionTrackGain?.('track-drums', 1.4)
    expect(trackGate?.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      5,
      0.012,
    )
    band.setPercussionTrackAudible('track-drums', true)
    expect(trackGate?.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      1.4,
      5,
      0.012,
    )

    await disposeBand(band)
  })

  it('reuses and reconnects a stable kit output across percussion runs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const gains: Array<
      ReturnType<typeof fakeAudioNode> & {
        gain: ReturnType<typeof fakeAudioParam>
      }
    > = []
    const context = fakeAudioContext(gains)
    const playerOutputs: Array<() => AudioNode | null> = []
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const createPercussionPlayer = vi.fn((options) => {
      playerOutputs.push(options.getOutput)
      return kitPlayer
    })
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer,
      scheduleAheadSeconds: 4,
    })
    const run = {
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      exercisePulse: false,
      percussion: [
        { trackId: 'track-drums', gmKey: 36, startBeat: 0, velocity: 96 },
      ],
    } as const

    await band.start(run)
    const stableOutput = playerOutputs[0]?.() as unknown as ReturnType<
      typeof fakeAudioNode
    > & { gain: ReturnType<typeof fakeAudioParam> }
    await band.start(run)

    expect(createPercussionPlayer).toHaveBeenCalledOnce()
    expect(playerOutputs[0]?.()).toBe(stableOutput)
    expect(stableOutput.connect).toHaveBeenCalledTimes(2)
    expect(stableOutput.disconnect).not.toHaveBeenCalled()
    expect(kitPlayer.activate).toHaveBeenCalledTimes(2)
    expect(kitPlayer.trigger).toHaveBeenCalledTimes(2)
    expect(kitPlayer.dispose).not.toHaveBeenCalled()

    const firstRunOutput = stableOutput.connect.mock.calls[0]?.[0]
    const secondRunOutput = stableOutput.connect.mock.calls[1]?.[0]
    expect(firstRunOutput).not.toBe(secondRunOutput)
    await vi.advanceTimersByTimeAsync(80)
    expect(stableOutput.disconnect).toHaveBeenCalledOnce()
    expect(stableOutput.disconnect).toHaveBeenCalledWith(firstRunOutput)

    await disposeBand(band)
  })

  it('remembers a pre-run kit and switches retained players live and paused', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn(() => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    const createPercussionPlayer = vi.fn(() => kitPlayer)
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer,
      readDrumSoundPreference: () => ({
        kitId: 'mercury-synth',
        feelId: 'straight',
      }),
      scheduleAheadSeconds: 1,
    })
    const run = {
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 1,
      exercisePulse: false,
      percussion: [
        { trackId: 'track-drums', gmKey: 36, startBeat: 0, velocity: 96 },
      ],
    } as const

    band.setDrumKit?.('studio')
    expect(createPercussionPlayer).not.toHaveBeenCalled()
    await band.start(run)
    expect(createPercussionPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ kitId: 'studio' }),
    )

    const panicBeforeLiveSwitch = kitPlayer.panic.mock.calls.length
    band.setDrumKit?.('circuit')
    expect(kitPlayer.setKit).toHaveBeenLastCalledWith('circuit')
    expect(kitPlayer.panic).toHaveBeenCalledTimes(panicBeforeLiveSwitch)
    expect(createPercussionPlayer).toHaveBeenCalledOnce()

    band.stop()
    const panicAfterPause = kitPlayer.panic.mock.calls.length
    band.setDrumKit?.('live')
    expect(kitPlayer.setKit).toHaveBeenLastCalledWith('live')
    expect(kitPlayer.panic).toHaveBeenCalledTimes(panicAfterPause)
    expect(kitPlayer.dispose).not.toHaveBeenCalled()

    await band.start(run)
    expect(createPercussionPlayer).toHaveBeenCalledOnce()
    expect(kitPlayer.activate).toHaveBeenCalledTimes(2)
    await disposeBand(band)
  })

  it('starts from a parked authored beat without replaying the score prefix', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    const onComplete = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      durationBeats: 4,
      startBeat: 2,
      feel: 'click',
      onBeat,
      onComplete,
    })
    await vi.advanceTimersByTimeAsync(2_150)

    expect(onBeat.mock.calls.map((call) => call[0])).toEqual([2, 3])
    expect(onBeat.mock.calls.map((call) => call[2])).toEqual([5.09, 6.09])
    expect(result.expectedHitTimesMs).toEqual([90, 1090])
    expect(onComplete).toHaveBeenCalledOnce()

    await disposeBand(band)
  })

  it('reports the exact scheduled score start and fractional end', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onExerciseStart = vi.fn()
    const onBeat = vi.fn()
    const onComplete = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      countInBeats: 2,
      exerciseBeats: 12,
      startBeat: 1,
      durationBeats: 3.5,
      feel: 'click',
      onBeat,
      onExerciseStart,
      onComplete,
    })

    expect(result.exerciseStartedAtSeconds).toBeCloseTo(6.09, 6)
    expect(result.completedAtSeconds).toBeCloseTo(7.34, 6)
    await vi.advanceTimersByTimeAsync(2_400)
    expect(onExerciseStart).toHaveBeenCalledWith(1, 6.09)
    expect(onBeat.mock.calls.map((call) => call[0])).toEqual([0, 1, 1, 2, 3])
    expect(onComplete).toHaveBeenCalledWith(7.34)

    await disposeBand(band)
  })

  it('keeps the count-in audible while a silent exercise pulse advances callbacks', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      countInBeats: 2,
      exerciseBeats: 2,
      durationBeats: 2,
      feel: 'click',
      exercisePulse: false,
      onBeat,
    })

    expect(drumVoices.triggerDrumVoice).toHaveBeenCalledTimes(2)
    expect(
      drumVoices.triggerDrumVoice.mock.calls.map((call) => call[0]),
    ).toEqual(['sidestick', 'sidestick'])
    expect(result.exerciseStartedAtSeconds).toBeCloseTo(6.09, 6)
    expect(result.completedAtSeconds).toBeCloseTo(7.09, 6)

    await vi.advanceTimersByTimeAsync(1_700)
    expect(onBeat.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      [0, 'count-in'],
      [1, 'count-in'],
      [0, 'exercise'],
      [1, 'exercise'],
    ])

    await disposeBand(band)
  })

  it('reads a pulse function on every beat, so it can be quieted mid-run', async () => {
    // The reason the option accepts a function at all: a reader reaching for
    // the click while it is ticking is the only moment anybody reaches for it,
    // and Web Audio cannot unschedule what the lookahead already committed.
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    let pulseReads = 0
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 2,
      exerciseBeats: 4,
      durationBeats: 4,
      feel: 'click',
      exercisePulse: () => {
        pulseReads += 1
        return pulseReads % 2 === 1
      },
    })

    await vi.advanceTimersByTimeAsync(2_400)
    // Once per exercise beat, not once for the run.
    expect(pulseReads).toBe(4)
    // Two count-in ticks, then only the beats the function let through.
    expect(drumVoices.triggerDrumVoice).toHaveBeenCalledTimes(4)

    await disposeBand(band)
  })

  it('starts between mapped beats without replaying past attacks', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onExerciseStart = vi.fn()
    const onBeat = vi.fn()
    const onComplete = vi.fn()
    const kitPlayer = {
      setKit: vi.fn(),
      activate: vi.fn(() => true),
      trigger: vi.fn((_hit: DrumKitTrigger) => 'synth-fallback' as const),
      panic: vi.fn(),
      dispose: vi.fn(),
    }
    guitarVoices.createGuitarVoice.mockImplementation(() => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    }))
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      createPercussionPlayer: () => kitPlayer,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      durationBeats: 4,
      startBeat: 2.4,
      feel: 'click',
      exercisePulse: false,
      melody: [
        { midi: 63, startBeat: 2.25, durationBeats: 0.25 },
        { midi: 64, startBeat: 2.4, durationBeats: 0.25 },
        { midi: 65, startBeat: 2.75, durationBeats: 0.25 },
        { midi: 67, startBeat: 3, durationBeats: 0.5 },
      ],
      percussion: [
        { trackId: 'track-drums', gmKey: 36, startBeat: 2.25, velocity: 127 },
        { trackId: 'track-drums', gmKey: 38, startBeat: 2.4, velocity: 64 },
        { trackId: 'track-drums', gmKey: 49, startBeat: 2.75, velocity: 32 },
      ],
      onExerciseStart,
      onBeat,
      onComplete,
    })

    await vi.advanceTimersByTimeAsync(80)
    expect(onExerciseStart).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20)
    expect(onExerciseStart).toHaveBeenCalledWith(2.4, 5.09)
    expect(result.expectedHitTimesMs).toHaveLength(1)
    expect(result.expectedHitTimesMs[0]).toBeCloseTo(690, 6)
    const voiceStarts = guitarVoices.createGuitarVoice.mock.calls.map(
      (call) => call[4],
    )
    expect(voiceStarts).toHaveLength(3)
    expect(voiceStarts[0]).toBeCloseTo(5.09, 6)
    expect(voiceStarts[1]).toBeCloseTo(5.44, 6)
    expect(voiceStarts[2]).toBeCloseTo(5.69, 6)
    const drumStarts = kitPlayer.trigger.mock.calls.map(([hit]) => hit)
    expect(drumStarts.map((hit) => [hit.gmKey, hit.velocity])).toEqual([
      [38, 64],
      [49, 32],
    ])
    expect(drumStarts[0]?.atContextTime).toBeCloseTo(5.09, 6)
    expect(drumStarts[1]?.atContextTime).toBeCloseTo(5.44, 6)

    await vi.advanceTimersByTimeAsync(600)
    expect(onBeat).toHaveBeenCalledWith(3, 'exercise', expect.any(Number))
    expect(onBeat.mock.calls[0]?.[2]).toBeCloseTo(5.69, 6)
    expect(onComplete).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onComplete).toHaveBeenCalledOnce()

    await disposeBand(band)
  })

  it('repeats mapped beat and note durations through a tempo-changing loop', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    guitarVoices.createGuitarVoice.mockImplementation(() => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    }))
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      loop: { start: 1, end: 3 },
      feel: 'click',
      melody: [
        { midi: 64, startBeat: 1, durationBeats: 1 },
        { midi: 65, startBeat: 2, durationBeats: 1 },
      ],
      onBeat,
    })
    await vi.advanceTimersByTimeAsync(3700)

    expect(onBeat.mock.calls.slice(0, 6).map((call) => call[0])).toEqual([
      0, 1, 2, 1, 2, 1,
    ])
    expect(onBeat.mock.calls.slice(0, 6).map((call) => call[2])).toEqual([
      5.09, 5.59, 6.09, 7.09, 7.59, 8.59,
    ])
    expect(
      guitarVoices.createGuitarVoice.mock.calls
        .slice(0, 4)
        .map((call) => [call[2], call[4]]),
    ).toEqual([
      [500, 5.59],
      [1000, 6.09],
      [500, 7.09],
      [1000, 7.59],
    ])

    await disposeBand(band)
  })

  it("completes once at the score's exact fractional duration", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onComplete = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 4,
      durationBeats: 3.25,
      feel: 'click',
      onComplete,
    })
    await vi.advanceTimersByTimeAsync(1700)
    expect(onComplete).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20)
    expect(onComplete).toHaveBeenCalledOnce()

    await disposeBand(band)
  })

  it('silences already scheduled guide and drum audio when stopped', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const gains: Array<
      ReturnType<typeof fakeAudioNode> & {
        gain: ReturnType<typeof fakeAudioParam>
      }
    > = []
    const context = fakeAudioContext(gains)
    const voiceGain = { ...fakeAudioNode(), gain: fakeAudioParam() }
    guitarVoices.createGuitarVoice.mockReturnValue({
      gain: voiceGain,
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    })
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 60,
      countInBeats: 0,
      exerciseBeats: 8,
      durationBeats: 8,
      feel: 'click',
      melody: [
        {
          midi: 64,
          startBeat: 0,
          durationBeats: 8,
          instrumentFamily: 'neutral',
        },
      ],
    })
    const guideGate = gains.at(-4)
    const drumsGate = gains.at(-2)
    const scoreGate = gains.at(-1)
    expect(guideGate).toBeDefined()
    expect(drumsGate).toBeDefined()
    expect(scoreGate).toBeDefined()
    expect(voiceGain.connect).toHaveBeenCalledWith(scoreGate)
    expect(scoreGate?.connect).toHaveBeenCalledWith(guideGate)

    band.stop()

    expect(guideGate?.gain.setValueAtTime).toHaveBeenCalledWith(1, 5)
    expect(drumsGate?.gain.setValueAtTime).toHaveBeenCalledWith(1, 5)
    expect(guideGate?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 5, 0.012)
    expect(drumsGate?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 5, 0.012)
    expect(scoreGate?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 5, 0.012)
    expect(guideGate?.disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(80)
    expect(guideGate?.disconnect).toHaveBeenCalledOnce()
    expect(drumsGate?.disconnect).toHaveBeenCalledOnce()
    expect(scoreGate?.disconnect).toHaveBeenCalledOnce()
    await disposeBand(band)
  })

  it('keeps the owned graph alive through the final release tail', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 60,
      countInBeats: 0,
      exerciseBeats: 8,
      durationBeats: 8,
      feel: 'click',
    })
    const pending = band.dispose()

    expect(context.close).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(79)
    expect(context.close).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(context.close).toHaveBeenCalledOnce()
  })
})
