// Screenshots of the native app's rooms from its LOCAL dev server (never production):
//   node native-shots.cjs <out> [fixtures|ear|sing]
// fixtures: the pinned frames the dev server offers (?longNoteFixture= and friends).
// ear / sing: walks the rail to the Ear Lab with Merc, or to the Sing room's exercise picker.
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const fs = require('fs')
const [OUT, WHAT = 'fixtures'] = process.argv.slice(2)
const BASE = 'http://localhost:5173'
fs.mkdirSync(OUT, { recursive: true })

const FIXTURES = [
  ['longNoteFixture', ['intro', 'mid-take', 'result']],
  ['echoFixture', ['intro', 'mid-take', 'result']],
  ['lipFixture', ['intro', 'mid-take', 'result']],
  ['ngFixture', ['intro', 'mid-take', 'result']],
  ['warmFixture', ['start', 'between', 'done']],
]

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    permissions: ['microphone'],
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('mp:native-onboarding', 'done')
      localStorage.setItem('mp:portableConsole', '0')
    } catch {}
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  let k = 0
  const shot = async (name) => {
    const file = `${String(k++).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: `${OUT}/${file}` })
    console.log(`  shot ${file}`)
  }
  const ids = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid], [data-rail-item]'))
        .filter((e) => e.offsetParent !== null)
        .map((e) => e.getAttribute('data-testid') || `rail:${e.getAttribute('data-rail-item')}`)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 60)
        .join(' '),
    )

  if (WHAT === 'fixtures') {
    for (const [key, states] of FIXTURES) {
      for (const s of states) {
        await page.goto(`${BASE}/?${key}=${s}`, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log(`  goto ${key}=${s}: ${e.message.split('\n')[0]}`))
        await page.waitForTimeout(4500)
        await shot(`${key.replace('Fixture', '')}-${s}`)
      }
    }
  } else {
    await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(5000)
    await shot('home')
    console.log(`  ids: ${await ids()}`)
    const rail = WHAT === 'ear' ? 'ear' : 'stage'
    const item = page.locator(`[data-rail-item="${rail}"]`).first()
    if ((await item.count()) === 0) console.log(`  no rail item ${rail}; rail items: ${await page.evaluate(() => Array.from(document.querySelectorAll('[data-rail-item]')).map((e) => e.getAttribute('data-rail-item')).join(' '))}`)
    else {
      await item.click({ timeout: 5000 }).catch((e) => console.log(`  rail click: ${e.message.split('\n')[0]}`))
      await page.waitForTimeout(3500)
      await shot(`${rail}`)
      console.log(`  ids: ${await ids()}`)
      const steps = WHAT === 'ear' ? ['ear-rooms-card'] : ['sing-exercise-browse']
      for (const id of steps) {
        const el = page.locator(`[data-testid="${id}"]`).first()
        if ((await el.count()) === 0) {
          console.log(`  no ${id}`)
          continue
        }
        await el.click({ timeout: 5000 }).catch((e) => console.log(`  ${id}: ${e.message.split('\n')[0]}`))
        await page.waitForTimeout(3000)
        await shot(id)
        console.log(`  ids: ${await ids()}`)
      }
    }
  }
  console.log(`errors: ${JSON.stringify([...new Set(errors)].slice(0, 6))}`)
  await browser.close()
})().catch((e) => {
  console.error(`native-shots crashed: ${e.message}`)
  process.exit(1)
})
