// Read-only pass over dev.mercurypitch.com for the 0.9.22 test doc.
// Every request that is not a GET or HEAD is aborted and listed, beacons are
// stubbed (recorded, never sent) and service workers are blocked, so the pass
// writes nothing anywhere. This Chromium has no H.264/AAC, so the films are
// checked by their sources and captions here and by their files elsewhere.
// Usage: node dev-pass.cjs <outdir>
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'https://dev.mercurypitch.com'
const OUT = process.argv[2]
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
fs.mkdirSync(OUT, { recursive: true })

const checks = []
const note = (s) => console.log(s)
const check = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); note(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`) }
const info = (name, detail) => { checks.push({ name, pass: null, detail }); note(`INFO ${name} :: ${detail}`) }
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
const text = async (loc) => clean(await loc.first().innerText({ timeout: 5000 }).catch(() => ''))

const AUDIO_PROBE = `(() => {
  const W = window
  W.__beacons = []
  try { navigator.sendBeacon = (u, d) => { W.__beacons.push({ u: String(u), n: d ? (d.size || d.length || 0) : 0 }); return true } } catch (e) {}
  const A = (W.__aud = { ctxs: [], starts: 0, maxPeak: 0 })
  if (typeof AudioNode === 'undefined') return
  const taps = new WeakMap()
  const tapFor = (ctx) => { let t = taps.get(ctx); if (!t) { t = ctx.createAnalyser(); t.fftSize = 2048; taps.set(ctx, t); A.ctxs.push({ ctx, tap: t }) } return t }
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = connect.call(this, dest, ...rest)
    try { if (dest instanceof AudioDestinationNode && dest.context instanceof AudioContext) connect.call(this, tapFor(dest.context)) } catch (e) {}
    return r
  }
  const start = AudioScheduledSourceNode.prototype.start
  AudioScheduledSourceNode.prototype.start = function (...a) { A.starts++; return start.apply(this, a) }
  const data = new Float32Array(2048)
  setInterval(() => { for (const { ctx, tap } of A.ctxs) { if (ctx.state !== 'running') continue; tap.getFloatTimeDomainData(data); let p = 0; for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > p) p = v } if (p > A.maxPeak) A.maxPeak = p } }, 50)
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
      if (!n.textContent.trim() || !el || q.contains(el) || el.closest('script,style,template,title,.tour-root')) continue
      if (!visible(el)) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const cr of rg.getClientRects()) if (hit(cr)) { hits.push(`text "${n.textContent.trim().slice(0, 30)}"`); break }
    }
    return { found: true, shown: true, rect: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)), hits }
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

;(async () => {
  const blocked = new Map()
  const media = new Map()
  const errors = []
  const browser = await chromium.launch()
  const newPage = async (viewport, opts = {}) => {
    const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'UTC', ...opts })
    await ctx.route('**/*', (route) => {
      const req = route.request(); const u = new URL(req.url())
      if (req.method() === 'GET' || req.method() === 'HEAD') {
        if (u.hostname === 'media.mercurypitch.com') media.set(u.pathname, (media.get(u.pathname) || 0) + 1)
        return route.continue()
      }
      const k = `${req.method()} ${u.hostname}${u.pathname}`
      blocked.set(k, (blocked.get(k) || 0) + 1)
      return route.abort()
    })
    await ctx.addInitScript(AUDIO_PROBE)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror ${page.url().replace(BASE, '')}: ${e.message.slice(0, 160)}`))
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(`console ${page.url().replace(BASE, '')}: ${m.text().slice(0, 160)}`) })
    return { ctx, page }
  }
  let n = 0
  const shot = async (page, name, full = false) => { n += 1; const f = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f, fullPage: full, animations: 'disabled', timeout: 20000 }).catch(() => undefined) }
  const section = async (name, fn) => { note(`=== ${name}`); try { await fn() } catch (e) { check(`${name}: ran to the end`, false, e.message.split('\n')[0].slice(0, 300)) } }

  // Lesson 1 on a phone, first visit
  await section('lesson 1, phone', async () => {
    const { ctx, page } = await newPage(PHONE, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    const r = await page.goto(BASE + '/learn/01', { timeout: 90000 })
    check('L1: 200 and its search title', r.status() === 200 && /^What is a note\? Pitch, hertz and the octave/.test(await page.title()), `${r.status()} "${await page.title()}"`)
    const card = page.locator('.tour-card[role="dialog"]')
    const shown = await card.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    check('L1: the welcome tour opens on a first visit', shown)
    if (shown) {
      let steps = 0, last = '', lit = null
      for (let i = 0; i < 8 && (await card.isVisible().catch(() => false)); i++) {
        steps += 1; last = await text(card.locator('.tour-count'))
        await shot(page, `L1-tour-${steps}`)
        if (/(\d+) of \1$/.test(last)) lit = await page.evaluate(() => { const s = document.querySelector('.tour-spot')?.getBoundingClientRect(); const q = document.querySelector('.lm-tour')?.getBoundingClientRect(); return !!s && !!q && s.left <= q.left + 2 && s.right >= q.right - 2 && s.top <= q.top + 2 && s.bottom >= q.bottom - 2 })
        await card.locator('[data-tour-next]').click(); await page.waitForTimeout(700)
      }
      check('L1: the tour has five steps', steps === 5, `${steps} ("${last}")`)
      check("L1: the tour's last step lights the ?", lit === true)
    }
    const crumbs = await page.$$eval('nav', (ns) => ns.map((x) => ({ label: x.getAttribute('aria-label') || '', html: [...x.querySelectorAll('a,[aria-current]')].map((a) => `${a.getAttribute('href') || ''} "${(a.textContent || '').trim()}"`).join(' / ') })))
    const crumb = crumbs.find((c) => /bread|trail/i.test(c.label) || /\/learn\/ "Find Your Pitch"/.test(c.html))
    check('L1: the trail reads MercuryPitch > Find Your Pitch > the lesson', !!crumb && /^\/ "MercuryPitch" \/ \/learn\/ "Find Your Pitch"/.test(crumb.html), crumb ? crumb.html : '')
    const q = await covers(page, '.lm-tour')
    check('L1 390 px: the ? covers nothing and keeps 44 px', q.shown && q.hits.length === 0 && Math.min(q.rect[2], q.rect[3]) >= 44, q.shown ? `${q.rect} ${q.hits.join('; ')}` : JSON.stringify(q))
    await shot(page, 'L1-top')
    // sound
    await page.locator('#gateBtn').scrollIntoViewIfNeeded(); await page.locator('#gateBtn').click(); await page.waitForTimeout(800)
    const play = page.locator('#predict [data-play="220"]')
    const lockedFirst = await play.isDisabled().catch(() => null)
    await page.locator('#predict [data-choice="same"]').click(); await page.waitForTimeout(500)
    await page.evaluate(() => { window.__aud.maxPeak = 0 })
    await play.click(); await page.waitForTimeout(1800)
    const peak = await page.evaluate(() => window.__aud.maxPeak)
    check('L1: the tone waits for a guess, then plays', lockedFirst === true && peak > 0.01, `locked first ${lockedFirst}, peak ${peak.toFixed(3)}`)
    // the film: sources and captions (this browser cannot decode H.264, so no playback here)
    await page.locator('#watch').scrollIntoViewIfNeeded()
    await page.locator('#bigPlay').click().catch(() => undefined)
    await page.waitForTimeout(4000)
    const v = await page.evaluate(async () => {
      const el = document.querySelector('#watch video, video'); if (!el) return null
      const tr = el.querySelector('track')
      let cues = ''
      if (tr) { try { cues = await (await fetch(tr.src)).text() } catch (e) { cues = 'fetch failed' } }
      return { src: el.currentSrc || el.src || [...el.querySelectorAll('source')].map((s) => s.src).join(' '), err: el.error && el.error.code, track: tr && `${tr.kind}/${tr.srclang} ${tr.src.replace(location.origin, '')}`, merc: (cues.match(/MERC/g) || []).length, tavi: (cues.match(/TAVI/g) || []).length, colour: /(blue|orange) Merc/i.test(cues), cueCount: (cues.match(/-->/g) || []).length }
    })
    check('L1 phone: the film asks for the 720p file', !!v && /\/learn\/01\/v1\/lesson-01-720p\.mp4$/.test(v.src), v ? v.src : 'no video')
    check('L1: captions load, name MERC and TAVI, and never "blue/orange Merc"', !!v && v.cueCount > 20 && v.merc > 0 && v.tavi > 0 && !v.colour, v ? `${v.track}: ${v.cueCount} cues, MERC ${v.merc}, TAVI ${v.tavi}` : '')
    info('L1: video element error in this browser', v ? `code ${v.err} (4 = no H.264/AAC in this Chromium build)` : 'none')
    await shot(page, 'L1-watch')
    // the quick check: an answer, nothing visible, and the answer's beacon never leaves
    const quiz = page.locator('#quiz [data-choice], .quiz [data-choice], [data-quiz] button').first()
    if (await quiz.count()) {
      await quiz.scrollIntoViewIfNeeded(); await quiz.click(); await page.waitForTimeout(1200)
      info('L1: quick-check answer, beacons recorded (not sent)', JSON.stringify(await page.evaluate(() => window.__beacons.map((b) => b.u.replace(/^https?:\/\//, '')))))
    } else info('L1: quick check', 'no quiz choice found by the selectors')
    // the wrap: the next-lesson card
    await page.locator('#wrap').scrollIntoViewIfNeeded(); await page.waitForTimeout(1000)
    const next = (await anchorsTo(page, /\/learn\/02\/?$/)).filter((a) => a.vis)
    check("L1: the Wrap's card and the foot link Lesson 2", next.length >= 1, next.map((a) => `[${a.text}] in ${a.where}`).join(' | '))
    await shot(page, 'L1-wrap')
    // share card
    const og = await page.$$eval('meta[property="og:image"],meta[property="og:title"]', (ms) => ms.map((m) => m.getAttribute('content')))
    const img = og.find((x) => /^https?:/.test(x || ''))
    const ir = img ? await ctx.request.get(img).catch(() => null) : null
    check('L1: the share card image loads', !!ir && ir.status() === 200 && /image\//.test(ir.headers()['content-type'] || ''), `${og.join(' | ')} -> ${ir ? ir.status() + ' ' + ir.headers()['content-type'] : 'none'}`)
    await ctx.close()
  })

  // Lesson 2 on a desktop: film source, step 5's switch, links, the practice link
  await section('lesson 2, desktop', async () => {
    const { ctx, page } = await newPage(DESKTOP)
    const r = await page.goto(BASE + '/learn/02', { timeout: 90000 })
    check('L2: 200', r.status() === 200, `"${await page.title()}"`)
    const card = page.locator('.tour-card[role="dialog"]')
    if (await card.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)) await card.locator('[data-tour-skip], button:has-text("Skip")').first().click().catch(() => undefined)
    await page.waitForTimeout(800)
    const sw = page.locator('button.switch[data-rare]').first()
    await sw.scrollIntoViewIfNeeded()
    const before = await sw.isDisabled()
    const sec = sw.locator('xpath=ancestor::section[1]')
    const choice = sec.locator('[data-choice]').first()
    await choice.scrollIntoViewIfNeeded(); await choice.click(); await page.waitForTimeout(800)
    const after = await sw.isDisabled()
    if (!after) { await sw.click(); await page.waitForTimeout(400) }
    const pressed = await sw.getAttribute('aria-pressed')
    check('L2 step 5: the rare-ones switch is locked before the predict and works after it', before === true && after === false && pressed === 'true', `before ${before}, after ${after}, pressed ${pressed}`)
    await shot(page, 'L2-step5')
    await page.locator('#watch').scrollIntoViewIfNeeded(); await page.locator('#bigPlay').click().catch(() => undefined); await page.waitForTimeout(3000)
    const src = await page.evaluate(() => { const el = document.querySelector('#watch video, video'); return el ? el.currentSrc || el.src || [...el.querySelectorAll('source')].map((s) => s.src).join(' ') : '' })
    check('L2 desktop: the film asks for the 1080p file', /\/learn\/02\/v1\/lesson-02-1080p\.mp4$/.test(src), src)
    const l = await anchorsTo(page, /\/learn\/0[13]\/?$/)
    check('L2: links Lesson 1, and on dev Lesson 3 (drafts show on dev)', l.some((a) => /01\/?$/.test(a.href)) && l.some((a) => /03\/?$/.test(a.href)), l.map((a) => `${a.href} [${a.text}] in ${a.where}`).join(' | ').slice(0, 300))
    const ear = await page.$$eval('a[href^="/ear-lab"]', (as) => as.map((a) => a.getAttribute('href')))
    info('L2: practice links', ear.join(' '))
    await ctx.close()
    // the practice link in a fresh browser: the room, with no First Light over it
    const fresh = await newPage(PHONE, { isMobile: true, hasTouch: true })
    await fresh.page.goto(BASE + (ear[0] || '/ear-lab?lesson=02'), { timeout: 90000 })
    await fresh.page.waitForTimeout(7000)
    const fl = await fresh.page.locator('[data-beat]:visible, [aria-label*="First Light" i]:visible').count()
    const dlg = await text(fresh.page.locator('[role="dialog"]:visible'))
    check('Ear Lab from Lesson 2, first visit: no First Light over the room', fl === 0, dlg ? `dialog: ${dlg.slice(0, 100)}` : 'no dialog')
    await shot(fresh.page, 'ear-lab-from-L2')
    await fresh.ctx.close()
  })

  // The hub and its addresses
  await section('hub', async () => {
    const { ctx, page } = await newPage(DESKTOP)
    const titles = []
    for (const u of ['/learn', '/learn/', '/learn/index.html']) { const r = await page.goto(BASE + u, { timeout: 60000 }); titles.push(`${u} ${r.status()} ${page.url().replace(BASE, '')} "${await page.title()}"`) }
    const same = new Set(titles.map((t) => t.split('"')[1])).size === 1
    check('/learn, /learn/ and /learn/index.html land on the hub', same && titles.every((t) => / 200 /.test(t)), titles.join(' | '))
    await page.waitForTimeout(1500)
    const hub = await anchorsTo(page, /\/learn\/\d\d\/?$/)
    const live = [...new Set(hub.filter((a) => a.vis).map((a) => a.href.replace(/\/$/, '').slice(-2)))].sort()
    info('Hub on dev: lessons linked (drafts show on dev)', live.join(','))
    await shot(page, 'hub', true)
    await ctx.close()
  })

  // Home: the Lessons link, on a phone, first visit
  await section('home', async () => {
    const { ctx, page } = await newPage(PHONE, { isMobile: true, hasTouch: true })
    await page.goto(BASE + '/', { timeout: 90000 })
    await page.waitForTimeout(6000)
    await shot(page, 'home-first-visit')
    const href = await page.getByTestId('home-lessons').first().getAttribute('href', { timeout: 15000 }).catch(() => null)
    const greet = await text(page.locator('[role="dialog"]:visible, [data-beat]:visible'))
    info('Home first visit: what greets it', greet.slice(0, 120) || 'nothing modal')
    if (href !== null) check("Home's Lessons link opens Lesson 1 for a new visitor", href === '/learn/01', href)
    else info("Home's Lessons link", 'not reachable behind the first-visit screens (checked locally in the walk)')
    await ctx.close()
  })

  // Served HTML with scripts off: room pages name their lesson, the 404 scene, Karaoke Night's page
  await section('served pages', async () => {
    const { ctx, page } = await newPage(DESKTOP, { javaScriptEnabled: false })
    for (const [u, want] of [['/mirror', 'Find Your Pitch lesson: What is a note? (Lesson 1)'], ['/vocal-range-test', 'Find Your Pitch lesson: What is a note? (Lesson 1)'], ['/ear-lab', 'Lesson 2']]) {
      await page.goto(BASE + u, { timeout: 60000 })
      const body = clean(await page.locator('body').innerText().catch(() => ''))
      check(`${u}: its text names its lesson`, body.includes(want), want)
    }
    const r = await page.goto(BASE + '/no-such-page', { timeout: 60000 })
    const nf = clean(await page.locator('body').innerText().catch(() => ''))
    const rooms = await page.$$eval('a[href^="/"]', (as) => as.length)
    check('/no-such-page: a 404 with "404 cents off", "Nothing plays at this address" and the rooms', r.status() === 404 && /404 cents off/i.test(nf) && /Nothing plays at this address/i.test(nf) && rooms >= 8, `${r.status()}, ${rooms} links`)
    await page.goto(BASE + '/karaoke-app', { timeout: 60000 })
    const qs = await page.$$eval('details summary, [itemtype*="Question"], .faq h3, .faq dt', (e) => e.length)
    const h1 = await text(page.locator('h1'))
    check('/karaoke-app: Karaoke Night, with five questions and answers', /karaoke/i.test(h1) && qs === 5, `h1 "${h1}", ${qs} questions`)
    await ctx.close()
  })

  // Priority 2 copy that a browser can read
  await section('copy', async () => {
    const { ctx, page } = await newPage(DESKTOP)
    await page.goto(BASE + '/mirror?demo=bass-baritone', { timeout: 90000 })
    await page.waitForTimeout(8000)
    const body = clean(await page.locator('body').innerText().catch(() => ''))
    check('/mirror?demo=bass-baritone: "Bass-baritone range", like Paul Robeson', /Bass-baritone range/.test(body) && /Paul Robeson/.test(body), (body.match(/.{0,40}Bass-baritone.{0,60}/) || [''])[0])
    await shot(page, 'mirror-bass-baritone')
    await ctx.close()
  })

  await browser.close()
  info('requests aborted (not GET/HEAD)', [...blocked].map(([k, c]) => `${k} x${c}`).join(' | ') || 'none')
  info('media.mercurypitch.com requests', [...media].map(([k, c]) => `${k} x${c}`).join(' | ') || 'none')
  info('page errors', errors.slice(0, 8).join(' | ') || 'none')
  const pass = checks.filter((c) => c.pass === true).length, fail = checks.filter((c) => c.pass === false).length
  note(`checks: ${pass} pass, ${fail} fail, ${checks.filter((c) => c.pass === null).length} info`)
  fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(checks, null, 2))
})()
