// The two rules a tour walk checks at every stop (tour-rules.mjs): a ringed
// target takes at most 70% of the window's height, and each of the consent
// bar's buttons is what lies under its own middle.

import assert from 'node:assert/strict'
import test from 'node:test'
import { barOnTop, targetFits } from './tour-rules.mjs'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

test('a 3,000 px grid is not a target', () => {
  assert.equal(targetFits({ height: 3000 }, DESKTOP), false)
  assert.equal(targetFits({ height: 3000 }, PHONE), false)
})

test('a card that fits is', () => {
  assert.equal(targetFits({ height: 120 }, PHONE), true)
  assert.equal(targetFits({ height: 52 }, DESKTOP), true)
})

test('70% of the window is the most a target may take', () => {
  assert.equal(targetFits({ height: 630 }, DESKTOP), true)
  assert.equal(targetFits({ height: 631 }, DESKTOP), false)
  // The Sing stage's canvas on a wide screen: 704 px of 900.
  assert.equal(targetFits({ height: 704 }, DESKTOP), false)
})

test('one button hit outside the bar fails', () => {
  assert.equal(barOnTop([true, false]), false)
  assert.equal(barOnTop([false, true]), false)
})

test('every button hit inside the bar passes', () => {
  assert.equal(barOnTop([true, true]), true)
})

test('a bar with no button hit-tested proves nothing', () => {
  assert.equal(barOnTop([]), false)
})
