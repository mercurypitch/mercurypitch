// Living crystal browser gate — compile and draw the real shell/interior before admitting either art study.

import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 640, height: 480 },
  deviceScaleFactor: 1,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

for (const [variant, quality] of [
  ['pearl-roots', 'high'],
  ['living-amber', 'balanced'],
] as const) {
  test(`${variant} compiles, draws and survives a real camera drag @smoke`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    const diagnostics: Promise<unknown>[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text())
        diagnostics.push(
          Promise.all(message.args().map((arg) => arg.jsonValue())),
        )
      }
    })
    await page.addInitScript((preference) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(`${prefix}render-quality:v1`, preference)
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
    }, quality)
    const model = page.waitForResponse(
      (response) =>
        response.url().includes('/games/crystal-interiors-v2/') &&
        response.url().endsWith('.glb'),
    )
    await page.goto(`/glass-game/?layout=living-crystal&interior=${variant}`, {
      waitUntil: 'domcontentloaded',
    })
    expect((await model).status()).toBe(200)
    const adventure = page.getByTestId('glass-adventure')
    // Ready requires the real renderer's first successful frame; no WebGL
    // methods are stubbed here. This caught the missing fog vertex variable.
    await expect(adventure).toHaveAttribute('data-ready', 'true', {
      timeout: 90_000,
    })
    expect(errors, JSON.stringify(await Promise.all(diagnostics))).toEqual([])
    const viewport = page.getByLabel('Glass museum; drag to look around')
    const bounds = await viewport.boundingBox()
    if (bounds === null) throw new Error('Missing crystal study viewport.')
    await page.mouse.move(
      bounds.x + bounds.width * 0.45,
      bounds.y + bounds.height * 0.4,
    )
    await page.mouse.down()
    await page.mouse.move(
      bounds.x + bounds.width * 0.7,
      bounds.y + bounds.height * 0.52,
      { steps: 8 },
    )
    await page.mouse.up()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    await expect(adventure).toHaveAttribute('data-ready', 'true')
    await expect(
      page.getByRole('button', { name: 'Retry', exact: true }),
    ).toHaveCount(0)
    expect(errors, JSON.stringify(await Promise.all(diagnostics))).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`${variant}-actual-renderer.png`),
    })
  })
}
