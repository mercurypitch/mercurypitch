import { test } from '@playwright/test'

test('debug settings tab click - detailed', async ({ page }) => {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })

  // Dismiss welcome
  const overlay = page.locator('.welcome-overlay')
  if ((await overlay.count()) > 0 && (await overlay.isVisible())) {
    const dismissBtn = page.locator('.welcome-cta, .overlay-close')
    if ((await dismissBtn.count()) > 0) {
      await dismissBtn.first().click()
      await overlay.waitFor({ state: 'hidden', timeout: 5000 })
    }
  }

  // Check tab signal before click
  const beforeTab = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore
    return {
      activeTab: store?.activeTab?.(),
      tabSignal: typeof store?.activeTab,
    }
  })
  console.info('Before click:', JSON.stringify(beforeTab))

  // Click via native click()
  const clicked = await page.evaluate(() => {
    const btn = document.getElementById('tab-settings')
    if (btn === null || btn === undefined) return 'no button'
    btn.click()
    return 'clicked'
  })
  console.info('Click result:', clicked)
  await page.waitForTimeout(500)

  // Check tab signal after click
  const afterTab = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore
    return { activeTab: store?.activeTab?.() }
  })
  console.info('After click:', JSON.stringify(afterTab))

  // Check DOM state - active tab button
  const activeBtn = await page.evaluate(() => {
    const btn = document.querySelector('.app-tab.active')
    return btn !== null && btn !== undefined ? btn.id : 'no active'
  })
  console.info('Active tab button:', activeBtn)

  // Check settings panel
  const settingsPanel = await page.evaluate(() => {
    const el = document.getElementById('settings-panel')
    if (el === null || el === undefined) return 'not found'
    const parent = el.parentElement
    const grandparent = parent?.parentElement
    return {
      found: true,
      parentTag: parent?.tagName,
      parentId: parent?.id,
      grandparentTag: grandparent?.tagName,
      grandparentId: grandparent?.id,
      display: window.getComputedStyle(el).display,
      visibility: window.getComputedStyle(el).visibility,
    }
  })
  console.info('Settings panel DOM state:', JSON.stringify(settingsPanel))

  // Check main-content children
  const mainContent = await page.evaluate(() => {
    const el = document.querySelector('.main-content')
    if (el === null || el === undefined) return 'not found'
    return Array.from(el.children).map((c) => ({
      tag: c.tagName,
      id: c.id,
      class: c.className,
    }))
  })
  console.info('main-content children:', JSON.stringify(mainContent))
})
