// Comprehensive session flow diagnostic
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const events = [];
  const startTime = Date.now();

  const log = (msg) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    events.push(`[${elapsed}s] ${msg}`);
  };

  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'warn') {
      log(`BROWSER: ${msg.text()}`);
    }
    if (msg.type() === 'error') {
      log(`ERROR: ${msg.text()}`);
    }
  });

  await page.goto('https://pitchperfect.clodhost.com', { waitUntil: 'networkidle', timeout: 30000 });

  log('Page loaded, clicking Sessions');
  const sessionsBtn = await page.$('button:has-text("Sessions")');
  if (sessionsBtn) {
    await sessionsBtn.click();
    await page.waitForTimeout(500);
  }

  log('Session browser open, clicking first card');
  const firstCard = await page.$('.session-card');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(300);
    const allStartBtns = await page.$$('button:has-text("Start")');
    if (allStartBtns.length > 0) {
      await allStartBtns[0].click();
      log('Start clicked');
    }
  }

  // Poll every 500ms for up to 30 seconds
  const pollCount = 60;
  for (let i = 0; i < pollCount; i++) {
    await page.waitForTimeout(500);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    try {
      const cycleCounter = await page.$eval('#cycle-counter', el => el.textContent).catch(() => 'N/A');
      const sessionProgress = await page.$eval('.session-player-progress', el => el.textContent).catch(() => 'N/A');
      const sessionElapsed = await page.$eval('.session-elapsed', el => el.textContent).catch(() => 'N/A');
      const summaryVisible = await page.$('#session-summary-card');

      log(`elapsed=${elapsed}s | cycle="${cycleCounter}" | item="${sessionProgress}" | playerTimer="${sessionElapsed}" | summary=${!!summaryVisible}`);

      if (summaryVisible) {
        const score = await page.$eval('#session-summary-card h2', el => el.textContent).catch(() => 'N/A');
        log(`SESSION COMPLETE: ${score}`);
        break;
      }
    } catch (e) {
      log(`Poll error: ${e.message}`);
    }
  }

  console.log('\n=== Full Session Trace ===');
  events.forEach(e => console.log(e));

  await browser.close();
})();