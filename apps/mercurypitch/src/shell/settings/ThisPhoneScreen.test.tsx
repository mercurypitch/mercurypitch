// ============================================================
// This phone: a readout a singer can paste into a message
// ============================================================
//
// S6 step 9 (8a). Model, system, the app and its build, graphics, then the
// sound: the audio rate, the audio session and the microphone's state. One
// button copies it all; nothing on it is personal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { copyText } from './copy-text'
import type * as DeviceFactsModule from './device-facts'
import { loadDeviceFacts } from './device-facts'
import type * as LevelCheckModule from './level-check'
import { ThisPhoneScreen } from './ThisPhoneScreen'

const heard = vi.hoisted(() => ({
  input: null as null | 'denied' | { label: string },
}))

vi.mock('./copy-text', () => ({ copyText: vi.fn(async () => true) }))
vi.mock('./device-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof DeviceFactsModule>()),
  loadDeviceFacts: vi.fn(),
  audioRate: () => 48_000,
  audioSession: () => 'play-and-record',
  graphicsTier: () => 'high',
}))
vi.mock('./level-check', async (importOriginal) => ({
  ...(await importOriginal<typeof LevelCheckModule>()),
  knownInput: () => heard.input,
}))

let view: RenderedShell | null = null

function row(id: string): string {
  return (
    document.querySelector(`[data-settings-row="${id}"]`)?.textContent ?? ''
  )
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

beforeEach(() => {
  heard.input = { label: 'iPhone Microphone' }
  vi.mocked(copyText).mockClear()
  vi.mocked(loadDeviceFacts).mockResolvedValue({
    model: 'iPhone17,3',
    system: 'iOS 26.0',
    version: '0.6.0 (380)',
  })
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('This phone', () => {
  it('reads out the phone, the app and the sound (8a)', async () => {
    view = renderShell(() => <ThisPhoneScreen />)
    await settle()

    expect(row('phone-model')).toContain('iPhone17,3')
    expect(row('phone-system')).toContain('iOS 26.0')
    expect(row('phone-app')).toContain('0.6.0 (380)')
    expect(row('phone-graphics')).toContain('High')
    expect(row('phone-audio')).toContain('48 kHz')
    expect(row('phone-session')).toContain('Play and record')
    expect(row('phone-mic')).toContain('Allowed')
  })

  it('says the microphone is off once it was refused', async () => {
    heard.input = 'denied'

    view = renderShell(() => <ThisPhoneScreen />)
    await settle()

    expect(row('phone-mic')).toContain('Off')
  })

  it('copies every row as one block, and says it did', async () => {
    view = renderShell(() => <ThisPhoneScreen />)
    await settle()

    document
      .querySelector<HTMLButtonElement>('[data-testid="phone-copy"]')
      ?.click()
    await settle()

    const copied = vi.mocked(copyText).mock.calls[0]?.[0] ?? ''
    expect(copied).toContain('Model: iPhone17,3')
    expect(copied).toContain('App: 0.6.0 (380)')
    expect(copied).toContain('Microphone: Allowed')
    expect(
      document.querySelector('[data-testid="phone-copy"]')?.textContent,
    ).toContain('Copied')
  })

  it('says what cannot be read, rather than leaving a blank', async () => {
    vi.mocked(loadDeviceFacts).mockResolvedValue({
      model: null,
      system: null,
      version: null,
    })

    view = renderShell(() => <ThisPhoneScreen />)
    await settle()

    expect(row('phone-model')).toContain('Not available')
  })
})
