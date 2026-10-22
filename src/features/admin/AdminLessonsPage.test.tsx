// ============================================================
// The Content Studio's Lessons page — the season as it really stands
// ============================================================
//
// The page's read side, whose whole worth is being right: one row per
// Season 1 lesson, its state on this site and why, a draft that says what
// it waits on in drafts.ts's own words, and a live column that is what the
// site answered, not what the build expects. The site and the lesson-state
// API are the things stubbed, at `fetch`; the rows are the season's real
// data (drafts shown, as on the dev site). Saving is
// AdminLessonsPage.publish.test.tsx.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import { LESSONS, TOPICS } from '@/features/lessons/kit/season'
import { SIGNATURES } from '@/features/lessons/kit/team-notes'
import { AdminLessonsPage } from './AdminLessonsPage'
import { BEAT_SHEET, FILES, planFileUrl } from './lessons/blueprint-data'
import { lessonRows } from './lessons/lesson-admin'
import { card, cellOf, column, openCard, seasonRows, settled, } from './lessons/lesson-page.test-fixtures'
import type { SiteAnswer } from './lessons/lesson-site.test-fixtures'
import { ADMIN_KEY, fakeLessonApi, logged, sitePathsAsked, stubLessonSite, } from './lessons/lesson-site.test-fixtures'

const SITEMAP: SiteAnswer = {
  status: 200,
  type: 'application/xml',
  body: `<urlset>
    <url><loc>https://mercurypitch.com/</loc></url>
    <url><loc>https://mercurypitch.com/learn/01</loc></url>
    <url><loc>https://mercurypitch.com/learn/02</loc></url>
  </urlset>`,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AdminLessonsPage', () => {
  it('draws one row for each Season 1 lesson, the trailer first', async () => {
    stubLessonSite({})
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    const rows = seasonRows()
    expect(rows).toHaveLength(15)
    rows.forEach((row, i) => {
      expect(within(row).getByRole('rowheader')).toHaveTextContent(
        LESSONS[i].title,
      )
    })
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent(/^Trailer/)
  })

  it("shows each draft row what it waits on, in drafts.ts's own words, and that this site shows drafts, and no other row", async () => {
    stubLessonSite({})
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    const drafts = Object.keys(DRAFT_LESSONS).map(Number)
    expect(drafts.length).toBeGreaterThan(0)
    seasonRows().forEach((row, n) => {
      const built = within(row).getAllByRole('cell')[1]
      if (drafts.includes(n)) {
        expect(built).toHaveTextContent(
          `DraftShown here by defaultWaits on ${DRAFT_LESSONS[n]}`,
        )
      } else {
        expect(built).not.toHaveTextContent(/Draft|by default|Waits on/)
      }
    })
  })

  it('fills the live column from what the site answers, asking only for the lessons with a page', async () => {
    const fetchMock = stubLessonSite({
      '/learn/01': { status: 200 },
      '/learn/02': { status: 200 },
      '/learn/03': { status: 404 },
      '/learn/04': { status: 500 },
      '/learn/05': 'offline',
      '/sitemap.xml': SITEMAP,
      '/llms.txt': { status: 404 },
    })
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    expect(column(2)).toEqual([
      'No page',
      '200 Public',
      '200 Public',
      '404 Not found',
      '500 Error',
      'Unreachable',
      // Lessons 6, 7 and 8 have pages in this build, and this site knows none
      '404 Not found',
      '404 Not found',
      '404 Not found',
      ...Array<string>(6).fill('No page yet'),
    ])
    expect(column(3)).toEqual([
      'Not listed',
      'Listed',
      'Listed',
      ...Array<string>(12).fill('Not listed'),
    ])
    expect(column(4)).toEqual(Array<string>(15).fill('Could not read'))
    expect(sitePathsAsked(fetchMock)).toEqual([
      '/learn/01',
      '/learn/02',
      '/learn/03',
      '/learn/04',
      '/learn/05',
      '/learn/06',
      '/learn/07',
      '/learn/08',
      '/llms.txt',
      '/sitemap.xml',
    ])
  })

  it('asks the site again on "Check again", and shows what it answers now', async () => {
    const answers: Record<string, SiteAnswer> = {
      '/learn/03': { status: 404 },
    }
    stubLessonSite(answers)
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()
    expect(column(2)[3]).toBe('404 Not found')

    answers['/learn/03'] = { status: 200 }
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await settled()

    expect(column(2)[3]).toBe('200 Public')
  })

  it("opens a lesson's card from its row, with the release steps it still needs", async () => {
    stubLessonSite({ '/learn/03': { status: 200 } })
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()
    expect(card(3)).not.toHaveAttribute('open')

    fireEvent.click(
      within(seasonRows()[3]).getByRole('button', { name: /Match a note/ }),
    )

    expect(card(3)).toHaveAttribute('open')
    const steps = within(card(3))
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(steps).toContain(
      `To do: Its line is deleted from src/features/lessons/kit/drafts.tsWaiting on ${DRAFT_LESSONS[3]}. It can be published here before then.`,
    )
    expect(steps).toContain('Done: /learn/03 answers 200 on this site')
  })

  it("keeps each lesson's team fields: what its drill still needs, its Signature and its topic codes", async () => {
    stubLessonSite({})
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    const lesson = LESSONS[2]
    const facts = within(card(2))
    expect(facts.getByText(lesson.pr.needs ?? 'no needs')).toBeInTheDocument()
    expect(
      facts.getByText(SIGNATURES[2] ?? 'a signature').closest('div'),
    ).toHaveTextContent(/^Signature/)
    for (const topic of lesson.topics) {
      expect(facts.getByText(topic).closest('li')).toHaveTextContent(
        `${topic} ${TOPICS[topic]}`,
      )
    }
  })

  it('holds the series blueprint, with every plan file linked on main', async () => {
    stubLessonSite({})
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    expect(
      screen.getByRole('heading', { name: 'Series blueprint' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: BEAT_SHEET.label }),
    ).toBeInTheDocument()
    for (const [path] of FILES) {
      expect(screen.getByRole('link', { name: path })).toHaveAttribute(
        'href',
        planFileUrl(path),
      )
    }
  })

  it("says each lesson's state on this site and why: the code's default where nothing is set here", async () => {
    stubLessonSite({})
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    const draft = Number(Object.keys(DRAFT_LESSONS)[0])
    const planned =
      lessonRows().find((row) => row.path !== null && !row.written)?.lesson.n ??
      -1
    expect(cellOf(0, 0)).toHaveTextContent(
      /^No pageA film, with no page of its own$/,
    )
    expect(cellOf(1, 0)).toHaveTextContent(
      /^PublishedDefault: released in code/,
    )
    expect(cellOf(draft, 0)).toHaveTextContent(
      /^PublishedDefault: this site shows drafts/,
    )
    expect(cellOf(planned, 0)).toHaveTextContent(
      new RegExp(`^Publish Lesson ${planned}: No page yet$`),
    )
    expect(within(cellOf(0, 0)).queryAllByRole('button')).toEqual([])
    expect(
      within(cellOf(planned, 0)).getByRole('button', {
        name: `Publish Lesson ${planned}: No page yet`,
      }),
    ).toBeDisabled()
  })

  it('draws a state set here as set here, with who set it and when, in the row and on the card', async () => {
    stubLessonSite(
      {},
      fakeLessonApi({
        lessons: { '1': { published: false } },
        log: [
          logged({ id: 1, lesson: 1, field: 'published', newValue: false }),
        ],
      }),
    )
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    await waitFor(() => {
      expect(cellOf(1, 0)).toHaveTextContent(
        /^UnpublishedSet here by owner@example, Oct 20, 2:02 PM/,
      )
    })
    expect(
      within(cellOf(1, 0)).getByRole('button', { name: 'Publish Lesson 1' }),
    ).toBeEnabled()
    expect(card(1).querySelector('summary')).toHaveTextContent(
      /^Lesson 1.+UnpublishedReleased/,
    )
  })

  it("shows a lesson's latest change on its card, and the few before it on request", async () => {
    stubLessonSite(
      {},
      fakeLessonApi({
        lessons: { '1': { published: false } },
        log: [
          logged({ id: 4, lesson: 1, field: 'published', newValue: false }),
          logged({
            id: 3,
            lesson: 1,
            field: 'published',
            newValue: true,
            changedBy: null,
          }),
          logged({ id: 2, lesson: 1, field: 'hook', newValue: 'figures' }),
          logged({ id: 1, lesson: 1, field: 'tease', newValue: null }),
          logged({ id: 5, lesson: 2, field: 'published', newValue: true }),
        ],
      }),
    )
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    const panel = within(openCard(1)).getByRole('region', {
      name: 'On this site',
    })
    await waitFor(() => {
      expect(within(panel).getByText(/^Unpublished by/)).toHaveTextContent(
        'Unpublished by owner@example, Oct 20, 2:02 PM',
      )
    })
    const earlier = within(panel).getByText('Earlier changes (3)')
    expect(earlier).toHaveTextContent('Earlier changes to Lesson 1 (3)')
    expect(
      within(earlier.closest('details') ?? panel)
        .getAllByRole('listitem', { hidden: true })
        .map((item) => item.textContent?.replace(/\u00a0/g, ' ')),
    ).toEqual([
      'Published with the shared admin key, Oct 20, 2:02 PM',
      'Hook set to “figures” by owner@example, Oct 20, 2:02 PM',
      'Tease set back to the default by owner@example, Oct 20, 2:02 PM',
    ])
  })

  it('says a lesson with no change made here is left to the code', async () => {
    stubLessonSite({})
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)
    await settled()

    const panel = within(openCard(2)).getByRole('region', {
      name: 'On this site',
    })

    expect(
      await within(panel).findByText(/^No change made here yet/),
    ).toHaveTextContent('No change made here yet: the code decides all of it.')
    expect(panel).toHaveTextContent(
      'The default here is published: it is released in code.',
    )
  })

  it('says when the lesson state cannot be read, and reads it again on request', async () => {
    const api = fakeLessonApi({ lessons: { '1': { published: false } } })
    api.failNextRead = 'offline'
    stubLessonSite({}, api)
    render(() => <AdminLessonsPage adminKey={ADMIN_KEY} />)

    expect(
      await screen.findByText(/^The lesson state could not be read/),
    ).toHaveTextContent(
      'The lesson state could not be read. The content API could not be reached.',
    )
    expect(cellOf(1, 0)).toHaveTextContent('Could not read')

    fireEvent.click(screen.getByRole('button', { name: 'Read it again' }))
    await settled()

    expect(cellOf(1, 0)).toHaveTextContent(/^Unpublished/)
    expect(screen.queryByRole('button', { name: 'Read it again' })).toBeNull()
  })
})
