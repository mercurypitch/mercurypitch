// ============================================================
// A lesson page's answers: the beacon loads on the first, and this bundle sends none
// ============================================================
//
// kit/telemetry.ts sends each question's first answer in a visit as one
// anonymous `lesson_answer` event, but only from a page the site worker
// served (one with `#lesson-state`) in a build with an API base. The e2e
// bundle has no API base (`build:e2e` empties VITE_API_BASE_URL), so it
// cannot show the requests the beacon makes on mercurypitch.com; what each
// one carries, and that a re-answer after Reset sends none, is held by
// kit/quiz.test.ts and kit/telemetry.test.ts. What the built page can show
// is held here: the beacon is no first-paint work, it loads on the quiz's
// first answer, and the page sends nothing from this bundle, even when it
// is served with its state as the site worker serves it.

import type { Page, Request } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** The beacon's own chunk, as Vite names it. */
const BEACON_CHUNK = /\/assets\/telemetry-[\w-]+\.js$/

/** Serves `path` with a lesson state in its head, as the site worker would (learn-publish-state.spec.ts). */
async function serveWithState(page: Page, path: string): Promise<void> {
  const tag = `<script type="application/json" id="lesson-state">${JSON.stringify(
    {
      version: 1,
      updatedAt: '2026-10-22T09:30:00.000Z',
      lessons: {},
      drafts: false,
    },
  )}</script>`
  await page.route(`**${path}`, async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    expect(html).toContain('</head>')
    // The body goes back decoded and longer, so neither header holds.
    const headers = { ...response.headers() }
    delete headers['content-length']
    delete headers['content-encoding']
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace('</head>', `${tag}</head>`),
    })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(path)
}

test('Lesson 2 loads the beacon on its first answer and, with no API base, sends nothing', async ({
  page,
}) => {
  // Arrange: catch the event route and every script the page asks for
  const events: Request[] = []
  await page.route('**/api/mirror/event', async (route) => {
    events.push(route.request())
    await route.fulfill({ status: 201, body: '{"ok":true}' })
  })
  const scripts: string[] = []
  page.on('request', (request) => scripts.push(request.url()))
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await serveWithState(page, '/learn/02')
  const check = page.locator('#qs .q')
  await expect(check).toHaveCount(4)
  expect(scripts.filter((url) => BEACON_CHUNK.test(url))).toEqual([])

  // Act: two questions answered, the first of them again after Reset
  const beacon = page.waitForResponse((response) =>
    BEACON_CHUNK.test(response.url()),
  )
  await check.nth(0).getByRole('button', { name: '7', exact: true }).click()
  await beacon
  await page.locator('#quizReset').click()
  await check.nth(0).getByRole('button', { name: '12', exact: true }).click()
  await check
    .nth(1)
    .getByRole('button', { name: 'The second', exact: true })
    .click()
  await expect(page.locator('#scoreN')).toHaveText('2')
  // the beacon's sends run once its import settles: give them a turn
  await page.evaluate(
    () => new Promise<void>((resolve) => window.setTimeout(resolve, 100)),
  )

  // Assert
  expect(scripts.filter((url) => BEACON_CHUNK.test(url))).toHaveLength(1)
  expect(events).toEqual([])
  expect(errors).toEqual([])
})
