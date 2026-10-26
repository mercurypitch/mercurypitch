// ============================================================
// The standalone rooms draw their controls in their own font
// ============================================================
// A button, input or select does not inherit the page's font family: the
// browser gives it its own. The main app resets that in app.css, and the
// rooms with entries of their own do not load app.css, so every rule that
// set no family left its control in the browser's Arial: seven on Karaoke
// Night's desk view, the master volume on Piano Night and the privacy
// button on the Voice Mirror's start screen.
//
// The browser's own family is read off a button in a shadow root, where no
// page rule reaches, so the test names no font and holds on any platform.

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Each room, and a control that is there only once the room has drawn
 *  what the sweep found (Karaoke Night's rail and account chip stream in
 *  after first paint). */
const ROOMS = [
  { path: '/karaoke-night', ready: { role: 'button', name: 'Sign in' } },
  {
    path: '/piano-night',
    ready: { role: 'slider', name: 'Piano Night master volume' },
  },
  {
    path: '/mirror',
    ready: { role: 'button', name: 'Privacy: how your audio is handled' },
  },
] as const

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

/** Every visible control still in the browser's own family. */
function controlsInTheBrowserFont(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.createElement('div')
    document.body.append(host)
    const probe = document.createElement('button')
    host.attachShadow({ mode: 'open' }).append(probe)
    const browserFont = getComputedStyle(probe).fontFamily
    host.remove()
    const found: string[] = []
    for (const control of document.querySelectorAll<HTMLElement>(
      'button, input, select, textarea',
    )) {
      const box = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      if (box.width === 0 || box.height === 0) continue
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (style.fontFamily !== browserFont) continue
      const name =
        control.getAttribute('aria-label') ??
        (control.textContent?.trim() || control.tagName.toLowerCase())
      found.push(`${name} (${browserFont})`)
    }
    return found
  })
}

for (const room of ROOMS) {
  for (const viewport of VIEWPORTS) {
    test(`${room.path} draws no control in the browser's own font on a ${viewport.name}`, async ({
      page,
    }) => {
      // Arrange: this server only; the demo lyrics and the badges live on
      // other hosts, and a refusal is what an offline visit gets anyway.
      await page.route(
        (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
        (route) => route.abort(),
      )
      await page.addInitScript(() => {
        ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
      })
      await page.setViewportSize(viewport)

      // Act
      await page.goto(room.path)
      await expect(
        page.getByRole(room.ready.role, { name: room.ready.name }),
      ).toBeVisible({ timeout: 15000 })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))

      // Assert
      expect(await controlsInTheBrowserFont(page)).toEqual([])
    })
  }
}
