const { chromium } = require('/root/mercurypitch-clod-one/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--no-sandbox'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const allLogs = [];
  const playheadLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    allLogs.push(`[${msg.type()}] ${text}`);
    if (text.includes('[PLAYHEAD]')) {
      playheadLogs.push(`[${msg.type()}] ${text}`);
    }
  });

  console.log('Navigating to compose...');
  await page.goto('https://localhost:5173/#/compose', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Find the main canvas (piano roll grid)
  const canvasInfo = await page.$$eval('canvas', els => els.map((e, i) => ({
    index: i,
    id: e.id,
    className: e.className,
    width: e.width,
    height: e.height,
    styleWidth: e.style.width,
    styleHeight: e.style.height,
    position: (() => {
      const rect = e.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    })(),
    display: e.style.display,
    zIndex: e.style.zIndex,
  })));
  console.log('Canvas elements:', JSON.stringify(canvasInfo, null, 2));

  // Find the main grid canvas (not ball, not ruler)
  const mainCanvas = canvasInfo.find(c => c.position.width > 200 && c.position.height > 200 && c.styleWidth !== '0px');
  if (!mainCanvas) {
    console.log('No suitable canvas found');
    await page.screenshot({ path: '/root/mercurypitch-clod-one/test-screenshot-compose.png', fullPage: true });
    await browser.close();
    return;
  }

  console.log('Using canvas:', mainCanvas.id || mainCanvas.className, 'at', mainCanvas.position);

  // Click on the grid to place a note
  // The grid typically has 16 beats per row and rows for MIDI notes
  const gridCenterX = mainCanvas.position.left + mainCanvas.position.width / 2;
  const gridCenterY = mainCanvas.position.top + mainCanvas.position.height / 2;

  console.log('Clicking grid at:', gridCenterX, gridCenterY);

  // First click to place a note
  await page.mouse.click(gridCenterX, gridCenterY);
  await page.waitForTimeout(500);

  // Click a second note to the right
  await page.mouse.click(gridCenterX + 50, gridCenterY - 30);
  await page.waitForTimeout(500);

  console.log('Notes placed. Looking for Play button...');

  // Click the Play button
  const playBtn = await page.$('button:has-text("Play")');
  if (playBtn) {
    console.log('Clicking Play...');
    await playBtn.click();
    await page.waitForTimeout(3000); // Let it play for 3 seconds
    console.log('Playback started...');
  } else {
    console.log('Play button not found');
  }

  // Wait for playback to complete
  await page.waitForTimeout(5000);

  console.log('\n--- [PLAYHEAD] Logs ---');
  if (playheadLogs.length === 0) console.log('(none)');
  else playheadLogs.forEach(l => console.log(l));

  console.log('\n--- Last 20 console logs ---');
  allLogs.slice(-20).forEach(l => console.log(l));

  await page.screenshot({ path: '/root/mercurypitch-clod-one/test-screenshot-after-play.png', fullPage: true });
  console.log('\nScreenshot saved');

  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
