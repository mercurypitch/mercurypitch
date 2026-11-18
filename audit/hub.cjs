// The lessons hub on dev (never production): node hub.cjs <base> <out>
// Loads /learn/ at phone and desktop sizes, lists every lesson entry with its link and state,
// fetches each lesson link (status only), and screenshots the whole page.
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const fs = require('fs')

const [BASE, OUT] = process.argv.slice(2)
const host = new URL(BASE).host
const ALLOWED =
  /^(dev\.mercurypitch\.com|[a-z0-9-]+-mercurypitch-preview\.[a-z0-9-]+\.workers\.dev|127\.0\.0\.1(:\d+)?|localhost(:\d+)?)$/
if (!ALLOWED.test(host)) {
  console.error(`refusing to open ${host}: dev, a preview or a local build only`)
  process.exit(2)
}
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  for (const [tag, w, h, dsf] of [['p390', 390, 844, 2], ['d1440', 1440, 900, 1]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf })
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('fyp-tour', '1')
      } catch {}
    })
    const page = await ctx.newPage()
    const errors = []
    const bad = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`.slice(0, 200))
    })
    page.on('response', (r) => {
      if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`.slice(0, 160))
    })
    const res = await page.goto(`${BASE}/learn/`, { waitUntil: 'load', timeout: 45000 })
    await page.waitForTimeout(1500)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const links = await page.evaluate(() => {
      const seen = new Map()
      for (const a of document.querySelectorAll('a[href]')) {
        const m = a.getAttribute('href').match(/\/learn\/(\d+)(?:[/?#]|$)/)
        if (!m) continue
        const n = Number(m[1])
        if (!seen.has(n)) seen.set(n, [a.getAttribute('href'), a.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)])
      }
      return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([n, [href, text]]) => [n, text, href])
    })
    console.log(`== hub ${tag}: ${res.status()} "${await page.title()}" lessons linked ${links.length}; sideways ${over}; errors ${errors.length}; bad ${bad.length}`)
    for (const e of [...new Set([...errors, ...bad])]) console.log(`   ! ${e}`)
    if (tag === 'd1440') {
      for (const [n, text, href] of links) {
        const r = await ctx.request.get(new URL(href, `${BASE}/learn/`).href, { maxRedirects: 3 })
        console.log(`   ${String(n).padStart(2)} ${r.status()} ${href} ${text}`)
      }
    }
    await page.screenshot({ path: `${OUT}/hub-${tag}.png`, fullPage: true })
    await ctx.close()
  }
  await browser.close()
})().catch((e) => {
  console.error(`hub check crashed: ${e.message}`)
  process.exit(1)
})
