// Home's and Gravity's orb: nothing on the scale until the reveal; then
// the degree in the orb and its place lit, a wrong pick marked red, and
// Gravity's scale the twelve.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { GRAVITY_DEGREES } from '@/lib/ear/item-bank'
import { LitProbe } from './LitProbe'

afterEach(cleanup)

const part = (name: string): Element | null =>
  document.querySelector(`[data-part="${name}"]`)

describe("Home's glass orb", () => {
  it('lights nothing on the scale while the note rings', () => {
    render(() => (
      <LitProbe cadenceStep={4} ringing listening={false} reveal={null} />
    ))
    expect(part('answer')).toBeNull()
    expect(part('solfege')).toBeNull()
    expect(document.body.textContent).toContain('Ti')
    expect(document.body.textContent).not.toContain('Fi')
  })

  it('names the degree in the orb and lights its place at the reveal', () => {
    render(() => (
      <LitProbe
        cadenceStep={4}
        ringing={false}
        listening={false}
        reveal={{ degree: '6', solfege: 'La', correct: true, semitone: 9 }}
      />
    ))
    expect(part('solfege')?.textContent).toBe('La')
    expect(part('degree')?.textContent).toBe('6')
    expect(part('answer')).not.toBeNull()
    expect(part('pick')).toBeNull()
  })

  it("marks a wrong pick on Gravity's twelve", () => {
    render(() => (
      <LitProbe
        cadenceStep={4}
        ringing={false}
        listening={false}
        scale={GRAVITY_DEGREES}
        reveal={{
          degree: '♭6',
          solfege: 'Le',
          correct: false,
          semitone: 8,
          picked: 9,
        }}
      />
    ))
    expect(document.body.textContent).toContain('Fi')
    expect(part('answer')).not.toBeNull()
    expect(part('pick')).not.toBeNull()
  })
})
