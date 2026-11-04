// The Ear Report in the room's light (MercReport.tsx): Merc's line from
// the numbers, the Index with its seals, each threshold drawn so finer is
// higher, each drill's map of mix-ups in its station's light, the drills
// with nothing yet together, and a way back by the button or Android's.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { homeItemId } from '@/lib/ear/item-bank'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { completeCalibrationRun, earPlayerRating, recordIdentificationAnswer, recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'
import { askRoomBack } from '@/stores/native-shell-store'
import { dateLabel } from '../instruments'
import { MercReport } from './MercReport'
import { roomOrigin, setRoomOrigin } from './session'

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 3, 12)

/** Write as if it happened `days` days before NOW. */
function daysAgo(days: number, write: () => void): void {
  vi.setSystemTime(NOW - days * DAY)
  write()
  vi.setSystemTime(NOW)
}

function hairline(
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

function seal(value: number): void {
  completeCalibrationRun([{ drillId: 'hairline', value, spread: 1 }])
}

function answer(
  drillId: string,
  itemId: string,
  expected: string,
  answered: string,
): void {
  recordIdentificationAnswer({
    drillId,
    itemId,
    itemDifficulty: earPlayerRating(drillId),
    correct: expected === answered,
    guessRate: 1 / 7,
    expected,
    answered,
  })
}

/** Home: `degree` played, `said` answered. */
function home(degree: number, said: number): void {
  answer('home', homeItemId(degree), `deg-${degree}`, `deg-${said}`)
}

function open(
  props: { onBack?: () => void; onNavigate?: () => void } = {},
): void {
  render(() => (
    <MercReport
      onBack={props.onBack ?? (() => undefined)}
      onNavigate={props.onNavigate ?? (() => undefined)}
      now={() => NOW}
    />
  ))
}

function plate(id: string): HTMLElement {
  const el = screen
    .getByTestId('merc-report-screen')
    .querySelector<HTMLElement>(`[data-plate="${id}"]`)
  if (el === null) throw new Error(`plate ${id} missing`)
  return el
}

function yAxis(trace: HTMLElement): number[] {
  return [...trace.querySelectorAll('[data-axis="y"]')].map((t) =>
    parseFloat(t.textContent ?? ''),
  )
}

describe('MercReport', () => {
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

  it('before the first seal: Merc invites one, and Calibrate opens it from the bench', () => {
    const onNavigate = vi.fn()
    setRoomOrigin({ kind: 'station', faculty: 'time' })
    open({ onNavigate })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Ear Report',
    )
    expect(screen.getByTestId('merc-report-line').textContent).toBe(
      'Nothing sealed yet. One calibration and this page starts to draw.',
    )
    const index = plate('index')
    expect(index.textContent).toContain('Not sealed')
    expect(index.textContent).toContain('No seal yet')
    expect(screen.queryByTestId('report-trace')).toBeNull()

    expect(screen.getByTestId('merc-report-quiet-moved').textContent).toBe(
      'Hairline and The Grid have no readings yet. Their first run draws the first mark.',
    )
    expect(screen.getByTestId('merc-report-quiet-mixups').textContent).toBe(
      'No mix-ups yet. Play Home, Leap, Stack or Contour and their maps fill in.',
    )

    fireEvent.click(screen.getByTestId('merc-report-calibrate'))
    expect(onNavigate).toHaveBeenCalledWith('calibration')
    expect(roomOrigin()).toEqual({ kind: 'bench' })
  })

  it('draws the Index the natural way up, with its move and its seals', () => {
    daysAgo(120, () => seal(30))
    daysAgo(30, () => seal(20))
    daysAgo(2, () => seal(12))
    open()

    const index = plate('index')
    expect(index.textContent).toContain('Sealed')
    const number = Number(screen.getByTestId('merc-report-index').textContent)
    const move = screen.getByTestId('merc-report-move').textContent ?? ''
    // A finer Hairline raises the Index, and the bench writes it so.
    expect(move).toMatch(/^\+\d+$/u)
    expect(index.textContent).toContain(`Sealed ${dateLabel(NOW - 2 * DAY)}.`)
    expect(index.textContent).toContain(
      `On ${dateLabel(NOW - 30 * DAY)} it was`,
    )

    // Twelve weeks by default: the 120-day-old seal is outside it.
    const trace = within(index).getByTestId('report-trace')
    expect(trace.getAttribute('data-sealed')).toBe('2')
    const axis = yAxis(trace)
    expect(axis[0]).toBeGreaterThan(axis[1])
    expect(trace.getAttribute('aria-label')).toMatch(/higher is better/u)
    expect(screen.getByTestId('merc-report-seals').textContent).toBe(
      'Two seals in twelve weeks. Only a calibration moves it.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(
      within(index).getByTestId('report-trace').getAttribute('data-sealed'),
    ).toBe('3')
    expect(screen.getByTestId('merc-report-seals').textContent).toBe(
      'Three seals so far. Only a calibration moves it.',
    )

    // Merc says the move since the seal before.
    expect(screen.getByTestId('merc-report-line').textContent).toBe(
      `Up ${move.slice(1)} since ${dateLabel(NOW - 30 * DAY)}. No mix-ups so far.`,
    )
    expect(number).toBeGreaterThan(0)
  })

  it('draws a threshold so finer is higher, and the range moves its trace', () => {
    daysAgo(100, () => hairline(31))
    daysAgo(40, () => hairline(22))
    daysAgo(10, () => hairline(14))
    daysAgo(2, () => hairline(9.4, 'calibration'))
    open()

    const card = plate('trace-hairline')
    expect(card.getAttribute('data-faculty')).toBe('resolution')
    expect(card.textContent).toContain('best 9.4 ¢')
    const trace = within(card).getByTestId('report-trace')
    expect(trace.getAttribute('data-points')).toBe('3')
    expect(trace.getAttribute('data-sealed')).toBe('1')
    const axis = yAxis(trace)
    // Inverted: the finer value printed on the top line.
    expect(axis[0]).toBeLessThan(axis[1])
    expect(trace.getAttribute('aria-label')).toMatch(/rising means finer/u)

    const all = screen.getByRole('button', { name: 'All' })
    fireEvent.click(all)
    expect(all.getAttribute('aria-pressed')).toBe('true')
    expect(
      within(card).getByTestId('report-trace').getAttribute('data-points'),
    ).toBe('4')
    fireEvent.click(screen.getByRole('button', { name: '4 weeks' }))
    expect(
      within(card).getByTestId('report-trace').getAttribute('data-points'),
    ).toBe('2')

    // The Grid has nothing: it waits in the quiet row.
    expect(screen.getByTestId('merc-report-quiet-moved').textContent).toBe(
      'The Grid has no readings yet. Its first run draws the first mark.',
    )
  })

  it("maps a drill's mix-ups in its station's light and says the worst", () => {
    for (let i = 0; i < 3; i += 1) home(4, 3)
    home(4, 4)
    home(7, 1)
    open()

    const card = plate('confusion-home')
    expect(card.getAttribute('data-faculty')).toBe('function')
    const map = within(card).getByRole('table')
    // Fa played, Mi answered: the hottest cell.
    const hot = within(map).getByLabelText('Fa answered as Mi: 3 times')
    expect(hot.textContent).toBe('3')
    expect(
      within(map).getByLabelText('Ti answered as Do: once').textContent,
    ).toBe('1')
    expect(within(map).getByLabelText('Fa: the right answer').textContent).toBe(
      '',
    )
    expect(within(map).getAllByRole('row')).toHaveLength(8)

    const slips = within(card).getAllByRole('listitem')
    expect(slips.map((li) => li.textContent)).toEqual([
      'You answer Fa as Mi3 times',
      'You answer Ti as Doonce',
    ])
    expect(screen.getByTestId('merc-report-line').textContent).toBe(
      'Nothing sealed yet. Fa slips to Mi the most.',
    )
    expect(screen.getByTestId('merc-report-quiet-mixups').textContent).toBe(
      'Leap, Stack and Contour have no mix-ups yet. Their maps fill in at the first one.',
    )
  })

  it("draws only a wide bank's items with a mix-up, by their short names", () => {
    answer('leap', 'leap:m3', 'leap:m3', 'leap:M3')
    answer('leap', 'leap:P5', 'leap:P5', 'leap:P4')
    open()

    const card = plate('confusion-leap')
    expect(card.textContent).toContain('Only the ones with a mix-up.')
    const heads = within(card)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(heads).toEqual(['What played', 'm3', 'M3', 'P4', 'P5'])
    expect(
      within(card).getByLabelText('Minor 3rd answered as Major 3rd: once'),
    ).toBeTruthy()
  })

  it('maps Contour by direction, with no right answers on its diagonal', () => {
    answer('contour', 'contour:400', 'same', 'up')
    open()

    const card = plate('confusion-contour')
    expect(card.getAttribute('data-faculty')).toBe('shape')
    expect(card.textContent).toContain('which way it went')
    expect(within(card).queryByLabelText(/the right answer/u)).toBeNull()
    expect(
      within(card).getByLabelText('Same answered as Up: once'),
    ).toBeTruthy()
  })

  it('goes back by its button and by Android back', () => {
    const onBack = vi.fn()
    open({ onBack })
    fireEvent.click(screen.getByRole('button', { name: 'Back to the Ear Lab' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(askRoomBack()).toBe(true)
    expect(onBack).toHaveBeenCalledTimes(2)
    cleanup()
    // Gone, it answers Back no more.
    expect(askRoomBack()).toBe(false)
  })

  it('opens at its own top, wherever the bench was scrolled to', () => {
    const [shown, setShown] = createSignal(false)
    let stage: HTMLDivElement | undefined
    render(() => (
      <div ref={stage} style={{ 'overflow-y': 'auto' }}>
        <Show when={shown()}>
          <MercReport
            onBack={() => undefined}
            onNavigate={() => undefined}
            now={() => NOW}
          />
        </Show>
      </div>
    ))
    if (stage === undefined) throw new Error('no stage')
    stage.scrollTop = 900
    setShown(true)
    expect(stage.scrollTop).toBe(0)
  })
})
