// Reproduce the Tab S9+ landscape overflow on the interval trainer.
import { chromium } from '@playwright/test'

const OUT = process.env.OUT ?? '/tmp/probe'
const VIEW = { width: 1280, height: Number(process.env.H ?? 752) }

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: VIEW,
  ignoreHTTPSErrors: true,
  hasTouch: true,
})
const page = await ctx.newPage()
await page.goto('https://localhost:3521/')
await page.evaluate(() => {
  localStorage.setItem('pitchperfect_welcome_version', '1')
  localStorage.setItem('pitchperfect_whats_new_seen', '0.9')
})
await page.goto('https://localhost:3521/#/exercises')
await page.reload()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/01-exercises-tab.png` })

// Find and open the interval trainer card.
const card = page
  .locator('button, a, [role="button"]')
  .filter({ hasText: /interval/i })
  .first()
if ((await card.count()) > 0) {
  await card.click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/02-interval-idle.png` })
} else {
  console.log('NO interval card found; dumping texts')
  console.log(
    (await page.locator('button').allTextContents()).slice(0, 40).join(' | '),
  )
}

// Grant a fake mic so Start works.
await ctx.grantPermissions(['microphone'], { origin: 'https://localhost:3521' })

const start = page
  .locator('button')
  .filter({ hasText: /^start$|start exercise|begin/i })
  .first()
if ((await start.count()) > 0) {
  await start.click()
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}/03-interval-running.png` })
  // Diagnose: which elements overflow the viewport vertically, and can we scroll?
  const diag = await page.evaluate(() => {
    const vh = window.innerHeight
    const over = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.height > 0 && (r.top < 0 || r.bottom > vh + 1) && r.width > 100) {
        const cs = getComputedStyle(el)
        if (el.children.length < 4)
          over.push({
            tag: el.tagName,
            cls: String(el.className).slice(0, 80),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            text: (el.textContent ?? '').slice(0, 60),
            ovf: cs.overflowY,
          })
      }
    }
    const scroller = document.scrollingElement
    return {
      vh,
      docScrollH: scroller?.scrollHeight,
      docClientH: scroller?.clientHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      offenders: over.slice(0, 12),
    }
  })
  console.log(JSON.stringify(diag, null, 1))
} else {
  console.log('NO start button; texts:')
  console.log(
    (await page.locator('button').allTextContents()).slice(0, 40).join(' | '),
  )
}
await browser.close()
