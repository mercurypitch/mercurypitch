import { test as base } from '@playwright/test'

export const test = base
export { expect } from '@playwright/test'

/** Fixture to ensure app is fully mounted and ready */
export const appMounted = test.extend<{
  isMounted: boolean
}>({
  // Inject a fixture that runs after page setup
  isMounted: async ({ page }, use) => {
    await page.goto('/')
    // Wait for the main app content to load
    await page.waitForSelector('#app-title', { timeout: 10000 })
    // Wait for the app to be fully mounted by checking for window.__appStore
    // This ensures the onMount hook has run
    await page.waitForFunction(() => typeof (window as any).__appStore !== 'undefined', {
      timeout: 5000
    })
    use(true)
  }
})