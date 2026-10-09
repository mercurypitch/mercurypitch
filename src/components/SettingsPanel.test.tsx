// ============================================================
// SettingsPanel: the legal row in About
// ============================================================
//
// Settings › About is where the app keeps its legal documents once it has
// booted (the entry documents' raw-HTML nav hides itself then). The imprint
// has to be reachable there, next to the privacy notice and the terms.

import { render, screen, within } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { SettingsPanel } from '@/components/SettingsPanel'

describe('Settings › About', () => {
  it('lists Privacy, Terms and Imprint in its legal row', () => {
    render(() => <SettingsPanel />)

    const about = screen
      .getByText('About MercuryPitch')
      .closest('[data-tour="settings.about"]')
    expect(about).not.toBeNull()
    const legal = within(about as HTMLElement).getByRole('navigation', {
      name: 'Legal',
    })
    expect(
      within(legal)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual([
      'https://about.mercurypitch.com/privacy',
      'https://about.mercurypitch.com/terms',
      'https://about.mercurypitch.com/imprint/',
    ])
  })
})
