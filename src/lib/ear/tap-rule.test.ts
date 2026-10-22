// The tap rule's tests: the Ear Lab's pad and the lessons' pad take a tap alike.
// ============================================================

import { describe, expect, it } from 'vitest'
import { CLICK_ECHO_MS, clickTap, keyTap, pointerTap, TAP_FLASH_MS, } from './tap-rule'

describe('pointerTap', () => {
  it("takes the primary button, touch and pen at the event's own time", () => {
    expect(pointerTap({ button: 0, timeStamp: 1234.5 })).toBe(1234.5)
  })

  it('refuses a secondary button', () => {
    expect(pointerTap({ button: 1, timeStamp: 10 })).toBeNull()
    expect(pointerTap({ button: 2, timeStamp: 10 })).toBeNull()
  })
})

describe('keyTap', () => {
  it("takes Space and Enter at the event's own time", () => {
    expect(keyTap({ key: ' ', repeat: false, timeStamp: 50 })).toBe(50)
    expect(keyTap({ key: 'Enter', repeat: false, timeStamp: 60 })).toBe(60)
  })

  it("ignores a held key's repeats and every other key", () => {
    expect(keyTap({ key: ' ', repeat: true, timeStamp: 50 })).toBeNull()
    expect(keyTap({ key: 'Enter', repeat: true, timeStamp: 50 })).toBeNull()
    for (const key of ['a', '2', 'Tab', 'Spacebar', 'ArrowUp'])
      expect(keyTap({ key, repeat: false, timeStamp: 1 })).toBeNull()
  })

  it('flashes the pad for 110 ms', () => {
    expect(TAP_FLASH_MS).toBe(110)
  })
})

describe('clickTap', () => {
  it('takes a click no gesture made, as a screen reader, switch or voice control sends it, at its own time', () => {
    expect(clickTap({ timeStamp: 900 }, -Infinity)).toBe(900)
    expect(clickTap({ timeStamp: 900 }, 900 - CLICK_ECHO_MS)).toBe(900)
  })

  it('ignores the click a pointer or key gesture makes of itself, already a tap', () => {
    expect(clickTap({ timeStamp: 505 }, 500)).toBeNull()
    expect(clickTap({ timeStamp: 599 }, 500)).toBeNull()
  })
})
