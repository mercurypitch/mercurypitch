// audit-computed.mjs — Capture computed styles from the community profile
// and algorithm tester to find regressions vs what main branch would show.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Go to community page
await page.goto('https://localhost:3000/#/community');
await page.waitForTimeout(2000);

// Dismiss welcome overlay if present
const welcomeClose = page.locator('[class*="welcomeOverlay"] button:has-text("×"), [class*="welcomeOverlay"] button:has-text("Skip"), [class*="welcomeClose"]');
if (await welcomeClose.count() > 0) {
  await welcomeClose.first().click({ force: true });
  await page.waitForTimeout(500);
}

// Also try clicking anywhere to dismiss
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// Click Profile tab
const profileBtn = page.locator('button:has-text("Profile")');
if (await profileBtn.count() > 0) {
  await profileBtn.click({ force: true });
  await page.waitForTimeout(1000);
}

// Screenshot the profile view
await page.screenshot({ path: '/tmp/audit-profile.png', fullPage: true });
console.log('Screenshot: /tmp/audit-profile.png');

// Audit: Check profile section computed styles
const profileContainer = page.locator('[class*="profileContainer"]').first();
if (await profileContainer.count() > 0) {
  const cs = await profileContainer.evaluate(el => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      border: s.border,
      borderRadius: s.borderRadius,
      padding: s.padding,
      display: s.display,
      width: s.width,
      height: s.height,
    };
  });
  console.log('profileContainer:', JSON.stringify(cs, null, 2));
} else {
  console.log('profileContainer: NOT FOUND — class not resolved');
  // Try raw class
  const raw = page.locator('.profileContainer').first();
  if (await raw.count() > 0) {
    const cs = await raw.evaluate(el => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, border: s.border, padding: s.padding };
    });
    console.log('RAW .profileContainer:', JSON.stringify(cs, null, 2));
  } else {
    console.log('RAW .profileContainer also NOT FOUND');
  }
}

// Audit stat badges
const statBadges = page.locator('[class*="statBadge"], [class*="stat-badge"]');
const badgeCount = await statBadges.count();
console.log(`\nstatBadge elements found: ${badgeCount}`);
if (badgeCount > 0) {
  const cs = await statBadges.first().evaluate(el => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      border: s.border,
      borderRadius: s.borderRadius,
      padding: s.padding,
      display: s.display,
      flexDirection: s.flexDirection,
      alignItems: s.alignItems,
    };
  });
  console.log('statBadge computed:', JSON.stringify(cs, null, 2));
} else {
  console.log('No statBadge elements found');
  // Try raw
  const raw = page.locator('.stat-badge');
  const rawCount = await raw.count();
  console.log(`RAW .stat-badge found: ${rawCount}`);
}

// Audit profileHeader
const ph = page.locator('[class*="profileHeader"]').first();
if (await ph.count() > 0) {
  const cs = await ph.evaluate(el => {
    const s = getComputedStyle(el);
    return { display: s.display, gap: s.gap, flexWrap: s.flexWrap, marginBottom: s.marginBottom };
  });
  console.log('profileHeader:', JSON.stringify(cs, null, 2));
}

// Audit profileAvatar
const pa = page.locator('[class*="profileAvatar"]').first();
if (await pa.count() > 0) {
  const cs = await pa.evaluate(el => {
    const s = getComputedStyle(el);
    return { width: s.width, height: s.height, borderRadius: s.borderRadius, background: s.backgroundColor, border: s.border };
  });
  console.log('profileAvatar:', JSON.stringify(cs, null, 2));
} else {
  console.log('profileAvatar: NOT FOUND');
}

// Check what classes the profileContainer's children have
const containerChildren = page.locator('[class*="profileStatsRow"] > *');
const childCount = await containerChildren.count();
console.log(`\nstatBadge: 0 but checking children of profileStatsRow...`);
console.log(`profileStatsRow children: ${childCount}`);

// Check statValue — what parent classes does it have?
const sv = page.locator('[class*="statValue"]').first();
if (await sv.count() > 0) {
  const cs = await sv.evaluate(el => {
    const parent = el.parentElement;
    return {
      selfClass: el.getAttribute('class'),
      selfFontSize: getComputedStyle(el).fontSize,
      selfFontWeight: getComputedStyle(el).fontWeight,
      parentClass: parent?.getAttribute('class'),
      parentParentClass: parent?.parentElement?.getAttribute('class'),
    };
  });
  console.log('statValue & parents:', JSON.stringify(cs, null, 2));
}

// Check statLabel
const sl = page.locator('[class*="statLabel"]').first();
if (await sl.count() > 0) {
  const cs = await sl.evaluate(el => {
    return { selfClass: el.getAttribute('class'), text: el.textContent };
  });
  console.log('statLabel:', JSON.stringify(cs, null, 2));
}

// Dump the actual HTML of the stats section
const statsRow = page.locator('[class*="profileStatsRow"]').first();
if (await statsRow.count() > 0) {
  const html = await statsRow.evaluate(el => el.innerHTML);
  console.log('\nprofileStatsRow innerHTML (first 500 chars):');
  console.log(html.substring(0, 500));
}

// Check ALL attributes on the stat parent divs
const statsRowEl = await statsRow.elementHandle();
if (statsRowEl) {
  const childInfo = await statsRowEl.evaluate(el => {
    const children = Array.from(el.children);
    return children.map(c => ({
      tag: c.tagName,
      className: c.className,
      allAttrs: Array.from(c.attributes).map(a => `${a.name}=${a.value}`),
    }));
  });
  console.log('\nstat children details:');
  for (const c of childInfo) {
    console.log(`  ${c.tag} class="${c.className}" attrs=[${c.allAttrs.join(', ')}]`);
  }
}

// Also check: what does profileStatsRow class look like?
const statsRowEl2 = await statsRow.elementHandle();
if (statsRowEl2) {
  const info = await statsRowEl2.evaluate(el => ({
    className: el.className,
    allAttrs: Array.from(el.attributes).map(a => `${a.name}=${a.value}`),
  }));
  console.log('\nprofileStatsRow:', JSON.stringify(info, null, 2));
}

// Now check the algorithm tester
await page.goto('https://localhost:3000/#/analysis');
await page.waitForTimeout(1500);

// Click "Pitch Algorithms" tab
const algoTab = page.locator('button:has-text("Pitch Algorithms")');
if (await algoTab.count() > 0) {
  await algoTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/audit-algo.png', fullPage: true });
  console.log('\nAlgorithm tester screenshot: /tmp/audit-algo.png');

  // Check layout
  const layout = page.locator('[class*="layout"]').first();
  if (await layout.count() > 0) {
    const cs = await layout.evaluate(el => {
      const s = getComputedStyle(el);
      return { display: s.display, gridTemplateColumns: s.gridTemplateColumns, gap: s.gap };
    });
    console.log('algorithm layout:', JSON.stringify(cs, null, 2));
  }

  // Check result section
  const rs = page.locator('[class*="overallScore"], [class*="resultSection"]').first();
  if (await rs.count() > 0) {
    const cs = await rs.evaluate(el => {
      const s = getComputedStyle(el);
      return { display: s.display, flexDirection: s.flexDirection, gridTemplateColumns: s.gridTemplateColumns };
    });
    console.log('result section:', JSON.stringify(cs, null, 2));
  }
}

await browser.close();
console.log('\nAudit complete.');
