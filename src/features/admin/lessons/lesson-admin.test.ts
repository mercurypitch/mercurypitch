// ============================================================
// Lesson admin rules — rows, live checks and the release checklist
// ============================================================
//
// The Lessons page is only as true as these rules: a draft must read as a
// draft with what it waits on, a listing must be read as the site serves
// it, and the checklist must never mark a step done that the data or the
// site does not show. The page test (AdminLessonsPage.test.tsx) holds the
// rendering; this holds the rules, against the season's own data.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import type { Lesson } from '@/features/lessons/kit/season'
import { LESSONS } from '@/features/lessons/kit/season'
import type { Fetcher, LessonRow, ListingCheck, PageCheck, ReleaseStep, } from './lesson-admin'
import { checkPage, lessonRows, llmsPaths, pagePath, readListing, releaseChecklist, sitemapPaths, } from './lesson-admin'

const repoFile = (path: string): string =>
  readFileSync(resolve(__dirname, '../../../..', path), 'utf8')

const SOURCES = {
  hd: 'https://media.example/01-hd.mp4',
  sd: 'https://media.example/01-sd.mp4',
}

/** A season entry as a build that leaves drafts out folds it: no page. */
function withoutPage(lesson: Lesson): Lesson {
  const folded: { -readonly [K in keyof Lesson]: Lesson[K] } = { ...lesson }
  delete folded.page
  delete folded.minutes
  return folded
}

function rowFor(
  n: number,
  rows: readonly LessonRow[] = lessonRows(),
): LessonRow {
  const row = rows.find((r) => r.lesson.n === n)
  if (row === undefined) throw new Error(`no row for lesson ${n}`)
  return row
}

const read = (...paths: string[]): ListingCheck => ({
  kind: 'read',
  paths: new Set(paths),
})
const answered = (status: number): PageCheck => ({ kind: 'answered', status })

const states = (steps: readonly ReleaseStep[]) =>
  steps.map((step) => [step.id, step.state])

describe('lessonRows', () => {
  it('gives every Season 1 lesson one row, the trailer first', () => {
    expect(lessonRows().map((row) => row.lesson.n)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
  })

  it('reads a lesson on the draft list as a draft, with what it waits on word for word', () => {
    const rows = lessonRows()

    expect(
      rows.filter((row) => row.build === 'draft').map((row) => row.lesson.n),
    ).toEqual(Object.keys(DRAFT_LESSONS).map(Number))
    for (const row of rows.filter((r) => r.build === 'draft')) {
      expect(row.waitingOn).toBe(DRAFT_LESSONS[row.lesson.n])
    }
  })

  it('reads a page with no draft line as released, and no page at all as planned', () => {
    const rows = lessonRows(LESSONS, {})

    expect(
      rows.filter((row) => row.build === 'released').map((row) => row.lesson.n),
    ).toEqual(
      LESSONS.filter((lesson) => lesson.page !== undefined).map(
        (lesson) => lesson.n,
      ),
    )
    expect(rowFor(6, rows)).toMatchObject({
      build: 'planned',
      built: false,
      written: false,
      waitingOn: null,
    })
  })

  it('tells a draft this build leaves out from one it shows', () => {
    const shown = rowFor(3, lessonRows([LESSONS[3]], { 3: 'a sign-off' }))
    const hidden = rowFor(
      3,
      lessonRows([withoutPage(LESSONS[3])], { 3: 'a sign-off' }),
    )

    expect(shown).toMatchObject({ build: 'draft', built: true, written: true })
    expect(hidden).toMatchObject({
      build: 'draft',
      built: false,
      written: true,
    })
    expect(hidden.path).toBe('/learn/03')
  })

  it('takes each film from films.ts: playing, made but not uploaded, or none', () => {
    const rows = lessonRows(LESSONS, {}, { 1: SOURCES, 2: null })

    expect(rowFor(1, rows)).toMatchObject({
      film: 'published',
      sources: SOURCES,
    })
    expect(rowFor(2, rows)).toMatchObject({ film: 'production', sources: null })
    expect(rowFor(4, rows)).toMatchObject({ film: undefined, sources: null })
  })

  it('gives the trailer no address, and every lesson its own', () => {
    const rows = lessonRows()

    expect(rowFor(0, rows).path).toBeNull()
    expect(rows.slice(1).map((row) => row.path)).toEqual(
      LESSONS.slice(1).map(
        (lesson) => `/learn/${String(lesson.n).padStart(2, '0')}`,
      ),
    )
  })
})

describe('the listings', () => {
  it('reads a URL, a trailing slash and .html as the same page', () => {
    expect(
      [
        'https://mercurypitch.com/learn/01',
        'https://dev.mercurypitch.com/learn/01/',
        '/learn/01.html',
        '/learn/01',
      ].map(pagePath),
    ).toEqual(['/learn/01', '/learn/01', '/learn/01', '/learn/01'])
    expect(pagePath('https://mercurypitch.com/')).toBe('/')
  })

  it("reads a sitemap's <loc> entries and nothing else", () => {
    const xml = `<urlset>
      <url><loc>https://mercurypitch.com/</loc><lastmod>2026-10-01</lastmod></url>
      <url>
        <loc>
          https://mercurypitch.com/learn/02
        </loc>
      </url>
      <!-- https://mercurypitch.com/learn/03 -->
    </urlset>`

    expect([...sitemapPaths(xml)]).toEqual(['/', '/learn/02'])
  })

  it('reads the links in llms.txt, Markdown or bare, without the punctuation after them', () => {
    const text = [
      '- [Lesson 1: What is a note?](https://mercurypitch.com/learn/01): why',
      'See https://mercurypitch.com/learn/04.',
      'Lesson 3 is not linked yet.',
    ].join('\n')

    expect([...llmsPaths(text)]).toEqual(['/learn/01', '/learn/04'])
  })

  it("finds exactly the released lessons in the repository's own listings", () => {
    const released = lessonRows()
      .filter((row) => row.build === 'released')
      .map((row) => row.path)
    const lessonsIn = (paths: Set<string>) =>
      [...paths].filter((path) => path.startsWith('/learn/')).sort()

    expect(lessonsIn(sitemapPaths(repoFile('public/sitemap.xml')))).toEqual(
      released,
    )
    expect(lessonsIn(llmsPaths(repoFile('public/llms.txt')))).toEqual(released)
  })
})

describe('checkPage', () => {
  it('asks with HEAD, past the HTTP cache, and reports the status', async () => {
    const fetcher = vi.fn<Fetcher>(
      async () => new Response(null, { status: 404 }),
    )

    await expect(checkPage('/learn/03', fetcher)).resolves.toEqual(
      answered(404),
    )
    expect(fetcher.mock.calls).toEqual([
      ['/learn/03', { method: 'HEAD', cache: 'no-store' }],
    ])
  })

  it('asks again with GET when the host refuses HEAD', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response('<!doctype html>', { status: 200 }))

    await expect(checkPage('/learn/01', fetcher)).resolves.toEqual(
      answered(200),
    )
    expect(fetcher.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(
      ['HEAD', 'GET'],
    )
  })

  it('reports a failed request as unreachable, never as a missing page', async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(checkPage('/learn/01', fetcher)).resolves.toEqual({
      kind: 'unreachable',
    })
  })
})

describe('readListing', () => {
  it('reads the paths a listing names', async () => {
    const fetcher = vi.fn<Fetcher>(
      async () =>
        new Response('<loc>https://mercurypitch.com/learn/01</loc>', {
          headers: { 'content-type': 'application/xml' },
        }),
    )

    await expect(
      readListing('/sitemap.xml', sitemapPaths, fetcher),
    ).resolves.toEqual(read('/learn/01'))
  })

  it("will not read an HTML page served in a listing's place as an empty listing", async () => {
    const fetcher = vi.fn<Fetcher>(
      async () =>
        new Response('<!doctype html><title>MercuryPitch</title>', {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    )

    await expect(readListing('/llms.txt', llmsPaths, fetcher)).resolves.toEqual(
      {
        kind: 'unreadable',
        status: 200,
      },
    )
  })

  it('reports a listing the site does not serve as unreadable, with its status', async () => {
    const fetcher = vi.fn<Fetcher>(
      async () => new Response('', { status: 404 }),
    )

    await expect(readListing('/llms.txt', llmsPaths, fetcher)).resolves.toEqual(
      {
        kind: 'unreadable',
        status: 404,
      },
    )
  })
})

describe('releaseChecklist', () => {
  const released = rowFor(1, lessonRows(LESSONS, {}, { 1: SOURCES }))
  const hiddenDraft = rowFor(
    3,
    lessonRows([withoutPage(LESSONS[3])], DRAFT_LESSONS),
  )

  it('marks a released, filmed lesson the site serves and lists done, bar the steps done by hand', () => {
    const steps = releaseChecklist(released, {
      page: answered(200),
      sitemap: read('/learn/01'),
      llms: read('/learn/01'),
    })

    expect(states(steps)).toEqual([
      ['page', 'done'],
      ['release', 'done'],
      ['sitemap', 'done'],
      ['llms', 'done'],
      ['service-worker', 'done'],
      ['tests', 'done'],
      ['film', 'done'],
      ['live', 'done'],
      ['release-day', 'by-hand'],
    ])
  })

  it('leaves a hidden draft its release steps, and names what it waits on', () => {
    const steps = releaseChecklist(hiddenDraft, {
      page: answered(404),
      sitemap: read('/learn/01'),
      llms: read('/learn/01'),
    })

    expect(states(steps)).toEqual([
      ['page', 'done'],
      ['release', 'todo'],
      ['sitemap', 'todo'],
      ['llms', 'todo'],
      ['service-worker', 'done'],
      ['tests', 'by-hand'],
      ['live', 'todo'],
      ['release-day', 'by-hand'],
    ])
    expect(steps.find((step) => step.id === 'release')?.detail).toBe(
      `Waiting on ${DRAFT_LESSONS[3]}.`,
    )
  })

  it('flags a draft the site serves, or lists, where this build leaves drafts out', () => {
    const steps = releaseChecklist(hiddenDraft, {
      page: answered(200),
      sitemap: read('/learn/03'),
      llms: read(),
    })

    expect(states(steps).filter(([, state]) => state === 'problem')).toEqual([
      ['sitemap', 'problem'],
      ['live', 'problem'],
    ])
  })

  it('waits for the site, and says so when it could not ask, before marking what it serves', () => {
    const waiting = releaseChecklist(released, {
      page: { kind: 'checking' },
      sitemap: { kind: 'checking' },
      llms: { kind: 'checking' },
    })
    const failed = releaseChecklist(released, {
      page: { kind: 'unreachable' },
      sitemap: { kind: 'unreadable', status: 500 },
      llms: { kind: 'unreadable' },
    })
    const served = (steps: readonly ReleaseStep[]) =>
      states(steps).filter(
        ([id]) => id === 'sitemap' || id === 'llms' || id === 'live',
      )

    expect(served(waiting)).toEqual([
      ['sitemap', 'checking'],
      ['llms', 'checking'],
      ['live', 'checking'],
    ])
    expect(served(failed)).toEqual([
      ['sitemap', 'unknown'],
      ['llms', 'unknown'],
      ['live', 'unknown'],
    ])
  })

  it('asks for a film only of a lesson that has one, and none of a planned lesson', () => {
    const site = { page: null, sitemap: read(), llms: read() }
    const ids = (n: number) =>
      releaseChecklist(
        rowFor(n, lessonRows(LESSONS, {}, { 2: null })),
        site,
      ).map((step) => step.id)

    expect(ids(2)).toContain('film')
    expect(ids(4)).not.toContain('film')
    expect(states(releaseChecklist(rowFor(6), site))).toEqual([
      ['page', 'todo'],
      ['release', 'todo'],
      ['sitemap', 'todo'],
      ['llms', 'todo'],
      ['service-worker', 'todo'],
      ['tests', 'by-hand'],
      ['live', 'todo'],
      ['release-day', 'by-hand'],
    ])
  })

  it('has no checklist for the trailer, a film with no page', () => {
    expect(
      releaseChecklist(rowFor(0), {
        page: null,
        sitemap: read(),
        llms: read(),
      }),
    ).toEqual([])
  })
})
