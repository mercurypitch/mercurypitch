// A closer look at one part of a lesson page on dev (never production):
//   node probe.cjs <base> <lesson> <p390|d1440> <out> <scope selector> <click selector>...
// After the gate and the cold open's first choice, scrolls <scope> into view, then presses each
// <click selector> in turn (its first visible, enabled match), listing the scope's visible buttons
// and status text before the first press and after each. A screenshot follows each press.
// A click written as "wait:1500" waits instead; "shot:name" takes a named screenshot.
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const fs = require('fs')

const [BASE, N, TAG, OUT, SCOPE, ...CLICKS] = process.argv.slice(2)
const host = new URL(BASE).host
const ALLOWED =
  /^(dev\.mercurypitch\.com|[a-z0-9-]+-mercurypitch-preview\.[a-z0-9-]+\.workers\.dev|127\.0\.0\.1(:\d+)?|localhost(:\d+)?)$/
if (!ALLOWED.test(host)) {
  console.error(`refusing to probe ${host}: dev, a preview or a local build only`)
  process.exit(2)
}
const SIZES = { p390: [390, 844, 2], d1440: [1440, 900, 1] }
const [W, H, DSF] = SIZES[TAG]
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('fyp-tour', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`.slice(0, 300))
  })
  const local = /^(127\.0\.0\.1|localhost)/.test(host)
  await page.goto(`${BASE}/learn/${N}${local ? '.html' : ''}`, { waitUntil: 'load', timeout: 45000 })
  await page.waitForTimeout(1500)
  await page.locator('#gateBtn').click({ timeout: 1500 }).catch(() => {})
  await page.locator('#predict [data-choice], .hero [data-choice]').first().click({ timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(400)

  const list = async (label) => {
    const info = await page.evaluate((scope) => {
      const root = document.querySelector(scope)
      if (!root) return { missing: true }
      const seen = (e) => e.offsetParent !== null
      const attrs = (e) =>
        Array.from(e.attributes)
          .filter((a) => a.name.startsWith('data-') || a.name === 'id' || a.name === 'aria-pressed' || a.name === 'aria-expanded' || a.name === 'disabled')
          .map((a) => (a.value ? `${a.name}=${a.value}` : a.name))
          .join(' ')
      return {
        buttons: Array.from(root.querySelectorAll('button, a[href], input, select'))
          .filter(seen)
          .map((e) => `${e.tagName.toLowerCase()}[${attrs(e)}] "${(e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 60)}"`),
        panels: Array.from(root.querySelectorAll('[data-panel]')).map((p) => `${p.dataset.panel}${p.hidden ? '(hidden)' : seen(p) ? '' : '(not shown)'}`),
        status: Array.from(root.querySelectorAll('[role="status"], [aria-live], #singStatus'))
          .filter(seen)
          .map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160))
          .filter(Boolean),
      }
    }, SCOPE)
    console.log(`-- ${label}`)
    if (info.missing) return console.log(`   NO ${SCOPE} on the page`)
    console.log(`   panels: ${info.panels.join(' ')}`)
    for (const s of info.status) console.log(`   status: ${s}`)
    for (const b of info.buttons) console.log(`   ${b}`)
  }
  const toScope = () =>
    page.evaluate((scope) => {
      const e = document.querySelector(scope)
      if (e) window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70)
    }, SCOPE)

  await toScope()
  await page.waitForTimeout(500)
  await list('at first')
  let k = 0
  for (const sel of CLICKS) {
    if (sel.startsWith('wait:')) {
      await page.waitForTimeout(Number(sel.slice(5)))
      continue
    }
    if (sel.startsWith('shot:')) {
      await page.screenshot({ path: `${OUT}/${sel.slice(5)}.png` })
      continue
    }
    const idx = await page.locator(sel).evaluateAll((els) => els.findIndex((e) => e.offsetParent !== null && !e.disabled))
    if (idx < 0) {
      console.log(`-- ${sel}: NOTHING visible and enabled to press (${await page.locator(sel).count()} in the page)`)
      continue
    }
    await page.locator(sel).nth(idx).click({ timeout: 4000 }).catch((e) => console.log(`   click failed: ${e.message.split('\n')[0]}`))
    await page.waitForTimeout(700)
    await list(`after ${sel}`)
    await page.screenshot({ path: `${OUT}/${String(k++).padStart(2, '0')}.png` })
  }
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`-- sideways ${over}; errors ${JSON.stringify([...new Set(errors)])}`)
  await browser.close()
})().catch((e) => {
  console.error(`probe crashed: ${e.message}`)
  process.exit(1)
})
