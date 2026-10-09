// ============================================================
// Break Glass: the legal row at the foot of the page
// ============================================================
//
// Break Glass is an ad landing page with no route to Settings, so once it has
// loaded its own foot is the only place a visitor can find the imprint.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { GlassApp } from './GlassApp'

afterEach(cleanup)

describe('Break Glass page foot', () => {
  it('links Privacy, Terms and Imprint once the page has loaded', () => {
    const { container } = render(() => <GlassApp />)

    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(
      within(legal)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual([
      'https://about.mercurypitch.com/privacy',
      'https://about.mercurypitch.com/terms',
      'https://about.mercurypitch.com/imprint/',
    ])
    // At the foot: the last thing in the page shell.
    expect(container.querySelector('.glass-shell')?.lastElementChild).toBe(
      legal,
    )
  })
})
