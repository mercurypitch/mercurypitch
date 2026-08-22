// ============================================================
// Guitar Night Score sheet tests — hierarchy, states, and modal containment.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarScoreTakeSummary } from '@/lib/guitar/guitar-score-history'
import { GuitarNightScoreSheet } from './GuitarNightScoreSheet'

function summary(
  savedAt: number,
  overrides: Partial<GuitarScoreTakeSummary> = {},
): GuitarScoreTakeSummary {
  return {
    schemaVersion: 1,
    savedAt,
    status: 'completed',
    pieceLabel: 'Velvet Changes',
    trackLabel: 'Lead guitar',
    range: { startBeat: 4, endBeat: 8 },
    inputKind: 'interface',
    basis: 'cumulative',
    score: 92,
    grade: 'A',
    counts: {
      targetCount: 6,
      judgedTargets: 5,
      hitTargets: 4,
      missedTargets: 1,
      skippedTargets: 1,
    },
    bestStreak: 3,
    evidence: { status: 'complete', detectedGapCount: 0 },
    recentOutcomes: [
      { outcome: 'hit', score: 98 },
      { outcome: 'miss', score: 0 },
      { outcome: 'skipped', score: null },
    ],
    ...overrides,
  }
}

describe('GuitarNightScoreSheet', () => {
  afterEach(cleanup)

  it('opens with an honest empty state before the first scored take', () => {
    render(() => (
      <GuitarNightScoreSheet
        open={true}
        current={null}
        history={[]}
        onClose={vi.fn()}
        onPlayAgain={vi.fn()}
      />
    ))

    const dialog = screen.getByRole('dialog', { name: 'Score' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByRole('heading', { name: 'No scored take yet' }),
    ).toBeTruthy()
    expect(
      screen.getByText(/Turn on Listening, play the written part/),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()
  })

  it('shows the latest result, scalar outcome trail, recent takes, and separate actions', () => {
    const playAgain = vi.fn()
    const reviewPhrase = vi.fn()
    const latest = summary(1_725_000_002_000)
    const previous = summary(1_725_000_001_000, {
      pieceLabel: 'Previous room',
      score: 78,
      grade: 'B',
    })

    render(() => (
      <GuitarNightScoreSheet
        open={true}
        current={latest}
        history={[previous, latest]}
        onClose={vi.fn()}
        onPlayAgain={playAgain}
        onReviewPhrase={reviewPhrase}
      />
    ))

    expect(screen.getByRole('heading', { name: 'Take complete' })).toBeTruthy()
    expect(screen.getByLabelText('Recent note outcomes').children).toHaveLength(
      3,
    )
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Previous room')).toBeTruthy()
    expect(screen.getByText('Direct input', { exact: false })).toBeTruthy()
    expect(
      screen.getByText(/Audio and input device identities are not saved/),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review a phrase' }))
    expect(playAgain).toHaveBeenCalledTimes(1)
    expect(reviewPhrase).toHaveBeenCalledTimes(1)
  })

  it('names insufficient evidence without manufacturing a grade', () => {
    const insufficient = summary(1_725_000_003_000, {
      score: 82,
      grade: null,
      counts: {
        targetCount: 3,
        judgedTargets: 3,
        hitTargets: 2,
        missedTargets: 1,
        skippedTargets: 0,
      },
      bestStreak: 2,
    })

    render(() => (
      <GuitarNightScoreSheet
        open={true}
        current={insufficient}
        history={[]}
        onClose={vi.fn()}
        onPlayAgain={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('heading', { name: 'Not enough notes to grade' }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'At least four judged notes are needed for a letter grade.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review a phrase' })).toBeNull()
  })

  it('labels a held take as partial and keeps it out of the recent list', () => {
    const held = summary(1_725_000_004_000, {
      status: 'partial',
      basis: 'rolling-16',
    })

    render(() => (
      <GuitarNightScoreSheet
        open={true}
        current={held}
        history={[]}
        onClose={vi.fn()}
        onPlayAgain={vi.fn()}
      />
    ))

    expect(screen.getByRole('heading', { name: 'Score held' })).toBeTruthy()
    expect(
      screen.getByText(
        'This held result stays on the stage and is not added to history.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Recent takes' })).toBeNull()
  })

  it('traps focus, closes on Escape or backdrop, and restores the trigger', async () => {
    const backdropClose = vi.fn()

    function Harness() {
      const [open, setOpen] = createSignal(false)
      let trigger: HTMLButtonElement | undefined
      return (
        <>
          <button ref={trigger} type="button" onClick={() => setOpen(true)}>
            Open score
          </button>
          <GuitarNightScoreSheet
            open={open()}
            current={summary(1_725_000_005_000)}
            history={[]}
            returnFocus={() => trigger ?? null}
            onClose={() => {
              backdropClose()
              setOpen(false)
            }}
            onPlayAgain={vi.fn()}
            onReviewPhrase={vi.fn()}
          />
        </>
      )
    }

    render(() => <Harness />)
    const trigger = screen.getByRole('button', { name: 'Open score' })
    fireEvent.click(trigger)
    await Promise.resolve()

    const dialog = screen.getByRole('dialog', { name: 'Score' })
    const close = screen.getByRole('button', { name: 'Close Score' })
    const last = screen.getByRole('button', { name: 'Review a phrase' })
    last.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    await Promise.resolve()
    fireEvent.click(screen.getByTestId('guitar-night-score-backdrop'))
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(backdropClose).toHaveBeenCalledTimes(2)
  })
})
