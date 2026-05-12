import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('debug reactive behavior', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)

  // Test reactive updates with setTimeout trick
  const result = await page.evaluate(async () => {
    const results = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore

    // Get initial state
    results.push({ step: 'initial', tab: store?.activeTab?.() })

    // Click the tab using mouse
    const btn = document.getElementById('tab-settings')
    if (btn !== null && btn !== undefined) {
      // Check if click event fires
      let clickFired = false
      btn.addEventListener(
        'click',
        () => {
          clickFired = true
        },
        { once: true },
      )
      btn.click()
      results.push({
        step: 'after-click',
        clickFired,
        tab: store?.activeTab?.(),
      })
    }

    // Wait for any reactive updates
    await new Promise((r) => setTimeout(r, 1000))
    results.push({ step: 'after-wait', tab: store?.activeTab?.() })

    // Check DOM
    const mainContent = document.querySelector('.main-content')
    results.push({
      step: 'dom-check',
      mainContentChildren: mainContent
        ? Array.from(mainContent.children).map((c) => c.id)
        : null,
    })

    return results
  })

  console.info('Reactivity test results:', JSON.stringify(result, null, 2))
})
