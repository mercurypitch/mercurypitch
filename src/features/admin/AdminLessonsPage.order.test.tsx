// ============================================================
// The Content Studio's Lessons page — publishing ahead of a lesson it builds on
// ============================================================
//
// A lesson's page points back to the lessons it builds on (season.ts
// PREREQ): its prerequisite chips name them. Before the console publishes
// a lesson while one of those is not published here, it asks, whether a
// drafts line stands or not; for a draft that would also get ahead of
// one, it asks once, naming both. Unpublishing never asks.
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
import { cellOf, settled } from './lessons/lesson-page.test-fixtures'
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
