// app-check shared library: safe browser contexts, a supervised static
// server, layout probes and a report writer for MercuryPitch.
//
// Run every app-check script FROM A MERCURYPITCH CHECKOUT (cwd = repo root):
// Playwright and `serve` are resolved from that checkout's node_modules, so
// the scripts themselves can live anywhere (the skill folder, agent-out).
//
// Hard rules this file enforces rather than trusts:
//   - production hosts are refused as a base URL and aborted as requests;
//   - every request off the allowed hosts is aborted and recorded;
//   - the static server is spawned detached and killed by process group,
//     with SIGKILL escalation and a check that the port is free again.

import { spawn } from 'node:child_process'
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'

export const PROD_HOSTS = new Set([
  'mercurypitch.com',
  'www.mercurypitch.com',
  'api.mercurypitch.com',
  'about.mercurypitch.com',
])
export const DEV_HOSTS = new Set([
  'dev.mercurypitch.com',
  'api-dev.mercurypitch.com',
])
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
// Ports that belong to other people's long-running servers on maff's PC.
export const RESERVED_PORTS = new Set([4398, 8780, 4320, 3800, 3005, 4173])

export const VIEWPORTS = {
  phone: {
    // A phone user agent too: the app reads it (Settings > Display says
    // "Detected: desktop" under a desktop UA at phone size).
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    deviceScaleFactor: 1,
  },
}

export function repoRoot() {
  return resolve(process.env.REPO ?? process.cwd())
}

export function appVersion(repo = repoRoot()) {
  try {
    return JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).version
  } catch {
    return '0.0.0'
  }
}

/** @playwright/test from the checkout, never a global install. */
export function loadPlaywright(repo = repoRoot()) {
  const req = createRequire(join(repo, 'package.json'))
  return req('@playwright/test')
}

/** Throws unless the URL is local or dev. */
export function assertSafeBase(url) {
  const host = new URL(url).hostname
  if (PROD_HOSTS.has(host)) {
    throw new Error(`REFUSED: ${host} is production. Local or dev only.`)
  }
  if (!LOCAL_HOSTS.has(host) && !DEV_HOSTS.has(host)) {
    throw new Error(`REFUSED: ${host} is neither local nor dev.`)
  }
  return host
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {}
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (m) out[m[1]] = m[2] ?? true
  }
  return out
}

async function portFree(port) {
  return new Promise((done) => {
    const srv = net.createServer()
    srv.once('error', () => done(false))
    srv.once('listening', () => srv.close(() => done(true)))
    srv.listen(port, '127.0.0.1')
  })
}

/** First free port at or above `from`, skipping the reserved ones. */
export async function pickPort(from = 4470) {
  for (let p = from; p < from + 200; p++) {
    if (RESERVED_PORTS.has(p)) continue
    if (await portFree(p)) return p
  }
  throw new Error(`no free port from ${from}`)
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Serve a built dist folder with the checkout's own `serve` (clean URLs, so
 * /karaoke-night finds karaoke-night.html). Refuses a port that already
 * answers: an existing server may be another checkout's build.
 */
export async function startStatic({ dist, port, log }) {
  const repo = repoRoot()
  if (RESERVED_PORTS.has(port)) throw new Error(`port ${port} is reserved`)
  if (!(await portFree(port))) {
    throw new Error(
      `port ${port} is taken; never reuse a server you did not start`,
    )
  }
  if (log) mkdirSync(dirname(resolve(log)), { recursive: true })
  const fd = openSync(log ?? '/dev/null', 'a')
  const child = spawn(
    join(repo, 'node_modules/.bin/serve'),
    ['-l', `tcp://127.0.0.1:${port}`, '--no-request-logging', resolve(dist)],
    { detached: true, stdio: ['ignore', fd, fd] },
  )
  const pgid = child.pid
  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    try {
      process.kill(-pgid, 'SIGTERM')
    } catch {}
    for (let i = 0; i < 30 && alive(pgid); i++) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (alive(pgid)) {
      try {
        process.kill(-pgid, 'SIGKILL')
      } catch {}
    }
    const free = await portFree(port)
    console.log(`[server] stopped pgid ${pgid}; port ${port} free: ${free}`)
  }
  const onExit = () => {
    try {
      process.kill(-pgid, 'SIGKILL')
    } catch {}
  }
  process.once('exit', onExit)
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => {
      onExit()
      process.exit(130)
    })
  }
  const url = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url + '/')
      if (res.ok) {
        console.log(`[server] ${url} serving ${dist} (pgid ${pgid})`)
        return { url, pgid, stop }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  await stop()
  throw new Error(`server on ${port} never answered`)
}

/** Headless by default. HEADED=1 opens a window that Hyprland tucks away. */
export async function launch(pw) {
  const headed = process.env.HEADED === '1'
  return pw.chromium.launch({
    headless: !headed,
    args: headed ? ['--class=agent-browser'] : [],
  })
}

/**
 * A context with the app's own storage seeded and the network fenced.
 *  vp: 'phone' | 'desktop'; theme: 'light' | 'dark'
 *  returning: skip First Light and the survey (default true)
 *  testMode: set window.E2E_TEST_MODE (hides ambient popups; default true)
 *  timezoneId: the clock (default 'UTC'). On a consent build (the stub build,
 *    dev) the cookie bar opens on UTC and on any European clock
 *  consent: 'denied' | 'granted' answers the cookie bar before the page loads
 *    (default 'none': a consent build opens the bar, on a UTC clock too)
 *  storage: extra localStorage entries { key: value }
 *  allow: extra hostnames allowed through (dev hosts are allowed for a dev base)
 */
export async function openContext(browser, opts) {
  const {
    base,
    vp = 'desktop',
    theme = 'dark',
    returning = true,
    testMode = true,
    timezoneId = 'UTC',
    storage = {},
    allow = [],
    consent = 'none',
  } = opts
  const baseHost = assertSafeBase(base)
  const allowed = new Set([...LOCAL_HOSTS, baseHost, ...allow])
  if (DEV_HOSTS.has(baseHost)) for (const h of DEV_HOSTS) allowed.add(h)
  const ctx = await browser.newContext({
    ...VIEWPORTS[vp],
    colorScheme: theme === 'light' ? 'light' : 'dark',
    timezoneId,
    locale: 'en-GB',
    reducedMotion: 'reduce',
  })
  const version = appVersion()
  await ctx.addInitScript(
    ({ theme, returning, testMode, storage, version, consent }) => {
      if (testMode) window.E2E_TEST_MODE = true
      try {
        if (sessionStorage.getItem('app-check.seeded') === '1') return
        sessionStorage.setItem('app-check.seeded', '1')
        localStorage.setItem('pitchperfect_theme', theme)
        localStorage.setItem('pitchperfect_theme_source', 'manual')
        if (returning) {
          localStorage.setItem('pitchperfect_welcome_version', version)
          localStorage.setItem('pitchperfect_onboarding_done', '1')
          localStorage.setItem('pitchperfect_survey_seen', '1')
        }
        if (consent === 'denied' || consent === 'granted') {
          localStorage.setItem(
            'mp.consent.v1',
            JSON.stringify({ status: consent, at: Date.now() }),
          )
        }
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v)
      } catch {}
    },
    { theme, returning, testMode, storage, version, consent },
  )
  const blocked = []
  const violations = []
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.protocol === 'data:' || u.protocol === 'blob:')
      return route.continue()
    if (PROD_HOSTS.has(u.hostname)) {
      violations.push(u.href.slice(0, 160))
      return route.abort()
    }
    if (allowed.has(u.hostname)) return route.fallback()
    blocked.push(u.href.slice(0, 160))
    return route.abort()
  })
  ctx.appCheck = { blocked, violations }
  return ctx
}

/**
 * Answer the app's API from a table instead of a server. Register AFTER
 * openContext (later routes win). Unlisted /api paths get a 503 so the app
 * takes its offline path. `table` maps 'METHOD /api/path' or '/api/path' to
 * a JSON body, or to { status, body }.
 */
export async function stubApi(ctx, apiOrigin, table) {
  const hits = []
  await ctx.route(`${apiOrigin}/api/**`, (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const key = `${req.method()} ${path}`
    const hit = table[key] ?? table[path]
    hits.push(`${key} -> ${hit === undefined ? 503 : 'stub'}`)
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    }
    if (req.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers })
    if (hit === undefined) {
      return route.fulfill({
        status: 503,
        headers,
        contentType: 'application/json',
        body: '{"error":"app-check stub: not stubbed"}',
      })
    }
    const isWrapped =
      hit && typeof hit === 'object' && 'status' in hit && 'body' in hit
    return route.fulfill({
      status: isWrapped ? hit.status : 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(isWrapped ? hit.body : hit),
    })
  })
  return hits
}

/** A token the client accepts as signed in (it only decodes `exp`). Fake:
 *  unsigned, for stubbed APIs only. Never send it to a real server. */
export function fakeToken(sub = 'app-check-user') {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub, exp })}.app-check`
}

/** Watch errors and console noise for the report. */
export function watchPage(page) {
  const errors = []
  page.on('pageerror', (e) =>
    errors.push(`pageerror: ${String(e).slice(0, 200)}`),
  )
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`)
  })
  return errors
}

/** Wait for load, fonts, and 500 ms without DOM mutations (5 s cap). */
export async function settle(page, quietMs = 500, capMs = 5000) {
  await page.waitForLoadState('load').catch(() => {})
  await page
    .evaluate(
      ({ quietMs, capMs }) =>
        new Promise((done) => {
          let timer
          const start = performance.now()
          const finish = () => {
            obs.disconnect()
            done()
          }
          const obs = new MutationObserver(() => {
            clearTimeout(timer)
            if (performance.now() - start > capMs) return finish()
            timer = setTimeout(finish, quietMs)
          })
          obs.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          })
          timer = setTimeout(finish, quietMs)
          document.fonts?.ready.then(() => {})
        }),
      { quietMs, capMs },
    )
    .catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
}

// ── In-page probes ─────────────────────────────────────────────────────
// Each runs inside the page; keep them free of closures over Node values.

/** Generic layout probe for the whole visible page. */
export async function probeLayout(page, { phone }) {
  return page.evaluate((phone) => {
    // The layout viewport, not innerWidth: a mobile browser zooms out to fit
    // an overflowing page, and innerWidth then grows to the content's width.
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const describe = (el) => {
      if (!el || el.nodeType !== 1) return String(el)
      const parts = []
      let n = el
      for (let i = 0; i < 3 && n && n !== document.body; i++) {
        let s = n.tagName.toLowerCase()
        if (n.id) s += `#${n.id}`
        const testId =
          n.getAttribute('data-testid') || n.getAttribute('data-tour')
        if (testId)
          s += `[${n.hasAttribute('data-testid') ? 'data-testid' : 'data-tour'}=${testId}]`
        const cls = [...n.classList]
          .filter((c) => !/^_|[A-Za-z0-9]{5,}_[a-z0-9]{5}$/.test(c))
          .slice(0, 2)
        if (cls.length) s += '.' + cls.join('.')
        parts.unshift(s)
        n = n.parentElement
      }
      return parts.join(' > ')
    }
    const text = (el) =>
      (el.innerText || el.getAttribute('aria-label') || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 60)
    const visible = (el) => {
      const cs = getComputedStyle(el)
      if (
        cs.visibility === 'hidden' ||
        cs.display === 'none' ||
        Number(cs.opacity) === 0
      )
        return false
      const r = el.getBoundingClientRect()
      // a zoomed-out phone page lays fixed layers out past the layout viewport
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < Math.max(vh, window.innerHeight) &&
        r.left < Math.max(vw, window.innerWidth)
      )
    }
    const clipsX = (el) => {
      for (
        let n = el.parentElement;
        n && n !== document.documentElement;
        n = n.parentElement
      ) {
        const ox = getComputedStyle(n).overflowX
        if (ox !== 'visible') return true
      }
      return false
    }
    const all = [...document.body.querySelectorAll('*')]

    // 1. sideways scroll
    const docW = document.documentElement.scrollWidth
    const bodyW = document.body.scrollWidth
    const wide = []
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (
        r.right > vw + 1 &&
        !clipsX(el) &&
        getComputedStyle(el).position !== 'fixed'
      ) {
        wide.push({
          el: describe(el),
          right: Math.round(r.right),
          text: text(el),
        })
      }
    }
    // keep the outermost offenders only
    const overflow = {
      docScrollWidth: docW,
      bodyScrollWidth: bodyW,
      viewportWidth: vw,
      scrollsSideways: Math.max(docW, bodyW) > vw + 1,
      offenders: wide.slice(0, 8),
    }

    // 2. clipped text
    const clipped = []
    for (const el of all) {
      if (!visible(el)) continue
      if (/^(INPUT|TEXTAREA|SELECT|svg|CANVAS|VIDEO|IMG)$/i.test(el.tagName))
        continue
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      )
      if (!hasText) continue
      if (el.clientWidth <= 2 || el.clientHeight <= 2) continue // visually hidden text for screen readers
      const cs = getComputedStyle(el)
      if (cs.clipPath !== 'none' || (cs.clip && cs.clip !== 'auto')) continue
      const ellipsis = cs.textOverflow === 'ellipsis'
      const clampX =
        cs.overflowX === 'hidden' || cs.overflowX === 'clip' || ellipsis
      const clampY =
        cs.webkitLineClamp !== 'none' &&
        cs.webkitLineClamp !== '' &&
        cs.webkitLineClamp !== undefined
      const cutX = clampX && el.scrollWidth > el.clientWidth + 1
      const cutY =
        (clampY || cs.overflowY === 'hidden') &&
        el.scrollHeight > el.clientHeight + 2
      if (cutX || cutY) {
        clipped.push({
          el: describe(el),
          text: text(el),
          how: cutX ? (ellipsis ? 'ellipsis' : 'cut-x') : 'cut-y',
          scroll: [el.scrollWidth, el.scrollHeight],
          client: [el.clientWidth, el.clientHeight],
        })
      }
    }

    // 3. floating layers that overlap each other
    const floats = []
    for (const el of all) {
      const pos = getComputedStyle(el).position
      if (pos !== 'fixed' && pos !== 'sticky') continue
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width * r.height > 0.6 * vw * vh) continue // shells and backdrops
      if (
        getComputedStyle(el).pointerEvents === 'none' &&
        !el.innerText?.trim()
      )
        continue
      floats.push({ el, r })
    }
    const overlaps = []
    for (let i = 0; i < floats.length; i++) {
      for (let j = i + 1; j < floats.length; j++) {
        const a = floats[i]
        const b = floats[j]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (w > 2 && h > 2) {
          overlaps.push({
            a: describe(a.el),
            b: describe(b.el),
            w: Math.round(w),
            h: Math.round(h),
            aText: text(a.el).slice(0, 30),
            bText: text(b.el).slice(0, 30),
          })
        }
      }
    }

    // 4. tap targets (phone): effective hit box by hit-testing outwards
    const targets = []
    if (phone) {
      const sel =
        'a[href],button,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="switch"],[role="checkbox"],input:not([type="hidden"]),select,textarea,summary,label[for]'
      for (const el of document.querySelectorAll(sel)) {
        if (!visible(el) || el.disabled) continue
        if (el.closest('[aria-hidden="true"],[inert]')) continue
        const r = el.getBoundingClientRect()
        if (r.top < 0 || r.bottom > vh) continue
        // WCAG 2.5.8 exception: a link inside a sentence
        if (
          el.tagName === 'A' &&
          getComputedStyle(el).display === 'inline' &&
          el.parentElement &&
          el.parentElement.innerText.trim().length > text(el).length + 10
        )
          continue
        if (r.width >= 44 && r.height >= 44) continue
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const hits = (x, y) => {
          const t = document.elementFromPoint(x, y)
          return (
            t !== null &&
            (t === el ||
              el.contains(t) ||
              (el.tagName === 'INPUT' &&
                t.tagName === 'LABEL' &&
                t.control === el))
          )
        }
        if (!hits(cx, cy)) continue // covered; reported by the overlap checks
        const reach = (dx, dy) => {
          let n = 0
          for (let s = 1; s <= 40; s++) {
            const x = cx + dx * s
            const y = cy + dy * s
            if (x < 0 || y < 0 || x >= vw || y >= vh || !hits(x, y)) break
            n = s
          }
          return n
        }
        const hitW = reach(-1, 0) + reach(1, 0) + 1
        const hitH = reach(0, -1) + reach(0, 1) + 1
        if (hitW >= 44 && hitH >= 44) continue
        targets.push({
          el: describe(el),
          text: text(el),
          box: [Math.round(r.width), Math.round(r.height)],
          hit: [hitW, hitH],
          under24: hitW < 24 || hitH < 24,
        })
      }
    }

    // 5. form controls in the app font
    const bodyFont = getComputedStyle(document.body).fontFamily
    const fonts = []
    for (const el of document.querySelectorAll(
      'button,input,select,textarea',
    )) {
      if (!visible(el)) continue
      const f = getComputedStyle(el).fontFamily
      const first = f.split(',')[0].replace(/["']/g, '').trim().toLowerCase()
      if (
        /^(arial|helvetica|system-ui|-apple-system|sans-serif|times|times new roman)$/.test(
          first,
        ) &&
        f !== bodyFont
      ) {
        fonts.push({ el: describe(el), text: text(el), font: f.slice(0, 60) })
      }
    }

    return {
      url: location.href,
      theme: document.documentElement.getAttribute('data-theme'),
      bodyFont: bodyFont.slice(0, 80),
      overflow,
      clipped: clipped.slice(0, 25),
      clippedCount: clipped.length,
      overlaps: overlaps.slice(0, 15),
      targets: targets.slice(0, 30),
      targetCount: targets.length,
      under24Count: targets.filter((t) => t.under24).length,
      fonts: fonts.slice(0, 10),
      fontCount: fonts.length,
    }
  }, phone)
}

/**
 * Tab through the page and check every stop shows a visible change.
 * Compares each element's styles (and two ancestors') focused against
 * unfocused, the unfocused snapshot taken after the next Tab moves on.
 */
export async function probeFocus(page, { stops = 20 } = {}) {
  await page.evaluate(() => {
    document.activeElement?.blur?.()
    window.__acFocus = { prev: null, prevStyles: null, results: [] }
  })
  await page.mouse.click(1, 1).catch(() => {})
  const snap = () =>
    page.evaluate(() => {
      const keys = [
        'outlineStyle',
        'outlineWidth',
        'outlineColor',
        'outlineOffset',
        'boxShadow',
        'borderTopColor',
        'borderBottomColor',
        'backgroundColor',
        'color',
        'textDecorationLine',
      ]
      const styleOf = (el) => {
        const out = []
        for (let n = el, i = 0; n && i < 3; n = n.parentElement, i++) {
          const cs = getComputedStyle(n)
          out.push(keys.map((k) => cs[k]).join('|'))
        }
        return out.join('#')
      }
      const describe = (el) => {
        let s = el.tagName.toLowerCase()
        if (el.id) s += `#${el.id}`
        const label = (
          el.getAttribute('aria-label') ||
          el.innerText ||
          el.value ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40)
        return `${s} "${label}"`
      }
      const st = window.__acFocus
      if (st.prev && st.prev !== document.activeElement) {
        const unfocused = styleOf(st.prev)
        st.results.push({
          el: describe(st.prev),
          visible: unfocused !== st.prevStyles,
        })
      }
      const el = document.activeElement
      if (!el || el === document.body) {
        st.prev = null
        return false
      }
      st.prev = el
      st.prevStyles = styleOf(el)
      return true
    })
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(180)
    await snap()
  }
  await page.keyboard.press('Tab')
  await page.waitForTimeout(180)
  await snap()
  return page.evaluate(() => window.__acFocus.results)
}

/** WCAG contrast of an element's text over its composited background. */
export async function contrastOf(locator) {
  return locator.evaluate((el) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const over = (top, under) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    })
    const layers = []
    let approx = false
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage !== 'none') approx = true
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) layers.push(c)
      if (c && c.a === 1) break
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg)
    const fg = over(parse(getComputedStyle(el).color), bg)
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    return {
      ratio: Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100,
      approx,
      color: getComputedStyle(el).color,
    }
  })
}

/** Rect of a locator, or null. */
export async function rectOf(locator) {
  if ((await locator.count()) === 0) return null
  const b = await locator.first().boundingBox()
  return (
    b && {
      top: b.y,
      bottom: b.y + b.height,
      left: b.x,
      right: b.x + b.width,
      w: b.width,
      h: b.height,
    }
  )
}

export function intersect(a, b) {
  if (!a || !b) return 0
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? Math.round(w * h) : 0
}

/** Is the topmost element at the centre and in each corner of `locator` the
 *  element itself? The corner samples sit inside a rounded corner. */
export async function onTop(locator) {
  return locator.first().evaluate((el) => {
    // elementFromPoint skips pointer-events: none, and toasts use it: lend
    // the element hit-testing for the measurement, then put it back.
    const prev = el.style.getPropertyValue('pointer-events')
    const prevPri = el.style.getPropertyPriority('pointer-events')
    el.style.setProperty('pointer-events', 'auto', 'important')
    const r = el.getBoundingClientRect()
    // A corner sample sits 4 px in from the edges, or further in on a rounded
    // corner. 4 px in from a 14.4 px radius (the cookie bar) lies outside the
    // shape, where elementFromPoint sees what is behind the element. A point
    // a * R in from both edges of a corner of radius R is inside it from
    // a = 0.293 on; 0.35 leaves room.
    const cs = getComputedStyle(el)
    // A radius left as a mixed calc() reads as the roundest the box allows,
    // which never puts a sample outside the shape.
    const roundest = Math.min(r.width, r.height) / 2
    const len = (s, side) => {
      const n = s.endsWith('%') ? (parseFloat(s) / 100) * side : parseFloat(s)
      return Number.isFinite(n) ? n : roundest
    }
    const radii = [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomRightRadius',
      'borderBottomLeftRadius',
    ].map((prop) => {
      const [h, v = h] = cs[prop].split(' ')
      return [len(h, r.width), len(v, r.height)]
    })
    // CSS shrinks every radius by one factor when two would overlap (a
    // 9999px pill is as round as its box allows); do the same here.
    const shrink = (side, sum) => (sum > side ? side / sum : 1)
    const [tl, tr, br, bl] = radii
    const f = Math.min(
      shrink(r.width, tl[0] + tr[0]),
      shrink(r.width, bl[0] + br[0]),
      shrink(r.height, tl[1] + bl[1]),
      shrink(r.height, tr[1] + br[1]),
    )
    // how far in from each corner (x, y) the sample sits
    const [tlIn, trIn, brIn, blIn] = radii.map(([rx, ry]) => [
      Math.min(Math.max(4, 0.35 * rx * f), r.width / 2),
      Math.min(Math.max(4, 0.35 * ry * f), r.height / 2),
    ])
    const pts = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + tlIn[0], r.top + tlIn[1]],
      [r.right - trIn[0], r.top + trIn[1]],
      [r.right - brIn[0], r.bottom - brIn[1]],
      [r.left + blIn[0], r.bottom - blIn[1]],
    ]
    const ok = pts.every(([x, y]) => {
      const t = document.elementFromPoint(x, y)
      return t !== null && (t === el || el.contains(t))
    })
    if (prev) el.style.setProperty('pointer-events', prev, prevPri)
    else el.style.removeProperty('pointer-events')
    return ok
  })
}

// ── Report ──────────────────────────────────────────────────────────────

export class Report {
  constructor(outDir, title) {
    this.outDir = resolve(outDir)
    this.title = title
    this.items = []
    mkdirSync(this.outDir, { recursive: true })
  }
  shot(name) {
    return join(this.outDir, `${name.replace(/[^a-z0-9._-]+/gi, '-')}.png`)
  }
  add(id, status, summary, { evidence = [], details } = {}) {
    this.items.push({ id, status, summary, evidence, details })
    console.log(`${status.padEnd(5)} ${id}: ${summary}`)
  }
  write() {
    const counts = { PASS: 0, FAIL: 0, WARN: 0, INFO: 0, SKIP: 0 }
    for (const i of this.items) counts[i.status] = (counts[i.status] ?? 0) + 1
    writeFileSync(
      join(this.outDir, 'report.json'),
      JSON.stringify({ title: this.title, counts, items: this.items }, null, 2),
    )
    const lines = [
      this.title,
      `PASS ${counts.PASS}  FAIL ${counts.FAIL}  WARN ${counts.WARN}  INFO ${counts.INFO}  SKIP ${counts.SKIP}`,
      '',
    ]
    for (const i of this.items) {
      lines.push(`${i.status} ${i.id}: ${i.summary}`)
      for (const e of i.evidence) lines.push(`    evidence: ${e}`)
    }
    writeFileSync(join(this.outDir, 'report.txt'), lines.join('\n') + '\n')
    console.log(`\n${lines[1]}\nreport: ${join(this.outDir, 'report.txt')}`)
    return counts
  }
}

/** Effective hit box of a control: how far taps at its centre row and
 *  column still land on it. Counts pseudo-element hit areas, which a
 *  bounding box misses.
 *
 *  It looks `maxReach` px either way (60 unless told otherwise), so a hit of
 *  2 * maxReach + 1 (121 by default) means "at least that". `capped` says,
 *  per axis, whether a side ran into the limit; pass a larger `maxReach` to
 *  measure further. */
export async function hitBox(locator, { maxReach = 60 } = {}) {
  return locator.first().evaluate((el, maxReach) => {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const on = (x, y) => {
      const t = document.elementFromPoint(x, y)
      return t !== null && (t === el || el.contains(t))
    }
    if (!on(cx, cy))
      return {
        box: [r.width, r.height],
        hit: [0, 0],
        capped: [false, false],
        covered: true,
      }
    const reach = (dx, dy) => {
      let n = 0
      for (let s = 1; s <= maxReach; s++) {
        if (!on(cx + dx * s, cy + dy * s)) break
        n = s
      }
      return n
    }
    const [left, right, up, down] = [
      reach(-1, 0),
      reach(1, 0),
      reach(0, -1),
      reach(0, 1),
    ]
    return {
      box: [Math.round(r.width), Math.round(r.height)],
      hit: [left + right + 1, up + down + 1],
      capped: [
        left === maxReach || right === maxReach,
        up === maxReach || down === maxReach,
      ],
      covered: false,
    }
  }, maxReach)
}

/** Focus `locator` by keyboard (Shift+Tab then Tab), so :focus-visible
 *  matches as it would for a keyboard user. */
export async function keyboardFocus(page, locator) {
  await locator.first().focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(150)
  return locator.first().evaluate((el) => document.activeElement === el)
}

/** Outline and ring styles of an element, for focus checks. */
export async function ringOf(locator) {
  return locator.first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      outlineStyle: cs.outlineStyle,
      outlineWidth: parseFloat(cs.outlineWidth),
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
    }
  })
}
