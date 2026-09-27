// ============================================================
// What the phone says about itself, for This phone and About
// ============================================================
//
// S6 step 9 (8a, 8b). The model and system from @capacitor/device, the
// version and build from the app's own record (App.getInfo), and the
// readings the app already takes: the graphics tier, the audio context's
// rate and the audio session. Anything that cannot be read is null, and the
// screen says "Not available" rather than inventing a value.

import { App } from '@capacitor/app'
import { Device } from '@capacitor/device'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { audioSessionLine, detailsText, loadDeviceFacts, modelLine, systemLine, tierLabel, versionLine, } from './device-facts'

vi.mock('@capacitor/device', () => ({ Device: { getInfo: vi.fn() } }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }))

const IPHONE = {
  model: 'iPhone17,3',
  platform: 'ios' as const,
  operatingSystem: 'ios' as const,
  osVersion: '26.0',
  manufacturer: 'Apple',
  isVirtual: false,
  webViewVersion: '26.0',
}

beforeEach(() => {
  vi.mocked(Device.getInfo).mockReset()
  vi.mocked(App.getInfo).mockReset()
  vi.mocked(Device.getInfo).mockResolvedValue(IPHONE)
  vi.mocked(App.getInfo).mockResolvedValue({
    name: 'Mercury Pitch',
    id: 'com.example.app',
    build: '380',
    version: '0.6.0',
  })
})

describe('reading the phone', () => {
  it('names the model, the system and the app with its build', async () => {
    const facts = await loadDeviceFacts()

    expect(facts.model).toBe('iPhone17,3')
    expect(facts.system).toBe('iOS 26.0')
    expect(facts.version).toBe('0.6.0 (380)')
  })

  it('leaves out what it cannot read, rather than inventing it', async () => {
    vi.mocked(Device.getInfo).mockRejectedValue(new Error('no plugin'))
    vi.mocked(App.getInfo).mockRejectedValue(
      new Error('Not implemented on web.'),
    )

    const facts = await loadDeviceFacts()

    expect(facts.model).toBeNull()
    expect(facts.system).toBeNull()
    expect(facts.version).toBeNull()
  })
})

describe('the words', () => {
  it('writes an Android model with its maker, once', () => {
    expect(
      modelLine({
        ...IPHONE,
        operatingSystem: 'android',
        manufacturer: 'Google',
        model: 'Pixel 8',
      }),
    ).toBe('Google Pixel 8')
    expect(
      modelLine({
        ...IPHONE,
        operatingSystem: 'android',
        manufacturer: 'samsung',
        model: 'SM-S921B',
      }),
    ).toBe('Samsung SM-S921B')
    expect(
      modelLine({
        ...IPHONE,
        operatingSystem: 'android',
        manufacturer: 'Google',
        model: 'Google Pixel 8',
      }),
    ).toBe('Google Pixel 8')
  })

  it('names the system the way the phone does', () => {
    expect(systemLine('ios', '26.0')).toBe('iOS 26.0')
    expect(systemLine('android', '15')).toBe('Android 15')
  })

  it('writes the version with its build, as 8b does', () => {
    expect(versionLine('0.6.0', '380')).toBe('0.6.0 (380)')
    expect(versionLine('0.6.0', '')).toBe('0.6.0')
  })

  it('names the graphics tier and the audio session in words', () => {
    expect(tierLabel('high')).toBe('High')
    expect(tierLabel('balanced')).toBe('Balanced')
    expect(audioSessionLine('play-and-record')).toBe('Play and record')
    expect(audioSessionLine(undefined)).toBe('Not available')
  })

  it('copies every row as one block to paste into a message', () => {
    const text = detailsText([
      { label: 'Model', value: 'iPhone17,3' },
      { label: 'System', value: 'iOS 26.0' },
    ])

    expect(text).toBe('MercuryPitch\nModel: iPhone17,3\nSystem: iOS 26.0')
  })
})
