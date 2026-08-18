import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

// ============================================================
// The room door says it heard you, loudly enough to notice
// ============================================================
//
// Reported after using it on a phone: "guitar night and piano night buttons
// that also go to another page, I didn't see it showing the spinner for long
// loading and it was loading multiple seconds."
//
// Measured first, before changing anything: a trusted click DOES set
// `data-busy` and mount the spinner, in the real browser, at 390px. So the
// wiring was never the problem — a 12px ring appended to a chip in the status
// row at the top of the screen was, while the eye was on the middle of the
// screen waiting for a page. jsdom cannot see any of that: it has no layout,
// and `fireEvent.click` on an anchor is not a navigation.
//
// What this file pins is therefore the whole acknowledgement: the busy
// attribute arms on a REAL click, the spinner is on screen and not clipped by
// the chip that carries it, and the control itself visibly changes.
//
// The rooms are separate documents, so a click here leaves the page and takes
// the evidence with it. `204 No Content` is the way to hold still: the
// browser treats it as "nothing to navigate to" and leaves this document
// exactly as it was, mid-tap. Aborting instead swaps in an error page, and a
// delayed response makes Playwright's own actionability waits block on the
// navigation — both hide the thing being measured.

const PHONE = { width: 390, height: 844 }

/** Answer the room's URL with "nothing here", so this page stays put. */
async function stayOnPage(
  page: import('@playwright/test').Page,
  url: string,
): Promise<void> {
  await page.route(url, (route) => route.fulfill({ status: 204, body: '' }))
}

/** What the tap actually looks like: the ring's box against its chip's. */
async function acknowledgement(
  chip: import('@playwright/test').Locator,
): Promise<{
  width: number
  height: number
  clipped: boolean
  faded: boolean
}> {
  return chip.evaluate((element) => {
    const spinner = element.querySelector('[data-testid="spinner"]')
    if (spinner === null) {
      return { width: 0, height: 0, clipped: true, faded: false }
    }
    const s = spinner.getBoundingClientRect()
    const c = element.getBoundingClientRect()
    return {
      width: s.width,
      height: s.height,
      // `.chip` carries `overflow: hidden`, which paints nothing past the
      // padding box. The spinner is appended last, so the right edge is the
      // one that can eat it.
      clipped: s.right > c.right + 0.5 || s.left < c.left - 0.5,
      faded: Number(getComputedStyle(element).opacity) < 0.9,
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
  })
  await page.setViewportSize(PHONE)
})

test('the Piano Room chip spins where a thumb can see it', async ({ page }) => {
  await page.goto('/#/piano')
  await dismissOverlays(page)
  await expect(page.getByTestId('piano-mobile-stage')).toBeVisible()
  await stayOnPage(page, '**/piano-night')

  const chip = page.getByTestId('piano-room-chip')
  await expect(chip).toBeVisible()
  const box = (await chip.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  await expect(chip).toHaveAttribute('data-busy', 'true')
  const seen = await acknowledgement(chip)
  expect(seen.width).toBeGreaterThanOrEqual(12)
  expect(seen.height).toBeGreaterThanOrEqual(12)
  expect(seen.clipped).toBe(false)
  expect(seen.faded).toBe(true)
})

test('the Piano Room chip keeps its whole label while it spins', async ({
  page,
}) => {
  // This is the only chip in the row that grows on tap, and every `.chip`
  // carries `overflow: hidden` — whose automatic minimum size is zero, so a
  // squeezed one really does get clipped. Measured at 390px before the fix:
  // scrollWidth 113 against clientWidth 110, which is most of the ring gone.
  // How close it runs depends on the song title and the tempo readout beside
  // it, so this was intermittent — which is exactly why it is asserted.
  await page.goto('/#/piano')
  await dismissOverlays(page)
  await expect(page.getByTestId('piano-mobile-stage')).toBeVisible()
  await stayOnPage(page, '**/piano-night')

  const chip = page.getByTestId('piano-room-chip')
  const before = await chip.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }))
  expect(before.scrollWidth).toBeLessThanOrEqual(before.clientWidth)

  const box = (await chip.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(chip).toHaveAttribute('data-busy', 'true')

  const after = await chip.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }))
  expect(after.clientWidth).toBeGreaterThan(before.clientWidth)
  expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth)
})

test('the Guitar Night chip swaps its icon for the spinner', async ({
  page,
}) => {
  // Icon-only at phone width: one glyph of room. Growing a 34px target by a
  // 14px ring is not the same signal as that target visibly changing.
  await page.goto('/#/guitar')
  await dismissOverlays(page)
  await stayOnPage(page, '**/guitar-night')

  const chip = page.getByTestId('guitar-room-chip')
  await expect(chip).toBeVisible()
  const box = (await chip.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  await expect(chip).toHaveAttribute('data-busy', 'true')
  const seen = await acknowledgement(chip)
  expect(seen.width).toBeGreaterThanOrEqual(12)
  expect(seen.clipped).toBe(false)
  expect(seen.faded).toBe(true)

  const iconShown = await chip.evaluate((element) => {
    // The icon span is still in the DOM when hidden, and still the first
    // svg in document order — the spinner's comes after it.
    const icon = element.querySelector('svg')?.closest('span') ?? null
    return icon === null ? false : getComputedStyle(icon).display !== 'none'
  })
  expect(iconShown).toBe(false)
})

test('the options-sheet door spins too', async ({ page }) => {
  // The same room, reached the older way. It was still a plain anchor: tap,
  // and nothing at all happened on screen until the next page landed.
  await page.goto('/#/piano')
  await dismissOverlays(page)
  await expect(page.getByTestId('piano-mobile-stage')).toBeVisible()
  await stayOnPage(page, '**/piano-night')

  await page.getByLabel('Tempo and playback options').click()
  const link = page.getByTestId('open-piano-night')
  await expect(link).toBeVisible()
  const box = (await link.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  await expect(link).toHaveAttribute('data-busy', 'true')
  const seen = await acknowledgement(link)
  expect(seen.width).toBeGreaterThanOrEqual(12)
  expect(seen.clipped).toBe(false)
})
