// What a settled note does to him, in a room of shelves.
// ============================================================

import { describe, expect, it } from 'vitest'
import { MAX_LEAP, MIN_LEAP_SEMIS, RISE_PER_SEMI } from '../levels/shelf'
import { WORLD3D_CONFIG } from '../world3d-config'
import { SLIDE_SEMIS, STOP_HOLD_SECONDS } from './line-grade'
import type { ShelfVoice, VoiceStop } from './shelf-voice'
import { emptyVoice, intervalLabel, intervalName, voiceStep, } from './shelf-voice'

const DT = WORLD3D_CONFIG.loop.stepSeconds

/** Hold a note (or a silence) for `seconds`, and return every stop it
 * made on the way. */
const hold = (
  v: ShelfVoice,
  midi: number | null,
  seconds: number,
  grounded = true,
): VoiceStop[] => {
  const out: VoiceStop[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const s = voiceStep(v, midi, DT, grounded)
    if (s !== null) out.push(s)
  }
  return out
}

describe('the reference', () => {
  it('is set by the first stop, which readies him and leaps nowhere', () => {
    const v = emptyVoice()
    expect(v.reference).toBeNull()
    expect(hold(v, 57, 0.3)).toEqual([{ kind: 'ready', stop: 57 }])
    expect(v.reference).toBe(57)
  })

  it('takes the Line hold to settle: nothing before 150 ms, a stop by then', () => {
    const v = emptyVoice()
    expect(hold(v, 57, STOP_HOLD_SECONDS - 3 * DT)).toEqual([])
    expect(hold(v, 57, 4 * DT)).toHaveLength(1)
  })

  it('does not stop twice on one held note, or across a breath in it', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    expect(hold(v, null, 0.2)).toEqual([])
    expect(hold(v, 57.2, 0.5)).toEqual([])
    expect(v.reference).toBe(57)
  })
})

describe('a leap', () => {
  it('is a stop above the reference, as high as the interval, 0.1 m a semitone', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    const [leap] = hold(v, 64, 0.3)
    expect(leap?.kind).toBe('leap')
    if (leap?.kind !== 'leap') return
    expect(leap.interval).toBe(7)
    expect(leap.height).toBeCloseTo(7 * RISE_PER_SEMI, 10)
    expect(v.reference).toBe(64)
  })

  it('stops at his spring, but keeps the interval sung', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    const [leap] = hold(v, 68, 0.3)
    if (leap?.kind !== 'leap') throw new Error('an eleventh up is a leap')
    expect(leap.height).toBe(MAX_LEAP)
    expect(leap.interval).toBe(11)
  })

  it('is measured from the note last held, so down is free (D1)', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    hold(v, 64, 0.3)
    // Back down to somewhere comfortable: it moves the reference only.
    expect(hold(v, 55, 0.3)).toEqual([{ kind: 'ready', stop: 55 }])
    const [leap] = hold(v, 59, 0.3)
    if (leap?.kind !== 'leap') throw new Error('a third up is a leap')
    expect(leap.interval).toBe(4)
  })

  it('is not made by a stop on the reference, or below it (§3.3)', () => {
    const v = emptyVoice()
    hold(v, 60, 0.3)
    expect(hold(v, 52, 0.3)).toEqual([{ kind: 'ready', stop: 52 }])
    // Leaving by more than half a semitone and coming back is a stop on
    // the reference itself.
    hold(v, 54, 0.3)
    expect(hold(v, 54, 0.3)).toEqual([])
    expect(hold(v, 53, 0.3)).toEqual([{ kind: 'ready', stop: 53 }])
  })

  it('is never made in the air: a stop there only moves the reference (D8)', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    expect(hold(v, 64, 0.3, false)).toEqual([{ kind: 'held', stop: 64 }])
    expect(v.reference).toBe(64)
    // And the next leap is measured from the note held in the air.
    const [leap] = hold(v, 67, 0.3)
    if (leap?.kind !== 'leap') throw new Error('a minor third up is a leap')
    expect(leap.interval).toBe(3)
  })
})

// A new stop needs the tracker's half semitone of leaving, but not of
// arriving: a note's tail can flick up and settle a few cents from where
// it was, and a re-attack can scoop in from below. That is the same note
// held again, and it only readies him.
describe('a stop less than half a semitone above the reference', () => {
  it('is the tracker own half semitone, the least leap', () => {
    expect(MIN_LEAP_SEMIS).toBe(SLIDE_SEMIS)
  })

  it('readies him when a tail flicks up 0.6 for 30 ms and settles 20 cents sharp', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    hold(v, 64, 0.3)
    expect(hold(v, 64.6, 0.03)).toEqual([])
    expect(hold(v, 64.2, 0.3)).toEqual([{ kind: 'ready', stop: 64.2 }])
    // Still the reference, as a stop below it would be.
    expect(v.reference).toBe(64.2)
  })

  it('readies him when a re-attack scoops up from below and settles 25 cents sharp', () => {
    const v = emptyVoice()
    hold(v, 55, 0.3)
    hold(v, null, 0.3)
    hold(v, 54, 0.02)
    hold(v, 54.6, 0.02)
    expect(hold(v, 55.25, 0.3)).toEqual([{ kind: 'ready', stop: 55.25 }])
  })

  it('readies him when it re-settles 5 cents sharp', () => {
    const v = emptyVoice()
    hold(v, 57, 0.3)
    hold(v, 57.7, 0.03)
    expect(hold(v, 57.05, 0.3)).toEqual([{ kind: 'ready', stop: 57.05 }])
  })

  it('leaps from half a semitone, and not from 45 cents', () => {
    const under = emptyVoice()
    hold(under, 57, 0.3)
    hold(under, 58, 0.03)
    expect(hold(under, 57.45, 0.3)).toEqual([{ kind: 'ready', stop: 57.45 }])

    const least = emptyVoice()
    hold(least, 57, 0.3)
    hold(least, 58, 0.03)
    const [leap] = hold(least, 57.5, 0.3)
    if (leap?.kind !== 'leap') throw new Error('half a semitone up is a leap')
    expect(leap.interval).toBe(0.5)
    expect(leap.height).toBeCloseTo(0.5 * RISE_PER_SEMI, 10)
  })
})

describe('naming an interval', () => {
  it('names the ones the rooms ask for as the ruler does', () => {
    expect([3, 4, 5, 7, 12].map(intervalName)).toEqual([
      'm3',
      'M3',
      'P4',
      'P5',
      '8ve',
    ])
  })

  it('says how far off the nearest one a leap was, in cents', () => {
    expect(intervalLabel(7.12)).toBe('P5 +12¢')
    expect(intervalLabel(6.7)).toBe('P5 -30¢')
    expect(intervalLabel(5)).toBe('P4')
    expect(intervalLabel(12.004)).toBe('8ve')
  })

  it('counts past the octave rather than inventing a name', () => {
    expect(intervalName(14)).toBe('14 st')
  })
})
