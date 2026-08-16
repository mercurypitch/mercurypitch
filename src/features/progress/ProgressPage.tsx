// ============================================================
// Progress — the Resonance Atlas
// ============================================================
//
// THESIS: The Atlas is the interface: practice leaves physical pressure in a
// personal record, instead of becoming a wall of equal analytics cards.
// OWN-WORLD: Pressed obsidian fibre, blue-black lacquer, cold ivory type,
// signal aqua/violet evidence, and warm metal reserved for earned objects.
// STORY: Notice one honest moment, inspect its evidence, then return to the
// exact practice that can carry it forward.
// FIRST VIEWPORT: A dominant live Atlas takes roughly three quarters of the
// desktop stage; a narrow editorial inspector owns evidence and action. On a
// phone the inspector becomes an attached drawer beneath the full-width Atlas.
// FORM: Approved Resonance Atlas direction, with broad chapters rather than a
// conventional dashboard grid.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { iconByName, renderIcon } from '@/components/hidden-features-icons'
import { AlertTriangle, History, Repeat, RotateCcw, Share, Trophy, Voice, } from '@/components/icons'
import { InfoPopover } from '@/components/InfoPopover'
import styles from './ProgressPage.module.css'

export type ProgressSurfaceStatus = 'loading' | 'ready' | 'empty' | 'error'

export type ProgressSourceKind =
  | 'practice'
  | 'exercise'
  | 'challenge'
  | 'weekly'

export interface ProgressActionView {
  id: string
  label: string
  href?: string
  description?: string
}

export interface ProgressEvidenceView {
  id: string
  value: string
  label: string
  detail?: string
}

export interface ProgressMomentView {
  id: string
  kindLabel: string
  title: string
  context: string
  evidence: readonly ProgressEvidenceView[]
  reason: string
  confidenceLabel: string
  primaryAction?: ProgressActionView
  shareable: boolean
}

export interface ProgressMomentOptionView {
  id: string
  title: string
  kindLabel: string
}

export interface ProgressWeekView {
  id: string
  shortLabel: string
  rangeLabel: string
  activityLevel: number
  activeDaysLabel: string
  attemptsLabel: string
  summary: string
  sources: readonly ProgressSourceKind[]
  coverage: 'complete' | 'partial' | 'empty'
  milestoneLabel?: string
}

export interface ProgressPeriodOptionView {
  id: string
  label: string
}

export interface ProgressRhythmView {
  title: string
  summary: string
  facts: readonly ProgressEvidenceView[]
}

export interface ProgressThreadPointView {
  id: string
  label: string
  value: string
  /** A display coordinate derived from one comparable metric, from 0 to 1. */
  level: number
}

export interface ProgressSkillThreadView {
  id: string
  label: string
  context: string
  metricLabel: string
  summary: string
  points: readonly ProgressThreadPointView[]
  action?: ProgressActionView
}

export interface ProgressTraceView {
  label: string
  /** Immutable, downsampled display geometry. Values must be normalized 0–1. */
  values: readonly number[]
}

export interface ProgressVoiceAtlasView {
  title: string
  twinName?: string
  portraitUrl?: string
  measuredAtLabel: string
  description: string
  metrics: readonly ProgressEvidenceView[]
  trace?: ProgressTraceView
  actions: readonly ProgressActionView[]
}

export interface ProgressPathSegmentView {
  id: string
  label: string
  detail: string
  source?: ProgressSourceKind
  status: 'visited' | 'current' | 'quiet'
}

export interface ProgressPathsView {
  summary: string
  segments: readonly ProgressPathSegmentView[]
  recommendation?: ProgressActionView
  recommendationReason?: string
}

export interface ProgressMilestoneView {
  id: string
  title: string
  kindLabel: string
  earnedAtLabel: string
  detail: string
  artUrl?: string
  /**
   * The seed's icon name, for when there is no drawn medallion.
   *
   * Only the sixteen BADGE icons have art in `public/badges/`, and the
   * achievements draw from a much larger vocabulary — 46 of the 59 seeded
   * ones resolve to no `artUrl` at all. They were rendering as a nameless
   * empty disc, which reads as "locked" for something you have earned.
   */
  icon?: string
}

export interface ProgressLeagueView {
  title: string
  rankLabel: string
  periodLabel: string
  zoneLabel?: string
  artUrl?: string
  action?: ProgressActionView
}

export interface ProgressHistoryFilterView {
  id: string
  label: string
}

export interface ProgressHistoryItemView {
  id: string
  occurredAtLabel: string
  title: string
  context: string
  facts: readonly string[]
  storageLabel: string
  source: ProgressSourceKind
  coverageLabel?: string
  action?: ProgressActionView
}

export interface ProgressHistoryView {
  summary: string
  activeFilterId: string
  filters: readonly ProgressHistoryFilterView[]
  items: readonly ProgressHistoryItemView[]
}

export interface ProgressCoverageView {
  scopeLabel: string
  detail: string
  status: 'complete' | 'partial' | 'device-only' | 'offline'
  boundaryLabel?: string
  continuityAction?: ProgressActionView
}

export interface ProgressPageSnapshot {
  periodLabel: string
  periodContext: string
  activePeriodId: string
  periodOptions: readonly ProgressPeriodOptionView[]
  selectedWeekId?: string
  moment: ProgressMomentView
  alternateMoments?: readonly ProgressMomentOptionView[]
  weeks: readonly ProgressWeekView[]
  atlasTrace?: ProgressTraceView
  rhythm: ProgressRhythmView
  skillThreads: readonly ProgressSkillThreadView[]
  voice?: ProgressVoiceAtlasView
  paths: ProgressPathsView
  milestones: readonly ProgressMilestoneView[]
  milestonesAvailable?: boolean
  league?: ProgressLeagueView
  history: ProgressHistoryView
  coverage: ProgressCoverageView
}

export interface ProgressPageProps {
  status: ProgressSurfaceStatus
  snapshot?: ProgressPageSnapshot
  errorMessage?: string
  emptyAction?: ProgressActionView
  onRetry?: () => void
  onAction?: (action: ProgressActionView) => void
  onShareMoment?: (momentId: string) => void
  onPeriodChange?: (periodId: string) => void
  onWeekSelect?: (weekId: string) => void
  onMomentSelect?: (momentId: string) => void
  onHistoryFilterChange?: (filterId: string) => void
}

interface ActionControlProps {
  action: ProgressActionView
  class?: string
  onAction?: (action: ProgressActionView) => void
  children?: JSX.Element
}

const ActionControl: Component<ActionControlProps> = (props) => {
  const content = () => props.children ?? props.action.label

  return (
    <Show
      when={props.action.href}
      fallback={
        <button
          type="button"
          class={props.class}
          title={props.action.description}
          onClick={() => props.onAction?.(props.action)}
        >
          {content()}
        </button>
      }
    >
      {(href) => (
        <a
          class={props.class}
          href={href()}
          title={props.action.description}
          onClick={() => props.onAction?.(props.action)}
        >
          {content()}
        </a>
      )}
    </Show>
  )
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function toPolyline(
  values: readonly number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) return ''
  if (values.length === 1) {
    return `${width / 2},${height - clampUnit(values[0]) * height}`
  }

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - clampUnit(value) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function sourceLabel(source: ProgressSourceKind): string {
  if (source === 'weekly') return 'Weekly Legend'
  return source.charAt(0).toUpperCase() + source.slice(1)
}

function weekSourceClass(source: ProgressSourceKind | undefined): string {
  if (source === 'practice') return styles.weekSourcePractice
  if (source === 'exercise') return styles.weekSourceExercise
  if (source === 'challenge') return styles.weekSourceChallenge
  if (source === 'weekly') return styles.weekSourceWeekly
  return styles.weekSourceNone
}

function weekAccessibleLabel(week: ProgressWeekView): string {
  const sources =
    week.sources.length === 0
      ? 'No recorded source'
      : `Sources: ${week.sources.map(sourceLabel).join(', ')}`
  const coverage =
    week.coverage === 'partial'
      ? 'Coverage: partial loaded history'
      : week.coverage === 'empty'
        ? 'Coverage: complete, no scored attempt'
        : 'Coverage: complete'
  const milestone =
    week.milestoneLabel === undefined
      ? ''
      : ` Milestone: ${week.milestoneLabel}.`
  return `${week.rangeLabel}. ${week.summary} ${sources}. ${coverage}.${milestone}`
}

const LoadingSurface: Component = () => (
  <section
    class={`${styles.page} ${styles.loadingPage} mp-dark-stage`}
    aria-label="Progress"
    aria-busy="true"
  >
    <div class={styles.loadingHeader}>
      <span class={styles.loadingWord} />
      <span class={styles.loadingPill} />
    </div>
    <div class={styles.loadingOpening}>
      <div class={styles.loadingAtlas}>
        <span class={styles.loadingStratum} />
        <span class={styles.loadingStratum} />
        <span class={styles.loadingStratum} />
      </div>
      <div class={styles.loadingInspector}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
    <p class={styles.srOnly} role="status" aria-live="polite">
      Opening your progress record.
    </p>
  </section>
)

const EmptySurface: Component<{
  action?: ProgressActionView
  onAction?: (action: ProgressActionView) => void
}> = (props) => (
  <section
    class={`${styles.page} ${styles.emptyPage} mp-dark-stage`}
    aria-labelledby="progress-title"
  >
    <div class={styles.pageHeader}>
      <div>
        <h1 id="progress-title">Progress</h1>
        <p>Your practice record</p>
      </div>
    </div>
    <div class={`${styles.opening} ${styles.emptyOpening}`}>
      <div class={styles.atlasPlate}>
        <div class={styles.atlasTexture} aria-hidden="true" />
        <div class={styles.atlasScrim} aria-hidden="true" />
        <div class={styles.emptyPressure} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div class={styles.emptyCopy}>
          <span class={styles.atlasName}>Resonance Atlas</span>
          <h2>
            Finish one practice and this surface starts holding your story.
          </h2>
          <p>
            Your first completed session becomes a reading. A second compatible
            attempt can begin a comparison.
          </p>
          <Show when={props.action}>
            {(action) => (
              <ActionControl
                action={action()}
                class={styles.primaryAction}
                onAction={props.onAction}
              >
                <Repeat />
                <span>{action().label}</span>
              </ActionControl>
            )}
          </Show>
        </div>
      </div>
    </div>
  </section>
)

const ErrorSurface: Component<{
  message?: string
  onRetry?: () => void
}> = (props) => (
  <section
    class={`${styles.page} ${styles.errorPage} mp-dark-stage`}
    aria-labelledby="progress-title"
  >
    <div class={styles.pageHeader}>
      <div>
        <h1 id="progress-title">Progress</h1>
        <p>Your practice record</p>
      </div>
    </div>
    <div class={`${styles.opening} ${styles.errorOpening}`}>
      <div class={styles.atlasPlate}>
        <div class={styles.atlasTexture} aria-hidden="true" />
        <div class={styles.atlasScrim} aria-hidden="true" />
        <div class={styles.errorCopy} role="alert">
          <AlertTriangle />
          <span class={styles.atlasName}>The Atlas could not open</span>
          <h2>Your saved record is still where you left it.</h2>
          <p>{props.message ?? 'Try opening Progress again.'}</p>
          <Show when={props.onRetry !== undefined}>
            <button
              type="button"
              class={styles.primaryAction}
              onClick={() => props.onRetry?.()}
            >
              <RotateCcw />
              <span>Try again</span>
            </button>
          </Show>
        </div>
      </div>
    </div>
  </section>
)

export function ProgressPage(props: ProgressPageProps): JSX.Element {
  const [selectedWeekId, setSelectedWeekId] = createSignal<string>()
  const [inspectorExpanded, setInspectorExpanded] = createSignal(false)

  createEffect(() => {
    const snapshot = props.snapshot
    if (snapshot === undefined) {
      setSelectedWeekId(undefined)
      return
    }
    setSelectedWeekId(
      snapshot.selectedWeekId ?? snapshot.weeks.at(-1)?.id ?? undefined,
    )
  })

  const selectedWeekIndex = createMemo(() => {
    const snapshot = props.snapshot
    if (snapshot === undefined) return -1
    return snapshot.weeks.findIndex((week) => week.id === selectedWeekId())
  })

  const selectedWeek = createMemo(() => {
    const snapshot = props.snapshot
    if (snapshot === undefined) return undefined
    return snapshot.weeks[selectedWeekIndex()]
  })

  const selectWeek = (week: ProgressWeekView): void => {
    setSelectedWeekId(week.id)
    props.onWeekSelect?.(week.id)
  }

  const selectAndFocusWeek = (week: ProgressWeekView): void => {
    selectWeek(week)
    const button = document.getElementById(`progress-week-${week.id}`)
    if (button instanceof HTMLButtonElement) button.focus()
  }

  const moveWeekSelection = (direction: -1 | 1): void => {
    const snapshot = props.snapshot
    if (snapshot === undefined || snapshot.weeks.length === 0) return
    const current = selectedWeekIndex()
    const fallbackIndex = direction === 1 ? 0 : snapshot.weeks.length - 1
    const nextIndex =
      current === -1
        ? fallbackIndex
        : Math.min(snapshot.weeks.length - 1, Math.max(0, current + direction))
    const week = snapshot.weeks[nextIndex]
    if (week !== undefined) selectAndFocusWeek(week)
  }

  const handleAtlasKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveWeekSelection(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveWeekSelection(1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const week = props.snapshot?.weeks[0]
      if (week !== undefined) selectAndFocusWeek(week)
    } else if (event.key === 'End') {
      event.preventDefault()
      const week = props.snapshot?.weeks.at(-1)
      if (week !== undefined) selectAndFocusWeek(week)
    }
  }

  return (
    <Show when={props.status !== 'loading'} fallback={<LoadingSurface />}>
      <Show
        when={props.status !== 'empty'}
        fallback={
          <EmptySurface action={props.emptyAction} onAction={props.onAction} />
        }
      >
        <Show
          when={props.snapshot}
          fallback={
            <ErrorSurface
              message={props.errorMessage}
              onRetry={props.onRetry}
            />
          }
        >
          {(snapshot) => (
            <section
              class={`${styles.page} mp-dark-stage`}
              classList={{ [styles.hasError]: props.status === 'error' }}
              aria-labelledby="progress-title"
              data-progress-state={props.status}
            >
              <a class={styles.skipLink} href="#progress-chapters">
                Skip to progress chapters
              </a>

              <div class={styles.pageHeader}>
                <div>
                  <h1 id="progress-title">Progress</h1>
                  <p>{snapshot().coverage.scopeLabel}</p>
                </div>
                <div class={styles.headerControls}>
                  <Show
                    when={snapshot().periodOptions.length > 1}
                    fallback={
                      <span class={styles.periodStatic}>
                        {snapshot().periodOptions[0]?.label ??
                          snapshot().periodLabel}
                      </span>
                    }
                  >
                    <div
                      class={styles.periodPicker}
                      aria-label="Progress period"
                    >
                      <For each={snapshot().periodOptions}>
                        {(period) => (
                          <button
                            type="button"
                            aria-pressed={
                              period.id === snapshot().activePeriodId
                            }
                            classList={{
                              [styles.periodActive]:
                                period.id === snapshot().activePeriodId,
                            }}
                            onClick={() => props.onPeriodChange?.(period.id)}
                          >
                            {period.label}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                  <span class={styles.coverageScope}>
                    {snapshot().periodContext}
                  </span>
                </div>
              </div>

              <div class={styles.opening}>
                <div class={styles.atlasPlate}>
                  <div class={styles.atlasTexture} aria-hidden="true" />
                  <div class={styles.atlasScrim} aria-hidden="true" />
                  <div class={styles.atlasLens} aria-hidden="true" />

                  <div class={styles.atlasHeading}>
                    <div>
                      <span class={styles.atlasName}>Resonance Atlas</span>
                      <strong>{snapshot().periodLabel}</strong>
                    </div>
                    <span>
                      {selectedWeek()?.rangeLabel ?? snapshot().moment.context}
                    </span>
                  </div>

                  <Show when={snapshot().atlasTrace}>
                    {(trace) => (
                      <svg
                        class={styles.atlasTrace}
                        viewBox="0 0 1000 250"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient
                            id="progress-atlas-trace"
                            x1="0"
                            x2="1"
                          >
                            <stop
                              offset="0"
                              stop-color="#8a74e8"
                              stop-opacity="0.45"
                            />
                            <stop offset="0.66" stop-color="#6ccbed" />
                            <stop offset="1" stop-color="#d8f8ff" />
                          </linearGradient>
                        </defs>
                        <polyline
                          points={toPolyline(trace().values, 1000, 250)}
                          vector-effect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </Show>

                  <div
                    class={styles.weekField}
                    role="group"
                    aria-label={`Practice by week. ${snapshot().rhythm.summary}`}
                    style={
                      {
                        '--week-count': Math.max(1, snapshot().weeks.length),
                      } as JSX.CSSProperties
                    }
                    onKeyDown={handleAtlasKeyDown}
                  >
                    <For each={snapshot().weeks}>
                      {(week, index) => {
                        const selected = () => week.id === selectedWeekId()
                        const sourceClass = () =>
                          weekSourceClass(week.sources[0])
                        return (
                          <button
                            id={`progress-week-${week.id}`}
                            type="button"
                            class={`${styles.weekStratum} ${sourceClass()}`}
                            classList={{
                              [styles.weekSelected]: selected(),
                              [styles.weekPartial]: week.coverage === 'partial',
                              [styles.weekEmpty]: week.coverage === 'empty',
                            }}
                            style={
                              {
                                '--week-pressure': clampUnit(
                                  week.activityLevel,
                                ),
                              } as JSX.CSSProperties
                            }
                            aria-pressed={selected()}
                            aria-label={weekAccessibleLabel(week)}
                            tabindex={selected() ? 0 : -1}
                            onClick={() => selectWeek(week)}
                          >
                            <span
                              class={styles.weekPressure}
                              aria-hidden="true"
                            />
                            <span
                              class={styles.weekSourceMarks}
                              aria-hidden="true"
                            >
                              <For each={week.sources}>
                                {(source) => <i data-source={source} />}
                              </For>
                            </span>
                            <Show when={week.milestoneLabel}>
                              <span
                                class={styles.milestonePin}
                                title={week.milestoneLabel}
                                aria-hidden="true"
                              />
                            </Show>
                            <span
                              class={styles.weekLabel}
                              classList={{
                                [styles.weekLabelVisible]:
                                  index() === 0 ||
                                  index() === snapshot().weeks.length - 1 ||
                                  selected(),
                              }}
                            >
                              {week.shortLabel}
                            </span>
                          </button>
                        )
                      }}
                    </For>
                  </div>

                  <div class={styles.atlasKey} aria-label="Atlas legend">
                    <Show when={snapshot().atlasTrace}>
                      {(trace) => (
                        <span>
                          <i class={styles.keyActivity} aria-hidden="true" />
                          {trace().label}
                        </span>
                      )}
                    </Show>
                    <span>
                      <i class={styles.keyPractice} />
                      Practice
                    </span>
                    <span>
                      <i class={styles.keyExercise} />
                      Exercise
                    </span>
                    <span>
                      <i class={styles.keyChallenge} />
                      Challenge
                    </span>
                    <span>
                      <i class={styles.keyWeekly} />
                      Weekly Legend
                    </span>
                  </div>
                </div>

                <aside class={styles.inspector} aria-labelledby="moment-title">
                  <div class={styles.inspectorLead}>
                    <div class={styles.momentKicker}>
                      <span>One Moment</span>
                      <span>{snapshot().moment.kindLabel}</span>
                    </div>
                    <h2 id="moment-title">{snapshot().moment.title}</h2>
                    <p class={styles.momentContext}>
                      {snapshot().moment.context}
                    </p>
                  </div>

                  <button
                    type="button"
                    class={styles.drawerToggle}
                    aria-expanded={inspectorExpanded()}
                    aria-controls="progress-inspector-detail"
                    onClick={() => setInspectorExpanded((open) => !open)}
                  >
                    <span aria-hidden="true" />
                    {inspectorExpanded() ? 'Close evidence' : 'View evidence'}
                  </button>

                  <div
                    id="progress-inspector-detail"
                    class={styles.inspectorDetail}
                    classList={{
                      [styles.inspectorDetailOpen]: inspectorExpanded(),
                    }}
                  >
                    <dl class={styles.evidenceList}>
                      <For each={snapshot().moment.evidence.slice(0, 3)}>
                        {(fact) => (
                          <div>
                            <dt>{fact.label}</dt>
                            <dd>{fact.value}</dd>
                            <Show when={fact.detail}>
                              <span>{fact.detail}</span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </dl>

                    <div class={styles.weekReading} aria-live="polite">
                      <span>
                        {selectedWeek()?.rangeLabel ?? 'Selected period'}
                      </span>
                      <strong>
                        {selectedWeek()?.summary ?? snapshot().moment.context}
                      </strong>
                      <Show when={selectedWeek()}>
                        {(week) => (
                          <small>
                            {week().activeDaysLabel} · {week().attemptsLabel}
                          </small>
                        )}
                      </Show>
                    </div>

                    <div class={styles.whyMoment}>
                      <InfoPopover
                        class={styles.whyMomentTrigger}
                        panelClass={styles.whyMomentPanel}
                        label="Why this moment was selected"
                        triggerLabel="Why this?"
                      >
                        <p>{snapshot().moment.reason}</p>
                        <span>{snapshot().moment.confidenceLabel}</span>
                      </InfoPopover>
                    </div>

                    <Show when={(snapshot().alternateMoments?.length ?? 0) > 0}>
                      <div class={styles.momentAlternates}>
                        <span>Other moments</span>
                        <For each={snapshot().alternateMoments}>
                          {(moment) => (
                            <button
                              type="button"
                              onClick={() => props.onMomentSelect?.(moment.id)}
                            >
                              <span>{moment.kindLabel}</span>
                              {moment.title}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>

                    <div
                      class={styles.coverageNote}
                      data-coverage={snapshot().coverage.status}
                    >
                      <span>{snapshot().coverage.scopeLabel}</span>
                      <p>{snapshot().coverage.detail}</p>
                      <Show when={snapshot().coverage.boundaryLabel}>
                        {(label) => <small>{label()}</small>}
                      </Show>
                      <Show when={snapshot().coverage.continuityAction}>
                        {(action) => (
                          <ActionControl
                            action={action()}
                            onAction={props.onAction}
                          >
                            {action().label}
                          </ActionControl>
                        )}
                      </Show>
                    </div>

                    <Show when={props.status === 'error'}>
                      <div class={styles.inlineError} role="alert">
                        <AlertTriangle />
                        <div>
                          <strong>Some updates could not be loaded.</strong>
                          <p>
                            {props.errorMessage ??
                              'The last available record is shown.'}
                          </p>
                        </div>
                        <Show when={props.onRetry !== undefined}>
                          <button
                            type="button"
                            onClick={() => props.onRetry?.()}
                          >
                            Retry
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>

                  <div class={styles.momentActions}>
                    <Show when={snapshot().moment.primaryAction}>
                      {(action) => (
                        <ActionControl
                          action={action()}
                          class={styles.primaryAction}
                          onAction={props.onAction}
                        >
                          <Repeat />
                          <span>{action().label}</span>
                        </ActionControl>
                      )}
                    </Show>
                    <Show
                      when={
                        snapshot().moment.shareable &&
                        props.onShareMoment !== undefined
                      }
                    >
                      <button
                        type="button"
                        class={styles.shareAction}
                        onClick={() =>
                          props.onShareMoment?.(snapshot().moment.id)
                        }
                      >
                        <Share />
                        <span>Share this moment</span>
                      </button>
                    </Show>
                  </div>
                </aside>
              </div>

              <section
                class={styles.rhythmBand}
                aria-labelledby="practice-rhythm-title"
              >
                <div class={styles.rhythmCopy}>
                  <span>Practice Rhythm</span>
                  <h2 id="practice-rhythm-title">{snapshot().rhythm.title}</h2>
                  <p>{snapshot().rhythm.summary}</p>
                </div>
                <dl class={styles.rhythmFacts}>
                  <For each={snapshot().rhythm.facts}>
                    {(fact) => (
                      <div>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                        <Show when={fact.detail}>
                          <span>{fact.detail}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </dl>
                <div class={styles.sourceLegend}>
                  <For
                    each={
                      ['practice', 'exercise', 'challenge', 'weekly'] as const
                    }
                  >
                    {(source) => (
                      <span>
                        <i data-source={source} />
                        {sourceLabel(source)}
                      </span>
                    )}
                  </For>
                </div>
              </section>

              <div id="progress-chapters" class={styles.chapters}>
                <section
                  class={styles.threadsChapter}
                  aria-labelledby="skill-threads-title"
                >
                  <div class={styles.chapterHeader}>
                    <div>
                      <span>Comparable attempts only</span>
                      <h2 id="skill-threads-title">Skill Threads</h2>
                    </div>
                    <p>
                      One reading stands alone. Matching attempts can show a
                      thread without mixing unlike work.
                    </p>
                  </div>

                  <Show
                    when={snapshot().skillThreads.length > 0}
                    fallback={
                      <div class={styles.chapterEmpty}>
                        <strong>No comparable thread yet.</strong>
                        <p>
                          Repeat the same exercise to begin an Earlier/Later
                          view.
                        </p>
                      </div>
                    }
                  >
                    <div class={styles.threadLedger}>
                      <For each={snapshot().skillThreads}>
                        {(thread) => (
                          <article class={styles.thread}>
                            <div class={styles.threadIdentity}>
                              <span>{thread.context}</span>
                              <h3>{thread.label}</h3>
                              <p>{thread.summary}</p>
                            </div>
                            <div class={styles.threadPlot}>
                              <span class={styles.threadMetric}>
                                {thread.metricLabel}
                              </span>
                              <Show
                                when={thread.points.length > 1}
                                fallback={
                                  <div class={styles.singleReading}>
                                    <i aria-hidden="true" />
                                    <span>
                                      {thread.points[0]?.value ??
                                        'Reading saved'}
                                    </span>
                                  </div>
                                }
                              >
                                <svg
                                  viewBox="0 0 640 128"
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                >
                                  <polyline
                                    points={toPolyline(
                                      thread.points.map((point) => point.level),
                                      640,
                                      128,
                                    )}
                                    vector-effect="non-scaling-stroke"
                                  />
                                </svg>
                                <ol
                                  aria-label={`${thread.label}, ${thread.metricLabel}`}
                                >
                                  <For each={thread.points}>
                                    {(point) => (
                                      <li>
                                        <span>{point.label}</span>
                                        <strong>{point.value}</strong>
                                      </li>
                                    )}
                                  </For>
                                </ol>
                              </Show>
                            </div>
                            <Show when={thread.action}>
                              {(action) => (
                                <ActionControl
                                  action={action()}
                                  class={styles.textAction}
                                  onAction={props.onAction}
                                />
                              )}
                            </Show>
                          </article>
                        )}
                      </For>
                    </div>
                  </Show>
                </section>

                <section
                  class={styles.voiceChapter}
                  aria-labelledby="voice-atlas-title"
                >
                  <div class={styles.voiceObject}>
                    <Show
                      when={snapshot().voice?.portraitUrl}
                      fallback={
                        <div class={styles.voiceSilhouette} aria-hidden="true">
                          <Voice />
                        </div>
                      }
                    >
                      {(src) => (
                        <img
                          src={src()}
                          width="360"
                          height="447"
                          loading="lazy"
                          decoding="async"
                          alt={
                            snapshot().voice?.twinName === undefined
                              ? 'Latest voiceprint portrait'
                              : `${snapshot().voice?.twinName} — your latest voice twin`
                          }
                        />
                      )}
                    </Show>
                    <span>Voice identity</span>
                  </div>

                  <div class={styles.voiceLandscape}>
                    <div>
                      <div>
                        <span>
                          {snapshot().voice?.measuredAtLabel ??
                            'Not mapped yet'}
                        </span>
                        <h2 id="voice-atlas-title">
                          {snapshot().voice?.title ??
                            'Your Voice Atlas begins with a voiceprint.'}
                        </h2>
                      </div>
                      <Show when={snapshot().voice?.twinName}>
                        {(twin) => <strong>Voice twin · {twin()}</strong>}
                      </Show>
                    </div>

                    <p class={styles.voiceDescription}>
                      {snapshot().voice?.description ??
                        'Map your range once to place your voice identity beside your practice record.'}
                    </p>

                    <Show when={snapshot().voice?.trace}>
                      {(trace) => (
                        <figure class={styles.voiceTrace}>
                          <svg
                            viewBox="0 0 760 170"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <polyline
                              points={toPolyline(trace().values, 760, 170)}
                              vector-effect="non-scaling-stroke"
                            />
                          </svg>
                          <figcaption>{trace().label}</figcaption>
                        </figure>
                      )}
                    </Show>

                    <Show when={(snapshot().voice?.metrics.length ?? 0) > 0}>
                      <dl class={styles.voiceMetrics}>
                        <For each={snapshot().voice?.metrics}>
                          {(metric) => (
                            <div>
                              <dt>{metric.label}</dt>
                              <dd>{metric.value}</dd>
                              <Show when={metric.detail}>
                                <span>{metric.detail}</span>
                              </Show>
                            </div>
                          )}
                        </For>
                      </dl>
                    </Show>

                    <div class={styles.voiceActions}>
                      <For each={snapshot().voice?.actions ?? []}>
                        {(action) => (
                          <ActionControl
                            action={action}
                            class={styles.textAction}
                            onAction={props.onAction}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                </section>

                <section
                  class={styles.pathsChapter}
                  aria-labelledby="practice-paths-title"
                >
                  <div class={styles.chapterHeader}>
                    <div>
                      <span>Where practice has taken you</span>
                      <h2 id="practice-paths-title">Practice Paths</h2>
                    </div>
                    <p>{snapshot().paths.summary}</p>
                  </div>

                  <ol class={styles.pathRoute}>
                    <For each={snapshot().paths.segments}>
                      {(segment) => (
                        <li
                          data-status={segment.status}
                          data-source={segment.source}
                        >
                          <i aria-hidden="true" />
                          <div>
                            <strong>{segment.label}</strong>
                            <span>{segment.detail}</span>
                          </div>
                        </li>
                      )}
                    </For>
                  </ol>

                  <Show when={snapshot().paths.recommendation}>
                    {(action) => (
                      <div class={styles.pathRecommendation}>
                        <div>
                          <span class={styles.pathRecommendationLabel}>
                            Next useful step
                          </span>
                          <p>{snapshot().paths.recommendationReason}</p>
                        </div>
                        <ActionControl
                          action={action()}
                          class={styles.primaryAction}
                          onAction={props.onAction}
                        >
                          <Repeat />
                          <span>{action().label}</span>
                        </ActionControl>
                      </div>
                    )}
                  </Show>
                </section>

                <section
                  class={styles.milestonesChapter}
                  aria-labelledby="milestones-title"
                >
                  <div class={styles.shelfHeader}>
                    <div>
                      <span>Earned, not estimated</span>
                      <h2 id="milestones-title">Milestones</h2>
                    </div>
                    <Trophy />
                  </div>

                  <div
                    classList={{
                      [styles.shelfScroll]: true,
                      [styles.shelfScrollWithLeague]:
                        snapshot().league !== undefined,
                    }}
                  >
                    {/* The golden rail is drawn on this wrapper, not on the
                        shelf. An absolutely positioned child of a scroll
                        container measures the SCROLLPORT, so the rail was
                        exactly one screen wide and stopped under the third
                        badge however far the list ran. */}
                    <div class={styles.shelfRail}>
                      <ul
                        class={styles.milestoneShelf}
                        tabindex="0"
                        aria-label="Earned milestones. Swipe or scroll horizontally to browse."
                      >
                        <Show when={snapshot().milestonesAvailable !== false}>
                          <For each={snapshot().milestones}>
                            {(milestone) => (
                              <li>
                                <div class={styles.milestoneObject}>
                                  <Show
                                    when={milestone.artUrl}
                                    fallback={
                                      <span aria-hidden="true">
                                        {renderIcon(
                                          iconByName(milestone.icon ?? ''),
                                        )}
                                      </span>
                                    }
                                  >
                                    {(src) => (
                                      <img
                                        src={src()}
                                        width="96"
                                        height="96"
                                        loading="lazy"
                                        decoding="async"
                                        alt=""
                                      />
                                    )}
                                  </Show>
                                </div>
                                <span>{milestone.kindLabel}</span>
                                <strong>{milestone.title}</strong>
                                <p>{milestone.detail}</p>
                                <small>{milestone.earnedAtLabel}</small>
                              </li>
                            )}
                          </For>
                        </Show>
                        <Show
                          when={
                            snapshot().milestonesAvailable !== false &&
                            snapshot().milestones.length === 0
                          }
                        >
                          <li class={styles.emptyShelf}>
                            <div class={styles.milestoneObject}>
                              <span aria-hidden="true" />
                            </div>
                            <strong>
                              Your first earned mark will rest here.
                            </strong>
                            <p>
                              Milestones appear only after their real
                              requirement is met.
                            </p>
                          </li>
                        </Show>
                        <Show when={snapshot().milestonesAvailable === false}>
                          <li class={styles.emptyShelf}>
                            <div class={styles.milestoneObject}>
                              <span aria-hidden="true" />
                            </div>
                            <strong>Earned marks are unavailable.</strong>
                            <p>
                              Reconnect to load your saved badges and
                              achievements. Nothing has been removed.
                            </p>
                          </li>
                        </Show>
                      </ul>
                    </div>

                    <Show when={snapshot().league}>
                      {(league) => (
                        <aside class={styles.leagueObject}>
                          <Show when={league().artUrl}>
                            {(src) => (
                              <img
                                src={src()}
                                width="128"
                                height="128"
                                loading="lazy"
                                decoding="async"
                                alt=""
                              />
                            )}
                          </Show>
                          <span>{league().periodLabel}</span>
                          <h3>{league().title}</h3>
                          <strong>{league().rankLabel}</strong>
                          <Show when={league().zoneLabel}>
                            <p>{league().zoneLabel}</p>
                          </Show>
                          <Show when={league().action}>
                            {(action) => (
                              <ActionControl
                                action={action()}
                                class={styles.textAction}
                                onAction={props.onAction}
                              />
                            )}
                          </Show>
                        </aside>
                      )}
                    </Show>
                  </div>
                </section>

                <section
                  class={styles.historyChapter}
                  aria-labelledby="progress-history-title"
                >
                  <div class={styles.historyHeader}>
                    <div>
                      <History />
                      <div>
                        <span>The record behind the story</span>
                        <h2 id="progress-history-title">History</h2>
                      </div>
                    </div>
                    <p>{snapshot().history.summary}</p>
                  </div>

                  <div
                    class={styles.historyFilters}
                    aria-label="Filter history"
                  >
                    <For each={snapshot().history.filters}>
                      {(filter) => (
                        <button
                          type="button"
                          aria-pressed={
                            filter.id === snapshot().history.activeFilterId
                          }
                          onClick={() =>
                            props.onHistoryFilterChange?.(filter.id)
                          }
                        >
                          {filter.label}
                        </button>
                      )}
                    </For>
                  </div>

                  <Show
                    when={snapshot().history.items.length > 0}
                    fallback={
                      <div class={styles.historyEmpty}>
                        No recorded practice matches this filter.
                      </div>
                    }
                  >
                    <ol class={styles.historyList}>
                      <For each={snapshot().history.items}>
                        {(item) => (
                          <li>
                            <time>{item.occurredAtLabel}</time>
                            <i data-source={item.source} aria-hidden="true" />
                            <div class={styles.historyIdentity}>
                              <span>
                                {sourceLabel(item.source)} · {item.context}
                              </span>
                              <strong>{item.title}</strong>
                              <Show when={item.coverageLabel}>
                                <small>{item.coverageLabel}</small>
                              </Show>
                            </div>
                            <div class={styles.historyFacts}>
                              <For each={item.facts}>
                                {(fact) => <span>{fact}</span>}
                              </For>
                            </div>
                            <span class={styles.storageLabel}>
                              {item.storageLabel}
                            </span>
                            <Show when={item.action}>
                              {(action) => (
                                <ActionControl
                                  action={action()}
                                  class={styles.historyAction}
                                  onAction={props.onAction}
                                >
                                  {action().label}
                                </ActionControl>
                              )}
                            </Show>
                          </li>
                        )}
                      </For>
                    </ol>
                  </Show>
                </section>
              </div>
            </section>
          )}
        </Show>
      </Show>
    </Show>
  )
}
