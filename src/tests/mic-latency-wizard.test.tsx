// ============================================================
// The latency wizard, hosted: its words, and what it tells its host
// ============================================================
//
// The phone app's Microphone screen shows the wizard in a sheet (S6 7b),
// with a first paragraph of its own that drops "scoring blames you for it",
// and it keeps the day a measurement was made, so it needs to hear when one
// is applied or cleared. The web keeps the wizard as it was: with no words
// of the host's, the first paragraph is the old one, word for word. On a TV
// over AirPlay the number is the route's own once measured there, and the
// wizard says which number it shows and clears only the route's own.
// A run there is measured its own way (REQ-TV-096): unevenly spaced clicks,
// a longer wait, and words of its own when it fails.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TV_RUN_NOTE } from '@/features/mic-feedback/latency-route-copy'
import { MicLatencyWizard } from '@/features/mic-feedback/MicLatencyWizard'
import type * as MicLatency from '@/lib/mic-latency'
import { LATENCY_LEAD_IN_SEC } from '@/lib/mic-latency'
import type * as MicLatencyRoute from '@/lib/mic-latency-route'
import type { RouteLatencyResult } from '@/lib/mic-latency-route'
import { measureRouteLatency, routeClickSchedule, } from '@/lib/mic-latency-route'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { micLatencyByDevice, micLatencyByRoute, micLatencyMs, setMicLatencyByDevice, setMicLatencyByRoute, setMicLatencySpreadByDevice, setMicLatencySpreadByRoute, } from '@/stores/mic-latency-store'

const fake = vi.hoisted(() => ({
  processor: null as null | {
    onaudioprocess: ((event: unknown) => void) | null
  },
  /** When each click was scheduled to play, in order. */
  clicks: [] as number[],
  /** What the route's measurement answers, a TV's 240 ms unless a test says. */
  routeResult: null as null | RouteLatencyResult,
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
vi.mock('@/lib/mic-latency-route', async (importOriginal) => ({
  ...(await importOriginal<typeof MicLatencyRoute>()),
  measureRouteLatency: vi.fn(
    () =>
      fake.routeResult ?? {
        latencyMs: 240,
        spreadMs: 12,
        hits: 8,
        failure: null,
      },
  ),
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
      start: vi.fn((at: number) => {
        fake.clicks.push(at)
      }),
      stop: vi.fn(),
    }
  }
}

/** The first paragraph, the one S6 7b rewrites for the phone. */
function intro(): string {
  return document.querySelector('p')?.textContent ?? ''
}

/** Every paragraph's words, the line with the number in use among them. */
function paragraphs(): string[] {
  return [...document.querySelectorAll('p')].map((p) => p.textContent ?? '')
}

/**
 * One run of the wizard up to its answer: started, one block of capture fed,
 * and `runMs` of the clock let pass (the phone's run takes 7.75 s, a TV's
 * 10.75 s).
 */
async function runWizard(runMs = 12_000): Promise<void> {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  render(() => <MicLatencyWizard onClose={vi.fn()} />)
  fireEvent.click(screen.getByText('Start'))
  await vi.advanceTimersByTimeAsync(0)
  fake.processor?.onaudioprocess?.({
    inputBuffer: { getChannelData: () => new Float32Array(512) },
  })
  await vi.advanceTimersByTimeAsync(runMs)
}

/**
 * One run, answered by the mocked measurement (18 ms on the phone's outputs,
 * 240 ms on a TV's route), applied.
 */
async function measureAndApply(): Promise<void> {
  await runWizard()
  fireEvent.click(screen.getByText('Use this'))
}

beforeEach(() => {
  localStorage.clear()
  setMicLatencyByDevice({})
  setMicLatencySpreadByDevice({})
  setMicLatencyByRoute({})
  setMicLatencySpreadByRoute({})
  setAudioRouteForTests(null)
  fake.processor = null
  fake.clicks = []
  fake.routeResult = null
  vi.mocked(measureRouteLatency).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setMicLatencyByDevice({})
  setMicLatencySpreadByDevice({})
  setMicLatencyByRoute({})
  setMicLatencySpreadByRoute({})
  setAudioRouteForTests(null)
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

describe('the route the number is for', () => {
  it('says the number as before on the phone’s own outputs', () => {
    setMicLatencyByDevice({ default: 18 })
    setAudioRouteForTests('speaker')
    render(() => <MicLatencyWizard onClose={vi.fn()} />)

    expect(paragraphs()).toContain('Currently set to 18 ms for this input.')
    expect(screen.queryByText('Clear offset')).not.toBeNull()
  })

  it('says a TV on AirPlay borrows the number until a run there, and offers no clear', () => {
    setMicLatencyByDevice({ default: 60 })
    setAudioRouteForTests('airplay')
    render(() => <MicLatencyWizard onClose={vi.fn()} />)

    expect(paragraphs()).toContain(
      'Currently set to 60 ms for this input, not yet measured on AirPlay. A run now keeps one for AirPlay alone.',
    )
    expect(screen.queryByText('Clear offset')).toBeNull()
  })

  it('keeps a run on AirPlay for AirPlay alone', async () => {
    setMicLatencyByDevice({ default: 60 })
    setAudioRouteForTests('airplay')

    await measureAndApply()

    expect(micLatencyMs()).toBe(240)
    expect(micLatencyByRoute()).toEqual({ 'airplay:default': 240 })
    expect(micLatencyByDevice()).toEqual({ default: 60 })
  })

  it('names the route of a number measured there, and clears that one alone', () => {
    setMicLatencyByDevice({ default: 60 })
    setMicLatencyByRoute({ 'airplay:default': 240 })
    setAudioRouteForTests('airplay')
    render(() => <MicLatencyWizard onClose={vi.fn()} />)

    expect(paragraphs()).toContain(
      'Currently set to 240 ms for this input on AirPlay.',
    )
    fireEvent.click(screen.getByText('Clear offset'))

    expect(micLatencyByRoute()).toEqual({})
    expect(micLatencyByDevice()).toEqual({ default: 60 })
    expect(micLatencyMs()).toBe(60)
  })
})

describe('a run on a TV (REQ-TV-096)', () => {
  it('plays its clicks unevenly, and listens long enough for the longest reply', async () => {
    setAudioRouteForTests('airplay')

    await runWizard(10_000)

    expect(fake.clicks).toEqual(routeClickSchedule(LATENCY_LEAD_IN_SEC))
    expect(screen.queryByText('Listening — stay quiet.')).not.toBeNull()

    await vi.advanceTimersByTimeAsync(1_000)

    expect(measureRouteLatency).toHaveBeenCalledTimes(1)
    expect(screen.getByText('240 ms')).not.toBeNull()
  })

  it('leaves the phone’s own outputs the run they always had', async () => {
    setAudioRouteForTests('speaker')

    await runWizard(8_000)

    expect(fake.clicks).toEqual(
      Array.from({ length: 8 }, (_, i) => LATENCY_LEAD_IN_SEC + i * 0.75),
    )
    expect(measureRouteLatency).not.toHaveBeenCalled()
    expect(screen.getByText('18 ms')).not.toBeNull()
  })

  it('says before a run where to hold the phone, on a TV only', () => {
    setAudioRouteForTests('airplay')
    const { unmount } = render(() => <MicLatencyWizard onClose={vi.fn()} />)
    expect(paragraphs()).toContain(TV_RUN_NOTE)
    unmount()

    setAudioRouteForTests('speaker')
    render(() => <MicLatencyWizard onClose={vi.fn()} />)
    expect(paragraphs()).not.toContain(TV_RUN_NOTE)
  })

  it('names a round trip too late to keep, and offers nothing to use', async () => {
    setAudioRouteForTests('airplay')
    fake.routeResult = {
      latencyMs: null,
      spreadMs: 4,
      hits: 8,
      failure: 'too-late',
      heardMs: 1600,
    }

    await runWizard()

    expect(paragraphs().join(' ')).toContain(
      'The TV plays the sound about 1.6 s after the phone sends it, too late to sing along with, so no number was kept. If only the sound goes to the TV, use Screen Mirroring instead',
    )
    expect(screen.queryByText('Use this')).toBeNull()
    expect(screen.queryByText('Try again')).not.toBeNull()
  })

  it('keeps no number when the sound has moved since the run', async () => {
    setMicLatencyByDevice({ default: 60 })
    setAudioRouteForTests('airplay')
    await runWizard()

    setAudioRouteForTests('speaker')
    fireEvent.click(screen.getByText('Use this'))

    expect(micLatencyByRoute()).toEqual({})
    expect(micLatencyByDevice()).toEqual({ default: 60 })
    expect(paragraphs()).toContain(
      'The sound has moved to another output since that run. Run it again where you will sing.',
    )
  })

  it('says to hold the phone near the TV and turn off its automatic volume when few clicks come back', async () => {
    setAudioRouteForTests('airplay')
    fake.routeResult = {
      latencyMs: null,
      spreadMs: null,
      hits: 1,
      failure: 'too-few-hits',
    }

    await runWizard()

    expect(paragraphs().join(' ')).toContain(
      "Hold the phone near the TV's speaker, turn off the TV's automatic volume",
    )
  })
})
