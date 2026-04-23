import { test, expect } from '@playwright/test'

test('minimal module load test', async ({ page }) => {
  const errorOccurred = await page.evaluate(() => {
    // Try to explicitly load the index module
    try {
      // Check if index.tsx even loads
      const script = document.querySelector('script') as HTMLScriptElement | null
      console.log('index.tsx script element:', script?.src)

      // Try to call window.onerror handler (returns true if handled)
      const handled = (window as any).onerror?.('test error', '', 0, 0, null)
      console.log('window.onerror handled:', handled)

      return {
        success: true,
        errorFlag: 'test set',
      }
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
      }
    }
  })
  console.log('Error check:', JSON.stringify(errorOccurred))
})