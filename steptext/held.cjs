// What a predict's plays look like while they sound, to learn how to tell one is over:
// node held.cjs <port> <lesson> <choice selector or -> <plays selector> <shown selector>
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const [PORT, N, CHOICE, PLAYS, SHOWN] = process.argv.slice(2)
;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => { try { localStorage.setItem('fyp-tour', '1') } catch {} })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`pageerror ${e.message}`))
  await page.goto(`http://127.0.0.1:${PORT}/learn/${N}.html`)
  await page.waitForTimeout(1000)
  await page.locator('#gateBtn').click({ timeout: 1500 }).catch(() => {})
  await page.locator('#predict [data-choice], .hero [data-choice]').first().click({ timeout: 2000 }).catch((e) => console.log(`cold choice: ${e.message.split('\n')[0]}`))
  await page.waitForTimeout(400)
  if (CHOICE !== '-') await page.locator(CHOICE).first().click({ timeout: 2000 }).catch((e) => console.log(`choice: ${e.message.split('\n')[0]}`))
  await page.waitForTimeout(400)
  const state = () => page.evaluate(({ plays, shown }) => {
    const s = document.querySelector(shown)
    return Array.from(document.querySelectorAll(plays)).map((b) => `${b.dataset.play}${b.disabled ? ':dis' : ''}${b.offsetParent === null ? ':hid' : ''}[${b.className.replace(/\s+/g, '.')}${b.getAttribute('aria-pressed') ? ' pressed=' + b.getAttribute('aria-pressed') : ''}]`).join(' ') + ` || shown=${!!s && s.offsetParent !== null}`
  }, { plays: PLAYS, shown: SHOWN })
  console.log(`before: ${await state()}`)
  const count = await page.locator(PLAYS).count()
  for (let i = 0; i < count; i++) {
    const b = page.locator(PLAYS).nth(i)
    if (!(await b.isVisible()) || (await b.isDisabled())) { console.log(`play ${i}: not pressable`); continue }
    await b.click({ timeout: 3000 }).catch((e) => console.log(`click: ${e.message.split('\n')[0]}`))
    for (const t of [300, 1500, 3000, 5000, 8000, 12000]) {
      await page.waitForTimeout(t === 300 ? 300 : t - [300, 1500, 3000, 5000, 8000][[1500, 3000, 5000, 8000, 12000].indexOf(t)])
      console.log(`play ${i} +${t}ms: ${await state()}`)
    }
  }
  await browser.close()
})()
