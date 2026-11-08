// Studio inputs view model tests — each input once, with its kind, its warning, its channels by id or name, its round trip, its rows (the default named for what it takes, each input, each aligned pair) and the lanes on each; nothing listed before the browser names its inputs; the signal named by the loudest input.
import { describe, expect, it } from 'vitest'
import { audioInput } from '@/lib/audio-input/fake-devices.fixture'
import type { InputChannelCount, StudioLaneInput, } from '@/lib/studio/record/lane-inputs'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import type { StudioInputsModelInput } from './inputs-view-model'
import { studioInputsModel, studioLatencyWords, studioSignalOn, } from './inputs-view-model'

const listed = [
  audioInput('default', 'Default - MacBook Pro Microphone', 'built-in'),
  audioInput('built-in', 'MacBook Pro Microphone', 'built-in'),
  audioInput('scarlett', 'Scarlett 2i2 USB'),
  audioInput('airpods', 'AirPods Pro (Bluetooth)'),
  audioInput('blackhole', 'BlackHole 2ch'),
]

const own = (
  deviceId: string,
  label: string,
  channel: number | null = null,
  pair = false,
): StudioLaneInput => ({ deviceId, label, channel, pair })

function model(over: Partial<StudioInputsModelInput> = {}) {
  return studioInputsModel({
    devices: listed,
    studioDeviceId: null,
    lanes: [],
    counts: [],
    latencyMs: () => 0,
    ...over,
  })
}

const device = (
  result: ReturnType<typeof model>,
  deviceId: string,
): ReturnType<typeof model>['devices'][number] =>
  result.devices.find((each) => each.deviceId === deviceId)!

describe('studioInputsModel', () => {
  it('lists each input once, by its kind, with what to know about Bluetooth and a loopback', () => {
    const result = model()

    expect(
      result.devices.map(({ deviceId, kindLabel, isDefault, warning }) => ({
        deviceId,
        kindLabel,
        isDefault,
        warned: warning !== null,
      })),
    ).toEqual([
      {
        deviceId: 'built-in',
        kindLabel: 'Built-in',
        isDefault: true,
        warned: false,
      },
      {
        deviceId: 'scarlett',
        kindLabel: 'USB',
        isDefault: false,
        warned: false,
      },
      {
        deviceId: 'airpods',
        kindLabel: 'Bluetooth',
        isDefault: false,
        warned: true,
      },
      {
        deviceId: 'blackhole',
        kindLabel: 'Loopback',
        isDefault: false,
        warned: true,
      },
    ])
    expect(device(result, 'airpods').warning).toMatch(/adds delay/)
    expect(device(result, 'blackhole').warning).toBe(
      'Records what this computer plays, not a microphone.',
    )
    // A check or the latency check opens the default as a lane following it does.
    expect(device(result, 'built-in').openId).toBeNull()
    expect(device(result, 'scarlett').openId).toBe('scarlett')
  })

  it('lists nothing before the browser names its inputs', () => {
    expect(
      model({
        devices: [audioInput('default', ''), audioInput('a1b2', '')],
      }),
    ).toEqual({ named: false, devices: [] })
  })

  it("finds an input's channels by its id, then its name, and the default's by Chromium's own id", () => {
    const counts: InputChannelCount[] = [
      { deviceId: 'old-id', label: 'Scarlett 2i2 USB', channels: 2 },
      { deviceId: 'default', label: 'Fake Default Audio Input', channels: 1 },
      { deviceId: 'blackhole', label: null, channels: 16 },
    ]
    const result = model({ counts })

    expect(device(result, 'scarlett').channels).toBe(2)
    expect(device(result, 'built-in').channels).toBe(1)
    expect(device(result, 'blackhole').channels).toBe(16)
    expect(device(result, 'airpods').channels).toBeNull()
    expect(device(result, 'airpods').rows).toEqual([])
  })

  it('gives an input the default named for what it takes, then each input and each aligned pair', () => {
    const result = model({
      counts: [{ deviceId: 'scarlett', label: null, channels: 2 }],
    })

    expect(device(result, 'scarlett').rows.map((row) => row.label)).toEqual([
      'Default: Inputs 1 + 2',
      'Input 1',
      'Input 2',
      'Inputs 1 + 2',
    ])
  })

  it('puts each lane under the input it would record from, on the row of what it takes', () => {
    const result = model({
      studioDeviceId: null,
      counts: [
        { deviceId: 'scarlett', label: null, channels: 2 },
        { deviceId: 'built-in', label: null, channels: 1 },
      ],
      lanes: [
        {
          id: 'a',
          name: 'Guitar',
          input: own('scarlett', 'Scarlett 2i2 USB', 1),
        },
        {
          id: 'b',
          name: 'Keys',
          input: own('scarlett', 'Scarlett 2i2 USB', 0, true),
        },
        { id: 'c', name: 'Vocal', input: FOLLOW_STUDIO_INPUT },
        // Its own input is gone: it records the Studio's, the default here.
        { id: 'd', name: 'Old', input: own('gone', 'Old interface', 1) },
        // A pick past the count records the default.
        { id: 'e', name: 'Far', input: own('scarlett', 'Scarlett 2i2 USB', 4) },
      ],
    })
    const scarlett = device(result, 'scarlett')
    const builtIn = device(result, 'built-in')

    expect(scarlett.lanes).toEqual(['Guitar', 'Keys', 'Far'])
    expect(
      Object.fromEntries(scarlett.rows.map((row) => [row.label, row.lanes])),
    ).toEqual({
      'Default: Inputs 1 + 2': ['Far'],
      'Input 1': [],
      'Input 2': ['Guitar'],
      'Inputs 1 + 2': ['Keys'],
    })
    expect(builtIn.lanes).toEqual(['Vocal', 'Old'])
    expect(builtIn.rows[0]).toEqual({
      pick: null,
      label: 'Default: Input 1',
      lanes: ['Vocal', 'Old'],
    })
  })

  it("puts a lane that follows the Studio's input under that input", () => {
    const result = model({
      studioDeviceId: 'scarlett',
      lanes: [{ id: 'c', name: 'Vocal', input: FOLLOW_STUDIO_INPUT }],
    })

    expect(device(result, 'scarlett').lanes).toEqual(['Vocal'])
    expect(device(result, 'built-in').lanes).toEqual([])
  })

  it("gives each input its measured round trip, the default's by the default's own key too", () => {
    const measured: Record<string, number> = { scarlett: 12, default: 31 }
    const result = model({
      latencyMs: (deviceId) => measured[deviceId ?? 'default'] ?? 0,
    })

    expect(device(result, 'scarlett').latencyMs).toBe(12)
    expect(device(result, 'built-in').latencyMs).toBe(31)
    expect(device(result, 'airpods').latencyMs).toBeNull()
    expect(studioLatencyWords(12)).toBe('12 ms round trip')
    expect(studioLatencyWords(null)).toBe('Not measured')
  })
})

describe('studioSignalOn', () => {
  it('names the loudest input, and nothing while every one is silent', () => {
    expect(studioSignalOn([0.001, 0.02, 0.4])).toBe('Signal on Input 3')
    expect(studioSignalOn([0, 0.002])).toBeNull()
    expect(studioSignalOn([])).toBeNull()
  })
})
