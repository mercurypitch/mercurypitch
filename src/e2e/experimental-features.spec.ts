// ============================================================
// Experimental features e2e — Studio is on as mercurypitch.com is built, until the owner switches it off
// ============================================================
//
// The e2e bundle is built with experimental features on, as the dev deploy
// is, and with no API. The store's e2e door (window.__MP_E2E_EXPERIMENTS__,
// loopback only) lets a spec boot it as the production build is
// (`buildDefault: false`) and read the owner's switches from the page's own
// origin, where page.route answers GET /api/features. Nothing here reaches a
// real worker.
//
// Studio is on in production (src/lib/experimental-feature-defaults.ts): that
// build has it on with no switch set, the owner's switch takes it away, and
// clearing the switch brings it back. A feature still being built starts off
// there instead; this bundle has none, so that default is the store's unit
// tests' to cover.

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
  /**
   * How long the page waits on a read. Left out, its own 2.5 s, or 60 s
   * with `hold`, so a held read does not give up while the spec looks.
   */
  waitMs?: number
}

/** Open the e2e door and answer the switches. Returns the count of reads. */
async function boot(page: Page, options: Boot): Promise<{ reads: number }> {
  const seen = { reads: 0 }
  const door: Record<string, unknown> = {}
  if (options.buildDefault !== undefined)
    door.buildDefault = options.buildDefault
  const waitMs =
    options.waitMs ?? (options.hold !== undefined ? 60_000 : undefined)
  if (waitMs !== undefined) door.timeoutMs = waitMs
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

/** Past the page's own 2.5 s wait on the read: what it shows is what it settled on. */
async function pastTheRead(page: Page): Promise<void> {
  await page.waitForFunction(() => performance.now() > 2500)
}

/**
 * A visit, as mercurypitch.com is built, that hears the owner switch Studio
 * off: this browser keeps it for the next visit. `waitMs` is how long every
 * later page here waits on its read.
 */
async function heardStudioOff(
  page: Page,
  options: { waitMs?: number } = {},
): Promise<void> {
  await boot(page, {
    buildDefault: false,
    switches: { studio: false },
    waitMs: options.waitMs,
  })
  await page.goto('/')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  await pastTheRead(page)
  await expectNavTabAbsent(page, STUDIO_TAB)
  // The next visit's read: the test answers it its own way.
  await page.unroute('**/api/features')
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
  test('the production build offers Studio with no switch set, and opens its address', async ({
    page,
  }) => {
    const seen = await boot(page, { buildDefault: false, switches: {} })

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    await pastTheRead(page)

    await expect(studio(page)).toBeVisible()
    await expect(page).toHaveURL(/#\/studio-night$/)
    await expectNavTabOffered(page, STUDIO_TAB)
    expect(seen.reads).toBe(1)
  })

  test("the owner's switch takes Studio out of the production build and sends its address Home", async ({
    page,
  }) => {
    const seen = await boot(page, {
      buildDefault: false,
      switches: { studio: false },
    })

    await page.goto('/')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    // Past the read, and past the startup grace the App Mode toast waits out.
    await pastTheRead(page)
    await expectNavTabAbsent(page, STUDIO_TAB)

    // Later in the session the address still lands Home, with no App Mode
    // excuse: no setting brings Studio back, only the owner's switch.
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

  test('a deep link opens Studio on its default while the read is out, and goes Home when the answer switches it off', async ({
    page,
  }) => {
    let answer!: () => void
    const hold = new Promise<void>((resolve) => {
      answer = resolve
    })
    const seen = await boot(page, {
      buildDefault: false,
      switches: { studio: false },
      hold,
    })

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)

    // Painted with the read unanswered: nothing waits on it.
    await expect.poll(() => seen.reads).toBe(1)
    await expect(studio(page)).toBeVisible()
    await expect(page).toHaveURL(/#\/studio-night$/)

    answer()
    await expectHome(page)
  })

  test('a browser that heard Studio switched off holds its address for the read, and opens Studio once the owner clears the switch', async ({
    page,
  }) => {
    await heardStudioOff(page, { waitMs: 60_000 })
    let answer!: () => void
    const cleared = new Promise<void>((resolve) => {
      answer = resolve
    })
    let reads = 0
    await page.route('**/api/features', async (route) => {
      reads += 1
      await cleared
      await route.fulfill({ json: {} })
    })

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)

    // Painted on what this browser heard, Studio off, and the address kept
    // for the read, which may yet open it.
    await expect.poll(() => reads).toBe(1)
    await expect(page).toHaveURL(/#\/studio-night$/)
    await expect(studio(page)).toHaveCount(0)

    // No switch set any more: Studio's default, on, opens it where it was asked.
    answer()
    await expect(studio(page)).toBeVisible()
    await expect(page).toHaveURL(/#\/studio-night$/)
  })

  // The Studio audit's E1, the other way round now that production has
  // Studio on: a read that fails or never answers must not put the default
  // back over the owner's last word.
  test('a browser that heard Studio switched off keeps it off through a read that fails, deep link included', async ({
    page,
  }) => {
    await heardStudioOff(page)
    await page.route('**/api/features', (route) =>
      route.abort('internetdisconnected'),
    )

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)

    await expectHome(page)
    await expectNavTabAbsent(page, STUDIO_TAB)
  })

  test('a browser that heard Studio switched off keeps it off through a read that never answers', async ({
    page,
  }) => {
    await heardStudioOff(page)
    await page.route('**/api/features', () => {
      // Held past the page's 2.5 s wait, and never answered.
    })

    await page.goto('/studio-night')
    await waitForNav(page, 30_000)
    await page.waitForFunction(() => performance.now() > 3500)

    await expectHome(page)
  })

  test('switching Studio off and clearing the switch keeps its projects', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const switches: Record<string, boolean> = {}
    await boot(page, { buildDefault: false, switches })

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

    // Off: the reload opens Studio on its default while the read is out,
    // then the answer takes it away and the address lands Home.
    switches.studio = false
    await page.reload()
    await waitForNav(page, 30_000)
    await expectHome(page)
    await expectNavTabAbsent(page, STUDIO_TAB)

    // Cleared: back to the build's default, on, and the project is where it
    // was left.
    delete switches.studio
    await page.reload()
    await waitForNav(page, 30_000)
    await openNavTab(page, STUDIO_TAB)
    await expect(
      studio(page).getByRole('button', { name: /^Kept through the switch/ }),
    ).toBeEnabled()
    expect(errors).toEqual([])
  })
})
