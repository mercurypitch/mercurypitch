// Loading style inspection against the built app, with required art deliberately held or failed.
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const base = process.env.GLASS_PROOF_BASE || 'http://localhost:5196'
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const records = []
try {
  for (const scenario of [
    { viewport: { width: 1280, height: 800 }, failure: false },
    { viewport: { width: 768, height: 1024 }, failure: false },
    { viewport: { width: 390, height: 740 }, failure: true },
    { viewport: { width: 320, height: 568 }, failure: true },
  ]) {
    const context = await browser.newContext({
      viewport: scenario.viewport,
      hasTouch: true,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    let release
    const held = new Promise((resolve) => {
      release = resolve
    })
    await page.route('**/games/glass3d/merc.glb', async (route) => {
      if (scenario.failure) return route.abort('failed')
      await held
      await route.abort('aborted').catch(() => undefined)
    })
    try {
      await page.goto(`${base}/glass-game/`)
      const cover = page.getByTestId('glass-loading-screen')
      await cover.waitFor()
      if (scenario.failure)
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-testid="glass-loading-screen"]')
              ?.getAttribute('data-phase') === 'error',
        )
      await cover.locator('img').evaluate((image) => image.decode())
      const action = cover.getByRole('button', {
        name: scenario.failure ? 'Retry' : 'Leave museum',
        exact: true,
      })
      await action.tap({ trial: true })
      const appearance = await cover.evaluate((element) => {
        const button = element.querySelector('button')
        const arch = element
          .querySelector('img')
          .parentElement.getBoundingClientRect()
        return {
          background: getComputedStyle(element).backgroundColor,
          width: element.clientWidth,
          height: element.clientHeight,
          scrollWidth: element.scrollWidth,
          artTop: arch.top,
          artBottom: arch.bottom,
          button: {
            font: getComputedStyle(button).fontFamily,
            height: button.getBoundingClientRect().height,
            background: getComputedStyle(button).backgroundColor,
            borderRadius: getComputedStyle(button).borderRadius,
          },
        }
      })
      if (
        appearance.background !== 'rgb(244, 239, 220)' ||
        appearance.width !== scenario.viewport.width ||
        appearance.scrollWidth !== appearance.width ||
        appearance.artTop < 0 ||
        appearance.artBottom > scenario.viewport.height ||
        appearance.button.height < 44 ||
        !appearance.button.font.toLowerCase().includes('gabarito')
      )
        throw new Error(
          `Production loading style regression: ${JSON.stringify(appearance)}`,
        )
      const filename = `production-${scenario.viewport.width}-${scenario.failure ? 'error' : 'loading'}.png`
      await page.screenshot({ path: `${output}/${filename}` })
      records.push({ ...scenario, appearance, errors, file: filename })
    } finally {
      release()
      await context.close()
    }
  }
} finally {
  await browser.close()
}
await writeFile(
  `${output}/production-inspection.json`,
  JSON.stringify(records, null, 2) + '\n',
)
if (records.some((record) => record.errors.length))
  throw new Error('Production browser errors')
console.log(JSON.stringify(records))
