// Shatter playback controls — finite settings latch at each earned break without changing source time.

import { expect, it } from 'vitest'
import { createShatterPlayback, parseShatterPlaybackSpeed, shatterLifecycleSeconds, } from './shatter-presentation'

it.each([
  [undefined, 1],
  [null, 1],
  ['', 1],
  ['  ', 1],
  ['garbage', 1],
  [NaN, 1],
  [Infinity, 1],
  [-Infinity, 1],
  ['0.7', 0.7],
  [0.4, 0.4],
  [0, 0.4],
  [9, 1.6],
])('normalizes stored shatter speed %s to %s', (raw, expected) => {
  expect(parseShatterPlaybackSpeed(raw)).toBe(expected)
})

it('latches a new speed on the next break and resets on replay', () => {
  const playback = createShatterPlayback(0.4)
  expect(playback.age(null, 9)).toBe(-1)
  expect(playback.age(10, 11)).toBeCloseTo(0.4)
  playback.setSpeed(1.6)
  expect(playback.age(10, 12)).toBeCloseTo(0.8)
  expect(playback.age(20, 21)).toBeCloseTo(1.6)
  playback.setSpeed(0.5)
  expect(playback.age(0, 0.2)).toBeCloseTo(0.1)
  expect(shatterLifecycleSeconds(0.4)).toBeCloseTo(5.75)
})
