// Museum solid contact — real keyboard landings, missed-edge separation and plinth traversal.
import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { installCloudwayVisit, setHeading, } from './helpers/cloudway-platform-proof'

const EDGE_RENDER_PROOF = process.env.GLASS_EDGE_RENDER_PROOF === '1'

test.use({
  headless: !EDGE_RENDER_PROOF,
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: EDGE_RENDER_PROOF
      ? ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})

for (const crossing of [
  { name: 'clear landing', movementMilliseconds: 600 },
  { name: 'grazing edge', movementMilliseconds: 650 },
  { name: 'clear miss', movementMilliseconds: 800 },
  { name: 'short approach', movementMilliseconds: 650 },
] as const) {
  test(`Promenade ${crossing.name} keeps Merc outside the platform slab @smoke`, async ({
    page,
  }, testInfo) => {
    await installCloudwayVisit(page, { realRendering: EDGE_RENDER_PROOF })
    await page.addInitScript((renderProof) => {
      localStorage.setItem(
        'beside-cue:glass-adventure:camera-mode:v1',
        renderProof ? 'third-person' : 'first-person',
      )
    }, EDGE_RENDER_PROOF)
    await page.clock.install()
    await page.goto('/glass-game/?layout=cloudway-laboratory')
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    await page.clock.pauseAt(
      (await page.evaluate(() => Date.now())) + 3_600_000,
    )
    const shortApproach = crossing.name === 'short approach'
    await setHeading(page, shortApproach ? Math.PI : -Math.PI / 2)
    await page.getByLabel('Glass museum; drag to look around').focus()
    await page.keyboard.down('KeyW')
    if (shortApproach) await page.clock.runFor(300)
    await page.keyboard.down('Space')
    await page.clock.runFor(32)
    await page.keyboard.up('Space')
    await page.clock.runFor(crossing.movementMilliseconds - 32)
    await page.keyboard.up('KeyW')

    // The real Pearl deck ends at x=.75; Merc has a .16 m body radius.
    // A jump ending on the deck must land. A grazing miss must be
    // separated from the side instead of sinking through the slab.
    const samples: { x: number; y: number; z: number }[] = []
    let capturedContact = false
    for (let frame = 0; frame < 20; frame++) {
      await page.clock.runFor(16)
      samples.push({
        x: await coordinate(page, 'x'),
        y: await coordinate(page, 'y'),
        z: await coordinate(page, 'z'),
      })
      if (EDGE_RENDER_PROOF && !capturedContact && samples.at(-1)!.y <= 0) {
        await page.screenshot({ path: testInfo.outputPath('edge-contact.png') })
        capturedContact = true
      }
    }
    await expect(game).toHaveAttribute('data-ready', 'true')
    const final = samples.at(-1)!
    if (shortApproach) {
      expect(final.x).toBeCloseTo(-0.2, 2)
      expect(final.z).toBeGreaterThan(-9.8)
      expect(final.y).toBeLessThan(-0.1)
    } else {
      expect(final.z).toBeCloseTo(-11.16, 2)
      expect(final.x).toBeGreaterThan(
        crossing.name === 'clear landing' ? 0.6 : 0.75,
      )
    }
    if (crossing.name === 'clear landing') {
      expect(final.y).toBeCloseTo(0, 4)
      expect(final.x).toBeLessThanOrEqual(0.75)
    } else {
      expect(final.y).toBeLessThan(-0.1)
      expect(
        samples.some((sample) => sample.y < -1e-6 && sample.y + 0.5 > -0.34),
      ).toBe(true)
    }
    if (crossing.name === 'clear miss') {
      expect(final.x).toBeGreaterThan(0.91)
      expect(final.y).toBeLessThan(-0.1)
    }
    for (const sample of samples) {
      const overlapsSlabHeight = sample.y < -1e-6 && sample.y + 0.5 > -0.34
      if (overlapsSlabHeight) {
        const message = `Merc penetrated Pearl's side: ${JSON.stringify(sample)}`
        if (shortApproach)
          expect(sample.z + 0.16, message).toBeLessThanOrEqual(-9.53 + 1e-6)
        else
          expect(sample.x - 0.16, message).toBeGreaterThanOrEqual(0.75 - 1e-6)
      }
    }
    if (EDGE_RENDER_PROOF) {
      const graphics = await page
        .getByLabel('Floating glass museum')
        .evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext('webgl2')
          const debug = context?.getExtension('WEBGL_debug_renderer_info')
          return context && debug
            ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
            : 'unavailable'
        })
      expect(graphics).not.toBe('unavailable')
      expect(graphics).not.toMatch(/SwiftShader|llvmpipe/i)
      await page.screenshot({
        path: testInfo.outputPath(`${crossing.name.replace(' ', '-')}.png`),
      })
      const receiptPath = testInfo.outputPath('edge-contact-samples.json')
      writeFileSync(receiptPath, JSON.stringify({ graphics, samples }, null, 2))
      await testInfo.attach('edge-contact-samples', {
        path: receiptPath,
        contentType: 'application/json',
      })
    }
  })
}
// Scene loading is real; the controlled physics section skips pixel raster work.
test.setTimeout(120_000)

async function coordinate(page: Page, axis: string): Promise<number> {
  return Number(
    await page
      .getByTestId('glass-adventure')
      .getAttribute(`data-player-${axis}`),
  )
}

async function suspendRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2')
      if (gl === null)
        throw new Error('The museum WebGL2 context is unavailable')
      const noop = () => undefined
      Object.defineProperties(gl, {
        clear: { configurable: true, value: noop },
        drawArrays: { configurable: true, value: noop },
        drawArraysInstanced: { configurable: true, value: noop },
        drawElements: { configurable: true, value: noop },
        drawElementsInstanced: { configurable: true, value: noop },
      })
    })
}

test('Merc walks across the small arrival join without jumping @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    localStorage.setItem(
      'beside-cue:glass-adventure:museum-audio:v1',
      JSON.stringify({ muted: true }),
    )
  })
  await page.clock.install()
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 },
  )
  await suspendRasterOutput(page)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  await page.getByLabel('Glass museum; drag to look around').focus()
  await page.keyboard.down('KeyW')
  await page.clock.runFor(2000)
  await page.keyboard.up('KeyW')
  expect(await coordinate(page, 'z')).toBeGreaterThan(3.1)
  expect(await coordinate(page, 'y')).toBeCloseTo(0, 4)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    'goblet',
  )
})

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
  // The authored scene has now loaded through the real renderer. This test
  // exercises simulation and collision, so avoid making software WebGL shade
  // hundreds of unrelated pixels while Playwright advances the physics clock.
  await suspendRasterOutput(page)
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
