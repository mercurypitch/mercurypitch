// The Developer screen's Audio section, read the way a tester reads it.
//
// The rows are what a phone says when a room is silent, so every case drives
// the ambient the app wires (RoomsAlley's `ambient()`: the shared packaged
// asset read, the device's audio recorder) on a fake AudioContext, and reads
// the rows as text. A fresh module graph per case: the ambient and the
// recorder are both module state, and a buffer decoded in one case would
// otherwise be the next case's cache hit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RELEASE_SLACK_MS } from '../alley/alley-audio'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { TONE_HZ, TONE_MS } from './test-tone'

/** The shipped Sing ambient's size, so the body is recognisably the file. */
const SING_BYTES = 266_161

interface FakeOscillator {
  frequency: { value: number }
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

let contexts: FakeAudioContext[] = []
let oscillators: FakeOscillator[] = []
let decode: () => Promise<unknown>

class FakeAudioContext {
  state = 'suspended'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  decodeAudioData = vi.fn(async () => decode())
  constructor() {
    contexts.push(this)
  }
  addEventListener(): void {}
  createGain() {
    const gain = {
      value: 1,
      cancelScheduledValues() {},
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime() {},
    }
    return { gain, connect() {}, disconnect() {} }
  }
  createBufferSource() {
    return { connect() {}, disconnect() {}, start() {}, stop() {} }
  }
  createOscillator() {
    const oscillator = {
      frequency: { value: 0 },
      connect() {},
      disconnect() {},
      start: vi.fn(),
      stop: vi.fn(),
    }
    oscillators.push(oscillator)
    return oscillator
  }
}

let view: RenderedShell | null = null

function stubFetch(response: { ok: boolean; status: number }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ...response,
      arrayBuffer: async () => new ArrayBuffer(SING_BYTES),
    })),
  )
}

async function openPanel(): Promise<void> {
  const { AudioDiagnosticsPanel } = await import('./AudioDiagnosticsPanel')
  view = renderShell(() => <AudioDiagnosticsPanel />)
}

function el<T extends Element>(selector: string): T {
  const found = view?.container.querySelector<T>(selector)
  if (found === null || found === undefined) throw new Error(selector)
  return found
}

const row = (label: string): string =>
  el(`[data-audio-row="${label}"] dd`).textContent ?? ''
const button = (id: string) => el<HTMLButtonElement>(`[data-testid="${id}"]`)

async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  contexts = []
  oscillators = []
  decode = async () => ({
    duration: 13.1,
    numberOfChannels: 2,
    sampleRate: 48_000,
  })
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('the Audio section', () => {
  it('shows a packaged m4a read with status 0 as fetched, decoded and sounding', async () => {
    stubFetch({ ok: false, status: 0 })
    await openPanel()
    expect(row('Context')).toBe('none yet: tap a door, or Play below')
    expect(row('Last fetch')).toBe('none yet')

    button('dev-audio-ambient').click()
    await settle()

    // The iOS shape, and the ambient playing through it.
    expect(row('Last fetch')).toMatch(
      /^status 0 · ok false · 266161 B · \d+ ms$/,
    )
    expect(row('Last decode')).toMatch(/^13\.10 s · 2 ch · 48000 Hz · \d+ ms$/)
    expect(row('Last error')).toBe('none')
    expect(row('Ambient')).toBe('sing · level 0.00 · 1 started')
    expect(row('Context')).toBe('running · 48000 Hz')
    expect(row('Audio session')).toBe('not available')
    expect(row('Page')).toBe('visible')
    expect(button('dev-audio-ambient').textContent).toContain('Stop')

    // The clock, read twice: moving while it advances, stalled once not.
    contexts[0].currentTime = 0.5
    vi.advanceTimersByTime(250)
    contexts[0].currentTime = 0.75
    vi.advanceTimersByTime(250)
    expect(row('Clock')).toBe('0.750 s · moving')
    vi.advanceTimersByTime(250)
    expect(row('Clock')).toBe('0.750 s · stalled')
  })

  it('names the stage and the error when a decode fails', async () => {
    stubFetch({ ok: true, status: 200 })
    decode = async () => {
      throw new DOMException('Unable to decode audio data', 'EncodingError')
    }
    await openPanel()

    button('dev-audio-ambient').click()
    await settle()
    // The start lets go of its voice after the decode's report, and nothing
    // is recorded after that: the next reading is what shows it silent.
    vi.advanceTimersByTime(250)

    expect(row('Last fetch')).toMatch(/^status 200 · ok true · 266161 B/)
    expect(row('Last decode')).toBe(
      'failed · EncodingError: Unable to decode audio data',
    )
    expect(row('Last error')).toMatch(
      /^decode · alley · EncodingError: Unable to decode audio data · \d+ s ago$/,
    )
    expect(row('Ambient')).toBe('silent · level 0.00 · 0 started')
    expect(button('dev-audio-ambient').textContent).toContain(
      'Play Sing ambient',
    )
  })

  it('copies the report, and selects it where the clipboard is refused', async () => {
    stubFetch({ ok: false, status: 0 })
    const writeText = vi.fn(async () => {
      throw new DOMException('Write permission denied.', 'NotAllowedError')
    })
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await openPanel()
    button('dev-audio-ambient').click()
    await settle()

    button('dev-audio-copy').click()
    await settle()

    const report = el('[data-testid="dev-audio-report"]').textContent ?? ''
    expect(writeText).toHaveBeenCalledWith(report)
    expect(report).toContain('MercuryPitch audio diagnostics')
    expect(report).toMatch(/Last fetch: status 0 · ok false · 266161 B/)
    expect(report).toMatch(
      /alley fetched url=\/rooms\/alley\/\S+\.m4a status=0 ok=false bytes=266161/,
    )
    expect(window.getSelection()?.toString()).toBe(report)
  })

  it('says Copied when the clipboard takes it', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await openPanel()

    button('dev-audio-copy').click()
    await settle()

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(button('dev-audio-copy').textContent).toContain('Copied')
  })

  it('plays the test tone on a context of its own, and closes it after', async () => {
    await openPanel()

    button('dev-audio-tone').click()
    await settle()

    // Only the tone's: the alley's ambient made none.
    expect(contexts).toHaveLength(1)
    expect(oscillators).toHaveLength(1)
    expect(oscillators[0].frequency.value).toBe(TONE_HZ)
    expect(oscillators[0].start).toHaveBeenCalledTimes(1)
    expect(button('dev-audio-tone').disabled).toBe(true)
    expect(row('Context')).toBe('none yet: tap a door, or Play below')

    vi.advanceTimersByTime(TONE_MS + RELEASE_SLACK_MS)
    await settle()
    expect(oscillators[0].stop).toHaveBeenCalledTimes(1)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    expect(button('dev-audio-tone').disabled).toBe(false)
    const { audioDiagnosticEntries } = await import('@/lib/audio-diagnostics')
    expect(
      audioDiagnosticEntries()
        .filter((entry) => entry.source === 'tone')
        .map((entry) => entry.event),
    ).toEqual(['context', 'activated', 'started', 'stopped'])
  })

  it('stops an ambient it started when the screen goes', async () => {
    stubFetch({ ok: false, status: 0 })
    await openPanel()
    button('dev-audio-ambient').click()
    await settle()
    const { ambient } = await import('../alley/RoomsAlley')
    expect(ambient().sounding()).toBe('sing')

    view?.unmount()
    view = null
    expect(ambient().sounding()).toBeNull()
  })
})
