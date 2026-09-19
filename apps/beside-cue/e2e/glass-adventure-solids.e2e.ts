// Museum solid props — real keyboard movement blocks, jumps onto a round plinth, and steps off.
import { expect, test, type Page } from '@playwright/test'

test.use({
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
// Software WebGL renders every controlled physics frame of the authored scene.
test.setTimeout(240_000)

async function coordinate(page: Page, axis: string): Promise<number> {
  return Number(
    await page
      .getByTestId('glass-adventure')
      .getAttribute(`data-player-${axis}`),
  )
}

test('Merc lands on the actual exhibit support instead of passing through @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}museum-audio:v1`,
      JSON.stringify({ muted: true }),
    )
    // An existing legitimate checkpoint avoids repeating the first traversal.
    // It does not alter player physics, award a break, or create a test platform.
    localStorage.setItem(
      `${prefix}progress:glassworks`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'goblet',
        completedBreakableIds: [],
      }),
    )
  })
  // Install before the game schedules its animation frames so all physics ticks
  // belong to the controlled clock, including the first callback.
  await page.clock.install()
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 },
  )
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  await page.getByLabel('Glass museum; drag to look around').focus()
  await page.keyboard.down('KeyW')
  await page.clock.runFor(1500)
  // Visible plinth at z4.55: base radius.29 plus Merc radius.16.
  expect(await coordinate(page, 'z')).toBeCloseTo(4.1, 2)
  expect(await coordinate(page, 'y')).toBeCloseTo(0, 4)
  await page.keyboard.down('Space')
  await page.clock.runFor(200)
  expect(await coordinate(page, 'y')).toBeGreaterThan(0.25)
  await page.keyboard.up('Space')
  await page.clock.runFor(250)
  await page.keyboard.up('KeyW')
  await page.clock.runFor(700)
  expect(await coordinate(page, 'y')).toBeCloseTo(0.24, 3)
  await page.clock.runFor(400)
  expect(await coordinate(page, 'y')).toBeCloseTo(0.24, 3)
  await page.keyboard.down('KeyA')
  await page.clock.runFor(650)
  await page.keyboard.up('KeyA')
  await page.clock.runFor(650)
  expect(await coordinate(page, 'y')).toBeCloseTo(0, 3)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
})
