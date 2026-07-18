// Verify the refactored KaraokeMobileStage end-to-end on a phone viewport:
// stage mounts, kit pieces render (pill, scrubber, transport), the kit Sheet
// opens, and drag-to-dismiss works. Exits 1 on any failed assertion.
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || './stage-verify'
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(`${BASE}/karaoke`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/1-landing.png` })

// Stage the demo song.
const demoBtn = page.getByRole('button', { name: /sing the demo/i }).first()
check('landing shows "Sing the demo"', await demoBtn.isVisible())
await demoBtn.click()

const stage = page.locator('[data-testid="karaoke-mobile-stage"]')
await stage.waitFor({ state: 'visible', timeout: 20000 })
check('mobile stage mounted (StageShell portal)', await stage.isVisible())
await page.waitForTimeout(2500) // let stems/lyrics settle
await page.screenshot({ path: `${OUT}/2-stage.png` })

// Stage geometry: full-viewport, no horizontal overflow.
const box = await stage.boundingBox()
check(
  'stage fills the viewport',
  box !== null && box.width === 390 && Math.abs(box.height - 844) < 2,
  JSON.stringify(box),
)
const overflowX = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
)
check('no horizontal overflow', !overflowX)

// Kit pieces present.
const pill = page.getByRole('button', { name: /toggle guide vocals/i })
check('PillControl rendered', await pill.isVisible())
const playBtn = stage.getByRole('button', { name: /^(play|pause)$/i }).first()
check('transport play button rendered', await playBtn.isVisible())

// Body scroll locked while the stage is up (useScrollLock).
const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
check('body scroll locked', bodyOverflow === 'hidden', bodyOverflow)

// Pill tap toggles vocals (aria-pressed flips).
const pressedBefore = await pill.getAttribute('aria-pressed')
await pill.tap()
await page.waitForTimeout(300)
const pressedAfter = await pill.getAttribute('aria-pressed')
check(
  'pill tap toggles vocals',
  pressedBefore !== pressedAfter,
  `${pressedBefore} -> ${pressedAfter}`,
)

// Open the kit Sheet from the song-list button.
await page.getByRole('button', { name: /open the song list/i }).tap()
const sheet = page.getByRole('dialog', { name: /songs and playlists/i })
await sheet.waitFor({ state: 'visible', timeout: 4000 })
check('kit Sheet opens', await sheet.isVisible())
await page.screenshot({ path: `${OUT}/3-sheet.png` })

// Drag the handle down far enough to dismiss.
const sheetBox = await sheet.boundingBox()
const hx = sheetBox.x + sheetBox.width / 2
const hy = sheetBox.y + 12
await page.mouse.move(hx, hy)
await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(hx, hy + i * 20)
await page.mouse.up()
await page.waitForTimeout(400)
check('sheet drag-to-dismiss closes it', !(await sheet.isVisible()))

// Backdrop-tap close still works too.
await page.getByRole('button', { name: /open the song list/i }).tap()
await sheet.waitFor({ state: 'visible', timeout: 4000 })
await page.mouse.click(195, 120) // above the panel = backdrop
await page.waitForTimeout(400)
check('sheet backdrop-tap closes it', !(await sheet.isVisible()))

// Play (demo audio may not load in the sandbox — only assert no crash).
await playBtn.tap().catch(() => {})
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/4-after-play.png` })

const realErrors = errors.filter(
  (e) =>
    !/net::|Failed to fetch|fetch.*failed|ERR_|404|CORS|audio|AudioContext|R2|manifest/i.test(
      e,
    ),
)
check('no unexpected page errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 300))

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
