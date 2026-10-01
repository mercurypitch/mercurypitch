// Glassworks web delivery — prove the canonical museum document and staged assets boot together.

import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

// The production web build serves /glass-game without listing it
// (tools/glassworks-listing.ts); `build:e2e` lists it, like the dev deploy.
// Read the state off the served sitemap, so this file can walk either build.
async function glassworksListed(request: APIRequestContext): Promise<boolean> {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  return sitemap.includes('<loc>https://mercurypitch.com/glass-game</loc>')
}

test('home offers a responsive keyboard-accessible Glassworks entrance @smoke', async ({
  page,
}) => {
  test.skip(
    !(await glassworksListed(page.request)),
    'this build does not list Glassworks',
  )
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

test('an unlisted build hides the entrance and still serves the museum @smoke', async ({
  page,
}) => {
  test.skip(await glassworksListed(page.request), 'this build lists Glassworks')
  await page.addInitScript(() => {
    Object.assign(window, { E2E_TEST_MODE: true })
  })
  await page.goto('/')
  await dismissOverlays(page)
  await expect(page.locator('[data-destination="practice"]')).toBeVisible()
  await expect(page.locator('[data-destination="glassworks"]')).toHaveCount(0)
  await expect(page.locator('a[href="/glass-game"]')).toHaveCount(0)

  const llms = await (await page.request.get('/llms.txt')).text()
  expect(llms).not.toContain('/glass-game')

  // A hard load of the clean path is still the museum, answered with a 200.
  const response = await page.goto('/glass-game')
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-campaign')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, follow',
  )
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

  const legacyDocument = await (await page.request.get('/glass')).text()
  const campaignDocument = await (await page.request.get('/glass-game')).text()
  expect(legacyDocument).toContain(
    '<link rel="canonical" href="https://mercurypitch.com/glass"',
  )
  expect(campaignDocument).toContain(
    '<link rel="canonical" href="https://mercurypitch.com/glass-game"',
  )
  expect(campaignDocument).not.toBe(legacyDocument)
  expect(campaignDocument).toContain(
    (await glassworksListed(page.request))
      ? '<meta name="robots" content="index, follow" />'
      : '<meta name="robots" content="noindex, follow" />',
  )

  await page.goto('/glass-game')
  await expect(page).toHaveURL(/\/glass-game$/u)
  await expect(page.getByTestId('glass-campaign')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Glassworks', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Locked: Resonance Conservatory' }),
  ).toBeDisabled()
  const entrance = page.getByRole('button', {
    name: 'Enter First Light Gallery',
  })
  await expect(entrance).toBeVisible()
  await expect(entrance).toBeEnabled()

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

  await entrance.focus()
  await expect(entrance).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.locator('[data-testid="glass-adventure"][data-ready="true"]'),
  ).toBeVisible({ timeout: 150_000 })
  await expect(page.locator('canvas')).toBeVisible()
  expect(failedAssets).toEqual([])
  expect(pageErrors).toEqual([])
})
