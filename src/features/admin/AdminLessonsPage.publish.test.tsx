// ============================================================
// The Content Studio's Lessons page — publishing a lesson, and its wording
// ============================================================
//
// What the owner does here: switch a lesson on or off on this site, put it
// back to the code's default, and pick its hook and its tease. Each test
// drives the page as the owner would and reads the result where the owner
// reads it: the request the API got, the row and the card after, the line
// under the control and the live region. The site and the lesson-state API
// are stubbed at `fetch`, the API as a double that keeps state and logs as
// the worker does (lessons/lesson-site.test-fixtures.ts). The read side is
// AdminLessonsPage.test.tsx.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import type { Lesson } from '@/features/lessons/kit/season'
import { LESSONS } from '@/features/lessons/kit/season'
import type { AdminLessonsPageProps } from './AdminLessonsPage'
import { AdminLessonsPage } from './AdminLessonsPage'
import type { CopyChoicesFor } from './lessons/copy-choices'
import { lessonRows } from './lessons/lesson-admin'
import { card, cellOf, liveRegion, openCard, seasonRows, settled, } from './lessons/lesson-page.test-fixtures'
import type { FakeLessonApi, SiteAnswer, } from './lessons/lesson-site.test-fixtures'
import { ADMIN_KEY, fakeLessonApi, logged, stubLessonSite, } from './lessons/lesson-site.test-fixtures'

function seasonLesson(test: (lesson: Lesson) => boolean, what: string): Lesson {
  const lesson = LESSONS.find(test)
  if (lesson === undefined) throw new Error(`no lesson with ${what}`)
  return lesson
}

/** The first draft that waits on a sign-off: Lesson 3 as the season stands. */
const DRAFT = Number(Object.keys(DRAFT_LESSONS)[0])

const FOLLOWS = 'The site follows within about a minute.'

/** The first lesson the kit gives alternative hooks: Lesson 3 as the season stands. */
const VARIED = seasonLesson(
  (lesson) => (lesson.hookAlts ?? []).length > 0,
  'alternative hooks',
)
const VARIED_ALTS = VARIED.hookAlts ?? []

/** The first lesson whose code holds one hook and one tease, so nothing to pick: Lesson 2. */
const LONE = seasonLesson(
  (lesson) =>
    lesson.n > 0 &&
    (lesson.hookAlts ?? []).length === 0 &&
    lesson.tease !== undefined &&
    (lesson.teaseAlts ?? []).length === 0,
  'a lone hook and tease',
)

/** Two hooks for every lesson, and two teases from Lesson 2 on, each variant with its note. */
const CHOICES: CopyChoicesFor = (lesson) => ({
  hooks: [
    { id: 'default', text: lesson.hook, note: '', isDefault: true },
    {
      id: 'figures',
      text: 'Which of two notes is higher, and by how much?',
      note: 'Leads with the numbers, for search.',
      isDefault: false,
    },
  ],
  teases:
    lesson.n < 2
      ? []
      : [
          { id: 'default', text: 'Next: one note.', note: '', isDefault: true },
          {
            id: 'stair',
            text: 'Next: a stair of notes.',
            note: 'Shorter, for the phone card.',
            isDefault: false,
          },
        ],
})

function renderPage(
  api: FakeLessonApi = fakeLessonApi(),
  props: Partial<AdminLessonsPageProps> = {},
  site: Record<string, SiteAnswer> = {},
) {
  const fetchMock = stubLessonSite(site, api)
  render(() => <AdminLessonsPage adminKey={ADMIN_KEY} {...props} />)
  return fetchMock
}

/** An API where lesson `n` is unpublished here, by the owner. */
function unpublishedHere(n: number): FakeLessonApi {
  return fakeLessonApi({
    lessons: { [n]: { published: false } },
    log: [logged({ id: 1, lesson: n, field: 'published', newValue: false })],
  })
}

const bodies = (api: FakeLessonApi) => api.saves.map((save) => save.body)

/** Lesson `n`'s card panel that publishes it. */
const publishPanel = (n: number) =>
  within(card(n)).getByRole('region', { name: 'On this site' })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('publishing a lesson', () => {
  it('unpublishes a lesson from its row, keeping the focus on the switch and saying so', async () => {
    const api = fakeLessonApi()
    renderPage(api)
    await settled()

    const toggle = within(cellOf(1, 0)).getByRole('button', {
      name: 'Unpublish Lesson 1',
    })
    toggle.focus()
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        `Lesson 1 is unpublished here. ${FOLLOWS}`,
      )
    })
    expect(api.saves).toEqual([
      { n: 1, body: { published: false }, key: ADMIN_KEY },
    ])
    expect(toggle).toHaveAccessibleName('Publish Lesson 1')
    expect(toggle).toHaveFocus()
    expect(cellOf(1, 0)).toHaveTextContent(
      `Lesson 1 is unpublished here. ${FOLLOWS}`,
    )
    await waitFor(() => {
      expect(cellOf(1, 0)).toHaveTextContent(
        /^UnpublishedSet here by owner@example, Oct 20, 2:02 PM/,
      )
    })
  })

  it('publishes it again from its card, where "Use default" says what the default is here', async () => {
    const api = unpublishedHere(1)
    renderPage(api)
    await settled()
    openCard(1)

    expect(
      within(publishPanel(1)).getByRole('button', {
        name: 'Use default for Lesson 1',
      }),
    ).toHaveAccessibleDescription(
      'The default here is published: it is released in code.',
    )
    fireEvent.click(
      within(publishPanel(1)).getByRole('button', { name: 'Publish Lesson 1' }),
    )

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        `Lesson 1 is published here. ${FOLLOWS}`,
      )
    })
    expect(bodies(api)).toEqual([{ published: true }])
    expect(cellOf(1, 0)).toHaveTextContent(/^PublishedSet here/)
  })

  it('"Use default" clears the override, says what the default is, and hands the focus to the switch', async () => {
    const api = unpublishedHere(1)
    renderPage(api)
    await settled()
    openCard(1)

    const useDefault = within(publishPanel(1)).getByRole('button', {
      name: 'Use default for Lesson 1',
    })
    useDefault.focus()
    fireEvent.click(useDefault)

    await waitFor(() => {
      expect(
        within(publishPanel(1)).getByRole('button', {
          name: 'Unpublish Lesson 1',
        }),
      ).toHaveFocus()
    })
    expect(bodies(api)).toEqual([{ published: null }])
    expect(api.lessons).toEqual({})
    expect(
      within(publishPanel(1)).queryByRole('button', { name: /^Use default/ }),
    ).toBeNull()
    expect(liveRegion()).toHaveTextContent(
      `Lesson 1 is back to the default here: published. ${FOLLOWS}`,
    )
    expect(cellOf(1, 0)).toHaveTextContent(
      /^PublishedDefault: released in code/,
    )
  })

  it('reads the whole state again after a save, so a change made elsewhere shows too', async () => {
    const api = fakeLessonApi()
    renderPage(api)
    await settled()

    api.lessons['2'] = { published: false }
    fireEvent.click(
      within(cellOf(1, 0)).getByRole('button', { name: 'Unpublish Lesson 1' }),
    )

    await waitFor(() => {
      expect(cellOf(2, 0)).toHaveTextContent(/^UnpublishedSet here/)
    })
    expect(cellOf(1, 0)).toHaveTextContent(/^UnpublishedSet here/)
  })

  it('asks the site again a moment after a save, and shows what it serves then', async () => {
    const site: Record<string, SiteAnswer> = { '/learn/01': { status: 200 } }
    const fetchMock = renderPage(fakeLessonApi(), { recheckAfterMs: 0 }, site)
    await settled()
    expect(cellOf(1, 2)).toHaveTextContent('200 Public')

    site['/learn/01'] = { status: 404 }
    fireEvent.click(
      within(cellOf(1, 0)).getByRole('button', { name: 'Unpublish Lesson 1' }),
    )

    await waitFor(() => {
      expect(cellOf(1, 2)).toHaveTextContent('404 Not found')
    })
    expect(
      fetchMock.mock.calls.filter(([input]) => input === '/learn/01'),
    ).toHaveLength(2)
  })

  it('offers a lesson with no page yet no switch, only a disabled control that says so', async () => {
    renderPage()
    await settled()

    const planned =
      lessonRows().find((row) => row.path !== null && !row.written)?.lesson.n ??
      -1
    expect(planned).toBeGreaterThan(0)
    const control = within(cellOf(planned, 0)).getByRole('button', {
      name: `Publish Lesson ${planned}: No page yet`,
    })
    expect(control).toBeDisabled()
    expect(control).toHaveTextContent(/No page yet$/)
  })

  it('names its lesson on every button, in the table and in an open card', async () => {
    renderPage(unpublishedHere(3), { copyChoices: CHOICES })
    await settled()
    openCard(3)

    seasonRows().forEach((row, n) => {
      const name = new RegExp(`\\b${n === 0 ? 'Trailer' : `Lesson ${n}`}\\b`)
      for (const button of within(row).getAllByRole('button')) {
        expect(button).toHaveAccessibleName(name)
      }
    })
    const cardButtons = within(card(3)).getAllByRole('button')
    expect(cardButtons.length).toBeGreaterThan(5)
    for (const button of cardButtons) {
      expect(button).toHaveAccessibleName(/\bLesson 3\b/)
    }
  })
})

describe('a draft that waits on its sign-off', () => {
  it('asks before publishing it, naming what it waits on, and publishes on "Publish anyway"', async () => {
    const api = unpublishedHere(DRAFT)
    renderPage(api)
    await settled()

    const toggle = within(cellOf(DRAFT, 0)).getByRole('button', {
      name: `Publish Lesson ${DRAFT}`,
    })
    toggle.focus()
    fireEvent.click(toggle)

    const dialog = await screen.findByRole('alertdialog', {
      name: `Publish Lesson ${DRAFT} before its sign-off?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      `Lesson ${DRAFT} waits on ${DRAFT_LESSONS[DRAFT]}. Publish it anyway?`,
    )
    expect(api.saves).toEqual([])

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Publish anyway' }),
    )

    await waitFor(() => {
      expect(toggle).toHaveAccessibleName(`Unpublish Lesson ${DRAFT}`)
    })
    expect(bodies(api)).toEqual([{ published: true }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(toggle).toHaveFocus()
  })

  it('saves nothing when the owner cancels, and gives the focus back to the switch', async () => {
    const api = unpublishedHere(DRAFT)
    renderPage(api)
    await settled()

    const toggle = within(cellOf(DRAFT, 0)).getByRole('button', {
      name: `Publish Lesson ${DRAFT}`,
    })
    toggle.focus()
    fireEvent.click(toggle)
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      }),
    )

    await waitFor(() => {
      expect(toggle).toHaveFocus()
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(api.saves).toEqual([])
    expect(toggle).toHaveAccessibleName(`Publish Lesson ${DRAFT}`)
  })

  it('closes on Escape as on Cancel, saving nothing', async () => {
    const api = unpublishedHere(DRAFT)
    renderPage(api)
    await settled()

    fireEvent.click(
      within(cellOf(DRAFT, 0)).getByRole('button', {
        name: `Publish Lesson ${DRAFT}`,
      }),
    )
    fireEvent.keyDown(await screen.findByRole('alertdialog'), {
      key: 'Escape',
    })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
    expect(api.saves).toEqual([])
  })

  it('unpublishes a draft at once: only publishing it early asks first', async () => {
    const api = fakeLessonApi()
    renderPage(api)
    await settled()

    fireEvent.click(
      within(cellOf(DRAFT, 0)).getByRole('button', {
        name: `Unpublish Lesson ${DRAFT}`,
      }),
    )

    await waitFor(() => {
      expect(bodies(api)).toEqual([{ published: false }])
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('the wording pickers', () => {
  it('saves a hook variant by its id and the default as null, pressing the chosen one', async () => {
    const api = fakeLessonApi()
    renderPage(api, { copyChoices: CHOICES })
    await settled()

    const hook = within(openCard(3)).getByRole('group', { name: 'Hook' })
    expect(hook).toHaveAccessibleDescription(
      'The question Lesson 3 opens with.',
    )
    const [byDefault, figures] = within(hook).getAllByRole('button')
    expect(byDefault).toHaveAccessibleName(
      `Lesson 3 hook: ${LESSONS[3].hook} Default`,
    )
    expect(byDefault).toHaveAttribute('aria-pressed', 'true')
    expect(figures).toHaveAttribute('aria-pressed', 'false')
    expect(figures).toHaveAccessibleDescription(
      'Leads with the numbers, for search.',
    )

    fireEvent.click(figures)
    await waitFor(() => {
      expect(figures).toHaveAttribute('aria-pressed', 'true')
    })
    expect(byDefault).toHaveAttribute('aria-pressed', 'false')
    expect(hook).toHaveTextContent(
      `Lesson 3's hook is now “figures”. ${FOLLOWS}`,
    )

    fireEvent.click(byDefault)
    await waitFor(() => {
      expect(byDefault).toHaveAttribute('aria-pressed', 'true')
    })
    expect(bodies(api)).toEqual([{ hook: 'figures' }, { hook: null }])
    expect(liveRegion()).toHaveTextContent(
      `Lesson 3's hook is back to the default. ${FOLLOWS}`,
    )
  })

  it("labels the tease picker with where its line shows, the lesson before's next-lesson card, and saves a tease", async () => {
    const api = fakeLessonApi()
    renderPage(api, { copyChoices: CHOICES })
    await settled()

    const tease = within(openCard(3)).getByRole('group', { name: 'Tease' })
    expect(tease).toHaveAccessibleDescription(
      "The line above Lesson 3's hook on Lesson 2's next-lesson card.",
    )
    fireEvent.click(
      within(tease).getByRole('button', { name: /Next: a stair of notes/ }),
    )

    await waitFor(() => {
      expect(tease).toHaveTextContent(
        `Lesson 3's tease is now “stair”. ${FOLLOWS}`,
      )
    })
    expect(bodies(api)).toEqual([{ tease: 'stair' }])
    expect(within(openCard(1)).getByText(/^No tease:/)).toHaveTextContent(
      'No tease: its code holds none for Lesson 1.',
    )
  })

  it("offers the season's own wordings: each alternative with the team's note, and a lone wording as text", async () => {
    renderPage()
    await settled()

    const varied = VARIED.n
    const hook = within(openCard(varied)).getByRole('group', { name: 'Hook' })
    const [byDefault, ...alternatives] = within(hook).getAllByRole('button')
    expect(byDefault).toHaveAccessibleName(
      `Lesson ${varied} hook: ${VARIED.hook} Default`,
    )
    expect(byDefault).toHaveAttribute('aria-pressed', 'true')
    expect(alternatives).toHaveLength(VARIED_ALTS.length)
    VARIED_ALTS.forEach((alt, i) => {
      expect(alternatives[i]).toHaveAccessibleName(
        `Lesson ${varied} hook: ${alt.text}`,
      )
      expect(alternatives[i]).toHaveAccessibleDescription(alt.note)
      expect(alternatives[i]).toHaveAttribute('aria-pressed', 'false')
    })

    const lone = openCard(LONE.n)
    expect(within(lone).queryByRole('group')).toBeNull()
    expect(within(lone).getByText(LONE.hook)).toBeVisible()
    expect(within(lone).getByText(LONE.tease ?? '')).toBeVisible()
    expect(
      within(lone).getAllByText('The only wording its code holds.'),
    ).toHaveLength(2)
  })

  it('flags a saved wording this build does not hold, and puts the default back on request', async () => {
    const varied = VARIED.n
    const api = fakeLessonApi({ lessons: { [varied]: { hook: 'gone' } } })
    renderPage(api)
    await settled()

    const hook = within(openCard(varied)).getByRole('group', { name: 'Hook' })
    expect(hook).toHaveTextContent(
      'Saved here as “gone”, a wording this build does not hold, so the pages show the default.',
    )
    const byDefault = within(hook).getByRole('button', {
      name: `Lesson ${varied} hook: ${VARIED.hook} Default`,
    })
    expect(byDefault).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(byDefault)

    await waitFor(() => {
      expect(hook).toHaveTextContent(
        `Lesson ${varied}'s hook is back to the default. ${FOLLOWS}`,
      )
    })
    expect(bodies(api)).toEqual([{ hook: null }])
    expect(hook).not.toHaveTextContent(/Saved here as/)
    expect(byDefault).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a lone wording as text again once the unknown one is cleared', async () => {
    const api = fakeLessonApi({ lessons: { [LONE.n]: { hook: 'gone' } } })
    renderPage(api)
    await settled()

    const hook = within(openCard(LONE.n)).getByRole('group', { name: 'Hook' })
    fireEvent.click(
      within(hook).getByRole('button', {
        name: `Lesson ${LONE.n} hook: ${LONE.hook} Default`,
      }),
    )

    await waitFor(() => {
      expect(card(LONE.n)).toHaveTextContent(
        `Lesson ${LONE.n}'s hook is back to the default. ${FOLLOWS}`,
      )
    })
    expect(bodies(api)).toEqual([{ hook: null }])
    expect(
      within(card(LONE.n)).queryByRole('group', { name: 'Hook' }),
    ).toBeNull()
    expect(within(card(LONE.n)).getByText(LONE.hook)).toBeVisible()
  })
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
