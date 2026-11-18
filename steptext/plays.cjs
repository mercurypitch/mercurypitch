// Lists every play in a step's text on a local build: node plays.cjs <port> <lesson> [<lesson>...]
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const [PORT, ...LESSONS] = process.argv.slice(2)
;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] })
  for (const n of LESSONS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => { try { localStorage.setItem('fyp-tour', '1') } catch {} })
    const page = await ctx.newPage()
    await page.goto(`http://127.0.0.1:${PORT}/learn/${n}.html`)
    await page.waitForTimeout(1000)
    await page.locator('#gateBtn').click({ timeout: 1500 }).catch(() => {})
    const dump = (label) => page.evaluate((label) => {
      const rows = Array.from(document.querySelectorAll('[data-step-play]')).map((b) => {
        let hiddenBy = ''
        for (let e = b; e && e !== document.body; e = e.parentElement) {
          if (e.hidden || getComputedStyle(e).display === 'none') { hiddenBy = `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${Array.from(e.attributes).filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}${a.value ? '=' + a.value : ''}]`).join('')}`; break }
        }
        return `step ${b.closest('[data-step]')?.dataset.step} ${b.dataset.stepPlay}${b.disabled ? ' DISABLED' : ''}${hiddenBy ? ' hidden by ' + hiddenBy : ''}`
      })
      return `${label}: ${rows.join(' | ')}`
    }, label)
    console.log(`L${n} ${await dump('at first')}`)
    const choices = await page.evaluate(() => Array.from(document.querySelectorAll('[data-choice], .choice')).map((c) => `${c.closest('[id]')?.id}:${c.dataset.choice ?? c.textContent.trim().slice(0, 20)}${c.disabled ? '(disabled)' : ''}`).join(' | '))
    console.log(`L${n} choices: ${choices}`)
    await page.locator('#predict [data-choice], .hero [data-choice]').first().click({ timeout: 2000 }).catch((e) => console.log(`  cold open choice: ${e.message.split('\n')[0]}`))
    await page.waitForTimeout(500)
    console.log(`L${n} ${await dump('after the cold open choice')}`)
    await ctx.close()
  }
  await browser.close()
})()
