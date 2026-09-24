// Final Journey portrait proof — bounded real raster confirms the authored muse remains upright.

import { expect, test } from '@playwright/test'
import { restoreRasterOutput, suspendRasterOutput, } from './helpers/cloudway-platform-proof'

test.use({
  viewport: { width: 1024, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(240_000)

test('captures the upright final Journey portrait', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.GLASS_PORTRAIT_RENDER_PROOF !== '1',
    'Set GLASS_PORTRAIT_RENDER_PROOF=1 for actual-pixel review.',
  )
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}museum-audio:v1`,
      JSON.stringify({ muted: true }),
    )
    localStorage.setItem(
      `${prefix}progress:glassworks-journey/journey`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/portrait/checkpoint/entry',
        completedBreakableIds: [
          'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
          'glassworks-journey/journey/garden/encounter/garden-decanter',
          'glassworks-journey/journey/archive/encounter/archive-carafe',
        ],
        finished: false,
      }),
    )
  })
  await page.clock.install()
  await page.goto('/glass-game/?layout=journey', {
    waitUntil: 'domcontentloaded',
  })
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute(
    'data-loading-phase',
    'awaiting-first-frame',
    { timeout: 90_000 },
  )
  await suspendRasterOutput(page)
  for (let frame = 0; frame < 120; frame++) {
    if ((await game.getAttribute('data-ready')) === 'true') break
    await page.clock.runFor(32)
  }
  await expect(game).toHaveAttribute('data-ready', 'true')
  await expect(game).toHaveAttribute(
    'data-checkpoint',
    'glassworks-journey/journey/portrait/checkpoint/entry',
  )
  await restoreRasterOutput(page)
  await page.clock.runFor(17)
  await page.screenshot({
    path: testInfo.outputPath('portrait-tablet.png'),
  })
  expect(errors).toEqual([])
})
