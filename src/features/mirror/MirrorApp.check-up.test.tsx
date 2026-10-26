// ============================================================
// Voice Mirror: Check-up mode, and the then-and-now panel's place
// ============================================================
//
// Home's weekly Check-up card opens /mirror?checkup=1. The landing then says
// it is the Check-up and nothing else changes; a shared voiceprint's `?v=`
// link still opens the card it carries. On the results the panel takes the
// change line's place when there is a comparison, and without one the results
// are as they were. What the panel itself says is ThenAndNowPanel.test.tsx's.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { thenAndNow } from '@/lib/check-up/then-and-now'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { voiceprintShareUrl } from '@/lib/mirror/shared-voiceprint'
import type * as MirrorFunnel from './funnel'
import { MirrorApp, Results } from './MirrorApp'
import type { ThenAndNowView } from './ThenAndNowPanel'

vi.mock('./funnel', async (importOriginal) => ({
  ...(await importOriginal<typeof MirrorFunnel>()),
  trackFunnel: vi.fn(),
}))
// The share card needs a 2D canvas, which jsdom does not have.
vi.mock('@/features/progress/then-and-now-card', () => ({
  renderThenAndNowCard: async () => document.createElement('canvas'),
  shareThenAndNowCard: async () => ({ outcome: 'dismissed' }),
}))

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

function openMirror(address: string): void {
  window.history.replaceState(null, '', address)
  render(() => <MirrorApp entryIntent="voice-mirror" />)
}

describe('Check-up mode', () => {
  it('names the weekly Check-up on the landing when Home sent the visit', () => {
    openMirror('/mirror?checkup=1')

    expect(document.querySelector('.mirror-eyebrow')).toHaveTextContent(
      'Weekly Check-up',
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Meet your voice twin.',
    )
    expect(
      screen.getByRole('button', { name: 'Find my voice twin' }),
    ).toBeInTheDocument()
  })

  it('leaves the landing as it was without the flag', () => {
    openMirror('/mirror')

    expect(document.querySelector('.mirror-eyebrow')).toHaveTextContent(
      'MercuryPitch',
    )
    expect(screen.queryByText('Weekly Check-up')).toBeNull()
  })

  it('still opens a shared voiceprint from its ?v= link, flag or not', () => {
    const shared = new URL(
      voiceprintShareUrl(
        {
          lowMidi: 48,
          highMidi: 74,
          semitones: 26,
          accuracy: 87,
          steadiness: 92,
        },
        'Freddie Mercury',
      ),
    )

    openMirror(`/mirror${shared.search}&checkup=1`)

    expect(screen.getByText('Someone sent you this')).toBeInTheDocument()
    expect(screen.getByText('C3 – D5')).toBeInTheDocument()
    expect(screen.queryByText('Weekly Check-up')).toBeNull()
  })
})

// ── The results ────────────────────────────────────────────────────────

const RESULT: MirrorResult = {
  range: {
    lowMidi: 45,
    highMidi: 69,
    lowNote: 'A2',
    highNote: 'A4',
    semitones: 24,
    qualifyingMidis: [45, 57, 69],
    voiceHint: 'baritone',
  },
  accuracy: null,
  steadiness: null,
}

const DAY = 24 * 60 * 60 * 1000

function take(day: number): VoiceprintRecord {
  return {
    id: `take-${day}`,
    takenAt: new Date(
      Date.parse('2026-10-05T12:00:00Z') + day * DAY,
    ).toISOString(),
    twin: null,
    source: 'mirror',
    summary: {
      lowMidi: 43,
      highMidi: 60,
      semitones: 17,
      accuracy: 60,
      steadiness: 70,
    },
  }
}

function comparisonView(): ThenAndNowView {
  const comparison = thenAndNow([take(0), take(9)])
  if (comparison === null) throw new Error('no comparison')
  return { comparison, practice: 0 }
}

const noop = (): void => {}

function renderResults(thenAndNowView: ThenAndNowView | null): void {
  render(() => (
    <Results
      entryIntent="voice-mirror"
      result={RESULT}
      deltaLine="Since 5 Oct: span 17 to 24 semitones"
      thenAndNow={thenAndNowView}
      onSingAgain={noop}
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
}

describe('the then-and-now panel on the results', () => {
  it('takes the change line’s place when the history holds a week', async () => {
    renderResults(comparisonView())

    expect(await screen.findByTestId('mirror-then-and-now')).toBeInTheDocument()
    expect(
      screen.queryByText('Since 5 Oct: span 17 to 24 semitones'),
    ).toBeNull()
  })

  it('leaves the results as they were without a comparison', () => {
    renderResults(null)

    expect(
      screen.getByText('Since 5 Oct: span 17 to 24 semitones'),
    ).toHaveClass('mirror-delta')
    expect(screen.queryByTestId('mirror-then-and-now')).toBeNull()
  })
})
