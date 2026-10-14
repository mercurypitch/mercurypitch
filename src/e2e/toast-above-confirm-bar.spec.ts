// ============================================================
// The foot of a phone screen is a stack, and no layer covers another
// ============================================================
//
// Bottom up: the tab bar, the cookie consent banner, the confirm-email pill,
// the toasts. Each layer publishes the room it takes on <html>
// (src/lib/foot-space.ts) and the layer above stands on it.
//
// Measured in a production build with an EEA clock on 14 Oct 2026, before
// this: the banner covered 46 px of the tab bar at 390x844 and every tab in
// it; on Karaoke Night it covered 108 px of the confirm pill, Resend and
// Dismiss included, and with no banner at all a toast covered 56 px of the
// pill; on a 1440x900 desktop the banner covered 61 px of it.
//
// The e2e build ships no Google tag and no API, so neither the real banner nor
// the real pill can mount here, and the banner's CSS is not even in the build.
// The banner is stood in for by what it publishes while open, as in
// toast-above-consent-banner.spec.ts: `--consent-banner-space` and a box of
// that height. The pill is stood in for by a box wearing its shipped CSS
// module class (found in the page's own stylesheets), so where it stands is
// the shipped CSS. Each stand-in publishes its room the way publishFootSpace
// does; the JS half is pinned in src/lib/foot-space.test.ts, and the banner's
// rule in src/tests/foot-stack-css.test.ts. The tab bar and the toasts are the
// real ones.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** The real banner's height at 390x844, and the confirm pill's, as
 *  measured: three lines and two buttons, and two wrapped rows. */
const BANNER_HEIGHT = 158
const PILL_HEIGHT = 122

async function boot(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    try {
      if (sessionStorage.getItem('e2e.foot.seeded') === '1') return
      sessionStorage.setItem('e2e.foot.seeded', '1')
      // The studio's first-run flow and tour offer would cover the tab bar.
      localStorage.setItem('pitchperfect_onboarding_done', '1')
      for (const tab of ['home', 'singing'])
        localStorage.setItem(`pitchperfect_page_tour_offered_${tab}`, 'true')
    } catch {
      // Storage blocked: the spec fails on what it then sees.
    }
  })
  await page.goto(path)
}

/** The CSS module class of the one rule that declares `marker`. */
async function shippedClass(page: Page, marker: string): Promise<string> {
  const found = await page.evaluate((m) => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (
          rule instanceof CSSStyleRule &&
          /^\.[\w-]+$/.test(rule.selectorText) &&
          rule.cssText.includes(m)
        )
          return rule.selectorText.slice(1)
      }
    }
    return null
  }, marker)
  expect(found, `a rule declaring ${marker}`).not.toBeNull()
  return found ?? ''
}

/** A box wearing a shipped layer's class (or the inline style given),
 *  publishing its room as the real layer does: its height plus its gap to
 *  the window's foot. */
async function standIn(
  page: Page,
  options: {
    id: string
    className?: string
    style?: string
    height: number
    space: string
  },
): Promise<Locator> {
  await page.evaluate(({ id, className, style, height, space }) => {
    const el = document.createElement('section')
    el.id = id
    if (className !== undefined) el.className = className
    if (style !== undefined) el.style.cssText = style
    el.style.height = `${height}px`
    el.style.boxSizing = 'border-box'
    document.body.appendChild(el)
    const root = document.documentElement
    let last = ''
    const publish = (): void => {
      const gap = Number.parseFloat(window.getComputedStyle(el).bottom)
      const next = `${Math.ceil(el.offsetHeight + gap)}px`
      if (next === last) return
      last = next
      root.style.setProperty(space, next)
    }
    publish()
    new MutationObserver(publish).observe(root, {
      attributes: true,
      attributeFilter: ['style'],
    })
  }, options)
  return page.locator(`#${options.id}`)
}

async function edges(
  locator: Locator,
): Promise<{ top: number; bottom: number } | null> {
  const box = await locator.boundingBox()
  return box === null
    ? null
    : { top: Math.round(box.y), bottom: Math.round(box.y + box.height) }
}

/** How far `upper` reaches down into `lower`; 0 when it stands clear. */
async function overlap(upper: Locator, lower: Locator): Promise<number> {
  const a = await edges(upper)
  const b = await edges(lower)
  if (a === null || b === null) return Number.NaN
  return Math.max(0, a.bottom - b.top)
}

/** The banner where Karaoke Night has it: no tab bar, 16px off the foot,
 *  at the top of the page's z-order. */
async function bannerStandIn(page: Page): Promise<Locator> {
  return standIn(page, {
    id: 'e2e-consent-stand-in',
    style:
      'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;background:#222',
    height: BANNER_HEIGHT,
    space: '--consent-banner-space',
  })
}

/** The confirm pill, in its shipped CSS. */
async function pillStandIn(page: Page): Promise<Locator> {
  return standIn(page, {
    id: 'e2e-confirm-stand-in',
    // The pill's width cap: its rule and no other declares it.
    className: await shippedClass(page, 'min(92vw, 560px)'),
    height: PILL_HEIGHT,
    space: '--verify-banner-space',
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the tab bar publishes the room the banner stands on @smoke', async ({
    page,
  }) => {
    // The banner floors at --tabbar-space + 0.5rem (ConsentBanner.module.css,
    // pinned in foot-stack-css.test.ts). What the bar publishes has to be
    // all of the bar: its height and its float gap above the window's foot.
    await boot(page, '/')
    const tabBar = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(tabBar).toBeVisible()

    const published = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--tabbar-space'),
    )
    const top = (await edges(tabBar))?.top ?? Number.NaN
    expect(published).toBe(`${844 - top}px`)
  })

  test('Karaoke Night stacks the banner, the confirm pill and a toast @smoke', async ({
    page,
  }) => {
    // A spent confirm link raises its toast on load, with no API.
    await boot(page, '/karaoke#everified=0&everified_error=expired')
    const toast = page.getByRole('alert').filter({
      hasText: 'That confirmation link has expired',
    })
    await expect(toast).toBeVisible()

    const banner = await bannerStandIn(page)
    const pill = await pillStandIn(page)

    await expect.poll(() => overlap(pill, banner)).toBe(0)
    await expect.poll(() => overlap(toast, pill)).toBe(0)
    // All of it inside the window: nothing pushed off the top to make room.
    expect((await edges(toast))?.top).toBeGreaterThanOrEqual(0)
  })

  test('with no banner, a toast still stands on the confirm pill', async ({
    page,
  }) => {
    await boot(page, '/karaoke#everified=0&everified_error=expired')
    const toast = page.getByRole('alert').filter({
      hasText: 'That confirmation link has expired',
    })
    await expect(toast).toBeVisible()

    const pill = await pillStandIn(page)

    await expect.poll(() => overlap(toast, pill)).toBe(0)
  })
})

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the confirm pill stands on the consent banner', async ({ page }) => {
    await boot(page, '/karaoke')
    const banner = await bannerStandIn(page)
    const pill = await pillStandIn(page)

    await expect.poll(() => overlap(pill, banner)).toBe(0)
  })
})
