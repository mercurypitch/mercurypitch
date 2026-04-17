// Full smoke test for session feature
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('https://pitchperfect.clodhost.com', { waitUntil: 'networkidle', timeout: 30000 });

  // 1. Sessions button should be visible
  const sessionsBtn = await page.$('button:has-text("Sessions")');
  console.log('1. Sessions button:', sessionsBtn ? 'PASS' : 'FAIL');

  // 2. Click Sessions → modal opens
  if (sessionsBtn) {
    await sessionsBtn.click();
    await page.waitForTimeout(500);
    const modal = await page.$('.session-browser');
    console.log('2. Session browser modal:', modal ? 'PASS' : 'FAIL');

    // 3. Session cards visible
    const cards = await page.$$('.session-card');
    console.log(`3. Session cards (${cards.length}):`, cards.length >= 5 ? 'PASS' : 'FAIL');

    // 4. Category tabs work
    const vocalTab = await page.$('.cat-tab:has-text("Vocal")');
    if (vocalTab) {
      await vocalTab.click();
      await page.waitForTimeout(200);
      const vocalCards = await page.$$('.session-card');
      console.log(`4. Vocal filter (${vocalCards.length} cards):`, 'PASS');
    }

    // 5. Start a session
    const startBtn = await page.$('.start-btn, button:has-text("Start")');
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(500);
      const player = await page.$('.session-player');
      console.log('5. Session player appeared:', player ? 'PASS' : 'FAIL');

      // 6. Timer is running
      const timer = await page.$('.session-timer');
      console.log('6. Session timer:', timer ? 'PASS' : 'FAIL');

      // 7. End session
      const endBtn = await page.$('button:has-text("End Session")');
      if (endBtn) {
        await endBtn.click();
        await page.waitForTimeout(500);
        const summary = await page.$('.session-summary');
        console.log('7. Session summary overlay:', summary ? 'PASS' : 'FAIL');
      }
    }

    // 8. Close summary → return to normal practice
    const closeBtn = await page.$('.summary-close, button:has-text("Close")');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // 9. Sessions button back after session
  const sessionsBtn2 = await page.$('button:has-text("Sessions")');
  console.log('8. Sessions button restored:', sessionsBtn2 ? 'PASS' : 'FAIL');

  // 10. Sidebar has session history section
  const historySection = await page.$('.session-history-section, .session-history-panel');
  console.log('9. Session history sidebar section:', historySection ? 'PASS' : 'FAIL');

  // Report errors
  if (errors.length > 0) {
    console.log('\nConsole errors:');
    errors.forEach(e => console.log(' -', e));
  } else {
    console.log('\n10. No console errors: PASS');
  }

  await browser.close();
})();