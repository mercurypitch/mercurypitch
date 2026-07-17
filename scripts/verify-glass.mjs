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
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
})
const ctx = await browser.newContext({
  viewport: { width: 1180, height: 860 },
  ignoreHTTPSErrors: true,
  permissions: ['microphone'],
})
const page = await ctx.newPage()

// The injected singer: loops [0.4s rest → 8.5s exponential glide A2→A5 →
// 2.2s hold on A4]. Holding A4 sustains the ceiling; the target becomes
// A4 + GLASS_CONFIG.target.offsetSemitones.
await page.addInitScript(() => {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints || !constraints.audio) return orig(constraints)
    const ac = new AudioContext()
    await ac.resume().catch(() => undefined)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    const gain = ac.createGain()
    const dest = ac.createMediaStreamDestination()
    const PERIOD = 11.1
    let t = ac.currentTime + 0.05
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
    osc.connect(gain).connect(dest)
    osc.start()
    return dest.stream
  }
})

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

await page.waitForSelector('.glass-stage canvas', { timeout: 20000 })
log.push('calibration stage live')

await page.waitForSelector('.glass-note-hero', { timeout: 45000 })
const target = (await page.locator('.glass-note-hero').textContent())?.trim()
log.push('announce, target = ' + target)
await page.getByRole('button', { name: "I'm ready" }).click()

await page.waitForSelector('.glass-stagegrid .glass-stage canvas', {
  timeout: 15000,
})
await page.waitForSelector('.glass-fx', { timeout: 5000 })
log.push('rep stage + FX rail live')

await page.getByText('That was you').waitFor({ timeout: 20000 })
await page.getByRole('button', { name: 'Nebula' }).click()
log.push('playback + preset change')

await page.getByRole('button', { name: 'End session' }).click()
await page.waitForSelector('.glass-metrics', { timeout: 10000 })
log.push(
  'results: ' +
    (await page.locator('.glass-panel h2').first().textContent())?.trim(),
)

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
