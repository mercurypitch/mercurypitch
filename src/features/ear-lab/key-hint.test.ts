import { describe, expect, it } from 'vitest'
import { formatKeyHint, keyMatches } from './key-hint'

const key = (name: string) => ({ key: name, action: () => undefined })

describe('formatKeyHint', () => {
  it('names two keys, ranges many, and leaves Space to its pad', () => {
    expect(formatKeyHint([key('1'), key('2')])).toBe('1 · 2 on the keyboard')
    expect(formatKeyHint([key('1'), key('2'), key('3')])).toBe(
      '1 · 2 · 3 on the keyboard',
    )
    expect(formatKeyHint(['1', '2', '3', '4', '5', '6', '7'].map(key))).toBe(
      '1–7 on the keyboard',
    )
    expect(formatKeyHint([key('Space')])).toBeUndefined()
    expect(formatKeyHint([])).toBeUndefined()
    expect(formatKeyHint([key('Space'), key('1'), key('2')])).toBe(
      '1 · 2 on the keyboard',
    )
  })
})

describe('keyMatches', () => {
  it('takes the key, or the physical digit under it', () => {
    expect(keyMatches('1', { key: '1', code: 'Digit1' })).toBe(true)
    // Numpad with Num Lock off reports End; the code still says 1.
    expect(keyMatches('1', { key: 'End', code: 'Numpad1' })).toBe(true)
    // A shifted digit, or a layout that moves the row.
    expect(keyMatches('1', { key: '!', code: 'Digit1' })).toBe(true)
    expect(keyMatches('2', { key: '1', code: 'Digit1' })).toBe(false)
    expect(keyMatches('1', { key: 'a', code: 'KeyA' })).toBe(false)
  })
})
