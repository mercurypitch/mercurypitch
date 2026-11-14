// A browser look at the step-text-play fix on a local build: node look.cjs <port> <out>
// Desktop: with the deck on step K and step K+1's text play low on the screen, pressing it
// shows step K+1 (heading, counter, the toy's own state). Phone: with the stage scrolled away
// above, pressing a text play brings the stage back into view.
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const fs = require('fs')
const [PORT, OUT, ONLY] = process.argv.slice(2) // ONLY: one lesson's cases
fs.mkdirSync(OUT, { recursive: true })
// a port serves a local build's .html files; a full address (dev or a preview, never production) serves clean paths
const REMOTE = /^https?:/.test(PORT)
const BASE = REMOTE ? PORT.replace(/\/$/, '') : `http://127.0.0.1:${PORT}`
if (REMOTE && !/^(dev\.mercurypitch\.com|[a-z0-9-]+-mercurypitch-preview\.[a-z0-9-]+\.workers\.dev)$/.test(new URL(BASE).host)) {
  console.error('refusing: dev or a preview only')
  process.exit(2)
}

// lesson, the step the deck stands on, the play of the next step
const WIDE = [
  [20, 1, 'both'],
  [20, 3, 'touch'],
  // Step 3's plays wait for Step 2's own predict to be heard out
  [24, 2, 'mi-pure', { choice: '#predict2 [data-choice]', plays: '#predict2 [data-play], [data-step="2"] [data-play]', shown: '[data-reveal2]' }],
  [24, 3, 'wave'],
  [25, 2, 'melodic'],
  // Steps 2 and 3's text waits for the cold open's reveal
  [27, 2, 'v7-home', { plays: '.hero-plays [data-play]', shown: '[data-held="3"]' }],
  // the first play of a step's text is the one a reader meets while the deck is a step behind
  [27, 1, 'sevenths', { plays: '.hero-plays [data-play]', shown: '[data-held="2"]' }],
  [27, 2, 'tritone', { plays: '.hero-plays [data-play]', shown: '[data-held="3"]' }],
].filter((c) => !ONLY || String(c[0]) === ONLY)
// lesson, step, play
const PHONE = [
  [20, 2, 'on-c'],
  [24, 3, 'mi-pure'],
  [25, 3, 'melodic'],
  [27, 3, 'v7-home'],
].filter((c) => !ONLY || String(c[0]) === ONLY)

async function open(browser, n, w, h, dsf) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('fyp-tour', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto(`${BASE}/learn/${n}${REMOTE ? '' : '.html'}`)
  await page.waitForTimeout(1000)
  await page.locator('#gateBtn').click({ timeout: 1500 }).catch(() => {})
  // the cold open's choice, and any step's own predict, open the held plays
  await page.locator('.hero [data-choice]').first().click({ timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(300)
  for (const sel of ['#predict2 .choice', '#predict4 [data-choice]'])
    await page.locator(sel).first().click({ timeout: 800 }).catch(() => {})
  await page.waitForTimeout(300)
  return { ctx, page, errors }
}

// Presses each of a predict's plays and waits for it to end, until `shown` is no longer hidden:
// a held play in a step's text opens only at the reveal, once every answering play is heard.
async function hearAll(page, plays, shown) {
  const open = () =>
    page.evaluate((sel) => {
      const e = document.querySelector(sel)
      return !!e && e.offsetParent !== null
    }, shown)
  const count = await page.locator(plays).count()
  for (let i = 0; i < count && !(await open()); i++) {
    const b = page.locator(plays).nth(i)
    if (!(await b.isVisible()) || (await b.isDisabled())) continue
    await b.click({ timeout: 3000 }).catch(() => {})
    // heard to its end: the play lights (`is-on`) and goes dark again, or the reveal shows
    let wasLit = false
    for (let t = 0; t < 60; t++) {
      await page.waitForTimeout(250)
      if (await open()) break
      const lit = await b.evaluate((e) => e.classList.contains('is-on'))
      wasLit = wasLit || lit
      if ((wasLit && !lit) || (!wasLit && t > 8)) break
    }
    await page.waitForTimeout(300)
  }
  return open()
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  for (const [n, k, play, reveal] of WIDE) {
    const { ctx, page, errors } = await open(browser, n, 1440, 900, 1)
    if (reveal) {
      if (reveal.choice) await page.locator(reveal.choice).first().click({ timeout: 2000 }).catch(() => {})
      const opened = await hearAll(page, reveal.plays, reveal.shown)
      console.log(`    L${n} ${play}: held text ${opened ? 'opened' : 'DID NOT open'} after its plays`)
    }
    await page.evaluate((k) => { location.hash = `#step-${k}` }, k)
    await page.waitForTimeout(900)
    // the next step's play low on the screen, the deck's band still on step k
    const info = await page.evaluate((play) => {
      const b = document.querySelector(`[data-step-play="${play}"]`)
      if (!b) return null
      const y = b.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, y - window.innerHeight * 0.86)
      return { disabled: b.disabled, step: b.closest('[data-step]')?.dataset.step }
    }, play)
    await page.waitForTimeout(700)
    const before = (await page.locator('#stepNow').textContent()).trim()
    const inView = await page.evaluate((play) => {
      const r = document.querySelector(`[data-step-play="${play}"]`).getBoundingClientRect()
      return r.top >= 0 && r.bottom <= window.innerHeight
    }, play)
    await page.locator(`[data-step-play="${play}"]`).click({ timeout: 3000 }).catch((e) => errors.push(`click: ${e.message.split('\n')[0]}`))
    await page.waitForTimeout(1200)
    const after = (await page.locator('#stepNow').textContent()).trim()
    await page.screenshot({ path: `${OUT}/d1440-L${n}-${play}.png` })
    const ok = before === String(k) && after === String(info?.step) && inView
    console.log(`${ok ? 'ok ' : 'BAD'} wide L${n} play ${play} (step ${info?.step}, disabled ${info?.disabled}): deck ${before} -> ${after}; button in view ${inView}; errors ${JSON.stringify(errors)}`)
    await ctx.close()
  }
  for (const [n, k, play] of PHONE) {
    const { ctx, page, errors } = await open(browser, n, 390, 844, 2)
    await page.evaluate((k) => { location.hash = `#step-${k}` }, k)
    await page.waitForTimeout(900)
    // the play at the middle of the screen: is the stage's head above the screen then?
    const pos = await page.evaluate((play) => {
      const b = document.querySelector(`[data-step-play="${play}"]`)
      if (!b) return null
      const y = b.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, y - window.innerHeight * 0.5)
      return true
    }, play)
    await page.waitForTimeout(700)
    const stageTop = () =>
      page.evaluate(() => {
        const s = document.querySelector('#stepsStage')
        return s ? Math.round(s.getBoundingClientRect().top) : null
      })
    const before = await stageTop()
    const shown = await page.evaluate((play) => {
      const b = document.querySelector(`[data-step-play="${play}"]`)
      return b.offsetParent !== null && !b.disabled
    }, play)
    await page.locator(`[data-step-play="${play}"]`).click({ timeout: 3000 }).catch((e) => errors.push(`click: ${e.message.split('\n')[0]}`))
    await page.waitForTimeout(1300)
    const after = await stageTop()
    const now = (await page.locator('#stepNow').textContent()).trim()
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await page.screenshot({ path: `${OUT}/p390-L${n}-${play}.png` })
    console.log(`phone L${n} step ${k} play ${play} (found ${pos}, pressable ${shown}): stage top ${before} -> ${after}; deck ${now}; sideways ${over}; errors ${JSON.stringify(errors)}`)
    await ctx.close()
  }
  await browser.close()
})().catch((e) => {
  console.error(`look crashed: ${e.message}`)
  process.exit(1)
})
