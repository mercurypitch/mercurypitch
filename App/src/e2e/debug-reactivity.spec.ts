import { test, expect } from '@playwright/test'

test('debug reactive behavior', async ({ page }) => {
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

  // Test reactive updates with setTimeout trick
  const result = await page.evaluate(async () => {
    const results = []
    const store = (window as any).__appStore

    // Get initial state
    results.push({ step: 'initial', tab: store.activeTab?.() })

    // Click the tab using mouse
    const btn = document.getElementById('tab-settings')
    if (btn) {
      // Check if click event fires
      let clickFired = false
      btn.addEventListener(
        'click',
        () => {
          clickFired = true
        },
        { once: true },
      )
      ;(btn as HTMLElement).click()
      results.push({
        step: 'after-click',
        clickFired,
        tab: store.activeTab?.(),
      })
    }

    // Wait for any reactive updates
    await new Promise((r) => setTimeout(r, 1000))
    results.push({ step: 'after-wait', tab: store.activeTab?.() })

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

  console.log('Reactivity test results:', JSON.stringify(result, null, 2))
})
