// ============================================================
// The Content Studio's Lessons page — a save that fails, and what it says
// ============================================================
//
// What the owner reads when a save does not land: the API's own words for a
// save it refused, a key it would not accept, and a content API it could not
// reach, each with the lesson left as it was. Driven as
// AdminLessonsPage.publish.test.tsx drives the page, against the same
// doubles at `fetch` (lessons/lesson-site.test-fixtures.ts); its own file,
// so that one stays under TESTING.md's 600-line cap.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminLessonsPageProps } from './AdminLessonsPage'
import { AdminLessonsPage } from './AdminLessonsPage'
import { cellOf, liveRegion, openCard, settled, } from './lessons/lesson-page.test-fixtures'
import type { FakeLessonApi } from './lessons/lesson-site.test-fixtures'
import { ADMIN_KEY, fakeLessonApi, stubLessonSite, unpublishedHere, } from './lessons/lesson-site.test-fixtures'

function renderPage(
  api: FakeLessonApi,
  props: Partial<AdminLessonsPageProps> = {},
) {
  stubLessonSite({}, api)
  render(() => <AdminLessonsPage adminKey={ADMIN_KEY} {...props} />)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('when a save fails', () => {
  it("shows the API's own words for a save it refused, and leaves the lesson as it was", async () => {
    const api = fakeLessonApi()
    api.failNextSave = {
      status: 400,
      body: { error: 'Set at least one of published, hook, or tease' },
    }
    renderPage(api)
    await settled()

    fireEvent.click(
      within(cellOf(1, 0)).getByRole('button', { name: 'Unpublish Lesson 1' }),
    )

    const said =
      'Lesson 1 was not saved: Set at least one of published, hook, or tease.'
    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(said)
    })
    expect(within(cellOf(1, 0)).getByText(said)).toHaveAttribute(
      'data-kind',
      'failed',
    )
    expect(cellOf(1, 0)).toHaveTextContent(
      /^PublishedDefault: released in code/,
    )
    expect(api.lessons).toEqual({})
  })

  it('says a refused key was not accepted, and offers to unlock the studio again', async () => {
    const onChangeKey = vi.fn()
    const api = fakeLessonApi()
    renderPage(api, { adminKey: 'stale-key', onChangeKey })
    await settled()

    fireEvent.click(
      within(cellOf(1, 0)).getByRole('button', { name: 'Unpublish Lesson 1' }),
    )

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        'Lesson 1 was not saved: the admin key was not accepted. Change admin key to unlock the studio again.',
      )
    })
    expect(
      screen.getByText(/^The admin key was not accepted, so this page/),
    ).toHaveTextContent(
      'The admin key was not accepted, so this page cannot save or show who changed what. Change admin key to unlock the studio again.',
    )
    fireEvent.click(
      within(cellOf(1, 0)).getByRole('button', { name: 'Change admin key' }),
    )
    expect(onChangeKey).toHaveBeenCalledTimes(1)
    expect(api.lessons).toEqual({})
  })

  it('says the key was refused when the history cannot be read with it', async () => {
    const onChangeKey = vi.fn()
    renderPage(unpublishedHere(1), { adminKey: 'stale-key', onChangeKey })
    await settled()

    await waitFor(() => {
      expect(
        within(openCard(1)).getByText(/^Its history could not be read/),
      ).toHaveTextContent(
        'Its history could not be read: the admin key was not accepted.',
      )
    })
    expect(cellOf(1, 0)).toHaveTextContent(
      /^UnpublishedSet herePublish Lesson 1$/,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change admin key' }))
    expect(onChangeKey).toHaveBeenCalledTimes(1)
  })

  it('says when the content API could not be reached at all', async () => {
    const api = fakeLessonApi()
    api.failNextSave = 'offline'
    renderPage(api)
    await settled()

    fireEvent.click(
      within(cellOf(1, 0)).getByRole('button', { name: 'Unpublish Lesson 1' }),
    )

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        'Lesson 1 was not saved: the content API could not be reached. Check the connection, then try again.',
      )
    })
    expect(
      within(cellOf(1, 0)).getByRole('button', { name: 'Unpublish Lesson 1' }),
    ).not.toHaveAttribute('aria-disabled')
  })
})
