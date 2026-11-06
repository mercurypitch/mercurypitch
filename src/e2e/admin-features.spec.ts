// ============================================================
// Admin features — the owner's experimental feature switches, in a real browser
// ============================================================
//
// The Content Studio's Features page at a phone's width and a desktop's,
// driven by keyboard. The studio is unlocked as the other admin specs unlock
// it, with E2E_TEST_MODE and a placeholder key, so no real credential is
// used. The switch routes are a stand-in answered in the page (page.route)
// that keeps state as the db-worker does. The e2e bundle has no API, so the
// page asks its own origin, a development one.

import type { Locator, Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'

const ADMIN_KEY = 'e2e-admin-key'
const AT = '2026-10-20T14:02:00.000Z'
const REACHES = 'Visitors get it on their next page load, within about 30 s.'

const VIEWPORTS = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
] as const

interface SwitchApi {
  readonly switches: Record<string, boolean>
  /** Every body the page saved, in order. */
  readonly saves: unknown[]
}

/** Answer the switch routes in the page, as the db-worker would. */
async function serveSwitchApi(page: Page): Promise<SwitchApi> {
  const api: SwitchApi = { switches: {}, saves: [] }
  const rowOf = (name: string) => ({
    name,
    enabled: api.switches[name] ?? null,
    updatedAt: name in api.switches ? AT : null,
  })
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (request.headers()['x-admin-key'] !== ADMIN_KEY) {
      await route.fulfill({
        status: 403,
        json: { error: 'Admin key required' },
      })
      return
    }
    if (pathname === '/api/admin/features' && request.method() === 'GET') {
      await route.fulfill({ json: { features: [rowOf('studio')] } })
      return
    }
    const item = /^\/api\/admin\/features\/([^/]+)$/.exec(pathname)
    if (item !== null && request.method() === 'PUT') {
      const name = decodeURIComponent(item[1])
      const body = request.postDataJSON() as { enabled: boolean | null }
      api.saves.push(body)
      const before = api.switches[name]
      if (body.enabled === null) delete api.switches[name]
      else api.switches[name] = body.enabled
      await route.fulfill({
        json: { row: rowOf(name), changed: before !== api.switches[name] },
      })
      return
    }
    await route.fulfill({ status: 404, json: { error: 'Not found' } })
  })
  return api
}

async function openFeaturesPage(page: Page): Promise<Locator> {
  await page.addInitScript((key: string) => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_admin_key', key)
    localStorage.setItem('pitchperfect_welcome_version', '1')
  }, ADMIN_KEY)
  await page.goto('/#/admin/features')
  const features = page.getByTestId('admin-features')
  await expect(features.getByText(/^Switches read at/)).toBeVisible()
  return features
}

// Route requests in the page itself, not behind a service worker's back.
test.use({ serviceWorkers: 'block' })

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`the Features page on a ${name}`, () => {
    test.use({ viewport })

    test("switches Studio on by keyboard, then hands it back to the build's default", async ({
      page,
    }) => {
      const api = await serveSwitchApi(page)
      const features = await openFeaturesPage(page)
      const card = features.getByRole('listitem', { name: 'Studio' })
      const on = card.getByRole('button', { name: 'Studio: On' })
      const fallback = card.getByRole('button', {
        name: /^Studio: Build default, (on|off) here$/,
      })
      await expect(features).toContainText(
        "Each environment has its own switches, development and production alike, and the ones here are the development environment's.",
      )
      await expect(fallback).toHaveAttribute('aria-pressed', 'true')
      const box = await on.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)

      await on.focus()
      await page.keyboard.press('Enter')

      await expect(card).toContainText(`Studio is switched on here. ${REACHES}`)
      await expect(on).toHaveAttribute('aria-pressed', 'true')
      await expect(on).toBeFocused()
      await expect(card).toContainText('On for visitors here')

      // Off, then the build's default: two Tabs along the same group.
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await expect(fallback).toBeFocused()
      await page.keyboard.press('Enter')

      await expect(card).toContainText("Studio is back on the build's default")
      await expect(fallback).toHaveAttribute('aria-pressed', 'true')
      expect(api.saves).toEqual([{ enabled: true }, { enabled: null }])
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
}
