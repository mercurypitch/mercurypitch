// The six stations: every instrument at the station of its catalogue
// faculty, each station's number from its own instruments only, and a
// painting per station with the Regulator Room standing in.

import { beforeEach, describe, expect, it } from 'vitest'
import { INSTRUMENTS } from '@/features/ear-lab/instruments'
import { recordIdentificationAnswer, resetEarLabStore, } from '@/stores/ear-lab-store'
import { STATION_ORDER, stationCast, stationInstruments, stationOf, stationPainting, stationReading, } from './stations'

const names = (faculty: Parameters<typeof stationInstruments>[0]) =>
  stationInstruments(faculty).map((instrument) => instrument.name)

function answer(drillId: string, correct: boolean): void {
  recordIdentificationAnswer({
    drillId,
    itemId: `${drillId}:x`,
    itemDifficulty: { rating: 1000, attempts: 0 },
    correct,
    guessRate: 0.25,
    expected: 'x',
    answered: correct ? 'x' : 'y',
  })
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
})

describe('the stations', () => {
  it('seat Cadence and Bassline at Colour, where their readings count', () => {
    expect(stationOf('cadence')).toBe('colour')
    expect(stationOf('bassline')).toBe('colour')
    expect(names('colour')).toEqual([
      'Stack',
      'Cadence',
      'Bassline',
      'The desk',
    ])
    expect(names('function')).toEqual(['Home', 'Gravity', 'The Pull'])
  })

  it('seat every instrument but Calibration at exactly one station', () => {
    const seated = STATION_ORDER.flatMap((faculty) =>
      stationInstruments(faculty).map((instrument) => instrument.view),
    )
    const all = INSTRUMENTS.filter((i) => i.view !== 'calibration').map(
      (i) => i.view,
    )
    expect([...seated].sort()).toEqual([...all].sort())
  })

  it('say their cast', () => {
    expect(stationCast('resolution')).toBe('Hairline + 1')
    expect(stationCast('function')).toBe('Home + 2')
    expect(stationCast('wild')).toBe('The Field Book')
  })

  it("read a station's number from its own instruments only", () => {
    // Cadence is Colour's now: it moves Colour and leaves Function alone.
    answer('cadence', true)
    expect(stationReading('function')).toBeNull()
    expect(stationReading('colour')?.source).toBe('Cadence')
    answer('home', true)
    expect(stationReading('function')?.source).toBe('Home')
  })

  it('stand the Regulator Room in for a painting, and Wild the glasshouse', () => {
    for (const faculty of STATION_ORDER) {
      expect(stationPainting(faculty)).toBe(
        faculty === 'wild'
          ? '/ear-lab/glasshouse-bench-portrait.webp'
          : '/ear-lab/regulator-room-portrait.webp',
      )
    }
    expect(stationPainting(null)).toBe('/ear-lab/regulator-room-portrait.webp')
  })
})
