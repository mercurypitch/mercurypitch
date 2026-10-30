// Leap's dial: the needle hunts while the answer is open; at the reveal
// it sweeps to the interval, a wrong pick is marked and the interval
// named with its semitones.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { LitDial } from './LitDial'

afterEach(cleanup)

const part = (name: string): Element | null =>
  document.querySelector(`[data-part="${name}"]`)

describe("Leap's dial", () => {
  it('names nothing while the needle hunts', () => {
    render(() => <LitDial sounding={0} hunting reveal={null} />)
    expect(part('interval')).toBeNull()
    expect(part('pick')).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'An arc of twelve semitones, the needle hunting',
    )
  })

  it('names the interval at the reveal and marks a wrong pick', () => {
    render(() => (
      <LitDial
        sounding={0}
        hunting={false}
        reveal={{ semitones: 7, name: 'Perfect 5th', wrongSemitones: 5 }}
      />
    ))
    expect(part('interval')?.textContent).toBe('Perfect 5th')
    expect(part('pick')).not.toBeNull()
    expect(document.body.textContent).toContain('7 semitones')
  })
})
