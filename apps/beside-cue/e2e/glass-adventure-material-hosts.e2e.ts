// Museum material integration — decorative tiles must fill their real touch controls in every engine.
import { expect, test } from '@playwright/test'

test.use({ hasTouch: true })
test.setTimeout(120_000)

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`museum glass tiles stay centered in their buttons at ${viewport.width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/glass-game/?campaign=1')
    const settings = page.getByRole('button', {
      name: 'Open museum settings',
      exact: true,
    })
    await expect(settings).toBeVisible()
    await expect(page.locator('[data-map-state]')).toHaveAttribute(
      'data-map-state',
      'ready',
      { timeout: 60_000 },
    )
    const title = page.getByRole('heading', { name: 'Glassworks', exact: true })
    const tagline = title.locator('..').locator('p')
    if (await tagline.isVisible()) {
      const headingBox = (await title.boundingBox())!
      const taglineBox = (await tagline.boundingBox())!
      expect(taglineBox.y).toBeGreaterThanOrEqual(
        headingBox.y + headingBox.height,
      )
    }
    for (const theme of ['Crystal', 'Celadon']) {
      await settings.tap()
      const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
      if (viewport.width < 600) {
        const inset = await dialog.evaluate((element) => {
          const surface = element
            .querySelector('[data-game-surface]')!
            .getBoundingClientRect()
          const header = element
            .querySelector('header')!
            .getBoundingClientRect()
          return Math.min(
            header.left - surface.left,
            header.top - surface.top,
            surface.right - header.right,
          )
        })
        expect(inset).toBeGreaterThanOrEqual(20)
      }
      await dialog.getByRole('tab', { name: 'Appearance', exact: true }).tap()
      await dialog.getByRole('button', { name: theme, exact: true }).tap()
      await dialog
        .getByRole('button', { name: 'Close settings', exact: true })
        .tap()
      const tiles = page.locator('button > [data-game-surface="tile"]')
      await expect(tiles).toHaveCount(3)
      for (const tile of await tiles.all()) {
        await expect
          .poll(() =>
            tile.evaluate((element) => {
              const tileBox = element.getBoundingClientRect()
              const button = element.parentElement!.getBoundingClientRect()
              const icon = element
                .querySelector('[data-game-icon]')!
                .getBoundingClientRect()
              return Math.max(
                Math.abs(tileBox.x - button.x),
                Math.abs(tileBox.y - button.y),
                Math.abs(tileBox.width - button.width),
                Math.abs(tileBox.height - button.height),
                Math.abs(icon.x + icon.width / 2 - button.x - button.width / 2),
                Math.abs(
                  icon.y + icon.height / 2 - button.y - button.height / 2,
                ),
              )
            }),
          )
          .toBeLessThanOrEqual(0.5)
      }
      const card = page.locator('article').filter({
        has: page.getByRole('button', { name: /^Open selected gallery:/ }),
      })
      if (viewport.width < 600) {
        const rail = page.getByRole('navigation', {
          name: 'Select a museum island',
        })
        expect((await rail.boundingBox())!.height).toBeLessThanOrEqual(48)
        expect((await card.boundingBox())!.height).toBeLessThanOrEqual(136)
        for (const chip of await rail.getByRole('button').all())
          expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      await expect
        .poll(() =>
          card.evaluate((element) => {
            const frame =
              element.querySelector<SVGSVGElement>('[data-game-frame]')!
            const box = frame.getBoundingClientRect()
            const outline =
              frame.querySelector<SVGPathElement>('clipPath path')!
            const patches = [
              ...frame.querySelectorAll<SVGSVGElement>(':scope > svg'),
            ]
            const painted = (x: number, y: number): boolean => {
              const patch = patches.find(
                (part) =>
                  x >= part.x.baseVal.value &&
                  y >= part.y.baseVal.value &&
                  x <= part.x.baseVal.value + part.width.baseVal.value &&
                  y <= part.y.baseVal.value + part.height.baseVal.value,
              )
              if (!patch) return false
              const source = patch.viewBox.baseVal
              return outline.isPointInFill(
                new DOMPoint(
                  source.x +
                    ((x - patch.x.baseVal.value) / patch.width.baseVal.value) *
                      source.width,
                  source.y +
                    ((y - patch.y.baseVal.value) / patch.height.baseVal.value) *
                      source.height,
                ),
              )
            }
            // Inspect the actual cut-glass outline, not just its rectangular DOM owner.
            return [...element.querySelectorAll('img, button, span, p, h2')]
              .filter((child) => {
                const rect = child.getBoundingClientRect()
                if (!rect.width || !rect.height) return false
                return [
                  [rect.x + 2, rect.y + 2],
                  [rect.right - 2, rect.y + 2],
                  [rect.right - 2, rect.bottom - 2],
                  [rect.x + 2, rect.bottom - 2],
                ].some(([x, y]) => !painted(x! - box.x, y! - box.y))
              })
              .map(
                (child) =>
                  child.tagName + ':' + child.textContent?.slice(0, 40),
              )
          }),
        )
        .toEqual([])
      await page.screenshot({
        path: testInfo.outputPath(`museum-material-hosts-${theme}.png`),
      })
    }
  })
}

test('runner native microphone selector follows both material themes @smoke', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:comfortable-note', '61')
  })
  await page.goto('/glass-game/?layout=singing-current')
  await expect(
    page.getByRole('button', { name: 'Start course', exact: true }),
  ).toBeEnabled({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Open settings', exact: true }).tap()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  for (const [theme, scheme, ink] of [
    ['Crystal', 'light', 'rgb(21, 59, 67)'],
    ['Celadon', 'dark', 'rgb(255, 249, 233)'],
  ]) {
    await settings.getByRole('tab', { name: 'Display', exact: true }).tap()
    await settings.getByRole('button', { name: theme, exact: true }).tap()
    await settings.getByRole('tab', { name: 'Sound', exact: true }).tap()
    const microphone = settings.getByRole('combobox', {
      name: 'Microphone',
      exact: true,
    })
    await expect(microphone).toHaveCSS('color-scheme', scheme)
    await expect(microphone).toHaveCSS('color', ink)
    await microphone.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath(`native-selector-${theme}.png`),
    })
  }
})

test('compact museum cards keep every gallery title and entry inside the frame @smoke', async ({
  page,
}, testInfo) => {
  await page.goto('/glass-game/?campaign=1')
  await expect(page.locator('[data-map-state]')).toHaveAttribute(
    'data-map-state',
    'ready',
    { timeout: 60_000 },
  )
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const choice of await page
      .getByRole('navigation', { name: 'Select a museum island' })
      .getByRole('button')
      .all()) {
      await choice.tap()
      await expect(choice).toHaveAttribute('aria-pressed', 'true')
      const label = choice.locator('span').last()
      expect(
        await label.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      const enter = page.getByRole('button', {
        name: /^Open selected gallery:/,
      })
      const geometry = await enter.evaluate((button) => {
        const card = button.closest('article')!.getBoundingClientRect()
        const content = button.parentElement!.getBoundingClientRect()
        const title = button
          .parentElement!.querySelector('h2')!
          .getBoundingClientRect()
        const action = button.getBoundingClientRect()
        return {
          title: title.toJSON(),
          action: action.toJSON(),
          content: content.toJSON(),
          card: card.toJSON(),
        }
      })
      expect(geometry.action.height).toBeGreaterThanOrEqual(44)
      expect(geometry.action.bottom).toBeLessThanOrEqual(
        geometry.content.bottom,
      )
      expect(geometry.title.bottom).toBeLessThanOrEqual(geometry.action.top)
      expect(geometry.title.right).toBeLessThanOrEqual(geometry.content.right)
      expect(geometry.action.bottom).toBeLessThanOrEqual(
        geometry.card.bottom - 12,
      )
    }
    await page.screenshot({
      path: testInfo.outputPath(`long-gallery-${width}.png`),
    })
  }
})
