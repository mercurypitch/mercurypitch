import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('debug store prototype chain', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)

  const protoInfo = await page.evaluate(() => {
    const store = (window as any).__appStore

    if (!store || typeof store !== 'object') {
      return { error: 'store is not an object', storeType: typeof store }
    }

    const ownKeys = Reflect.ownKeys(store)
    const proto = Object.getPrototypeOf(store)

    return {
      isProxy: true,
      protoName: proto?.constructor?.name,
      ownKeysLength: ownKeys.length,
    }
  })

  console.info('Proto info:', JSON.stringify(protoInfo, null, 2))
})
