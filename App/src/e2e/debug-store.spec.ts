import { test, expect } from '@playwright/test';

test('debug store and Show reactivity', async ({ page }) => {
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

  // Deep dive into what's happening
  const result = await page.evaluate(async () => {
    const store = (window as any).__appStore;
    
    // 1. Check if Show component's `when` condition is working
    // Look at the Show component that wraps settings-panel
    const settingsShowCondition = () => store.activeTab() === 'settings';
    
    // 2. Check if we can trigger a manual re-render test
    // Simulate what the tab click does
    store.setActiveTab('settings');
    
    return {
      activeTab: store.activeTab(),
      settingsCondition: settingsShowCondition(),
      // Check if there's a Show component tracking this
      hasShowCondition: true,
    };
  });
  
  console.log('Store state after setActiveTab:', JSON.stringify(result));

  // Wait for DOM update
  await page.waitForTimeout(500);
  
  // Check DOM again
  const domResult = await page.evaluate(() => {
    return {
      settingsPanelExists: !!document.getElementById('settings-panel'),
      mainContentChildren: Array.from(document.querySelector('.main-content')?.children || []).map(c => c.id || c.tagName),
    };
  });
  console.log('DOM after store change:', JSON.stringify(domResult));

  // Test if showing a known working Show (like the practice one)
  await page.evaluate(() => {
    (window as any).__appStore?.setActiveTab('practice');
  });
  await page.waitForTimeout(500);

  const practiceDom = await page.evaluate(() => {
    return {
      practiceHeaderExists: !!document.querySelector('.practice-header-bar'),
      mainContentChildren: Array.from(document.querySelector('.main-content')?.children || []).map(c => c.id || c.tagName),
    };
  });
  console.log('DOM after returning to practice:', JSON.stringify(practiceDom));
});
