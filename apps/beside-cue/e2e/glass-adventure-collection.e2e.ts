// Collection album in the real campaign shell — earned originals, safe nested inspection and touch layouts.
import { expect, test } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { readProgress } from '../../../packages/glass-game/src/core/progress'

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(90_000)

test('collection preserves earlier portraits and fits touch layouts with nested artwork inspection @smoke', async ({
  page,
}, testInfo) => {
  const level = MUSEUM_CAMPAIGN[2]!.level
  const saved = {
    ...readProgress(level, null),
    finished: true,
    completedBreakableIds: level.breakables
      .filter((item) => !item.optional)
      .map((item) => item.id),
  }
  await page.addInitScript(
    ({ saved }) => {
      // Only disable scene draws; the actual collection HTML, artwork and host storage stay live.
      for (const method of [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ])
        Object.defineProperty(WebGL2RenderingContext.prototype, method, {
          configurable: true,
          value: () => undefined,
        })
      localStorage.setItem(
        `beside-cue:glass-adventure:progress:${saved.levelId}`,
        JSON.stringify(saved),
      )
    },
    { saved },
  )
  await page.goto('/glass-game/?campaign=1')
  await page.getByRole('button', { name: 'Open museum collection' }).click()
  const album = page.getByRole('dialog', {
    name: 'Your museum collection',
    exact: true,
  })
  await expect(album).toBeVisible()
  await expect(
    album.getByRole('button', { name: 'Inspect The Interval Between' }),
  ).toBeEnabled()
  await expect(
    album.getByRole('button', {
      name: 'Portrait waiting in Glassworks Journey',
    }),
  ).toBeDisabled()
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    const layout = await album.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      background: getComputedStyle(element).backgroundColor,
      imageLoaded: [...element.querySelectorAll('img')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
      controls: [...element.querySelectorAll('button')].map(
        (button) => button.getBoundingClientRect().height,
      ),
    }))
    expect(layout.scroll).toBeLessThanOrEqual(layout.width)
    expect(layout.background).toBe('rgb(250, 245, 231)')
    expect(layout.imageLoaded).toBe(true)
    expect(layout.controls.every((height) => height >= 44)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`museum-collection-${viewport.width}.png`),
    })
  }
  await album
    .getByRole('button', { name: 'Inspect The Interval Between' })
    .click()
  const artwork = page.getByRole('dialog', {
    name: 'The Interval Between',
    exact: true,
  })
  await expect(artwork).toBeVisible()
  await expect(artwork).toContainText('The space between them became a path.')
  expect(
    await album.evaluate((element) => element.closest('[inert]') !== null),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(artwork).not.toBeVisible()
  await expect(
    album.getByRole('button', { name: 'Inspect The Interval Between' }),
  ).toBeFocused()
  await album.getByRole('button', { name: 'Visit gallery' }).nth(1).click()
  await expect(
    page.getByRole('dialog', { name: 'Twin Galleries', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open museum collection' }).click()
  await album.getByRole('button', { name: 'Close collection' }).click()
  await expect(
    page.getByRole('button', { name: 'Open museum collection' }),
  ).toBeFocused()
})
