// Hairline's loupe, upright, in the room: higher on screen for higher,
// the two lines unnamed and even about the middle until the reveal,
// then the higher one named and the glass's magnification said.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { loupeMagnification, RoomLoupe } from './RoomLoupe'

afterEach(cleanup)

/** A drawn line's offset from the middle: its group's translateY. */
function offset(line: string): number {
  const drawn = document.querySelector(`[data-line="${line}"]`)
  const moved = drawn?.parentElement?.getAttribute('style') ?? ''
  const match = /translateY\((-?[\d.]+)px\)/u.exec(moved)
  if (match === null) throw new Error(`no offset on ${line}: ${moved}`)
  return Number(match[1])
}

const textAt = (testId: string): SVGTextElement =>
  screen.getByTestId(testId) as unknown as SVGTextElement

describe("Hairline's loupe, upright", () => {
  it('stands the scale on its end, higher on screen for higher in pitch', () => {
    render(() => <RoomLoupe gap={50} sounding={0} reveal={null} />)

    const y = (words: string): number =>
      Number(
        [...document.querySelectorAll('text')]
          .find((text) => text.textContent === words)
          ?.getAttribute('y'),
      )
    expect(y('+50¢')).toBeLessThan(y('0'))
    expect(y('0')).toBeLessThan(y('−50¢'))
  })

  it('keeps the two lines alike, unnamed and even about the middle while listening', () => {
    render(() => <RoomLoupe gap={12.5} sounding={1} reveal={null} />)

    expect(offset('upper')).toBeLessThan(0)
    expect(offset('lower')).toBe(-offset('upper'))
    expect(offset('lower-magnified')).toBe(-offset('upper-magnified'))
    // Lit or named, a line would say which way the gap went.
    const higher = document.querySelectorAll('[data-line][class*="higher"]')
    expect(higher).toHaveLength(0)
    expect(screen.queryAllByTestId('loupe-higher')).toHaveLength(0)
    expect(screen.queryAllByTestId('loupe-magnification')).toHaveLength(0)
    expect(textAt('loupe-readout').textContent).toBe('12.5¢')
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'An upright scale under a loupe: two hairlines 12.5¢ apart',
    )
  })

  it.each([
    ['first', 'The first'],
    ['second', 'The second'],
  ] as const)(
    'names the higher line at the reveal, the %s, and says how far the glass magnifies',
    (reveal, name) => {
      render(() => <RoomLoupe gap={12.5} sounding={0} reveal={reveal} />)

      const tag = textAt('loupe-higher')
      expect(tag.textContent).toBe(name)
      // Level with the upper line in the glass, not the lower.
      const middle = 118
      expect(Number(tag.getAttribute('y'))).toBeCloseTo(
        middle + offset('upper-magnified'),
        5,
      )
      expect(textAt('loupe-magnification').textContent).toBe('×8')
      expect(
        document
          .querySelector('[data-line="upper-magnified"]')
          ?.getAttribute('class'),
      ).toMatch(/higher/u)
      expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
        `An upright scale under a loupe: two hairlines 12.5¢ apart, magnified 8 times, the ${reveal} tone higher`,
      )
    },
  )

  it('magnifies the gap in the glass by exactly what it says', () => {
    render(() => <RoomLoupe gap={12.5} sounding={0} reveal="second" />)

    expect(offset('upper-magnified') / offset('upper')).toBeCloseTo(8, 5)
  })

  it('magnifies by a whole number, the most for the finest gaps', () => {
    expect(loupeMagnification(0.5)).toBe(12)
    expect(loupeMagnification(12.5)).toBe(8)
    expect(loupeMagnification(50)).toBe(2)
    expect(loupeMagnification(104)).toBe(1)
    expect(loupeMagnification(200)).toBe(1)
  })

  it('names the upper line from just above it when the two nearly meet', () => {
    render(() => <RoomLoupe gap={0.5} sounding={0} reveal="first" />)

    const tag = Number(textAt('loupe-higher').getAttribute('y'))
    expect(tag).toBeLessThan(118 + offset('upper-magnified'))
  })

  it('puts its words between the lines once even x1 cannot hold them apart', () => {
    render(() => <RoomLoupe gap={150} sounding={0} reveal="second" />)

    const upper = 118 + offset('upper-magnified')
    const lower = 118 + offset('lower-magnified')
    for (const id of ['loupe-higher', 'loupe-readout', 'loupe-magnification']) {
      const y = Number(textAt(id).getAttribute('y'))
      expect(y, id).toBeGreaterThan(upper)
      expect(y, id).toBeLessThan(lower)
    }
    expect(textAt('loupe-magnification').textContent).toBe('×1')
  })
})
