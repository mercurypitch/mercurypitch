import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('debug appStore structure', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })

  await dismissOverlays(page)

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
