// ============================================================
// MixingDesk: the reveal's nameplate hangs clear under the frame —
// it once sat inside it, squashed against the strip labels.
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { MixingDesk } from './MixingDesk'

afterEach(cleanup)

describe('MixingDesk', () => {
  it('writes the reveal below the panel, not against the labels', () => {
    render(() => (
      <MixingDesk
        labels={['Mud', 'Box', 'Harsh']}
        playing={false}
        highlight={0}
        reveal={{ index: 2, name: 'Harsh — a peak around 3 kHz' }}
      />
    ))
    const desk = screen.getByRole('img', { name: 'The mixing desk' })
    const frame = desk.querySelector('rect')
    const nameplate = desk.querySelector('[data-part="nameplate"]')
    expect(nameplate?.textContent).toBe('Harsh — a peak around 3 kHz')
    const frameBottom =
      Number(frame?.getAttribute('y')) + Number(frame?.getAttribute('height'))
    expect(Number(nameplate?.getAttribute('y'))).toBeGreaterThan(
      frameBottom + 12,
    )
    // And the viewBox leaves it room.
    const height = Number(desk.getAttribute('viewBox')?.split(' ')[3])
    expect(height).toBeGreaterThanOrEqual(
      Number(nameplate?.getAttribute('y')) + 12,
    )
  })
})
