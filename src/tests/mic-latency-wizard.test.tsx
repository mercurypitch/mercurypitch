// ============================================================
// The latency wizard, hosted: its words, and what it tells its host
// ============================================================
//
// The phone app's Microphone screen shows the wizard in a sheet (S6 7b),
// with a first paragraph of its own that drops "scoring blames you for it",
// and it keeps the day a measurement was made, so it needs to hear when one
// is applied or cleared. The web keeps the wizard as it was: with no words
// of the host's, the first paragraph is the old one, word for word.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MicLatencyWizard } from '@/features/mic-feedback/MicLatencyWizard'
import type * as MicLatency from '@/lib/mic-latency'
import { micLatencyMs, setMicLatencyByDevice, setMicLatencySpreadByDevice, } from '@/stores/mic-latency-store'

const fake = vi.hoisted(() => ({
  processor: null as null | {
    onaudioprocess: ((event: unknown) => void) | null
  },
}))

vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: vi.fn(async () => ({}) as MediaStream),
    release: vi.fn(),
    getResolvedDevice: () => null,
    getPreferredDevice: () => null,
  },
}))
vi.mock('@/lib/mic-latency', async (importOriginal) => ({
  ...(await importOriginal<typeof MicLatency>()),
  detectOnsets: () => [1.02],
  matchOnsetDeltas: () => [0.018],
  summariseLatency: () => ({
    latencyMs: 18,
    spreadMs: 3,
    hits: 8,
    failure: null,
  }),
}))

/** Just enough of an AudioContext for one run: nothing plays, nothing is heard. */
class FakeAudioContext {
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  resume = async (): Promise<void> => undefined
  close = async (): Promise<void> => undefined
  createMediaStreamSource() {
    return { connect: (node: unknown) => node, disconnect: vi.fn() }
  }
  createScriptProcessor() {
    const processor = {
      onaudioprocess: null as ((event: unknown) => void) | null,
      connect: (node: unknown) => node,
      disconnect: vi.fn(),
    }
    fake.processor = processor
    return processor
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: (node: unknown) => node,
      disconnect: vi.fn(),
    }
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: vi.fn(),
      stop: vi.fn(),
    }
  }
}

/** The first paragraph, the one S6 7b rewrites for the phone. */
function intro(): string {
  return document.querySelector('p')?.textContent ?? ''
}

beforeEach(() => {
  localStorage.clear()
  setMicLatencyByDevice({})
  setMicLatencySpreadByDevice({})
  fake.processor = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setMicLatencyByDevice({})
  setMicLatencySpreadByDevice({})
})

describe('the words', () => {
  it('keeps the web paragraph, word for word, when the host brings none', () => {
    render(() => <MicLatencyWizard onClose={vi.fn()} />)

    expect(intro()).toBe(
      'Your device takes a moment to play a sound and another to capture one. Over that gap a note you sing lands late against the reference, and scoring blames you for it. This plays 8 clicks through your speakers, listens for them coming back, and measures the gap.',
    )
  })

  it("says the host's first paragraph in its place", () => {
    render(() => (
      <MicLatencyWizard onClose={vi.fn()} intro="The phone's own words." />
    ))

    expect(intro()).toBe("The phone's own words.")
  })
})

describe('what the host hears', () => {
  it('says when a measurement is applied, with its number', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const onApplied = vi.fn()
    const onClose = vi.fn()
    render(() => <MicLatencyWizard onClose={onClose} onApplied={onApplied} />)

    fireEvent.click(screen.getByText('Start'))
    await vi.advanceTimersByTimeAsync(0)
    fake.processor?.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(512) },
    })
    await vi.advanceTimersByTimeAsync(10_000)
    fireEvent.click(screen.getByText('Use this'))

    expect(onApplied).toHaveBeenCalledWith(18)
    expect(micLatencyMs()).toBe(18)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('says when the offset is cleared', () => {
    setMicLatencyByDevice({ default: 18 })
    const onCleared = vi.fn()
    render(() => <MicLatencyWizard onClose={vi.fn()} onCleared={onCleared} />)

    fireEvent.click(screen.getByText('Clear offset'))

    expect(onCleared).toHaveBeenCalledTimes(1)
    expect(micLatencyMs()).toBe(0)
  })
})
