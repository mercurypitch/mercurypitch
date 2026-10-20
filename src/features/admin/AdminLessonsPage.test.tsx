// ============================================================
// The Content Studio's Lessons page — the season as it really stands
// ============================================================
//
// The page is read-only, so its whole worth is being right: one row per
// Season 1 lesson, a draft that says what it waits on in drafts.ts's own
// words, and a live column that is what the site answered, not what the
// build expects. The site is the one thing stubbed, at `fetch`; the rows
// are the season's real data (drafts shown, as on the dev site).

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import { LESSONS, TOPICS } from '@/features/lessons/kit/season'
import { AdminLessonsPage } from './AdminLessonsPage'
import { BEAT_SHEET, FILES, planFileUrl } from './lessons/blueprint-data'

/** How the stubbed site answers a path: a response, or a failed request. */
type Answer = { status: number; body?: string; type?: string } | 'offline'

const SITEMAP: Answer = {
  status: 200,
  type: 'application/xml',
  body: `<urlset>
    <url><loc>https://mercurypitch.com/</loc></url>
    <url><loc>https://mercurypitch.com/learn/01</loc></url>
    <url><loc>https://mercurypitch.com/learn/02</loc></url>
  </urlset>`,
}

/** Stub the site the page is served from; a path it does not know is a 404. */
function stubSite(answers: Record<string, Answer>) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = answers[String(input)] ?? { status: 404 }
      if (answer === 'offline') throw new TypeError('Failed to fetch')
      return new Response(
        init?.method === 'HEAD' ? null : (answer.body ?? ''),
        {
          status: answer.status,
          headers: { 'content-type': answer.type ?? 'text/plain' },
        },
      )
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function seasonRows(): HTMLElement[] {
  const table = screen.getByRole('table', { name: /^Season 1/ })
  const [, body] = within(table).getAllByRole('rowgroup')
  return within(body).getAllByRole('row')
}

/** One column's text down the whole season: 0 is "In this build", 1 "On this site", then Sitemap, llms.txt and Film. */
function column(index: number): string[] {
  return seasonRows().map(
    (row) => within(row).getAllByRole('cell')[index].textContent ?? '',
  )
}

function card(n: number): HTMLElement {
  const cards = screen.getByRole('region', { name: 'Lesson by lesson' })
  return within(cards).getAllByRole('group')[n]
}

const settled = () =>
  waitFor(() => {
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled()
  })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AdminLessonsPage', () => {
  it('draws one row for each Season 1 lesson, the trailer first', async () => {
    stubSite({})
    render(() => <AdminLessonsPage />)
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

  it("shows each draft row what it waits on, in drafts.ts's own words, and no other row", async () => {
    stubSite({})
    render(() => <AdminLessonsPage />)
    await settled()

    const drafts = Object.keys(DRAFT_LESSONS).map(Number)
    expect(drafts.length).toBeGreaterThan(0)
    seasonRows().forEach((row, n) => {
      const built = within(row).getAllByRole('cell')[0]
      if (drafts.includes(n)) {
        expect(built).toHaveTextContent(/^Draft/)
        expect(built).toHaveTextContent(`Waits on ${DRAFT_LESSONS[n]}`)
      } else {
        expect(built).not.toHaveTextContent(/Draft|Waits on/)
      }
    })
  })

  it('fills the live column from what the site answers, asking only for the lessons with a page', async () => {
    const fetchMock = stubSite({
      '/learn/01': { status: 200 },
      '/learn/02': { status: 200 },
      '/learn/03': { status: 404 },
      '/learn/04': { status: 500 },
      '/learn/05': 'offline',
      '/sitemap.xml': SITEMAP,
      '/llms.txt': { status: 404 },
    })
    render(() => <AdminLessonsPage />)
    await settled()

    expect(column(1)).toEqual([
      'No page',
      '200 Public',
      '200 Public',
      '404 Not found',
      '500 Error',
      'Unreachable',
      ...Array<string>(9).fill('No page yet'),
    ])
    expect(column(2)).toEqual([
      'Not listed',
      'Listed',
      'Listed',
      ...Array<string>(12).fill('Not listed'),
    ])
    expect(column(3)).toEqual(Array<string>(15).fill('Could not read'))
    expect(
      [...new Set(fetchMock.mock.calls.map(([input]) => String(input)))].sort(),
    ).toEqual([
      '/learn/01',
      '/learn/02',
      '/learn/03',
      '/learn/04',
      '/learn/05',
      '/llms.txt',
      '/sitemap.xml',
    ])
  })

  it('asks the site again on "Check again", and shows what it answers now', async () => {
    const answers: Record<string, Answer> = { '/learn/03': { status: 404 } }
    stubSite(answers)
    render(() => <AdminLessonsPage />)
    await settled()
    expect(column(1)[3]).toBe('404 Not found')

    answers['/learn/03'] = { status: 200 }
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await settled()

    expect(column(1)[3]).toBe('200 Public')
  })

  it("opens a lesson's card from its row, with the release steps it still needs", async () => {
    stubSite({ '/learn/03': { status: 200 } })
    render(() => <AdminLessonsPage />)
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
      `To do: Its line is deleted from src/features/lessons/kit/drafts.tsWaiting on ${DRAFT_LESSONS[3]}.`,
    )
    expect(steps).toContain('Done: /learn/03 answers 200 on this site')
  })

  it("keeps each lesson's team fields: what its drill still needs, its Signature and its topic codes", async () => {
    stubSite({})
    render(() => <AdminLessonsPage />)
    await settled()

    const lesson = LESSONS[2]
    const facts = within(card(2))
    expect(facts.getByText(lesson.pr.needs ?? 'no needs')).toBeInTheDocument()
    expect(facts.getByText(lesson.sig)).toBeInTheDocument()
    for (const topic of lesson.topics) {
      expect(facts.getByText(topic).closest('li')).toHaveTextContent(
        `${topic} ${TOPICS[topic]}`,
      )
    }
  })

  it('holds the series blueprint, with every plan file linked on main', async () => {
    stubSite({})
    render(() => <AdminLessonsPage />)
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
})
