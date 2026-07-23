import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test('stale Session Editor chunk reloads once and recovers @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })

  let staleChunkServed = false
  await page.route(/\/assets\/SessionEditor-[^/]+\.js$/, async (route) => {
    if (!staleChunkServed) {
      staleChunkServed = true
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Stale SPA fallback</title>',
      })
      return
    }
    await route.continue()
  })

  let documentRequests = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest()) documentRequests += 1
  })

  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10_000 })
  await dismissOverlays(page)
  await switchTab(page, 'compose')
  await page.locator('[data-testid="view-session-editor"]').click()

  await expect
    .poll(() => documentRequests, {
      message: 'the stale lazy chunk should trigger one document reload',
    })
    .toBe(2)

  await page.waitForSelector('#app-tabs', { timeout: 10_000 })
  await dismissOverlays(page)
  await switchTab(page, 'compose')
  await page.locator('[data-testid="view-session-editor"]').click()

  await expect(page.locator('[data-testid="session-editor"]')).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Application error' }),
  ).toHaveCount(0)
  expect(documentRequests).toBe(2)
})
