// ============================================================
// The Content Studio's Lessons page — publishing ahead of a lesson it builds on
// ============================================================
//
// A lesson's page points back to the lessons it builds on (season.ts
// PREREQ), which its prerequisite chips name, and to the lesson its recall
// asks (lesson-admin.ts RECALLS, for the two recalls outside PREREQ).
// Before the console publishes a lesson while one of those is not
// published here, it asks, whether a drafts line stands or not; for a
// draft that would also get ahead of one, it asks once, naming both.
// "Use default" asks the same question when going back to the default
// would put the lesson live, and saves at once otherwise. Unpublishing
// never asks.
// Driven as AdminLessonsPage.publish.test.tsx drives the page, against the
// same doubles at `fetch`; its own file, so that one and
// AdminLessonsPage.test.tsx stay as they are.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import { PREREQ } from '@/features/lessons/kit/season'
import { AdminLessonsPage } from './AdminLessonsPage'
import type { LessonRow } from './lessons/lesson-admin'
import { lessonRows } from './lessons/lesson-admin'
import { card, cellOf, openCard, settled, } from './lessons/lesson-page.test-fixtures'
import type { FakeLessonApi } from './lessons/lesson-site.test-fixtures'
import { ADMIN_KEY, fakeLessonApi, stubLessonSite, } from './lessons/lesson-site.test-fixtures'

// Each test renders the whole Lessons page, every lesson's row and card, and
// waits for its site checks and its state read. On a loaded machine the first
// test in the file, which pays for a cold start, has run past Vitest's 5 s
// default, so this file gets 20 s (TESTING.md section 3.7).
vi.setConfig({ testTimeout: 20_000 })

/** The first lesson in `build` that builds on exactly one other, and that one. */
function buildingOnOne(build: LessonRow['build']): [number, number] {
  for (const row of lessonRows()) {
    const before = PREREQ[row.lesson.n] ?? []
    if (row.build === build && before.length === 1) {
      return [row.lesson.n, before[0]]
    }
  }
  throw new Error(`no ${build} lesson builds on exactly one other`)
}

/** A released lesson and the one it builds on: Lessons 2 and 1 as the season stands. */
const [RELEASED, RELEASED_ON] = buildingOnOne('released')

/** A draft and the one it builds on: Lessons 3 and 1 as the season stands. */
const [DRAFT, DRAFT_ON] = buildingOnOne('draft')

/** An API where each of `lessons` is unpublished here. */
function unpublished(...lessons: number[]): FakeLessonApi {
  return fakeLessonApi({
    lessons: Object.fromEntries(
      lessons.map((n) => [String(n), { published: false }]),
    ),
  })
}

function renderPage(api: FakeLessonApi): void {
  stubLessonSite({}, api)
  render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
}

const switchOf = (n: number, name: 'Publish' | 'Unpublish') =>
  within(cellOf(n, 0)).getByRole('button', { name: `${name} Lesson ${n}` })

const bodies = (api: FakeLessonApi) => api.saves.map((save) => save.body)

/** Lesson `n`'s card panel that publishes it, with "Use default". */
const publishPanel = (n: number) =>
  within(card(n)).getByRole('region', { name: 'On this site' })

/** Lesson `n`'s "Use default", in its card, opened from its row. */
function useDefaultOf(n: number): HTMLElement {
  openCard(n)
  return within(publishPanel(n)).getByRole('button', {
    name: `Use default for Lesson ${n}`,
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('publishing a lesson ahead of one it builds on', () => {
  it('asks first, naming the lesson it builds on, and saves nothing yet', async () => {
    // Arrange: the lesson it builds on is released in code but unpublished
    // here, so the page goes by its own state, not the build's.
    const api = unpublished(RELEASED_ON, RELEASED)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(RELEASED, 'Publish'))

    // Assert
    const dialog = await screen.findByRole('alertdialog', {
      name: `Publish Lesson ${RELEASED} before Lesson ${RELEASED_ON}?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      `Lesson ${RELEASED} builds on Lesson ${RELEASED_ON}, which is not published here. Publish it anyway?`,
    )
    expect(api.saves).toEqual([])
  })

  it('publishes at once when the lesson it builds on is published here', async () => {
    // Arrange
    const api = unpublished(RELEASED)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(RELEASED, 'Publish'))

    // Assert
    await waitFor(() => {
      expect(bodies(api)).toEqual([{ published: true }])
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks a draft once, in words that name its sign-off and the lesson it builds on', async () => {
    // Arrange
    const api = unpublished(DRAFT_ON, DRAFT)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(DRAFT, 'Publish'))

    // Assert
    const dialog = await screen.findByRole('alertdialog', {
      name: `Publish Lesson ${DRAFT} before its sign-off and before Lesson ${DRAFT_ON}?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      `Lesson ${DRAFT} waits on ${DRAFT_LESSONS[DRAFT]}. It also builds on Lesson ${DRAFT_ON}, which is not published here. Publish it anyway?`,
    )
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  })

  it('publishes the draft on one "Publish anyway", with no second question', async () => {
    // Arrange
    const api = unpublished(DRAFT_ON, DRAFT)
    renderPage(api)
    await settled()
    fireEvent.click(switchOf(DRAFT, 'Publish'))
    const dialog = await screen.findByRole('alertdialog')

    // Act
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Publish anyway' }),
    )

    // Assert
    await waitFor(() => {
      expect(switchOf(DRAFT, 'Unpublish')).toBeInTheDocument()
    })
    expect(bodies(api)).toEqual([{ published: true }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('publishing a lesson ahead of the lesson its recall asks', () => {
  // Lessons 3 and 8 build on Lesson 1 alone; their recalls ask Lesson 2's
  // and Lesson 6's questions. The words are held in full in
  // lesson-publish.order.test.ts; these hold that the page asks them, with
  // or without a sign-off line before them.
  it("asks before it publishes Lesson 3 while Lesson 2 is not published, naming Lesson 2's questions", async () => {
    // Arrange
    const api = unpublished(2, 3)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(3, 'Publish'))

    // Assert
    const dialog = await screen.findByRole('alertdialog', {
      name: /^Publish Lesson 3 before (its sign-off and before )?Lesson 2\?$/,
    })
    expect(dialog).toHaveAccessibleDescription(
      /(^Lesson 3's recall|\. Its recall also) asks Lesson 2's questions, and Lesson 2 is not published here\. Publish it anyway\?$/,
    )
    expect(api.saves).toEqual([])
  })

  it("asks before it publishes Lesson 8 while Lesson 6 is not published, naming Lesson 6's questions", async () => {
    // Arrange
    const api = unpublished(6, 8)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(8, 'Publish'))

    // Assert
    const dialog = await screen.findByRole('alertdialog', {
      name: /^Publish Lesson 8 before (its sign-off and before )?Lesson 6\?$/,
    })
    expect(dialog).toHaveAccessibleDescription(
      /(^Lesson 8's recall|\. Its recall also) asks Lesson 6's questions, and Lesson 6 is not published here\. Publish it anyway\?$/,
    )
    expect(api.saves).toEqual([])
  })
})

describe('"Use default" that would put a lesson live', () => {
  it('asks a draft first, naming its sign-off, and saves nothing yet', async () => {
    // Arrange: the draft is unpublished here, and its default on this site
    // is published; every lesson it names is published.
    const api = unpublished(DRAFT)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(useDefaultOf(DRAFT))

    // Assert
    const dialog = await screen.findByRole('alertdialog', {
      name: `Publish Lesson ${DRAFT} before its sign-off?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      `Lesson ${DRAFT} waits on ${DRAFT_LESSONS[DRAFT]}. Publish it anyway?`,
    )
    expect(api.saves).toEqual([])
  })

  it('asks first when it would go ahead of the lesson it builds on, and saves nothing yet', async () => {
    // Arrange
    const api = unpublished(RELEASED_ON, RELEASED)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(useDefaultOf(RELEASED))

    // Assert
    const dialog = await screen.findByRole('alertdialog', {
      name: `Publish Lesson ${RELEASED} before Lesson ${RELEASED_ON}?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      `Lesson ${RELEASED} builds on Lesson ${RELEASED_ON}, which is not published here. Publish it anyway?`,
    )
    expect(api.saves).toEqual([])
  })

  it('goes back to the default on "Publish anyway", and hands the focus to the switch', async () => {
    // Arrange
    const api = unpublished(RELEASED_ON, RELEASED)
    renderPage(api)
    await settled()
    const useDefault = useDefaultOf(RELEASED)
    useDefault.focus()
    fireEvent.click(useDefault)
    const dialog = await screen.findByRole('alertdialog')

    // Act
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Publish anyway' }),
    )

    // Assert
    await waitFor(() => {
      expect(
        within(publishPanel(RELEASED)).getByRole('button', {
          name: `Unpublish Lesson ${RELEASED}`,
        }),
      ).toHaveFocus()
    })
    expect(bodies(api)).toEqual([{ published: null }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('stores nothing when the owner backs out', async () => {
    // Arrange
    const api = unpublished(RELEASED_ON, RELEASED)
    renderPage(api)
    await settled()
    fireEvent.click(useDefaultOf(RELEASED))
    const dialog = await screen.findByRole('alertdialog')

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    // Assert
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
    expect(api.saves).toEqual([])
    expect(
      within(publishPanel(RELEASED)).getByRole('button', {
        name: `Use default for Lesson ${RELEASED}`,
      }),
    ).toBeInTheDocument()
  })
})

describe('"Use default" that would not put a lesson live', () => {
  it('saves at once for a lesson it keeps live, ahead of the lesson it builds on', async () => {
    // Arrange: the lesson is published here and by default; the one it
    // builds on is unpublished here, which a publish would ask about.
    const api = fakeLessonApi({
      lessons: {
        [RELEASED]: { published: true },
        [RELEASED_ON]: { published: false },
      },
    })
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(useDefaultOf(RELEASED))

    // Assert
    await waitFor(() => {
      expect(bodies(api)).toEqual([{ published: null }])
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('unpublishing', () => {
  it('never asks for a lesson that is live ahead of one it builds on', async () => {
    // Arrange: the lesson stays published by default; the one it builds on
    // is unpublished here.
    const api = unpublished(RELEASED_ON)
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(RELEASED, 'Unpublish'))

    // Assert
    await waitFor(() => {
      expect(bodies(api)).toEqual([{ published: false }])
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('never asks for a lesson that live lessons build on', async () => {
    // Arrange: every lesson is at its default, so the lessons that build on
    // this one are live.
    const api = fakeLessonApi()
    renderPage(api)
    await settled()

    // Act
    fireEvent.click(switchOf(RELEASED_ON, 'Unpublish'))

    // Assert
    await waitFor(() => {
      expect(bodies(api)).toEqual([{ published: false }])
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
