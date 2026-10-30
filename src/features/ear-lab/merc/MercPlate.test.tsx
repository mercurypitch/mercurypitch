// The plates on the room's stage: a staircase's reading draws its way
// with the misses on it and says where it slipped; a rated run's dots
// fill in order while its number moves; a seal draws its three tracks
// over the glass. Under reduced motion each is drawn whole at once, and
// the reading itself is always in the words, whatever the count shows.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RatingPlate, ThresholdPlate, TracePoint, } from '@/features/ear-lab/stage-room'
import type * as EarLabStore from '@/stores/ear-lab-store'
import { PlateNext, PlateOnDesk } from './MercPlate'

const motion = vi.hoisted(() => ({ reduced: true }))
vi.mock('@/components/room-kit/reduced-motion', () => ({
  prefersReducedMotion: () => motion.reduced,
}))

const seals = vi.hoisted(() => ({
  history: [] as Array<{ index: number; at: number }>,
}))
vi.mock('@/stores/ear-lab-store', async (importOriginal) => ({
  ...(await importOriginal<typeof EarLabStore>()),
  calibrationHistory: () => seals.history,
}))

beforeEach(() => {
  motion.reduced = true
  seals.history = []
})
afterEach(cleanup)

const RUN: TracePoint[] = [
  { level: 50, turn: false, correct: true },
  { level: 42, turn: false, correct: true },
  { level: 35, turn: true, correct: false },
  { level: 42, turn: false, correct: true },
  { level: 42, turn: true, correct: true },
  { level: 35, turn: false, correct: true },
]

const hairline = (over: Partial<ThresholdPlate> = {}): ThresholdPlate => ({
  kind: 'threshold',
  value: 9.4,
  format: (value) => value.toFixed(1),
  unit: 'cents',
  unitShort: '¢',
  lowerIsBetter: true,
  previous: 11.2,
  calibration: false,
  provisional: false,
  note: 'Practice run: the glass is not marked. A sealed calibration marks it.',
  trace: RUN,
  trials: 6,
  turns: 2,
  replays: 1,
  ...over,
})

const rated = (over: Partial<RatingPlate> = {}): RatingPlate => ({
  kind: 'rating',
  rating: 1203,
  before: 1184,
  source: 'Function rating',
  settling: null,
  rounds: 4,
  right: 2,
  outcomes: [
    { correct: true, title: 'Round 1' },
    { correct: false, title: 'Round 2' },
    { correct: true, title: 'Round 3' },
    { correct: false, skipped: true, title: 'Round 4' },
  ],
  slips: [],
  ...over,
})

function plate(shown: ThresholdPlate | RatingPlate): void {
  render(() => (
    <PlateOnDesk
      plate={shown}
      own={null}
      drillId="hairline"
      short={false}
      faculty="Resolution"
    />
  ))
}

const dots = (): Array<string | null> =>
  Array.from(document.querySelectorAll('[data-dot]')).map((dot) =>
    dot.getAttribute('data-dot'),
  )

describe("a staircase's plate", () => {
  it('draws the way, says where it slipped, and keeps the reading in words', () => {
    plate(hairline())
    const status = screen.getByRole('status', { name: 'Reading' })
    expect(status).toHaveTextContent('Practice')
    expect(status).toHaveTextContent('9.4 ¢')
    expect(status).toHaveTextContent('cents · lower is finer')
    expect(status).toHaveTextContent('Finer than last time (11.2 ¢)')
    expect(status).toHaveTextContent('6 questions · 2 turns · 1 replay')
    expect(
      document.querySelector('[data-instrument="plate-staircase"]'),
    ).not.toBeNull()
    expect(screen.getByTestId('merc-plate-slips')).toHaveTextContent(
      'Where it slipped1 miss, at 35.0 ¢',
    )
    // A reading's own note is the bench's business.
    expect(status).not.toHaveTextContent('the glass is not marked')
  })

  it('says why there is nothing to read when the run stopped first', () => {
    plate(
      hairline({
        value: null,
        trace: RUN.slice(0, 1),
        note: 'Stopped before the staircase turned. Nothing to read yet, and nothing marked.',
      }),
    )
    const status = screen.getByRole('status', { name: 'Reading' })
    expect(status).toHaveTextContent('Stopped')
    expect(status).toHaveTextContent('Nothing to read yet, and nothing marked.')
    expect(
      document.querySelector('[data-instrument="plate-staircase"]'),
    ).toBeNull()
    expect(screen.queryByTestId('merc-plate-slips')).toBeNull()
  })

  it('counts from the top of the way as it starts to draw', () => {
    motion.reduced = false
    plate(hairline())
    const status = screen.getByRole('status', { name: 'Reading' })
    // The eye sees the way's first level; the words keep the reading.
    expect(status.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '50.0',
    )
    expect(status).toHaveTextContent('9.4 ¢')
  })
})

describe("a rated run's plate", () => {
  it('fills its dots in order, the number moving with them', () => {
    motion.reduced = false
    plate(rated())
    expect(dots()).toEqual(['coming', 'coming', 'coming', 'coming'])
    const status = screen.getByRole('status', { name: 'Reading' })
    expect(status.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '1184',
    )
  })

  it('is whole at once under reduced motion, with its move beside it', () => {
    plate(rated())
    expect(dots()).toEqual(['right', 'missed', 'right', 'skipped'])
    const status = screen.getByRole('status', { name: 'Reading' })
    expect(status).toHaveTextContent('1203+19')
    expect(status).toHaveTextContent('Function rating · higher is surer')
    expect(status).toHaveTextContent('Up 19 from 1184')
    expect(status).toHaveTextContent('4 rounds · 2 named · no replays')
  })
})

describe("a calibration's seal", () => {
  const sealed = (): ThresholdPlate =>
    hairline({
      value: 9.9,
      calibration: true,
      markedIndex: 251,
      tracks: [9.4, 10.2, 9.9],
      trials: 58,
      trace: [0, 1, 2].flatMap((track) =>
        RUN.map((point) => ({ ...point, track })),
      ),
    })

  it('marks the glass, with the three tracks it was read from', () => {
    seals.history = [
      { index: 251, at: Date.now() },
      { index: 243, at: Date.UTC(2026, 9, 21, 12) },
    ]
    plate(sealed())
    const status = screen.getByRole('status', { name: 'The sealed reading' })
    expect(status).toHaveTextContent('Mercury Index')
    expect(status).toHaveTextContent(/Up 8 from 243, sealed /)
    expect(status).toHaveTextContent('Resolution, sealed: 9.9 ¢')
    expect(status).toHaveTextContent(
      'Tracks A 9.4 ¢ · B 10.2 ¢ · C 9.9 ¢ · 58 questions',
    )
    expect(
      document.querySelector('[data-instrument="plate-tracks"]'),
    ).not.toBeNull()
    expect(screen.getByTestId('merc-glass')).toHaveAccessibleName(
      /sealed index 251.*the old mark at 243 left faint/,
    )
  })

  it('counts up from the old mark', () => {
    motion.reduced = false
    seals.history = [
      { index: 251, at: Date.now() },
      { index: 243, at: Date.UTC(2026, 9, 21, 12) },
    ]
    plate(sealed())
    const status = screen.getByRole('status', { name: 'The sealed reading' })
    expect(status.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '243',
    )
  })

  it('ends on Done, with what the Index counts under it', () => {
    render(() => (
      <PlateNext
        sealed
        label="Done"
        again
        calibrate={false}
        onFollow={() => undefined}
        onCalibrate={() => undefined}
        onAgain={() => undefined}
        onDone={() => undefined}
        onRulers={() => undefined}
      />
    ))
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Done', 'What the Index counts'])
  })
})
