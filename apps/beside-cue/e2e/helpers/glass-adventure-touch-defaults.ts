// Native browser touch defaults stay local to movement controls; modal selection events and inputs remain usable.
import { expect, type Page } from '@playwright/test'
import { openMuseum } from './glass-adventure-controls'

export async function verifyNativeControlDefaults(
  page: Page,
  browserName: string,
): Promise<void> {
  await openMuseum(page)
  await page.evaluate(() => {
    document.addEventListener('touchstart', (event) => {
      document.body.dataset.lastTouchPrevented = String(event.defaultPrevented)
      document.body.dataset.lastTouchTrusted = String(event.isTrusted)
      document.body.dataset.lastTouchTarget = (event.target as HTMLElement).id
    })
  })
  for (const control of [
    page.getByTestId('floating-stick-knob'),
    page.getByRole('button', { name: 'Jump', exact: true }).locator('span'),
  ]) {
    await expect(control).toHaveCSS(
      browserName === 'webkit' ? '-webkit-user-select' : 'user-select',
      'none',
    )
    // Linux WebKit does not expose the iOS callout property. Verify it when the engine supports it.
    if (
      await page.evaluate(() => CSS.supports('-webkit-touch-callout', 'none'))
    )
      await expect(control).toHaveCSS('-webkit-touch-callout', 'none')
    const bounds = (await control.boundingBox())!
    await page.touchscreen.tap(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )
    await expect(page.locator('body')).toHaveAttribute(
      'data-last-touch-trusted',
      'true',
    )
    await expect(page.locator('body')).toHaveAttribute(
      'data-last-touch-prevented',
      'true',
    )
    expect(
      await control.evaluate((element) =>
        element.dispatchEvent(
          new Event('selectstart', { bubbles: true, cancelable: true }),
        ),
      ),
    ).toBe(false)
  }
  await page.getByRole('button', { name: 'Camera tuning', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await expect(dialog).toBeVisible()
  const input = dialog.getByLabel('Look sensitivity')
  const previous = await input.inputValue()
  await input.focus()
  await page.keyboard.press('ArrowRight')
  expect(await input.inputValue()).not.toBe(previous)
  expect(
    await input.evaluate((element) =>
      element.dispatchEvent(
        new Event('selectstart', { bubbles: true, cancelable: true }),
      ),
    ),
  ).toBe(true)
  const copy = dialog.getByText('Mouse and touch orbit gain.', { exact: true })
  expect(
    await copy.evaluate((element) =>
      element.dispatchEvent(
        new Event('selectstart', { bubbles: true, cancelable: true }),
      ),
    ),
  ).toBe(true)
  const bounds = (await input.boundingBox())!
  const beforeTouch = await input.inputValue()
  await page.touchscreen.tap(
    bounds.x + bounds.width * 0.65,
    bounds.y + bounds.height / 2,
  )
  await expect(page.locator('body')).toHaveAttribute(
    'data-last-touch-prevented',
    'false',
  )
  await expect(page.locator('body')).toHaveAttribute(
    'data-last-touch-trusted',
    'true',
  )
  await expect(page.locator('body')).toHaveAttribute(
    'data-last-touch-target',
    'glass-look-sensitivity',
  )
  await expect(input).not.toHaveValue(beforeTouch)
  await dialog.getByRole('button', { name: 'Close camera tuning' }).tap()
  await expect(dialog).toHaveCount(0)
}
