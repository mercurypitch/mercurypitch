import { test, expect } from '@playwright/test';

test('debug store prototype chain', async ({ page }) => {
  await page.goto('http://localhost:4173/');
  await page.waitForSelector('#app-tabs', { timeout: 10000 });

  // Dismiss welcome if present
  const overlay = page.locator('.welcome-overlay');
  if (await overlay.count() > 0 && await overlay.isVisible()) {
    const dismissBtn = page.locator('.welcome-cta, .overlay-close');
    if (await dismissBtn.count() > 0) {
      await dismissBtn.first().click();
      await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  // Check appStore prototype chain
  const protoInfo = await page.evaluate(() => {
    const store = (window as any).__appStore;
    
    // Check if it's a Proxy
    const isProxy = store !== null && typeof store === 'object' && store[Symbol.for('solid')[Symbol.toStringTag]];
    
    // Get own properties
    const ownKeys = Reflect.ownKeys(store);
    
    // Check specific keys
    const sensitivityPresetDescriptor = Object.getOwnPropertyDescriptor(store, 'sensitivityPreset');
    const activeTabDescriptor = Object.getOwnPropertyDescriptor(store, 'activeTab');
    
    // Check if there's a prototype
    const proto = Object.getPrototypeOf(store);
    
    return {
      isProxy: !!isProxy,
      protoName: proto?.constructor?.name,
      ownKeysLength: ownKeys.length,
      sensitivityPresetDescriptor: sensitivityPresetDescriptor ? {
        value: sensitivityPresetDescriptor.value,
        get: sensitivityPresetDescriptor.get ? 'has getter' : 'no getter',
        configurable: sensitivityPresetDescriptor.configurable,
      } : null,
      activeTabDescriptor: activeTabDescriptor ? {
        value: activeTabDescriptor.value,
        get: activeTabDescriptor.get ? 'has getter' : 'no getter',
      } : null,
    };
  });
  
  console.log('Proto info:', JSON.stringify(protoInfo, null, 2));
  
  // Try accessing via getOwnPropertyDescriptor
  const accessorTest = await page.evaluate(() => {
    const store = (window as any).__appStore;
    const desc = Object.getOwnPropertyDescriptor(store, 'sensitivityPreset');
    if (desc?.get) {
      return { hasGetter: true, result: desc.get() };
    }
    return { hasGetter: false, value: desc?.value };
  });
  console.log('Accessor test:', JSON.stringify(accessorTest, null, 2));
});
