// ============================================================
// AdminLessonsPage — publish each Find Your Pitch lesson, and see where it stands
// ============================================================
//
// THESIS: the owner switches a lesson on or off here, and picks its wording,
// and the page shows what the site really serves rather than what a save
// hoped for.
// FIRST VIEWPORT: the season in one table: each lesson's state on this site
// with its switch, its state in this build, what the site answers at its
// address, both listings and its film.
// FORM: a table to scan and switch, then a card per lesson to read and set:
// why it stands where it does, "Use default", its history, its hook and
// tease, the team's fields the lesson pages never draw and its release
// checklist. Then the series blueprint that used to close Lesson 1's page.
//
// A save goes to the lesson state (lessons/useLessonState.ts) and the site
// follows within about a minute; the page asks the site again a few seconds
// later. The live column is a few plain requests to the site the page is
// served from (lessons/lesson-admin.ts). A lesson with no override is the
// code's to decide, as before: deleting its line in drafts.ts releases it.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ChevronDown, Eye, RotateCcw } from '@/components/icons'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { DRAFTS_SHOWN } from '@/features/lessons/kit/draft-switch'
import type { Lesson } from '@/features/lessons/kit/season'
import { TOPICS } from '@/features/lessons/kit/season'
import { useConfirm } from '@/lib/use-confirm'
import styles from './AdminLessonsPage.module.css'
import type { CopyChoicesFor } from './lessons/copy-choices'
import { copyChoicesFor } from './lessons/copy-choices'
import type { LessonRow, ListingCheck, PageCheck, ReleaseStep, SiteFindings, StepId, StepState, } from './lessons/lesson-admin'
import { checkPage, lessonName, lessonRows, listedIn, llmsPaths, readListing, releaseChecklist, sitemapPaths, } from './lessons/lesson-admin'
import { asSentence, publishView, stateWord } from './lessons/lesson-publish'
import type { LessonActions } from './lessons/LessonControls'
import { PublishCell, PublishPanel, WordingPanel, } from './lessons/LessonControls'
import { LessonsBlueprint } from './lessons/LessonsBlueprint'
import type { Tone } from './lessons/LessonStatus'
import { Status, ToneIcon } from './lessons/LessonStatus'
import { useLessonState } from './lessons/useLessonState'

export interface AdminLessonsPageProps {
  /** The studio's verified admin key, sent with every save and history read. */
  adminKey: string
  /** Lock the studio to ask for the key again: offered when the API refuses this one. */
  onChangeKey?: () => void
  /** Each lesson's hook and tease choices; the season's own by default. */
  copyChoices?: CopyChoicesFor
  /** How long after a save the site is asked again, in ms. */
  recheckAfterMs?: number
}

const CHECKING = { kind: 'checking' } as const

/**
 * A few seconds: long enough for a site that reads the state at once to
 * show the change. Its caches can take up to a minute, which the page says
 * after every save, and "Check again" asks whenever the owner likes.
 */
const RECHECK_AFTER_MS = 5_000

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

function Fact(props: { term: string; children: JSX.Element }): JSX.Element {
  return (
    <div class={styles.fact}>
      <dt>{props.term}</dt>
      <dd>{props.children}</dd>
    </div>
  )
}

export function AdminLessonsPage(props: AdminLessonsPageProps): JSX.Element {
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
  const confirm = useConfirm()
  // Bumped by every run and on unmount, so an answer from an earlier run
  // never lands on a later one.
  let run = 0
  let recheck: ReturnType<typeof setTimeout> | undefined

  const lessons = useLessonState({
    adminKey: () => props.adminKey,
    onSaved: () => {
      clearTimeout(recheck)
      recheck = setTimeout(
        () => void checkSite(),
        props.recheckAfterMs ?? RECHECK_AFTER_MS,
      )
    },
  })

  const viewOf: LessonActions['viewOf'] = (row) => {
    if (lessons.state() === null) return null
    const log = lessons.logOf(row.lesson.n)
    return publishView(
      row,
      lessons.overrideOf(row.lesson.n),
      log?.kind === 'read' ? log.changes : null,
    )
  }

  const savePublished = (
    row: LessonRow,
    value: boolean | null,
  ): Promise<boolean> =>
    lessons.save({
      n: row.lesson.n,
      name: lessonName(row.lesson),
      field: 'published',
      value,
      defaultPublished: row.built,
    })

  /** Publish, asking first when the lesson still waits on its sign-off; or unpublish. */
  const toggle = (row: LessonRow): void => {
    const view = viewOf(row)
    if (view === null || !view.canPublish) return
    if (view.published) {
      void savePublished(row, false)
      return
    }
    const waitingOn = row.waitingOn
    if (waitingOn === null) {
      void savePublished(row, true)
      return
    }
    const name = lessonName(row.lesson)
    confirm.request({
      title: `Publish ${name} before its sign-off?`,
      message: `${name} waits on ${waitingOn}. Publish it anyway?`,
      confirmLabel: 'Publish anyway',
      confirmIcon: <Eye />,
      onConfirm: () => void savePublished(row, true),
    })
  }

  const actions: LessonActions = {
    lessons,
    viewOf,
    toggle,
    useDefault: (row) => savePublished(row, null),
    saveCopy: (row, field, value) => {
      void lessons.save({
        n: row.lesson.n,
        name: lessonName(row.lesson),
        field,
        value,
        defaultPublished: row.built,
      })
    },
    get onChangeKey() {
      return props.onChangeKey
    },
  }

  /** What the site said about a lesson's page: null for one with no page to ask for. */
  const pageOf = (row: LessonRow): PageCheck | null =>
    row.written && row.path !== null
      ? (pages().get(row.lesson.n) ?? CHECKING)
      : null

  /** The publish override the checklist weighs: null where the code decides. */
  const overrideOf = (row: LessonRow): boolean | null => {
    const view = viewOf(row)
    return view !== null && view.overridden && view.canPublish
      ? view.published
      : null
  }

  const checklists = createMemo(() => {
    const byLesson = new Map<number, ReleaseStep[]>()
    for (const row of rows) {
      const site: SiteFindings = {
        page: pageOf(row),
        sitemap: sitemap(),
        llms: llms(),
      }
      byLesson.set(row.lesson.n, releaseChecklist(row, site, overrideOf(row)))
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
    lessons.ensureLog(n)
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
    void lessons.readState()
  })
  onCleanup(() => {
    run += 1
    clearTimeout(recheck)
  })

  return (
    <div class={styles.page} data-testid="admin-lessons">
      <div class={styles.intro}>
        <p>
          Publish or unpublish a lesson here, and choose its hook and its tease.
          A change is saved at once, and the site follows within about a minute.
          Without one, the code decides: deleting a lesson's line in{' '}
          <code>src/features/lessons/kit/drafts.ts</code> releases it, and the
          next release tag deploys it. A film reaches its page once its sources
          are set in <code>src/features/lessons/kit/films.ts</code>.
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
            onClick={() => {
              if (!checking()) void checkSite()
            }}
            aria-disabled={checking() ? 'true' : undefined}
          >
            <RotateCcw size={14} />
            {checking() ? 'Checking…' : 'Check again'}
          </button>
        </div>
        <StateLine lessons={lessons} />
        <Show when={lessons.keyRejected()}>
          <div class={styles.keyNotice}>
            <p>
              The admin key was not accepted, so this page cannot save or show
              who changed what. Change admin key to unlock the studio again.
            </p>
            <Show when={props.onChangeKey !== undefined}>
              <button
                type="button"
                class={styles.recheck}
                onClick={() => props.onChangeKey?.()}
              >
                Change admin key
              </button>
            </Show>
          </div>
        </Show>
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
              Season 1: each lesson on {origin}, what this build holds, and what
              the site serves
            </caption>
            <thead>
              <tr>
                <th scope="col">Lesson</th>
                <th scope="col">Published here</th>
                <th scope="col">In this build</th>
                <th scope="col">Site answers</th>
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
                    <td class={styles.publishCell}>
                      <PublishCell row={row} actions={actions} />
                    </td>
                    <td class={styles.buildCell}>
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
          Why each lesson stands where it does on this site, its switches and
          its history, and its hook and tease. Then the team's fields, which the
          lesson pages never draw: what a practice link still needs, why a
          lesson has no drill, its Signature and its topic codes. Then what its
          release still needs.
        </p>
        <div class={styles.cards}>
          <For each={rows}>
            {(row) => (
              <details
                class={styles.card}
                ref={(card) => cards.set(row.lesson.n, card)}
                data-lesson={row.lesson.n}
                onToggle={(event) => {
                  if (event.currentTarget.open) lessons.ensureLog(row.lesson.n)
                }}
              >
                <summary class={styles.cardSummary}>
                  <span class={styles.lessonNumber}>
                    {lessonName(row.lesson)}
                  </span>
                  <span class={styles.cardTitle}>{row.lesson.title}</span>
                  <span class={styles.cardMeta}>
                    <Show when={viewOf(row)}>
                      {(view) => (
                        <span class={styles.cardState}>
                          {stateWord(view())}
                        </span>
                      )}
                    </Show>
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
                  <div class={styles.controls}>
                    <PublishPanel row={row} actions={actions} />
                    <WordingPanel
                      row={row}
                      actions={actions}
                      choices={(props.copyChoices ?? copyChoicesFor)(
                        row.lesson,
                      )}
                    />
                  </div>
                  <dl class={styles.facts}>
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
                              <ToneIcon
                                tone={step.state}
                                class={styles.stepIcon}
                              />
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

      {/* Saves are announced here once, whichever control made them; the
          words also stay under that control. A new object per message, so
          a repeat is announced again. */}
      <div class={styles.srOnly} role="status" aria-live="polite">
        <Show when={lessons.announcement()} keyed>
          {(said) => <span>{said.text}</span>}
        </Show>
      </div>
      <ConfirmDialog
        open={confirm.pending() !== null}
        title={confirm.pending()?.title ?? ''}
        message={confirm.pending()?.message ?? ''}
        confirmLabel={confirm.pending()?.confirmLabel}
        confirmIcon={confirm.pending()?.confirmIcon}
        tone="primary"
        onConfirm={confirm.accept}
        onCancel={confirm.cancel}
      />
    </div>
  )
}

/** Where the lesson state stands: read, being read, or not read and why. */
function StateLine(props: {
  lessons: ReturnType<typeof useLessonState>
}): JSX.Element {
  return (
    <div class={styles.statusRow}>
      <span class={styles.meta}>
        <Show
          when={props.lessons.stateError()}
          fallback={
            <Show
              when={props.lessons.stateReadAt()}
              fallback="Reading the lesson state…"
            >
              {(at) => <>Lesson state read at {TIME.format(at())}</>}
            </Show>
          }
        >
          {(error) => (
            <span class={styles.problem}>
              The lesson state could not be read. {asSentence(error().message)}
            </span>
          )}
        </Show>
      </span>
      <Show when={props.lessons.stateError() !== null}>
        <button
          type="button"
          class={styles.recheck}
          onClick={() => {
            if (!props.lessons.readingState()) void props.lessons.readState()
          }}
          aria-disabled={props.lessons.readingState() ? 'true' : undefined}
        >
          <RotateCcw size={14} />
          Read it again
        </button>
      </Show>
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
