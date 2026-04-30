import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('debug store prototype chain', async ({ page }) => {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })

  await dismissOverlays(page)

  // Check appStore prototype chain
  const protoInfo = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore

    // Check if it's a Proxy
    const isProxy = store !== null && typeof store === 'object'

    // Get own properties
    const ownKeys = Reflect.ownKeys(store)

    // Check specific keys
    const sensitivityPresetDescriptor = Object.getOwnPropertyDescriptor(
      store,
      'sensitivityPreset',
    )
    const activeTabDescriptor = Object.getOwnPropertyDescriptor(
      store,
      'activeTab',
    )

    // Check if there's a prototype
    const proto = Object.getPrototypeOf(store)

    return {
      isProxy: !!isProxy,
      protoName: proto?.constructor?.name,
      ownKeysLength: ownKeys.length,
      sensitivityPresetDescriptor: sensitivityPresetDescriptor
        ? {
            value: sensitivityPresetDescriptor.value,
            get: sensitivityPresetDescriptor.get ? 'has getter' : 'no getter',
            configurable: sensitivityPresetDescriptor.configurable,
          }
        : null,
      activeTabDescriptor: activeTabDescriptor
        ? {
            value: activeTabDescriptor.value,
            get: activeTabDescriptor.get ? 'has getter' : 'no getter',
          }
        : null,
    }
  })

  console.info('Proto info:', JSON.stringify(protoInfo, null, 2))

  // Try accessing via getOwnPropertyDescriptor
  const accessorTest = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__appStore
    const desc = Object.getOwnPropertyDescriptor(store, 'sensitivityPreset')
    if (desc !== null && desc !== undefined && desc.get) {
      return { hasGetter: true, result: desc.get() }
    }
    return {
      hasGetter: false,
      value: desc !== null && desc !== undefined ? desc.value : undefined,
    }
  })
  console.info('Accessor test:', JSON.stringify(accessorTest, null, 2))
})
