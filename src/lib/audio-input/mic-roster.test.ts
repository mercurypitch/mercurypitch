import { describe, expect, it } from 'vitest'
import type { DeviceInfoLike } from './mic-roster'
import { buildRoster, classifyInput, defaultInput, diffRosters, listeningInput, } from './mic-roster'

const input = (
  deviceId: string,
  label: string,
  groupId = `g-${deviceId}`,
): DeviceInfoLike => ({ deviceId, groupId, kind: 'audioinput', label })

const output = (deviceId: string, label: string): DeviceInfoLike => ({
  deviceId,
  groupId: `g-${deviceId}`,
  kind: 'audiooutput',
  label,
})

const REALTEK = 'Microphone (Realtek(R) Audio)'
const AIRPODS = 'Headset (AirPods Pro Hands-Free AG Audio)'
const WEBCAM = 'Microphone (HD Pro Webcam C920)'

/** What Chromium on Windows lists: two pseudo-entries ahead of the devices. */
function chromiumList(defaultLabel: string, callsLabel: string) {
  return [
    input('default', `Default - ${defaultLabel}`, 'shared'),
    input('communications', `Communications - ${callsLabel}`, 'shared'),
    input('realtek', REALTEK),
    input('airpods', AIRPODS),
    input('webcam', WEBCAM),
    output('default', 'Default - Speakers (Realtek(R) Audio)'),
    output('speakers', 'Speakers (Realtek(R) Audio)'),
    output('airpods-out', 'Headphones (AirPods Pro Stereo)'),
  ]
}

describe('buildRoster', () => {
  it('folds Chromium pseudo-entries into flags on the devices they name', () => {
    const roster = buildRoster(chromiumList(REALTEK, AIRPODS))
    expect(roster.inputs.map((i) => i.deviceId)).toEqual([
      'realtek',
      'airpods',
      'webcam',
    ])
    expect(defaultInput(roster)?.deviceId).toBe('realtek')
    expect(roster.inputs.find((i) => i.isCommunications)?.deviceId).toBe(
      'airpods',
    )
    expect(roster.outputs.map((o) => [o.deviceId, o.isDefault])).toEqual([
      ['speakers', true],
      ['airpods-out', false],
    ])
    expect(roster.labelled).toBe(true)
  })

  it('matches the device by the label it ends with, whatever the role word', () => {
    const roster = buildRoster([
      input('default', `Standard - ${WEBCAM}`, 'shared'),
      input('realtek', REALTEK),
      input('webcam', WEBCAM),
    ])
    expect(defaultInput(roster)?.deviceId).toBe('webcam')
  })

  it('takes the first input as the default where the browser adds no pseudo-entry', () => {
    const roster = buildRoster([input('a', AIRPODS), input('b', REALTEK)])
    expect(defaultInput(roster)?.deviceId).toBe('a')
    expect(roster.inputs).toHaveLength(2)
  })

  it('keeps a default that points at a device the list does not carry', () => {
    const roster = buildRoster([
      input('default', 'Default - Ghost Microphone', 'ghost'),
      input('realtek', REALTEK),
    ])
    expect(defaultInput(roster)?.name).toBe('Ghost Microphone')
    expect(roster.inputs).toHaveLength(2)
  })

  it('keeps an output default that names no other row, as Chromium fakes list it', () => {
    const roster = buildRoster([
      input('mic', REALTEK),
      output('default', 'Fake Default Audio Output'),
      output('one', 'Fake Audio Output 1'),
    ])
    expect(roster.outputs.map((o) => [o.name, o.isDefault])).toEqual([
      ['Fake Default Audio Output', true],
      ['Fake Audio Output 1', false],
    ])
  })

  it('names the input a track opened on, even after the default moves away', () => {
    // Opened on the default while that was the Realtek; since then AirPods
    // connected and the system made them the default. The track still hears
    // the Realtek, and its label says so.
    const roster = buildRoster(chromiumList(AIRPODS, AIRPODS), {
      deviceId: 'default',
      groupId: 'shared',
      label: `Default - ${REALTEK}`,
    })
    expect(listeningInput(roster)?.deviceId).toBe('realtek')
    expect(defaultInput(roster)?.deviceId).toBe('airpods')
  })

  it('names no input rather than the new default when the label matches nothing', () => {
    const roster = buildRoster(chromiumList(AIRPODS, AIRPODS), {
      deviceId: 'default',
      groupId: 'shared',
      label: 'Default - A Microphone That Left',
    })
    expect(listeningInput(roster)).toBeNull()
  })

  it('maps an unlabelled default track through the default entry', () => {
    const roster = buildRoster(chromiumList(WEBCAM, WEBCAM), {
      deviceId: 'default',
      groupId: null,
      label: null,
    })
    expect(listeningInput(roster)?.deviceId).toBe('webcam')
  })

  it('maps a track by its exact device id first', () => {
    const roster = buildRoster(chromiumList(REALTEK, REALTEK), {
      deviceId: 'webcam',
      groupId: null,
      label: null,
    })
    expect(listeningInput(roster)?.deviceId).toBe('webcam')
  })

  it('reports an unlabelled list as such, before permission', () => {
    const roster = buildRoster([input('', ''), input('', '')])
    expect(roster.labelled).toBe(false)
    expect(roster.inputs).toHaveLength(2)
  })
})

describe('diffRosters', () => {
  it('tells a connection, and the default it took, in that order', () => {
    const before = buildRoster([input('realtek', REALTEK)])
    const after = buildRoster([
      input('airpods', AIRPODS),
      input('realtek', REALTEK),
    ])
    const changes = diffRosters(before, after)
    expect(changes.map((c) => c.type)).toEqual(['connected', 'default-changed'])
    const moved = changes[1]
    expect(moved.type === 'default-changed' && moved.from?.deviceId).toBe(
      'realtek',
    )
    expect(moved.type === 'default-changed' && moved.to.deviceId).toBe(
      'airpods',
    )
  })

  it('tells a disconnection', () => {
    const before = buildRoster([
      input('realtek', REALTEK),
      input('webcam', WEBCAM),
    ])
    const after = buildRoster([input('realtek', REALTEK)])
    expect(diffRosters(before, after)).toEqual([
      { type: 'disconnected', input: before.inputs[1] },
    ])
  })

  it('tells when the calls default moves', () => {
    const before = buildRoster(chromiumList(REALTEK, REALTEK))
    const after = buildRoster(chromiumList(REALTEK, AIRPODS))
    expect(diffRosters(before, after).map((c) => c.type)).toEqual([
      'calls-changed',
    ])
  })

  it('compares nothing while either list is unlabelled', () => {
    const blank = buildRoster([input('', '')])
    const named = buildRoster([input('realtek', REALTEK)])
    expect(diffRosters(blank, named)).toEqual([])
    expect(diffRosters(named, blank)).toEqual([])
  })
})

describe('classifyInput', () => {
  it.each([
    ['Stereo Mix (Realtek(R) Audio)', 'loopback'],
    ['Monitor of Built-in Audio Analog Stereo', 'loopback'],
    ['CABLE Output (VB-Audio Virtual Cable)', 'virtual'],
    ['Microphone (Steam Streaming Microphone)', 'virtual'],
    [AIRPODS, 'bluetooth'],
    [WEBCAM, 'camera'],
    ['LG HDR 4K (Display Audio)', 'display'],
    ['Headset Microphone (Jabra EVOLVE 20)', 'headset'],
    ['Line In (Scarlett 2i2 USB)', 'usb'],
    ['MacBook Pro Microphone', 'built-in'],
    [REALTEK, 'built-in'],
    ['Studio Condenser', 'other'],
  ])('reads %s as %s', (name, kind) => {
    expect(classifyInput(name)).toBe(kind)
  })
})
