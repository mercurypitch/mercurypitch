// 0.9.22 release walk: the critical paths in a real browser, with sound.
// Local only: every request that leaves 127.0.0.1 is aborted and listed,
// except the lesson films, which are answered with a local stub file.
// Usage: node release-walk.cjs <base> <outdir> <stub.mp4> [phase,...]
// Phases: onbA lessons search misc onbB onbC (default: all, in that order)
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.argv[2]
const OUT = process.argv[3]
const STUB = fs.readFileSync(process.argv[4])
const ONLY = (process.argv[5] || '').split(',').filter(Boolean)
const want = (p) => ONLY.length === 0 || ONLY.includes(p)
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
const TABLETS = [
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
]
const Q_SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1440, height: 900 },
]

fs.mkdirSync(OUT, { recursive: true })
const log = []
const checks = []
const stamp = () => new Date().toISOString().slice(11, 19)
const note = (s) => { log.push(`${stamp()} ${s}`); console.log(s) }
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: !!pass, detail })
  note(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`)
}
const info = (name, detail) => { checks.push({ name, pass: null, detail }); note(`INFO ${name} :: ${detail}`) }

// ---------- fake microphone input ----------
function wav(file, samples, rate) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 26000))), 44 + i * 2)
  fs.writeFileSync(file, buf)
  return file
}
// A voice-like tone (fundamental plus two harmonics) following hzAt(t).
function voice(seconds, hzAt, rate = 48000) {
  const n = rate * seconds, out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / rate
    ph += (2 * Math.PI * hzAt(t)) / rate
    const env = Math.min(1, t / 0.05, (seconds - t) / 0.05)
    out[i] = env * (0.5 * Math.sin(ph) + 0.2 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph))
  }
  return out
}
const steadyWav = (file) => wav(file, voice(5, () => 220), 48000)
// Holds, then slow glides across about an octave and a half (G2 to C5), so a
// range read has a span: 2 s on A3, 4 s up to C5, 2 s on C5, 4 s down to G2,
// 2 s on G2, looped by the fake device.
function sweepWav(file) {
  const lo = 98, hi = 523.25, mid = 220
  const at = (t) => {
    if (t < 2) return mid
    if (t < 6) return mid * Math.pow(hi / mid, (t - 2) / 4)
    if (t < 8) return hi
    if (t < 12) return hi * Math.pow(lo / hi, (t - 8) / 4)
    return lo
  }
  return wav(file, voice(14, at), 48000)
}

// ---------- audio instrumentation, injected before any page script ----------
// Taps every node that feeds a live AudioContext's destination with an
// analyser (Chrome pulls analysers on its own), counts source starts, and
// samples the output peak every 50 ms. The mic graph never reaches the
// destination, so the peak is what the page plays, not what it hears.
const AUDIO_PROBE = `(() => {
  const W = window
  const A = (W.__aud = { ctxs: [], starts: 0, osc: 0, buf: 0, maxPeak: 0, audible: 0 })
  if (typeof AudioNode === 'undefined') return
  const taps = new WeakMap()
  const tapFor = (ctx) => {
    let t = taps.get(ctx)
    if (!t) { t = ctx.createAnalyser(); t.fftSize = 2048; taps.set(ctx, t); A.ctxs.push({ ctx, tap: t }) }
    return t
  }
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = connect.call(this, dest, ...rest)
    try {
      if (dest instanceof AudioDestinationNode && typeof AudioContext !== 'undefined' && dest.context instanceof AudioContext)
        connect.call(this, tapFor(dest.context))
    } catch (e) {}
    return r
  }
  const start = AudioScheduledSourceNode.prototype.start
  AudioScheduledSourceNode.prototype.start = function (...a) {
    A.starts++
    if (this instanceof OscillatorNode) A.osc++
    if (this instanceof AudioBufferSourceNode) A.buf++
    return start.apply(this, a)
  }
  const data = new Float32Array(2048)
  setInterval(() => {
    for (const { ctx, tap } of A.ctxs) {
      if (ctx.state !== 'running') continue
      tap.getFloatTimeDomainData(data)
      let p = 0
      for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > p) p = v }
      if (p > A.maxPeak) A.maxPeak = p
      if (p > 0.005) A.audible++
    }
  }, 50)
})()`

async function audio(page) {
  return page.evaluate(() => {
    const a = window.__aud
    if (!a) return null
    return {
      ctxs: a.ctxs.length,
      states: a.ctxs.map((c) => c.ctx.state).join(','),
      times: a.ctxs.map((c) => c.ctx.currentTime.toFixed(1)).join(','),
      starts: a.starts, osc: a.osc, buf: a.buf,
      maxPeak: Number(a.maxPeak.toFixed(4)), audible: a.audible,
    }
  }).catch(() => null)
}
const resetPeak = (page) => page.evaluate(() => { if (window.__aud) { window.__aud.maxPeak = 0; window.__aud.audible = 0 } }).catch(() => undefined)
const fmtAudio = (a) => (a ? `ctx ${a.ctxs} [${a.states}] t=[${a.times}] starts ${a.starts} (osc ${a.osc}, buf ${a.buf}) peak ${a.maxPeak} audible ${a.audible}` : 'no probe')

// ---------- page helpers ----------
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
async function text(loc) { return clean(await loc.first().innerText({ timeout: 5000 }).catch(() => '')) }
async function anchorsTo(page, re) {
  return page.$$eval('a', (as, src) => {
    const rx = new RegExp(src)
    return as.filter((a) => rx.test(a.getAttribute('href') || '')).map((a) => {
      const vis = !!(a.offsetWidth || a.offsetHeight || a.getClientRects().length) && getComputedStyle(a).visibility !== 'hidden'
      const box = a.closest('nav,header,footer,section,aside,article,main,[data-beat],dialog,[role=dialog]')
      const where = box ? box.tagName.toLowerCase() + (box.id ? '#' + box.id : '') + (box.getAttribute('aria-label') ? `[${box.getAttribute('aria-label')}]` : '') : 'body'
      return { href: a.getAttribute('href'), text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70), vis, where }
    })
  }, re.source)
}
// What text or control a fixed element covers, at the current scroll.
async function covers(page, sel) {
  return page.evaluate((sel) => {
    const q = document.querySelector(sel)
    if (!q) return { found: false }
    const r = q.getBoundingClientRect()
    const cs0 = getComputedStyle(q)
    if (r.width === 0 || cs0.display === 'none' || cs0.visibility === 'hidden') return { found: true, shown: false }
    const visible = (el) => {
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false
      }
      return true
    }
    const hit = (a) => a.width > 0 && a.height > 0 && a.left < r.right - 1 && a.right > r.left + 1 && a.top < r.bottom - 1 && a.bottom > r.top + 1
    const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '')
    const hits = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement
      if (!n.textContent.trim() || !el || q.contains(el) || el.closest('script,style,template,title,.tour-root')) continue
      if (!visible(el)) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const cr of rg.getClientRects()) if (hit(cr)) { hits.push(`text "${n.textContent.trim().slice(0, 30)}" in ${name(el)}`); break }
    }
    for (const el of document.querySelectorAll('a[href],button,input,select,textarea,[role=button],[role=switch],[role=slider],[role=tab]')) {
      if (q.contains(el) || el.contains(q) || !visible(el)) continue
      if (hit(el.getBoundingClientRect())) hits.push(`control ${name(el)} "${(el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`)
    }
    return { found: true, shown: true, rect: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)), hits, pos: cs0.position }
  }, sel)
}

;(async () => {
  const steady = steadyWav(path.join(OUT, 'mic-steady-220.wav'))
  const sweep = sweepWav(path.join(OUT, 'mic-sweep.wav'))
  const blocked = new Map()
  const films = []
  const fence = async (ctx) => {
    await ctx.route('**/*', (route) => {
      const req = route.request()
      const u = new URL(req.url())
      if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue()
      if (u.hostname === 'media.mercurypitch.com' && /\/learn\/\d\d\/.*\.mp4$/.test(u.pathname)) {
        films.push(u.pathname)
        return route.fulfill({ status: 200, body: STUB, headers: { 'content-type': 'video/mp4', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } })
      }
      const k = `${req.method()} ${u.hostname}`
      blocked.set(k, (blocked.get(k) || 0) + 1)
      return route.abort()
    })
  }
  const errors = []
  const launch = (micFile) => chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${micFile}`],
  })
  const newPage = async (browser, viewport, opts = {}) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, permissions: ['microphone'], timezoneId: 'UTC', ...opts })
    await fence(ctx)
    await ctx.addInitScript(AUDIO_PROBE)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror ${page.url().replace(BASE, '')}: ${e.message.slice(0, 160)}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${page.url().replace(BASE, '')}: ${m.text().slice(0, 160)}`) })
    return { ctx, page }
  }
  let shotN = 0
  const shot = async (page, name, full = false) => {
    shotN += 1
    const file = path.join(OUT, `${String(shotN).padStart(2, '0')}-${name}.png`)
    try { await page.screenshot({ path: file, fullPage: full, animations: 'disabled', timeout: 20000 }); note(`shot ${path.basename(file)}`) }
    catch (e) { note(`shot FAILED ${name}: ${e.message.split('\n')[0]}`) }
    return file
  }
  const phase = async (name, fn) => {
    if (!want(name)) return
    note(`=== ${name}`)
    try { await fn() } catch (e) {
      const m = e.message.split('\n')
      const why = m.filter((l) => /waiting for|intercepts pointer|not visible|not enabled|not stable|outside of the viewport|resolved to/.test(l)).slice(0, 4).map((l) => l.trim()).join(' ; ')
      check(`${name}: ran to the end`, false, `${m[0]} ${why}`.slice(0, 600))
    }
  }
  const beat = (page, b) => page.locator(`[data-beat="${b}"]`)
  const dismissWelcome = async (page) => {
    // One welcome at a time: close whatever greets a fresh visit.
    for (let i = 0; i < 4; i++) {
      const d = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').first()
      if (!(await d.isVisible().catch(() => false))) return
      const t = await text(d)
      const btn = d.getByRole('button', { name: /^(Close|Not now|Maybe later|Got it|Skip|No thanks)/ }).first()
      if (!(await btn.isVisible().catch(() => false))) return
      note(`dismissed: ${t.slice(0, 80)}`)
      await btn.click().catch(() => undefined)
      await page.waitForTimeout(800)
    }
  }

  // ---------- onboarding up to the plan ----------
  async function toPlan(page, { voiceprint, label }) {
    await page.goto(BASE + '/', { timeout: 180000 })
    await beat(page, 'sky').waitFor({ timeout: 120000 })
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Sing one note' }).click()
    await beat(page, 'first-light').waitFor()
    await page.getByRole('button', { name: /Allow microphone|Start listening/ }).click()
    await beat(page, 'first-light').locator('h1').filter({ hasText: /\b[A-G]#?\d\b/ }).first().waitFor({ timeout: 40000 })
    const heard = await text(beat(page, 'first-light').locator('h1'))
    info(`${label}: first note heard`, heard)
    await page.getByRole('button', { name: 'Keep going' }).click()
    await beat(page, 'fork').waitFor()
    if (!voiceprint) {
      await page.getByRole('button', { name: 'Not now' }).click()
      const ask = page.getByRole('alertdialog', { name: 'Skip your voiceprint?' })
      await ask.waitFor()
      await ask.getByRole('button', { name: 'Yes, skip' }).click()
    } else {
      await page.getByRole('button', { name: 'Find my twin' }).click()
      const vp = beat(page, 'voiceprint')
      await vp.waitFor()
      const ready = page.getByRole('button', { name: "I'm ready" })
      const deadline = Date.now() + 300000
      while (Date.now() < deadline) {
        if (await beat(page, 'twin').isVisible().catch(() => false)) break
        if (await ready.isVisible().catch(() => false)) await ready.click().catch(() => undefined)
        await page.waitForTimeout(700)
      }
      await beat(page, 'twin').waitFor({ timeout: 30000 })
      await page.waitForTimeout(1500)
    }
  }
  async function answer(page, picks) {
    const q = beat(page, 'questions')
    const pick = async (l) => {
      const b = q.getByRole('button', { name: l, exact: true })
      if (await b.count()) return b.first().click()
      return q.getByRole('checkbox', { name: l, exact: true }).first().click()
    }
    await q.getByText('Question 1 of 4').waitFor({ timeout: 20000 })
    await pick(picks[0])
    await q.getByText('Question 2 of 4').waitFor({ timeout: 10000 })
    await pick(picks[1])
    await q.getByText('Question 3 of 4').waitFor({ timeout: 10000 })
    for (const p of picks[2]) await pick(p)
    await q.getByRole('button', { name: 'Next', exact: true }).click()
    await q.getByText('Question 4 of 4').waitFor({ timeout: 10000 })
    await pick(picks[3])
    await q.getByRole('button', { name: 'Show my plan' }).click()
    await page.waitForTimeout(2500)
    return q
  }
  // Question 2's options follow question 1 (plan/questions.ts q2Options): for Singing, 'A song I love'.
  const PICKS = ['Singing', 'A song I love', ["Telling if I'm getting better"], 'A video lesson']

  async function planChecks(page, q, label) {
    const planText = await text(q)
    note(`${label} plan: ${planText}`)
    const primary = q.getByRole('button', { name: 'Start here', exact: true })
    check(`${label}: the plan's main button is Start here`, await primary.isVisible().catch(() => false))
    check(`${label}: Show me around stays`, await q.getByRole('button', { name: 'Show me around' }).isVisible().catch(() => false))
    check(`${label}: See every room stays`, await q.getByRole('button', { name: 'See every room' }).isVisible().catch(() => false))
    const sizes = await q.getByRole('button').evaluateAll((bs) => bs.map((b) => {
      const r = b.getBoundingClientRect()
      return { t: (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }
    }))
    info(`${label}: plan buttons`, sizes.filter((s) => /^(Start here|Show me around|See every room|Not now)$/.test(s.t)).map((s) => `${s.t} ${s.w}x${s.h}@${s.x},${s.y}`).join(' | '))
    return planText
  }
  async function coverWhole(page, q, label) {
    const r = await q.locator('img').evaluateAll((imgs) => imgs.map((img) => {
      const card = img.closest('button,a,article,li,div')
      const cardText = (card?.textContent || '').replace(/\s+/g, ' ').trim()
      const b = img.getBoundingClientRect()
      const fit = getComputedStyle(img).objectFit
      const nat = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null
      return { src: (img.currentSrc || img.src).split('/').pop(), w: Math.round(b.width), h: Math.round(b.height), fit, nat, card: cardText.slice(0, 40) }
    }))
    for (const i of r) {
      if (!/lesson-\d\d-og/.test(i.src)) continue
      const box = i.h ? i.w / i.h : 0
      const whole = i.fit === 'contain' || i.fit === 'scale-down' || (i.nat && Math.abs(box - i.nat) / i.nat < 0.03)
      check(`${label}: the lesson cover shows whole`, whole, `${i.src} ${i.w}x${i.h} fit ${i.fit} box ${box.toFixed(2)} picture ${i.nat ? i.nat.toFixed(2) : '?'}`)
    }
  }

  // ---------- A: phone, steady tone, voiceprint ----------
  await phase('onbA', async () => {
    const browser = await launch(steady)
    const { page } = await newPage(browser, PHONE)
    try {
      await toPlan(page, { voiceprint: true, label: 'A' })
      const twin = await text(beat(page, 'twin'))
      note(`A twin: ${twin}`)
      check('A: a steady tone gets no clean range read', /couldn't get a clean read/.test(twin))
      check('A: the twin card shows no unclean range', !/0 semitones|from A3 to A3/.test(twin), twin.slice(0, 160))
      await shot(page, 'A-twin')
      await page.getByRole('button', { name: /^Continue$/ }).click()
      await page.waitForTimeout(1500)
      if (await beat(page, 'keep').isVisible().catch(() => false)) {
        const keep = await text(beat(page, 'keep'))
        note(`A keep: ${keep}`)
        check('A: Keep shows no unclean range', !/A3 to A3/.test(keep), keep.slice(0, 120))
        await shot(page, 'A-keep')
        await page.getByRole('button', { name: /Not now/ }).filter({ visible: true }).first().click()
      } else info('A: keep', 'not shown')
      const q = await answer(page, PICKS)
      const planText = await planChecks(page, q, 'A')
      check('A: an unclean read is not sent to the range stop', !/There's more voice up there/.test(planText))
      info('A: the voiceprint card ends', (planText.match(/START HERE[^]*?(?=LEARN ·|PLAY ·|$)/) || [''])[0].slice(0, 300))
      await shot(page, 'A-plan-390')
      await coverWhole(page, q, 'A 390')
      for (const vp of TABLETS) {
        await page.setViewportSize(vp); await page.waitForTimeout(700)
        await shot(page, `A-plan-${vp.width}x${vp.height}`)
        await coverWhole(page, q, `A ${vp.width}x${vp.height}`)
      }
      await page.setViewportSize(DESKTOP); await page.waitForTimeout(700)
      await shot(page, 'A-plan-1440')
      await coverWhole(page, q, 'A 1440')
      await page.setViewportSize(PHONE); await page.waitForTimeout(700)
      await q.getByRole('button', { name: 'See every room' }).click()
      const map = beat(page, 'map')
      await map.waitFor({ timeout: 15000 })
      await page.waitForTimeout(1500)
      const mapText = await text(map)
      note(`A map: ${mapText}`)
      // The Map's Lessons door and section are buttons that navigate when tapped; the anchors here are Home's, under the Map.
      const section = map.locator('[data-map-lessons] button')
      check('A: the Map has a Lessons section naming Lesson 1', await section.isVisible().catch(() => false) && /What is a note\?/.test(await text(section)), (await text(section).catch(() => '')).slice(0, 90))
      check('A: the Map has a Lessons door', await map.getByRole('button', { name: 'Lessons', exact: true }).isVisible().catch(() => false))
      check('A: the Map names the lesson', /What is a note\?/.test(mapText))
      await shot(page, 'A-map-390', true)
      await page.setViewportSize(DESKTOP); await page.waitForTimeout(700)
      await shot(page, 'A-map-1440', true)
      await page.setViewportSize(PHONE); await page.waitForTimeout(700)
      await page.getByRole('button', { name: /Start singing|Done/ }).filter({ visible: true }).first().click()
      // The desktop bar (#app-tabs) unmounts at phone width; Singing sits in both bars (e2e/helpers/ui.ts waitForNav).
      await page.locator('#tab-singing').waitFor({ state: 'visible', timeout: 20000 })
      await page.waitForTimeout(2500)
      await page.goto(BASE + '/#/home', { timeout: 60000 })
      await page.waitForTimeout(3500)
      await dismissWelcome(page)
      const lessons = page.locator('[data-testid="home-lessons"]')
      const href0 = await lessons.getAttribute('href').catch(() => null)
      check("A: Home's Lessons link opens Lesson 1 when none is done", /\/learn\/01\/?$/.test(href0 || ''), String(href0))
      await shot(page, 'A-home-390')
      await page.setViewportSize(DESKTOP); await page.waitForTimeout(700)
      await shot(page, 'A-home-1440')
      for (const vp of TABLETS) { await page.setViewportSize(vp); await page.waitForTimeout(600); await shot(page, `A-home-${vp.width}x${vp.height}`) }
      await page.setViewportSize(PHONE)
      for (const [done, want] of [['[1]', /\/learn\/02\/?$/], ['[1,2]', /\/learn\/?$/], ['not json', /\/learn\/01\/?$/]]) {
        await page.evaluate((d) => localStorage.setItem('fyp-done', d), done)
        await page.reload(); await page.waitForTimeout(3500)
        const h = await page.locator('[data-testid="home-lessons"]').getAttribute('href').catch(() => null)
        check(`A: Home's Lessons link with fyp-done ${done}`, want.test(h || ''), String(h))
      }
      await page.evaluate(() => localStorage.setItem('fyp-done', '[1]'))
      // A goto that changes only the hash keeps the document (and Home, drawn before the list changed): load #/map afresh.
      // No reload after it: a fresh load at #/map opens the Map and rewrites the hash to #/home, so a reload lands on Home.
      await page.goto('about:blank'); await page.goto(BASE + '/#/map', { timeout: 60000 })
      const map2 = beat(page, 'map')
      const map2Up = await map2.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
      await page.waitForTimeout(1500)
      check('A: the Map names Lesson 2 (Lesson 1 done)', map2Up && /Twelve notes/.test(await text(map2)))
      await shot(page, 'A-map-lesson-2')
      const section2 = map2.locator('[data-map-lessons] button')
      if (map2Up && await section2.isVisible().catch(() => false)) {
        await Promise.all([page.waitForURL(/\/learn\//, { timeout: 30000 }).catch(() => null), section2.click()])
        check("A: the Map's Lessons section opens Lesson 2 (Lesson 1 done)", /\/learn\/02\/?$/.test(new URL(page.url()).pathname), page.url().replace(BASE, ''))
        await page.goto(BASE + '/#/map', { timeout: 60000 })
        await map2.waitFor({ timeout: 15000 }).catch(() => null); await page.waitForTimeout(1500)
      } else check("A: the Map's Lessons section opens Lesson 2 (Lesson 1 done)", false, 'no section')
      const door = map2.getByRole('button', { name: 'Lessons', exact: true }).filter({ visible: true }).first()
      if (map2Up && await door.isVisible().catch(() => false)) {
        await Promise.all([page.waitForURL(/\/learn\//, { timeout: 30000 }).catch(() => null), door.click()])
        check("A: the Map's Lessons door opens Lesson 2 (Lesson 1 done)", /\/learn\/02\/?$/.test(new URL(page.url()).pathname), page.url().replace(BASE, ''))
      } else info("A: the Map's Lessons door", 'not a visible button named Lessons')
      await page.evaluate(() => localStorage.removeItem('fyp-done')).catch(() => null)
    } finally { await browser.close() }
  })

  // ---------- lessons: phone, then the "?" at every size ----------
  await phase('lessons', async () => {
    const browser = await launch(steady)
    const { page } = await newPage(browser, PHONE)
    try {
      await page.goto(BASE + '/learn/01', { timeout: 120000 })
      const card = page.locator('.tour-card[role="dialog"]')
      // Lessons 1 and 2 hold a first visit's card until Merc and Tavi land (kit/opening-hold.ts, HOLD_CAP 6 s).
      const tourShown = await card.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
      check('L1: the tour opens on a first lesson visit', tourShown)
      if (tourShown) {
        let steps = 0, last = ''
        for (let i = 0; i < 8 && (await card.isVisible().catch(() => false)); i++) {
          steps += 1
          last = await text(card.locator('.tour-count'))
          await shot(page, `L1-tour-${steps}`)
          const isLast = /(\d+) of \1$/.test(last)
          if (isLast) {
            const lit = await page.evaluate(() => {
              const s = document.querySelector('.tour-spot')?.getBoundingClientRect()
              const q = document.querySelector('.lm-tour')?.getBoundingClientRect()
              if (!s || !q) return null
              return s.left <= q.left + 2 && s.right >= q.right - 2 && s.top <= q.top + 2 && s.bottom >= q.bottom - 2
            })
            check("L1: the tour's last step lights the ?", lit === true, last)
          }
          await card.locator('[data-tour-next]').click()
          await page.waitForTimeout(700)
        }
        check('L1: the tour has five steps', steps === 5, `${steps} (last count "${last}")`)
      }
      // breadcrumb and the "?" at the phone size
      const crumbs = await page.$$eval('nav', (ns) => ns.map((n) => ({ label: n.getAttribute('aria-label') || '', html: [...n.querySelectorAll('a,[aria-current]')].map((a) => `${a.tagName.toLowerCase()} ${a.getAttribute('href') || ''} ${a.getAttribute('aria-current') || ''} "${(a.textContent || '').trim()}"`).join(' / ') })))
      const crumb = crumbs.find((c) => /bread|trail/i.test(c.label) || /\/learn\/ .*Find Your Pitch/.test(c.html))
      check('L1: a breadcrumb links the hub', !!crumb && /a \/learn\/ .*"Find Your Pitch"/.test(crumb.html), crumb ? `${crumb.label}: ${crumb.html}` : crumbs.map((c) => c.label).join(','))
      check('L1: the breadcrumb marks the lesson as the current page', !!crumb && /page/.test(crumb.html))
      // sound
      await page.locator('#gateBtn').scrollIntoViewIfNeeded()
      const before = await audio(page)
      await page.locator('#gateBtn').click()
      await page.waitForTimeout(800)
      // The play buttons unlock once a guess is in (kit/predict.ts).
      await page.locator('[data-choice="same"]').scrollIntoViewIfNeeded()
      await page.locator('[data-choice="same"]').click()
      await page.waitForTimeout(600)
      await resetPeak(page)
      await page.locator('[data-play="220"]').click()
      await page.waitForTimeout(1800)
      const after = await audio(page)
      note(`L1 audio before: ${fmtAudio(before)} | after a play: ${fmtAudio(after)}`)
      check('L1: Turn sound on, guess, then a play button makes sound', !!after && /running/.test(after.states) && after.starts > (before?.starts || 0) && after.maxPeak > 0.01, fmtAudio(after))
      await shot(page, 'L1-played')
      await resetPeak(page)
      await page.locator('[data-play="440"]').click().catch(() => undefined)
      await page.waitForTimeout(1500)
      const after2 = await audio(page)
      check('L1: the second tone plays too', !!after2 && after2.maxPeak > 0.01, fmtAudio(after2))
      // film
      await page.locator('#watch').scrollIntoViewIfNeeded()
      await page.locator('#bigPlay').click()
      const played = await page.waitForFunction(() => { const v = document.querySelector('video'); return !!v && v.currentTime > 1.5 }, null, { timeout: 25000 }).then(() => true).catch(() => false)
      const vs = await page.evaluate(() => { const v = document.querySelector('video'); return v ? { src: (v.currentSrc || '').replace(/^.*\/learn\//, '/learn/'), t: +v.currentTime.toFixed(1), paused: v.paused, muted: v.muted, vol: v.volume, tracks: [...v.textTracks].map((t) => `${t.kind}:${t.mode}`).join(',') } : null })
      check('L1: the episode plays with sound and captions on', played && vs && !vs.paused && !vs.muted && vs.vol > 0 && /captions:showing|subtitles:showing/.test(vs.tracks), JSON.stringify(vs))
      await shot(page, 'L1-film')
      await page.evaluate(() => document.querySelector('video')?.pause())
      // the end of the lesson: the next lesson once
      await page.locator('#wrap').scrollIntoViewIfNeeded()
      await page.waitForTimeout(1200)
      const next = (await anchorsTo(page, /\/learn\/02\/?$/)).filter((a) => a.vis && !/menu|lesson-menu/i.test(a.where))
      info('L1: visible links to Lesson 2', next.map((a) => `[${a.text}] in ${a.where}`).join(' | '))
      await shot(page, 'L1-wrap')
      await page.locator('footer, #wrap').last().scrollIntoViewIfNeeded().catch(() => undefined)
      await shot(page, 'L1-foot')
      // the "?" over the page, at every size
      for (const vp of Q_SIZES) {
        await page.setViewportSize(vp)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.waitForTimeout(500)
        const c = await covers(page, '.lm-tour')
        const tap = c.rect ? Math.min(c.rect[2], c.rect[3]) : 0
        check(`L1 ${vp.width}x${vp.height}: the ? covers nothing`, c.found && c.shown && c.hits.length === 0, c.shown ? `${c.pos} ${c.rect} ${c.hits.slice(0, 4).join('; ')}` : JSON.stringify(c))
        check(`L1 ${vp.width}x${vp.height}: the ? keeps a 44 px target`, tap >= 44, String(c.rect))
        await shot(page, `L1-top-${vp.width}x${vp.height}`)
      }
      await page.setViewportSize(PHONE)
      // Lesson 2
      await page.goto(BASE + '/learn/02', { timeout: 120000 })
      await page.waitForTimeout(8000)
      check('L2: the tour does not open again', !(await card.isVisible().catch(() => false)))
      const l2links = await anchorsTo(page, /\/learn\/0[13]\/?$/)
      info('L2: links to Lessons 1 and 3', l2links.map((a) => `${a.href} [${a.text}]${a.vis ? '' : ' hidden'} in ${a.where}`).join(' | '))
      check('L2: links back to Lesson 1', l2links.some((a) => /01\/?$/.test(a.href)))
      check('L2: no live link to Lesson 3 while it is held back', !l2links.some((a) => /03\/?$/.test(a.href)))
      const gate = page.locator('#gateBtn')
      if (await gate.count()) {
        await gate.scrollIntoViewIfNeeded(); await gate.click(); await page.waitForTimeout(800)
        await resetPeak(page)
        let play = page.locator('[data-play]:visible:not([disabled])').first()
        if (!(await play.count())) {
          const choice = page.locator('.choice[data-choice]:visible').first()
          await choice.scrollIntoViewIfNeeded(); await choice.click(); await page.waitForTimeout(600)
          play = page.locator('[data-play]:visible:not([disabled])').first()
        }
        await play.scrollIntoViewIfNeeded(); await play.click(); await page.waitForTimeout(1800)
        const a2 = await audio(page)
        check('L2: Turn sound on, then a play button, makes sound', !!a2 && a2.maxPeak > 0.01, fmtAudio(a2))
      } else info('L2: sound gate', 'none found')
      await page.locator('#bigPlay').scrollIntoViewIfNeeded()
      await page.locator('#bigPlay').click()
      const played2 = await page.waitForFunction(() => { const v = document.querySelector('video'); return !!v && v.currentTime > 1.5 }, null, { timeout: 25000 }).then(() => true).catch(() => false)
      check('L2: the episode plays', played2)
      await shot(page, 'L2-film')
      await page.evaluate(() => document.querySelector('video')?.pause())
      for (const vp of [PHONE, DESKTOP]) {
        await page.setViewportSize(vp); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500)
        await shot(page, `L2-top-${vp.width}`)
      }
      // the hub
      await page.goto(BASE + '/learn/', { timeout: 120000 })
      await page.waitForTimeout(2500)
      const hub = await anchorsTo(page, /\/learn\/\d\d\/?$/)
      // A page no worker served keeps a held-back lesson's entry in its markup, hidden (data-if-live); the site worker drops it.
      const live = [...new Set(hub.filter((a) => a.vis).map((a) => a.href.replace(/\/$/, '').slice(-2)))].sort()
      const held = [...new Set(hub.filter((a) => !a.vis).map((a) => a.href.replace(/\/$/, '').slice(-2)))].sort()
      check('Hub: shows links to Lessons 1 and 2 only', live.join(',') === '01,02', `shown ${live.join(',')} | hidden ${held.join(',')}`)
      await shot(page, 'hub-1440', true)
    } finally { await browser.close() }
  })

  // ---------- search: the served HTML with scripts off ----------
  await phase('search', async () => {
    const browser = await chromium.launch()
    const { page } = await newPage(browser, DESKTOP, { javaScriptEnabled: false })
    try {
      for (const [url, wantPrev, wantNext] of [['/learn/01', null, '02'], ['/learn/02', '01', '03']]) {
        await page.goto(BASE + url, { timeout: 60000 })
        const all = await anchorsTo(page, /\/learn\/(\d\d)?\/?$/)
        const hub = all.find((a) => /\/learn\/$/.test(a.href) && /Find Your Pitch/.test(a.text))
        check(`${url} served: breadcrumb links the hub`, !!hub, hub ? `${hub.text} in ${hub.where}` : all.map((a) => a.href).join(' '))
        if (wantPrev) check(`${url} served: links the previous lesson`, all.some((a) => a.href.replace(/\/$/, '').endsWith(wantPrev)))
        check(`${url} served: links the next lesson`, all.some((a) => a.href.replace(/\/$/, '').endsWith(wantNext)), all.filter((a) => /\d\d\/?$/.test(a.href)).map((a) => `${a.href} [${a.text}] in ${a.where}`).join(' | '))
        const ld = await page.$$eval('script[type="application/ld+json"]', (ss) => ss.map((s) => s.textContent || ''))
        const bc = ld.map((t) => { try { return JSON.parse(t) } catch { return null } }).flatMap((j) => (j && j['@graph']) || [j]).find((j) => j && j['@type'] === 'BreadcrumbList')
        info(`${url} served: BreadcrumbList`, bc ? bc.itemListElement.map((i) => i.name).join(' > ') : 'none')
        await shot(page, `served-${url.slice(-2)}-top`)
      }
      for (const [url, lesson] of [['/mirror', '01'], ['/vocal-range-test', '01'], ['/ear-lab', '02']]) {
        await page.goto(BASE + url, { timeout: 60000 })
        const links = await anchorsTo(page, new RegExp(`/learn/${lesson}/?$`))
        const inText = links.filter((a) => !/^nav/.test(a.where))
        check(`${url} served: its text links Lesson ${Number(lesson)}`, inText.length > 0, links.map((a) => `[${a.text}] in ${a.where}`).join(' | '))
        await shot(page, `served-${url.slice(1)}`, true)
      }
      await page.goto(BASE + '/learn/02', { timeout: 60000 })
    } finally { await browser.close() }
  })

  // ---------- misc pages ----------
  await phase('misc', async () => {
    const browser = await chromium.launch()
    const { page } = await newPage(browser, PHONE)
    try {
      await page.goto(BASE + '/karaoke-app', { timeout: 60000 })
      await page.waitForTimeout(1500)
      info('karaoke-app', `${await page.title()} | h1 "${await text(page.locator('h1'))}"`)
      await shot(page, 'karaoke-app')
      const r = await page.goto(BASE + '/no-such-page-here', { timeout: 60000 })
      await page.waitForTimeout(1500)
      info('a wrong address', `status ${r && r.status()} | ${(await text(page.locator('body'))).slice(0, 140)}`)
      await shot(page, 'not-found')
      // a room entry with scripts on: the app boots over the prelude
      await page.goto(BASE + '/ear-lab', { timeout: 120000 })
      await page.waitForTimeout(6000)
      await shot(page, 'ear-lab-booted')
    } finally { await browser.close() }
  })

  // ---------- B: desktop, a sliding voice: a clean read, then Start here ----------
  await phase('onbB', async () => {
    const browser = await launch(sweep)
    const { page } = await newPage(browser, DESKTOP)
    try {
      await toPlan(page, { voiceprint: true, label: 'B' })
      const twin = await text(beat(page, 'twin'))
      note(`B twin: ${twin}`)
      info('B: twin', twin.slice(0, 200))
      await shot(page, 'B-twin')
      await page.getByRole('button', { name: /^Continue$/ }).click()
      await page.waitForTimeout(1500)
      if (await beat(page, 'keep').isVisible().catch(() => false)) {
        info('B: keep', (await text(beat(page, 'keep'))).slice(0, 120))
        await shot(page, 'B-keep')
        await page.getByRole('button', { name: /Not now/ }).filter({ visible: true }).first().click()
      }
      const q = await answer(page, PICKS)
      await planChecks(page, q, 'B')
      await shot(page, 'B-plan-1440')
      await coverWhole(page, q, 'B 1440')
      for (const vp of TABLETS) { await page.setViewportSize(vp); await page.waitForTimeout(700); await shot(page, `B-plan-${vp.width}x${vp.height}`); await coverWhole(page, q, `B ${vp.width}x${vp.height}`) }
      await page.setViewportSize(PHONE); await page.waitForTimeout(700)
      await shot(page, 'B-plan-390')
      await page.setViewportSize(DESKTOP); await page.waitForTimeout(700)
      const urlBefore = page.url()
      await q.getByRole('button', { name: 'Start here', exact: true }).click()
      await page.waitForTimeout(4000)
      const tour = await page.locator('[role="dialog"]:visible').first().isVisible().catch(() => false)
      info('B: Start here opened', `${page.url().replace(BASE, '')} (from ${urlBefore.replace(BASE, '')})`)
      check('B: Start here opens its room without a tour', !tour, tour ? await text(page.locator('[role="dialog"]:visible')) : '')
      await shot(page, 'B-start-here')
      const a = await audio(page)
      info('B: audio in the room', fmtAudio(a))
    } finally { await browser.close() }
  })

  // ---------- C: tablet, no voiceprint, Show me around ----------
  await phase('onbC', async () => {
    const browser = await launch(steady)
    const { page } = await newPage(browser, { width: 820, height: 1180 })
    try {
      await toPlan(page, { voiceprint: false, label: 'C' })
      const q = await answer(page, PICKS)
      await planChecks(page, q, 'C')
      await shot(page, 'C-plan-820x1180')
      await coverWhole(page, q, 'C 820x1180')
      await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(700)
      await shot(page, 'C-plan-1024x768')
      await coverWhole(page, q, 'C 1024x768')
      const said = []
      const listen = (m) => said.push(`${m.type()} ${m.text().slice(0, 140)}`)
      page.on('console', listen)
      const t0 = Date.now()
      await q.getByRole('button', { name: 'Show me around' }).click()
      const d = page.locator('[role="dialog"][aria-modal="true"]:visible, [data-tour-step]:visible').first()
      const shown = await d.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
      info('C: Show me around, tour after', shown ? `${Date.now() - t0} ms` : 'none in 12 s')
      page.off('console', listen)
      info('C: console after Show me around', said.slice(0, 12).join(' || ') || 'nothing')
      info('C: Show me around opened', `${page.url().replace(BASE, '')} | ${shown ? (await text(d)).slice(0, 120) : 'no dialog'}`)
      check('C: Show me around opens Start here (Singing)', /#\/singing$/.test(page.url()), page.url().replace(BASE, ''))
      // Singing has no page tour (PAGE_TOURS); its tour is the Guide's Singing section, which the plan does not start.
      info('C: a tour on Singing after Show me around', shown ? 'yes' : 'no (Singing has no page tour; its tour is in the Guide)')
      await shot(page, 'C-show-me-around')
    } finally { await browser.close() }
  })

  // ---------- D: desktop, a voiceprint, Show me around into a room with a page tour ----------
  await phase('onbD', async () => {
    const browser = await launch(sweep)
    const { page } = await newPage(browser, DESKTOP)
    try {
      await toPlan(page, { voiceprint: true, label: 'D' })
      await page.getByRole('button', { name: /^Continue$/ }).click()
      await page.waitForTimeout(1500)
      if (await beat(page, 'keep').isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /Not now/ }).filter({ visible: true }).first().click()
      }
      const q = await answer(page, PICKS)
      const start = (await text(q)).match(/START HERE · ([A-Z' ]+)/)
      info('D: Start here is', start ? start[1].trim() : '?')
      const t0 = Date.now()
      await q.getByRole('button', { name: 'Show me around' }).click()
      const d = page.locator('[role="dialog"][aria-modal="true"]:visible').first()
      const shown = await d.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
      info('D: Show me around opened', `${page.url().replace(BASE, '')} | ${shown ? `${Date.now() - t0} ms: ${(await text(d)).slice(0, 120)}` : 'no dialog'}`)
      check('D: Show me around starts the room\'s tour', shown)
      await shot(page, 'D-show-me-around')
      if (shown) {
        const steps = (await text(d)).match(/(\d+)\s*(?:OF|of|\/)\s*(\d+)/)
        info('D: tour count', steps ? `${steps[1]} of ${steps[2]}` : (await text(d)).slice(0, 80))
      }
    } finally { await browser.close() }
  })

  note(`films served from the stub: ${films.length ? [...new Set(films)].join(', ') : 'none'}`)
  note(`blocked: ${[...blocked].map(([k, v]) => `${k} x${v}`).join(', ') || 'none'}`)
  note(`page errors (${errors.length}): ${errors.slice(0, 20).join(' || ')}`)
  const fails = checks.filter((c) => c.pass === false)
  note(`checks: ${checks.filter((c) => c.pass).length} pass, ${fails.length} fail, ${checks.filter((c) => c.pass === null).length} info`)
  fs.writeFileSync(path.join(OUT, 'walk.log'), log.join('\n') + '\n')
  fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify({ checks, blocked: [...blocked], films: [...new Set(films)], errors }, null, 1))
  process.exit(fails.length ? 1 : 0)
})()
