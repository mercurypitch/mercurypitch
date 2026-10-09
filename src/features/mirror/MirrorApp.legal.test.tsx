// ============================================================
// Voice Mirror: the legal row at the foot of the page
// ============================================================
//
// The Mirror is an ad landing page with no route to Settings, so once it has
// loaded its own foot is the only place a visitor can find the imprint.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { MirrorApp } from './MirrorApp'

afterEach(cleanup)

describe('Voice Mirror page foot', () => {
  it('links Privacy, Terms and Imprint once the page has loaded', () => {
    const { container } = render(() => <MirrorApp entryIntent="voice-mirror" />)

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
    expect(container.querySelector('.mirror-shell')?.lastElementChild).toBe(
      legal,
    )
  })
})
