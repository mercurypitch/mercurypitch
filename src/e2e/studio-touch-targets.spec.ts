// Studio touch targets — on a phone, the header's menu and heart, each sheet's close, and every button and field in Track details take a 44 px press.
import { expect, type Locator, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { bringToMiddle, hitArea } from './helpers/hit-area'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

async function press(control: Locator): Promise<[number, number]> {
  await bringToMiddle(control)
  return (await hitArea(control)).hit
}

test('a phone’s Studio takes a 44 px press on the menu, the heart, every sheet’s close and Track details’ controls', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openArrangement(page)
  const studio = studioRegion(page)
  await importStudioAudio(page, 'Bass', 2)
  const presses: Record<string, [number, number]> = {}

  presses.Menu = await press(
    page.getByRole('button', { name: 'Menu', exact: true }),
  )
  const heart = page.getByTestId('support-heart')
  if ((await heart.count()) > 0) presses.Heart = await press(heart)

  await studio
    .getByRole('button', { name: 'Phrase details', exact: true })
    .click()
  const details = studio.getByRole('dialog', { name: 'Track details' })
  await expect(details).toBeVisible()
  // Every control the sheet holds, its fields included: a field's label
  // takes the press with it, and hit-testing counts that.
  const controls = page
    .locator('[data-studio-panel]')
    .last()
    .locator('button, select, input')
  const count = await controls.count()
  expect(count).toBeGreaterThan(5)
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index)
    if (!(await control.isVisible())) continue
    const name = await control.evaluate(
      (element) =>
        element.getAttribute('aria-label') ??
        element.closest('label')?.querySelector('span')?.textContent ??
        element.textContent?.trim().slice(0, 40) ??
        element.tagName,
    )
    presses[`Track details: ${name}`] = await press(control)
  }
  await details
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()

  for (const sheet of ['Sound', 'Export'] as const) {
    await studio.getByRole('button', { name: sheet, exact: true }).click()
    const close = studio.getByRole('button', {
      name: `Close ${sheet}`,
      exact: true,
    })
    presses[`Close ${sheet}`] = await press(close)
    await close.click()
  }

  for (const [name, [width, height]] of Object.entries(presses)) {
    expect(width, `${name} width`).toBeGreaterThanOrEqual(44)
    expect(height, `${name} height`).toBeGreaterThanOrEqual(44)
  }
})
