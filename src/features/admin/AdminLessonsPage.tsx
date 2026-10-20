// ============================================================
// AdminLessonsPage — where each Find Your Pitch lesson stands, read-only
// ============================================================
//
// THESIS: publishing a lesson is a code change, so this page shows the
// truth rather than holding a switch.
// FIRST VIEWPORT: the season in one table: each lesson's state in this
// build, what this site serves at its address, both listings and its film.
// FORM: a table to scan, a card per lesson to read (the team's fields the
// lesson pages never draw, and the lesson's release checklist), then the
// series blueprint that used to close Lesson 1's page.
//
// It saves nothing and calls no admin API. Its rows are the season's own
// data and its live column is a few plain requests to the site it is
// served from; both live in lessons/lesson-admin.ts. A runtime publish
// toggle (PLAN Option B) would join there, not here.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { AlertTriangle, CheckCircle, ChevronDown, HelpCircle, Info, RotateCcw, } from '@/components/icons'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { DRAFTS_SHOWN } from '@/features/lessons/kit/draft-switch'
import type { Lesson } from '@/features/lessons/kit/season'
import { TOPICS } from '@/features/lessons/kit/season'
import styles from './AdminLessonsPage.module.css'
import type { LessonRow, ListingCheck, PageCheck, ReleaseStep, SiteFindings, StepId, StepState, } from './lessons/lesson-admin'
import { checkPage, lessonRows, listedIn, llmsPaths, readListing, releaseChecklist, sitemapPaths, } from './lessons/lesson-admin'
import { LessonsBlueprint } from './lessons/LessonsBlueprint'

/** How a cell or a step reads at a glance: a step's state, or nothing to say. */
type Tone = StepState | 'none'

const CHECKING = { kind: 'checking' } as const

const STATE_WORDS: Record<StepState, string> = {
  done: 'Done',
  todo: 'To do',
  'by-hand': 'By hand',
  checking: 'Checking',
  unknown: 'Could not check',
  problem: 'Problem',
}

const LANES: Record<Lesson['lane'], string> = {
  theory: 'Theory',
  voice: 'Voice',
  both: 'Theory and voice',
}

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function lessonName(lesson: Lesson): string {
  return lesson.kind === 'Trailer' ? 'Trailer' : `Lesson ${lesson.n}`
}

function pageLabel(check: PageCheck | null): string {
  if (check === null) return 'No page yet'
  if (check.kind === 'checking') return 'Checking…'
  if (check.kind === 'unreachable') return 'Unreachable'
  if (check.status === 200) return '200 Public'
  if (check.status === 404) return '404 Not found'
  return `${check.status} Error`
}

function listingLabel(check: ListingCheck, path: string | null): string {
  const listed = listedIn(check, path)
  if (listed === null) {
    return check.kind === 'checking' ? 'Checking…' : 'Could not read'
  }
  return listed ? 'Listed' : 'Not listed'
}

function filmTone(row: LessonRow): Tone {
  if (row.film === 'published') return 'done'
  return row.film === 'production' ? 'todo' : 'none'
}

function filmLabel(row: LessonRow): string {
  if (row.film === 'published') return 'Playing on its page'
  if (row.film === 'production') return 'Made, not uploaded'
  return 'None'
}

function buildTone(row: LessonRow): Tone {
  if (row.build === 'released') return 'done'
  return row.build === 'draft' ? 'todo' : 'none'
}

const BUILD_LABELS: Record<LessonRow['build'], string> = {
  released: 'Released',
  draft: 'Draft',
  planned: 'Planned',
}

/** The icon for a tone; the words beside it carry the meaning. */
function ToneIcon(props: { tone: Tone }): JSX.Element {
  return (
    <span class={styles.icon} data-tone={props.tone} aria-hidden="true">
      <Switch>
        <Match when={props.tone === 'done'}>
          <CheckCircle />
        </Match>
        <Match when={props.tone === 'todo' || props.tone === 'checking'}>
          <span class={styles.ring} />
        </Match>
        <Match when={props.tone === 'by-hand'}>
          <Info size={14} />
        </Match>
        <Match when={props.tone === 'unknown'}>
          <HelpCircle size={14} />
        </Match>
        <Match when={props.tone === 'problem'}>
          <AlertTriangle />
        </Match>
      </Switch>
    </span>
  )
}

function Status(props: { tone: Tone; children: JSX.Element }): JSX.Element {
  return (
    <span class={styles.status} data-tone={props.tone}>
      <ToneIcon tone={props.tone} />
      <span>{props.children}</span>
    </span>
  )
}

function Fact(props: { term: string; children: JSX.Element }): JSX.Element {
  return (
    <div class={styles.fact}>
      <dt>{props.term}</dt>
      <dd>{props.children}</dd>
    </div>
  )
}

export function AdminLessonsPage(): JSX.Element {
  const rows = lessonRows()
  const origin = window.location.origin
  const [pages, setPages] = createSignal<ReadonlyMap<number, PageCheck>>(
    new Map(),
  )
  const [sitemap, setSitemap] = createSignal<ListingCheck>(CHECKING)
  const [llms, setLlms] = createSignal<ListingCheck>(CHECKING)
  const [checking, setChecking] = createSignal(false)
  const [checkedAt, setCheckedAt] = createSignal<Date | null>(null)
  const cards = new Map<number, HTMLDetailsElement>()
  // Bumped by every run and on unmount, so an answer from an earlier run
  // never lands on a later one.
  let run = 0

  /** What the site said about a lesson's page: null for one with no page to ask for. */
  const pageOf = (row: LessonRow): PageCheck | null =>
    row.written && row.path !== null
      ? (pages().get(row.lesson.n) ?? CHECKING)
      : null

  const checklists = createMemo(() => {
    const byLesson = new Map<number, ReleaseStep[]>()
    for (const row of rows) {
      const site: SiteFindings = {
        page: pageOf(row),
        sitemap: sitemap(),
        llms: llms(),
      }
      byLesson.set(row.lesson.n, releaseChecklist(row, site))
    }
    return byLesson
  })

  const stepsOf = (row: LessonRow): ReleaseStep[] =>
    checklists().get(row.lesson.n) ?? []

  const toneOf = (row: LessonRow, id: StepId): Tone =>
    stepsOf(row).find((step) => step.id === id)?.state ?? 'none'

  // A lesson with no page yet is simply not listed, so its row marks only
  // a contradiction: a listing that names it anyway.
  const listingTone = (row: LessonRow, id: 'sitemap' | 'llms'): Tone => {
    const tone = toneOf(row, id)
    return row.written || tone === 'problem' ? tone : 'none'
  }

  const checkSite = async (): Promise<void> => {
    const id = ++run
    setChecking(true)
    setPages(new Map())
    setSitemap(CHECKING)
    setLlms(CHECKING)
    const asked = rows.flatMap((row) =>
      row.written && row.path !== null
        ? [{ n: row.lesson.n, path: row.path }]
        : [],
    )
    await Promise.all([
      ...asked.map(async ({ n, path }) => {
        const answer = await checkPage(path)
        if (id === run) setPages((prev) => new Map(prev).set(n, answer))
      }),
      readListing('/sitemap.xml', sitemapPaths).then((answer) => {
        if (id === run) setSitemap(answer)
      }),
      readListing('/llms.txt', llmsPaths).then((answer) => {
        if (id === run) setLlms(answer)
      }),
    ])
    if (id !== run) return
    setChecking(false)
    setCheckedAt(new Date())
  }

  /** Open a lesson's card and bring it into view, from its row in the table. */
  const reveal = (n: number): void => {
    const card = cards.get(n)
    if (card === undefined) return
    card.open = true
    if (typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    }
    card.querySelector('summary')?.focus({ preventScroll: true })
  }

  onMount(() => {
    void checkSite()
  })
  onCleanup(() => {
    run += 1
  })

  return (
    <div class={styles.page} data-testid="admin-lessons">
      <div class={styles.intro}>
        <p>
          Read-only. A lesson is published in code, not here: deleting its line
          in <code>src/features/lessons/kit/drafts.ts</code> releases it, and
          the next release tag deploys it. A film reaches its page once its
          sources are set in <code>src/features/lessons/kit/films.ts</code>.
        </p>
        <div class={styles.statusRow}>
          <span class={styles.badge} data-tone={DRAFTS_SHOWN ? 'todo' : 'done'}>
            {DRAFTS_SHOWN
              ? 'This build shows drafts'
              : 'This build leaves drafts out'}
          </span>
          <span class={styles.meta}>
            Live checks ask <strong>{origin}</strong>
            <Show when={checkedAt()}>
              {(at) => <> · checked at {TIME.format(at())}</>}
            </Show>
          </span>
          <button
            type="button"
            class={styles.recheck}
            onClick={() => void checkSite()}
            disabled={checking()}
          >
            <RotateCcw size={14} />
            {checking() ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </div>

      <section class={styles.section} aria-labelledby="admin-lessons-season">
        <h3 id="admin-lessons-season" class={styles.sectionTitle}>
          Season 1
        </h3>
        <div
          class={styles.tableWrap}
          role="region"
          aria-labelledby="admin-lessons-caption"
          tabindex="0"
        >
          <table class={styles.table}>
            <caption id="admin-lessons-caption" class={styles.srOnly}>
              Season 1: each lesson in this build, and what {origin} serves
            </caption>
            <thead>
              <tr>
                <th scope="col">Lesson</th>
                <th scope="col">In this build</th>
                <th scope="col">On this site</th>
                <th scope="col">Sitemap</th>
                <th scope="col">llms.txt</th>
                <th scope="col">Film</th>
              </tr>
            </thead>
            <tbody>
              <For each={rows}>
                {(row) => (
                  <tr data-lesson={row.lesson.n}>
                    <th scope="row">
                      <button
                        type="button"
                        class={styles.lessonLink}
                        onClick={() => reveal(row.lesson.n)}
                      >
                        <span class={styles.lessonNumber}>
                          {lessonName(row.lesson)}
                        </span>
                        <span class={styles.lessonTitle}>
                          {row.lesson.title}
                        </span>
                      </button>
                    </th>
                    <td>
                      <Status tone={buildTone(row)}>
                        {BUILD_LABELS[row.build]}
                      </Status>
                      <Show when={row.waitingOn}>
                        {(waitingOn) => (
                          <>
                            <span class={styles.sub}>
                              {row.built
                                ? 'Shown in this build'
                                : 'Left out of this build'}
                            </span>
                            <span class={styles.sub}>
                              Waits on {waitingOn()}
                            </span>
                          </>
                        )}
                      </Show>
                    </td>
                    <td>
                      <Status
                        tone={
                          pageOf(row) === null ? 'none' : toneOf(row, 'live')
                        }
                      >
                        {row.path === null ? 'No page' : pageLabel(pageOf(row))}
                      </Status>
                    </td>
                    <td>
                      <Status tone={listingTone(row, 'sitemap')}>
                        {listingLabel(sitemap(), row.path)}
                      </Status>
                    </td>
                    <td>
                      <Status tone={listingTone(row, 'llms')}>
                        {listingLabel(llms(), row.path)}
                      </Status>
                    </td>
                    <td>
                      <Status tone={filmTone(row)}>{filmLabel(row)}</Status>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </section>

      <section class={styles.section} aria-labelledby="admin-lessons-cards">
        <h3 id="admin-lessons-cards" class={styles.sectionTitle}>
          Lesson by lesson
        </h3>
        <p class={styles.sectionNote}>
          The team's fields, which the lesson pages never draw: what a practice
          link still needs, why a lesson has no drill, its Signature and its
          topic codes. Then what its release still needs.
        </p>
        <div class={styles.cards}>
          <For each={rows}>
            {(row) => (
              <details
                class={styles.card}
                ref={(card) => cards.set(row.lesson.n, card)}
                data-lesson={row.lesson.n}
              >
                <summary class={styles.cardSummary}>
                  <span class={styles.lessonNumber}>
                    {lessonName(row.lesson)}
                  </span>
                  <span class={styles.cardTitle}>{row.lesson.title}</span>
                  <span class={styles.cardMeta}>
                    <Status tone={buildTone(row)}>
                      {BUILD_LABELS[row.build]}
                    </Status>
                    <span class={styles.lane}>{LANES[row.lesson.lane]}</span>
                  </span>
                  <span class={styles.chevron} aria-hidden="true">
                    <ChevronDown />
                  </span>
                </summary>
                <div class={styles.cardBody}>
                  <dl class={styles.facts}>
                    <Fact term="Opens with">{row.lesson.hook}</Fact>
                    <Show when={row.path}>
                      {(path) => (
                        <Fact term="Page">
                          <Show
                            when={row.built}
                            fallback={
                              <>
                                <code>{path()}</code>,{' '}
                                {row.written
                                  ? 'left out of this build'
                                  : 'not written yet'}
                              </>
                            }
                          >
                            <a href={path()} target="_blank" rel="noopener">
                              <code>{path()}</code>
                            </a>
                            <Show when={row.lesson.minutes}>
                              {(minutes) => <>, {minutes()} min read</>}
                            </Show>
                          </Show>
                        </Fact>
                      )}
                    </Show>
                    <Fact term="Practice">
                      <Show when={row.lesson.pr.link} fallback="No drill">
                        {(link) => (
                          <>
                            <a
                              href={link().href}
                              target="_blank"
                              rel="noopener"
                            >
                              {link().label}
                            </a>{' '}
                            <span class={styles.muted}>{link().addr}</span>
                            <Show when={link().note}>
                              {(note) => <>, {note()}</>}
                            </Show>
                          </>
                        )}
                      </Show>
                    </Fact>
                    <Show when={row.lesson.pr.needs}>
                      {(needs) => <Fact term="Still needs">{needs()}</Fact>}
                    </Show>
                    <Show when={row.lesson.pr.none}>
                      {(none) => <Fact term="Why no drill">{none()}</Fact>}
                    </Show>
                    <Fact term="Signature">{row.lesson.sig}</Fact>
                    <Fact term="Topics">
                      <Show when={row.lesson.topics.length > 0} fallback="None">
                        <ul class={styles.topics}>
                          <For each={row.lesson.topics}>
                            {(topic) => (
                              <li>
                                <code>{topic}</code> {TOPICS[topic]}
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                    </Fact>
                    <Fact term="Film">
                      <FilmFact row={row} />
                    </Fact>
                  </dl>
                  <Show
                    when={stepsOf(row).length > 0}
                    fallback={
                      <p class={styles.sectionNote}>
                        The trailer is a film with no page of its own, so it has
                        no release checklist.
                      </p>
                    }
                  >
                    <div class={styles.checklist}>
                      <h4>Release checklist</h4>
                      <ol class={styles.steps}>
                        <For each={stepsOf(row)}>
                          {(step) => (
                            <li class={styles.step} data-state={step.state}>
                              <ToneIcon tone={step.state} />
                              <div>
                                <span class={styles.srOnly}>
                                  {STATE_WORDS[step.state]}:{' '}
                                </span>
                                {step.text}
                                <Show when={step.detail}>
                                  {(detail) => <small>{detail()}</small>}
                                </Show>
                              </div>
                            </li>
                          )}
                        </For>
                      </ol>
                    </div>
                  </Show>
                </div>
              </details>
            )}
          </For>
        </div>
      </section>

      <LessonsBlueprint />
    </div>
  )
}

/** A lesson's film as made: running time, and its sources once it has them. */
function FilmFact(props: { row: LessonRow }): JSX.Element {
  return (
    <Show
      when={props.row.sources}
      fallback={
        <>
          {props.row.film === 'production'
            ? 'Made, not uploaded'
            : props.row.lesson.len === undefined
              ? 'No film yet'
              : 'Planned'}
          <Show when={props.row.lesson.len}>{(len) => <>, {len()}</>}</Show>
          <Show when={props.row.film === 'production'}>
            <small>
              Its page has no Watch section or link until its sources are set.
            </small>
          </Show>
        </>
      }
    >
      {(sources) => (
        <>
          Playing on its page
          <Show when={props.row.lesson.len}>{(len) => <>, {len()}</>}</Show>
          <small>
            <a href={sources().hd} target="_blank" rel="noopener">
              1080p
            </a>{' '}
            ·{' '}
            <a href={sources().sd} target="_blank" rel="noopener">
              720p
            </a>
          </small>
        </>
      )}
    </Show>
  )
}
