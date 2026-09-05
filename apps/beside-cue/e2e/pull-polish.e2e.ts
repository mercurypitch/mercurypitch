// ============================================================
// Pull polish — real pointer selection, locked shelf and pressing layout
// ============================================================
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function dragText(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rect = range.getClientRects()[0]
    return rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null
  })
  if (!box) throw new Error('Expected text bounds')
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, {
    steps: 16,
  })
  await page.mouse.up()
  return page.evaluate(() => getSelection()?.toString() ?? '')
}

for (const viewport of [
  { width: 390, height: 664 },
  { width: 320, height: 568 },
  { width: 1280, height: 900 },
]) {
  test(`pressing and text selection ${viewport.width} @smoke`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?devSeed')
    const title = page.getByRole('heading', { name: 'Your current pressing' })
    await expect(title).toBeVisible()
    const primaryBox = await page
      .getByRole('button', { name: /^Cue me now/u })
      .boundingBox()
    const navBox = await page.getByRole('navigation').boundingBox()
    expect(primaryBox!.y + primaryBox!.height).toBeLessThanOrEqual(navBox!.y)
    expect(await dragText(page, title)).toBe('')
    // A genuine pointer selection must still work for user-owned plan text.
    expect(
      await dragText(
        page,
        page.getByText('Endless scrolling', { exact: true }),
      ),
    ).toContain('scrolling')
    await page.getByRole('button', { name: 'Side B · My choice' }).click()
    await expect(
      page.getByText('Walk to the end of the street', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({ path: info.outputPath('home.png'), fullPage: true })
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const exactTime = page.getByLabel('Type exact time')
    await exactTime.fill('17:25')
    await expect(exactTime).toHaveValue('17:25')
    await expect(page.getByRole('slider')).toHaveAttribute(
      'aria-valuenow',
      '1045',
    )
    await expect(exactTime).toHaveCSS('user-select', 'text')
  })
}

test('Home pressing fits its container at 200% text @smoke', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/?devSeed')
  await page.getByRole('heading', { name: 'Your current pressing' }).waitFor()
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320)
  const pressing = page.getByRole('region', { name: 'Your current plan' })
  const bounds = await pressing.boundingBox()
  const record = await pressing.locator('svg').first().boundingBox()
  expect(record!.x).toBeGreaterThanOrEqual(bounds!.x)
  expect(record!.x + record!.width).toBeLessThanOrEqual(
    bounds!.x + bounds!.width,
  )
  await page.getByRole('button', { name: /^Cue me now/u }).click()
  await expect(
    page.getByRole('heading', { name: 'Walk to the end of the street' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Walk to the end of the street' }),
  ).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(
    (await page.getByRole('button', { name: 'Close cue' }).boundingBox())!.y,
  ).toBeGreaterThanOrEqual(0)
  await page.screenshot({ path: info.outputPath('home-large-text-action.png') })
})

test('all eight premium previews stay locked and clear the sound footer @smoke', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 664 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Tap to begin' }).click()
  await expect(
    page.getByRole('heading', { name: 'Choose your Pull' }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('radio')).toHaveCount(7)
  await page.getByText('Show premium', { exact: true }).click()
  const premium = page.getByRole('radiogroup', { name: 'Premium Pull choices' })
  await expect(premium.getByRole('radio')).toHaveCount(8)
  for (const radio of await premium.getByRole('radio').all())
    await expect(radio).toBeDisabled()
  await premium.getByText('The Tape', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('premium.png') })
  await page
    .getByRole('button', { name: 'Continue', exact: true })
    .scrollIntoViewIfNeeded()
  const action = await page
    .getByRole('button', { name: 'Continue', exact: true })
    .boundingBox()
  const mute = await page
    .getByRole('button', { name: 'Mute audio' })
    .boundingBox()
  expect(action!.y + action!.height).toBeLessThanOrEqual(mute!.y)
  await expect(
    page.getByRole('button', { name: 'Continue', exact: true }),
  ).toBeDisabled()
  await page.getByText('Hide premium', { exact: true }).click()
  await expect(page.getByRole('radio')).toHaveCount(7)
  await page
    .getByRole('radio', { name: 'Something else' })
    .locator('..')
    .click()
  const ownPull = page.getByRole('textbox', { name: 'Your Pull', exact: true })
  await ownPull.fill('Moj vlastiti Pull')
  await ownPull.press('End')
  await ownPull.press('Shift+Home')
  await ownPull.press('Backspace')
  await expect(ownPull).toHaveValue('')
  await ownPull.fill('My own Pull')
  await expect(
    page.getByRole('button', { name: 'Continue', exact: true }),
  ).toBeEnabled()
})
