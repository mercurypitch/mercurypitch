// Session timing + cycle counter test
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const logs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'log') logs.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('https://mercurypitch.com', { waitUntil: 'networkidle', timeout: 30000 });

  // Open session browser
  const sessionsBtn = await page.$('button:has-text("Sessions")');
  if (sessionsBtn) await sessionsBtn.click();
  await page.waitForTimeout(500);

  // Start the 2-minute warmup session
  const firstCard = await page.$('.session-card');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(300);
    const allStartBtns = await page.$$('button:has-text("Start")');
    if (allStartBtns.length > 0) await allStartBtns[0].click();
  }

  // Wait 5 seconds and check cycle counter
  await page.waitForTimeout(5000);
  const counterText = await page.$eval('#cycle-counter', el => el.textContent).catch(() => 'not found');
  const playerText = await page.$eval('.session-player-progress', el => el.textContent).catch(() => 'not found');
  const itemLabel = await page.$eval('.session-item-label', el => el.textContent).catch(() => 'not found');
  const elapsed = await page.$eval('.session-elapsed', el => el.textContent).catch(() => 'not found');

  console.log('After 5 seconds:');
  console.log('  Cycle counter:', counterText);
  console.log('  Session progress:', playerText);
  console.log('  Current item:', itemLabel);
  console.log('  Elapsed:', elapsed);

  // Check preset selector layout
  const presetGrid = await page.$('.preset-selector');
  const gridStyle = await page.$eval('.preset-selector', el => {
    const s = window.getComputedStyle(el);
    return `grid: ${s.gridTemplateRows} / ${s.gridTemplateColumns}`;
  }).catch(() => 'not found');
  console.log('  Preset grid layout:', gridStyle);

  // Check button positions
  const newBtn = await page.$('.preset-new-btn');
  const saveBtn = await page.$('.preset-save-btn');
  const deleteBtn = await page.$('.preset-delete-btn');
  console.log('  + button:', newBtn ? 'found' : 'missing');
  console.log('  Save button:', saveBtn ? 'found' : 'missing');
  console.log('  Delete button:', deleteBtn ? (await deleteBtn.isVisible() ? 'visible' : 'hidden') : 'not in DOM');

  if (errors.length > 0) {
    console.log('\nConsole errors:');
    errors.forEach(e => console.log(' -', e));
  } else {
    console.log('\nNo console errors');
  }

  await browser.close();
})();