// Contour's pen: the first tone drawn as it sounds, the second left to
// the ear; at the reveal the second drawn where it went, with its gap.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { LitTrace } from './LitTrace'

afterEach(cleanup)

const way = (): string | null | undefined =>
  document.querySelector('[data-part="way"]')?.textContent

describe("Contour's pen", () => {
  it('waits at the second tone while the answer is open, drawing none of it', () => {
    render(() => <LitTrace sounding={0} armed reveal={null} />)
    expect(way()).toBeUndefined()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'A pen trace waiting at the second tone',
    )
  })

  it('draws the second tone at the reveal and writes the way and the gap', () => {
    render(() => (
      <LitTrace
        sounding={0}
        armed={false}
        reveal={{ direction: 'up', wrong: null, cents: 100 }}
      />
    ))
    expect(way()).toBe('Up · 100¢')
  })

  it('says only the same for a level step, no gap', () => {
    render(() => (
      <LitTrace
        sounding={0}
        armed={false}
        reveal={{ direction: 'same', wrong: 'down', cents: 50 }}
      />
    ))
    expect(way()).toBe('The same')
  })
})
