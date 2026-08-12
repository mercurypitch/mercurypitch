import { describe, expect, it } from 'vitest'
import { colorTokenVars, cssColorToRgbList } from './css-color-token'

describe('cssColorToRgbList', () => {
  it('reads six-digit hex', () => {
    expect(cssColorToRgbList('#5b8def')).toBe('91, 141, 239')
  })

  it('expands three-digit hex', () => {
    expect(cssColorToRgbList('#fff')).toBe('255, 255, 255')
  })

  it('ignores the alpha of rgba and eight-digit hex', () => {
    expect(cssColorToRgbList('rgba(255, 255, 255, 0.5)')).toBe('255, 255, 255')
    expect(cssColorToRgbList('#5b8def80')).toBe('91, 141, 239')
  })

  it('reads channels past a variable alpha', () => {
    expect(cssColorToRgbList('rgba(13, 17, 23, var(--jam-alpha))')).toBe(
      '13, 17, 23',
    )
  })

  it('refuses keywords, var() and nonsense', () => {
    expect(cssColorToRgbList('transparent')).toBeNull()
    expect(cssColorToRgbList('var(--accent)')).toBeNull()
    expect(cssColorToRgbList('linear-gradient(red, blue)')).toBeNull()
  })
})

describe('colorTokenVars', () => {
  it('emits the token and its companion for a literal colour', () => {
    expect(colorTokenVars('--lane-color', '#5b8def')).toEqual({
      '--lane-color': '#5b8def',
      '--lane-color-rgb': '91, 141, 239',
    })
  })

  it('emits only the token when the value cannot be parsed', () => {
    expect(colorTokenVars('--singer-color', 'transparent')).toEqual({
      '--singer-color': 'transparent',
    })
  })

  it('yields an empty object for missing values', () => {
    expect(colorTokenVars('--key-color', undefined)).toEqual({})
    expect(colorTokenVars('--key-color', '')).toEqual({})
  })
})
