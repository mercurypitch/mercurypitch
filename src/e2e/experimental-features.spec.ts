// ============================================================
// Experimental features e2e — Studio follows the build's default and the owner's switch
// ============================================================
//
// The e2e bundle is built with experimental features on, as the dev deploy
// is, and with no API. The store's e2e door (window.__MP_E2E_EXPERIMENTS__,
// loopback only) lets a spec boot it as the production build's default and
// read the owner's switches from the page's own origin, where page.route
// answers GET /api/features. Nothing here reaches a real worker.

import { expect, test, type Page } from '@playwright/test'
import { dismissOverlays, expectNavTabAbsent, expectNavTabOffered, openNavTab, waitForNav, } from './helpers/ui'

const STUDIO_TAB = 'tab-studio-night'
const APP_MODE_TOAST = 'hidden by your App Mode settings'

interface Boot {
  /** The default to boot with; left out, the e2e bundle's own (on). */
  buildDefault?: boolean
  /** What GET /api/features answers. Changed between loads by the spec. */
  switches: Record<string, boolean>
  /** Answer only once this settles, with the read held open meanwhile. */
  hold?: Promise<void>
}

/** Open the e2e door and answer the switches. Returns the count of reads. */
async function boot(page: Page, options: Boot): Promise<{ reads: number }> {
  const seen = { reads: 0 }
  const door: Record<string, unknown> = {}
  if (options.buildDefault !== undefined)
    door.buildDefault = options.buildDefault
  // A held read must not give up on its own while the spec looks.
  if (options.hold !== undefined) door.timeoutMs = 60_000
  await page.addInitScript((door) => {
    const win = window as unknown as Record<string, unknown>
    win.E2E_TEST_MODE = true
    win.__MP_E2E_EXPERIMENTS__ = door
  }, door)
  await page.route('**/api/features', async (route) => {
    seen.reads += 1
    await options.hold
    await route.fulfill({ json: options.switches })
  })
  return seen
}

function studio(page: Page) {
  return page.getByRole('region', { name: 'Studio', exact: true })
}

async function expectHome(page: Page): Promise<void> {
  await expect(page.locator('#tab-home')).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page).toHaveURL(/#\/home$/)
  await expect(studio(page)).toHaveCount(0)
}

test.describe('Studio as an experimental feature', () => {
  test('a build whose default is off offers Studio nowhere and sends its address Home', async ({
    page,
  }) => {
    const seen = await boot(page, { buildDefault: false, switches: {} })

    await page.goto('/')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    await expectNavTabAbsent(page, STUDIO_TAB)

    // Later in the session, past the startup grace the App Mode toast
    // waits out: the address still lands Home, with no App Mode excuse.
    await page.waitForFunction(() => performance.now() > 2500)
    await page.evaluate(() => {
      window.location.hash = '#/studio-night'
    })
    await expectHome(page)
    await expect(page.getByText(APP_MODE_TOAST)).toHaveCount(0)

    // A fresh load of the entry page lands Home too, once the read answers.
    await page.goto('/studio-night')
    await waitForNav(page, 30_000)
    await expectHome(page)
    expect(seen.reads).toBe(2)
  })

  test("the owner's switch opens Studio over that default, deep link included", async ({
    page,
  }) => {
    await boot(page, { buildDefault: false, switches: { studio: true } })

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)

    await expect(studio(page)).toBeVisible()
    await expect(page).toHaveURL(/#\/studio-night$/)
    await expectNavTabOffered(page, STUDIO_TAB)
  })

  test("the owner's switch hides Studio over the dev deploy's default", async ({
    page,
  }) => {
    await boot(page, { switches: { studio: false } })

    await page.goto('/')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)

    await expectNavTabAbsent(page, STUDIO_TAB)
  })

  test('the app paints while the read is out, and a deep link waits for its answer', async ({
    page,
  }) => {
    let answer!: () => void
    const hold = new Promise<void>((resolve) => {
      answer = resolve
    })
    const seen = await boot(page, {
      buildDefault: false,
      switches: {},
      hold,
    })

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)

    // Painted with the read unanswered, and the address kept for it.
    await expect.poll(() => seen.reads).toBe(1)
    await expect(page).toHaveURL(/#\/studio-night$/)
    await expect(studio(page)).toHaveCount(0)

    // No switch set: the default holds, and the address goes Home.
    answer()
    await expectHome(page)
  })

  test('switching Studio off and on again keeps its projects', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const switches: Record<string, boolean> = {}
    await boot(page, { switches })

    await page.goto('/')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    await openNavTab(page, STUDIO_TAB)
    await studio(page)
      .getByRole('button', { name: 'Create project', exact: true })
      .click()
    await studio(page).getByRole('button', { name: 'Close Add takes' }).click()
    await studio(page).getByRole('button', { name: 'Song options' }).click()
    const title = studio(page).getByRole('textbox', { name: 'Project name' })
    await expect(title).toBeEnabled()
    await title.fill('Kept through the switch')
    await title.press('Tab')
    await expect(
      studio(page).getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()

    // Off: the reload opens Studio on the default while the read is out,
    // then the answer takes it away and the address lands Home.
    switches.studio = false
    await page.reload()
    await waitForNav(page, 30_000)
    await expectHome(page)
    await expectNavTabAbsent(page, STUDIO_TAB)

    // On again: the project is where it was left.
    switches.studio = true
    await page.reload()
    await waitForNav(page, 30_000)
    await openNavTab(page, STUDIO_TAB)
    await expect(
      studio(page).getByRole('button', { name: /^Kept through the switch/ }),
    ).toBeEnabled()
    expect(errors).toEqual([])
  })
})
