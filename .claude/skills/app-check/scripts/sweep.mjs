#!/usr/bin/env node
// app-check sweep: every main screen at phone and desktop, light and dark.
// Screenshots each view and measures sideways scroll, clipped text,
// overlapping floating layers, small tap targets (phone), form-control fonts
// and keyboard focus visibility (desktop).
//
// Run from a MercuryPitch checkout:
//   node <skill>/scripts/sweep.mjs --dist=dist-local --out=<dir>
//   node <skill>/scripts/sweep.mjs --base=https://dev.mercurypitch.com --out=<dir>
// Options:
//   --dist=<dir>      serve this build on a free port (preferred)
//   --port=<n>        port for --dist (default: first free from 4470)
//   --base=<url>      use an already running local or dev URL instead
//   --out=<dir>       output folder (required)
//   --screens=a,b     subset; ids from SCREENS below
//   --vps=phone,desktop  --themes=light,dark
//   --focus=0         skip the keyboard focus walk
//   --tz=Europe/Zagreb   clock for the context (cookie bar on consent builds)
//   --consent=denied  pre-answer the cookie bar (keeps it out of the sweep)
//   --returning=0     first-run visitor (First Light opens)
//   --allow=h1,h2     let these hosts through (never a production host)

import { join } from 'node:path'
import { Report, launch, loadPlaywright, openContext, parseArgs, pickPort, probeFocus, probeLayout, settle, startStatic, watchPage, } from './lib.mjs'

export const SCREENS = {
  home: '/#/home',
  path: '/#/path',
  progress: '/#/progress',
  singing: '/#/singing',
  piano: '/#/piano',
  compose: '/#/compose',
  exercises: '/#/exercises',
  'ear-lab': '/#/ear-lab',
  karaoke: '/#/karaoke',
  jam: '/#/jam',
  guitar: '/#/guitar',
  analysis: '/#/analysis',
  community: '/#/community',
  leaderboard: '/#/leaderboard',
  challenges: '/#/challenges',
  'voice-history': '/#/voice-history',
  'settings-account': '/#/settings/account',
  'settings-practice': '/#/settings/practice',
  'settings-karaoke': '/#/settings/karaoke',
  'settings-display': '/#/settings/display',
  'settings-sync': '/#/settings/sync',
  'settings-credits': '/#/settings/credits',
  'karaoke-night': '/karaoke-night',
  'guitar-night': '/guitar-night',
  'drum-night': '/drum-night',
  'piano-night': '/piano-night',
  mirror: '/mirror',
}

const args = parseArgs()
if (!args.out) {
  console.error('--out=<dir> is required')
  process.exit(2)
}
const vps = String(args.vps ?? 'phone,desktop').split(',')
const themes = String(args.themes ?? 'light,dark').split(',')
const ids = args.screens
  ? String(args.screens).split(',')
  : Object.keys(SCREENS)
const focusOn = args.focus !== '0'

let server = null
let base = args.base
if (args.dist) {
  const port = args.port ? Number(args.port) : await pickPort(4470)
  server = await startStatic({
    dist: args.dist,
    port,
    log: join(args.out, 'server.log'),
  })
  base = server.url
}
if (!base) {
  console.error('give --dist=<build dir> or --base=<local or dev url>')
  process.exit(2)
}

const report = new Report(args.out, `app-check sweep of ${base}`)
const pw = loadPlaywright()
const browser = await launch(pw)
let exitCode = 0
try {
  for (const vp of vps) {
    for (const theme of themes) {
      const ctx = await openContext(browser, {
        base,
        vp,
        theme,
        timezoneId: args.tz ?? 'UTC',
        consent: args.consent ?? 'none',
        returning: args.returning !== '0',
        allow: args.allow ? String(args.allow).split(',') : [],
      })
      for (const id of ids) {
        const path = SCREENS[id] ?? id
        const tag = `${id}-${vp}-${theme}`
        const page = await ctx.newPage()
        const errors = watchPage(page)
        try {
          await page.goto(base + path, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
          await settle(page)
          const shot = report.shot(tag)
          await page.screenshot({ path: shot })
          const m = await probeLayout(page, { phone: vp === 'phone' })
          const ev = [shot]
          report.add(
            `${tag} sideways-scroll`,
            m.overflow.scrollsSideways ? 'FAIL' : 'PASS',
            m.overflow.scrollsSideways
              ? `page is ${Math.max(m.overflow.docScrollWidth, m.overflow.bodyScrollWidth)} px wide in a ${m.overflow.viewportWidth} px viewport`
              : 'no sideways scroll',
            { evidence: ev, details: m.overflow },
          )
          report.add(
            `${tag} clipped-text`,
            m.clippedCount ? 'WARN' : 'PASS',
            m.clippedCount
              ? `${m.clippedCount} clipped: ${m.clipped
                  .slice(0, 4)
                  .map((c) => `"${c.text}" (${c.how})`)
                  .join('; ')}`
              : 'no clipped text',
            { evidence: ev, details: m.clipped },
          )
          report.add(
            `${tag} overlap`,
            m.overlaps.length ? 'WARN' : 'PASS',
            m.overlaps.length
              ? m.overlaps
                  .slice(0, 3)
                  .map((o) => `${o.a} x ${o.b} (${o.w}x${o.h})`)
                  .join('; ')
              : 'no floating layers overlap',
            { evidence: ev, details: m.overlaps },
          )
          if (vp === 'phone') {
            report.add(
              `${tag} tap-targets`,
              m.under24Count ? 'WARN' : m.targetCount ? 'INFO' : 'PASS',
              m.targetCount
                ? `${m.under24Count} under 24 px, ${m.targetCount} under 44 px: ${m.targets
                    .slice(0, 4)
                    .map((t) => `"${t.text || t.el}" hit ${t.hit.join('x')}`)
                    .join('; ')}`
                : 'every visible target hits 44 px',
              { evidence: ev, details: m.targets },
            )
          }
          report.add(
            `${tag} control-font`,
            m.fontCount ? 'WARN' : 'PASS',
            m.fontCount
              ? `${m.fontCount} controls not in the app font (${m.fonts[0].font})`
              : `controls in the app font (${m.bodyFont.split(',')[0]})`,
            { evidence: ev, details: m.fonts },
          )
          if (focusOn && vp === 'desktop' && theme === themes[0]) {
            const stops = await probeFocus(page, { stops: 15 })
            const bad = stops.filter((s) => !s.visible)
            report.add(
              `${tag} focus-visible`,
              bad.length ? 'WARN' : 'PASS',
              bad.length
                ? `${bad.length} of ${stops.length} stops show no change: ${bad
                    .slice(0, 3)
                    .map((b) => b.el)
                    .join('; ')}`
                : `${stops.length} stops, each visibly marked`,
              { evidence: ev, details: stops },
            )
          }
          // route.abort() surfaces as net::ERR_FAILED; those are our own blocks,
          // listed once per context below.
          errors.splice(
            0,
            errors.length,
            ...errors.filter((e) => !e.includes('net::ERR_FAILED')),
          )
          if (errors.length) {
            report.add(
              `${tag} errors`,
              'WARN',
              `${errors.length} page errors: ${errors[0]}`,
              { details: errors },
            )
          }
        } catch (e) {
          report.add(
            `${tag} load`,
            'FAIL',
            `could not load or probe: ${String(e).slice(0, 160)}`,
          )
        } finally {
          await page.close()
        }
      }
      if (ctx.appCheck.blocked.length) {
        const hosts = [
          ...new Set(ctx.appCheck.blocked.map((u) => new URL(u).host)),
        ]
        report.add(
          `${vp}-${theme} blocked-requests`,
          'INFO',
          `${ctx.appCheck.blocked.length} requests off the allowed hosts were aborted: ${hosts.join(', ')}`,
          { details: ctx.appCheck.blocked.slice(0, 20) },
        )
      }
      if (ctx.appCheck.violations.length) {
        report.add(
          `${vp}-${theme} production-requests`,
          'FAIL',
          `${ctx.appCheck.violations.length} requests to production were aborted`,
          { details: ctx.appCheck.violations },
        )
        exitCode = 3
      }
      await ctx.close()
    }
  }
} finally {
  await browser.close()
  const counts = report.write()
  if (server) await server.stop()
  if (counts.FAIL && !exitCode) exitCode = 1
}
process.exit(exitCode)
