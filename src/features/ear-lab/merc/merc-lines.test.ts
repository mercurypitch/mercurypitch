// Merc's words: dry and warm. No exclamation marks, no streak headlines,
// no "three for three"; days counted, never a streak; Close's question
// says what is kept, which is nothing.

import { describe, expect, it } from 'vitest'
import * as lines from './merc-lines'

/** Every string the module says, its functions asked the likely ways. */
function everything(): string[] {
  const out: string[] = []
  const walk = (value: unknown): void => {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(walk)
    }
  }
  for (const value of Object.values(lines)) {
    if (typeof value !== 'function') walk(value)
  }
  for (const left of [0, 1, 2, 3]) {
    out.push(lines.benchLine({ left, next: 'Hairline', firstRun: false }))
  }
  out.push(lines.benchLine({ left: 3, next: 'Hairline', firstRun: true }))
  out.push(lines.benchLine({ left: 0, next: null, firstRun: false }))
  for (const cause of ['headphones', 'route', 'away', 'interrupted'] as const) {
    walk(
      lines.soundStoppedWords({
        cause,
        voided: true,
        onSpeaker: true,
        pair: true,
      }),
    )
  }
  walk(lines.calibrationBefore({ pair: true, estimate: 251, sealed: 243 }))
  walk(lines.exitWords({ count: 6, noun: 'turn' }))
  out.push(
    lines.ratingPlateLine({
      rating: 1252,
      before: 1240,
      rounds: 12,
      slip: { expected: '4 Fa', answered: '5 Sol', count: 2 },
    }),
  )
  out.push(
    lines.thresholdPlateLine({
      value: 9.4,
      shown: '9.4',
      unit: 'cents',
      previous: 11.2,
      lowerIsBetter: true,
    }),
  )
  out.push(lines.practiseLabel('4 Fa', '5 Sol'))
  out.push(lines.practiceLine(['4 Fa', '5 Sol']))
  out.push(lines.untouchedLine('Function rating', 1252))
  for (const right of [0, 6, 8]) {
    out.push(lines.practicePlateLine({ right, rounds: 8, slip: null }))
  }
  return out
}

describe("Merc's lines", () => {
  it('never exclaim, never count a streak, never say three for three', () => {
    for (const line of everything()) {
      expect(line).not.toMatch(/!/u)
      expect(line).not.toMatch(/three for three/iu)
      expect(line).not.toMatch(/streak/iu)
    }
  })

  it('count days at the bench, never a run of them', () => {
    expect(lines.benchDays(1)).toBe('1st day at the bench')
    expect(lines.benchDays(2)).toBe('2nd day at the bench')
    expect(lines.benchDays(3)).toBe('3rd day at the bench')
    expect(lines.benchDays(6)).toBe('6th day at the bench')
    expect(lines.benchDays(11)).toBe('11th day at the bench')
    expect(lines.benchDays(22)).toBe('22nd day at the bench')
  })

  it('ask before ending a run, and say nothing is kept', () => {
    expect(lines.exitWords({ count: 6, noun: 'turn' })).toEqual({
      title: 'End the run?',
      body: 'You are six turns in. Nothing from this run is kept, and Today stays as it was.',
      leave: 'End the run',
      stay: 'Keep going',
    })
    expect(lines.exitWords(null).body).toBe(
      'Nothing from this run is kept, and Today stays as it was.',
    )
  })

  it('compare a reading with the last one in its own direction', () => {
    const format = (v: number) => v.toFixed(1)
    expect(
      lines.comparedLine({
        value: 9.4,
        previous: 11.2,
        lowerIsBetter: true,
        format,
        unitShort: '¢',
      }),
    ).toBe('Finer than last time (11.2 ¢)')
    expect(
      lines.comparedLine({
        value: 12,
        previous: 11.2,
        lowerIsBetter: true,
        format,
        unitShort: '¢',
      }),
    ).toBe('Not as fine as last time (11.2 ¢)')
    expect(
      lines.comparedLine({
        value: 9.4,
        previous: null,
        lowerIsBetter: true,
        format,
        unitShort: '¢',
      }),
    ).toBe('Your first reading here')
  })

  it('say a rated run in rounds, names and no replays', () => {
    expect(lines.roundsLine(12, 9, 'named')).toBe(
      '12 rounds · 9 named · no replays',
    )
    expect(lines.ratingMoveLine(1252, 1240)).toBe('Up 12 from 1240')
    expect(lines.ratingMoveLine(1230, 1240)).toBe('Down 10 from 1240')
  })

  it('hold back the replay before a rated or sealed answer, and say why', () => {
    expect(lines.onceLines('rated')).toEqual([
      'Rated runs play once.',
      'Replays open after you answer.',
    ])
    expect(lines.onceLines('sealed')[0]).toBe('Calibration plays once.')
  })

  it('name the run in the mode line', () => {
    expect(lines.modeWords('practice', false)).toBe('practice run')
    expect(lines.modeWords('practice', true)).toBe("today's short run")
    expect(lines.modeWords('rated', false)).toBe('rated run')
    expect(lines.modeWords('sealed', false)).toBe('sealed calibration')
  })

  it('offer a slip as practice, and tally it without a rating', () => {
    expect(lines.practiseLabel('4 Fa', '5 Sol')).toBe(
      'Practise 4 Fa against 5 Sol',
    )
    expect(lines.untouchedLine('Function rating', 1252)).toBe(
      'Nothing rated: Function rating stays 1252',
    )
    const slip = { expected: '4 Fa', answered: '5 Sol', count: 2 }
    expect(lines.practicePlateLine({ right: 6, rounds: 8, slip })).toBe(
      '6 of 8. 4 Fa slipped to 5 Sol twice.',
    )
    expect(lines.practicePlateLine({ right: 8, rounds: 8, slip: null })).toBe(
      '8 of 8. Clean.',
    )
    // Rounds skipped unclear are no slip, and no clean run either.
    expect(lines.practicePlateLine({ right: 6, rounds: 8, slip: null })).toBe(
      '6 of 8.',
    )
    expect(lines.practicePlateLine({ right: 0, rounds: 0, slip: null })).toBe(
      'Nothing kept. Start again when you like.',
    )
  })
})

describe("a seal's tracks", () => {
  const format = (value: number): string => value.toFixed(1)

  it('says each by its letter, in track order, with its unit', () => {
    expect(lines.tracksLine([9.4, 10.2, 9.9], format, 'dB')).toBe(
      'A 9.4 dB · B 10.2 dB · C 9.9 dB',
    )
  })

  it('names a track that found nothing, and keeps the others in place', () => {
    expect(lines.tracksLine([9.4, null, 9.9], format, 'dB')).toBe(
      'A 9.4 dB · B no reading · C 9.9 dB',
    )
  })

  it('never puts the unit after a track that found nothing', () => {
    expect(lines.tracksLine([9.4, 10.2, null], format, 'dB')).toBe(
      'A 9.4 dB · B 10.2 dB · C no reading',
    )
  })

  it('says nothing when no track found a reading', () => {
    expect(lines.tracksLine([null, null, null], format, 'dB')).toBe('')
  })

  it('leaves the space out of a reading with no unit', () => {
    expect(lines.tracksLine([9.4], format, '')).toBe('A 9.4')
  })
})
