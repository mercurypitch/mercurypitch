// ============================================================
// Beta purchases — reversible access, offer confirmation and keyboard safety
// ============================================================

import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 664 },
  { width: 1280, height: 900 },
]) {
  test(`internal purchase loop ${viewport.width} @smoke`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?devSeed&mockPurchases')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const pro = page.getByRole('region', { name: 'BeSideCue Pro' })
    const offer = pro.getByRole('button', { name: /^Test an offer/ })
    await expect(pro.getByText('Active', { exact: true })).toHaveCount(0)
    await offer.click()
    const dialog = page.getByRole('dialog', { name: 'Test a premium offer' })
    const apply = dialog.getByRole('button', {
      name: 'Apply a 60-day test offer',
    })
    const cancel = dialog.getByRole('button', {
      name: 'Close without changing anything',
    })
    await expect(apply).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(apply).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(offer).toBeFocused()
    await expect(pro.getByText('Active', { exact: true })).toHaveCount(0)

    await offer.click()
    await page.screenshot({ path: info.outputPath('offer.png') })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width)
    await apply.click()
    await expect(pro.getByText('Active', { exact: true })).toBeVisible()
    await expect(pro.getByText('Premium access is confirmed.')).toBeVisible()
    await pro.screenshot({ path: info.outputPath('premium-active.png') })
    await page.reload()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(pro.getByText('Active', { exact: true })).toBeVisible()
    await pro.getByRole('button', { name: 'Manage subscription' }).click()
    await page.getByRole('button', { name: 'Expire the entitlement' }).click()
    await expect(pro.getByText('Active', { exact: true })).toHaveCount(0)
    await pro.getByRole('button', { name: 'Restore purchases' }).click()
    await expect(pro.getByText('Active', { exact: true })).toHaveCount(0)
    await pro.getByRole('button', { name: 'Unlock BeSideCue Pro' }).click()
    await page
      .getByRole('button', { name: 'Close without changing anything' })
      .click()
    await expect(pro.getByText('Active', { exact: true })).toHaveCount(0)
    await pro.getByRole('button', { name: 'Unlock BeSideCue Pro' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Monthly/ })
      .click()
    await expect(pro.getByText('Active', { exact: true })).toBeVisible()
    await expect(pro.getByText('Thank you. Pro is active.')).toBeVisible()
  })
}

test('beta offer remains usable at 200% text @smoke', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/?devSeed&mockPurchases')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await page.getByRole('button', { name: /^Test an offer/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Test a premium offer' })
  await dialog
    .getByRole('button', { name: 'Close without changing anything' })
    .scrollIntoViewIfNeeded()
  expect(
    await dialog.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(320)
  await page.screenshot({ path: info.outputPath('offer-large-text.png') })
  await dialog
    .getByRole('button', { name: 'Close without changing anything' })
    .click()
  await expect(dialog).toHaveCount(0)
})
