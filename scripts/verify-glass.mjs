// ============================================================
// Glass end-to-end verify — drives the real /glass flow with a
// SYNTHESIZED singer injected at the getUserMedia level (a
// WebAudio oscillator: rest → glide A2→A5 → hold A4), so it
// needs no OS fake-audio device (those proved flaky on desktops)
// and exercises the real ceiling→target path (A4 → target G4
// at the default −2 offset).
//
// Usage:  node scripts/verify-glass.mjs [baseUrl]
//   1. VITE_DEV_PORT=3100 pnpm dev   (or any running dev server)
//   2. node scripts/verify-glass.mjs https://localhost:3100
//
// Notes (see src/features/glass/README.md §6):
//   - Playwright's headless SHELL has no getUserMedia; this script
//     resolves the FULL chromium binary from the playwright cache.
//   - WebGPU headless needs --enable-unsafe-webgpu + Vulkan; the
//     TypeGPU pane renders but headless SCREENSHOTS omit WebGPU
//     surfaces — verify visuals with HEADED=1 (uses your display).
// ============================================================

import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'https://localhost:3100'
const HEADED = process.env.HEADED === '1'
// SHATTER=1: after calibration the singer locks onto the target (G4) so the
// glass actually breaks — verifies the burst + results path. Default mode
// never enters the band, verifying the rep/playback/FX loop instead.
const SHATTER = process.env.SHATTER === '1'
// SHOT_DIR=path: save screenshots at key beats. WebGPU surfaces don't show
// in headless captures, so shot runs drop the WebGPU flags — the canvas2d
// fallback draws the same look and IS captured (visual QA of layout/pane).
const SHOT_DIR = process.env.SHOT_DIR ?? ''
// SHOT_W/SHOT_H: viewport override for shot runs (desktop QA sizes).
const VIEW_W = Number(process.env.SHOT_W ?? 1180)
const VIEW_H = Number(process.env.SHOT_H ?? 860)

function fullChromium() {
  const cache = join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(cache)) return undefined
  const dirs = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .reverse()
  for (const dir of dirs) {
    const bin = join(cache, dir, 'chrome-linux64', 'chrome')
    if (existsSync(bin)) return bin
    const legacy = join(cache, dir, 'chrome-linux', 'chrome')
    if (existsSync(legacy)) return legacy
  }
  return undefined
}

const browser = await chromium.launch({
  executablePath: fullChromium(),
  headless: !HEADED,
  args:
    SHOT_DIR !== ''
      ? [] // no WebGPU → canvas2d fallback, which headless shots capture
      : ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
})
const ctx = await browser.newContext({
  viewport: { width: VIEW_W, height: VIEW_H },
  ignoreHTTPSErrors: true,
  permissions: ['microphone'],
})
const page = await ctx.newPage()

async function shot(name) {
  if (SHOT_DIR === '') return
  await page
    .screenshot({ path: join(SHOT_DIR, `${name}.png`) })
    .catch(() => undefined)
}

// The injected singer. Default: loops [0.4s rest → 8.5s exponential glide
// A2→A5 → 2.2s hold on A4] — the A4 hold sets the ceiling, the target
// becomes A4 + offsetSemitones (G4 at −2), and the singer never locks it.
// Shatter mode: one calibration pattern, then a constant G4 from t=13.5 —
// rep 1 locks immediately and the glass breaks.
await page.addInitScript((shatterMode) => {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints || !constraints.audio) return orig(constraints)
    const ac = new AudioContext()
    await ac.resume().catch(() => undefined)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    const gain = ac.createGain()
    const dest = ac.createMediaStreamDestination()
    const t0 = ac.currentTime + 0.05
    if (shatterMode) {
      // Hold C5 (523) long for the ceiling, then A4 (440 = C5−3 = the target
      // at offset −3) held forever so rep 1 locks and the glass breaks. The
      // long holds tolerate the "I'm ready" gates shifting the record windows.
      // The loop singer's WIDE glide (span always ≥5 in any record window,
      // so calibration succeeds first try — no retry to desync timing),
      // hold A4 for the ceiling, then F#4 (= A4−3 = the target) held forever
      // so the rep locks it and the glass breaks.
      gain.gain.setValueAtTime(0.0001, t0)
      osc.frequency.setValueAtTime(110, t0)
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.5)
      osc.frequency.exponentialRampToValueAtTime(880, t0 + 8.9)
      osc.frequency.setValueAtTime(440, t0 + 8.9) // ceiling hold (A4)
      osc.frequency.setValueAtTime(370, t0 + 13) // then the target F#4, held
    } else {
      const PERIOD = 11.1
      let t = t0
      for (let k = 0; k < 40; k++) {
        gain.gain.setValueAtTime(0.0001, t)
        osc.frequency.setValueAtTime(110, t)
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.45)
        osc.frequency.setValueAtTime(110, t + 0.4)
        osc.frequency.exponentialRampToValueAtTime(880, t + 8.9)
        osc.frequency.setValueAtTime(440, t + 8.9)
        gain.gain.setValueAtTime(0.5, t + 11.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + PERIOD)
        t += PERIOD
      }
    }
    osc.connect(gain).connect(dest)
    osc.start()
    return dest.stream
  }
}, SHATTER)

const errors = []
const glassLogs = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  const text = m.text()
  if (m.type() === 'error' && !text.includes('Failed to load resource')) {
    errors.push('console: ' + text)
  }
  if (text.startsWith('[glass')) glassLogs.push(text)
})

const log = []
await page.goto(BASE + '/glass', { waitUntil: 'networkidle' })
await page.click('button.glass-cta')

const contBtn = page.getByRole('button', { name: 'Continue anyway' })
try {
  await contBtn.waitFor({ state: 'visible', timeout: 5000 })
  await contBtn.click()
  log.push('mic probed silent — continued anyway (unexpected with injection)')
} catch {
  log.push('mic probe passed')
}

// The glide brief waits for "I'm ready" (users read + watch the demo first).
// Calibration may retry (each retry re-shows the button), so click it
// whenever it appears until the announce screen shows.
const glideReady = page
  .locator('.glass-glide-brief')
  .getByRole('button', { name: "I'm ready" })
let readyClicks = 0
for (let i = 0; i < 40; i++) {
  if ((await page.locator('.glass-note-hero').count()) > 0) break
  if (await glideReady.isVisible().catch(() => false)) {
    await glideReady.click().catch(() => undefined)
    readyClicks++
    // Let the brief transition (button hides) before checking again, so one
    // brief is never double-clicked; a real retry re-shows it later.
    await page.waitForTimeout(1400)
  } else {
    await page.waitForTimeout(400)
  }
}
log.push(`glide brief — clicked I'm ready ×${readyClicks}`)

await page.waitForSelector('.glass-note-hero', { timeout: 45000 })
const target = (await page.locator('.glass-note-hero').textContent())?.trim()
log.push('announce, target = ' + target)
await page.getByRole('button', { name: "I'm ready" }).click()

await page.waitForSelector('.glass-stagegrid .glass-stage canvas', {
  timeout: 15000,
})
await page.waitForSelector('.glass-fx', { timeout: 5000 })
log.push('rep stage + FX rail live')
if (SHOT_DIR !== '') {
  // Mid-sing: ribbon dancing in the pane (the glide is ~4s in by now).
  await page.waitForTimeout(4500)
  await shot('stage-sing')
}

if (SHATTER) {
  // The singer locks the target — the glass must break on rep 1. Poll for
  // the burst/results (up to 45s: the "I'm ready" gates push the rep later).
  let sawShatter = false
  for (let i = 0; i < 90; i++) {
    if (
      (await page.locator('[data-shatter]').count()) > 0 ||
      (await page.locator('.glass-metrics').count()) > 0
    ) {
      sawShatter = true
      break
    }
    await page.waitForTimeout(500)
  }
  const h2 = (
    await page.locator('.glass-panel h2').first().textContent()
  )?.trim()
  log.push(`results: ${h2}${sawShatter ? '' : ' (no burst seen)'}`)
  // The winning take lands in the results strip, badged Shattered.
  await page.waitForTimeout(1000)
  const shatterCards = await page.locator('.glass-take-card.shattered').count()
  log.push(`takes strip: ${shatterCards} shattered card(s)`)
} else {
  await page.getByText('That was you').waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'Nebula' }).click()
  log.push('playback + preset change')

  // The rep's take is reviewable in the strip during playback: card exists,
  // and tapping it swaps the audio to the take player (one sound at a time).
  await page.waitForSelector('.glass-take-card', { timeout: 5000 })
  const cards = await page.locator('.glass-take-card').count()
  await page.locator('.glass-take-main').first().click()
  await page.waitForTimeout(600)
  const playing = await page.locator('.glass-take-card.playing').count()
  log.push(`takes strip: ${cards} card(s), tap-to-play ${playing === 1 ? 'ok' : 'FAILED'}`)
  await shot('playback-takes')

  // The playback beat ends into the MANUAL gate (no auto-advance): the
  // "Sing again" tap is what starts the next rep.
  const singAgain = page.getByRole('button', { name: 'Sing again' })
  await singAgain.waitFor({ timeout: 15000 })
  log.push('gap gate: Sing again rendered (no auto-advance)')
  await shot('gap-gate')

  await page.getByRole('button', { name: 'End session' }).click()
  await page.waitForSelector('.glass-metrics', { timeout: 10000 })
  log.push(
    'results: ' +
      (await page.locator('.glass-panel h2').first().textContent())?.trim(),
  )
  if (SHOT_DIR !== '') {
    // Layout probe: the pane must have real size under the results overlay.
    const rect = await page.evaluate(() => {
      const el = document.querySelector('.glass-stage-wrap .glass-stage')
      const canvas = el?.querySelector('canvas')
      const r = el?.getBoundingClientRect()
      if (!r) return 'stage NOT FOUND'
      if (!canvas) return 'canvas MISSING'
      const cr = canvas.getBoundingClientRect()
      // Painted? sample the canvas backing for any non-transparent pixel.
      let painted = 'unreadable'
      try {
        const probe = document.createElement('canvas')
        probe.width = 40
        probe.height = 40
        const ctx = probe.getContext('2d')
        ctx.drawImage(canvas, 0, 0, 40, 40)
        const data = ctx.getImageData(0, 0, 40, 40).data
        let hits = 0
        for (let i = 3; i < data.length; i += 4) if (data[i] > 8) hits++
        painted = `${hits}/1600 px`
      } catch {
        /* tainted/webgpu */
      }
      return `stage ${Math.round(r.width)}x${Math.round(r.height)} @y=${Math.round(r.top)} canvas ${Math.round(cr.width)}x${Math.round(cr.height)} backing ${canvas.width}x${canvas.height} painted ${painted}`
    })
    log.push(`results layout: ${rect}`)
  }
  await shot('results')
}

const backend =
  glassLogs.find((l) => l.includes('renderer backend')) ?? '(no backend log)'
const playback =
  glassLogs.find((l) => l.includes('take playback')) ?? '(no playback log)'
console.log(JSON.stringify({ log, backend, playback }, null, 2))
if (errors.length > 0) {
  console.error('ERRORS:\n' + errors.join('\n'))
  process.exitCode = 1
} else {
  console.log('NO RUNTIME ERRORS')
}
await browser.close()
