// Glassworks web delivery — prove the canonical museum document and staged assets boot together.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test('home offers a responsive keyboard-accessible Glassworks entrance @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { E2E_TEST_MODE: true })
  })
  const viewports = [
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await dismissOverlays(page)

    const entrance = page.getByRole('link', { name: /Play Glassworks/u })
    await entrance.scrollIntoViewIfNeeded()
    await expect(entrance).toBeVisible()
    const bounds = await entrance.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect(
      (bounds?.x ?? 0) + (bounds?.width ?? viewport.width + 1),
    ).toBeLessThanOrEqual(viewport.width)
  }

  const entrance = page.getByRole('link', { name: /Play Glassworks/u })
  await entrance.focus()
  await expect(entrance).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/glass-game$/u)
  await expect(page.getByTestId('glass-campaign')).toBeVisible()
})

test('Glassworks opens from its own entry and loads a real gallery @smoke', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 720, height: 540 })
  const failedAssets: string[] = []
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    if (request.url().includes('/glass-game-assets/'))
      failedAssets.push(`failed ${request.url()}`)
  })
  page.on('response', (response) => {
    if (
      response.url().includes('/glass-game-assets/') &&
      response.status() >= 400
    )
      failedAssets.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/glass-game')
  await expect(page).toHaveURL(/\/glass-game$/u)
  await expect(page.getByTestId('glass-campaign')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Glassworks', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Enter Resonance Conservatory' }),
  ).toBeVisible()

  // Decode the card while the museum models are still loading. Once the
  // multi-million-triangle map is animating, SwiftShader can starve an
  // unrelated DOM poll even though the cover is already on screen.
  const firstCover = page
    .getByTestId('glass-campaign')
    .locator('article img')
    .first()
  await expect(firstCover).toBeVisible()
  const cover = await firstCover.evaluate(async (element) => {
    if (!(element instanceof HTMLImageElement))
      throw new Error('The first gallery cover is not an image.')
    await element.decode()
    return {
      complete: element.complete,
      naturalHeight: element.naturalHeight,
      naturalWidth: element.naturalWidth,
    }
  })
  expect(cover.complete).toBe(true)
  expect(cover.naturalHeight).toBeGreaterThan(0)
  expect(cover.naturalWidth).toBeGreaterThan(0)

  await expect(
    page.getByTestId('glass-campaign').locator('[data-map-state]'),
  ).toHaveAttribute('data-map-state', 'ready', { timeout: 60_000 })

  await page.getByRole('button', { name: 'Enter First Light Gallery' }).click()
  await expect(
    page.locator('[data-testid="glass-adventure"][data-ready="true"]'),
  ).toBeVisible({ timeout: 150_000 })
  await expect(page.locator('canvas')).toBeVisible()

  const legacyDocument = await (await page.request.get('/glass')).text()
  const campaignDocument = await (await page.request.get('/glass-game')).text()
  expect(legacyDocument).toContain(
    '<link rel="canonical" href="https://mercurypitch.com/glass"',
  )
  expect(campaignDocument).toContain(
    '<link rel="canonical" href="https://mercurypitch.com/glass-game"',
  )
  expect(campaignDocument).not.toBe(legacyDocument)
  expect(failedAssets).toEqual([])
  expect(pageErrors).toEqual([])
})
