// ============================================================
// The Ear Report inside the room: plates that say what moved and
// what you confuse, a range that moves the traces, axes printed
// honestly — the smallest threshold at the top, the index the
// natural way up.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { homeItemId } from '@/lib/ear/item-bank'
import { completeCalibrationRun, earPlayerRating, recordIdentificationAnswer, recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'
import { EarReport } from './EarReport'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 7, 27, 12)

/** Write as if it happened `daysAgo` days before NOW. */
function daysAgo(days: number, write: () => void): void {
  vi.setSystemTime(NOW - days * DAY)
  write()
}

function reading(
  value: number,
  source: 'practice' | 'calibration' = 'practice',
): void {
  recordThresholdReading({
    drillId: 'hairline',
    value,
    spread: 1,
    tracks: source === 'calibration' ? 3 : 1,
    source,
  })
}

function answer(expected: string, answered: string): void {
  recordIdentificationAnswer({
    drillId: 'home',
    itemId: homeItemId(Number(expected.replace('deg-', ''))),
    itemDifficulty: earPlayerRating('home'),
    correct: expected === answered,
    guessRate: 1 / 7,
    expected,
    answered,
  })
}

function plate(id: string): HTMLElement {
  const el = screen
    .getByTestId('ear-report')
    .querySelector<HTMLElement>(`[data-plate="${id}"]`)
  if (!el) throw new Error(`plate ${id} missing`)
  return el
}

function yAxis(trace: HTMLElement): number[] {
  return [...trace.querySelectorAll('[data-axis="y"]')].map((t) =>
    parseFloat(t.textContent ?? ''),
  )
}

describe('EarReport', () => {
  beforeEach(() => {
    localStorage.clear()
    resetEarLabStore()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('says so, in words, when nothing has been measured', () => {
    render(() => <EarReport onBack={() => undefined} now={() => NOW} />)
    expect(screen.getByTestId('ear-report')).toBeTruthy()
    expect(screen.getByText(/No sealed calibrations yet/)).toBeTruthy()
    expect(screen.getByText(/No threshold readings yet/)).toBeTruthy()
    expect(screen.getAllByText(/No misses recorded yet/)).toHaveLength(4)
    expect(screen.queryByTestId('ear-trace')).toBeNull()
  })

  it('draws a threshold inverted with an honest axis, and the range moves it', () => {
    daysAgo(100, () => reading(31))
    daysAgo(40, () => reading(22))
    daysAgo(10, () => reading(14))
    daysAgo(2, () => reading(9.4, 'calibration'))
    render(() => <EarReport onBack={() => undefined} now={() => NOW} />)

    const hairline = plate('trace-hairline')
    const trace = within(hairline).getByTestId('ear-trace')
    // Twelve weeks by default: the hundred-day-old reading is outside.
    expect(trace.getAttribute('data-points')).toBe('3')
    const axis = yAxis(trace)
    expect(axis).toHaveLength(3)
    expect(axis[0]).toBeLessThan(axis[2])
    expect(trace.getAttribute('aria-label')).toMatch(/rising means improving/)
    expect(hairline.textContent).toContain('best 9.4¢')

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(
      screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      within(hairline).getByTestId('ear-trace').getAttribute('data-points'),
    ).toBe('4')

    fireEvent.click(screen.getByRole('button', { name: '4 wk' }))
    expect(
      within(hairline).getByTestId('ear-trace').getAttribute('data-points'),
    ).toBe('2')
  })

  it('marks the Mercury Index the natural way up and reads the delta', () => {
    daysAgo(30, () =>
      completeCalibrationRun([{ drillId: 'hairline', value: 20, spread: 1 }]),
    )
    daysAgo(1, () =>
      completeCalibrationRun([{ drillId: 'hairline', value: 12, spread: 1 }]),
    )
    render(() => <EarReport onBack={() => undefined} now={() => NOW} />)

    const index = plate('index')
    const trace = within(index).getByTestId('ear-trace')
    expect(trace.getAttribute('data-points')).toBe('2')
    const axis = yAxis(trace)
    expect(axis[0]).toBe(1000)
    expect(axis[2]).toBe(0)
    expect(trace.getAttribute('aria-label')).toMatch(/higher is better/)
    expect(index.textContent).toMatch(
      /Sealed .+ at \d+ of 1000 · [+-]?\d+ since/,
    )
  })

  it('maps confusions with the diagonal in signal and says the worst pair', () => {
    for (let i = 0; i < 3; i += 1) answer('deg-4', 'deg-4')
    for (let i = 0; i < 3; i += 1) answer('deg-4', 'deg-5')
    answer('deg-7', 'deg-1')
    render(() => <EarReport onBack={() => undefined} now={() => NOW} />)

    const home = plate('confusion-home')
    const table = within(home).getByRole('table')
    expect(table.getAttribute('aria-label')).toMatch(/rows are what played/)
    expect(
      within(table).getByTitle('Heard Fa (4), answered Sol (5): 3'),
    ).toBeTruthy()
    expect(
      within(table).getByTitle('Heard Fa (4), answered right: 3'),
    ).toBeTruthy()
    expect(home.textContent).toMatch(
      /You answer Fa \(4\) as Sol \(5\) on \d+% of attempts/,
    )
    expect(plate('confusion-contour').textContent).toContain('No misses')
  })

  it('goes back to the bench', () => {
    const onBack = vi.fn()
    render(() => <EarReport onBack={onBack} now={() => NOW} />)
    fireEvent.click(screen.getByLabelText('Back to the bench'))
    expect(onBack).toHaveBeenCalled()
  })
})
