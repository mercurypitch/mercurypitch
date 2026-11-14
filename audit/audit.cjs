// Audit of one lesson page on dev (never production): node audit.cjs <base> <lesson> <size> <out>
//   size: p390 (phone, takes the listening path) | d1440 (desktop, takes the singing path to its briefing)
// Writes screenshots and report.json into <out>. Exits 0 when it ran; the report holds the findings.
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const fs = require('fs')

const [BASE, N, TAG, OUT] = process.argv.slice(2)
const host = new URL(BASE).host
const ALLOWED =
  /^(dev\.mercurypitch\.com|[a-z0-9-]+-mercurypitch-preview\.[a-z0-9-]+\.workers\.dev|127\.0\.0\.1(:\d+)?|localhost(:\d+)?)$/
if (!ALLOWED.test(host)) {
  console.error(`refusing to audit ${host}: dev, a preview or a local build only`)
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
  // a returning visitor: the first visit's tour is its own spec, and would cover the page here
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('fyp-tour', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  const report = {
    lesson: N, size: TAG, url: `${BASE}/learn/${N}`, status: null, title: null,
    errors: [], badResponses: [], failedRequests: [], production: [], sideways: [], notes: [], shots: [],
  }
  page.on('pageerror', (e) => report.errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(`console: ${m.text()}`.slice(0, 300))
  })
  page.on('requestfailed', (r) => report.failedRequests.push(`${r.failure()?.errorText} ${r.url()}`.slice(0, 200)))
  page.on('response', (r) => {
    if (r.status() >= 400) report.badResponses.push(`${r.status()} ${r.url()}`.slice(0, 200))
  })
  page.on('request', (r) => {
    const h = new URL(r.url()).host
    if (/(^|\.)mercurypitch\.com$/.test(h) && h !== 'dev.mercurypitch.com' && !/^(dev-|preview)/.test(h))
      report.production.push(`${r.method()} ${r.url()}`.slice(0, 160))
  })

  let k = 0
  const shot = async (name) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (over > 0) report.sideways.push(`${name}: ${over}px`)
    const file = `${String(k++).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: `${OUT}/${file}` })
    report.shots.push(file)
  }
  const note = (s) => report.notes.push(s)
  const tryStep = async (name, fn) => {
    try {
      await fn()
    } catch (e) {
      note(`${name}: FAILED ${String(e.message).split('\n')[0].slice(0, 200)}`)
    }
  }
  const visible = (sel) =>
    page.locator(sel).evaluateAll((els) =>
      els.filter((e) => e.offsetParent !== null && !e.disabled).length,
    )
  const clickFirst = async (sel) => {
    const idx = await page.locator(sel).evaluateAll((els) =>
      els.findIndex((e) => e.offsetParent !== null && !e.disabled),
    )
    if (idx < 0) return false
    await page.locator(sel).nth(idx).click({ timeout: 4000 })
    return true
  }

  const res = await page.goto(report.url, { waitUntil: 'load', timeout: 45000 })
  report.status = res ? res.status() : null
  await page.waitForTimeout(1500)
  report.title = await page.title()
  await shot('top')

  await tryStep('gate', async () => {
    if (await clickFirst('#gateBtn')) note('gate: sound on')
    else note('gate: no gate button showing')
    await page.waitForTimeout(400)
  })

  // the cold open: a free play first, then the choice, then an answering play
  await tryStep('cold open', async () => {
    const hero = '.hero'
    const before = await visible(`${hero} button:not(#gateBtn):not([data-choice])`)
    note(`cold open: ${before} plays open before the choice`)
    if (await clickFirst(`${hero} button:not(#gateBtn):not([data-choice]):not([data-motion]):not([data-sound])`)) {
      await page.waitForTimeout(1800)
      await shot('hero-free-play')
    }
    const choices = await page.locator('#predict [data-choice], .hero [data-choice]').count()
    if (choices === 0) note('cold open: NO predict choices found')
    else {
      await clickFirst('#predict [data-choice], .hero [data-choice]')
      await page.waitForTimeout(600)
      const after = await visible(`${hero} button:not(#gateBtn):not([data-choice])`)
      note(`cold open: ${choices} choices; ${after} plays open after the choice`)
      await shot('hero-chosen')
    }
  })

  // every section as a visitor scrolls it
  await tryStep('sections', async () => {
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main section, body > section')).map((s, i) => {
        if (!s.id) s.setAttribute('data-audit', String(i))
        return { sel: s.id ? `#${s.id}` : `[data-audit="${i}"]`, name: s.id || s.className.split(' ')[0] || `s${i}`, h: Math.round(s.getBoundingClientRect().height) }
      }),
    )
    note(`sections: ${ids.map((s) => `${s.name}(${s.h})`).join(' ')}`)
    for (const s of ids) {
      if (s.h === 0) continue
      const steps = Math.min(3, Math.max(1, Math.ceil(s.h / H)))
      for (let i = 0; i < steps; i++) {
        await page.evaluate(({ sel, dy }) => {
          const e = document.querySelector(sel)
          window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70 + dy)
        }, { sel: s.sel, dy: i * (H - 120) })
        await page.waitForTimeout(450)
        await shot(`sec-${s.name}-${i + 1}`)
      }
    }
  })

  // each step on the deck, with its first text play sounding
  await tryStep('steps', async () => {
    const count = await page.evaluate(() => new Set(Array.from(document.querySelectorAll('#lesson [data-step]')).map((e) => e.dataset.step)).size)
    note(`steps: ${count}`)
    for (let n = 1; n <= count; n++) {
      await page.evaluate((n) => { location.hash = `#step-${n}` }, n)
      await page.waitForTimeout(900)
      const now = await page.locator('#stepNow').textContent().catch(() => '?')
      // a step's own predict holds its plays until a choice
      if (await clickFirst(`#lesson [data-step="${n}"] [data-choice], #lesson [data-step="${n}"] .choice`).catch(() => false)) {
        note(`step ${n}: its own predict answered`)
        await page.waitForTimeout(400)
      }
      const played = await clickFirst(`#lesson [data-step="${n}"] [data-step-play], #lesson [data-step="${n}"] [data-play]`).catch(() => false)
      await page.waitForTimeout(1600)
      const after = await page.locator('#stepNow').textContent().catch(() => '?')
      note(`step ${n}: deck says ${now}${played ? `, text play pressed (deck then ${after})` : ', no text play open'}`)
      await shot(`step-${n}`)
    }
  })

  // the quick check: an answer to each question shows its feedback
  await tryStep('quick check', async () => {
    await page.locator('#check').scrollIntoViewIfNeeded()
    const qs = await page.locator('#check .q').count()
    let answered = 0
    for (let i = 0; i < qs; i++) {
      const opt = page.locator('#check .q').nth(i).locator('button.opt:not([disabled])').first()
      if ((await opt.count()) > 0) {
        await opt.click({ timeout: 3000 })
        answered++
        await page.waitForTimeout(250)
      }
    }
    const fb = await page.locator('#check .fb').count()
    note(`quick check: ${qs} questions, ${answered} answered, ${fb} feedback lines`)
    await page.evaluate(() => document.querySelector('#check').scrollIntoView())
    await page.waitForTimeout(300)
    await shot('check-answered')
  })

  // Sing it: the phone listens, the desktop goes as far as the briefing (no microphone asked)
  await tryStep('sing', async () => {
    await page.evaluate(() => {
      const e = document.querySelector('#sing')
      window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70)
    })
    await page.waitForTimeout(500)
    const status = () => page.locator('#singStatus').textContent().then((t) => (t || '').trim()).catch(() => '(no #singStatus)')
    note(`sing: opens on "${await status()}"`)
    if (TAG === 'p390') {
      await clickFirst('#sing [data-comfort="listen"]')
      await page.waitForTimeout(500)
      // some listening paths ask the voice first, when none is stored
      if (await clickFirst('#sing [data-voice="lower"]')) await page.waitForTimeout(500)
      // the listening path's own play: whatever Sing it offers that is neither a voice nor the comfort choice
      const played = await clickFirst('#sing button:not([data-voice]):not([data-comfort])')
      await page.waitForTimeout(2500)
      note(`sing: listening path "${await status()}"${played ? ', its play pressed' : ', NO play found'}`)
      await shot('sing-listen')
    } else {
      await clickFirst('#sing [data-comfort="sing"]')
      await page.waitForTimeout(400)
      if (await clickFirst('#sing [data-voice="lower"]')) await page.waitForTimeout(400)
      note(`sing: after the voice "${await status()}"`)
      await shot('sing-voice')
      if (await clickFirst('#sing [data-phones="on"]')) await page.waitForTimeout(400)
      note(`sing: at the briefing "${await status()}"; Start showing: ${await visible('#sing [data-sing="start"]')}`)
      await shot('sing-brief')
    }
  })

  // the Wrap after Sing it, and where the page leads next
  await tryStep('wrap', async () => {
    await page.evaluate(() => {
      const e = document.querySelector('#wrap')
      window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70)
    })
    await page.waitForTimeout(500)
    await shot('wrap-after-sing')
    const next = await page.evaluate(() => {
      const c = document.querySelector('[data-next-card]')
      if (!c) return 'no next card'
      const a = c.querySelector('a[href]') || (c.matches('a[href]') ? c : null)
      return `${c.hidden ? 'hidden' : 'shown'}: "${c.textContent.trim().replace(/\s+/g, ' ').slice(0, 90)}" -> ${a ? a.getAttribute('href') : 'no link'}`
    })
    note(`next card: ${next}`)
    const eyebrow = await page.locator('#practiseCard .eyebrow, #wrap .practise .eyebrow').first().textContent().catch(() => null)
    note(`practice card eyebrow: ${eyebrow ? eyebrow.trim() : '(none found)'}`)
  })

  report.errors = [...new Set(report.errors)]
  report.badResponses = [...new Set(report.badResponses)]
  report.failedRequests = [...new Set(report.failedRequests)]
  report.production = [...new Set(report.production)]
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1))
  console.log(`== L${N} ${TAG}: ${report.status} "${report.title}" shots ${report.shots.length} errors ${report.errors.length} bad ${report.badResponses.length} failed ${report.failedRequests.length} prod ${report.production.length} sideways ${report.sideways.length}`)
  for (const n of report.notes) console.log(`   ${n}`)
  for (const e of [...report.errors, ...report.badResponses, ...report.failedRequests, ...report.production, ...report.sideways]) console.log(`   ! ${e}`)
  await browser.close()
})().catch((e) => {
  console.error(`audit crashed: ${e.message}`)
  process.exit(1)
})
