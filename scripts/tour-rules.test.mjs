// The two rules a tour walk checks at every stop (tour-rules.mjs): a ringed
// target takes at most 70% of the window's height, and each of the consent
// bar's buttons is what lies under its own middle.

import assert from 'node:assert/strict'
import test from 'node:test'
import { barOnTop, standsClear, targetFits } from './tour-rules.mjs'

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

// A phone on its side, 844x390: the drawer's Load a Melody section, 253 x
// 342 from the left edge, with the tooltip beside it, and a settings section
// as wide as the page with the tooltip over its top.
test('a tooltip beside a tall target stands clear of it', () => {
  const section = { x: 8, y: -6, width: 253, height: 342 }
  assert.equal(
    standsClear(section, { x: 267, y: 21, width: 340, height: 288 }),
    true,
  )
})

test('a tooltip over any of the target does not', () => {
  const section = { x: 116, y: 42, width: 612, height: 377 }
  assert.equal(
    standsClear(section, { x: 252, y: 130, width: 340, height: 248 }),
    false,
  )
})

test('no tooltip proves nothing', () => {
  assert.equal(standsClear({ x: 0, y: 0, width: 10, height: 10 }, null), false)
})
