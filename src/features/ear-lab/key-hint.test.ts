import { describe, expect, it } from 'vitest'
import { formatKeyHint } from './key-hint'

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
