import { test } from '@playwright/test'

test('debug appStore structure', async ({ page }) => {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })

  // Dismiss welcome if present
  const overlay = page.locator('.welcome-overlay')
  if ((await overlay.count()) > 0 && (await overlay.isVisible())) {
    const dismissBtn = page.locator('.welcome-cta, .overlay-close')
    if ((await dismissBtn.count()) > 0) {
      await dismissBtn.first().click()
      await overlay.waitFor({ state: 'hidden', timeout: 5000 })
    }
  }

  // Check appStore structure
  const storeInfo = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore
    if (store === null || store === undefined) return 'no store'

    // Check if sensitivityPreset exists and is a function
    const sp = store.sensitivityPreset
    return {
      hasSensitivityPreset: 'sensitivityPreset' in store,
      sensitivityPresetType: typeof sp,
      sensitivityPresetValue: typeof sp === 'function' ? sp() : sp,
      // Check activeTab
      hasActiveTab: 'activeTab' in store,
      activeTabType: typeof store.activeTab,
      activeTabValue:
        typeof store.activeTab === 'function'
          ? store.activeTab()
          : store.activeTab,
    }
  })

  console.info('appStore structure:', JSON.stringify(storeInfo, null, 2))
})
