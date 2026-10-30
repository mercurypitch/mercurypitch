// The plate's staircases: a practice run's way draws while the number
// counts along it, its turns and misses lit as the line reaches them,
// then the reading across; a calibration's three tracks are each named
// with their own reading.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { TracePoint } from '@/features/ear-lab/stage-room'
import { STILL_MS } from './clock'
import { countedLevel, LitStaircase, LitTracks, STAIRS_MS, } from './LitStaircase'

afterEach(cleanup)

const RUN: TracePoint[] = [
  { level: 50, turn: false, correct: true },
  { level: 42, turn: false, correct: true },
  { level: 35, turn: true, correct: false },
  { level: 42, turn: false, correct: true },
  { level: 42, turn: true, correct: true },
  { level: 35, turn: false, correct: true },
]

const parts = (name: string): SVGElement[] =>
  Array.from(document.querySelectorAll<SVGElement>(`[data-part="${name}"]`))

describe("a practice run's staircase", () => {
  it('counts along the way it draws, then settles on the reading', () => {
    expect(countedLevel(RUN, 38, 0)).toBe(50)
    expect(countedLevel(RUN, 38, STAIRS_MS.to)).toBe(35)
    expect(countedLevel(RUN, 38, STAIRS_MS.settled)).toBe(38)
    expect(countedLevel(RUN, 38, STILL_MS)).toBe(38)
  })

  it('lights no miss before the line reaches it', () => {
    render(() => <LitStaircase points={RUN} reading={38} unitShort="¢" t={0} />)
    expect(parts('miss').map((dot) => dot.getAttribute('opacity'))).toEqual([
      '0',
    ])
    expect(parts('reading')).toHaveLength(0)
  })

  it('is drawn whole at the end: turns, the miss and the reading', () => {
    render(() => (
      <LitStaircase points={RUN} reading={38} unitShort="¢" t={STILL_MS} />
    ))
    expect(parts('miss').map((dot) => dot.getAttribute('opacity'))).toEqual([
      '1',
    ])
    // The turn at the miss is drawn as the miss.
    expect(parts('turn')).toHaveLength(1)
    expect(parts('reading')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'The staircase: 6 answers, 2 turns, 1 miss',
    )
    // Its grid lines are named in the drill's unit.
    expect(document.body.textContent).toContain('50¢')
  })
})

describe("a calibration's tracks", () => {
  it('draws each track and names its reading', () => {
    const track = (track: number): TracePoint[] =>
      RUN.map((point) => ({ ...point, track }))
    render(() => (
      <LitTracks
        tracks={[track(0), track(1), []]}
        readings={['9.4', '10.2', null]}
        unitShort="¢"
        t={STILL_MS}
      />
    ))
    expect(parts('track').map((name) => name.textContent)).toEqual([
      'A 9.4',
      'B 10.2',
      'C –',
    ])
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'The three tracks: A 9.4, B 10.2, C no reading',
    )
  })
})
