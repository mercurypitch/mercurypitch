// The mic check before it opens the microphone: what it lists, which input
// it calls the default, and a takeover it catches from the device list alone.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MicCheckPanel } from './MicCheckPanel'

interface FakeDevice {
  deviceId: string
  groupId: string
  kind: MediaDeviceKind
  label: string
}

const REALTEK = 'Microphone (Realtek(R) Audio)'
const AIRPODS = 'Headset (AirPods Pro Hands-Free AG Audio)'

const listed = (defaultLabel: string): FakeDevice[] => [
  {
    deviceId: 'default',
    groupId: 'shared',
    kind: 'audioinput',
    label: `Default - ${defaultLabel}`,
  },
  { deviceId: 'realtek', groupId: 'r', kind: 'audioinput', label: REALTEK },
  { deviceId: 'airpods', groupId: 'a', kind: 'audioinput', label: AIRPODS },
  {
    deviceId: 'speakers',
    groupId: 'r',
    kind: 'audiooutput',
    label: 'Speakers (Realtek(R) Audio)',
  },
]

let devices: FakeDevice[] = []
let onDeviceChange: (() => void) | null = null
let original: MediaDevices | undefined

beforeEach(() => {
  // jsdom has no 2D canvas; the stage then draws nothing, which is all
  // these tests need from it.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  devices = listed(REALTEK)
  onDeviceChange = null
  original = navigator.mediaDevices
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: () => Promise.resolve(devices),
      getUserMedia: () => Promise.reject(new Error('not in this test')),
      addEventListener: (_type: string, listener: () => void) => {
        onDeviceChange = listener
      },
      removeEventListener: () => {
        onDeviceChange = null
      },
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: original,
  })
})

/** The tags on the device row that names `device`. */
function tagsOf(device: string): string[] {
  const row = screen.getByText(device).closest('li')
  if (row === null) return []
  return within(row)
    .queryAllByText(/./, { selector: 'span span' })
    .map((tag) => tag.textContent ?? '')
}

describe('MicCheckPanel', () => {
  it('invites a check and lists every input with its role', async () => {
    render(() => <MicCheckPanel />)
    expect(screen.getByTestId('mic-check-verdict').textContent).toContain(
      'Check your microphone',
    )
    expect(screen.getByTestId('mic-check-start').textContent).toBe(
      'Start mic check',
    )

    await screen.findByText(REALTEK)
    expect(tagsOf(REALTEK)).toEqual(['System default', 'Built-in'])
    expect(tagsOf(AIRPODS)).toEqual(['Bluetooth'])
    expect(tagsOf('Speakers (Realtek(R) Audio)')).toEqual(['System default'])
  })

  it('logs a headset taking over the system default', async () => {
    render(() => <MicCheckPanel />)
    await screen.findByText(REALTEK)
    devices = listed(AIRPODS)
    onDeviceChange?.()
    const line = await screen.findByText(
      `System default moved from ${REALTEK} to ${AIRPODS}`,
    )
    expect(line.closest('li')?.dataset.tone).toBe('warn')
    expect(tagsOf(AIRPODS)).toEqual(['System default', 'Bluetooth'])
    expect(tagsOf(REALTEK)).toEqual(['Built-in'])
  })
})
