// Verify the mobile BottomTabBar in the main app at a phone viewport:
// bar renders (glass, 4 slots + More), top tabs unmounted, tab switch works,
// More sheet lists the rest, content clears the bar. Desktop control: bar
// absent, top tabs present. Exits 1 on any failed assertion.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || './tabbar-verify'
const version = JSON.parse(readFileSync('./package.json', 'utf8')).version
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
})

async function newPage(viewport, isMobile) {
  const ctx = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
  })
  const page = await ctx.newPage()
  await page.addInitScript((v) => {
    window.E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', v)
    for (const t of [
      'exercises', 'singing', 'piano', 'guitar', 'karaoke', 'community',
      'leaderboard', 'challenges', 'jam', 'compose', 'analysis', 'settings',
    ]) localStorage.setItem(`pitchperfect_page_tour_offered_${t}`, 'true')
  }, version)
  return page
}

// ── Phone viewport ──
const page = await newPage({ width: 390, height: 844 }, true)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const bar = page.locator('[data-tour="mobile-tabbar"]')
check('bottom tab bar renders on phone', await bar.isVisible())
await page.screenshot({ path: `${OUT}/1-phone-singing.png` })

const barBox = await bar.boundingBox()
check(
  'bar floats at the bottom',
  barBox !== null && barBox.y > 700 && barBox.height >= 50,
  JSON.stringify(barBox),
)

const topTabs = await page.locator('#app-tabs').count()
check('top tab bar unmounted on phone', topTabs === 0)

// Same #tab-* ids live on the bottom bar now (tour selectors resolve).
const singingBtn = page.locator('#tab-singing')
check('#tab-singing resolves to bar button', await singingBtn.isVisible())

// Bar composition under the default scope.
const barButtons = bar.locator('button')
const count = await barButtons.count()
const labels = []
for (let i = 0; i < count; i++) labels.push(await barButtons.nth(i).innerText())
check('bar has <=5 buttons incl. More', count <= 5 && labels[count - 1] === 'More', labels.join(','))

// Tab switch via the bar.
const exTab = page.locator('#tab-exercises')
if (await exTab.count()) {
  await exTab.tap()
  await page.waitForTimeout(800)
  check(
    'bar switches to Exercises',
    await page.locator('#exercises-panel').isVisible(),
  )
} else {
  check('bar switches to Exercises', false, 'no #tab-exercises in bar')
}
await page.screenshot({ path: `${OUT}/2-phone-exercises.png` })

// Exercises content clears the bar (menu bottom padding >= bar top).
const overlap = await page.evaluate(() => {
  const bar = document.querySelector('[data-tour="mobile-tabbar"]')
  const main = document.querySelector('.main-content')
  if (!bar || !main) return 'missing'
  const cs = getComputedStyle(main)
  return parseFloat(cs.paddingBottom) >= 54 ? 'clear' : cs.paddingBottom
})
check('main content has bar clearance', overlap === 'clear', String(overlap))

// More sheet.
await page.locator('[data-tour="mobile-tabbar-more"]').tap()
const moreSheet = page.getByRole('dialog', { name: /more tabs/i })
await moreSheet.waitFor({ state: 'visible', timeout: 4000 })
check('More sheet opens', await moreSheet.isVisible())
const moreText = await moreSheet.innerText()
check(
  'More sheet lists Settings + desktop hint',
  /Settings/.test(moreText) && /desktop/i.test(moreText),
)
await page.screenshot({ path: `${OUT}/3-phone-more.png` })

// Navigate from the sheet.
await moreSheet.getByRole('button', { name: /^Settings$/ }).tap()
await page.waitForTimeout(800)
check('sheet closes after pick', !(await moreSheet.isVisible()))
await page.screenshot({ path: `${OUT}/4-phone-settings.png` })

const realErrors = errors.filter((e) => !/net::|Failed to fetch|ERR_/i.test(e))
check('no page errors (phone)', realErrors.length === 0, realErrors.join('|').slice(0, 200))
await page.context().close()

// ── Desktop control ──
const desk = await newPage({ width: 1280, height: 800 }, false)
await desk.goto(BASE, { waitUntil: 'domcontentloaded' })
await desk.waitForTimeout(2000)
check('desktop keeps top tabs', (await desk.locator('#app-tabs').count()) === 1)
check(
  'desktop has no bottom bar',
  (await desk.locator('[data-tour="mobile-tabbar"]').count()) === 0,
)
await desk.screenshot({ path: `${OUT}/5-desktop.png` })
await desk.context().close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
