// ============================================================
// The Mirror's two result screens count their store chips apart
// ============================================================
//
// Both screens mount the same StoreChips, and mirrorEvents keeps an event
// name and a client id and nothing else, so the screen has to be in the
// name: a click on the Voice Mirror result and one on the Free Sing result
// must never land under the same event.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FreeSingResult } from '@/lib/mirror/free-sing'
import type { MirrorResult, RangeResult } from '@/lib/mirror/metrics'
import type * as MirrorFunnelModule from './funnel'

const mocks = vi.hoisted(() => ({ trackFunnel: vi.fn() }))

// Only the counter is replaced; STORE_CHIP_EVENTS is the table under test.
vi.mock('./funnel', async (importOriginal) => {
  const actual = await importOriginal<typeof MirrorFunnelModule>()
  return { ...actual, trackFunnel: mocks.trackFunnel }
})

import { FreeResults, Results } from './MirrorApp'

const RANGE: RangeResult = {
  lowMidi: 45,
  highMidi: 69,
  lowNote: 'A2',
  highNote: 'A4',
  semitones: 24,
  qualifyingMidis: [45, 50, 57, 62, 69],
  voiceHint: 'baritone',
}

const FREE_SING: FreeSingResult = {
  range: RANGE,
  homeMidi: 57,
  homeNote: 'A3',
  tessituraLowMidi: 52,
  tessituraHighMidi: 62,
  tessituraLowNote: 'E3',
  tessituraHighNote: 'D4',
  phrases: null,
  agilityMovesPerSec: 0.5,
  vibrato: null,
  voicedSeconds: 30,
}

const MIRROR: MirrorResult = { range: RANGE, accuracy: null, steadiness: null }

const noop = (): void => {}

/** Click App Store, then Google Play, and return what was counted. */
function clickBothStores(): unknown[][] {
  mocks.trackFunnel.mockClear()
  fireEvent.click(screen.getByRole('link', { name: /^Coming soon: App Store/ }))
  fireEvent.click(
    screen.getByRole('link', { name: /^Coming soon: Google Play/ }),
  )
  return mocks.trackFunnel.mock.calls
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('store chip clicks on the Mirror results', () => {
  it('counts the Free Sing result under its own names', () => {
    render(() => (
      <FreeResults
        result={FREE_SING}
        shareStatus={null}
        onShare={noop}
        onCopy={noop}
        onAgain={noop}
        onStartOver={noop}
        appUrl="/"
      />
    ))
    expect(clickBothStores()).toEqual([
      ['free_sing_app_store_click'],
      ['free_sing_google_play_click'],
    ])
  })

  it('counts the Voice Mirror result under its own names', () => {
    render(() => (
      <Results
        entryIntent="voice-mirror"
        result={MIRROR}
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
    expect(clickBothStores()).toEqual([
      ['results_app_store_click'],
      ['results_google_play_click'],
    ])
  })
})
