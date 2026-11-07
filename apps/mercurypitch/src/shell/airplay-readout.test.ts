// ============================================================
// The AirPlay readout: the guess, the last check, what may play beside
// ============================================================

import { describe, expect, it } from 'vitest'
import type { AirPlayFacts } from '@/stores/airplay-suspicion'
import type { OutputCheck } from '@/stores/output-check'
import { airPlayReadout, besideWords, guessWords, lastCheckWords, } from './airplay-readout'

/** The iPhone 13 Pro on AirPlay: its own session on the speaker at 48 kHz. */
const SUSPECTED: AirPlayFacts = {
  route: 'speaker',
  sessionRate: 48000,
  pageRate: 44100,
  screen: false,
}

/** 21:31:05 by the phone's own clock. */
const AT = new Date(2026, 10, 7, 21, 31, 5).getTime()

const PLAY: OutputCheck = {
  why: 'play',
  gesture: true,
  at: AT,
  rate: 44100,
  failure: null,
  verdict: 'airplay',
}

describe('the guess', () => {
  it('says AirPlay alone where the route says airplay', () => {
    expect(
      guessWords({ ...SUSPECTED, route: 'airplay', sessionRate: 44100 }),
    ).toBe('AirPlay alone: the route says airplay')
  })

  it('says AirPlay alone, likely, where only the rates say it, with both rates', () => {
    expect(guessWords(SUSPECTED)).toBe(
      "AirPlay alone, likely: the page at 44100 Hz, the phone's session at 48000 Hz on speaker",
    )
  })

  it('says not, with the rates, where they agree', () => {
    expect(guessWords({ ...SUSPECTED, pageRate: 48000 })).toBe(
      "Not AirPlay alone: the page at 48000 Hz, the phone's session at 48000 Hz on speaker",
    )
  })

  it('says not where a screen is connected, the route’s word included', () => {
    expect(guessWords({ ...SUSPECTED, route: 'airplay', screen: true })).toBe(
      'Not AirPlay alone: a screen is connected',
    )
  })

  it('says what it does not know yet', () => {
    expect(guessWords({ ...SUSPECTED, route: null, pageRate: null })).toBe(
      "Not AirPlay alone: the page at an unknown rate, the phone's session not read",
    )
  })
})

describe('the last check', () => {
  it('says its rate, when it ran, why, and whether inside a gesture', () => {
    expect(lastCheckWords(PLAY)).toBe(
      '44100 Hz at 21:31:05, on play, in a gesture: AirPlay alone',
    )
  })

  it('says why no context was made, outside a gesture', () => {
    expect(
      lastCheckWords({
        ...PLAY,
        why: 'route',
        gesture: false,
        rate: null,
        failure: 'NotSupportedError',
        verdict: 'unknown',
      }),
    ).toBe(
      'No fresh context (NotSupportedError) at 21:31:05, on a route change, outside a gesture: unknown',
    )
  })

  it('says there has been none yet', () => {
    expect(lastCheckWords(null)).toBe('None yet')
  })
})

describe('what may play beside the room’s sound', () => {
  it('says the carrier and the clip stand aside, or may play', () => {
    expect(besideWords(true)).toBe(
      "Nothing: the lock screen's carrier and the unlock clip stand aside",
    )
    expect(besideWords(false)).toBe(
      "The lock screen's carrier and the unlock clip, where a start's check says the sound stays here",
    )
  })

  it('reads as three rows, in that order', () => {
    expect(
      airPlayReadout({ facts: SUSPECTED, check: PLAY, alone: true }).map(
        (row) => row.label,
      ),
    ).toEqual(['The guess', 'Last check', 'Beside the sound'])
  })
})
