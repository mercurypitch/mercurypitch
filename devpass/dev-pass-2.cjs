// Second read-only pass over dev.mercurypitch.com: the checks run 1 got
// wrong on the script's side, plus the rest of Priority 1 a browser can see.
// As in run 1, every request that is not a GET or HEAD is aborted and listed
// (with its body, for the lesson answer), beacons are stubbed and service
// workers are blocked, so nothing is written anywhere. Nothing here asks
// mercurypitch.com for anything. The Mirror demo screen is dev-only code,
// so that one check runs against a local dev server (LOCAL).
// Usage: node dev-pass-2.cjs <outdir> [localBase]
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'https://dev.mercurypitch.com'
const OUT = process.argv[2]
const LOCAL = process.argv[3] || ''
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
fs.mkdirSync(OUT, { recursive: true })

const checks = []
const note = (s) => console.log(s)
const check = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); note(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`) }
const info = (name, detail) => { checks.push({ name, pass: null, detail }); note(`INFO ${name} :: ${detail}`) }
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
const text = async (loc) => clean(await loc.first().innerText({ timeout: 5000 }).catch(() => ''))
const LAST = /(\d+) of \1$/i
const FIRST = /^1 of (\d+)$/i

const STUBS = `(() => {
  const W = window
  W.__beacons = []
  try { navigator.sendBeacon = (u, d) => { W.__beacons.push(String(u)); return true } } catch (e) {}
})()`

async function covers(page, sel) {
  return page.evaluate((sel) => {
    const q = document.querySelector(sel)
    if (!q) return { found: false }
    const r = q.getBoundingClientRect(); const cs0 = getComputedStyle(q)
    if (r.width === 0 || cs0.display === 'none' || cs0.visibility === 'hidden') return { found: true, shown: false }
    const visible = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false } return true }
    const hit = (a) => a.width > 0 && a.height > 0 && a.left < r.right - 1 && a.right > r.left + 1 && a.top < r.bottom - 1 && a.bottom > r.top + 1
    const hits = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement
      if (!n.textContent.trim() || !el || q.contains(el) || el.closest('script,style,template,title,.tour-root,.tour')) continue
      if (!visible(el)) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const cr of rg.getClientRects()) if (hit(cr)) { hits.push(`text "${n.textContent.trim().slice(0, 30)}"`); break }
    }
    return { found: true, shown: true, rect: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)), right: Math.round(r.right), hits }
  }, sel)
}
async function anchorsTo(page, re) {
  return page.$$eval('a', (as, src) => {
    const rx = new RegExp(src)
    return as.filter((a) => rx.test(a.getAttribute('href') || '')).map((a) => {
      const vis = !!(a.offsetWidth || a.offsetHeight || a.getClientRects().length) && getComputedStyle(a).visibility !== 'hidden'
      const box = a.closest('nav,header,footer,section,aside,article,main,dialog,[role=dialog]')
      return { href: a.getAttribute('href'), text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), vis, where: box ? box.tagName.toLowerCase() + (box.id ? '#' + box.id : '') : 'body' }
    })
  }, re.source)
}
const inView = (page, sel) => page.evaluate((sel) => {
  const els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)
  const e = els[0]; if (!e) return null
  const r = e.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, ok: r.top >= 0 && r.bottom <= innerHeight, text: (e.textContent || '').trim().slice(0, 40) }
}, sel)

;(async () => {
  const blocked = new Map()
  const posts = []
  const errors = []
  const browser = await chromium.launch()
  const newPage = async (viewport, opts = {}, init = null) => {
    const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'UTC', ...opts })
    await ctx.route('**/*', (route) => {
      const req = route.request(); const u = new URL(req.url())
      if (u.hostname === 'mercurypitch.com' || u.hostname === 'www.mercurypitch.com') { blocked.set(`PRODUCTION ${req.method()} ${u.pathname}`, (blocked.get(`PRODUCTION ${req.method()} ${u.pathname}`) || 0) + 1); return route.abort() }
      if (req.method() === 'GET' || req.method() === 'HEAD') return route.continue()
      const k = `${req.method()} ${u.hostname}${u.pathname}`
      blocked.set(k, (blocked.get(k) || 0) + 1)
      if (/\/api\/mirror\/event$/.test(u.pathname)) posts.push({ at: Date.now(), body: req.postData() || '' })
      return route.abort()
    })
    await ctx.addInitScript(STUBS)
    if (init) await ctx.addInitScript(init.fn, init.arg)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror ${page.url().replace(BASE, '')}: ${e.message.slice(0, 160)}`))
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(`console ${page.url().replace(BASE, '')}: ${m.text().slice(0, 160)}`) })
    return { ctx, page }
  }
  let n = 0
  const shot = async (page, name, full = false) => { n += 1; const f = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f, fullPage: full, animations: 'disabled', timeout: 20000 }).catch(() => undefined); return f }
  const section = async (name, fn) => { note(`=== ${name}`); try { await fn() } catch (e) { check(`${name}: ran to the end`, false, e.message.split('\n')[0].slice(0, 300)) } }
  const skipTour = async (page) => {
    const card = page.locator('.tour-card[role="dialog"]')
    if (await card.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)) { await card.locator('.tour-skip').click().catch(() => undefined); await card.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined) }
  }

  // 1. Lesson 1 on a phone: the tour, the ? replaying it, the explorer, the lesson menu
  await section('lesson 1, phone', async () => {
    const { ctx, page } = await newPage(PHONE, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    await page.goto(BASE + '/learn/01', { timeout: 90000 })
    const card = page.locator('.tour-card[role="dialog"]')
    const shown = await card.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
    check('L1 phone: the welcome tour opens on a first visit', shown)
    if (shown) {
      let steps = 0, last = '', lit = null
      const kit = []
      for (let i = 0; i < 8 && (await card.isVisible().catch(() => false)); i++) {
        steps += 1; last = await text(card.locator('.tour-count'))
        kit.push(`${last}: X ${await card.locator('.tour-x').isVisible()}, Skip ${await card.locator('.tour-skip').isVisible()}, Back ${await card.locator('[data-tour-back]').isVisible()}${(await card.locator('[data-tour-back]').isDisabled().catch(() => false)) ? ' (off)' : ''}, next "${await text(card.locator('[data-tour-next]'))}"`)
        if (LAST.test(last)) lit = await page.evaluate(() => { const s = document.querySelector('.tour-spot')?.getBoundingClientRect(); const q = document.querySelector('.lm-tour')?.getBoundingClientRect(); return !!s && !!q && s.left <= q.left + 2 && s.right >= q.right - 2 && s.top <= q.top + 2 && s.bottom >= q.bottom - 2 })
        await card.locator('[data-tour-next]').click(); await page.waitForTimeout(800)
      }
      check('L1 phone: five steps, each with X and Skip tour, Back from step 2', steps === 5, `${steps} steps | ${kit.join(' | ')}`)
      check("L1 phone: the last step's spotlight takes in the ?", lit === true, String(lit))
      await page.waitForTimeout(600)
      await page.locator('.lm-tour').click()
      const again = await card.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
      const c1 = again ? await text(card.locator('.tour-count')) : ''
      check('L1 phone: the ? plays the tour again from step 1', again && FIRST.test(c1), c1)
      await page.keyboard.press('Escape'); await page.waitForTimeout(700)
      check('L1 phone: Escape closes the replayed tour', !(await card.isVisible().catch(() => false)))
    }
    // the explorer: no team fields; a tapped lesson scrolls its card's button into view
    const ex = page.locator('#explorer')
    await ex.scrollIntoViewIfNeeded(); await page.waitForTimeout(800)
    const exText = clean(await ex.innerText().catch(() => ''))
    check('L1 phone: the explorer shows no team fields', exText.length > 200 && !/In production|signature|\bsig\b|variant/i.test(exText), `${exText.length} chars` + ((exText.match(/.{0,30}(In production|signature|\bsig\b|variant).{0,30}/i) || [''])[0] ? ` :: "${(exText.match(/.{0,30}(In production|signature|\bsig\b|variant).{0,30}/i) || [''])[0]}"` : ''))
    const row = page.locator('#explorer .ex-row[data-n="2"] button.it')
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(1600)
      const v = await inView(page, '#explorer .ex-detail .ex-card .ex-actions .btn.primary')
      check("L1 phone: tapping Lesson 2 in the explorer brings its card's button into view", !!v && v.ok, v ? `${v.text} at ${v.top}-${v.bottom} of ${v.vh}` : 'no card button')
      await shot(page, 'L1-explorer-tapped-2')
    } else info('L1 phone: explorer rows', 'no row for Lesson 2 (layout not narrow?)')
    // the lesson menu
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
    await page.locator('.lm-btn').click(); await page.waitForTimeout(700)
    const menu = page.locator('.lmenu')
    const open = await menu.isVisible().catch(() => false)
    const links = open ? await menu.locator('a[href*="/learn/"]').evaluateAll((as) => as.map((a) => { const r = a.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(a).lineHeight) || 20; return `${a.getAttribute('href')}:${Math.round(r.height / lh)}` })) : []
    check('L1 phone: the lesson menu opens and lists the lessons', open && links.length >= 2, links.join(' '))
    await shot(page, 'L1-lesson-menu')
    await page.keyboard.press('Escape'); await page.waitForTimeout(400)
    await ctx.close()
  })

  // 2. The ? at every width: the right end of the masthead, covering nothing
  await section('the ? at every width', async () => {
    const { ctx, page } = await newPage(DESKTOP)
    await page.goto(BASE + '/learn/01', { timeout: 90000 })
    await skipTour(page)
    const rows = []
    let allOk = true
    for (const w of [390, 600, 820, 821, 1020, 1021, 1100, 1440]) {
      await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(700)
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200)
      const q = await covers(page, '.lm-tour')
      const m = await page.evaluate(() => { const e = document.querySelector('.mast-in') || document.querySelector('.mast'); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return Math.round(r.right - parseFloat(cs.paddingRight || '0')) })
      const logo = await page.locator('.mast .brand').isVisible().catch(() => false)
      const ok = q.shown && q.hits.length === 0 && m - q.right <= 24 && (w > 600 || Math.min(q.rect[2], q.rect[3]) >= 44)
      allOk = allOk && ok
      rows.push(`${w}: ${q.shown ? `${q.rect[2]}x${q.rect[3]} at x${q.rect[0]}, ${m - q.right}px from the end${q.hits.length ? ', covers ' + q.hits.join('; ') : ''}` : 'not shown'}, logo ${logo ? 'shown' : 'hidden'}${ok ? '' : ' <- FAIL'}`)
      if (w === 820 || w === 1020 || w === 1440) await shot(page, `L1-mast-${w}`)
    }
    check('L1: the ? sits at the right end of the masthead and covers nothing, at eight widths', allOk, rows.join(' | '))
    await ctx.close()
  })

  // 3. The quick check: what an answer tries to send, under each consent case
  await section('quick check and consent', async () => {
    const cases = [
      ['Europe/Berlin', null, 0],
      ['Europe/London', null, 0],
      ['UTC', null, 0],
      ['America/New_York', null, 2],
      ['America/New_York', 'denied', 0],
      ['Europe/Berlin', 'granted', 1],
    ]
    for (const [tz, status, want] of cases) {
      const init = status === null ? null : { fn: (s) => { try { localStorage.setItem('mp.consent.v1', JSON.stringify({ status: s, implicit: false, version: 1, at: Date.now() })) } catch (e) {} }, arg: status }
      const { ctx, page } = await newPage(DESKTOP, { timezoneId: tz }, init)
      await page.goto(BASE + '/learn/01', { timeout: 90000 })
      await skipTour(page)
      const before = posts.length
      const opt = page.locator('#qs .q button.opt').first()
      await opt.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
      const dialogsBefore = await page.locator('[role="dialog"]:visible, [role="alert"]:visible').count()
      await opt.click(); await page.waitForTimeout(3000)
      const mine = posts.slice(before).map((p) => { try { return JSON.parse(p.body) } catch (e) { return { raw: p.body.slice(0, 120) } } }).filter((b) => b.event === 'lesson_answer')
      const dialogsAfter = await page.locator('[role="dialog"]:visible, [role="alert"]:visible').count()
      const fb = await text(page.locator('#qs .q .fb').first())
      const label = `${tz}, ${status === null ? 'never asked' : status}`
      if (want === 0) check(`Quick check (${label}): the answer is not sent`, mine.length === 0, mine.length ? JSON.stringify(mine) : `nothing sent; reason shown: "${fb.slice(0, 60)}"`)
      else check(`Quick check (${label}): one anonymous answer, consent ${want}`, mine.length === 1 && mine[0].metrics && mine[0].metrics.consent === want && mine[0].clientId === 'lesson-anonymous', JSON.stringify(mine))
      if (tz === 'America/New_York' && status === null) {
        check('Quick check: nothing new on screen but the answer and its reason', dialogsAfter === dialogsBefore && fb.length > 0, `dialogs ${dialogsBefore}->${dialogsAfter}, reason "${fb.slice(0, 80)}"`)
        await shot(page, 'L1-quick-check-answered')
      }
      await ctx.close()
    }
  })

  // 4. Lesson 2 on a desktop: step 5, the film, captions, trail, links, share card
  await section('lesson 2, desktop', async () => {
    const { ctx, page } = await newPage(DESKTOP, { reducedMotion: 'reduce' })
    await page.goto(BASE + '/learn/02', { timeout: 90000 })
    await skipTour(page)
    await page.goto(BASE + '/learn/02#step-5', { timeout: 90000 }); await page.reload({ timeout: 90000 })
    const now = await page.locator('#stepNow').textContent({ timeout: 10000 }).catch(() => '')
    const stage = page.locator('#toyNames')
    const rare = stage.locator('[data-rare]')
    await rare.waitFor({ state: 'visible', timeout: 10000 })
    const before = await rare.isDisabled()
    const dim = await rare.evaluate((e) => getComputedStyle(e).opacity)
    const why = await text(stage.locator('[data-names-locked]'))
    await shot(page, 'L2-step5-locked')
    await page.locator('#predictE [data-choice="white"]').click(); await page.waitForTimeout(800)
    const after = await rare.isDisabled()
    const lit = await rare.evaluate((e) => getComputedStyle(e).opacity)
    const next = await text(stage.locator('[data-names-open]'))
    await rare.click(); await page.waitForTimeout(500)
    const pressed = await rare.getAttribute('aria-pressed')
    check('L2 step 5: the rare-ones switch looks locked before the predict and works after it', now === '5' && before === true && dim === '0.42' && after === false && lit === '1' && pressed === 'true', `step ${now}; before: off ${before}, opacity ${dim}, "${why}"; after: off ${after}, opacity ${lit}, "${next}", pressed ${pressed}`)
    await shot(page, 'L2-step5-unlocked')
    // the film and its captions
    await page.locator('#watch').scrollIntoViewIfNeeded(); await page.locator('#bigPlay').click().catch(() => undefined); await page.waitForTimeout(3500)
    const v = await page.evaluate(async () => {
      const el = document.querySelector('#watch video, video'); if (!el) return null
      const tr = el.querySelector('track'); let cues = ''
      if (tr) { try { cues = await (await fetch(tr.src)).text() } catch (e) { cues = '' } }
      return { src: el.currentSrc || el.src || [...el.querySelectorAll('source')].map((s) => s.src).join(' '), track: tr && tr.src.replace(location.origin, ''), merc: (cues.match(/MERC/g) || []).length, tavi: (cues.match(/TAVI/g) || []).length, colour: /(blue|orange) Merc/i.test(cues), cueCount: (cues.match(/-->/g) || []).length }
    })
    check('L2 desktop: the film asks for the 1080p file', !!v && /\/learn\/02\/v1\/lesson-02-1080p\.mp4$/.test(v.src), v ? v.src : 'no video')
    check('L2: captions load, name MERC and TAVI, and never "blue/orange Merc"', !!v && v.cueCount > 20 && v.merc > 0 && v.tavi > 0 && !v.colour, v ? `${v.track}: ${v.cueCount} cues, MERC ${v.merc}, TAVI ${v.tavi}` : '')
    // the trail and the foot
    const crumbs = await page.$$eval('nav', (ns) => ns.map((x) => ({ label: x.getAttribute('aria-label') || '', html: [...x.querySelectorAll('a,[aria-current]')].map((a) => `${a.getAttribute('href') || ''} "${(a.textContent || '').trim()}"`).join(' / ') })))
    const crumb = crumbs.find((c) => /bread|trail/i.test(c.label) || /\/learn\/ "Find Your Pitch"/.test(c.html))
    check('L2: the trail reads MercuryPitch > Find Your Pitch > the lesson', !!crumb && /^\/ "MercuryPitch" \/ \/learn\/ "Find Your Pitch"/.test(crumb.html) && /Twelve|twelve/.test(crumb.html), crumb ? crumb.html : '')
    const l = (await anchorsTo(page, /\/learn\/0[13]\/?$/)).filter((a) => a.vis)
    const l3 = l.find((a) => /03\/?$/.test(a.href))
    const r3 = l3 ? await ctx.request.get(BASE + '/learn/03', { maxRedirects: 0 }).catch(() => null) : null
    check('L2: links Lesson 1, and on dev Lesson 3, which answers 200', l.some((a) => /01\/?$/.test(a.href)) && !!l3 && !!r3 && r3.status() === 200, l.map((a) => `${a.href} [${a.text}] in ${a.where}`).join(' | ').slice(0, 300) + (r3 ? ` | /learn/03 ${r3.status()}` : ''))
    // share cards, fetched from dev: the tags name production's address, which serves them from the tag on
    for (const p of ['/learn/01', '/learn/02']) {
      await page.goto(BASE + p, { timeout: 90000 })
      const og = await page.$$eval('meta[property="og:image"],meta[name="twitter:image"]', (ms) => ms.map((m) => m.getAttribute('content')))
      const img = og.find((x) => /^https?:/.test(x || ''))
      const onDev = img ? img.replace(/^https?:\/\/(www\.)?mercurypitch\.com/, BASE) : ''
      const ir = onDev.startsWith(BASE) ? await ctx.request.get(onDev).catch(() => null) : null
      const size = ir ? (await ir.body()).length : 0
      check(`${p}: the share card image is in the build (fetched from dev)`, !!ir && ir.status() === 200 && /image\//.test(ir.headers()['content-type'] || '') && size > 10000, `${og.join(' | ')} -> dev ${ir ? ir.status() + ' ' + ir.headers()['content-type'] + ' ' + size + ' B' : 'none'}`)
    }
    await ctx.close()
    // the practice link in a fresh browser: the room, with no First Light over it
    const fresh = await newPage(PHONE, { isMobile: true, hasTouch: true })
    await fresh.page.goto(BASE + '/ear-lab?lesson=02', { timeout: 90000 })
    await fresh.page.waitForTimeout(8000)
    const body = clean(await fresh.page.locator('body').innerText().catch(() => ''))
    const fl = await fresh.page.locator('[data-beat]:visible').count()
    check('Ear Lab from Lesson 2, first visit: the room, with no First Light over it', fl === 0 && !/WELCOME TO MERCURYPITCH|Your voice, made visible/i.test(body), `beats ${fl}; ${body.slice(0, 120)}`)
    await shot(fresh.page, 'ear-lab-from-L2')
    await fresh.ctx.close()
  })

  // 5. Home's Lessons link follows the visitor's progress
  await section("home's lessons link", async () => {
    for (const [done, want] of [['[1]', '/learn/02'], ['[1,2]', '/learn/']]) {
      const { ctx, page } = await newPage(PHONE, { isMobile: true, hasTouch: true }, { fn: (d) => { try { localStorage.setItem('fyp-done', d) } catch (e) {} }, arg: done })
      await page.goto(BASE + '/', { timeout: 90000 })
      const href = await page.getByTestId('home-lessons').first().getAttribute('href', { timeout: 20000 }).catch(() => null)
      check(`Home's Lessons link with Lessons ${done} done opens ${want}`, href === want, String(href))
      await ctx.close()
    }
  })

  // 6. Karaoke Night's page, with scripts on and off
  await section('karaoke-app', async () => {
    const off = await newPage(DESKTOP, { javaScriptEnabled: false })
    await off.page.goto(BASE + '/karaoke-app', { timeout: 60000 })
    const qs = await off.page.$$eval('.entry-prelude__faq h2', (e) => e.map((x) => x.textContent.trim()))
    const h1 = await text(off.page.locator('h1'))
    check('/karaoke-app served: Karaoke Night, five questions with their answers', /karaoke/i.test(h1) && qs.length === 5, `h1 "${h1}" | ${qs.join(' | ')}`)
    await off.ctx.close()
    const on = await newPage(DESKTOP)
    await on.page.goto(BASE + '/karaoke-app', { timeout: 90000 })
    await on.page.waitForTimeout(8000)
    const url = on.page.url().replace(BASE, '')
    const vis = await on.page.locator('.entry-prelude__faq h2').evaluateAll((e) => e.filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden').length)
    const body = clean(await on.page.locator('body').innerText().catch(() => ''))
    info('/karaoke-app with scripts on', `at ${url}; FAQ headings laid out ${vis}; text: ${body.slice(0, 160)}`)
    await shot(on.page, 'karaoke-app')
    await on.ctx.close()
  })

  // 7. The 404 scene holds still with reduced motion
  await section('404 reduced motion', async () => {
    for (const rm of ['reduce', 'no-preference']) {
      const { ctx, page } = await newPage(DESKTOP, { reducedMotion: rm })
      const r = await page.goto(BASE + '/no-such-page', { timeout: 60000 })
      await page.waitForTimeout(3500)
      const a = await page.screenshot({ timeout: 20000 })
      await page.waitForTimeout(1500)
      const b = await page.screenshot({ timeout: 20000 })
      if (rm === 'reduce') { check('404 with reduced motion: the scene holds still', r.status() === 404 && a.equals(b), `${r.status()}, two frames 1.5 s apart ${a.equals(b) ? 'identical' : 'differ'}`); fs.writeFileSync(path.join(OUT, '404-reduce.png'), a) }
      else { info('404 with motion: two frames 1.5 s apart', a.equals(b) ? 'identical' : 'differ (it moves)'); fs.writeFileSync(path.join(OUT, '404-motion-a.png'), a); fs.writeFileSync(path.join(OUT, '404-motion-b.png'), b) }
      await ctx.close()
    }
  })

  // 8. The Mirror's bass-baritone demo: dev-only code, so a local dev server
  if (LOCAL) await section('mirror demo (local dev server)', async () => {
    const { ctx, page } = await newPage(DESKTOP, { ignoreHTTPSErrors: true })
    await page.goto(LOCAL + '/mirror?demo=bass-baritone', { timeout: 120000 })
    await page.getByText('Bass-baritone range', { exact: false }).first().waitFor({ timeout: 60000 }).catch(() => undefined)
    await page.waitForTimeout(2500)
    const body = clean(await page.locator('body').innerText().catch(() => ''))
    check('/mirror?demo=bass-baritone (local dev server): "Bass-baritone range", like Paul Robeson', /Bass-baritone range/i.test(body) && /Paul Robeson/.test(body), (body.match(/.{0,60}Bass-baritone.{0,80}/i) || [''])[0])
    await shot(page, 'mirror-bass-baritone-local')
    await ctx.close()
  })

  await browser.close()
  info('requests aborted (not GET/HEAD, or to production)', [...blocked].map(([k, c]) => `${k} x${c}`).join(' | ') || 'none')
  info('page errors', errors.slice(0, 8).join(' | ') || 'none')
  const pass = checks.filter((c) => c.pass === true).length, fail = checks.filter((c) => c.pass === false).length
  note(`checks: ${pass} pass, ${fail} fail, ${checks.filter((c) => c.pass === null).length} info`)
  fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(checks, null, 2))
})()
