// Session duration test
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://pitchperfect.clodhost.com', { waitUntil: 'networkidle', timeout: 30000 });

  // Open sessions browser
  await page.click('button:has-text("Sessions")');
  await page.waitForTimeout(500);

  // Start first session (2-minute warmup)
  await page.click('.session-card');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start")');

  const startTime = Date.now();
  console.log(`Session started at ${new Date().toISOString()}`);

  // Wait up to 180 seconds for completion
  let completed = false;
  for (let i = 0; i < 180; i++) {
    await page.waitForTimeout(1000);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const itemEl = await page.$('.session-player-progress');
    const itemText = itemEl ? await itemEl.textContent() : 'N/A';
    const elapsedEl = await page.$('.session-elapsed');
    const elapsedText = elapsedEl ? await elapsedEl.textContent() : 'N/A';
    const summaryEl = await page.$('#session-summary-card');
    const itemLabel = await page.$('.session-item-label');
    const itemLabelText = itemLabel ? await itemLabel.textContent() : 'N/A';

    console.log(`${elapsed}s | ${itemText} | current: ${itemLabelText} | player: ${elapsedText}`);

    if (summaryEl) {
      const score = await page.$eval('#session-summary-card h2', el => el.textContent).catch(() => 'N/A');
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✓ SESSION COMPLETE after ${duration}s`);
      console.log(`  Result: ${score}`);
      completed = true;
      break;
    }
  }

  if (!completed) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✗ Session did NOT complete within 180s (${duration}s elapsed)`);
  }

  await browser.close();
})();