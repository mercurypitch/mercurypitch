// The tap rule's tests: the Ear Lab's pad and the lessons' pad take a tap alike.
// ============================================================

import { describe, expect, it } from 'vitest'
import { CLICK_ECHO_MS, clickTap, isTapKey, keyTap, POINTER_ECHO_MS, pointerTap, TAP_FLASH_MS, } from './tap-rule'

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

describe('isTapKey', () => {
  it('names Space and Enter, the keys that tap and make a click of themselves', () => {
    expect(isTapKey(' ')).toBe(true)
    expect(isTapKey('Enter')).toBe(true)
  })

  it("names none of a screen reader's modifier keys, nor any other key", () => {
    for (const key of [
      'Control',
      'Alt',
      'Meta',
      'Shift',
      'CapsLock',
      'Tab',
      'a',
    ])
      expect(isTapKey(key)).toBe(false)
  })
})

/** A pad that has seen no pointer up and no Space or Enter. */
const NEVER = { pointerUp: -Infinity, key: -Infinity }

describe('clickTap', () => {
  it('takes a click no gesture made, as a screen reader, switch or voice control sends it, at its own time', () => {
    expect(clickTap({ timeStamp: 900 }, NEVER)).toBe(900)
    expect(
      clickTap({ timeStamp: 900 }, { ...NEVER, key: 900 - CLICK_ECHO_MS }),
    ).toBe(900)
    expect(
      clickTap(
        { timeStamp: 900 },
        { ...NEVER, pointerUp: 900 - POINTER_ECHO_MS },
      ),
    ).toBe(900)
  })

  it('ignores the click a pointer or key gesture makes of itself, already a tap', () => {
    expect(clickTap({ timeStamp: 505 }, { ...NEVER, key: 500 })).toBeNull()
    expect(clickTap({ timeStamp: 599 }, { ...NEVER, key: 500 })).toBeNull()
    expect(
      clickTap({ timeStamp: 505 }, { ...NEVER, pointerUp: 500 }),
    ).toBeNull()
  })

  it('takes a click 50 ms after a Control keydown, which times no echo, and not one 50 ms after a Space keyup', () => {
    // Arrange: a pad that has seen only the key, at 1000 ms
    const since = (key: string): number => (isTapKey(key) ? 1000 : -Infinity)

    // Act
    const afterControl = clickTap(
      { timeStamp: 1050 },
      { ...NEVER, key: since('Control') },
    )
    const afterSpace = clickTap(
      { timeStamp: 1050 },
      { ...NEVER, key: since(' ') },
    )

    // Assert
    expect(afterControl).toBe(1050)
    expect(afterSpace).toBeNull()
  })

  it("gives a pointer's echo a second, so a click WebKit stamps late is still the pointer's, and a key's echo only its moment", () => {
    // Act
    const late = clickTap({ timeStamp: 1300 }, { ...NEVER, pointerUp: 1000 })
    const afterKey = clickTap({ timeStamp: 1300 }, { ...NEVER, key: 1000 })
    const longAfter = clickTap(
      { timeStamp: 2100 },
      { ...NEVER, pointerUp: 1000 },
    )
    const alone = clickTap({ timeStamp: 2100 }, NEVER)

    // Assert: 300 ms after a pointer up is its echo; 300 ms after a
    // Space keyup, 1,100 ms after a pointer up, or after nothing, a tap
    expect(late).toBeNull()
    expect(afterKey).toBe(1300)
    expect(longAfter).toBe(2100)
    expect(alone).toBe(2100)
  })
})
