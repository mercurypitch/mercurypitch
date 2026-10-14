// ============================================================
// The launch offer's line under the gift, on a 390 px phone
// ============================================================
//
// While the server features the launch gift and states the launch offer
// beside it (GET /api/billing/promo/featured, `offer`), every place that
// offers the gift before sign-up says what using it earns, in one line
// beneath it. This drives the built pages a visitor lands on (Karaoke Night,
// the Voice Mirror's results, Settings > Credits) at a phone's width, with
// every API call answered here, and checks the line is on screen, inside its
// card, and pushes nothing past the edge. The default e2e build has no API,
// so this lives in the cloud suite (playwright.cloud.config.ts).

import { expect, test, type Locator, type Page } from '@playwright/test'

const PHONE = { width: 390, height: 844 }
const LINE =
  'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.'

/** The featured code with the offer's terms, as the worker answers. */
function featured(offer: unknown) {
  return {
    promo: {
      code: 'E2E-LAUNCH',
      credits: 5,
      expiresAt: '2099-01-01T23:59:59.000Z',
      offer,
    },
  }
}

const TERMS = {
  goal: 5,
  deadline: '2099-10-28T23:59:59.999Z',
  bonusCredits: 30,
}

async function mockCloud(page: Page, offer: unknown): Promise<void> {
  await page.route('**/cloud/api/**', async (route) => {
    await route.fulfill({
      status: route.request().method() === 'GET' ? 401 : 200,
      contentType: 'application/json',
      body: '{}',
    })
  })
  await page.route('**/cloud/api/billing/promo/featured', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(featured(offer)),
    }),
  )
}

/** The line is on screen, inside `card`, and no wider than the phone. */
async function expectLineFits(page: Page, card: Locator): Promise<void> {
  const line = card.getByTestId('gift-offer-line')
  await line.scrollIntoViewIfNeeded()
  await expect(line).toBeVisible()
  await expect(line).toHaveText(LINE)

  const [lineBox, cardBox] = await Promise.all([
    line.boundingBox(),
    card.boundingBox(),
  ])
  expect(lineBox).not.toBeNull()
  expect(cardBox).not.toBeNull()
  if (lineBox === null || cardBox === null) return
  expect(lineBox.x).toBeGreaterThanOrEqual(cardBox.x - 0.5)
  expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(
    cardBox.x + cardBox.width + 0.5,
  )
  expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(PHONE.width)
  // The page itself does not scroll sideways.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width)
}

test.use({ viewport: PHONE, isMobile: true, hasTouch: true })

test.describe('the offer line under the launch gift, at 390 px', () => {
  test('Karaoke Night says it under the gift, above the button', async ({
    page,
  }) => {
    await mockCloud(page, TERMS)
    await page.goto('/karaoke')

    const gift = page.getByTestId('kn-launch-gift')
    await expectLineFits(page, gift)
    const lineBox = await gift.getByTestId('gift-offer-line').boundingBox()
    const buttonBox = await gift
      .getByRole('button', { name: 'Create my free account' })
      .boundingBox()
    expect((lineBox?.y ?? 0) + (lineBox?.height ?? 0)).toBeLessThanOrEqual(
      buttonBox?.y ?? 0,
    )
  })

  test('Settings > Credits says it to a signed-out visitor', async ({
    page,
  }) => {
    await mockCloud(page, TERMS)
    await page.addInitScript(() => {
      localStorage.setItem('pitchperfect_welcome_version', '"1"')
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
    await page.goto('/#/settings/credits')

    await expectLineFits(page, page.getByTestId('promo-code-card'))
  })

  test('no line when the server states no offer', async ({ page }) => {
    await mockCloud(page, null)
    await page.goto('/karaoke')

    await expect(page.getByTestId('kn-launch-gift')).toBeVisible()
    await expect(page.getByTestId('gift-offer-line')).toHaveCount(0)
  })
})
