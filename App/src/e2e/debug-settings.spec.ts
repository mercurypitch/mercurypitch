import { test } from '@playwright/test'

test('debug settings panel mounting', async ({ page }) => {
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

  // Get initial DOM state
  const initialMainContent = await page.evaluate(() => {
    const el = document.querySelector('.main-content')
    if (el === null || el === undefined) return 'not found'
    return Array.from(el.children).map(
      (c) => `${c.tagName}#${c.id}.${c.className.split(' ')[0]}`,
    )
  })
  console.info('Initial main-content:', JSON.stringify(initialMainContent))

  // Manually click tab via Playwright
  await page.click('#tab-settings')
  await page.waitForTimeout(500)

  // Check if settings panel appeared
  const settingsPanel = await page.locator('#settings-panel').count()
  console.info('Settings panel count after click:', settingsPanel)

  // Get final DOM state
  const finalMainContent = await page.evaluate(() => {
    const el = document.querySelector('.main-content')
    if (el === null || el === undefined) return 'not found'
    return Array.from(el.children).map(
      (c) => `${c.tagName}#${c.id}.${c.className.split(' ')[0]}`,
    )
  })
  console.info('Final main-content:', JSON.stringify(finalMainContent))

  // Check if there's any element containing 'settings' text
  const settingsText = await page.evaluate(() => {
    const elements = document.querySelectorAll('*')
    const found = []
    for (const el of elements) {
      if (el.textContent !== null && el.textContent !== undefined && el.textContent.includes('Settings') && el.children.length === 0) {
        found.push(`${el.tagName}#${el.id}.${el.className}`)
      }
    }
    return found
  })
  console.info(
    'Elements with Settings text:',
    JSON.stringify(settingsText.slice(0, 10)),
  )
})
