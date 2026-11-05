// ============================================================
// A lesson held back: lesson pages served as the console's state serves them
// ============================================================
//
// The e2e bundle shows drafts, and once every lesson in the season has a
// page, none is coming later of itself. A browser test of a lesson coming
// later asks the page state to hold one back instead, as
// learn-publish-state.spec.ts does: each lesson document the page opens is
// handed over with the `#lesson-state` tag the site worker writes
// (src/lesson-gate.ts), saying that lesson is not published, and the page
// draws it as a lesson not written yet, with no page and no reading time
// (kit/publish.ts `seasonFor`). A unit test does it in the season itself
// (season.test-fixtures.ts `withNoPage`).

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { Lesson } from '../../features/lessons/kit/season'
import { LESSONS } from '../../features/lessons/kit/season'

/** The lesson held back: the season's last, so the lesson before it has a page. */
export const HELD_BACK: Lesson = LESSONS[LESSONS.length - 1]

/** A lesson document's path: /learn/02 or /learn/02.html. */
const LESSON_DOC = /^\/learn\/\d{2}(\.html)?$/

/**
 * Serves every lesson document this page opens from now on with lesson `n`
 * held back, drafts shown as the e2e bundle shows them.
 */
export async function holdBack(page: Page, n = HELD_BACK.n): Promise<void> {
  const tag = `<script type="application/json" id="lesson-state">${JSON.stringify(
    {
      version: 1,
      updatedAt: '2026-10-20T09:30:00.000Z',
      drafts: true,
      lessons: { [n]: { published: false } },
    },
  ).replace(/</g, '\\u003c')}</script>`
  await page.route(
    (url) => LESSON_DOC.test(url.pathname),
    async (route) => {
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
    },
  )
}
