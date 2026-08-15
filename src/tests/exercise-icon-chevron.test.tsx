// ============================================================
// The chevron on the gallery's Zen chip
// ============================================================
//
// `exercise-icons.tsx` is thirty-odd pure SVG components and no unit test
// renders any of them, so a new one arrives uncovered and a typo in its path
// data ships silently — it draws nothing and nothing complains. This covers
// the one this branch added, and the two props every icon in the file takes:
// a size that reaches both dimensions, and a class that reaches the element.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { IconChevronRight } from '@/components/exercise-icons'

afterEach(cleanup)

describe('IconChevronRight', () => {
  it('draws a chevron sized by its prop', () => {
    const { container } = render(() => <IconChevronRight size={15} />)
    const svg = container.querySelector('svg')

    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('width')).toBe('15')
    expect(svg?.getAttribute('height')).toBe('15')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')

    // Stroked, not filled — it inherits the colour of the chip it sits in.
    expect(svg?.getAttribute('fill')).toBe('none')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')

    // One path, and it points right: x rises from 9 through 15 and back.
    const path = container.querySelector('path')
    expect(path?.getAttribute('d')).toBe('M9 6l6 6-6 6')
  })

  it('defaults to 24 and takes a class', () => {
    const { container } = render(() => <IconChevronRight class="zen-chevron" />)
    const svg = container.querySelector('svg')

    expect(svg?.getAttribute('width')).toBe('24')
    expect(svg?.classList.contains('zen-chevron')).toBe(true)
  })
})
