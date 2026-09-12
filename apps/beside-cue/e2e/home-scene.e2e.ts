// ============================================================
// Home scene — the record sits on the platter, and the room answers
// ============================================================
// The seat is a CSS box over a bitmap; the numbers are the landing's pixel
// measurement of turntable-hero.png. Measure the real layout at the app's
// own widths, never the stylesheet text.

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const PLATTER = {
  centreX: 0.41275,
  centreY: 0.39815,
  width: 0.5661,
  squash: 0.3666,
}

async function openHome(page: Page, width: number, height = 844) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?devSeed')
  const region = page.getByRole('region', { name: 'Your current plan' })
  await expect(region).toBeVisible()
  return region
}

for (const width of [320, 375, 440, 1024]) {
  test(`the record is seated on the platter at ${width} wide @smoke`, async ({
    page,
  }, info) => {
    const region = await openHome(page, width, width > 700 ? 1366 : 844)
    const deck = region.locator('img[src*="turntable-hero"]')
    await expect(deck).toBeVisible()
    const record = region.locator('svg[data-side]')
    await expect(record).toHaveAttribute('data-side', 'A')
    await expect(record).toHaveAttribute('data-motion', 'still')
    // The devSeed plan names its own Pull, so the label wears the drop mark.
    await expect(record).toHaveAttribute('data-label', 'mark')

    const deckBox = (await deck.boundingBox())!
    const recordBox = (await record.boundingBox())!
    const centreX = recordBox.x + recordBox.width / 2
    const centreY = recordBox.y + recordBox.height / 2
    expect(
      Math.abs(centreX - (deckBox.x + deckBox.width * PLATTER.centreX)),
    ).toBeLessThanOrEqual(1.5)
    expect(
      Math.abs(centreY - (deckBox.y + deckBox.height * PLATTER.centreY)),
    ).toBeLessThanOrEqual(1.5)
    expect(
      Math.abs(recordBox.width - deckBox.width * PLATTER.width),
    ).toBeLessThanOrEqual(1.5)
    expect(
      Math.abs(recordBox.height - recordBox.width * PLATTER.squash),
    ).toBeLessThanOrEqual(1.5)

    // Corky stands front-right and overlaps the deck's right edge.
    const corky = region.getByRole('img', { name: /^Corky/u })
    const corkyBox = (await corky.boundingBox())!
    expect(corkyBox.x).toBeLessThan(deckBox.x + deckBox.width)
    expect(corkyBox.y + corkyBox.height).toBeGreaterThan(deckBox.y)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)

    // The plan is text outside the scene, and the primary action sits above
    // the nav without scrolling on a phone.
    const sideB = page.getByText('Walk to the end of the street', {
      exact: true,
    })
    await expect(sideB).toBeVisible()
    const primary = page.getByRole('button', { name: /^Cue me now/u })
    const primaryBox = (await primary.boundingBox())!
    const navBox = (await page.getByRole('navigation').boundingBox())!
    expect(primaryBox.y + primaryBox.height).toBeLessThanOrEqual(navBox.y)
    if (width > 700) {
      // Two columns: the scene to the right of the plan text.
      const sideBBox = (await sideB.boundingBox())!
      expect(deckBox.x).toBeGreaterThan(sideBBox.x + sideBBox.width)
    }
    await page.screenshot({ path: info.outputPath(`home-${width}.png`) })
  })
}

test('pause, the reminder row and a recorded Side B all read on the room @smoke', async ({
  page,
}) => {
  const region = await openHome(page, 390)
  const record = region.locator('svg[data-side]')
  await expect(page.getByText('Your Side B', { exact: true })).toBeVisible()
  const reminder = page.getByRole('button', { name: /^Daily reminder/u })
  await expect(reminder).toContainText('Only when I ask')

  await page.getByRole('button', { name: 'Pause this plan' }).click()
  await expect(region.getByText('Paused', { exact: true })).toBeVisible()
  await expect(reminder).toContainText(
    'This reminder stays off while your plan is paused.',
  )
  await expect(page.getByRole('button', { name: /^Cue me now/u })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: /^Resume this plan/u }).click()
  await expect(page.getByRole('button', { name: /^Cue me now/u })).toBeVisible()
  await expect(region.getByText('Paused', { exact: true })).toHaveCount(0)

  await reminder.click()
  await expect(
    page.getByRole('heading', { name: 'Daily reminder' }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Go back' }).click()

  await page.getByRole('button', { name: /^Cue me now/u }).click()
  await page.getByRole('button', { name: 'Choose Side B' }).click()
  await page.getByRole('button', { name: 'Back to home' }).click()
  await expect(record).toHaveAttribute('data-side', 'B')
  await expect(page.getByText('Your Side B · turned today')).toBeVisible()
})
