// ============================================================
// Lesson admin — where each Find Your Pitch lesson stands, for the Lessons page
// ============================================================
//
// A lesson is published one of two ways. In code: its line in drafts.ts
// holds it back, and once the line is gone the release tag that ships the
// build makes it public (docs/plans/find-your-pitch/SEARCH.md § 12). Or from
// the Content Studio: an override in the lesson state (src/lib/lesson-state.ts)
// publishes or unpublishes it on one site whatever the code says, and the
// site follows within about a minute. This module turns the season's own data
// (season.ts, drafts.ts, films.ts) into one row per lesson, reads what the
// site it runs on really serves (each lesson's page, /sitemap.xml and
// /llms.txt), and derives each lesson's release checklist from the two and
// from its override. No DOM, so the page and its tests share every rule.
//
// Two rules keep a hidden draft out of a production build, which
// scripts/assert-draft-lessons.mjs fails if any script there names a hidden
// draft's address, and this module ships in that build's admin chunk:
//
//   1. No lesson address here is a string literal. Each is built from the
//      lesson number at run time (`lessonAddress`).
//   2. drafts.ts's list is only ever read in place, `DRAFT_LESSONS[n]`, and
//      never handed on as a value: not as an argument, not as a parameter's
//      default. An object that flows into a parameter is one the bundler
//      stops folding, and season.ts's draft entries need that fold to leave
//      a hidden draft's page out (kit/drafts.test.ts holds the rule).
//
// The site follows an override within about a minute: an unpublished
// lesson's address answers 404 and leaves both listings, and a published
// draft goes live and is listed without a release. The checklist weighs
// the override and the live check asks the site, so the page says when the
// two disagree.

import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import type { FilmRegistry, FilmSources, FilmState, } from '@/features/lessons/kit/films'
import { FILMS, filmSources, filmState } from '@/features/lessons/kit/films'
import type { Lesson } from '@/features/lessons/kit/season'
import { LESSONS } from '@/features/lessons/kit/season'

/**
 * Where a lesson stands in the build this page came from: released (its
 * page is public wherever this build runs), a draft (its page waits on a
 * sign-off, drafts.ts) or planned (no page yet).
 */
export type BuildState = 'released' | 'draft' | 'planned'

export interface LessonRow {
  readonly lesson: Lesson
  /** Its page's address, `/learn/NN`; null for the trailer, a film that never has a page. */
  readonly path: string | null
  readonly build: BuildState
  /** Whether this build serves its page: a released lesson, or a draft where drafts are shown. */
  readonly built: boolean
  /** Whether the repository holds its page at all, built here or not. */
  readonly written: boolean
  /** What a draft waits on, word for word from drafts.ts; null for any other lesson. */
  readonly waitingOn: string | null
  /** Its film, from films.ts: undefined while it has none. */
  readonly film: FilmState | undefined
  readonly sources: FilmSources | null
}

/** "Lesson 3", or "Trailer" for the season's film. */
export function lessonName(lesson: Lesson): string {
  return lesson.kind === 'Trailer' ? 'Trailer' : `Lesson ${lesson.n}`
}

/** Lesson `n`'s address on the site, `/learn/NN`, built at run time (see the banner). */
export function lessonAddress(n: number): string {
  return `/learn/${String(n).padStart(2, '0')}`
}

/** One row per lesson, in season order: the trailer, then Lessons 1 to 14. */
export function lessonRows(
  lessons: readonly Lesson[] = LESSONS,
  /** A draft list in drafts.ts's place, for a test; read in place otherwise (see the banner). */
  drafts?: Readonly<Partial<Record<number, string>>>,
  films: FilmRegistry = FILMS,
): LessonRow[] {
  return lessons.map((lesson) => {
    const waitingOn =
      (drafts === undefined ? DRAFT_LESSONS[lesson.n] : drafts[lesson.n]) ??
      null
    // season.ts folds a hidden draft's page away, so `page` is exactly
    // "this build serves it".
    const built = lesson.page !== undefined
    let build: BuildState = 'planned'
    if (waitingOn !== null) build = 'draft'
    else if (built) build = 'released'
    return {
      lesson,
      path:
        lesson.kind === 'Trailer'
          ? null
          : (lesson.page ?? lessonAddress(lesson.n)),
      build,
      built,
      written: built || waitingOn !== null,
      waitingOn,
      film: filmState(lesson.n, films),
      sources: filmSources(lesson.n, films),
    }
  })
}

// ── What the site serves ──────────────────────────────────────────

/** `fetch`, or a stand-in with its shape. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

// Read at call time, so a test that stubs the global is the one asked.
const fetchNow: Fetcher = (input, init) => fetch(input, init)

/** What a request for a lesson's page answered. */
export type PageCheck =
  | { readonly kind: 'checking' }
  | { readonly kind: 'answered'; readonly status: number }
  | { readonly kind: 'unreachable' }

/**
 * Ask the site for a page without downloading it: HEAD, then GET if the
 * host refuses HEAD. Never from the HTTP cache, so a deploy shows at once.
 * A failed request is `unreachable`, not a 404: the page may be there.
 */
export async function checkPage(
  path: string,
  fetcher: Fetcher = fetchNow,
): Promise<PageCheck> {
  try {
    const head = await fetcher(path, { method: 'HEAD', cache: 'no-store' })
    if (head.status !== 405 && head.status !== 501) {
      return { kind: 'answered', status: head.status }
    }
    const get = await fetcher(path, { cache: 'no-store' })
    void get.body?.cancel()
    return { kind: 'answered', status: get.status }
  } catch {
    return { kind: 'unreachable' }
  }
}

/** What reading /sitemap.xml or /llms.txt found: the page paths it lists. */
export type ListingCheck =
  | { readonly kind: 'checking' }
  | { readonly kind: 'read'; readonly paths: ReadonlySet<string> }
  | { readonly kind: 'unreadable'; readonly status?: number }

/**
 * A URL or an address, as the path a listing and a request agree on:
 * `https://mercurypitch.com/learn/01`, `/learn/01/` and `/learn/01.html`
 * are all `/learn/01`. The host is dropped on purpose: the dev site serves
 * the same listings, which name the production host.
 */
export function pagePath(value: string): string | null {
  try {
    const { pathname } = new URL(value, 'https://mercurypitch.com')
    return pathname.replace(/\.html$/, '').replace(/(.)\/+$/, '$1')
  } catch {
    return null
  }
}

function pathsOf(values: Iterable<string>): Set<string> {
  const paths = new Set<string>()
  for (const value of values) {
    const path = pagePath(value)
    if (path !== null) paths.add(path)
  }
  return paths
}

/** The page paths a sitemap's `<loc>` entries name. */
export function sitemapPaths(xml: string): Set<string> {
  return pathsOf(
    Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (m) => m[1]),
  )
}

/** The page paths llms.txt links, as Markdown links or bare URLs. */
export function llmsPaths(text: string): Set<string> {
  return pathsOf(
    Array.from(text.matchAll(/https?:\/\/[^\s<>()[\]"']+/g), (m) =>
      m[0].replace(/[.,;:!?]+$/, ''),
    ),
  )
}

/**
 * Read one listing. A host that answers it with an HTML page (a shell, a
 * 404 page) has no listing to read, which is not the same as listing
 * nothing.
 */
export async function readListing(
  path: string,
  parse: (body: string) => Set<string>,
  fetcher: Fetcher = fetchNow,
): Promise<ListingCheck> {
  try {
    const response = await fetcher(path, { cache: 'no-store' })
    const type = response.headers.get('content-type') ?? ''
    if (!response.ok || type.includes('text/html')) {
      void response.body?.cancel()
      return { kind: 'unreadable', status: response.status }
    }
    return { kind: 'read', paths: parse(await response.text()) }
  } catch {
    return { kind: 'unreadable' }
  }
}

/** Whether a listing names a path: null while it is unknown. */
export function listedIn(
  check: ListingCheck,
  path: string | null,
): boolean | null {
  if (check.kind !== 'read') return null
  return path !== null && check.paths.has(path)
}

// ── The release checklist ────────────────────────────────────────

/**
 * - `done` and `todo`: what the data or the site says.
 * - `by-hand`: a step nothing here can see.
 * - `checking`: the site has not answered yet.
 * - `unknown`: it could not be asked.
 * - `problem`: what the site serves contradicts the build.
 */
export type StepState =
  | 'done'
  | 'todo'
  | 'by-hand'
  | 'checking'
  | 'unknown'
  | 'problem'

export type StepId =
  | 'page'
  | 'release'
  | 'sitemap'
  | 'llms'
  | 'service-worker'
  | 'tests'
  | 'film'
  | 'live'
  | 'release-day'

export interface ReleaseStep {
  readonly id: StepId
  readonly text: string
  readonly state: StepState
  readonly detail?: string
}

/** What the site said about one lesson and the two listings. */
export interface SiteFindings {
  /** Null for a lesson with no page to ask for. */
  readonly page: PageCheck | null
  readonly sitemap: ListingCheck
  readonly llms: ListingCheck
}

function listingStep(
  id: 'sitemap' | 'llms',
  file: string,
  row: LessonRow,
  check: ListingCheck,
  published: boolean | null,
): ReleaseStep {
  const text = `Listed in ${file}`
  const listed = listedIn(check, row.path)
  if (listed === null) {
    return check.kind === 'checking'
      ? { id, text, state: 'checking' }
      : { id, text, state: 'unknown', detail: `Could not read ${file}.` }
  }
  // An override decides what the site should list; without one, the code
  // lists a released lesson and no other.
  const expected = published ?? row.build === 'released'
  if (listed && !expected) {
    return {
      id,
      text,
      state: 'problem',
      detail:
        published === false
          ? 'Listed, though it is unpublished here.'
          : 'Listed before its release: a draft stays out of both listings.',
    }
  }
  if (listed) return { id, text, state: 'done' }
  if (published === true) {
    return {
      id,
      text,
      state: 'todo',
      detail: 'Published here, not listed yet.',
    }
  }
  return published === false
    ? { id, text, state: 'todo', detail: 'Unpublished here.' }
    : { id, text, state: 'todo' }
}

function liveStep(
  row: LessonRow,
  page: PageCheck | null,
  published: boolean | null,
): ReleaseStep {
  const text = `${row.path ?? 'Its page'} answers 200 on this site`
  if (page === null) {
    return { id: 'live', text, state: 'todo', detail: 'It has no page yet.' }
  }
  if (page.kind === 'checking') return { id: 'live', text, state: 'checking' }
  if (page.kind === 'unreachable') {
    return {
      id: 'live',
      text,
      state: 'unknown',
      detail: 'The request failed before the site answered.',
    }
  }
  if (published !== null) return overriddenLive(row, page.status, published)
  if (page.status === 200) {
    return row.build === 'draft' && !row.built
      ? {
          id: 'live',
          text,
          state: 'problem',
          detail: 'This build leaves drafts out, yet the site serves the page.',
        }
      : { id: 'live', text, state: 'done' }
  }
  return {
    id: 'live',
    text,
    state: 'todo',
    detail:
      row.build === 'released'
        ? `It answers ${page.status}. The next release tag deploys it.`
        : `It answers ${page.status}.`,
  }
}

/** The live step of a lesson published or unpublished here: the site should agree. */
function overriddenLive(
  row: LessonRow,
  status: number,
  published: boolean,
): ReleaseStep {
  const text = `${row.path ?? 'Its page'} answers 200 on this site`
  if (published) {
    if (status === 200) return { id: 'live', text, state: 'done' }
    return {
      id: 'live',
      text,
      state: 'todo',
      detail: `Published here, but it answers ${status}. The site follows within about a minute of a save.`,
    }
  }
  return status === 200
    ? {
        id: 'live',
        text,
        state: 'problem',
        detail:
          'Unpublished here, yet the site serves it. The site follows within about a minute of a save.',
      }
    : {
        id: 'live',
        text,
        state: 'todo',
        detail: `Unpublished here, so it answers ${status}.`,
      }
}

/**
 * Lesson `row`'s release checklist, SEARCH.md § 12 in order, each step
 * marked from the build, from what the site said, and from its publish
 * override (`published`; null where the code decides). The trailer is a
 * film with no page, so it has none.
 */
export function releaseChecklist(
  row: LessonRow,
  site: SiteFindings,
  published: boolean | null = null,
): ReleaseStep[] {
  if (row.path === null) return []
  const file = `learn/${row.path.slice('/learn/'.length)}.html`
  const steps: ReleaseStep[] = [
    {
      id: 'page',
      text: `${file} is written, with its head and structured data`,
      state: row.written ? 'done' : 'todo',
      detail: 'SEARCH.md § 12 items 1 and 2.',
    },
  ]

  if (row.build === 'draft') {
    steps.push({
      id: 'release',
      text: 'Its line is deleted from src/features/lessons/kit/drafts.ts',
      state: 'todo',
      detail: `Waiting on ${row.waitingOn ?? 'a sign-off'}. It can be published here before then.`,
    })
  } else {
    steps.push({
      id: 'release',
      text: 'No line in src/features/lessons/kit/drafts.ts holds it back',
      state: row.build === 'released' ? 'done' : 'todo',
    })
  }

  steps.push(
    listingStep('sitemap', 'public/sitemap.xml', row, site.sitemap, published),
    listingStep('llms', 'public/llms.txt', row, site.llms, published),
    {
      id: 'service-worker',
      text: `The service worker leaves ${row.path} to the network (STANDALONE_DOCUMENT_PATHS in src/lib/sw-runtime.ts)`,
      state: row.written ? 'done' : 'todo',
      detail: row.written
        ? 'src/tests/lesson-pages.test.ts holds every lesson page to it.'
        : undefined,
    },
    row.build === 'released'
      ? {
          id: 'tests',
          text: 'src/tests/lesson-pages.test.ts passes for it',
          state: 'done',
          detail:
            'CI runs it on every change: head, structured data, both listings, the service worker and the first-paint budget.',
        }
      : {
          id: 'tests',
          text: 'Run src/tests/lesson-pages.test.ts and fix what it names',
          state: 'by-hand',
          detail:
            'Once its line is out of drafts.ts: head, structured data, both listings, the service worker and the first-paint budget.',
        },
  )

  if (row.film !== undefined) {
    steps.push({
      id: 'film',
      text: 'Its film has sources in src/features/lessons/kit/films.ts',
      state: row.film === 'published' ? 'done' : 'todo',
      detail:
        row.film === 'published'
          ? undefined
          : 'Made, not uploaded. Its host must be one the media-src rule in public/_headers allows.',
    })
  }

  steps.push(liveStep(row, site.page, published), {
    id: 'release-day',
    text: 'Release day: set datePublished and the sitemap date, request indexing in Search Console and Bing, and publish the episode on YouTube with the lesson link first',
    state: 'by-hand',
    detail: 'SEARCH.md § 12 item 5.',
  })
  return steps
}
