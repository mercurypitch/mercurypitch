// The plates a drill with pair practice ends on: the practice plate shows
// what the rated plate shows about the run, and nothing about the rating
// it left alone.

import { describe, expect, it } from 'vitest'
import { ratedRunPlate } from './stage-room'

const RUN = {
  rating: 1240,
  before: 1228,
  source: 'Home rating',
  settling: 3,
  rounds: 8,
  right: 6,
  rightWord: 'sung',
  replays: 1,
  outcomes: [{ correct: true, title: 'Degree 4' }],
  slips: [{ expected: '4 Fa', answered: '5 Sol', count: 2 }],
  lines: ['1 skipped (unclear)'],
}

const ABOUT_THE_RATING = ['Ear and voice are moving together.']

describe('the plate a run ends on', () => {
  it("is the rated plate, the lines about the rating after the run's", () => {
    expect(ratedRunPlate(RUN, null, ABOUT_THE_RATING)).toEqual({
      kind: 'rating',
      ...RUN,
      lines: ['1 skipped (unclear)', 'Ear and voice are moving together.'],
    })
  })

  it('is the practice plate on its pair, with the run as the rated plate has it', () => {
    expect(ratedRunPlate(RUN, ['4 Fa', '5 Sol'], ABOUT_THE_RATING)).toEqual({
      kind: 'practice',
      against: ['4 Fa', '5 Sol'],
      rating: 1240,
      source: 'Home rating',
      rounds: 8,
      right: 6,
      rightWord: 'sung',
      replays: 1,
      outcomes: RUN.outcomes,
      slips: RUN.slips,
      lines: ['1 skipped (unclear)'],
    })
  })
})
