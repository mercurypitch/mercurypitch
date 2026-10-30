// Stack's discs: four ghosts whatever the chord while it sounds; at the
// reveal the chord's own tones, named, with the gaps between them.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { LitDiscs } from './LitDiscs'

afterEach(cleanup)

const texts = (part: string): Array<string | null> =>
  [...document.querySelectorAll(`[data-part="${part}"]`)].map(
    (node) => node.textContent,
  )

describe("Stack's discs", () => {
  it('stands four ghosts while the chord sounds, whatever its quality', () => {
    render(() => <LitDiscs sounding reveal={null} />)
    expect(document.querySelectorAll('[data-disc]')).toHaveLength(4)
    expect(document.querySelectorAll('[data-tone]')).toHaveLength(0)
    expect(texts('quality')).toEqual([])
  })

  it("settles a triad's tones at the reveal, named, with their gaps", () => {
    render(() => (
      <LitDiscs
        sounding={false}
        reveal={{ intervals: [3, 7], name: 'Minor' }}
      />
    ))
    expect(
      [...document.querySelectorAll('[data-tone]')].map((disc) =>
        disc.getAttribute('data-tone'),
      ),
    ).toEqual(['0', '3', '7'])
    expect(texts('tone')).toEqual(['root', '♭3', '5'])
    expect(texts('gap')).toEqual(['m3', 'M3'])
    expect(texts('quality')).toEqual(['Minor'])
  })

  it('fills all four for a seventh chord', () => {
    render(() => (
      <LitDiscs
        sounding={false}
        reveal={{ intervals: [4, 7, 10], name: 'Dominant 7th' }}
      />
    ))
    expect(texts('tone')).toEqual(['root', '3', '5', '♭7'])
    expect(texts('gap')).toEqual(['M3', 'm3', 'm3'])
  })
})
