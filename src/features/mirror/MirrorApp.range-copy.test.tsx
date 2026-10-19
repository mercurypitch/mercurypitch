// ============================================================
// The Vocal Range Test's words, on the real page
// ============================================================
//
// Find Your Pitch links the test only once it asks for nothing past a
// comfortable top, assigns no voice type from a range and infers nothing it
// did not measure (Lesson 7 FACTS 69 and 70; REQ-GVC-045, REQ-GVC-072). So:
// the first glide goes to the highest comfortable note; the twin screen
// names a famous singer of the type the range overlaps most, as a guide; and
// the accuracy note says what the five notes did, with no word about the ear.
//
// The page is driven the way the count-in test drives it: a stub microphone,
// a reference tone that ends at once, and fake clocks.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type * as MicManager from '@/lib/mic-manager'
import { saveCheckpoint } from '@/lib/mirror/checkpoint'
import type { MatchBand, MirrorResult, RangeResult } from '@/lib/mirror/metrics'
import { markHowItWorksSeen } from '@/lib/mirror/onboarding'
import { singerForRange } from '@/lib/mirror/singer-match'
import { MirrorApp, Results } from './MirrorApp'

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

const RANGE: RangeResult = {
  lowMidi: 48,
  highMidi: 74,
  lowNote: 'C3',
  highNote: 'D5',
  semitones: 26,
  qualifyingMidis: Array.from({ length: 27 }, (_, i) => 48 + i),
  voiceHint: 'Tenor',
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
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('the Vocal Range Test, sung', () => {
  it('sends the first glide to the highest comfortable note', async () => {
    markHowItWorksSeen(localStorage)
    window.history.replaceState(null, '', '/vocal-range-test')
    const { container } = render(() => <MirrorApp entryIntent="vocal-range" />)

    fireEvent.click(screen.getByRole('button', { name: 'Test my vocal range' }))
    await vi.advanceTimersByTimeAsync(1000)

    const heading = [...container.querySelectorAll('h2')].find(
      (h2) => h2.textContent === 'Glide up',
    )
    expect(heading?.nextElementSibling?.tagName).toBe('P')
    expect(heading?.nextElementSibling?.textContent).toBe(
      'Slide like a siren, from your lowest comfy note to your highest comfortable note.',
    )
  })

  it('names the twin as a famous singer of the overlapping type, a guide and not a verdict', async () => {
    saveCheckpoint(localStorage, {
      glides: [glide(48, 74), glide(74, 48)],
      hold: glide(60, 60),
      targets: [60, 62, 64, 65, 67],
      range: RANGE,
    })
    window.history.replaceState(null, '', '/mirror#twin')
    const { container } = render(() => <MirrorApp entryIntent="voice-mirror" />)
    await vi.advanceTimersByTimeAsync(0)

    const legend = singerForRange(RANGE)
    const line = container.querySelector('.mirror-peek > p:not([class])')
    expect(line?.textContent).toBe(
      `${legend}: a famous tenor, the voice type your range overlaps most. A broad guide, not a verdict.`,
    )
    expect(container.querySelector('.mirror-peek')?.textContent).not.toMatch(
      /shares your voice type|yours now/iu,
    )
  })
})

describe('the Voice Mirror accuracy note', () => {
  function resultWith(bands: readonly MatchBand[]): MirrorResult {
    return {
      range: RANGE,
      accuracy: {
        score: 70,
        scoopMedianMs: null,
        takes: bands.map((band, i) => ({
          targetMidi: 60 + i,
          locked: band !== 'no-voice',
          deviationCents: 20,
          band,
          score: 70,
          onsetMs: null,
        })),
      },
      steadiness: null,
    }
  }

  function accuracyNote(result: MirrorResult): string | null | undefined {
    const noop = (): void => {}
    const { container } = render(() => (
      <Results
        entryIntent="vocal-range"
        result={result}
        deltaLine={null}
        shareStatus={null}
        revealed={false}
        revealMode="flip"
        twinReady={false}
        includeTrace={false}
        onToggleTrace={noop}
        cardFormat="square"
        onToggleFormat={noop}
        twinTrace={false}
        onToggleTwinTrace={noop}
        twinData={false}
        onToggleTwinData={noop}
        onToggleReveal={noop}
        onShare={noop}
        onShareTwin={noop}
        onCopy={noop}
        onCopyLink={noop}
        onCosmic={noop}
        onStartOver={noop}
        appUrl="/"
        voiceprintRef={noop}
      />
    ))
    return container.querySelector('.mirror-notecard-left > p')?.textContent
  }

  it('says how many notes landed and claims nothing about the ear', () => {
    expect(
      accuracyNote(resultWith(['hit', 'bullseye', 'hit', 'close', 'miss'])),
    ).toBe('You hit 3 of 5 targets within a third of a semitone.')
  })

  it('keeps the baseline sentence when fewer than three land', () => {
    expect(
      accuracyNote(resultWith(['hit', 'close', 'miss', 'miss', 'hit'])),
    ).toBe(
      "You hit 2 of 5 targets within a third of a semitone. That's a trainable skill, and this is the honest baseline.",
    )
  })
})
