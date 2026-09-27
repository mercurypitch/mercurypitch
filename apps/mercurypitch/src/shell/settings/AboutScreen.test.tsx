// ============================================================
// About: the app's own, without the web's rows
// ============================================================
//
// S6 step 9 (8b). The mark, the version and build, the two policies and a
// way to write, then the privacy line. The web's GitHub link, the third-party
// badge and the pills for rooms the app does not have stay on the web.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTACT_FORM_URL } from '@/lib/contact-links'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { AboutScreen } from './AboutScreen'
import type * as DeviceFactsModule from './device-facts'
import { loadDeviceFacts } from './device-facts'

vi.mock('./device-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof DeviceFactsModule>()),
  loadDeviceFacts: vi.fn(),
}))

let view: RenderedShell | null = null

function link(id: string): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>(
    `[data-settings-row="${id}"]`,
  )
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

beforeEach(() => {
  vi.mocked(loadDeviceFacts).mockResolvedValue({
    model: 'iPhone17,3',
    system: 'iOS 26.0',
    version: '0.6.0 (380)',
  })
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('About', () => {
  it('names the app with its version and build (8b)', async () => {
    view = renderShell(() => <AboutScreen />)
    await settle()

    expect(view.container.textContent).toContain('MercuryPitch')
    expect(view.container.textContent).toContain('Version 0.6.0 (380)')
  })

  it('opens the policies and the contact form outside the app', async () => {
    view = renderShell(() => <AboutScreen />)
    await settle()

    expect(link('about-privacy')?.getAttribute('href')).toBe(PRIVACY_URL)
    expect(link('about-terms')?.getAttribute('href')).toBe(TERMS_URL)
    expect(link('about-contact')?.getAttribute('href')).toBe(CONTACT_FORM_URL)
    expect(link('about-privacy')?.getAttribute('target')).toBe('_blank')
  })

  it("carries none of the web's rows", async () => {
    view = renderShell(() => <AboutScreen />)
    await settle()
    const hrefs = [...view.container.querySelectorAll('a')].map(
      (a) => a.getAttribute('href') ?? '',
    )

    expect(hrefs.some((href) => href.includes('github.com'))).toBe(false)
    expect(view.container.querySelector('img[src*="peerpush"]')).toBeNull()
  })

  it('ends on the privacy line', async () => {
    view = renderShell(() => <AboutScreen />)
    await settle()
    const screen = view.container.querySelector('[data-testid="about-screen"]')

    expect(screen?.lastElementChild?.textContent?.trim()).toBe(
      'Only you can hear you.',
    )
  })
})
