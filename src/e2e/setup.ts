import { test as base } from '@playwright/test'

export const test = base
export { expect } from '@playwright/test'

/** Fixture to ensure app is fully mounted and ready */
export const appMounted = test.extend<{
  isMounted: boolean
}>({
  isMounted: async ({ page }, use) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    use(true)
  },
})
