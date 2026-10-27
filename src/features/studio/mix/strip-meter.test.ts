// Studio strip meter reading tests — the rail's travel, the peak hold's hold and fall, and the title's words.
import { describe, expect, it } from 'vitest'
import { reductionTravel, stepStripHold, stripHoldDb, stripMeterTitle, stripTravel, } from './strip-meter'

describe('Studio strip meter readings', () => {
  it('places levels on the master meter travel and gain reduction on 24 dB from the top', () => {
    expect(stripTravel(-Infinity)).toBe(0)
    expect(stripTravel(-60)).toBe(0)
    expect(stripTravel(-18)).toBe(70)
    expect(stripTravel(3)).toBe(100)
    expect(reductionTravel(0)).toBe(0)
    expect(reductionTravel(-6)).toBe(25)
    expect(reductionTravel(-40)).toBe(100)
  })

  it('holds a new high for 1.5 s, then lets it fall 20 dB a second until the level meets it', () => {
    let hold = stepStripHold(null, -6, 0, false)
    hold = stepStripHold(hold, -20, 1000, false)
    expect(stripHoldDb(hold, 1000, false)).toBe(-6)
    expect(stripHoldDb(hold, 1500, false)).toBe(-6)
    expect(stripHoldDb(hold, 2000, false)).toBeCloseTo(-16, 9)
    // The falling marker meets the level and holds there.
    hold = stepStripHold(hold, -20, 2200, false)
    expect(hold).toEqual({ db: -20, since: 2200 })
    // A louder reading takes over at once.
    expect(stepStripHold(hold, -3, 2300, false)).toEqual({
      db: -3,
      since: 2300,
    })
  })

  it('lets a falling hold drop off the rail at the floor, so a lane gone silent reads silent', () => {
    // Muted at 0 s: from then on every reading is silence.
    let hold = stepStripHold(null, -24, 0, false)
    expect(stripHoldDb(hold, 3200, false)).toBeCloseTo(-58, 9)
    expect(stripHoldDb(hold, 3400, false)).toBe(-Infinity)
    hold = stepStripHold(hold, -Infinity, 3400, false)
    expect(
      stripMeterTitle('Low', {
        holdDb: stripHoldDb(hold, 3400, false),
        reductionDb: null,
      }),
    ).toBe('Low: silent')
  })

  it('does not slide the hold with reduced motion: after the hold it moves to the level in one step', () => {
    let hold = stepStripHold(null, -6, 0, true)
    hold = stepStripHold(hold, -30, 1400, true)
    expect(stripHoldDb(hold, 1400, true)).toBe(-6)
    hold = stepStripHold(hold, -30, 1600, true)
    expect(hold).toEqual({ db: -30, since: 1600 })
    expect(stripHoldDb(hold, 1600, true)).toBe(-30)
  })

  it('names the held peak and any gain reduction in its title', () => {
    expect(stripMeterTitle('Bass', null)).toBe(
      'Bass: press Play to see its level',
    )
    expect(
      stripMeterTitle('Bass', { holdDb: -Infinity, reductionDb: null }),
    ).toBe('Bass: silent')
    expect(stripMeterTitle('Bass', { holdDb: -12.34, reductionDb: null })).toBe(
      'Bass: peak -12.3 dB after the fader',
    )
    // Under the rail's floor it gives the floor, not the last few
    // millionths of a fading mute.
    expect(stripMeterTitle('Bass', { holdDb: -312.4, reductionDb: null })).toBe(
      'Bass: peak under -60 dB after the fader',
    )
    expect(stripMeterTitle('Vocal', { holdDb: -8, reductionDb: -4.25 })).toBe(
      'Vocal: peak -8.0 dB after the fader, 4.3 dB of gain reduction',
    )
  })
})
