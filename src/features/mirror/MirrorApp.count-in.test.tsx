// ============================================================
// Voice Mirror count-in: "Ready…" until the take, "sing" only once it runs
// ============================================================
//
// The match note used to show "your turn — sing it" beside the count-in
// number, two seconds before recording started, so people sang into the
// countdown (owner, 11 Oct 2026). Every count-in before a take now says
// "Ready…" with a plain line, and the instruction to sing appears with the
// recording itself, as the onboarding's voiceprint does it.
//
// Driven through the real page from the `#twin` save point, the shortest
// way into the match notes: a stub microphone, a reference tone that ends
// at once, and fake clocks for the count-ins.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type * as MicManager from '@/lib/mic-manager'
import { saveCheckpoint } from '@/lib/mirror/checkpoint'
import { MirrorApp } from './MirrorApp'

const f0 = vi.hoisted(() => ({
  startTask: vi.fn(),
  takeFrames: vi.fn(() => []),
  peekFrames: () => [],
  latest: () => null,
  latestSmoothed: () => null,
  latestLevel: () => 0.05,
  maxLevel: () => 0.05,
  dispose: vi.fn(),
}))

vi.mock('./funnel', () => ({ trackFunnel: vi.fn() }))
vi.mock('@/stores/promo-store', () => ({
  loadFeaturedPromo: async () => undefined,
  offeredPromo: () => null,
}))
vi.mock('./tone-player', () => ({
  playReferenceTone: vi.fn(async () => undefined),
}))
// The demo animation is canvas and matchMedia, neither of which is the point.
vi.mock('./TaskDemo', () => ({ TaskDemo: () => null }))
vi.mock('./LiveViz', () => ({ LiveViz: () => null, MicLevelBar: () => null }))
vi.mock('@/lib/pitch-f0-stream', () => ({ createF0Stream: () => f0 }))
vi.mock('@/lib/mic-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof MicManager>()),
  listAudioInputs: async () => [],
  micManager: {
    acquire: vi.fn(async () => ({ getAudioTracks: () => [] })),
    release: vi.fn(),
    getStream: () => null,
    setPreferredDevice: vi.fn(async () => undefined),
  },
}))

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function glide(from: number, to: number) {
  return Array.from({ length: 25 }, (_, i) => ({
    t: i * 0.32,
    f0: midiToFreq(from + ((to - from) * i) / 24),
    conf: 0.95,
  }))
}

function stage(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.mirror-stage')
  if (el === null) throw new Error('no task stage on screen')
  return el
}

beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  })
})

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'performance',
    ],
  })
  localStorage.clear()
  saveCheckpoint(localStorage, {
    glides: [glide(48, 74), glide(74, 48)],
    hold: glide(60, 60),
    targets: [60, 62, 64, 65, 67],
    range: {
      lowMidi: 48,
      highMidi: 74,
      lowNote: 'C3',
      highNote: 'D5',
      semitones: 26,
      qualifyingMidis: Array.from({ length: 27 }, (_, i) => 48 + i),
      voiceHint: 'Tenor',
    },
  })
  f0.startTask.mockClear()
  window.history.replaceState(null, '', '/mirror#twin')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('the count-in before a match note', () => {
  it('says Ready until recording starts, then asks for the note', async () => {
    render(() => <MirrorApp entryIntent="voice-mirror" />)
    await vi.advanceTimersByTimeAsync(0)

    // The resumed run: mic, a passing level check, then the match intro.
    fireEvent.click(
      screen.getByRole('button', { name: 'Add my accuracy score' }),
    )
    await vi.advanceTimersByTimeAsync(1000)
    fireEvent.click(screen.getByRole('button', { name: "I'm ready" }))
    await vi.advanceTimersByTimeAsync(0)
    // The level check opened a short task of its own; count takes from here.
    f0.startTask.mockClear()

    // Before the first note plays.
    expect(stage()).toHaveTextContent('Ready…')
    expect(stage()).toHaveTextContent('Here comes the first note.')
    expect(stage().textContent).not.toMatch(/sing|your turn/i)

    // The tone has played; this is the count-in that used to say "sing it".
    await vi.advanceTimersByTimeAsync(2100)
    expect(stage()).toHaveTextContent('Ready…')
    expect(stage()).toHaveTextContent('Keep that note in your head.')
    expect(stage().querySelector('.mirror-countdown')).toHaveTextContent('2')
    expect(stage().textContent).not.toMatch(/sing|your turn/i)
    expect(f0.startTask).not.toHaveBeenCalled()

    // Recording starts: now, and only now, the screen asks for the note.
    await vi.advanceTimersByTimeAsync(2100)
    expect(f0.startTask).toHaveBeenCalledTimes(1)
    expect(stage()).toHaveTextContent('Your turn. Sing it back.')
    expect(stage()).not.toHaveTextContent('Ready…')

    // The take is over. The stub heard nothing, so the note comes round
    // again after a pause, and nothing asks for a note in between.
    await vi.advanceTimersByTimeAsync(3100)
    expect(screen.getByText(/one more try/)).toBeInTheDocument()
    expect(stage()).not.toHaveTextContent('Your turn')
    // The stub tone ends at once, so the retry is straight into its count-in.
    await vi.advanceTimersByTimeAsync(1300)
    expect(stage()).toHaveTextContent('Ready…')
    expect(stage()).not.toHaveTextContent('Your turn')
  })
})
