// ============================================================
// Performance Take Score Card tests — source-aware saved evidence
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import { PerformanceTakeScoreCard } from './PerformanceTakeScoreCard'

function take(
  source: VoiceTakeRecord['source'],
  metrics: Record<string, unknown>,
): VoiceTakeRecord {
  return {
    id: `${source}-take`,
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
    source,
    comparisonKey: `${source}:fixture:v1`,
    contextVersion: 1,
    capturedAt: '2026-08-31T12:00:00.000Z',
    durationMs: 4_000,
    mimeType: 'audio/wav',
    sizeBytes: 128,
    peaks: [0.2, 0.8],
    title: 'Night take',
    favorite: false,
    contextJson: '{}',
    metricsJson: JSON.stringify(metrics),
    metricsVersion: 1,
  }
}

afterEach(cleanup)

describe('PerformanceTakeScoreCard', () => {
  it('shows saved score evidence beside a replay', () => {
    render(() => (
      <PerformanceTakeScoreCard
        take={take('piano-night', {
          accuracyPercent: 92,
          score: 2_200,
          hits: 22,
          misses: 2,
          judgedNotes: 24,
          skippedNotes: 1,
          totalNotes: 25,
          bestStreak: 9,
          playedNoteCount: 23,
          capturedDurationMs: 4_000,
        })}
      />
    ))

    expect(
      screen.getByRole('region', {
        name: 'Piano Night score for Night take',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Grade/)).not.toBeInTheDocument()
  })

  it('keeps completed Guitar counts visible when the aggregate is unscored', () => {
    render(() => (
      <PerformanceTakeScoreCard
        take={take('guitar-night', {
          score: null,
          grade: null,
          targetCount: 8,
          judgedTargets: 0,
          hitTargets: 0,
          missedTargets: 0,
          skippedTargets: 8,
          bestStreak: 0,
          evidenceStatus: 'event-gap',
          detectedGapCount: 1,
          basis: 'cumulative',
        })}
      />
    ))

    expect(
      screen.getByRole('region', {
        name: 'Guitar Night score for Night take',
      }),
    ).toHaveTextContent('Unscored')
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Grade/)).not.toBeInTheDocument()
  })

  it('leaves no score shell for unrelated take metrics', () => {
    const { container } = render(() => (
      <PerformanceTakeScoreCard take={take('freeform', { score: 99 })} />
    ))

    expect(container).toBeEmptyDOMElement()
  })
})
