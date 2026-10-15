#!/usr/bin/env node
// app-check: the visible changes of web 0.9.18 (#908, #1009, #1014).
// An example of a per-release check file: copy it, keep the helpers, swap
// the cases. Each case names its PR, runs at the viewports and themes it
// matters at, and leaves a screenshot per verdict.
//
// Two builds of the commit under test, made from a MercuryPitch checkout:
//   dist-local  local mode, no API (the build:tours env)
//   dist-stub   consent preview (the build:dev env) with the API pointed at
//               http://127.0.0.1:59999, which only this script answers
// Run from that checkout:
//   node <skill>/scripts/release-0.9.18.mjs --local=dist-local --stub=dist-stub --out=<dir>
// Or against dev for the cases that need its real API (read-only, signed out):
//   node <skill>/scripts/release-0.9.18.mjs --dev=https://dev.mercurypitch.com --out=<dir> --only=gift

import { Report, contrastOf, fakeToken, hitBox, intersect, keyboardFocus, launch, loadPlaywright, onTop, openContext, parseArgs, pickPort, rectOf, ringOf, settle, startStatic, stubApi, } from './lib.mjs'
import { join } from 'node:path'

const args = parseArgs()
if (!args.out) {
  console.error('--out=<dir> is required')
  process.exit(2)
}
const only = args.only ? String(args.only).split(',') : null
const want = (group) => only === null || only.includes(group)
const report = new Report(args.out, 'app-check: web 0.9.18 visible changes')
const pw = loadPlaywright()
const browser = await launch(pw)
const servers = []
const STUB_API = 'http://127.0.0.1:59999'

// What dev's API answered on 2026-10-15 for GET /api/billing/promo/featured.
const FEATURED = {
  promo: {
    code: 'LAUNCH',
    credits: 5,
    expiresAt: '2027-01-01T23:59:59.000Z',
    offer: { goal: 5, deadline: '2026-10-29T23:59:59.999Z', bonusCredits: 30 },
  },
}
// An unconfirmed password account, answered only by the in-browser stub.
const ME_UNVERIFIED = {
  user: {
    id: 'app-check-user',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    authProvider: 'password',
    email: 'app-check@example.test',
    emailVerified: false,
    lastLoginAt: null,
    isTestAccount: true,
    testAccountExpiresAt: null,
  },
  profile: null,
}
const OFFER_RE =
  /Use all 5 by \d{1,2} October and your next credit pack comes with 30 extra credits\./

async function serve(dist) {
  const port = await pickPort(4470 + servers.length * 3)
  const s = await startStatic({
    dist,
    port,
    log: join(args.out, `server-${port}.log`),
  })
  servers.push(s)
  return s.url
}

async function shot(page, name, locator) {
  const path = report.shot(name)
  if (locator) {
    const b = await locator
      .first()
      .boundingBox()
      .catch(() => null)
    if (b) {
      const pad = 24
      const vp = page.viewportSize()
      const x = Math.max(0, b.x - pad)
      const y = Math.max(0, b.y - pad)
      await page.screenshot({
        path,
        clip: {
          x,
          y,
          width: Math.min(vp.width - x, b.width + pad * 2),
          height: Math.min(vp.height - y, b.height + pad * 2),
        },
      })
      return path
    }
  }
  await page.screenshot({ path })
  return path
}

async function withPage(opts, fn) {
  const ctx = await openContext(browser, opts)
  if (opts.stub) await stubApi(ctx, STUB_API, opts.stub)
  const page = await ctx.newPage()
  try {
    return await fn(page, ctx)
  } finally {
    if (ctx.appCheck.violations.length) {
      report.add(
        `production-requests`,
        'FAIL',
        ctx.appCheck.violations.join(' '),
      )
    }
    await ctx.close()
  }
}

const SHARED = (count, kind) =>
  JSON.stringify(
    Array.from({ length: count }, (_, i) => ({
      id: `app-check-${kind}-${i}`,
      name: `Shared ${kind} ${i + 1}`,
      author: 'app-check fixture',
      date: 1_700_000_000_000 + i,
      items: [
        {
          id: 1,
          note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
          duration: 1,
          startBeat: 0,
        },
      ],
      results: [80],
    })),
  )

async function seedSong(page, base) {
  await page.goto(base + '/')
  await page.waitForFunction(() => window.__pp?.appStore !== undefined, null, {
    timeout: 20000,
  })
  await page.evaluate(async () => {
    const store = window.__pp.appStore
    await store.initSessionStore()
    await store.importUvrSessionDurable({
      sessionId: 'app-check-song',
      status: 'completed',
      progress: 100,
      originalFile: { name: 'App check song', size: 0, mimeType: 'audio/wav' },
      outputs: {
        vocal:
          'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQIAAAAAAA==',
      },
      processingMode: 'server',
      provider: 'examples',
      createdAt: Date.now(),
    })
  })
}

try {
  const local = args.local ? await serve(args.local) : null
  const stub = args.stub ? await serve(args.stub) : null

  // ── #908 ──────────────────────────────────────────────────────────────
  if (local && want('908')) {
    for (const theme of ['light', 'dark']) {
      // Settings dropdown focus ring (desktop: keyboard users)
      await withPage({ base: local, vp: 'desktop', theme }, async (page) => {
        await page.goto(local + '/#/settings/practice')
        await settle(page)
        const sel = page.locator('#pitch-algorithm-select')
        const focused = await keyboardFocus(page, sel)
        const ring = await ringOf(sel)
        const ev = await shot(
          page,
          `908-settings-select-focus-desktop-${theme}`,
          sel,
        )
        const ok =
          focused && ring.outlineStyle === 'solid' && ring.outlineWidth >= 2
        report.add(
          `908 settings-select-focus desktop ${theme}`,
          ok ? 'PASS' : 'FAIL',
          `focused=${focused}, outline ${ring.outline}, offset ${ring.outlineOffset}`,
          { evidence: [ev] },
        )
        // form controls in the app font
        const fonts = await page.evaluate(() => ({
          body: getComputedStyle(document.body).fontFamily,
          select: getComputedStyle(
            document.querySelector('#pitch-algorithm-select'),
          ).fontFamily,
          range: getComputedStyle(
            document.querySelector('#set-min-confidence') ?? document.body,
          ).fontFamily,
        }))
        report.add(
          `908 control-font settings desktop ${theme}`,
          fonts.select === fonts.body && fonts.range === fonts.body
            ? 'PASS'
            : 'FAIL',
          `body "${fonts.body.slice(0, 40)}", select "${fonts.select.slice(0, 40)}", slider "${fonts.range.slice(0, 40)}"`,
          { evidence: [ev] },
        )
      })
      // Karaoke upload zone focus ring
      await withPage({ base: local, vp: 'desktop', theme }, async (page) => {
        await page.goto(local + '/#/karaoke')
        await settle(page)
        await page.getByTestId('uvr-tab-upload').click()
        const input = page.locator('#uvr-file-input')
        const zone = page.locator('.upload-zone', { has: input })
        const focused = await keyboardFocus(page, input)
        const ring = await ringOf(zone)
        const ev = await shot(
          page,
          `908-upload-zone-focus-desktop-${theme}`,
          zone,
        )
        const ok =
          focused && ring.outlineStyle === 'solid' && ring.outlineWidth >= 2
        report.add(
          `908 upload-zone-focus desktop ${theme}`,
          ok ? 'PASS' : 'FAIL',
          `input focused=${focused}, zone outline ${ring.outline}`,
          { evidence: [ev] },
        )
      })
      // Community tab labels whole on a phone
      await withPage(
        {
          base: local,
          vp: 'phone',
          theme,
          storage: {
            pp_shared_melodies: SHARED(23, 'melody'),
            pp_shared_sessions: SHARED(12, 'session'),
          },
        },
        async (page) => {
          await page.goto(local + '/#/community')
          await settle(page)
          const tabs = page.locator('.community-share-tab .community-tabs')
          const labels = await tabs.locator('.tab-name').evaluateAll((els) =>
            els.map((el) => ({
              text: el.textContent.trim(),
              whole: el.scrollWidth <= el.clientWidth + 1,
              ellipsis: getComputedStyle(el).textOverflow,
            })),
          )
          const ev = await shot(page, `908-community-tabs-phone-${theme}`, tabs)
          const bad = labels.filter((l) => !l.whole || /…|\.\.\./.test(l.text))
          report.add(
            `908 community-labels phone ${theme}`,
            labels.length >= 2 && bad.length === 0 ? 'PASS' : 'FAIL',
            labels
              .map((l) => `"${l.text}"${l.whole ? '' : ' CLIPPED'}`)
              .join(', ') || 'no labels found',
            { evidence: [ev] },
          )
        },
      )
      // Song card menu 44 px and MIDI stem label contrast
      await withPage({ base: local, vp: 'phone', theme }, async (page) => {
        await seedSong(page, local)
        await page.goto(local + '/#/karaoke')
        await settle(page)
        const card = page
          .locator('.uvr-session-result')
          .filter({ hasText: 'App check song' })
        const menu = card.getByRole('button', {
          name: 'More actions for this song',
        })
        await menu.first().scrollIntoViewIfNeeded()
        const hb = await hitBox(menu)
        const ev = await shot(page, `908-song-menu-phone-${theme}`, card)
        report.add(
          `908 song-menu-target phone ${theme}`,
          hb.hit[0] >= 44 && hb.hit[1] >= 44 ? 'PASS' : 'FAIL',
          `drawn ${hb.box.join('x')} px, taps land across ${hb.hit.join('x')} px${hb.covered ? ' (covered)' : ''}`,
          { evidence: [ev] },
        )
        const midi = card.locator('.stem-pill-midi')
        if ((await midi.count()) === 0) {
          report.add(
            `908 midi-label-contrast ${theme}`,
            'SKIP',
            'no MIDI stem pill on the seeded card',
          )
        } else {
          await midi.first().scrollIntoViewIfNeeded()
          await page.mouse.move(1, 1)
          const rest = await contrastOf(midi)
          await midi
            .first()
            .hover()
            .catch(() => {})
          await page.waitForTimeout(250)
          const hover = await contrastOf(midi)
          const mev = await shot(page, `908-midi-label-${theme}`, midi)
          const ok = rest.ratio >= 4.5 && hover.ratio >= 4.5
          report.add(
            `908 midi-label-contrast ${theme}`,
            ok ? 'PASS' : 'FAIL',
            `resting ${rest.ratio}:1, hovered ${hover.ratio}:1 (text ${rest.color})${rest.approx ? ', background has an image: approximate' : ''}`,
            { evidence: [mev] },
          )
        }
      })
      // Karaoke Night's own controls: do they get the app font too?
      await withPage({ base: local, vp: 'desktop', theme }, async (page) => {
        await page.goto(local + '/karaoke-night')
        await settle(page)
        const f = await page.evaluate(() => {
          const body = getComputedStyle(document.body).fontFamily
          const btns = [...document.querySelectorAll('button')].filter(
            (b) => b.offsetWidth > 0,
          )
          const arial = btns.filter((b) =>
            /^\s*arial/i.test(getComputedStyle(b).fontFamily),
          )
          return {
            body,
            total: btns.length,
            arial: arial.map((b) =>
              (b.innerText || b.getAttribute('aria-label') || '')
                .trim()
                .slice(0, 30),
            ),
          }
        })
        const ev = await shot(
          page,
          `908-karaoke-night-controls-desktop-${theme}`,
        )
        // Outside #908: its fix is app.css, which Karaoke Night does not load.
        report.add(
          `908 control-font karaoke-night desktop ${theme}`,
          f.arial.length ? 'WARN' : 'PASS',
          f.arial.length
            ? `${f.arial.length} of ${f.total} buttons in Arial while the page body is "${f.body.slice(0, 40)}": ${f.arial.slice(0, 5).join(', ')}`
            : `all ${f.total} buttons in the page font`,
          { evidence: [ev] },
        )
      })
    }
  }

  // ── #1009: the foot of a phone screen ──────────────────────────────────
  // Signed out, so dev can run it too: dev shows the cookie bar on a European clock.
  const footBases = []
  if (stub && want('1009'))
    footBases.push({ base: stub, label: 'stub', stub: {} })
  if (args.dev && want('1009'))
    footBases.push({ base: String(args.dev), label: 'dev' })
  for (const fb of footBases) {
    for (const theme of ['light', 'dark']) {
      // cookie bar vs tab bar, and a toast raised under both
      await withPage(
        {
          base: fb.base,
          vp: 'phone',
          theme,
          timezoneId: 'Europe/Zagreb',
          stub: fb.stub,
          storage: {
            'mp:gauthPending': JSON.stringify({
              nonce: 'app-check-nonce',
              expiresAt: Date.now() + 600_000,
            }),
          },
        },
        async (page) => {
          await page.goto(
            fb.base + '/#gauth_error=access_denied&gauth_nonce=app-check-nonce',
          )
          await settle(page)
          const banner = page.getByRole('dialog', { name: 'Cookie consent' })
          const tabbar = page.locator('nav[data-tour="mobile-tabbar"]')
          const toast = page
            .locator('[role="alert"],[role="status"]')
            .filter({ hasText: 'Google sign-in failed' })
          const [rb, rt, rToast] = [
            await rectOf(banner),
            await rectOf(tabbar),
            await rectOf(toast),
          ]
          const ev = await shot(
            page,
            `1009-${fb.label}-cookie-bar-tabbar-toast-phone-${theme}`,
          )
          if (!rb) {
            report.add(
              `1009 ${fb.label} cookie-bar-shows phone ${theme}`,
              'FAIL',
              'no cookie bar on a consent-preview build with a Europe/Zagreb clock',
              { evidence: [ev] },
            )
            return
          }
          report.add(
            `1009 ${fb.label} cookie-bar-vs-tabbar phone ${theme}`,
            rt && intersect(rb, rt) === 0 ? 'PASS' : 'FAIL',
            rt
              ? `banner ${Math.round(rb.top)}-${Math.round(rb.bottom)}, tab bar ${Math.round(rt.top)}-${Math.round(rt.bottom)}, overlap ${intersect(rb, rt)} px2`
              : 'no tab bar found',
            { evidence: [ev] },
          )
          const toastTop = rToast ? await onTop(toast) : false
          report.add(
            `1009 ${fb.label} toast-vs-cookie-bar phone ${theme}`,
            rToast && intersect(rb, rToast) === 0 && toastTop ? 'PASS' : 'FAIL',
            rToast
              ? `toast ${Math.round(rToast.top)}-${Math.round(rToast.bottom)}, banner top ${Math.round(rb.top)}, overlap ${intersect(rb, rToast)} px2, toast on top: ${toastTop}`
              : 'toast never showed',
            { evidence: [ev] },
          )
        },
      )
    }
  }
  if (stub && want('1009')) {
    for (const theme of ['light', 'dark']) {
      const euro = {
        base: stub,
        vp: 'phone',
        theme,
        timezoneId: 'Europe/Zagreb',
        stub: {},
      }
      // confirm-email bar vs cookie bar vs toast: main app (inline strip) and Karaoke Night (pill)
      for (const where of ['app', 'karaoke-night']) {
        for (const vp of where === 'app' ? ['phone'] : ['phone', 'desktop']) {
          await withPage(
            {
              ...euro,
              vp,
              stub: {
                'GET /api/auth/me': ME_UNVERIFIED,
                'GET /api/billing/promo/featured': FEATURED,
              },
              storage: {
                'mp:authToken': fakeToken(),
                'mp:gauthPending': JSON.stringify({
                  nonce: 'app-check-nonce',
                  expiresAt: Date.now() + 600_000,
                }),
              },
            },
            async (page) => {
              const path = where === 'app' ? '/#/home' : '/karaoke-night'
              const toastHash =
                'gauth_error=access_denied&gauth_nonce=app-check-nonce'
              await page.goto(
                stub +
                  (where === 'app' ? `/#${toastHash}` : `${path}#${toastHash}`),
              )
              await settle(page, 800)
              const banner = page.getByRole('dialog', {
                name: 'Cookie consent',
              })
              const verify = page
                .locator('[data-testid="verify-email-banner"]')
                .filter({ visible: true })
              const ev = await shot(
                page,
                `1009-confirm-bar-${where}-${vp}-${theme}`,
              )
              const [rb, rv] = [await rectOf(banner), await rectOf(verify)]
              if (!rv) {
                report.add(
                  `1009 confirm-bar-shows ${where} ${vp} ${theme}`,
                  'FAIL',
                  'no confirm-email bar for a stubbed unconfirmed account',
                  { evidence: [ev] },
                )
                return
              }
              const vTop = await onTop(
                verify.locator('button', { hasText: /Resend/ }),
              )
              report.add(
                `1009 confirm-bar-vs-cookie-bar ${where} ${vp} ${theme}`,
                rb && intersect(rb, rv) === 0 && vTop
                  ? 'PASS'
                  : rb
                    ? 'FAIL'
                    : 'SKIP',
                rb
                  ? `confirm bar ${Math.round(rv.top)}-${Math.round(rv.bottom)}, banner ${Math.round(rb.top)}-${Math.round(rb.bottom)}, overlap ${intersect(rb, rv)} px2, Resend on top: ${vTop}`
                  : 'no cookie bar',
                { evidence: [ev] },
              )
              const toast = page
                .locator('[role="alert"]')
                .filter({ hasText: 'Google sign-in failed' })
              const rt = await rectOf(toast)
              if (rt) {
                report.add(
                  `1009 toast-vs-confirm-bar ${where} ${vp} ${theme}`,
                  intersect(rt, rv) === 0 ? 'PASS' : 'FAIL',
                  `toast ${Math.round(rt.top)}-${Math.round(rt.bottom)}, confirm bar ${Math.round(rv.top)}-${Math.round(rv.bottom)}, overlap ${intersect(rt, rv)} px2`,
                  { evidence: [ev] },
                )
              }
            },
          )
        }
      }
    }
  }

  // ── #1014: the line under the launch gift, signed out ──────────────────
  const giftBases = []
  if (stub && want('gift'))
    giftBases.push({
      base: stub,
      label: 'stub',
      stub: { 'GET /api/billing/promo/featured': FEATURED },
    })
  if (args.dev && want('gift'))
    giftBases.push({ base: String(args.dev), label: 'dev' })
  for (const gb of giftBases) {
    for (const vp of ['phone', 'desktop']) {
      for (const theme of ['light', 'dark']) {
        const consent = 'denied' // answer the cookie bar so it does not sit over the rail
        // Karaoke Night, signed out
        await withPage(
          { base: gb.base, vp, theme, consent, stub: gb.stub },
          async (page) => {
            await page.goto(gb.base + '/karaoke-night')
            await settle(page, 800)
            const offer = page
              .getByText(OFFER_RE)
              .filter({ visible: true })
              .first()
            const create = page
              .getByRole('button', { name: /Create my free account/ })
              .filter({ visible: true })
              .first()
            const ro = await rectOf(offer)
            const rc = await rectOf(create)
            const ev = await shot(
              page,
              `1014-${gb.label}-karaoke-night-${vp}-${theme}`,
              ro ? offer.locator('xpath=..') : null,
            )
            const ok = ro && (!rc || ro.bottom <= rc.top + 1)
            report.add(
              `1014 ${gb.label} karaoke-night ${vp} ${theme}`,
              ok ? 'PASS' : 'FAIL',
              ro
                ? `"${(await offer.innerText()).trim()}" at y ${Math.round(ro.top)}${rc ? `, above Create my free account at y ${Math.round(rc.top)}` : ''}`
                : 'offer line not found',
              { evidence: [ev] },
            )
          },
        )
        // Settings > Credits, signed out
        await withPage(
          { base: gb.base, vp, theme, consent, stub: gb.stub },
          async (page) => {
            await page.goto(gb.base + '/#/settings/credits')
            await settle(page, 800)
            const offer = page
              .getByText(OFFER_RE)
              .filter({ visible: true })
              .first()
            const ro = await rectOf(offer)
            if (ro) await offer.scrollIntoViewIfNeeded()
            const ev = await shot(
              page,
              `1014-${gb.label}-settings-credits-${vp}-${theme}`,
              ro ? offer.locator('xpath=..') : null,
            )
            report.add(
              `1014 ${gb.label} settings-credits ${vp} ${theme}`,
              ro ? 'PASS' : 'FAIL',
              ro
                ? `"${(await offer.innerText()).trim()}"`
                : 'offer line not found',
              { evidence: [ev] },
            )
          },
        )
        // Onboarding Map, first visit
        await withPage(
          {
            base: gb.base,
            vp,
            theme,
            consent,
            returning: false,
            stub: gb.stub,
          },
          async (page) => {
            await page.goto(gb.base + '/')
            await settle(page)
            await page.evaluate(() => window.__startOnboarding?.())
            await page.goto(gb.base + '/#/map')
            await settle(page, 800)
            const map = page.locator('[data-beat="map"]')
            const offer = page
              .getByText(OFFER_RE)
              .filter({ visible: true })
              .first()
            const ro = await rectOf(offer)
            const ev = await shot(
              page,
              `1014-${gb.label}-onboarding-map-${vp}-${theme}`,
            )
            report.add(
              `1014 ${gb.label} onboarding-map ${vp} ${theme}`,
              ro ? 'PASS' : (await map.count()) ? 'FAIL' : 'SKIP',
              ro
                ? `"${(await offer.innerText()).trim()}"`
                : (await map.count())
                  ? 'Map shows, offer line missing'
                  : 'Map beat did not open',
              { evidence: [ev] },
            )
          },
        )
      }
    }
  }
} finally {
  await browser.close()
  report.write()
  for (const s of servers) await s.stop()
}
