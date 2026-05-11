import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('debug settings panel mounting', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)

  // Get initial DOM state
  const initialMainContent = await page.evaluate(() => {
    const el = document.querySelector('.main-content')
    if (el == null) return 'not found'
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
    if (el == null) return 'not found'
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
      if (
        el.textContent !== null &&
        el.textContent !== undefined &&
        el.textContent.includes('Settings') &&
        el.children.length === 0
      ) {
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
