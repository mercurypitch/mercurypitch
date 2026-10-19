// ============================================================
// Lesson 5 three starts tests — air first, a catch, together (FACTS 75)
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { airAt, foldsAt, markOf, playStart, START_SEC, START_WORDS, STARTS, tickOf, waveAt, } from './starts'

describe('the three starts, 1.6 s each on A3', () => {
  it('air first: air alone for a quarter second, the note rising under it to full by 0.5 s', () => {
    expect(START_SEC).toBe(1.6)
    expect(waveAt('air', 0.2)).toBe(0)
    expect(waveAt('air', 0.5)).toBe(1)
    expect([airAt('air', 0), airAt('air', 0.34), airAt('air', 0.35)]).toEqual([
      true,
      true,
      false,
    ])
    expect(foldsAt('air', 0.1)).toMatchObject({
      open: 1,
      air: true,
      vibrating: false,
    })
    expect(foldsAt('air', 0.6)).toMatchObject({
      open: 0,
      air: false,
      vibrating: true,
    })
  })

  it('a catch: pressed shut and silent until 0.15 s, the click, then the note at full level within 10 ms', () => {
    expect(markOf('catch')).toBe(0.15)
    expect(waveAt('catch', 0.15)).toBe(0)
    expect(waveAt('catch', 0.163)).toBe(1)
    expect(foldsAt('catch', 0.1)).toMatchObject({
      pressed: true,
      vibrating: false,
    })
    expect(foldsAt('catch', 0.2)).toMatchObject({
      pressed: false,
      vibrating: true,
    })
    expect(airAt('catch', 0.1)).toBe(false)
  })

  it('together: the note rising over 60 ms from the start, with the gold tick there and no air before it', () => {
    expect(tickOf('together')).toBe(0)
    expect(waveAt('together', 0)).toBe(0)
    expect(waveAt('together', 0.06)).toBe(1)
    expect(airAt('together', 0)).toBe(false)
    expect(foldsAt('together', 0).vibrating).toBe(true)
    expect(foldsAt('together', 0).open).toBeLessThan(0.2)
    // gold marks the one fit, and only on this start
    expect(STARTS.map(tickOf)).toEqual([null, null, 0])
  })

  it('names what each button plays, its visible words first', () => {
    expect(START_WORDS.air.name).toBe('Air first: a puff of air, then the note')
    expect(START_WORDS.catch.name.startsWith('A catch')).toBe(true)
    expect(START_WORDS.together.name.startsWith('Together')).toBe(true)
  })

  it('stays silent with sound off', () => {
    expect(STARTS.map((s) => playStart(s, false))).toEqual([null, null, null])
  })
})
