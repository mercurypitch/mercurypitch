// Beat Hunt's strings of light: the sounding pair lit and swinging, the
// two pairs alike until the reveal, then the beating pair named with its
// rate and the other said to be in tune.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { LitStrings } from './LitStrings'

afterEach(cleanup)

const pair = (n: 1 | 2): Element | null =>
  document.querySelector(`[data-pair="${n}"]`)

describe("Beat Hunt's strings of light", () => {
  it('lights the pair sounding and says nothing of which is beating', () => {
    render(() => <LitStrings sounding={2} reveal={null} />)
    expect(pair(2)?.hasAttribute('data-sounding')).toBe(true)
    expect(pair(1)?.hasAttribute('data-sounding')).toBe(false)
    expect(document.querySelectorAll('[data-beating]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-part="rate"]')).toHaveLength(0)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Two strings of light, the second pair sounding',
    )
  })

  it('names the beating pair at the reveal, with its rate, and the other in tune', () => {
    render(() => <LitStrings sounding={0} reveal={{ pair: 1, rateHz: 1.4 }} />)
    expect(pair(1)?.hasAttribute('data-beating')).toBe(true)
    const rates = [...document.querySelectorAll('[data-part="rate"]')].map(
      (text) => text.textContent,
    )
    expect(rates).toEqual(['Beating · 1.4 beats a second', 'In tune'])
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Two strings of light: the first pair was beating, 1.4 beats a second',
    )
  })
})
