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
/** What every analyser reads: one sample value, held. */
let analyserLevel = 0

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
  createAnalyser() {
    return {
      fftSize: 2048,
      connect() {},
      getFloatTimeDomainData(samples: Float32Array) {
        samples.fill(analyserLevel)
      },
    }
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
  analyserLevel = 0
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

  it('has "One volume in rooms", on until turned off, and keeps an off on the phone', async () => {
    localStorage.clear()
    await openPanel()
    const { ONE_VOLUME_KEY, oneVolumeInRooms } =
      await import('./room-volume-switch')
    const toggle = button('dev-one-volume-in-rooms')
    expect(toggle.getAttribute('aria-checked')).toBe('true')

    toggle.click()
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(oneVolumeInRooms()).toBe(false)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBe('0')

    toggle.click()
    expect(oneVolumeInRooms()).toBe(true)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBeNull()
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

  it('shows which way the screen is turned, and copies it with the rest', async () => {
    vi.stubGlobal('innerWidth', 844)
    vi.stubGlobal('innerHeight', 390)
    vi.stubGlobal('screen', { orientation: { type: 'landscape-primary' } })
    document.documentElement.style.setProperty('--safe-right', '47px')
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    try {
      await openPanel()
      expect(row('Orientation')).toBe('landscape-primary · 844 x 390')
      expect(row('Safe insets')).toMatch(/^unset 47px unset unset · in use /u)

      button('dev-audio-copy').click()
      await settle()
      const report = el('[data-testid="dev-audio-report"]').textContent ?? ''
      expect(report).toContain('Orientation: landscape-primary · 844 x 390')
      expect(report).toMatch(/Safe insets: unset 47px unset unset/u)
    } finally {
      document.documentElement.removeAttribute('style')
    }
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

describe("the phone's output, the census and the rooms' output", () => {
  /** An iPhone playing to its receiver, then moved to the speaker turned low. */
  const RECEIVER = {
    volume: 1,
    step: null,
    steps: null,
    route: 'receiver' as const,
    outputs: [{ type: 'Receiver', name: 'Receiver' }],
    detail: {
      category: 'AVAudioSessionCategoryPlayAndRecord',
      mode: 'AVAudioSessionModeDefault',
      options: ['mixWithOthers', 'defaultToSpeaker'],
      otherAudioPlaying: false,
      silenceHint: false,
      sampleRate: 48_000,
      ioBufferDuration: 0.0213,
      outputLatency: 0.012,
    },
    reason: null,
  }

  it('says the web has no reading of the phone', async () => {
    await openPanel()
    expect(row('Output')).toBe('not read on the web')
    expect(row('Volume')).toBe('not read')
    expect(row('Mic tracks')).toBe(
      '0 live · 0 opened, 0 ended · mic manager holds none, no one using it',
    )
    expect(row('Contexts')).toBe('none made yet')
    expect(row('Shared clock')).toBe('none')
    expect(row('Room output')).toBe('none yet: open a room')
  })

  it("reads the phone's route, volume and session, and follows each change", async () => {
    const store = await import('@/stores/native-shell-store')
    let send: (reading: typeof RECEIVER) => void = () => undefined
    const unregister = store.registerNativeDevice({
      audioOutput: {
        read: async () => RECEIVER,
        watch: (handler: (reading: typeof RECEIVER) => void) => {
          send = handler
          return () => undefined
        },
      },
    } as unknown as Parameters<typeof store.registerNativeDevice>[0])
    try {
      await openPanel()
      await settle()
      expect(row('Output')).toBe('Receiver (the earpiece) · Receiver')
      expect(row('Volume')).toBe('1.00')
      expect(row('Phone session')).toBe(
        'PlayAndRecord · Default · mixWithOthers, defaultToSpeaker',
      )
      expect(row('Phone audio')).toMatch(
        /^other audio none · silence hint off/u,
      )

      send({
        ...RECEIVER,
        volume: 0.0625,
        route: 'speaker' as never,
        outputs: [{ type: 'Speaker', name: 'Speaker' }],
      })
      expect(row('Output')).toBe('Speaker · Speaker')
      expect(row('Volume')).toBe('0.06 · low: the rooms ask for more')
    } finally {
      unregister()
    }
  })

  it('counts the mic tracks and contexts the page holds open', async () => {
    const track = {
      kind: 'audio',
      label: 'iPhone Microphone',
      readyState: 'live',
      getSettings: () => ({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }),
      stop() {
        this.readyState = 'ended'
      },
      addEventListener() {},
    }
    const getUserMedia = vi.fn(async () => ({ getAudioTracks: () => [track] }))
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: navigator.userAgent,
      mediaDevices: { getUserMedia },
    })
    const census = await import('./audio-census')
    census.installAudioCensus({ win: window })
    void new AudioContext()
    await navigator.mediaDevices.getUserMedia({ audio: true })

    await openPanel()
    expect(row('Mic tracks')).toBe(
      '1 live (#1 echo off noise off gain off) · 1 opened, 0 ended · mic manager holds none, no one using it',
    )
    expect(row('Contexts')).toBe('#1 suspended 48000 Hz · 0 closed')

    track.stop()
    vi.advanceTimersByTime(250)
    expect(row('Mic tracks')).toMatch(/^0 live · 1 opened, 1 ended/u)
  })

  it("reads the rooms' output gain and what it sends, and names their context", async () => {
    const census = await import('./audio-census')
    census.installAudioCensus({ win: window })
    const { roomOutput } = await import('@/components/room-kit/room-output')
    const context = new AudioContext()
    roomOutput(context)
    // A sample of 0.316 is -10 dBFS.
    analyserLevel = 0.316

    await openPanel()
    expect(row('Room output')).toBe(
      'gain 1.00 · now -10.0 dBFS peak, -10.0 dBFS RMS',
    )
    expect(row('Contexts')).toBe('#1 suspended 48000 Hz (rooms) · 0 closed')
  })
})
