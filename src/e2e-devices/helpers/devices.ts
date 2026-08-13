// ── Two devices, for real ────────────────────────────────────────────
//
// Everything in `src/e2e` runs one browser against a mocked signaling
// layer. These specs do not: they need two devices that can actually see
// each other, which means real workers and, for the transfer, two browser
// INSTANCES.
//
// Separate instances rather than separate contexts is not a preference.
// Two contexts of one Chromium share a network process and the peer
// connection never establishes — the symptom is a receiver that sits on
// "waiting" for ever with nothing in any console to explain it. See
// .claude/skills/jam-two-peer/SKILL.md.

import type { Browser, BrowserContext, BrowserContextOptions, ConsoleMessage, Page, } from '@playwright/test'
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const APP_URL = process.env.E2E_DEVICES_URL ?? 'http://localhost:3002'

/** One device: its browser, its page, and what its console said. */
export interface Device {
  name: string
  browser: Browser | null
  context: BrowserContext
  page: Page
  /** Every console line, in order. Assert on protocol claims with this. */
  logs: string[]
  close: () => Promise<void>
}

function appVersion(): string {
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version as string
}

/**
 * Keys that make a first-time visitor stop being one.
 *
 * Seeded through `addInitScript` rather than by clicking things away: the
 * onboarding flow is an `aria-modal` dialog over the whole app, and every
 * click a spec makes before dismissing it lands on the dialog instead.
 */
function quietFirstRun(version: string): void {
  localStorage.setItem('pitchperfect_welcome_version', version)
  localStorage.setItem('pitchperfect_onboarding_done', '1')
  localStorage.setItem('pitchperfect_survey_dismissed', '1')
  localStorage.setItem('pitchperfect_focus_mode', 'false')
  ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
}

async function fit(context: BrowserContext, name: string): Promise<Device> {
  const version = appVersion()
  await context.addInitScript(quietFirstRun, version)
  const page = await context.newPage()
  const logs: string[] = []
  page.on('console', (m: ConsoleMessage) => logs.push(m.text()))
  page.on('pageerror', (e: Error) => logs.push(`pageerror: ${e.message}`))
  return {
    name,
    browser: null,
    context,
    page,
    logs,
    close: async () => {
      await context.close()
    },
  }
}

/**
 * A device in its own browser process. Use for anything with a peer
 * connection in it.
 */
export async function launchDevice(name: string): Promise<Device> {
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const device = await fit(context, name)
  device.browser = browser
  const closeContext = device.close
  device.close = async () => {
    await closeContext()
    await browser.close()
  }
  return device
}

/**
 * A device sharing one browser with another. Only safe where nothing
 * connects peer to peer — sign-in goes through the worker, so it is.
 *
 * `storageState` is how a spec re-uses a sign-in instead of making
 * another one. Sign-in is rate limited (ten per five minutes per address,
 * and rightly), so a file that signs in once per test cannot be run twice
 * in a row without failing on the limiter rather than on the code.
 */
export async function contextDevice(
  browser: Browser,
  name: string,
  storageState?: BrowserContextOptions['storageState'],
): Promise<Device> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(storageState === undefined ? {} : { storageState }),
  })
  return fit(context, name)
}

/** Open a hash route and wait for the app to be more than an empty shell. */
export async function openApp(device: Device, hash = ''): Promise<void> {
  await device.page.goto(`${APP_URL}/${hash}`, {
    waitUntil: 'domcontentloaded',
  })
  await device.page.waitForFunction(
    () => (window as unknown as { __pp?: unknown }).__pp !== undefined,
    undefined,
    { timeout: 30_000 },
  )
}

/**
 * A short WAV, as base64, without a file on disk.
 *
 * Two seconds is enough to encode and decode honestly and short enough
 * that the wasm AAC encoder — which is the path on desktop Linux, where
 * WebCodecs has no AAC — finishes in about a second rather than a minute.
 */
export function toneWavBase64(hz = 220, seconds = 2, rate = 44100): string {
  const frames = Math.floor(rate * seconds)
  const bytes = new Uint8Array(44 + frames * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (at: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1)
      view.setUint8(at + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i += 1) {
    const sample = Math.sin((2 * Math.PI * hz * i) / rate) * 0.3 * 32767
    view.setInt16(44 + i * 2, sample, true)
  }
  return Buffer.from(bytes).toString('base64')
}
