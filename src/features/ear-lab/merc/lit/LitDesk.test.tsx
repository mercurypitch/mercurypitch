// The desk's strips: alike while the mix plays, the render sounding edged
// when two are compared, and at the reveal the answer edged teal, a wrong
// pick dashed red and the boost written over its band.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { LitDesk } from './LitDesk'

afterEach(cleanup)

const BANDS = ['125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz']
const strips = (flag: string): string[] =>
  [...document.querySelectorAll(`[data-strip][${flag}]`)].map(
    (strip) => strip.getAttribute('data-strip') ?? '',
  )
const lift = (): string | null | undefined =>
  document.querySelector('[data-part="lift"]')?.textContent

describe("The desk's strips", () => {
  it('moves the strips alike while the mix plays and keeps the answer back', () => {
    render(() => <LitDesk labels={BANDS} playing highlight={0} reveal={null} />)
    expect(document.querySelectorAll('[data-strip]')).toHaveLength(6)
    expect(strips('data-answer')).toEqual([])
    expect(strips('data-picked')).toEqual([])
    expect(lift()).toBeUndefined()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      "The desk's 6 strips, the mix playing",
    )
  })

  it('edges the answer teal and a wrong pick red, the boost over its band', () => {
    render(() => (
      <LitDesk
        labels={BANDS}
        playing={false}
        highlight={0}
        reveal={{
          index: 3,
          name: '1 kHz (upper-mid)',
          picked: 4,
          lift: '+6.0 dB · upper-mid',
        }}
      />
    ))
    expect(strips('data-answer')).toEqual(['4'])
    expect(strips('data-picked')).toEqual(['5'])
    expect(lift()).toBe('+6.0 dB · upper-mid')
  })

  it('names a fault over its strip when no boost is given', () => {
    render(() => (
      <LitDesk
        labels={['Mud', 'Box', 'Harsh']}
        playing={false}
        highlight={0}
        reveal={{ index: 0, name: 'Mud' }}
      />
    ))
    expect(strips('data-answer')).toEqual(['1'])
    expect(lift()).toBe('Mud')
  })

  it('edges the render sounding when two are compared', () => {
    render(() => (
      <LitDesk
        labels={['The first', 'The second']}
        playing
        highlight={2}
        reveal={null}
      />
    ))
    expect(strips('data-sounding')).toEqual(['2'])
  })
})
