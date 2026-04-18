import { expect, test } from '@playwright/test'

test('live site settings', async ({ page }) => {
  await page.goto('https://pitchperfect.clodhost.com/')
  await page.waitForSelector('#app-tabs', { timeout: 15000 })

  const overlay = page.locator('.welcome-overlay')
  if ((await overlay.count()) > 0 && (await overlay.isVisible())) {
    const dismissBtn = page.locator('.welcome-cta, .overlay-close')
    if ((await dismissBtn.count()) > 0) {
      await dismissBtn.first().click()
      await overlay.waitFor({ state: 'hidden', timeout: 5000 })
    }
  }

  console.info(
    'Initial tabs:',
    JSON.stringify(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('[id^="tab-"]')).map((t) => ({
          id: t.id,
          class: t.className,
        })),
      ),
    ),
  )

  await page.locator('#tab-settings').click()
  await page.waitForTimeout(3000)

  console.info(
    'After clicking Settings:',
    JSON.stringify(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('[id^="tab-"]')).map((t) => ({
          id: t.id,
          class: t.className,
        })),
      ),
    ),
  )

  console.info(
    'Settings panel count:',
    await page.locator('#settings-panel').count(),
  )
  await expect(page.locator('#settings-panel')).toBeVisible({ timeout: 5000 })
})
