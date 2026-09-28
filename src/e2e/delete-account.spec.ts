// ============================================================
// The account deletion page loads on a hard load, signed out
// ============================================================
//
// Google Play links /delete-account as the place to ask for deletion without
// the app. A reviewer, or somebody who has uninstalled the app, types the
// address in cold: no session, nothing booted. Two things could hand them
// something else. The asset layer could answer the 404 page, and a visitor
// who has used the studio before has a service worker that answers every
// navigation it does not know with the cached app shell.

import { expect, test } from '@playwright/test'

test('a hard load of /delete-account answers 200 with the page @smoke', async ({
  page,
}) => {
  const response = await page.goto('/delete-account')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('Delete your account | MercuryPitch')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Delete your MercuryPitch account',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'What is kept, and for how long' }),
  ).toBeVisible()
})

test('a visitor with the studio installed still gets the page, not the shell @smoke', async ({
  page,
}) => {
  await page.goto('/')
  // Registration is deferred to `load` (src/lib/pwa-service-worker.ts), and
  // the worker does not claim the page that registered it: one reload hands
  // it control, as in pwa.spec.ts.
  await page.waitForFunction(
    async () =>
      (await navigator.serviceWorker.getRegistration('/')) !== undefined,
    undefined,
    { timeout: 20_000 },
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  )

  await page.goto('/delete-account')

  await expect(page).toHaveTitle('Delete your account | MercuryPitch')
  await expect(page.locator('#root')).toHaveCount(0)
})
