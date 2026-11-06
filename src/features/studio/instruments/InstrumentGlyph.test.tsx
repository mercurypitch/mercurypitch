// Instrument glyph tests — every drawing keeps the pack's rules (its own colour, masks that cannot inherit a stroke, ids that stay its own), and each instance and chip says what it should.
import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { INSTRUMENT_GLYPHS } from '@/lib/studio/instruments/glyph-catalog'
import { INSTRUMENT_DRAWINGS } from './glyph-drawings'
import { InstrumentChip, InstrumentGlyph } from './InstrumentGlyph'

const SVG = 'http://www.w3.org/2000/svg'
const ELEMENTS = new Set([
  'path',
  'circle',
  'ellipse',
  'rect',
  'g',
  'defs',
  'mask',
])
const COLOURS = new Set(['currentColor', 'none'])
const MASK_COLOURS = new Set(['#fff', '#000', 'none'])

function parse(markup: string): Element {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="${SVG}">${markup}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement
}

/** What one element of a drawing breaks. */
function elementProblems(element: Element): string[] {
  const found: string[] = []
  const inMask = element.closest('mask') !== null
  if (!ELEMENTS.has(element.localName)) found.push(`<${element.localName}>`)
  if (element.hasAttribute('class')) found.push('a class (use data-fine)')
  const colours = inMask ? MASK_COLOURS : COLOURS
  for (const attribute of ['fill', 'stroke']) {
    const value = element.getAttribute(attribute)
    if (value !== null && !colours.has(value))
      found.push(`${attribute}="${value}"`)
  }
  // A mask shape without its own stroke inherits currentColor, which on a
  // dark theme fills every knockout.
  if (inMask && element.localName !== 'mask' && !element.hasAttribute('stroke'))
    found.push('a mask shape without a stroke')
  if (element.hasAttribute('id') && element.localName !== 'mask')
    found.push('an id off a mask')
  return found
}

/** A drawing's masks: ids made from $k, used only by the drawing that owns them. */
function maskProblems(root: Element): string[] {
  const found: string[] = []
  const ids = [...root.querySelectorAll('mask')].map((mask) => mask.id)
  if (ids.some((id) => !id.startsWith('$k')))
    found.push('a mask id not made from $k')
  for (const user of root.querySelectorAll('[mask]')) {
    const target = /^url\(#(.+)\)$/.exec(user.getAttribute('mask') ?? '')?.[1]
    if (target === undefined || !ids.includes(target))
      found.push('a mask it does not own')
  }
  return found
}

/** What breaks the pack's rules in one drawing. */
function problems(markup: string): string[] {
  const root = parse(markup)
  if (root.querySelector('parsererror')) return ['does not parse']
  return [
    ...[...root.querySelectorAll('*')].flatMap(elementProblems),
    ...maskProblems(root),
  ]
}

describe('the instrument glyph drawings', () => {
  it('draw every glyph in the catalogue, and nothing else', () => {
    expect(Object.keys(INSTRUMENT_DRAWINGS).sort()).toEqual(
      INSTRUMENT_GLYPHS.map((glyph) => glyph.id).sort(),
    )
  })

  it('keep the pack’s rules in all 58', () => {
    const broken = Object.entries(INSTRUMENT_DRAWINGS)
      .map(([id, markup]) => [id, problems(markup)] as const)
      .filter(([, found]) => found.length > 0)

    expect(broken).toEqual([])
  })

  it('catch a mask shape that would inherit the stroke', () => {
    expect(
      problems(
        '<defs><mask id="$k"><circle cx="1" cy="1" r="1" fill="#000"/></mask></defs><path mask="url(#$k)" d="M0 0h1"/>',
      ),
    ).toEqual(['a mask shape without a stroke'])
  })
})

describe('an instrument glyph', () => {
  it('hides from assistive tech and takes its size class', () => {
    const { container } = render(() => (
      <InstrumentGlyph glyph="grand-piano" size={16} />
    ))
    const svg = container.querySelector('svg')!

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('data-size', '16')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg.querySelector('[data-fine]')).not.toBeNull()
  })

  it('gives each instance its own mask, so two flutes never share their holes', () => {
    const { container } = render(() => (
      <>
        <InstrumentGlyph glyph="flute" size={20} />
        <InstrumentGlyph glyph="flute" size={20} />
      </>
    ))
    const masks = [...container.querySelectorAll('mask')].map((mask) => mask.id)
    const users = [...container.querySelectorAll('[mask]')].map((element) =>
      element.getAttribute('mask'),
    )

    expect(masks).toHaveLength(2)
    expect(new Set(masks).size).toBe(2)
    expect(masks.some((id) => id.includes('$'))).toBe(false)
    expect(users).toEqual(masks.map((id) => `url(#${id})`))
  })
})

describe('an instrument chip', () => {
  it('names its instrument when given a label, on its family’s hue', () => {
    render(() => (
      <InstrumentChip
        glyph="trumpet"
        family="brass"
        size={28}
        label="Trumpet"
      />
    ))
    const chip = screen.getByRole('img', { name: 'Trumpet' })

    expect(chip).toHaveAttribute('title', 'Trumpet')
    expect(chip.style.getPropertyValue('--chip-hue')).toBe(
      'var(--studio-hue-lime)',
    )
    expect(chip.querySelector('svg')).toHaveAttribute('data-size', '20')
  })

  it('is decoration without a label, and neutral on a silent lane', () => {
    const { container } = render(() => (
      <InstrumentChip glyph="kick" family="drums" size={32} silent />
    ))
    const chip = container.firstElementChild!

    expect(chip).toHaveAttribute('aria-hidden', 'true')
    expect(chip).not.toHaveAttribute('role')
    expect(chip).toHaveAttribute('data-silent', '')
    expect(chip.querySelector('svg')).toHaveAttribute('data-size', '24')
  })
})
