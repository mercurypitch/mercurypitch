import { test } from '@playwright/test'

test('check if appStore is available in evaluate', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Check basic DOM state
  await page.evaluate(() => {
    const root = document.getElementById('root') as Element | null
    return {
      hasRoot: root !== null,
      rootChildren: root?.children.length ?? 0,
    }
  })

  // Wait and check after load
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  await page.evaluate(() => {
    return {
      appStore: typeof (window as any).__appStore !== 'undefined',
      hasRoot: document.getElementById('root') !== null,
    }
  })
})