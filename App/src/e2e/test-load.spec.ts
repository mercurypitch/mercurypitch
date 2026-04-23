import { test } from '@playwright/test'

test('minimal module load test', async ({ page }) => {
  await page.evaluate(() => {
    try {
      void (window as any).onerror?.('test error', '', 0, 0, null)
    } catch (_e) {
      /* ignore */
    }
  })
})