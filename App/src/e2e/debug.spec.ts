import { test, expect } from '@playwright/test';

test('debug settings tab - comprehensive', async ({ page }) => {
  await page.goto('http://localhost:4173/');
  await page.waitForSelector('#app-tabs', { timeout: 10000 });

  // Dismiss welcome
  const overlay = page.locator('.welcome-overlay');
  if (await overlay.count() > 0 && await overlay.isVisible()) {
    const dismissBtn = page.locator('.welcome-cta, .overlay-close');
    if (await dismissBtn.count() > 0) {
      await dismissBtn.first().click();
      await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  // Check what type appStore.activeTab is in window context
  const storeType = await page.evaluate(() => {
    const store = (window as any).__appStore;
    const at = store ? store.activeTab : undefined;
    return {
      type: typeof at,
      isFunction: typeof at === 'function',
      isSignal: at && typeof at === 'object',
      keys: store ? Object.keys(store).filter(k => k.includes('Tab') || k.includes('tab') || k.includes('active')) : [],
    };
  });
  console.log('appStore.activeTab type:', JSON.stringify(storeType));

  // Check if there's a nested activeTab
  const nestedCheck = await page.evaluate(() => {
    const store = (window as any).__appStore;
    return {
      storeKeys: store ? Object.keys(store).slice(0, 30) : [],
      navKeys: store && store.navigation ? Object.keys(store.navigation) : 'no nav',
      settingsKeys: store && store.settings ? Object.keys(store.settings).slice(0, 10) : 'no settings',
    };
  });
  console.log('Store structure:', JSON.stringify(nestedCheck));

  // Click the Settings tab to switch to the settings view
  await page.locator('#tab-settings').click();
  await page.waitForTimeout(500);

  await expect(page.locator('#settings-panel')).toBeVisible({ timeout: 5000 });
});
