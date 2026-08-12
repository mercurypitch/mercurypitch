import { describe, expect, it } from 'vitest'
import { addLegacyColorFallbacks, alphaFallback, fallbackForValue, parseLiteralColor, } from './css-legacy-fallbacks'

describe('parseLiteralColor', () => {
  it('reads six-digit hex', () => {
    expect(parseLiteralColor('#58a6ff')).toEqual({ r: 88, g: 166, b: 255 })
  })

  it('expands three-digit hex', () => {
    expect(parseLiteralColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('ignores the alpha channel of eight-digit hex', () => {
    expect(parseLiteralColor('#58a6ff80')).toEqual({ r: 88, g: 166, b: 255 })
  })

  it('reads legacy and modern rgb syntax', () => {
    expect(parseLiteralColor('rgb(12, 34, 56)')).toEqual({
      r: 12,
      g: 34,
      b: 56,
    })
    expect(parseLiteralColor('rgba(12 34 56 / 0.5)')).toEqual({
      r: 12,
      g: 34,
      b: 56,
    })
  })

  it('refuses anything containing a variable', () => {
    expect(parseLiteralColor('var(--accent)')).toBeNull()
    expect(parseLiteralColor('oklch(0.7 0.1 200)')).toBeNull()
  })
})

describe('alphaFallback', () => {
  it('tints a literal exactly', () => {
    expect(alphaFallback('#58a6ff', 0.16)).toBe('rgba(88, 166, 255, 0.16)')
  })

  it('routes a bare token through its rgb companion', () => {
    expect(alphaFallback('var(--accent)', 0.45)).toBe(
      'rgba(var(--accent-rgb), 0.45)',
    )
  })

  it('keeps a variable’s own literal fallback usable', () => {
    expect(alphaFallback('var(--green, #3fb950)', 0.4)).toBe(
      'rgba(var(--green-rgb, 63, 185, 80), 0.4)',
    )
  })

  it('gives up on currentColor', () => {
    expect(alphaFallback('currentColor', 0.2)).toBeNull()
  })
})

describe('fallbackForValue', () => {
  it('rewrites the alpha-tint form that dominates this codebase', () => {
    expect(
      fallbackForValue('color-mix(in srgb, var(--accent) 16%, transparent)'),
    ).toBe('rgba(var(--accent-rgb), 0.16)')
  })

  it('computes a two-literal mix numerically', () => {
    expect(fallbackForValue('color-mix(in srgb, #000 50%, #fff)')).toBe(
      'rgb(128, 128, 128)',
    )
  })

  it('keeps the dominant side when neither is a literal', () => {
    expect(
      fallbackForValue('color-mix(in srgb, var(--accent) 30%, var(--border))'),
    ).toBe('var(--border)')
    expect(
      fallbackForValue('color-mix(in srgb, var(--accent) 70%, var(--border))'),
    ).toBe('var(--accent)')
  })

  it('rewrites every mix inside a compound value', () => {
    expect(
      fallbackForValue(
        '0 0 10px color-mix(in srgb, #ff0000 20%, transparent), inset 0 1px color-mix(in srgb, #00ff00 40%, transparent)',
      ),
    ).toBe('0 0 10px rgba(255, 0, 0, 0.2), inset 0 1px rgba(0, 255, 0, 0.4)')
  })

  it('handles a leading percentage', () => {
    expect(
      fallbackForValue('color-mix(in srgb, 25% #58a6ff, transparent)'),
    ).toBe('rgba(88, 166, 255, 0.25)')
  })

  it('refuses currentColor and nested mixes rather than guessing', () => {
    expect(
      fallbackForValue('color-mix(in srgb, currentColor 20%, transparent)'),
    ).toBeNull()
    expect(
      fallbackForValue(
        'color-mix(in srgb, color-mix(in srgb, red 50%, blue) 20%, transparent)',
      ),
    ).toBeNull()
  })

  it('refuses colour spaces it was not written for', () => {
    expect(
      fallbackForValue('color-mix(in oklch, var(--accent) 20%, transparent)'),
    ).toBeNull()
  })

  it('returns null when there is nothing to do', () => {
    expect(fallbackForValue('1px solid var(--border)')).toBeNull()
  })
})

describe('addLegacyColorFallbacks', () => {
  it('leaves stylesheets without color-mix untouched', () => {
    const css = '.a {\n  color: red;\n}\n'
    expect(addLegacyColorFallbacks(css)).toBe(css)
  })

  it('emits a fallback before the modern declaration', () => {
    const out = addLegacyColorFallbacks(
      '.active {\n  background: color-mix(in srgb, var(--accent) 16%, transparent);\n}\n',
    )
    expect(out).toContain('background: rgba(var(--accent-rgb), 0.16);')
    expect(out.indexOf('rgba(var(--accent-rgb)')).toBeLessThan(
      out.indexOf('color-mix'),
    )
  })

  it('generates rgb companions beside literal colour tokens', () => {
    const out = addLegacyColorFallbacks(
      ':root {\n  --accent: #58a6ff;\n}\n.a {\n  color: color-mix(in srgb, var(--accent) 50%, transparent);\n}\n',
    )
    expect(out).toContain('--accent-rgb: 88, 166, 255')
  })

  it('generates a companion per theme block so theming still works', () => {
    const out = addLegacyColorFallbacks(
      ":root {\n  --accent: #58a6ff;\n}\nbody[data-theme='ember'] {\n  --accent: #e07070;\n}\n.a {\n  color: color-mix(in srgb, var(--accent) 50%, transparent);\n}\n",
    )
    expect(out).toContain('--accent-rgb: 88, 166, 255')
    expect(out).toContain('--accent-rgb: 224, 112, 112')
  })

  it('aliases the companion when one token points at another', () => {
    const out = addLegacyColorFallbacks(
      ':root {\n  --red: #f85149;\n  --danger: var(--red);\n}\n.a {\n  color: color-mix(in srgb, var(--danger) 50%, transparent);\n}\n',
    )
    expect(out).toContain('--red-rgb: 248, 81, 73')
    expect(out).toContain('--danger-rgb: var(--red-rgb)')
  })

  it('does not add a companion the author already wrote', () => {
    const out = addLegacyColorFallbacks(
      ':root {\n  --accent: #58a6ff;\n  --accent-rgb: 1, 2, 3;\n}\n.a {\n  color: color-mix(in srgb, var(--accent) 50%, transparent);\n}\n',
    )
    expect(out.match(/--accent-rgb:/g)).toHaveLength(1)
  })

  it('never rewrites an at-rule prelude', () => {
    const css =
      '@supports (color: color-mix(in srgb, red 50%, transparent)) {\n  .a {\n    color: red;\n  }\n}\n'
    expect(addLegacyColorFallbacks(css)).toBe(css)
  })

  it('leaves color-mix inside comments and strings alone', () => {
    const css =
      '/* color-mix(in srgb, red 10%, transparent) */\n.a::after {\n  content: "color-mix(in srgb, red 10%, transparent)";\n}\n'
    expect(addLegacyColorFallbacks(css)).toBe(css)
  })

  it('handles a final declaration with no trailing semicolon', () => {
    const out = addLegacyColorFallbacks(
      '.a {\n  color: color-mix(in srgb, #fff 50%, transparent)\n}\n',
    )
    expect(out).toContain('color: rgba(255, 255, 255, 0.5);')
  })

  it('preserves the rest of the declaration around the mix', () => {
    const out = addLegacyColorFallbacks(
      '.a {\n  border: 1px solid color-mix(in srgb, #58a6ff 45%, transparent);\n}\n',
    )
    expect(out).toContain('border: 1px solid rgba(88, 166, 255, 0.45);')
  })
})
