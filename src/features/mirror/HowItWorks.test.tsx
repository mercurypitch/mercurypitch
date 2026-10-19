// ============================================================
// Voice Mirror's overview: the first glide stops at a comfortable top
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HowItWorks } from './HowItWorks'

vi.mock('./funnel', () => ({ trackFunnel: vi.fn() }))
// The cards' demos draw on a canvas, which jsdom does not have.
vi.mock('./TaskDemo', () => ({ TaskDemo: () => null }))

afterEach(cleanup)

describe('HowItWorks', () => {
  it('asks the first glide for the highest comfortable note', () => {
    const { container } = render(() => (
      <HowItWorks onLetsGo={() => {}} onBack={() => {}} />
    ))

    const cards = [...container.querySelectorAll('.mirror-howto-card')]
    expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual([
      'Glide up',
      'Glide down',
      'Hold a note',
      'Sing it back',
    ])
    expect(cards[0]?.querySelector('.mirror-howto-blurb')?.textContent).toBe(
      'Slide like a siren, from your lowest comfy note to your highest comfortable note.',
    )
  })
})
