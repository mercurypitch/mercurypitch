import { test as base } from '@playwright/test'

export const test = base
export { expect } from '@playwright/test'

/** Fixture to ensure app is fully mounted and ready */
export const appMounted = test.extend<{
  isMounted: boolean
}>({
  isMounted: async ({ page }, use) => {
    await page.goto('/')
    await page.waitForSelector('#app-title', { timeout: 10000 })
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      {
        timeout: 5000,
      },
    )
    use(true)
  },
})
