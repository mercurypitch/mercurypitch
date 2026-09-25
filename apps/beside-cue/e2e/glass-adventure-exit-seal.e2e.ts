// Exit seal visual proof — real Cloudway frames show the frosted lock and restored open aperture.

import { expect, test } from '@playwright/test'
import { CLOUDWAY_CURRENT_TRIAL } from '../../../packages/glass-game/src/content/cloudway-layouts'
import { installCloudwayVisit, captureInstancedFrame, suspendRasterOutput, restoreRasterOutput, setHeading, } from './helpers/cloudway-platform-proof'

test.use({
  hasTouch: true,
  viewport: { width: 900, height: 700 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(240_000)

for (const state of ['sealed', 'open'] as const) {
  test(`renders the ${state} exit in the actual Cloudway scene`, async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.GLASS_EXIT_RENDER_PROOF !== '1',
      'Set GLASS_EXIT_RENDER_PROOF=1 for actual-pixel review.',
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const level = CLOUDWAY_CURRENT_TRIAL
    const completedBreakableIds =
      state === 'open'
        ? level.exit.requiresCompleted
        : level.exit.requiresCompleted.slice(0, -1)
    await installCloudwayVisit(page, { realRendering: true })
    await page.addInitScript(
      ({ levelId, completedBreakableIds }) => {
        localStorage.setItem(
          `beside-cue:glass-adventure:progress:${levelId}`,
          JSON.stringify({
            version: 2,
            levelId,
            checkpointId: 'cloudway-checkpoint-finale',
            completedBreakableIds,
            finished: false,
          }),
        )
      },
      { levelId: level.id, completedBreakableIds },
    )
    await page.clock.install()
    await page.goto('/glass-game/?layout=cloudway-current', {
      waitUntil: 'domcontentloaded',
    })
    await page.clock.pauseAt(
      (await page.evaluate(() => Date.now())) + 3_600_000,
    )
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute(
      'data-loading-phase',
      'awaiting-first-frame',
      { timeout: 90_000 },
    )
    // Keep shader/asset initialization real, but render only the frames inspected
    // below; hundreds of full-resolution SwiftShader frames are not device FPS proof.
    await suspendRasterOutput(page)
    for (let frame = 0; frame < 120; frame++) {
      if ((await game.getAttribute('data-ready')) === 'true') break
      await page.clock.runFor(32)
    }
    await expect(game).toHaveAttribute('data-ready', 'true')
    const tutorial = page.getByRole('button', { name: 'Skip tutorial' })
    if (await tutorial.isVisible()) await tutorial.click()
    await expect(game).toHaveAttribute(
      'data-checkpoint',
      'cloudway-checkpoint-finale',
    )
    const checkpoint = level.checkpoints.find(
      (item) => item.id === 'cloudway-checkpoint-finale',
    )!
    const centre = {
      x: (level.exit.minX + level.exit.maxX) / 2,
      z: (level.exit.minZ + level.exit.maxZ) / 2,
    }
    await setHeading(
      page,
      Math.atan2(
        -(centre.x - checkpoint.position.x),
        -(centre.z - checkpoint.position.z),
      ),
    )
    await page.clock.runFor(500)
    await restoreRasterOutput(page)
    await captureInstancedFrame(page)
    await page.screenshot({
      path: testInfo.outputPath(`exit-${state}-desktop.png`),
    })
    await page.setViewportSize({ width: 390, height: 844 })
    // ResizeObserver publishes a fresh drawing-buffer size asynchronously.
    await captureInstancedFrame(page)
    await captureInstancedFrame(page)
    await captureInstancedFrame(page)
    await page.screenshot({
      path: testInfo.outputPath(`exit-${state}-phone.png`),
    })
    expect(errors).toEqual([])
  })
}
