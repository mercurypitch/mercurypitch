// Two real peers in one jam room:
//   node .claude/skills/jam-two-peer/two-peer.mjs ./shots
//
// Imports from '@playwright/test', not 'playwright'. Under pnpm the latter
// is a transitive dependency with no top-level node_modules entry, so a
// bare 'playwright' import fails with ERR_MODULE_NOT_FOUND even from the
// repo root. @playwright/test is a direct dependency and re-exports
// chromium.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = process.argv[2] ?? './jam-shots'
const APP = process.env.JAM_APP_URL ?? 'http://localhost:3001'
mkdirSync(OUT, { recursive: true })

/** A peer is its own BROWSER, not a context -- see SKILL.md item 4. */
async function launch(name) {
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const ctx = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 },
  })
  await ctx.addInitScript(() => {
    localStorage.setItem('pitchperfect_welcome_version', '99.0.0')
    localStorage.setItem('pitchperfect_survey_dismissed', '1')
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' || /jam:/.test(t)) console.log(`[${name}] ${t.slice(0, 150)}`)
  })
  return { browser, page }
}

const host = await launch('host')
await host.page.goto(`${APP}/#/jam`, { waitUntil: 'domcontentloaded' })
await host.page.getByRole('button', { name: /create room/i }).click()
await host.page.waitForFunction(() => /#\/jam:[A-Z0-9]+/i.test(location.hash), { timeout: 30000 })
const code = (await host.page.evaluate(() => location.hash)).split(':')[1]
console.log('room:', code)

const guest = await launch('guest')
await guest.page.goto(`${APP}/#/jam:${code}`, { waitUntil: 'domcontentloaded' })

// Assert on the room, not a timer.
await host.page.waitForFunction(
  () => !/0 peers? connected/i.test(document.body.innerText),
  { timeout: 45000 },
)
console.log('connected: both peers in the room')

// Roles must differ AND be derived independently on each device.
await host.page.getByRole('button', { name: /^Harmony Stack$/ }).click().catch(() => {})
await host.page.waitForTimeout(2500)
const role = (p) => p.locator('text=/You sing:/').first().innerText().catch(() => '(none)')
console.log('host: ', await role(host.page))
console.log('guest:', await role(guest.page))

await host.page.screenshot({ path: `${OUT}/host.png` })
await guest.page.screenshot({ path: `${OUT}/guest.png` })
await host.browser.close()
await guest.browser.close()
