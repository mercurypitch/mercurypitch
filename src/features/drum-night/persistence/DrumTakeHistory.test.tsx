// ============================================================
// Drum Take History tests — explicit finish and bounded scalar summaries
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumTakeHistoryProps, DrumTakeHistoryView, DrumTakeSummaryRow, } from './DrumTakeHistory'
import { DrumTakeHistory } from './DrumTakeHistory'

afterEach(() => cleanup())

function take(
  index: number,
  overrides: Partial<DrumTakeSummaryRow> = {},
): DrumTakeSummaryRow {
  return {
    id: `take-${index}`,
    finishedAt: Date.parse(
      `2026-08-${String(10 + index).padStart(2, '0')}T12:00:00.000Z`,
    ),
    sourceLabel: `Pocket Study ${index}`,
    variationLabel: index % 2 === 0 ? 'Half-time' : 'Classic',
    rangeLabel: 'Bars 1–2',
    matchedHitCount: 14 + index,
    targetHitCount: 20,
    meanTimingOffsetMs: index % 2 === 0 ? -18 : 12,
    timingLabel: index % 2 === 0 ? 'Early' : 'Late',
    centredCount: 9,
    earlyCount: 3,
    lateCount: 2,
    meanVelocityOffset: index % 3 === 0 ? null : 7,
    inputLabel: index % 2 === 0 ? 'MIDI' : 'Touch and keys',
    ...overrides,
  }
}

function defaultView(
  overrides: Partial<DrumTakeHistoryView> = {},
): DrumTakeHistoryView {
  return {
    capturedHitCount: 18,
    canFinish: true,
    finish: { kind: 'idle' },
    replay: { state: 'idle', message: '' },
    history: {
      kind: 'ready',
      takes: [take(2), take(1)],
      skippedCount: 0,
      futureCount: 0,
    },
    ...overrides,
  }
}

function mountHistory(
  view: DrumTakeHistoryView = defaultView(),
  overrides: Partial<DrumTakeHistoryProps> = {},
) {
  const props: DrumTakeHistoryProps = {
    mode: 'expanded',
    view,
    onFinishTake: vi.fn(),
    onRetryFinish: vi.fn(),
    onDiscardFailedTake: vi.fn(),
    onKeepReplay: vi.fn(),
    onDismissReplay: vi.fn(),
    onLoadHistory: vi.fn(),
    onRetryHistory: vi.fn(),
    ...overrides,
  }
  const mounted = render(() => <DrumTakeHistory {...props} />)
  return { ...mounted, props }
}

describe('DrumTakeHistory', () => {
  it('keeps compact mode action-only and finishes only by explicit click', () => {
    const onFinishTake = vi.fn()
    const onLoadHistory = vi.fn()
    mountHistory(defaultView(), {
      mode: 'compact',
      onFinishTake,
      onLoadHistory,
    })

    expect(screen.getByText('18 strikes captured')).toBeVisible()
    expect(
      screen.getByText(/Save a compact timing and dynamics summary/i),
    ).toBeVisible()
    expect(screen.queryByText('Recent takes')).not.toBeInTheDocument()
    expect(onLoadHistory).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Finish take' }))
    expect(onFinishTake).toHaveBeenCalledOnce()
  })

  it('renders saving, saved, unavailable, and retryable failure truth', () => {
    const saving = mountHistory(defaultView({ finish: { kind: 'saving' } }), {
      mode: 'compact',
    })
    expect(screen.getByText('Writing the compact summary…')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Saving take' })).toBeDisabled()
    saving.unmount()

    const saved = mountHistory(
      defaultView({
        capturedHitCount: 0,
        finish: { kind: 'saved' },
      }),
      { mode: 'compact' },
    )
    expect(screen.getByText('Take summary saved on this device.')).toBeVisible()
    saved.unmount()

    const unavailable = mountHistory(
      defaultView({
        canFinish: false,
        unavailableReason: 'An authored score is needed for comparison.',
      }),
      { mode: 'compact' },
    )
    expect(screen.getByText('This take cannot be finished yet.')).toBeVisible()
    expect(
      screen.getByText('An authored score is needed for comparison.'),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Finish take' }),
    ).not.toBeInTheDocument()
    unavailable.unmount()

    const onRetryFinish = vi.fn()
    const onDiscardFailedTake = vi.fn()
    mountHistory(
      defaultView({
        finish: {
          kind: 'error',
          message: 'The take could not be written. Nothing was cleared.',
        },
      }),
      { mode: 'compact', onRetryFinish, onDiscardFailedTake },
    )
    expect(
      screen.getByText('Your captured evidence is still here.'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetryFinish).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Discard take' }))
    expect(screen.getByText('Discard this unsaved take?')).toBeVisible()
    expect(onDiscardFailedTake).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep evidence' }))
    expect(onDiscardFailedTake).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard take' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, discard' }))
    expect(onDiscardFailedTake).toHaveBeenCalledOnce()
  })

  it('offers explicit Keep and Not now actions only after the summary succeeds', () => {
    const onKeepReplay = vi.fn()
    const onDismissReplay = vi.fn()
    mountHistory(
      defaultView({
        capturedHitCount: 0,
        finish: { kind: 'saved' },
        replay: {
          state: 'ready',
          message: 'Live-kit replay ready. Nothing is saved until you keep it.',
        },
      }),
      { mode: 'compact', onKeepReplay, onDismissReplay },
    )

    expect(
      screen.getByText(/nothing is saved until you keep it/i),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Keep in Hear Yourself' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onKeepReplay).toHaveBeenCalledOnce()
    expect(onDismissReplay).toHaveBeenCalledOnce()
  })

  it('loads history only when the expanded lazy surface mounts', () => {
    const onLoadHistory = vi.fn()
    mountHistory(defaultView({ history: { kind: 'idle' } }), { onLoadHistory })

    expect(onLoadHistory).toHaveBeenCalledOnce()
    expect(screen.getByText('Opening recent takes')).toBeVisible()
  })

  it('shows the newest six takes with honest scalar labels and privacy', () => {
    const takes = Array.from({ length: 7 }, (_, index) => take(index + 1))
    mountHistory(
      defaultView({
        history: {
          kind: 'ready',
          takes,
          skippedCount: 0,
          futureCount: 0,
        },
      }),
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(6)
    expect(within(rows[0]!).getByText('Pocket Study 7')).toBeVisible()
    expect(within(rows[0]!).getByText('LATEST TAKE')).toBeVisible()
    expect(screen.queryByText('Pocket Study 1')).not.toBeInTheDocument()
    expect(within(rows[1]!).getByText('−18 ms · Early')).toBeVisible()
    expect(within(rows[1]!).getByText('Not measured')).toBeVisible()
    expect(
      within(rows[0]!).getByText('3 early · 9 centred · 2 late'),
    ).toBeVisible()
    expect(
      screen.getByText(/authored audio.*raw MIDI.*device identity stay out/i),
    ).toBeVisible()
  })

  it('keeps the five desktop facts inside the expanded coach ledger', () => {
    const css = readFileSync(
      'src/features/drum-night/persistence/DrumTakeHistory.module.css',
      'utf8',
    )
    const rowRule = css.match(/\.takeRow\s*\{[^}]*\}/)?.[0] ?? ''
    const factsRule = css.match(/\.takeFacts\s*\{[^}]*\}/)?.[0] ?? ''
    const factCellRule = css.match(/\.takeFacts > div\s*\{[^}]*\}/)?.[0] ?? ''
    const rowMinimums = Array.from(
      rowRule.matchAll(/minmax\((\d+)px,/g),
      (match) => Number(match[1]),
    )
    const factMinimums = Array.from(
      factsRule.matchAll(/minmax\((\d+)px,/g),
      (match) => Number(match[1]),
    )
    const rowGap = Number(rowRule.match(/gap:\s*(\d+)px/)?.[1] ?? NaN)

    expect(rowMinimums).toHaveLength(2)
    expect(factMinimums).toHaveLength(5)
    expect(
      factMinimums.reduce((sum, width) => sum + width, 0),
    ).toBeLessThanOrEqual(rowMinimums[1]!)
    expect(rowMinimums[0]! + rowMinimums[1]! + rowGap).toBeLessThanOrEqual(710)
    expect(factCellRule).toContain('padding-inline: 8px')
  })

  it('offers history retry and reports skipped and future summaries', () => {
    const onRetryHistory = vi.fn()
    const failed = mountHistory(
      defaultView({
        history: {
          kind: 'error',
          message: 'The current take and coach have not changed.',
        },
      }),
      { onRetryHistory },
    )
    expect(screen.getByText('Recent takes could not be opened')).toBeVisible()
    fireEvent.click(
      within(
        screen.getByText('Recent takes could not be opened').parentElement!
          .parentElement!,
      ).getByRole('button', { name: 'Try again' }),
    )
    expect(onRetryHistory).toHaveBeenCalledOnce()
    failed.unmount()

    mountHistory(
      defaultView({
        capturedHitCount: 0,
        history: {
          kind: 'ready',
          takes: [],
          skippedCount: 2,
          futureCount: 1,
        },
      }),
    )
    expect(screen.getByText('No finished takes yet')).toBeVisible()
    expect(screen.getByText(/2 take summaries.*skipped/i)).toBeVisible()
    expect(screen.getByText(/1 take summary.*newer Drum Night/i)).toBeVisible()
  })
})
