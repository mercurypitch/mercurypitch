import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('debug store and Show reactivity', async ({ page }) => {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)

  // Deep dive into what's happening
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore

    // 1. Check if Show component's `when` condition is working
    // Look at the Show component that wraps settings-panel
    const settingsShowCondition = () => store.activeTab() === 'settings'

    // 2. Check if we can trigger a manual re-render test
    // Simulate what the tab click does
    if (store !== null && store !== undefined) {
      store.setActiveTab('settings')
    }

    return {
      activeTab: store?.activeTab(),
      settingsCondition: settingsShowCondition(),
      // Check if there's a Show component tracking this
      hasShowCondition: true,
    }
  })

  console.info('Store state after setActiveTab:', JSON.stringify(result))

  // Wait for DOM update
  await page.waitForTimeout(500)

  // Check DOM again
  const domResult = await page.evaluate(() => {
    return {
      settingsPanelExists: !!document.getElementById('settings-panel'),
      mainContentChildren: Array.from(
        document.querySelector('.main-content')?.children || [],
      ).map((c) => c.id || c.tagName),
    }
  })
  console.info('DOM after store change:', JSON.stringify(domResult))

  // Test if showing a known working Show (like the practice one)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__appStore?.setActiveTab('practice')
  })
  await page.waitForTimeout(500)

  const practiceDom = await page.evaluate(() => {
    return {
      practiceHeaderExists: !!document.querySelector('.practice-header-bar'),
      mainContentChildren: Array.from(
        document.querySelector('.main-content')?.children || [],
      ).map((c) => c.id || c.tagName),
    }
  })
  console.info('DOM after returning to practice:', JSON.stringify(practiceDom))
})
